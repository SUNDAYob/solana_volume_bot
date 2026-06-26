require('dotenv').config();
const express = require('express');
const { Telegraf } = require('telegraf');

const app = express();
const PORT = process.env.PORT || 10000;

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || '').split(',').map(id => id.trim());

// Deduplication matrix to hold transactions for 60 seconds
const recentMints = new Set();

app.use(express.json());

app.get('/', (req, res) => {
  res.status(200).send('⚡ Core Delivery Engine Operational\n');
});

app.post('/helius-stream', async (req, res) => {
  // Acknowledge Helius payload immediately to maintain high delivery health
  res.status(200).send('OK'); 

  try {
    const transactions = req.body;
    if (!Array.isArray(transactions) || transactions.length === 0) return;

    for (const tx of transactions) {
      let tokenMint = null;

      // Layer 1: Extract via Token Transfers Array
      if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
        const primaryTransfer = tx.tokenTransfers.find(t => t.tokenMint && t.tokenMint.length >= 32);
        if (primaryTransfer) tokenMint = primaryTransfer.tokenMint;
      }

      // Layer 2: Extract via Account Data Arrays if transfers are blank
      if (!tokenMint && tx.accountData && tx.accountData.length > 0) {
        const nativeExclusions = [
          '11111111111111111111111111111111', 
          'So11111111111111111111111111111111111111112',
          '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
          'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
        ];
        const validAccount = tx.accountData.find(acc => 
          acc.account && 
          acc.account.length >= 32 && 
          !nativeExclusions.includes(acc.account)
        );
        if (validAccount) tokenMint = validAccount.account;
      }

      // Layer 3: Direct fallback check to transaction instructions
      if (!tokenMint && tx.instructions) {
        for (const inst of tx.instructions) {
          if (inst.accounts && inst.accounts.length > 0) {
            const potentialMint = inst.accounts.find(a => a && a.length >= 32 && !a.startsWith('Sysvar'));
            if (potentialMint) { tokenMint = potentialMint; break; }
          }
        }
      }

      // Verify asset profile format
      if (!tokenMint || typeof tokenMint !== 'string') continue;
      tokenMint = tokenMint.trim();
      if (tokenMint.length < 32 || tokenMint.includes('11111111111111111')) continue;

      // Handle rapid processing deduplication
      if (recentMints.has(tokenMint)) continue;
      recentMints.add(tokenMint);
      setTimeout(() => recentMints.delete(tokenMint), 60000);

      console.log(`[INGESTED MATCH] Dispatching Token: ${tokenMint}`);

      // MarkdownV2 Safe Escaping to prevent Telegram message parsing issues
      const escapedMint = tokenMint.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

      const telegramAlert = `
🚀 *NEW PAIR BREAKOUT* 🚀
━━━━━━━━━━━━━━━━━━━━
▶ *TOKEN CONTRACT*
\`${escapedMint}\`
━━━━━━━━━━━━━━━━━━━━
▶ *RAGELINK ACCESS*
[📊 Open GMGN Terminal](https://gmgn.ai/sol/token/${tokenMint})
[⚔️ Buy Instant via Trojan](https://t.me/solana_trojanbot?start=r-obstech-${tokenMint})
━━━━━━━━━━━━━━━━━━━━
`;

      // Safe dispatch block
      for (const chatId of CHAT_IDS) {
        if (!chatId) continue;
        try {
          await bot.telegram.sendMessage(chatId, telegramAlert, { 
            parse_mode: 'MarkdownV2',
            disable_web_page_preview: true 
          });
          console.log(`↳ 🎉 Delivered securely to chat ID: ${chatId}`);
        } catch (tgErr) {
          console.error(`↳ ❌ Telegram Delivery Reject: ${tgErr.message}`);
        }
      }
    }
  } catch (error) {
    console.error(`[CORE SYSTEM EXCEPTION]: ${error.message}`);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Production Broadcaster online and listening on port ${PORT}`);
});