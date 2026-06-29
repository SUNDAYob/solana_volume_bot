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

app.get('/', (req, res) => res.status(200).send('🛡️ Universal Security Scanner Active (Dynamic Rug Rate Setup)\n'));

app.post('/webhook', async (req, res) => {
  res.sendStatus(200); // Free up Helius instantly

  try {
    const txs = req.body;
    if (!Array.isArray(txs) || txs.length === 0) return;

    for (const tx of txs) {
      // UNIVERSAL TOKEN EXTRACTOR
      const tokenMint = tx.tokenTransfers?.[0]?.mint || 
                        tx.instructions?.[0]?.accounts?.[0] || 
                        tx.accountData?.[0]?.account;
                        
      if (!tokenMint || tokenMint.length < 32 || processedMints.has(tokenMint)) continue;

      // Filter out native Solana or systemic account addresses
      if (tokenMint === 'So11111111111111111111111111111111111111112' || tokenMint.endsWith('11111111')) continue;

      processedMints.set(tokenMint, Date.now());
      
      console.log(`[🔍 DETECTED] Token discovered: ${tokenMint}. Analyzing security profile...`);

      // 12-second pause to let GMGN index pool metrics
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

        if (!securityData || !tokenInfo) return;

        // Extract Security Metrics
        const rugCount = Number(securityData.creator_rug_count || 0);
        const totalCreated = Number(securityData.creator_token_create_count || 0);
        const top10Rate = parseFloat(securityData.top_10_holder_rate || 0) * 100;
        const devShare = parseFloat(securityData.dev_team_hold_rate || securityData.creator_balance_rate || 0) * 100;
        const mintRenounced = securityData.renounced_mint === true || securityData.renounced_mint === 'yes';
        const freezeRenounced = securityData.renounced_freeze_account === true || securityData.renounced_freeze_account === 'yes';

        // 🎯 Calculate Developer's Math Rug Rate Percentage
        let rugRate = 0;
        if (totalCreated > 0) {
          rugRate = (rugCount / totalCreated) * 100;
        }

        // 🛡️ SECURITY AUDIT GATEWAY
        if (rugRate >= 85) return;                      // Drop dev if their historical rug rate is 85% or higher
        if (!mintRenounced || !freezeRenounced) return; // Core safety constraint: Drop unrenounced keys
        if (top10Rate > 80) return;                     // Relaxed limit: Max 80% for Top 10
        if (devShare > 25) return;                      // Relaxed limit: Max 25% for Dev wallets

        const symbol = tokenInfo.symbol || 'UNKNWN';
        console.log(`[🟢 PASSED] Verified Safe Token: ${symbol}. Sending Alert.`);

        const alertMessage = `
<b>🛡️ VERIFIED SECURE LAUNCH</b>
────────────────────────
• <b>Asset:</b> ${tokenInfo.name || 'Unknown'} (${symbol})
• <b>Contract:</b> <code>${tokenMint}</code>
────────────────────────
▶ <b>SECURITY AUDIT METRICS</b>
• <b>Dev Rug Rate:</b> <code>${rugRate.toFixed(0)}%</code> (${rugCount}/${totalCreated} Rugged)
• <b>Mint Authority:</b> Renounced ✅
• <b>Freeze Authority:</b> Renounced ✅
• <b>Top 10 Supply Rate:</b> <code>${top10Rate.toFixed(1)}%</code> (Max 80%)
• <b>Dev Allocation:</b> <code>${devShare.toFixed(1)}%</code> (Max 25%)
────────────────────────
▶ <b>SECURE ACTION HUB</b>
• <a href="https://gmgn.ai/sol/token/${tokenMint}">📊 GMGN Safety Terminal</a>
• <a href="https://t.me/solana_trojanbot?start=r-cryptonigh-${tokenMint}">⚔️ Trade Instant (Trojan Bot)</a>
`;

        for (const chatId of CHAT_IDS) {
          if (!chatId) continue;
          try {
            await bot.telegram.sendMessage(chatId, alertMessage, { parse_mode: 'HTML', disable_web_page_preview: true });
          } catch (err) {}
        }
      }, 12000);
    }
  } catch (err) {}
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`⚙️ [SYSTEM RUNNING] Universal Security Scanner online on Port ${PORT}`);
});