const NAV_OFFSET = 72;

function smoothScrollTo(targetId) {
  const target = document.querySelector(targetId);
  if (!target) return;

  const rect = target.getBoundingClientRect();
  const offset = window.pageYOffset + rect.top - NAV_OFFSET + 4;

  window.scrollTo({
    top: offset,
    behavior: "smooth",
  });
}

function initNavigation() {
  const navToggle = document.querySelector(".nav__toggle");
  const navLinks = document.querySelector(".nav__links");

  if (navToggle && navLinks) {
    navToggle.addEventListener("click", () => {
      const isOpen = navToggle.getAttribute("aria-expanded") === "true";
      navToggle.setAttribute("aria-expanded", String(!isOpen));
      navLinks.classList.toggle("nav__links--open");
    });

    navLinks.addEventListener("click", (event) => {
      if (event.target instanceof HTMLAnchorElement) {
        navLinks.classList.remove("nav__links--open");
        navToggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href");
      if (!href || href === "#") return;
      const target = document.querySelector(href);
      if (!target) return;

      event.preventDefault();
      smoothScrollTo(href);
    });
  });
}

function initScrollIndicator() {
  const indicator = document.querySelector(".hero__scroll-indicator");
  if (!indicator) return;

  indicator.addEventListener("click", () => {
    smoothScrollTo("#about");
  });
}

function initScrollProgress() {
  const bar = document.querySelector(".scroll-progress__bar");
  if (!bar) return;

  const update = () => {
    const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
    const scrollHeight =
      document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const progress = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
    bar.style.transform = `scaleX(${progress})`;
  };

  window.addEventListener("scroll", update, { passive: true });
  update();
}

function initScrollReveal() {
  const elements = document.querySelectorAll("[data-reveal]");
  if (!elements.length || !"IntersectionObserver" in window) {
    elements.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.18,
      rootMargin: "0px 0px -40px 0px",
    }
  );

  elements.forEach((el) => observer.observe(el));
}

function initParallaxHero() {
  const heroMedia = document.querySelector(".hero__media");
  if (!heroMedia) return;

  const handleScroll = () => {
    const scrollY = window.scrollY || window.pageYOffset;
    const translate = Math.min(scrollY * 0.15, 40);
    heroMedia.style.transform = `translateY(${translate}px) scale(1.04)`;
  };

  window.addEventListener("scroll", handleScroll, { passive: true });
}

function initFloatingCta() {
  const floatingBtn = document.querySelector(".floating-cta");
  if (!floatingBtn) return;

  const updateVisibility = () => {
    const triggerHeight = window.innerHeight * 0.6;
    const scrollTop = window.scrollY || window.pageYOffset;
    if (scrollTop > triggerHeight) {
      floatingBtn.classList.add("floating-cta--visible");
    } else {
      floatingBtn.classList.remove("floating-cta--visible");
    }
  };

  floatingBtn.addEventListener("click", () => {
    smoothScrollTo("#booking");
  });

  window.addEventListener("scroll", updateVisibility, { passive: true });
  updateVisibility();
}

function initBookingForm() {
  const form = document.querySelector(".booking-form");
  const successMessage = document.querySelector(".booking-form__success");
  if (!form || !successMessage) return;

  // Маска телефона: +7 (XXX) XXX-XXXX
  const phoneInputForPrefix = form.querySelector("#phone");
  if (phoneInputForPrefix instanceof HTMLInputElement) {
    const formatPhone = (raw) => {
      let digits = raw.replace(/\D/g, "");

      // убираем ведущую 7/8, если пользователь ввёл её самостоятельно
      if ((digits.startsWith("7") || digits.startsWith("8")) && digits.length > 1) {
        digits = digits.slice(1);
      }

      digits = digits.slice(0, 10);

      const part1 = digits.slice(0, 3);
      const part2 = digits.slice(3, 6);
      const part3 = digits.slice(6, 10);

      let result = "+7";

      if (part1) {
        result += " (" + part1;
      }

      if (part1 && part1.length === 3 && (part2 || part3)) {
        result += ")";
      }

      if (part2) {
        result += " " + part2;
      }

      if (part3) {
        result += "-" + part3;
      }

      return result;
    };

    phoneInputForPrefix.addEventListener("focus", () => {
      if (phoneInputForPrefix.value.trim() === "") {
        phoneInputForPrefix.value = "+7 (";
      }
    });

    phoneInputForPrefix.addEventListener("input", () => {
      const current = phoneInputForPrefix.value;
      phoneInputForPrefix.value = formatPhone(current);
    });

    phoneInputForPrefix.addEventListener("blur", () => {
      const digits = phoneInputForPrefix.value.replace(/\D/g, "");
      if (!digits) {
        phoneInputForPrefix.value = "";
      }
    });
  }

  const originalText = successMessage.textContent;

  const setMessage = (text, type) => {
    successMessage.textContent = text;
    successMessage.hidden = false;
    successMessage.classList.remove("booking-form__success--error");

    if (type === "error") {
      successMessage.classList.add("booking-form__success--error");
    }
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const nameInput = form.querySelector("#name");
    const phoneInput = form.querySelector("#phone");
    const serviceSelect = form.querySelector("#service");
    const submitButton = form.querySelector('button[type="submit"]');

    if (nameInput instanceof HTMLInputElement) {
      nameInput.value = nameInput.value.trim();
    }
    if (phoneInput instanceof HTMLInputElement) {
      phoneInput.value = phoneInput.value.trim();
    }

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    if (!(nameInput instanceof HTMLInputElement) ||
      !(phoneInput instanceof HTMLInputElement) ||
      !(serviceSelect instanceof HTMLSelectElement)) {
      return;
    }

    if (!nameInput.value || !phoneInput.value || !serviceSelect.value) {
      setMessage("Пожалуйста, заполните все поля формы.", "error");
      return;
    }

    if (submitButton instanceof HTMLButtonElement) {
      submitButton.disabled = true;
    }

    setMessage("Отправляем заявку...", "success");

    try {
      const payload = {
        name: nameInput.value,
        phone: phoneInput.value,
        service: serviceSelect.value,
      };

      const response = await fetch("/send-booking.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      let data = {};
      try {
        data = await response.json();
      } catch {
        // игнорируем ошибку парсинга JSON
      }

      if (response.ok && data.success) {
        setMessage(
          "Спасибо! Ваша заявка отправлена. Мы свяжемся с вами для подтверждения записи.",
          "success"
        );
        form.reset();
      } else {
        setMessage(
          data.message || "Не удалось отправить заявку. Попробуйте ещё раз.",
          "error"
        );
      }
    } catch (error) {
      console.error(error);
      setMessage("Сервер временно недоступен. Попробуйте позже.", "error");
    } finally {
      if (submitButton instanceof HTMLButtonElement) {
        submitButton.disabled = false;
      }

      setTimeout(() => {
        successMessage.hidden = true;
        successMessage.textContent = originalText;
        successMessage.classList.remove("booking-form__success--error");
      }, 6000);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  initScrollIndicator();
  initScrollProgress();
  initScrollReveal();
  initParallaxHero();
  initFloatingCta();
  initBookingForm();
});

