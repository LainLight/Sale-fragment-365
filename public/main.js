const form = document.getElementById("sale-form");
const resultNode = document.getElementById("result");
const submitButton = form.querySelector(".submit");

async function loadDefaults() {
  try {
    const response = await fetch("/api/defaults");
    if (!response.ok) {
      return;
    }

    const defaults = await response.json();

    const mapping = [
      "priceTon",
      "nftAddress",
      "duration",
      "minBidStep",
      "minExtendTime",
      "queryId",
      "beneficiaryAddress",
      "endpoint",
      "apiKey",
      "transferValue"
    ];

    for (const key of mapping) {
      if (defaults[key] !== undefined && defaults[key] !== null && defaults[key] !== "") {
        const element = document.getElementById(key);
        if (element) {
          element.value = defaults[key];
        }
      }
    }

    if (defaults.hasMnemonic) {
      setResult("Seed-фраза берётся из .env. Чтобы использовать другую — введите её вручную ниже.", "info");
    }
  } catch (error) {
    console.warn("Не удалось загрузить значения по умолчанию", error);
  }
}

function setResult(message, type = "info") {
  resultNode.textContent = message;
  resultNode.dataset.type = type;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const payload = {};

  for (const [key, value] of formData.entries()) {
    if (value != null && String(value).trim() !== "") {
      payload[key] = typeof value === "string" ? value.trim() : value;
    }
  }

  if (!payload.mnemonic) {
    setResult("Введите сид-фразу", "error");
    return;
  }

  submitButton.disabled = true;
  setResult("Отправляем транзакцию...", "info");

  try {
    const response = await fetch("/api/sell", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      const errorMessage = data.message || "Не удалось выполнить продажу";
      throw new Error(errorMessage);
    }

    const { walletAddress, seqno } = data;
    setResult(
      `Успех! Кошелек: ${walletAddress}. Seqno: ${seqno}. Проверьте статус транзакции в Tonviewer`,
      "success"
    );
    form.reset();
  } catch (error) {
    setResult(error.message, "error");
  } finally {
    submitButton.disabled = false;
  }
});

loadDefaults();
