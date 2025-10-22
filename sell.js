import { TonClient, WalletContractV4, toNano, Address, beginCell, internal } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

const DEFAULT_ENDPOINT = "https://toncenter.com/api/v2/jsonRPC";
const DEFAULT_DURATION = 31_536_000; // 365 дней
const DEFAULT_MIN_BID_STEP = 5;
const DEFAULT_MIN_EXTEND_TIME = 3_600; // 1 час
const DEFAULT_QUERY_ID = 13;
const DEFAULT_COMMISSION_TON = "0.1";
const FIXED_PRICE_OPCODE = 0x487a8e81;

function normalizeMnemonic(mnemonic) {
    if (!mnemonic) {
        throw new Error("Mnemonic phrase is required");
    }

    if (Array.isArray(mnemonic)) {
        const cleaned = mnemonic.map((word) => word.trim()).filter(Boolean);
        if (cleaned.length === 0) {
            throw new Error("Mnemonic phrase is required");
        }
        return cleaned;
    }

    if (typeof mnemonic === "string") {
        const cleaned = mnemonic
            .trim()
            .split(/\s+/)
            .filter(Boolean);
        if (cleaned.length === 0) {
            throw new Error("Mnemonic phrase is required");
        }
        return cleaned;
    }

    throw new Error("Mnemonic must be provided as a string or an array of words");
}

function resolveInteger(value, defaultValue, fieldName, { min, max } = {}) {
    const candidate = value === undefined || value === null || value === "" ? defaultValue : Number(value);

    if (!Number.isFinite(candidate) || !Number.isInteger(candidate)) {
        throw new Error(`${fieldName} must be an integer number`);
    }

    if (min !== undefined && candidate < min) {
        throw new Error(`${fieldName} must be greater than or equal to ${min}`);
    }

    if (max !== undefined && candidate > max) {
        throw new Error(`${fieldName} must be less than or equal to ${max}`);
    }

    return candidate;
}

function normalizeAmount(value, fieldName, defaultValue) {
    let candidate = value;

    if (candidate === undefined || candidate === null || candidate === "") {
        if (defaultValue === undefined) {
            throw new Error(`${fieldName} is required`);
        }
        candidate = defaultValue;
    }

    if (typeof candidate === "number") {
        if (!Number.isFinite(candidate)) {
            throw new Error(`${fieldName} must be a finite number`);
        }
        candidate = candidate.toString();
    } else if (typeof candidate === "string") {
        candidate = candidate.trim();
    } else {
        throw new Error(`${fieldName} must be a string or number`);
    }

    if (!candidate) {
        throw new Error(`${fieldName} is required`);
    }

    return candidate;
}

export async function createFixedPriceSale({
    endpoint = DEFAULT_ENDPOINT,
    apiKey,
    mnemonic,
    nftAddress,
    priceTon,
    duration,
    minBidStep,
    minExtendTime,
    queryId,
    commissionTon = DEFAULT_COMMISSION_TON,
    beneficiaryAddress
} = {}) {
    const mnemonicWords = normalizeMnemonic(mnemonic);

    if (!nftAddress || typeof nftAddress !== "string") {
        throw new Error("NFT address is required");
    }

    let nftAddressParsed;
    try {
        nftAddressParsed = Address.parse(nftAddress);
    } catch (error) {
        throw new Error(`NFT address is invalid: ${error.message}`);
    }

    const endpointUrl = endpoint || DEFAULT_ENDPOINT;

    const client = new TonClient({
        endpoint: endpointUrl,
        apiKey: apiKey && apiKey.trim() !== "" ? apiKey.trim() : undefined
    });

    const keyPair = await mnemonicToPrivateKey(mnemonicWords);

    const wallet = WalletContractV4.create({
        workchain: 0,
        publicKey: keyPair.publicKey
    });

    const contract = client.open(wallet);
    const seqno = await contract.getSeqno();

    let beneficiary;
    if (beneficiaryAddress && beneficiaryAddress.trim() !== "") {
        try {
            beneficiary = Address.parse(beneficiaryAddress);
        } catch (error) {
            throw new Error(`Beneficiary address is invalid: ${error.message}`);
        }
    } else {
        beneficiary = wallet.address;
    }

    const durationValue = resolveInteger(duration, DEFAULT_DURATION, "duration", { min: 0, max: 0xffffffff });
    const minBidStepValue = resolveInteger(minBidStep, DEFAULT_MIN_BID_STEP, "minBidStep", { min: 0, max: 0xff });
    const minExtendTimeValue = resolveInteger(
        minExtendTime,
        DEFAULT_MIN_EXTEND_TIME,
        "minExtendTime",
        { min: 0, max: 0xffffffff }
    );
    const queryIdValue = resolveInteger(queryId, DEFAULT_QUERY_ID, "queryId");
    const priceTonValue = normalizeAmount(priceTon, "priceTon");
    const commissionTonValue = normalizeAmount(commissionTon, "commissionTon", DEFAULT_COMMISSION_TON);

    const priceNano = toNano(priceTonValue);
    const commissionNano = toNano(commissionTonValue);

    const auctionConfig = beginCell()
        .storeAddress(beneficiary)
        .storeCoins(priceNano)
        .storeCoins(priceNano)
        .storeUint(minBidStepValue, 8)
        .storeUint(minExtendTimeValue, 32)
        .storeUint(durationValue, 32)
        .endCell();

    const salePayload = beginCell()
        .storeUint(FIXED_PRICE_OPCODE, 32)
        .storeUint(BigInt(queryIdValue), 64)
        .storeRef(auctionConfig)
        .endCell();

    await contract.sendTransfer({
        seqno,
        secretKey: keyPair.secretKey,
        messages: [
            internal({
                to: nftAddressParsed,
                value: commissionNano,
                body: salePayload
            })
        ]
    });

    return {
        walletAddress: wallet.address.toString(),
        nftAddress: nftAddressParsed.toString(),
        priceTon: priceTonValue,
        duration: durationValue,
        queryId: queryIdValue
    };
}

const __filename = fileURLToPath(import.meta.url);

if (process.argv[1] === __filename) {
    const {
        TON_RPC_ENDPOINT,
        TON_API_KEY,
        MNEMONIC,
        NFT_ADDRESS,
        PRICE_TON,
        DURATION,
        MIN_BID_STEP,
        MIN_EXTEND_TIME,
        QUERY_ID,
        COMMISSION_TON,
        BENEFICIARY_ADDRESS
    } = process.env;

    createFixedPriceSale({
        endpoint: TON_RPC_ENDPOINT || DEFAULT_ENDPOINT,
        apiKey: TON_API_KEY,
        mnemonic: MNEMONIC,
        nftAddress: NFT_ADDRESS,
        priceTon: PRICE_TON,
        duration: DURATION,
        minBidStep: MIN_BID_STEP,
        minExtendTime: MIN_EXTEND_TIME,
        queryId: QUERY_ID,
        commissionTon: COMMISSION_TON,
        beneficiaryAddress: BENEFICIARY_ADDRESS
    })
        .then((result) => {
            console.log(`[NFT SALE] Кошелёк: ${result.walletAddress}`);
            console.log("[NFT SALE] NFT выставлено на продажу по фиксированной цене (через продажу)!");
        })
        .catch((error) => {
            console.error("[NFT SALE] Ошибка выставления NFT:", error);
            process.exitCode = 1;
        });
}
