require('dotenv').config();
const express = require('express');
const { Telegraf } = require('telegraf');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || '').split(',').map(id => id.trim());

const recentMints = new Set();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

app.use(express.json());

app.get('/', (req, res) => res.status(200).send('🛡️ Webhook Guard Active\n'));

app.post('/webhook', async (req, res) => {
  res.sendStatus(200); 
  
  try {
    const txs = req.body;
    if (!Array.isArray(txs) || txs.length === 0) return;

    for (const tx of txs) {
      const isCreate = tx.instructions?.some(inst => inst.suggestedInstructionName === 'create') || 
                       tx.type === 'CREATE_POOL';
      if (!isCreate) continue;

      const tokenMint = tx.tokenTransfers?.[0]?.mint || tx.instructions?.[0]?.accounts?.[0];
      if (!tokenMint || recentMints.has(tokenMint)) continue;

      recentMints.add(tokenMint);
      setTimeout(() => recentMints.delete(tokenMint), 60000);

      (async () => {
        await delay(45000); // ⏱️ Keeps your 45-second data cushion

        let gmgnData = null;
        try {
          const gmgnResponse = await axios.get(`https://gmgn.ai/api/v1/token_security/sol/${tokenMint}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 6000
          });
          if (gmgnResponse.data?.data) gmgnData = gmgnResponse.data.data;
        } catch (err) {}

        if (!gmgnData) return;

        const rugCount = Number(gmgnData.creator_rug_count || gmgnData.dev_rug_count || 0);
        const top10Rate = parseFloat(gmgnData.top_10_holder_rate || gmgnData.holder_concentration || 0) * 100;
        const totalCreatedCount = Number(gmgnData.token_created_count || gmgnData.creator_token_count || 0);

        // 🛡️ REBALANCED SECURITY GATE
        // 1. Instantly blocks known ruggers and honeypots.
        // 2. Adjusted Top 10 Cap to 65% to account for normal 45-second launch volume.
        // 3. REMOVED the totalCreatedCount limit so legendary, safe devs aren't blocked!
        if (rugCount > 0 || gmgnData.is_honeypot || top10Rate > 65) return;

        const alertMessage = `
💊 <b>NEW PUMP.FUN DETECTED (WEBHOOK)</b> 💊
────────────────────────
• <b>Asset:</b> ${gmgnData.name || 'Unknown'} (${gmgnData.symbol || 'TOKEN'})
• <b>Contract:</b> <code>${tokenMint}</code>
────────────────────────
▶ <b>SECURITY AUDIT METRICS</b>
• <b>Top 10 Concentration:</b> ${top10Rate.toFixed(1)}%
• <b>Dev Profile:</b> ${totalCreatedCount} Created (0 Rugs)
────────────────────────
▶ <b>TRADING PORTS</b>
• <a href="https://gmgn.ai/sol/token/${tokenMint}">GMGN Chart Terminal</a>
• <a href="https://t.me/solana_trojanbot?start=r-cryptonigh-${tokenMint}">Trade via Trojan Bot</a>
`;

        for (const chatId of CHAT_IDS) {
          if (!chatId) continue;
          try {
            await bot.telegram.sendMessage(chatId, alertMessage, { parse_mode: 'HTML', disable_web_page_preview: true });
          } catch (tgErr) {}
        }
      })();
    }
  } catch (err) {}
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Webhook Server Stable on Port ${PORT}`);
});