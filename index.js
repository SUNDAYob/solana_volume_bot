require('dotenv').config();
const express = require('express');
const { Telegraf } = require('telegraf');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || '').split(',').map(id => id.trim());

// Tracking cache to prevent duplicate alerts under high network velocity
const processedMints = new Map();
const CLEANUP_INTERVAL = 5 * 60 * 1000; 

setInterval(() => {
  const now = Date.now();
  for (const [mint, timestamp] of processedMints.entries()) {
    if (now - timestamp > 60000) processedMints.delete(mint);
  }
}, CLEANUP_INTERVAL);

app.use(express.json());

app.get('/', (req, res) => res.status(200).send('🛡️ Pump.fun Graduate Scanner Active\n'));

app.post('/webhook', async (req, res) => {
  res.sendStatus(200); // Always free up the Helius webhook pipe instantly

  try {
    const txs = req.body;
    if (!Array.isArray(txs) || txs.length === 0) return;

    for (const tx of txs) {
      // 🎯 THE GRADUATION DETECTOR
      // Checks if the transaction belongs to the Pump.fun Raydium Migration contract
      const isMigration = tx.instructions?.some(inst => inst.programId === '6EF83uUk4936n7RWdqCw1LKUUY56CgdYSL5LWWTZ96K2') || 
                          tx.type === 'CREATE_POOL';
      
      if (!isMigration) continue;

      // Pull out the token address graduating from the curve
      const tokenMint = tx.tokenTransfers?.[0]?.mint || tx.instructions?.[0]?.accounts?.[0];
      if (!tokenMint || tokenMint.length < 32 || processedMints.has(tokenMint)) continue;

      processedMints.set(tokenMint, Date.now());
      
      console.log(`[🎓 PUMP GRADUATE] Target migrated to Raydium: ${tokenMint}. Initiating audit...`);

      // 🕒 Let Raydium pool fully initialize and let GMGN process the security profile
      setTimeout(async () => {
        let securityData = null;
        let tokenInfo = null;

        try {
          const config = {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
            timeout: 8000
          };

          const [secRes, infoRes] = await Promise.all([
            axios.get(`https://gmgn.ai/v1/token/security?chain=sol&address=${tokenMint}`, config).catch(() => null),
            axios.get(`https://gmgn.ai/v1/token/info?chain=sol&address=${tokenMint}`, config).catch(() => null)
          ]);

          if (secRes?.data?.data) securityData = secRes.data.data;
          if (infoRes?.data?.data) tokenInfo = infoRes.data.data;
        } catch (err) {}

        if (!securityData || !tokenInfo) {
          console.log(`[⚠️ SKIP] Security metrics unpopulated yet for: ${tokenMint}`);
          return;
        }

        // Strict Security Validation Layers
        const rugCount = Number(securityData.creator_rug_count || 0);
        const top10Rate = parseFloat(securityData.top_10_holder_rate || 0) * 100;
        const devShare = parseFloat(securityData.dev_team_hold_rate || securityData.creator_balance_rate || 0) * 100;
        const mintRenounced = securityData.renounced_mint === true || securityData.renounced_mint === 'yes';
        const freezeRenounced = securityData.renounced_freeze_account === true || securityData.renounced_freeze_account === 'yes';

        // 🛡️ ANTI-RUG PROTOCOLS
        if (rugCount > 0) return; // Block known rug developers
        if (!mintRenounced || !freezeRenounced) return; // Block unrenounced tokens
        if (top10Rate > 65 || devShare > 15) return; // Block massive insider bundles

        const symbol = tokenInfo.symbol || 'UNKNWN';
        console.log(`[🟢 SUCCESS] Verified graduate: ${symbol}. Sending to channel...`);

        const alertMessage = `
<b>🎓 PUMP.FUN GRADUATE DEPLOYED</b>
────────────────────────
• <b>Asset:</b> ${tokenInfo.name || 'Unknown'} (${symbol})
• <b>Contract:</b> <code>${tokenMint}</code>
────────────────────────
▶ <b>GRADUATE AUDIT METRICS</b>
• <b>Status:</b> Migrated to Raydium ✅
• <b>Mint/Freeze Authority:</b> Renounced ✅
• <b>Top 10 Share Rate:</b> <code>${top10Rate.toFixed(1)}%</code>
• <b>Dev Allocation:</b> <code>${devShare.toFixed(1)}%</code>
────────────────────────
▶ <b>TRADING INTERFACES</b>
• <a href="https://gmgn.ai/sol/token/${tokenMint}">📊 GMGN Professional Terminal</a>
• <a href="https://t.me/solana_trojanbot?start=r-cryptonigh-${tokenMint}">⚡ Trade Instantly via Trojan Bot</a>
`;

        for (const chatId of CHAT_IDS) {
          if (!chatId) continue;
          try {
            await bot.telegram.sendMessage(chatId, alertMessage, { parse_mode: 'HTML', disable_web_page_preview: true });
          } catch (err) {}
        }
      }, 15000); // 15-second delay ensures data is fresh
    }
  } catch (err) {}
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`⚙️ [SYSTEM RUNNING] Graduate Scanner online on Port ${PORT}`);
});