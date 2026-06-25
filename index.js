const express = require('express');
require('dotenv').config();
const { Telegraf } = require('telegraf');
const axios = require('axios');

const app = express();
app.use(express.json()); // Essential parser for Helius JSON payloads

const PORT = process.env.PORT || 10000;
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || '').split(',').map(id => id.trim());

// 1. Core Webhook Endpoint - Helius will push parsed launches directly here
app.post('/helius-stream', async (req, res) => {
  // Acknowledge the payload immediately to keep Helius happy
  res.sendStatus(200);

  try {
    const transactions = req.body;
    if (!Array.isArray(transactions) || transactions.length === 0) return;

    for (const tx of transactions) {
      // Pinpoint token transactions containing account alterations
      const tokenTransfers = tx.tokenTransfers || [];
      const instructions = tx.instructions || [];
      
      let tokenMint = null;

      // Extract the primary newly generated contract address
      if (tokenTransfers.length > 0) {
        tokenMint = tokenTransfers[0].tokenMint;
      } else {
        // Fallback: Deep-scan internal instruction programs for newly initialized accounts
        const mintInstruction = instructions.find(inst => 
          inst.innerInstructions && 
          inst.innerInstructions.some(inner => inner.parsed?.type === 'initializeMint')
        );
        if (mintInstruction) {
          const inner = mintInstruction.innerInstructions.find(i => i.parsed?.type === 'initializeMint');
          tokenMint = inner.parsed?.info?.mint;
        }
      }

      if (!tokenMint || tokenMint.endsWith('11111111111111111111111111111111')) continue;

      console.log(`📬 [WEBHOOK RECOVERY] Parsed Token Address: ${tokenMint}`);

      // 🛡️ Fail-Safe Security Filter
      let securityStatusText = "Clean Pass ✅";
      try {
        const securityCheck = await axios.get(`https://api.rugcheck.xyz/v1/tokens/${tokenMint}/report`, { timeout: 1800 });
        const report = securityCheck.data;

        if (report && report.risks) {
          const isHoneypot = report.risks.some(risk => {
            const riskName = (risk.name || '').toLowerCase();
            return riskName.includes('mint') || riskName.includes('freeze') || riskName.includes('honeypot');
          });

          if (isHoneypot) {
            console.log(`🛑 Blocked dangerous asset properties: ${tokenMint}`);
            continue; 
          }
          if (report.score > 4000) securityStatusText = `⚠️ High Risk (${report.score})`;
        }
      } catch {
        securityStatusText = "Scan Bypassed (Traffic High) ⏱️";
      }

      const trojanTradeLink = `https://t.me/solana_trojanbot?start=r-obstech-${tokenMint}`;
      const dexScreenerLink = `https://dexscreener.com/solana/${tokenMint}`;

      const telegramAlert = `
🔥 <b>NEW LIVE POOL DETECTED</b> 🔥
────────────────────────
▶ <b>BLOCK METADATA</b>
• <b>Token Contract:</b> <code>${tokenMint}</code>
• <b>Router Target:</b> Raydium AMM V4 🪐
────────────────────────
▶ <b>🛡️ AUTOMATED SECURITY SCAN</b>
• <b>Status Result:</b> <b>${securityStatusText}</b>
────────────────────────
▶ <b>LIGHTNING TRADE EXECUTION</b>
• <a href="${dexScreenerLink}">DexScreener Market Chart</a>
• <a href="${trojanTradeLink}">⚔️ Instant Buy Entry via Trojan Bot</a>
────────────────────────
`;

      for (const chatId of CHAT_IDS) {
        if (!chatId) continue;
        try {
          await bot.telegram.sendMessage(chatId, telegramAlert, { 
            parse_mode: 'HTML',
            disable_web_page_preview: true 
          });
        } catch (err) {
          console.log(`Telegram Send Alert Error: ${err.message}`);
        }
      }
    }
  } catch (parseError) {
    console.log(`Internal Webhook Processing Bypass: ${parseError.message}`);
  }
});

// 2. Health Check Route for Render & UptimeRobot
app.get('/', (req, res) => {
  res.send('Solana Server Core: Stable Protocol Live.');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 [SERVER LIVE] Listening for Webhook signals on port ${PORT}`);
});