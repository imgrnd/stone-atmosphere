function briefFormatPhone(value) {
  let digits = value.replace(/\D/g, "");

  if (digits.startsWith("8")) {
    digits = "7" + digits.slice(1);
  }

  if (digits.startsWith("7")) {
    digits = digits.slice(1);
  }

  digits = digits.slice(0, 10);

  let out = "+7";

  if (!digits) {
    return out;
  }

  out += " (" + digits.slice(0, 3);

  if (digits.length >= 3) {
    out += ")";
  }

  if (digits.length > 3) {
    out += " " + digits.slice(3, 6);
  }

  if (digits.length > 6) {
    out += "-" + digits.slice(6, 8);
  }

  if (digits.length > 8) {
    out += "-" + digits.slice(8, 10);
  }

  return out;
}

function openBriefDialog(dialog, dialogTitle, dialogText, dialogClose, mode) {
  const isSuccess = mode === "sent";
  const title = isSuccess ? "Заявка отправлена" : "Не удалось отправить";
  const text = isSuccess
    ? "Мы свяжемся с вами в ближайшее время."
    : "Проверьте телефон, согласие на обработку данных и файл (PDF, JPG, PNG до 8 МБ).";
  const buttonLabel = isSuccess ? "Хорошо" : "Понятно";

  if (!dialog || !dialogTitle || !dialogText || typeof dialog.showModal !== "function") {
    return;
  }

  dialogTitle.textContent = title;
  dialogText.textContent = text;

  if (dialogClose) {
    dialogClose.textContent = buttonLabel;
  }

  dialog.showModal();
}

function initBriefForm() {
  const form = document.querySelector(".brief__form");

  if (!form) {
    return;
  }

  const phone = form.querySelector('input[name="phone"]');
  const consent = form.querySelector('input[name="consent"]');
  const file = form.querySelector('input[type="file"]');
  const fileName = form.querySelector(".brief__file-name");
  const fileLabel = fileName ? fileName.textContent : "";
  const submitBtn = form.querySelector(".brief__submit");
  const dialog = document.getElementById("brief-dialog");
  const dialogTitle = document.getElementById("brief-dialog-title");
  const dialogText = document.getElementById("brief-dialog-text");
  const dialogClose = document.getElementById("brief-dialog-close");

  const briefStatus = new URLSearchParams(window.location.search).get("brief");

  if (briefStatus === "sent" || briefStatus === "error") {
    const seenKey = `brief-notice-${briefStatus}`;
    if (!sessionStorage.getItem(seenKey)) {
      openBriefDialog(dialog, dialogTitle, dialogText, dialogClose, briefStatus);
      sessionStorage.setItem(seenKey, "1");
    }
    const cleanUrl = `${window.location.pathname}${window.location.hash || "#brief"}`;
    window.history.replaceState(null, "", cleanUrl);
  }

  if (dialog && dialogClose) {
    dialogClose.addEventListener("click", () => {
      dialog.close();
    });
  }

  if (dialog) {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        dialog.close();
      }
    });
  }

  if (phone) {
    phone.addEventListener("focus", () => {
      if (!phone.value) {
        phone.value = "+7";
      }
    });

    phone.addEventListener("blur", () => {
      if (phone.value === "+7") {
        phone.value = "";
      }
    });

    phone.addEventListener("input", () => {
      phone.setCustomValidity("");
      const next = briefFormatPhone(phone.value);
      phone.value = next === "+7" && phone.value.replace(/\D/g, "").length === 0 ? "+7" : next;
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const digits = phone ? phone.value.replace(/\D/g, "") : "";

    if (digits.length !== 11) {
      if (phone) {
        phone.setCustomValidity("Введите телефон полностью");
        phone.reportValidity();
      }
      return;
    }

    if (consent && !consent.checked) {
      consent.setCustomValidity("Нужно согласие на обработку данных");
      consent.reportValidity();
      return;
    }

    if (consent) {
      consent.setCustomValidity("");
    }

    if (submitBtn) {
      submitBtn.disabled = true;
    }

    const action = form.getAttribute("action") || "api/brief-submit.php";
    const body = new FormData(form);
    body.append("_brief_ajax", "1");

    try {
      const response = await fetch(action, {
        method: "POST",
        body,
        headers: {
          "X-Brief-Request": "1",
        },
        credentials: "same-origin",
        redirect: "manual",
      });

      let payload = null;

      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      const location = response.headers.get("Location") || "";
      const redirectedToSent =
        response.status >= 300 &&
        response.status < 400 &&
        /brief=sent/i.test(location);

      if ((payload && payload.ok === true) || redirectedToSent) {
        form.reset();
        if (fileName) {
          fileName.textContent = fileLabel;
        }
        openBriefDialog(dialog, dialogTitle, dialogText, dialogClose, "sent");
        return;
      }

      openBriefDialog(dialog, dialogTitle, dialogText, dialogClose, "error");
    } catch {
      openBriefDialog(dialog, dialogTitle, dialogText, dialogClose, "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
      }
    }
  });

  if (!file || !fileName) {
    return;
  }

  file.addEventListener("change", () => {
    const picked = file.files && file.files[0];

    if (!picked) {
      fileName.textContent = fileLabel;
      return;
    }

    if (!/\.(pdf|jpe?g|png)$/i.test(picked.name)) {
      file.value = "";
      fileName.textContent = fileLabel;
      file.setCustomValidity("Можно прикрепить PDF, JPG или PNG");
      file.reportValidity();
      return;
    }

    file.setCustomValidity("");
    fileName.textContent = picked.name;
  });
}

initBriefForm();
