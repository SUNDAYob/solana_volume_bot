require('dotenv').config();
const express = require('express');
const { Telegraf } = require('telegraf');

const app = express();
const PORT = process.env.PORT || 10000;

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || '').split(',').map(id => id.trim());

// Track recent mints to prevent duplicate alerts for the same token within 1 minute
const recentMints = new Set();

app.use(express.json());

app.get('/', (req, res) => {
  res.status(200).send('⚡ GMGN Stream Broadcaster Online\n');
});

app.post('/helius-stream', async (req, res) => {
  // Always respond immediately to Helius to keep the webhook healthy
  res.status(200).send('OK'); 

  try {
    const transactions = req.body;
    if (!Array.isArray(transactions)) return;

    for (const tx of transactions) {
      let tokenMint = null;
      
      // Extract the token mint from transfers
      const tokenTransfers = tx.tokenTransfers || [];
      if (tokenTransfers.length > 0 && tokenTransfers[0].tokenMint) {
        tokenMint = tokenTransfers[0].tokenMint;
      }

      // Fallback: Parse instructions structurally if transfers are empty
      if (!tokenMint && tx.instructions) {
        for (const inst of tx.instructions) {
          if (inst.accounts && inst.accounts.length > 2) {
            const structuralMint = inst.accounts.find(acc => 
              acc !== '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8' && 
              acc !== 'So11111111111111111111111111111111111111112' &&
              acc !== 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' &&
              acc.length >= 32 && !acc.startsWith('Sysvar')
            );
            if (structuralMint) { tokenMint = structuralMint; break; }
          }
        }
      }

      // Sanity checks on the address format
      if (!tokenMint || typeof tokenMint !== 'string') continue;
      tokenMint = tokenMint.trim();
      if (tokenMint.includes('11111111111111111111111111111111') || tokenMint.length < 32) continue;

      // Deduplicate rapid incoming multi-transfers
      if (recentMints.has(tokenMint)) continue;
      recentMints.add(tokenMint);
      setTimeout(() => recentMints.delete(tokenMint), 60000); 

      // 🎯 Direct, unfiltered delivery
      console.log(`[STREAM MATCH] Broadcasting token to channel: ${tokenMint}`);

      // Optimized deep links to prevent routing errors in mobile layouts
      const trojanTradeLink = `https://t.me/solana_trojanbot?start=r-obstech-${tokenMint}`;
      const gmgnMobileLink = `https://gmgn.ai/sol/token/${tokenMint}`;

      const telegramAlert = `
🚀 <b>NEW SOLANA PAIR DETECTED</b> 🚀
────────────────────────
▶ <b>TOKEN PROFILE</b>
• <b>Contract:</b> <code>${tokenMint}</code>
────────────────────────
▶ <b>⚔️ ACTIVE ENTRY RAMP</b>
• <a href="${gmgnMobileLink}">📊 Open GMGN Chart Terminal</a>
• <a href="${trojanTradeLink}">⚔️ Sniper Instant Buy (Trojan)</a>
────────────────────────
`;

      // Dispatch to your chat list
      for (const chatId of CHAT_IDS) {
        if (!chatId) continue;
        try {
          await bot.telegram.sendMessage(chatId, telegramAlert, { 
            parse_mode: 'HTML',
            disable_web_page_preview: true 
          });
        } catch (tgErr) {
          console.log(`↳ [TELEGRAM ERROR] Check your Bot Token / Chat ID configurations: ${tgErr.message}`);
        }
      }
    }
  } catch (error) {
    console.log(`[CORE EXCEPTION]: ${error.message}`);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Stream Engine fully deployed on port ${PORT}`);
});