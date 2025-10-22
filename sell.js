import { resolve } from "path";
import { fileURLToPath } from "url";
import { TonClient, WalletContractV4, toNano, Address, beginCell, internal } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";
import dotenv from "dotenv";

dotenv.config();

const DEFAULT_DURATION = 31536000; // 1 год (в секундах)
const DEFAULT_MIN_BID_STEP = 5;
const DEFAULT_MIN_EXTEND_TIME = 3600; // 1 час
const DEFAULT_QUERY_ID = 13;
const DEFAULT_ENDPOINT = "https://toncenter.com/api/v2/jsonRPC";
const DEFAULT_TRANSFER_VALUE = "0.1"; // комиссия для вызова в TON

export function buildDefaultOptions() {
  return {
    priceTon: process.env.PRICE_TON ?? "",
    nftAddress: process.env.NFT_ADDRESS ?? "",
    duration: DEFAULT_DURATION,
    minBidStep: DEFAULT_MIN_BID_STEP,
    minExtendTime: DEFAULT_MIN_EXTEND_TIME,
    queryId: DEFAULT_QUERY_ID,
    beneficiaryAddress: process.env.BENEFICIARY_ADDRESS ?? "",
    endpoint: process.env.TON_ENDPOINT || DEFAULT_ENDPOINT,
    apiKey: process.env.TON_API_KEY ?? "",
    transferValue: process.env.TRANSFER_VALUE ?? DEFAULT_TRANSFER_VALUE,
    hasMnemonic: Boolean(process.env.MNEMONIC)
  };
}

function resolveMnemonic(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }
    return trimmed.split(/\s+/g);
  }

  return [];
}

function ensurePositiveInteger(name, value, bits) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} должен быть неотрицательным целым числом`);
  }

  if (bits != null && value >= 2 ** bits) {
    throw new Error(`${name} должен умещаться в ${bits} бит`);
  }

  return value;
}

function ensureString(name, value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${name} обязателен`);
  }
  return value.trim();
}

export async function sellFragment(options) {
  const {
    mnemonic,
    nftAddress,
    priceTon,
    duration = DEFAULT_DURATION,
    minBidStep = DEFAULT_MIN_BID_STEP,
    minExtendTime = DEFAULT_MIN_EXTEND_TIME,
    queryId = DEFAULT_QUERY_ID,
    beneficiaryAddress,
    endpoint = process.env.TON_ENDPOINT || DEFAULT_ENDPOINT,
    apiKey = process.env.TON_API_KEY,
    transferValue = DEFAULT_TRANSFER_VALUE
  } = options;

  const mnemonicArray = resolveMnemonic(mnemonic);
  if (mnemonicArray.length === 0) {
    throw new Error("Не удалось прочитать сид-фразу (mnemonic)");
  }

  const resolvedEndpoint = ensureString("Endpoint", endpoint);
  const resolvedNftAddress = ensureString("NFT адрес", nftAddress);
  const resolvedPrice = ensureString("Цена", String(priceTon));
  const resolvedTransferValue = ensureString("Сумма перевода", String(transferValue));

  const safeDuration = ensurePositiveInteger("Duration", Number(duration), 32);
  const safeMinBidStep = ensurePositiveInteger("min_bid_step", Number(minBidStep), 8);
  const safeMinExtendTime = ensurePositiveInteger("min_extend_time", Number(minExtendTime), 32);
  const safeQueryId = ensurePositiveInteger("query_id", Number(queryId), 64);

  const client = new TonClient({
    endpoint: resolvedEndpoint,
    apiKey: apiKey && apiKey.length > 0 ? apiKey : undefined
  });

  const keyPair = await mnemonicToPrivateKey(mnemonicArray);

  const wallet = WalletContractV4.create({
    workchain: 0,
    publicKey: keyPair.publicKey
  });

  const contract = client.open(wallet);
  const seqno = await contract.getSeqno();
  const walletAddress = wallet.address.toString();

  const beneficiary = beneficiaryAddress
    ? Address.parse(ensureString("Beneficiary", beneficiaryAddress))
    : wallet.address;

  const priceCoins = toNano(resolvedPrice);
  const transferCoins = toNano(resolvedTransferValue);

  const auctionConfig = beginCell()
    .storeAddress(beneficiary) // beneficiar_address
    .storeCoins(priceCoins) // initial_min_bid
    .storeCoins(priceCoins) // max_bid
    .storeUint(safeMinBidStep, 8) // min_bid_step
    .storeUint(safeMinExtendTime, 32) // min_extend_time
    .storeUint(safeDuration, 32) // duration
    .endCell();

  const salePayload = beginCell()
    .storeUint(0x487a8e81, 32) // op_code
    .storeUint(safeQueryId, 64) // query_id
    .storeRef(auctionConfig) // config
    .endCell();

  await contract.sendTransfer({
    seqno,
    secretKey: keyPair.secretKey,
    messages: [
      internal({
        to: Address.parse(resolvedNftAddress),
        value: transferCoins,
        body: salePayload
      })
    ]
  });

  return {
    walletAddress,
    seqno
  };
}

const isMainModule = (() => {
  if (!process.argv[1]) {
    return false;
  }

  const currentFilePath = fileURLToPath(import.meta.url);
  return resolve(currentFilePath) === resolve(process.argv[1]);
})();

if (isMainModule) {
  sellFragment({
    mnemonic: process.env.MNEMONIC,
    nftAddress: process.env.NFT_ADDRESS,
    priceTon: process.env.PRICE_TON,
    duration: process.env.DURATION ? Number(process.env.DURATION) : undefined,
    minBidStep: process.env.MIN_BID_STEP ? Number(process.env.MIN_BID_STEP) : undefined,
    minExtendTime: process.env.MIN_EXTEND_TIME ? Number(process.env.MIN_EXTEND_TIME) : undefined,
    queryId: process.env.QUERY_ID ? Number(process.env.QUERY_ID) : undefined,
    beneficiaryAddress: process.env.BENEFICIARY_ADDRESS,
    endpoint: process.env.TON_ENDPOINT,
    apiKey: process.env.TON_API_KEY,
    transferValue: process.env.TRANSFER_VALUE
  })
    .then((result) => {
      console.log(`[NFT SALE] Кошелёк: ${result.walletAddress}`);
      console.log(`[NFT SALE] Транзакция отправлена. seqno=${result.seqno}`);
    })
    .catch((error) => {
      console.error("Ошибка при выставлении NFT на продажу:", error.message);
      process.exitCode = 1;
    });
}
