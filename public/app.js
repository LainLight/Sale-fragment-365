const form = document.getElementById("sale-form");
const submitButton = document.getElementById("submit-btn");
const resultBlock = document.getElementById("result");

function setLoading(isLoading) {
    if (isLoading) {
        submitButton.disabled = true;
        submitButton.dataset.originalText = submitButton.textContent;
        submitButton.textContent = "Отправка...";
    } else {
        submitButton.disabled = false;
        if (submitButton.dataset.originalText) {
            submitButton.textContent = submitButton.dataset.originalText;
            delete submitButton.dataset.originalText;
        }
    }
}

function renderResult({ success, message, data, error }) {
    resultBlock.classList.remove("hidden");
    resultBlock.innerHTML = "";

    const title = document.createElement("div");
    title.classList.add("result-title");
    title.textContent = success ? "Успешно" : "Ошибка";
    resultBlock.appendChild(title);

    const description = document.createElement("div");
    description.classList.add(success ? "result-success" : "result-error");
    description.textContent = success ? message ?? "NFT выставлено на продажу" : error ?? "Что-то пошло не так";
    resultBlock.appendChild(description);

    if (data && typeof data === "object") {
        const details = document.createElement("pre");
        details.classList.add("result-details");
        details.textContent = JSON.stringify(data, null, 2);
        resultBlock.appendChild(details);
    }
}

form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    resultBlock.classList.add("hidden");

    const formData = new FormData(form);
    const payload = {};

    for (const [key, value] of formData.entries()) {
        const trimmed = typeof value === "string" ? value.trim() : value;
        if (trimmed === "") {
            continue;
        }
        payload[key] = trimmed;
    }

    if (!payload.mnemonic) {
        renderResult({ success: false, error: "Мнемоника обязательна" });
        return;
    }

    setLoading(true);

    try {
        const response = await fetch("/api/sell", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const json = await response.json();

        if (!response.ok || !json.success) {
            throw new Error(json.error || "Сервер вернул ошибку");
        }

        renderResult({
            success: true,
            message: json.data?.message,
            data: json.data
        });
    } catch (error) {
        renderResult({
            success: false,
            error: error.message || "Не удалось выполнить запрос"
        });
    } finally {
        setLoading(false);
    }
});
