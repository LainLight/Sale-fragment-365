import express from "express";
import { TonClient, WalletContractV4, toNano, Address, beginCell, internal } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 3000;

const DEFAULT_FORM_VALUES = {
    endpoint: process.env.TON_ENDPOINT || "https://toncenter.com/api/v2/jsonRPC",
    apiKey: process.env.TON_API_KEY || "",
    mnemonic: process.env.TON_MNEMONIC || "",
    workchain: process.env.TON_WORKCHAIN || "0",
    nftAddress: process.env.NFT_ADDRESS || "",
    priceTon: process.env.PRICE_TON || "500",
    maxBidTon: process.env.MAX_BID_TON || "500",
    callValueTon: process.env.CALL_VALUE_TON || "0.1",
    minBidStep: process.env.MIN_BID_STEP || "5",
    minExtendTime: process.env.MIN_EXTEND_TIME || "3600",
    duration: process.env.DURATION || "31536000",
    queryId: process.env.QUERY_ID || "13",
    beneficiaryAddress: process.env.BENEFICIARY_ADDRESS || ""
};

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get("/", (_req, res) => {
    res.send(renderForm(DEFAULT_FORM_VALUES));
});

app.post("/sell", async (req, res) => {
    const formValues = { ...DEFAULT_FORM_VALUES, ...req.body };

    try {
        const result = await runSale(formValues);
        const successMessage = `[NFT SALE] NFT выставлено на продажу по фиксированной цене!`;
        res.send(
            renderForm(formValues, {
                success: true,
                message: successMessage,
                details: result
            })
        );
    } catch (error) {
        console.error(error);
        res.status(400).send(
            renderForm(formValues, {
                success: false,
                message: error instanceof Error ? error.message : "Неизвестная ошибка"
            })
        );
    }
});

function escapeHtml(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function renderForm(values, result) {
    const data = { ...DEFAULT_FORM_VALUES, ...values };
    const statusBlock = result
        ? `<div class="status ${result.success ? "success" : "error"}">${escapeHtml(result.message)}</div>`
        : "";

    const detailsBlock = result?.details
        ? `<div class="details">
                <h2>Детали</h2>
                <ul>
                    <li><strong>Кошелёк:</strong> ${escapeHtml(result.details.walletAddress)}</li>
                    <li><strong>Seqno:</strong> ${escapeHtml(String(result.details.seqno))}</li>
                    <li><strong>Получатель TON:</strong> ${escapeHtml(result.details.beneficiary)}</li>
                    <li><strong>NFT адрес:</strong> ${escapeHtml(result.details.nftAddress)}</li>
                    <li><strong>Начальная ставка:</strong> ${escapeHtml(result.details.initialBidTon)} TON</li>
                    <li><strong>Максимальная ставка:</strong> ${escapeHtml(result.details.maxBidTon)} TON</li>
                    <li><strong>Комиссия (TON):</strong> ${escapeHtml(result.details.callValueTon)}</li>
                    <li><strong>Шаг аукциона:</strong> ${escapeHtml(result.details.minBidStep)}</li>
                    <li><strong>Мин. продление (сек):</strong> ${escapeHtml(result.details.minExtendTime)}</li>
                    <li><strong>Длительность (сек):</strong> ${escapeHtml(result.details.duration)}</li>
                    <li><strong>Query ID:</strong> ${escapeHtml(result.details.queryId)}</li>
                    <li><strong>payload (b64):</strong>
                        <textarea readonly rows="4">${escapeHtml(result.details.payloadBoc)}</textarea>
                    </li>
                </ul>
            </div>`
        : "";

    return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Fragment Sale UI</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background: #0f1420;
            color: #e6f0ff;
            display: flex;
            justify-content: center;
            padding: 40px 16px;
        }
        .container {
            width: min(960px, 100%);
            background: rgba(11, 17, 30, 0.85);
            border-radius: 16px;
            padding: 32px;
            box-shadow: 0 24px 48px rgba(0, 0, 0, 0.35);
            border: 1px solid rgba(87, 122, 255, 0.4);
        }
        h1 {
            margin-top: 0;
            text-align: center;
            font-size: 26px;
        }
        form {
            display: grid;
            gap: 18px;
        }
        label {
            display: flex;
            flex-direction: column;
            gap: 8px;
            font-size: 15px;
        }
        input, textarea, select {
            padding: 12px;
            border-radius: 10px;
            border: 1px solid rgba(87, 122, 255, 0.5);
            background: rgba(15, 25, 45, 0.85);
            color: #e6f0ff;
            font-size: 15px;
        }
        textarea {
            min-height: 110px;
            resize: vertical;
        }
        button {
            padding: 14px 20px;
            border-radius: 12px;
            border: none;
            background: linear-gradient(135deg, #4c8dff, #18e0b5);
            color: #0b101d;
            font-weight: 600;
            font-size: 16px;
            cursor: pointer;
            transition: transform 0.15s ease, box-shadow 0.2s ease;
        }
        button:hover {
            transform: translateY(-1px);
            box-shadow: 0 10px 18px rgba(76, 141, 255, 0.35);
        }
        .status {
            padding: 14px 18px;
            border-radius: 12px;
            font-weight: 600;
        }
        .status.success {
            background: rgba(32, 201, 151, 0.15);
            border: 1px solid rgba(32, 201, 151, 0.35);
            color: #2fd6a8;
        }
        .status.error {
            background: rgba(255, 82, 82, 0.15);
            border: 1px solid rgba(255, 82, 82, 0.35);
            color: #ff7575;
        }
        .details {
            margin-top: 24px;
            padding: 18px;
            border-radius: 12px;
            background: rgba(15, 23, 42, 0.75);
            border: 1px solid rgba(87, 122, 255, 0.3);
        }
        .details textarea {
            width: 100%;
            font-family: "Fira Code", monospace;
        }
        .grid {
            display: grid;
            gap: 18px;
        }
        .grid.two {
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        }
        .note {
            font-size: 13px;
            color: rgba(230, 240, 255, 0.7);
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Продажа NFT/Username на Fragment</h1>
        <p class="note">Вставь свои значения, проверь всё дважды и отправь. Сервер выполнит транзакцию через TON Wallet V4.</p>
        ${statusBlock}
        <form method="post" action="/sell">
            <div class="grid two">
                <label>
                    RPC endpoint
                    <input type="text" name="endpoint" value="${escapeHtml(data.endpoint)}" required />
                </label>
                <label>
                    API Key (если нужен)
                    <input type="text" name="apiKey" value="${escapeHtml(data.apiKey)}" />
                </label>
            </div>
            <label>
                Seed-фраза (mnemonic)
                <textarea name="mnemonic" placeholder="сидка через пробел" required>${escapeHtml(data.mnemonic)}</textarea>
            </label>
            <div class="grid two">
                <label>
                    Workchain
                    <input type="number" name="workchain" value="${escapeHtml(String(data.workchain))}" />
                </label>
                <label>
                    Beneficiary (опционально)
                    <input type="text" name="beneficiaryAddress" value="${escapeHtml(data.beneficiaryAddress)}" placeholder="адрес получателя TON" />
                </label>
            </div>
            <label>
                NFT адрес
                <input type="text" name="nftAddress" value="${escapeHtml(data.nftAddress)}" required />
            </label>
            <div class="grid two">
                <label>
                    Начальная ставка (TON)
                    <input type="text" name="priceTon" value="${escapeHtml(data.priceTon)}" required />
                </label>
                <label>
                    Максимальная ставка (TON)
                    <input type="text" name="maxBidTon" value="${escapeHtml(data.maxBidTon)}" required />
                </label>
            </div>
            <div class="grid two">
                <label>
                    Шаг аукциона (% * 256)
                    <input type="number" name="minBidStep" value="${escapeHtml(String(data.minBidStep))}" required />
                </label>
                <label>
                    Мин. продление (сек)
                    <input type="number" name="minExtendTime" value="${escapeHtml(String(data.minExtendTime))}" required />
                </label>
            </div>
            <div class="grid two">
                <label>
                    Длительность продажи (сек)
                    <input type="number" name="duration" value="${escapeHtml(String(data.duration))}" required />
                </label>
                <label>
                    Query ID
                    <input type="text" name="queryId" value="${escapeHtml(String(data.queryId))}" required />
                </label>
            </div>
            <label>
                TON для оплаты комиссии
                <input type="text" name="callValueTon" value="${escapeHtml(data.callValueTon)}" required />
            </label>
            <button type="submit">Выставить на продажу</button>
        </form>
        ${detailsBlock}
    </div>
</body>
</html>`;
}

async function runSale(formValues) {
    const endpoint = (formValues.endpoint ?? "").trim();
    if (!endpoint) {
        throw new Error("Укажи RPC endpoint TON.");
    }

    const apiKey = (formValues.apiKey ?? "").trim();
    const mnemonic = (formValues.mnemonic ?? "").trim();
    if (!mnemonic) {
        throw new Error("Введи сид-фразу (mnemonic).");
    }

    const words = mnemonic.split(/\s+/).filter(Boolean);
    if (words.length < 12) {
        throw new Error("Сид-фраза должна содержать минимум 12 слов.");
    }

    const nftAddressInput = (formValues.nftAddress ?? "").trim();
    if (!nftAddressInput) {
        throw new Error("Укажи адрес NFT.");
    }

    let nftAddress;
    try {
        nftAddress = Address.parse(nftAddressInput);
    } catch (error) {
        throw new Error("NFT адрес некорректен.");
    }

    const beneficiaryAddressInput = (formValues.beneficiaryAddress ?? "").trim();
    let beneficiaryAddress;
    if (beneficiaryAddressInput) {
        try {
            beneficiaryAddress = Address.parse(beneficiaryAddressInput);
        } catch (error) {
            throw new Error("Адрес получателя некорректен.");
        }
    }

    const minBidStep = Number.parseInt(formValues.minBidStep, 10);
    if (!Number.isInteger(minBidStep) || minBidStep < 0 || minBidStep > 255) {
        throw new Error("Шаг аукциона должен быть целым числом от 0 до 255.");
    }

    const minExtendTime = Number.parseInt(formValues.minExtendTime, 10);
    if (!Number.isInteger(minExtendTime) || minExtendTime < 0) {
        throw new Error("Мин. продление должно быть неотрицательным целым числом.");
    }

    const duration = Number.parseInt(formValues.duration, 10);
    if (!Number.isInteger(duration) || duration <= 0) {
        throw new Error("Длительность должна быть положительным целым числом.");
    }

    const workchain = Number.parseInt(formValues.workchain, 10);
    const queryId = BigInt(formValues.queryId ?? 0);

    const priceTon = (formValues.priceTon ?? "").trim();
    if (!priceTon) {
        throw new Error("Укажи начальную ставку в TON.");
    }

    const maxBidTon = (formValues.maxBidTon ?? "").trim() || priceTon;
    if (!maxBidTon) {
        throw new Error("Укажи максимальную ставку в TON.");
    }

    const callValueTon = (formValues.callValueTon ?? "").trim() || "0.1";
    if (!callValueTon) {
        throw new Error("Укажи сумму TON для оплаты комиссии.");
    }

    const client = new TonClient({
        endpoint,
        apiKey: apiKey || undefined
    });

    const keyPair = await mnemonicToPrivateKey(words);
    const wallet = WalletContractV4.create({
        workchain: Number.isInteger(workchain) ? workchain : 0,
        publicKey: keyPair.publicKey
    });

    const contract = client.open(wallet);
    const seqno = await contract.getSeqno();
    const beneficiary = beneficiaryAddress ?? wallet.address;

    let initialBidCoins;
    try {
        initialBidCoins = toNano(priceTon);
    } catch (error) {
        throw new Error("Неверный формат начальной ставки (TON).");
    }

    let maxBidCoins;
    try {
        maxBidCoins = toNano(maxBidTon);
    } catch (error) {
        throw new Error("Неверный формат максимальной ставки (TON).");
    }

    let callValueCoins;
    try {
        callValueCoins = toNano(callValueTon);
    } catch (error) {
        throw new Error("Неверный формат суммы для комиссии (TON).");
    }

    console.log(`[NFT SALE] Кошелёк: ${wallet.address.toString()}`);

    const auctionConfig = beginCell()
        .storeAddress(beneficiary)
        .storeCoins(initialBidCoins)
        .storeCoins(maxBidCoins)
        .storeUint(minBidStep, 8)
        .storeUint(minExtendTime, 32)
        .storeUint(duration, 32)
        .endCell();

    const salePayload = beginCell()
        .storeUint(0x487a8e81, 32)
        .storeUint(queryId, 64)
        .storeRef(auctionConfig)
        .endCell();

    await contract.sendTransfer({
        seqno,
        secretKey: keyPair.secretKey,
        messages: [
            internal({
                to: nftAddress,
                value: callValueCoins,
                body: salePayload
            })
        ]
    });

    return {
        walletAddress: wallet.address.toString(),
        beneficiary: beneficiary.toString(),
        seqno,
        nftAddress: nftAddress.toString(),
        initialBidTon: priceTon,
        maxBidTon,
        callValueTon,
        minBidStep,
        minExtendTime,
        duration,
        queryId: queryId.toString(),
        payloadBoc: salePayload.toBoc().toString("base64")
    };
}

if (process.argv.includes("--cli")) {
    runSale(DEFAULT_FORM_VALUES)
        .then(() => {
            console.log("[NFT SALE] NFT выставлено на продажу по фиксированной цене!");
            process.exit(0);
        })
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
} else {
    app.listen(PORT, () => {
        console.log(`Web UI запущен на http://localhost:${PORT}`);
    });
}
