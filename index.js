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
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.status(200).send('Solana Pre-Pump Sniper V10: Active\n');
});

app.post('/helius-stream', async (req, res) => {
  res.status(200).send('OK');

  try {
    const transactions = req.body;
    if (!Array.isArray(transactions)) return;

    for (const tx of transactions) {
      let tokenMint = null;
      const tokenTransfers = tx.tokenTransfers || [];
      if (tokenTransfers.length > 0 && tokenTransfers[0].tokenMint) {
        tokenMint = tokenTransfers[0].tokenMint;
      }

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

      if (!tokenMint || typeof tokenMint !== 'string') continue;
      tokenMint = tokenMint.trim();
      if (tokenMint.includes('11111111111111111111111111111111') || tokenMint.length < 32) continue;

      if (recentMints.has(tokenMint)) continue;
      recentMints.add(tokenMint);
      setTimeout(() => recentMints.delete(tokenMint), 120000);

      console.log(`🔍 [INGESTED] Evaluating block entry for token: ${tokenMint.substring(0, 6)}...`);

      (async () => {
        try {
          // Wait 35 seconds (slightly faster to catch the pump early)
          await delay(35000);

          let marketData = null;
          let report = null;

          if (!process.env.SOLANA_TRACKER_API_KEY) return;
          
          try {
            const trackerRes = await axios.get(`https://api.solanatracker.io/tokens/${tokenMint}`, {
              headers: { 'x-api-key': process.env.SOLANA_TRACKER_API_KEY },
              timeout: 5000
            });
            if (trackerRes.data && trackerRes.data.pools && trackerRes.data.pools.length > 0) {
              marketData = trackerRes.data;
            }
          } catch (e) {
            console.log(`   ↳ ❌ Unindexed on Tracker yet: ${tokenMint.substring(0, 6)}`);
            return; 
          }

          if (!marketData) return;

          const volume24h = marketData.pools?.[0]?.volume?.h24 || 0;
          const liquidityUsd = marketData.pools?.[0]?.liquidity?.usd || 0;

          // 🚨 PRE-PUMP TARGET RANGE: $300 to $5,000 volume
          if (Number(volume24h) < 300) {
            console.log(`   ↳ 💤 Volume too low ($${Math.round(volume24h)}): ${tokenMint.substring(0, 6)}`);
            return;
          }
          if (Number(volume24h) > 5000) {
            console.log(`   ↳ 📈 Already pumped past target ($${Math.round(volume24h)}): ${tokenMint.substring(0, 6)}`);
            return;
          }
          if (Number(liquidityUsd) < 1000) {
            console.log(`   ↳ 📉 Dangerous low liquidity ($${Math.round(liquidityUsd)}): ${tokenMint.substring(0, 6)}`);
            return;
          }

          // --- HIGH SPEED RUGCHECK SCAN ---
          try {
            const rcConfig = process.env.RUGCHECK_JWT ? {
              headers: { 'Authorization': `Bearer ${process.env.RUGCHECK_JWT}` },
              timeout: 6000
            } : { timeout: 6000 };
            
            const rcRes = await axios.get(`https://api.rugcheck.xyz/v1/tokens/${tokenMint}/report`, rcConfig);
            if (rcRes.data) report = rcRes.data;
          } catch (rcErr) {
            return;
          }

          if (!report) return;

          const hasLockedLiquidity = report.markets?.some(m => m.lpLocked === true || m.lpPercent === 100) || false;
          const canMintMore = report.risks?.some(r => r.name?.toLowerCase().includes('mint authority') || r.name?.toLowerCase().includes('mintable')) || false;
          
          if (canMintMore) {
            console.log(`   ↳ 🛑 Honeypot Warning (Mintable): ${tokenMint.substring(0, 6)}`);
            return;
          }

          console.log(`🚀 [🔥 PRE-PUMP MATCH] Sending Token to Telegram: ${tokenMint.substring(0, 6)}`);

          const devAddress = marketData.creator || "Unknown";
          const trojanTradeLink = `https://t.me/solana_trojanbot?start=r-obstech-${tokenMint}`;
          const dexScreenerLink = `https://dexscreener.com/solana/${tokenMint}`;

          const telegramAlert = `
🚨 <b>PRE-PUMP BREAKOUT SIGNAL</b> 🚨
────────────────────────
▶ <b>TOKEN METADATA</b>
• <b>Mint Contract:</b> <code>${tokenMint}</code>
────────────────────────
▶ <b>📈 EARLY VOLOCITY DETECTED</b>
• <b>Current Entry Volume:</b> <code>$${Number(volume24h).toLocaleString()}</code> 🚀
• <b>Pool Liquidity Available:</b> <code>$${Number(liquidityUsd).toLocaleString()}</code>
────────────────────────
▶ <b>🛡️ SAFETY SCREENING</b>
• <b>LP Status:</b> ${hasLockedLiquidity ? 'Locked 🔒' : 'Active Initial Pool 📊'}
• <b>Mint Status:</b> Renounced (Safe) 🚫
────────────────────────
▶ <b>⚔️ HIGH-SPEED ENTRY LINKS</b>
• <a href="${dexScreenerLink}">DexScreener Entry Chart</a>
• <a href="${trojanTradeLink}">⚔️ Buy via Trojan Sniper Bot</a>
────────────────────────
`;

          for (const chatId of CHAT_IDS) {
            if (!chatId) continue;
            try {
              await bot.telegram.sendMessage(chatId, telegramAlert, { 
                parse_mode: 'HTML',
                disable_web_page_preview: true 
              });
            } catch (tgErr) {}
          }
        } catch (innerError) {}
      })();
    }
  } catch (error) {}
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Pre-Pump Sniper Core Live on Port ${PORT}`);
});