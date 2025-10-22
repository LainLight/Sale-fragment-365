import { TonClient, WalletContractV4, toNano, Address, beginCell, internal } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";
import dotenv from "dotenv";

dotenv.config();

const DEFAULT_ENDPOINT = "https://toncenter.com/api/v2/jsonRPC";
const DEFAULT_DURATION = 31_536_000; // 1 year in seconds
const DEFAULT_MIN_BID_STEP = 5;
const DEFAULT_MIN_EXTEND_TIME = 3_600; // 1 hour in seconds
const DEFAULT_QUERY_ID = 13n;
const DEFAULT_TRANSFER_VALUE = "0.1";

function normalizeNumber(value, fallback) {
    if (value === undefined || value === null || value === "") {
        return Number(fallback);
    }
    const normalized = Number(value);
    if (Number.isNaN(normalized)) {
        throw new Error(`Не удалось преобразовать значение "${value}" к числу`);
    }
    return normalized;
}

function normalizeBigInt(value, fallback) {
    if (value === undefined || value === null || value === "") {
        return BigInt(fallback);
    }
    try {
        return BigInt(value);
    } catch (error) {
        throw new Error(`Не удалось преобразовать значение "${value}" к целому числу`);
    }
}

function normalizeMnemonic(mnemonic) {
    if (Array.isArray(mnemonic)) {
        return mnemonic;
    }
    if (typeof mnemonic !== "string" || mnemonic.trim().length === 0) {
        throw new Error("Мнемоническая фраза обязательна");
    }
    return mnemonic.trim().split(/\s+/);
}

function normalizeTonValue(value, fallback) {
    const normalized = value ?? fallback;
    if (typeof normalized !== "string" && typeof normalized !== "number") {
        throw new Error("Значение TON должно быть числом или строкой");
    }
    const stringValue = normalized.toString();
    if (!stringValue) {
        throw new Error("Значение TON не может быть пустым");
    }
    return toNano(stringValue);
}

export async function sellNftSale({
    endpoint = process.env.TON_ENDPOINT ?? DEFAULT_ENDPOINT,
    apiKey = process.env.TON_API_KEY,
    mnemonic = process.env.TON_MNEMONIC,
    nftAddress = process.env.NFT_ADDRESS,
    priceTon = process.env.SALE_PRICE ?? "500",
    maxBidTon = process.env.SALE_MAX_BID,
    minBidStep = process.env.SALE_MIN_BID_STEP ?? DEFAULT_MIN_BID_STEP,
    minExtendTime = process.env.SALE_MIN_EXTEND_TIME ?? DEFAULT_MIN_EXTEND_TIME,
    duration = process.env.SALE_DURATION ?? DEFAULT_DURATION,
    transferTon = process.env.SALE_TRANSFER_TON ?? DEFAULT_TRANSFER_VALUE,
    queryId = process.env.SALE_QUERY_ID ?? DEFAULT_QUERY_ID,
    beneficiaryAddress = process.env.SALE_BENEFICIARY
} = {}) {
    if (!nftAddress) {
        throw new Error("Адрес NFT обязателен");
    }

    const words = normalizeMnemonic(mnemonic);
    const client = new TonClient({
        endpoint,
        apiKey: apiKey && apiKey.trim().length > 0 ? apiKey : undefined
    });

    const keyPair = await mnemonicToPrivateKey(words);
    const wallet = WalletContractV4.create({
        workchain: 0,
        publicKey: keyPair.publicKey
    });

    const contract = client.open(wallet);
    const seqno = await contract.getSeqno();

    const price = normalizeTonValue(priceTon, "0");
    const maxBid = maxBidTon ? normalizeTonValue(maxBidTon, priceTon) : price;
    const minBid = normalizeNumber(minBidStep, DEFAULT_MIN_BID_STEP);
    const extendTime = normalizeNumber(minExtendTime, DEFAULT_MIN_EXTEND_TIME);
    const saleDuration = normalizeNumber(duration, DEFAULT_DURATION);
    const transfer = normalizeTonValue(transferTon, DEFAULT_TRANSFER_VALUE);
    const saleQueryId = normalizeBigInt(queryId, DEFAULT_QUERY_ID);

    const beneficiary = beneficiaryAddress ? Address.parse(beneficiaryAddress) : wallet.address;

    const auctionConfig = beginCell()
        .storeAddress(beneficiary)
        .storeCoins(price)
        .storeCoins(maxBid)
        .storeUint(minBid, 8)
        .storeUint(extendTime, 32)
        .storeUint(saleDuration, 32)
        .endCell();

    const salePayload = beginCell()
        .storeUint(0x487a8e81, 32)
        .storeUint(saleQueryId, 64)
        .storeRef(auctionConfig)
        .endCell();

    await contract.sendTransfer({
        seqno,
        secretKey: keyPair.secretKey,
        messages: [
            internal({
                to: Address.parse(nftAddress),
                value: transfer,
                body: salePayload
            })
        ]
    });

    return {
        walletAddress: wallet.address.toString(),
        nftAddress,
        priceTon,
        maxBidTon: maxBidTon ?? priceTon,
        queryId: saleQueryId.toString()
    };
}

async function runFromCli() {
    const result = await sellNftSale();
    console.log(`[NFT SALE] Кошелёк: ${result.walletAddress}`);
    console.log("[NFT SALE] NFT выставлено на продажу по фиксированной цене (через продажу)!");
}

if (import.meta.url === `file://${process.argv[1]}`) {
    runFromCli().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}
