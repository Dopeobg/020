<?php
// Настройки Telegram
$BOT_TOKEN = '8768068669:AAGnkrn1Ml6-9G1WuJIMzHScKD-pyW1GxE4';
$CHAT_ID   = '8559731635';

header('Content-Type: application/json; charset=utf-8');

// Читаем тело запроса (ожидаем JSON от fetch)
$rawBody = file_get_contents('php://input');
$data = json_decode($rawBody, true);

// Фолбэк: если JSON не распарсился, пытаемся взять обычный POST
if (!is_array($data)) {
    $data = $_POST;
}

$name    = isset($data['name'])    ? trim($data['name'])    : '';
$phone   = isset($data['phone'])   ? trim($data['phone'])   : '';
$service = isset($data['service']) ? trim($data['service']) : '';

if ($name === '' || $phone === '' || $service === '') {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Все поля (имя, телефон, услуга) обязательны.',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

function escape_html($value) {
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function normalize_phone_to_plus7($phone) {
    // Оставляем только цифры
    $digits = preg_replace('/\D+/', '', (string)$phone);

    if ($digits === '') {
        return '';
    }

    // Если номер начинается с 8 — заменяем на 7, но длину не меняем
    if ($digits[0] === '8') {
        $digits = '7' . substr($digits, 1);
    }

    // Возвращаем + и все цифры, которые оставил пользователь
    return '+' . $digits;
}

$normalizedPhone = normalize_phone_to_plus7($phone);

$message = implode("\n", [
    'Новая запись с сайта Barbershop 020',
    '',
    'Имя: '    . escape_html($name),
    'Телефон: ' . escape_html($normalizedPhone),
    'Услуга: ' . escape_html($service),
]);

$apiUrl = 'https://api.telegram.org/bot' . $BOT_TOKEN . '/sendMessage';

$postFields = [
    'chat_id'    => $CHAT_ID,
    'text'       => $message,
    'parse_mode' => 'HTML',
];

// Отправка через cURL
$ch = curl_init($apiUrl);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $postFields);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);

$response = curl_exec($ch);
$errno    = curl_errno($ch);
$error    = curl_error($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

curl_close($ch);

// Попробуем распарсить ответ Telegram
$apiData = null;
if ($response !== false) {
    $apiData = json_decode($response, true);
}

// Если была сетевая ошибка или HTTP-код не 2xx
if ($errno !== 0 || $httpCode < 200 || $httpCode >= 300) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Не удалось отправить заявку в Telegram (ошибка сети или HTTP). Попробуйте ещё раз позже.',
        'debug'   => $error,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Если Telegram вернул ok=false (например, неверный chat_id или бот не запущен)
if (!is_array($apiData) || empty($apiData['ok'])) {
    $description = isset($apiData['description']) ? $apiData['description'] : 'Неизвестная ошибка Telegram.';
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Telegram не принял сообщение: ' . $description,
        'debug'   => $apiData,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

echo json_encode([
    'success' => true,
    'message' => 'Заявка успешно отправлена в Telegram-чат администратора.',
], JSON_UNESCAPED_UNICODE);

