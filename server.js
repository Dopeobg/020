const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const url = require("url");

// Простая подгрузка .env без внешних пакетов
function loadEnv() {
  try {
    const envPath = path.join(__dirname, ".env");
    if (!fs.existsSync(envPath)) return;

    const content = fs.readFileSync(envPath, "utf8");
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) return;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      if (key && !(key in process.env)) {
        process.env[key] = value;
      }
    });
  } catch (err) {
    console.warn("Не удалось прочитать .env:", err);
  }
}

loadEnv();

const PORT = Number(process.env.PORT) || 3000;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.warn(
    "ВНИМАНИЕ: Не заданы TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID в .env. Отправка заявок в Telegram работать не будет."
  );
}

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

function normalizePhoneToPlus7(phone) {
  const digitsOnly = String(phone || "").replace(/\D+/g, "");

  if (!digitsOnly) {
    return "";
  }

  let digits = digitsOnly;

  // Если номер начинается с 8 — заменяем на 7, но длину не меняем
  if (digits[0] === "8") {
    digits = "7" + digits.slice(1);
  }

  // Возвращаем + и все цифры, которые оставил пользователь
  return `+${digits}`;
}

function sendTelegramMessage(text) {
  return new Promise((resolve, reject) => {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      return reject(
        new Error("TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID не заданы в переменных окружения.")
      );
    }

    const apiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${encodeURIComponent(
      TELEGRAM_CHAT_ID
    )}&text=${encodeURIComponent(text)}&parse_mode=HTML`;

    https
      .get(apiUrl, (response) => {
        let data = "";

        response.on("data", (chunk) => {
          data += chunk;
        });

        response.on("end", () => {
          if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
            try {
              const parsed = JSON.parse(data);
              if (!parsed.ok) {
                return reject(
                  new Error(`Telegram API вернул ошибку: ${parsed.description || "unknown error"}`)
                );
              }
            } catch {
              // если JSON не распарсился, но код 2xx — всё равно считаем успехом
            }
            resolve(true);
          } else {
            reject(
              new Error(
                `Telegram API статус ${response.statusCode}: ${
                  data ? data.toString().slice(0, 200) : "нет тела ответа"
                }`
              )
            );
          }
        });
      })
      .on("error", (err) => {
        reject(err);
      });
  });
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".svg":
      return "image/svg+xml";
    case ".ico":
      return "image/x-icon";
    default:
      return "application/octet-stream";
  }
}

function serveStaticFile(filePath, res) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === "ENOENT") {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("404 Not Found");
      } else {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("500 Internal Server Error");
      }
      return;
    }

    const mime = getMimeType(filePath);
    res.writeHead(200, { "Content-Type": mime });
    res.end(data);
  });
}

function handleSendBooking(req, res) {
  let body = "";

  req.on("data", (chunk) => {
    body += chunk.toString("utf8");
    if (body.length > 1e6) {
      // защита от слишком больших запросов
      req.socket.destroy();
    }
  });

  req.on("end", async () => {
    let data;
    try {
      data = body ? JSON.parse(body) : {};
    } catch {
      return sendJson(res, 400, {
        success: false,
        message: "Некорректный формат данных. Ожидается JSON.",
      });
    }

    const { name, phone, service } = data || {};

    if (!name || !phone || !service) {
      return sendJson(res, 400, {
        success: false,
        message: "Все поля (имя, телефон, услуга) обязательны.",
      });
    }

    const normalizedPhone = normalizePhoneToPlus7(phone);

    const message = [
      "Новая запись с сайта Barbershop 020",
      "",
      `Имя: ${escapeHtml(name)}`,
      `Телефон: ${escapeHtml(normalizedPhone)}`,
      `Услуга: ${escapeHtml(service)}`,
    ].join("\n");

    try {
      await sendTelegramMessage(message);
      return sendJson(res, 200, {
        success: true,
        message: "Заявка успешно отправлена в Telegram-чат администратора.",
      });
    } catch (error) {
      console.error("Ошибка отправки сообщения в Telegram:", error);
      return sendJson(res, 500, {
        success: false,
        message: "Не удалось отправить заявку в Telegram. Попробуйте ещё раз позже.",
      });
    }
  });
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url || "/", true);
  const method = (req.method || "GET").toUpperCase();
  let pathname = parsedUrl.pathname || "/";

  if (method === "POST" && pathname === "/api/send-booking") {
    return handleSendBooking(req, res);
  }

  if (method === "GET") {
    if (pathname === "/") {
      const indexPath = path.join(__dirname, "index.html");
      return serveStaticFile(indexPath, res);
    }

    // защита от выхода за пределы директории проекта
    const safePath = path.normalize(path.join(__dirname, pathname));
    if (!safePath.startsWith(path.normalize(__dirname))) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("403 Forbidden");
      return;
    }

    return serveStaticFile(safePath, res);
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("404 Not Found");
});

server.listen(PORT, () => {
  console.log(`Сервер Barbershop 020 запущен: http://localhost:${PORT}`);
});

