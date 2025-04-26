import { TonClient, WalletContractV4, toNano, Address, beginCell, internal } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";
import dotenv from "dotenv";
dotenv.config();

const DURATION = 31536000; // 1 год я хз это что в секундах
const MNEMONIC = "твоя сидка сколько там слов шесть семь восемь и так далее пон".split(" "); //p.s. wallet v4
const NFT_ADDRESS = "EQAherwvqM6iLM2vMCmNPnVmc6YlmBtnyLxvtPaj6MVZf5H9"; // адрес нфт типа
// как отсюда https://tonviewer.com/EQAherwvqM6iLM2vMCmNPnVmc6YlmBtnyLxvtPaj6MVZf5H9 пон
const PRICE = toNano("500"); // ну прайс пон 500 TON 

async function main() {
    const client = new TonClient({
        endpoint: "https://toncenter.com/api/v2/jsonRPC",
        apiKey: "042d5a51b047b5e9cdef06434ea8ef7493d217d27d8d421e60ada670d7774e0c"
    });

    const keyPair = await mnemonicToPrivateKey(MNEMONIC);

    const wallet = WalletContractV4.create({
        workchain: 0,
        publicKey: keyPair.publicKey
    });

    const contract = client.open(wallet);
    const seqno = await contract.getSeqno();

    console.log(`[NFT SALE] Кошелёк: ${wallet.address.toString()}`);

    // Payload для fixed price продажи через аукцион
	const auctionConfig = beginCell()
		.storeAddress(wallet.address)                   // beneficiar_address
		.storeCoins(PRICE)                              // initial_min_bid
		.storeCoins(PRICE)                              // max_bid
		.storeUint(5, 8)                    // ← ВАЖНО: 8 бит для min_bid_step
		.storeUint(3600, 32)                  // ← 32 бита для min_extend_time
		.storeUint(DURATION, 32)                        // ← 32 бита для duration!
		.endCell();

	const salePayload = beginCell()
		.storeUint(0x487a8e81, 32)              // op_code
		.storeUint(13, 64)                      // query_id
		.storeRef(auctionConfig)                // <== ВАЖНО! кладём config как ref
		.endCell();

    await contract.sendTransfer({
        seqno,
        secretKey: keyPair.secretKey,
        messages: [
            internal({
                to: Address.parse(NFT_ADDRESS),
                value: toNano("0.1"),            // комиссия для вызова
                body: salePayload
            })
        ]
    });

    console.log("[NFT SALE] NFT выставлено на продажу по фиксированной цене (через продажу)!");
}

main().catch(console.error);
