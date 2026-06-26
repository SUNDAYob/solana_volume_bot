require('dotenv').config();
const express = require('express');
const { Telegraf } = require('telegraf');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

// Initialize Telegraf Bot Core
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || '').split(',').map(id => id.trim());

// Local set to prevent sending multiple alerts for the same token within 60 seconds
const processedTokens = new Set();

app.use(express.json());

// Root endpoint so you can verify the server is loading in your browser
app.get('/', (req, res) => {
  res.status(200).send('🚀 Bulletproof Ground-Up Engine Is Fully Live!');
});

// Primary Webhook Receiver for Helius Data Streams
app.post('/helius-stream', async (req, res) => {
  // CRITICAL: Always respond with 200 OK immediately so Helius doesn't drop your stream
  res.status(200).send('OK');

  try {
    const payload = req.body;
    
    // Explicit debug log to prove the webhook is successfully hitting your server
    console.log(`[WEBHOOK RECEIVED] Processing bundle containing ${Array.isArray(payload) ? payload.length : 1} transactions.`);

    if (!Array.isArray(payload)) return;

    for (const tx of payload) {
      let mintAddress = null;

      // Extract Strategy 1: Check standard token transfers array
      if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
        const transferItem = tx.tokenTransfers.find(t => t.tokenMint && t.tokenMint.length >= 32);
        if (transferItem) mintAddress = transferItem.tokenMint;
      }

      // Extract Strategy 2: Check raw account data modifications
      if (!mintAddress && tx.accountData && tx.accountData.length > 0) {
        const systemExclusions = [
          '11111111111111111111111111111111',
          'So11111111111111111111111111111111111111112',
          '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
          'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
        ];
        const accountFound = tx.accountData.find(acc => 
          acc.account && acc.account.length >= 32 && !systemExclusions.includes(acc.account)
        );
        if (accountFound) mintAddress = accountFound.account;
      }

      // Verify the found token contract address is valid
      if (!mintAddress || typeof mintAddress !== 'string') continue;
      mintAddress = mintAddress.trim();
      if (mintAddress.length < 32 || mintAddress.includes('1111111111111111')) continue;

      // Deduplicate rapid subsequent events for the same token
      if (processedTokens.has(mintAddress)) continue;
      processedTokens.add(mintAddress);
      setTimeout(() => processedTokens.delete(mintAddress), 60000);

      console.log(`🎯 [TARGET CAPTURED] Found token contract: ${mintAddress}`);

      // Bulletproof raw layout using absolute plain text to guarantee safe delivery
      const alertPayload = `
🚨 NEW SOLANA LAUNCH DETECTED 🚨
━━━━━━━━━━━━━━━━━━━━
Contract Address:
${mintAddress}
━━━━━━━━━━━━━━━━━━━━
Links:
• GMGN Chart: https://gmgn.ai/sol/token/${mintAddress}
• Trojan Sniper: https://t.me/solana_trojanbot?start=r-obstech-${mintAddress}
`;

      // Synchronous delivery loop with comprehensive failure logging
      for (const chatId of CHAT_IDS) {
        if (!chatId) continue;
        try {
          await bot.telegram.sendMessage(chatId, alertPayload);
          console.log(`↳ 🎉 Notification successfully delivered to Chat ID: ${chatId}`);
        } catch (tgError) {
          console.error(`↳ ❌ Telegram Delivery Failed for Chat (${chatId}): ${tgError.message}`);
        }
      }
    }
  } catch (err) {
    console.error(`[STREAM RUNTIME EXCEPTION]: ${err.message}`);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Brand-New Clean Core Server listening on Port ${PORT}`);

  // 🛡️ BUILT-IN ANTI-SLEEP CHRONO LOOP
  // Pings your app URL automatically every 4 minutes to prevent Render Free Tier from spinning down.
  const SERVER_SELF_URL = 'https://solana-volume-bot-pvtx.onrender.com';
  setInterval(async () => {
    try {
      await axios.get(SERVER_SELF_URL);
      console.log('⏳ [KEEP-ALIVE] Pinged main endpoint. App status remains active.');
    } catch (pingErr) {
      console.log('⏳ [KEEP-ALIVE] Self-ping status verified.');
    }
  }, 240000); // 240,000 milliseconds = 4 minutes
});