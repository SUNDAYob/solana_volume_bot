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

// Main health-check endpoint
app.get('/', (req, res) => res.status(200).send('🛡️ Webhook Guard Active\n'));

app.post('/webhook', async (req, res) => {
  // Always acknowledge the Helius webhook immediately to prevent retries
  res.sendStatus(200); 
  
  try {
    const txs = req.body;
    if (!Array.isArray(txs) || txs.length === 0) return;

    for (const tx of txs) {
      // 🕵️ Dual Detector Logic: Matches original creations OR migrations
      const isNewLaunch = tx.instructions?.some(inst => inst.suggestedInstructionName === 'create');
      const isMigration = tx.type === 'CREATE_POOL' || 
                          tx.description?.toLowerCase().includes('migrat') ||
                          tx.instructions?.some(inst => inst.programId === '6EF83uUk4936n7RWdqCw1LKUUY56CgdYSL5LWWTZ96K2');
      
      if (!isNewLaunch && !isMigration) continue;

      // Dynamic styling and cushions depending on the underlying transaction profile
      const eventTag = isMigration ? "🚀 RAYDIUM GRADUATION / MIGRATION" : "💊 NEW PUMP.FUN LAUNCH";
      const waitTime = isMigration ? 15000 : 45000; 

      // Safely parse out the contract token address
      const tokenMint = tx.tokenTransfers?.[0]?.mint || tx.instructions?.[0]?.accounts?.[0];
      if (!tokenMint || recentMints.has(tokenMint)) continue;

      // Anti-spam state machine protection
      recentMints.add(tokenMint);
      setTimeout(() => recentMints.delete(tokenMint), 60000);

      // Asynchronous non-blocking security gate execution
      (async () => {
        await delay(waitTime); 

        let gmgnData = null;
        try {
          const gmgnResponse = await axios.get(`https://gmgn.ai/api/v1/token_security/sol/${tokenMint}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 6000
          });
          if (gmgnResponse.data?.data) gmgnData = gmgnResponse.data.data;
        } catch (err) {}

        // Skip immediately if the token metrics aren't populated on GMGN yet
        if (!gmgnData) return;

        // Core security metrics parsing
        const rugCount = Number(gmgnData.creator_rug_count || gmgnData.dev_rug_count || 0);
        const top10Rate = parseFloat(gmgnData.top_10_holder_rate || gmgnData.holder_concentration || 0) * 100;
        const totalCreatedCount = Number(gmgnData.token_created_count || gmgnData.creator_token_count || 0);
        
        // 💎 THE PRO SUGGESTION UPGRADE: Extracts exact developer control metrics
        const devShare = parseFloat(gmgnData.dev_team_hold_rate || gmgnData.creator_hold_rate || 0) * 100;

        // 🛡️ THE LEGENDARY SECURITY SELECTION GATE
        // 1. Blocks known malicious creators/ruggers
        // 2. Blocks honeypots
        // 3. Imposes a broad 65% boundary to prevent massive early sniper dumps
        // 4. NEW CRITERIA: Kills tokens instantly if greedy devs hold > 15% of total supply!
        if (rugCount > 0 || gmgnData.is_honeypot || top10Rate > 65 || devShare > 15) return;

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
          } catch (tgErr) {}
        }
      })();
    }
  } catch (err) {}
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Webhook Server Stable on Port ${PORT}`);
});