import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { sellNftSale } from "./sell.js";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/sell", async (req, res) => {
    try {
        const body = req.body ?? {};
        const result = await sellNftSale({
            endpoint: body.endpoint || process.env.TON_ENDPOINT,
            apiKey: body.apiKey || process.env.TON_API_KEY,
            mnemonic: body.mnemonic ?? process.env.TON_MNEMONIC,
            nftAddress: body.nftAddress ?? process.env.NFT_ADDRESS,
            priceTon: body.priceTon ?? process.env.SALE_PRICE,
            maxBidTon: body.maxBidTon ?? process.env.SALE_MAX_BID,
            minBidStep: body.minBidStep ?? process.env.SALE_MIN_BID_STEP,
            minExtendTime: body.minExtendTime ?? process.env.SALE_MIN_EXTEND_TIME,
            duration: body.duration ?? process.env.SALE_DURATION,
            transferTon: body.transferTon ?? process.env.SALE_TRANSFER_TON,
            queryId: body.queryId ?? process.env.SALE_QUERY_ID,
            beneficiaryAddress: body.beneficiaryAddress ?? process.env.SALE_BENEFICIARY
        });

        res.json({
            success: true,
            data: {
                message: "NFT выставлено на продажу",
                ...result
            }
        });
    } catch (error) {
        console.error("Ошибка при продаже NFT", error);
        res.status(400).json({
            success: false,
            error: error?.message ?? "Неизвестная ошибка"
        });
    }
});

const PORT = Number(process.env.PORT ?? 3000);

app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
});
