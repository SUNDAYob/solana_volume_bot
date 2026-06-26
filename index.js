require('dotenv').config();
const express = require('express');
const { Telegraf } = require('telegraf');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

// Initialize Telegram Core
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || '').split(',').map(id => id.trim());

// 60-second duplicate cache window
const recentMints = new Set();

app.use(express.json());

// Main entry point for status checks and internal pings
app.get('/', (req, res) => {
  res.status(200).send('⚡ Core Anti-Sleep Engine: Active and Resilient\n');
});

// Helius Webhook Ingestion Router
app.post('/helius-stream', async (req, res) => {
  // CRITICAL: Always respond immediately so Helius never flags your webhook as timed out
  res.status(200).send('OK'); 

  try {
    const transactions = req.body;
    if (!Array.isArray(transactions) || transactions.length === 0) return;

    for (const tx of transactions) {
      let tokenMint = null;

      // Extract Layer 1: Token Transfers Array
      if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
        const primaryTransfer = tx.tokenTransfers.find(t => t.tokenMint && t.tokenMint.length >= 32);
        if (primaryTransfer) tokenMint = primaryTransfer.tokenMint;
      }

      // Extract Layer 2: Raw Account Data Objects Fallback
      if (!tokenMint && tx.accountData && tx.accountData.length > 0) {
        const exclusions = [
          '11111111111111111111111111111111', 
          'So11111111111111111111111111111111111111112',
          '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
          'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
        ];
        const accountMatch = tx.accountData.find(acc => 
          acc.account && acc.account.length >= 32 && !exclusions.includes(acc.account)
        );
        if (accountMatch) tokenMint = accountMatch.account;
      }

      // Strict String Formatting Verification
      if (!tokenMint || typeof tokenMint !== 'string') continue;
      tokenMint = tokenMint.trim();
      if (tokenMint.length < 32 || tokenMint.includes('1111111111111111')) continue;

      // Prevent redundant cross-spamming of the same token
      if (recentMints.has(tokenMint)) continue;
      recentMints.add(tokenMint);
      setTimeout(() => recentMints.delete(tokenMint), 60000);

      console.log(`[STREAM INGESTED] Broadcasting Token: ${tokenMint}`);

      // Safe, clean HTML template configuration
      const telegramAlert = `
🚀 <b>NEW SOLANA PAIR STREAMING</b> 🚀
────────────────────────
▶ <b>CONTRACT ADDRESS</b>
<code>${tokenMint}</code>
────────────────────────
▶ <b>MOBILE SPEEDED LINKS</b>
• <a href="https://gmgn.ai/sol/token/${tokenMint}">📊 Open GMGN Chart Terminal</a>
• <a href="https://t.me/solana_trojanbot?start=r-obstech-${tokenMint}">⚔️ Sniper Instant Buy via Trojan</a>
────────────────────────
`;

      // Dispatch Matrix
      for (const chatId of CHAT_IDS) {
        if (!chatId) continue;
        try {
          await bot.telegram.sendMessage(chatId, telegramAlert, { 
            parse_mode: 'HTML',
            disable_web_page_preview: true 
          });
          console.log(`↳ 🎉 Alert dropped into Chat: ${chatId}`);
        } catch (tgErr) {
          console.error(`↳ ❌ Telegram Core Error: ${tgErr.message}`);
        }
      }
    }
  } catch (error) {
    console.error(`[EXCEPTION LOGGING]: ${error.message}`);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Ground-up Broadcaster Core fully running on Port ${PORT}`);

  // 🛡️ ANTI-SLEEP CHRONO LOOP: Self-ping the instance every 5 minutes to stay awake
  const APP_URL = `https://solana-volume-bot-pvtx.onrender.com`; // Your explicit Render application URL
  setInterval(async () => {
    try {
      await axios.get(APP_URL);
      console.log('⏳ [KEEP-ALIVE] Pinged core engine status successfully. Container remains awake.');
    } catch (pingError) {
      console.log('⏳ [KEEP-ALIVE HICCUP] Self-ping status check issued.');
    }
  }, 300000); // 300,000 ms = 5 minutes
});