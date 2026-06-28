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

    // 📡 VISIBILITY LOG: Confirms Helius data just hit your server
    console.log(`[📡 Webhook] Received ${txs.length} transactions from Helius.`);

    for (const tx of txs) {
      const isNewLaunch = tx.instructions?.some(inst => inst.suggestedInstructionName === 'create');
      const isMigration = tx.type === 'CREATE_POOL' || 
                          tx.description?.toLowerCase().includes('migrat') ||
                          tx.instructions?.some(inst => inst.programId === '6EF83uUk4936n7RWdqCw1LKUUY56CgdYSL5LWWTZ96K2');
      
      if (!isNewLaunch && !isMigration) continue;

      const eventTag = isMigration ? "🚀 RAYDIUM GRADUATION" : "💊 NEW PUMP.FUN LAUNCH";
      const waitTime = isMigration ? 15000 : 45000; 

      const tokenMint = tx.tokenTransfers?.[0]?.mint || tx.instructions?.[0]?.accounts?.[0];
      if (!tokenMint) continue;

      if (recentMints.has(tokenMint)) {
        console.log(`[♻️ Skip] Token ${tokenMint} was already processed recently.`);
        continue;
      }

      console.log(`[🎯 Found Match] Processing ${eventTag} for Token: ${tokenMint}`);

      recentMints.add(tokenMint);
      setTimeout(() => recentMints.delete(tokenMint), 60000);

      (async () => {
        await delay(waitTime); 

        let gmgnData = null;
        try {
          const gmgnResponse = await axios.get(`https://gmgn.ai/api/v1/token_security/sol/${tokenMint}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 6000
          });
          if (gmgnResponse.data?.data) gmgnData = gmgnResponse.data.data;
        } catch (err) {
          console.log(`[❌ API Error] Failed fetching GMGN safety details for ${tokenMint}`);
        }

        if (!gmgnData) {
          console.log(`[⚠️ Skip] No security data ready on GMGN yet for ${tokenMint}`);
          return;
        }

        const rugCount = Number(gmgnData.creator_rug_count || gmgnData.dev_rug_count || 0);
        const top10Rate = parseFloat(gmgnData.top_10_holder_rate || gmgnData.holder_concentration || 0) * 100;
        const totalCreatedCount = Number(gmgnData.token_created_count || gmgnData.creator_token_count || 0);
        const devShare = parseFloat(gmgnData.dev_team_hold_rate || gmgnData.creator_hold_rate || 0) * 100;

        // 🛡️ SECURITY AUDIT STATUS LOGS
        if (rugCount > 0 || gmgnData.is_honeypot) {
          console.log(`[🛑 BLOCKED] Token ${tokenMint} failed malicious threat assessment (Rug record/Honeypot).`);
          return;
        }
        if (top10Rate > 65) {
          console.log(`[🛑 BLOCKED] Token ${tokenMint} failed distribution check. Snipers own too much (${top10Rate.toFixed(1)}%).`);
          return;
        }
        if (devShare > 15) {
          console.log(`[🛑 BLOCKED] Token ${tokenMint} failed developer balance check. Dev owns too much (${devShare.toFixed(1)}%).`);
          return;
        }

        console.log(`[🟢 SUCCESS] Token ${tokenMint} passed all safety audits! Dispatching alert to Telegram...`);

        const alertMessage = `
${eventTag}
────────────────────────
• <b>Asset:</b> ${gmgnData.name || 'Unknown'} (${gmgnData.symbol || 'TOKEN'})
• <b>Contract:</b> <code>${tokenMint}</code>
────────────────────────
▶ <b>SECURITY AUDIT METRICS</b>
• <b>Top 10 Concentration:</b> ${top10Rate.toFixed(1)}%
• <b>Dev Holdings / Share:</b> ${devShare.toFixed(1)}% 🛡️
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
          } catch (tgErr) {
            console.log(`[❌ Telegram Error] Failed pushing message to chat ID: ${chatId}`);
          }
        }
      })();
    }
  } catch (err) {}
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Webhook Server Stable on Port ${PORT}`);
});