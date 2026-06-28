require('dotenv').config();
const express = require('express');
const { Telegraf } = require('telegraf');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || '').split(',').map(id => id.trim());

// Elite Cache Engine to handle high-frequency transaction data
const processedMints = new Map();
const CLEANUP_INTERVAL = 5 * 60 * 1000; 

setInterval(() => {
  const now = Date.now();
  for (const [mint, timestamp] of processedMints.entries()) {
    if (now - timestamp > 60000) processedMints.delete(mint);
  }
}, CLEANUP_INTERVAL);

app.use(express.json());

app.get('/', (req, res) => res.status(200).send('🛡️ Volume Alpha Guard Active\n'));

app.post('/webhook', async (req, res) => {
  res.sendStatus(200); // Instantly free up the Helius webhook pipe

  try {
    const txs = req.body;
    if (!Array.isArray(txs) || txs.length === 0) return;

    for (const tx of txs) {
      const isNewLaunch = tx.instructions?.some(inst => inst.suggestedInstructionName === 'create');
      const isMigration = tx.type === 'CREATE_POOL' || 
                          tx.instructions?.some(inst => inst.programId === '6EF83uUk4936n7RWdqCw1LKUUY56CgdYSL5LWWTZ96K2');
      
      if (!isNewLaunch && !isMigration) continue;

      // ⚡ INSANE LIQUIDITY GATEWAY MULTIPLIER
      // Calculates real SOL changing hands inside the initialization payload
      const poolSolVolume = tx.tokenTransfers?.reduce((acc, tf) => {
        if (tf.mint === 'So11111111111111111111111111111111111111112') {
          return acc + (Number(tf.tokenAmount) || 0);
        }
        return acc;
      }, 0) || 0;

      // Drop completely useless low-cap tokens right here (Adjust threshold as you like)
      if (isMigration && poolSolVolume < 15) {
        console.log(`[💨 Trash Filter] Dropping low-liquidity pool launch (${poolSolVolume.toFixed(1)} SOL)`);
        continue;
      }

      const tokenMint = tx.tokenTransfers?.[0]?.mint || tx.instructions?.[0]?.accounts?.[0];
      if (!tokenMint || tokenMint.length < 32 || processedMints.has(tokenMint)) continue;

      processedMints.set(tokenMint, Date.now());
      const waitTime = isMigration ? 12000 : 40000; 

      console.log(`[📡 TARGET CAPTURED] Analysis queued for candidate: ${tokenMint}`);

      (async () => {
        await new Promise(resolve => setTimeout(resolve, waitTime));

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
          console.log(`[⚠️ SKIP] Data layers incomplete for: ${tokenMint}`);
          return;
        }

        // Parse key data targets
        const rugCount = Number(securityData.creator_rug_count || 0);
        const top10Rate = parseFloat(securityData.top_10_holder_rate || 0) * 100;
        const devShare = parseFloat(securityData.dev_team_hold_rate || securityData.creator_balance_rate || 0) * 100;
        
        // Uncompromising Solana Hard-Locks
        const mintRenounced = securityData.renounced_mint === true || securityData.renounced_mint === 'yes';
        const freezeRenounced = securityData.renounced_freeze_account === true || securityData.renounced_freeze_account === 'yes';

        // 🛡️ THE RUG RESTRICTION PROTOCOL
        if (rugCount > 0) return; // Malicious creator
        if (!mintRenounced || !freezeRenounced) return; // Honeypot backdoor risk
        if (top10Rate > 65 || devShare > 15) return; // Heavy centralization or dev dumps

        const symbol = tokenInfo.symbol || 'UNKNWN';
        console.log(`[🟢 SUCCESS] ${symbol} passed all custom filters! Sending alert...`);

        const alertMessage = `
<b>🔥 VERIFIED QUALITY INSIDER LAUNCH</b>
────────────────────────
• <b>Asset:</b> ${tokenInfo.name || 'Unknown'} (${symbol})
• <b>Contract:</b> <code>${tokenMint}</code>
────────────────────────
▶ <b>QUANT FILTER ANALYTICS</b>
• <b>Pool Initial SOL:</b> <code>${poolSolVolume > 0 ? poolSolVolume.toFixed(1) + ' SOL' : 'Checked Launch'}</code>
• <b>Mint / Freeze:</b> Renounced (Safe) ✅
• <b>Top 10 Supply:</b> <code>${top10Rate.toFixed(1)}%</code>
• <b>Dev Position:</b> <code>${devShare.toFixed(1)}%</code>
────────────────────────
▶ <b>TRADING INTERFACES</b>
• <a href="https://gmgn.ai/sol/token/${tokenMint}">📊 GMGN Professional Terminal</a>
• <a href="https://t.me/solana_trojanbot?start=r-cryptonigh-${tokenMint}">⚡ Swift Execution via Trojan Bot</a>
`;

        for (const chatId of CHAT_IDS) {
          if (!chatId) continue;
          try {
            await bot.telegram.sendMessage(chatId, alertMessage, { parse_mode: 'HTML', disable_web_page_preview: true });
          } catch (err) {}
        }
      })();
    }
  } catch (err) {}
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`⚙️ [SYSTEM ACTIVE] Volume Filter Tracker online on Port ${PORT}`);
});