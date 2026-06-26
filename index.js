require('dotenv').config();
const express = require('express');
const { Telegraf } = require('telegraf');

const app = express();
const PORT = process.env.PORT || 10000;

// Initialize Telegram Client safely
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || '').split(',').map(id => id.trim());

// 60-second deduplication cache to keep your chat clean from double-alerts
const recentMints = new Set();

app.use(express.json());

// Root health check endpoint for Render to verify status
app.get('/', (req, res) => {
  res.status(200).send('⚡ Ground-Up Solana Stream Engine: Online and Resilient\n');
});

// Main Helius Webhook Ingestion Endpoint
app.post('/helius-stream', async (req, res) => {
  // CRITICAL: Always reply with an immediate 200 OK to keep Helius from pausing your webhook
  res.status(200).send('OK'); 

  try {
    const transactions = req.body;
    if (!Array.isArray(transactions) || transactions.length === 0) return;

    for (const tx of transactions) {
      let tokenMint = null;

      // LAYER 1 EXTRACTION: Standard Token Transfers array
      if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
        const standardTransfer = tx.tokenTransfers.find(t => t.tokenMint && t.tokenMint.length >= 32);
        if (standardTransfer) tokenMint = standardTransfer.tokenMint;
      }

      // LAYER 2 EXTRACTION: Raw Account Data structural arrays
      if (!tokenMint && tx.accountData && tx.accountData.length > 0) {
        const nativeExclusions = [
          '11111111111111111111111111111111', 
          'So11111111111111111111111111111111111111112',
          '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
          'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
        ];
        const tokenAccountMatch = tx.accountData.find(acc => 
          acc.account && 
          acc.account.length >= 32 && 
          !nativeExclusions.includes(acc.account)
        );
        if (tokenAccountMatch) tokenMint = tokenAccountMatch.account;
      }

      // LAYER 3 EXTRACTION: Instruction accounts fallback matrix
      if (!tokenMint && tx.instructions) {
        for (const inst of tx.instructions) {
          if (inst.accounts && inst.accounts.length > 0) {
            const possibleMint = inst.accounts.find(a => a && a.length >= 32 && !a.startsWith('Sysvar'));
            if (possibleMint) { tokenMint = possibleMint; break; }
          }
        }
      }

      // VALIDATION SYSTEM
      if (!tokenMint || typeof tokenMint !== 'string') continue;
      tokenMint = tokenMint.trim();
      if (tokenMint.length < 32 || tokenMint.includes('1111111111111111')) continue;

      // ANTI-SPAM DEDUPLICATION
      if (recentMints.has(tokenMint)) continue;
      recentMints.add(tokenMint);
      setTimeout(() => recentMints.delete(tokenMint), 60000);

      console.log(`[TARGET CAPTURED] Processing payload for: ${tokenMint}`);

      // High-converting Telegram UI using stable HTML templates
      const telegramAlert = `
🚀 <b>NEW SOLANA PAIR DETECTED</b> 🚀
────────────────────────
▶ <b>MINT CONTRACT ADDRESS</b>
<code>${tokenMint}</code>
────────────────────────
▶ <b>FAST ACTIONS (MOBILE OPTIMIZED)</b>
• <a href="https://gmgn.ai/sol/token/${tokenMint}">📊 View live charts on GMGN</a>
• <a href="https://t.me/solana_trojanbot?start=r-obstech-${tokenMint}">⚔️ Sniper instant buy via Trojan</a>
────────────────────────
`;

      // Safe Delivery Thread
      for (const chatId of CHAT_IDS) {
        if (!chatId) continue;
        try {
          await bot.telegram.sendMessage(chatId, telegramAlert, { 
            parse_mode: 'HTML',
            disable_web_page_preview: true 
          });
          console.log(`↳ 🎉 Alert successfully routed to Chat ID: ${chatId}`);
        } catch (tgErr) {
          console.error(`↳ ❌ Telegram Delivery blocked: ${tgErr.message}`);
        }
      }
    }
  } catch (error) {
    console.error(`🚨 [SYSTEM ERROR]: ${error.message}`);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Fresh Stream Engine fully initialized on Port ${PORT}`);
});