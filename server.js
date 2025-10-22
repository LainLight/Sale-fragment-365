import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createFixedPriceSale } from "./sell.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/sell", async (req, res) => {
    try {
        const saleResult = await createFixedPriceSale({
            endpoint: req.body.endpoint,
            apiKey: req.body.apiKey,
            mnemonic: req.body.mnemonic,
            nftAddress: req.body.nftAddress,
            priceTon: req.body.priceTon,
            duration: req.body.duration,
            minBidStep: req.body.minBidStep,
            minExtendTime: req.body.minExtendTime,
            queryId: req.body.queryId,
            commissionTon: req.body.commissionTon,
            beneficiaryAddress: req.body.beneficiaryAddress
        });

        res.json({
            success: true,
            result: saleResult
        });
    } catch (error) {
        console.error("[NFT SALE] Web request failed:", error);
        res.status(400).json({
            success: false,
            message: error.message || "Не удалось выставить NFT на продажу"
        });
    }
});

app.use((req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
    console.log(`Sale interface is running on http://localhost:${PORT}`);
});
