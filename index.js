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
  res.status(200).send('Solana Tracker Pre-Pump Engine V9: Online\n');
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
      setTimeout(() => recentMints.delete(tokenMint), 120000); // 2 min deduplication

      // Background worker to monitor volume buildup
      (async () => {
        try {
          // ⏳ Give the pool 45 seconds to establish initial buying momentum
          await delay(45000);

          let marketData = null;
          let report = null;

          // --- STEP 1: SOLANA TRACKER BREAKOUT VERIFICATION ---
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
            return; // Silently filter out unindexed assets
          }

          if (!marketData) return;

          const volume24h = marketData.pools?.[0]?.volume?.h24 || 0;
          const liquidityUsd = marketData.pools?.[0]?.liquidity?.usd || 0;
          const whaleCount = marketData.events?.whales?.length || 0;

          // 🎯 PRE-PUMP TARGET RANGE FILTERS
          // Must have at least $500 to show signs of life, but less than $3,500 so you get in early!
          if (Number(volume24h) < 500 || Number(volume24h) > 3500) return;

          // Ensure it has stable initial liquidity backing
          if (Number(liquidityUsd) < 1500) return;

          // Ensure smart money or early snipers are backing the trades
          if (whaleCount < 1) return;

          // --- STEP 2: RUGCHECK HIGH-SPEED AUDIT ---
          try {
            const rcConfig = process.env.RUGCHECK_JWT ? {
              headers: { 'Authorization': `Bearer ${process.env.RUGCHECK_JWT}` },
              timeout: 6000
            } : { timeout: 6000 };
            
            const rcRes = await axios.get(`https://api.rugcheck.xyz/v1/tokens/${tokenMint}/report`, rcConfig);
            if (rcRes.data) report = rcRes.data;
          } catch (rcErr) {
            return; // Drop if security audit can't verify safety
          }

          if (!report) return;

          const hasLockedLiquidity = report.markets?.some(m => m.lpLocked === true || m.lpPercent === 100) || false;
          const canMintMore = report.risks?.some(r => r.name?.toLowerCase().includes('mint authority') || r.name?.toLowerCase().includes('mintable')) || false;
          
          if (canMintMore) return; // Drop unsafe honeypots instantly

          const devAddress = marketData.creator || "Unknown";
          const trojanTradeLink = `https://t.me/solana_trojanbot?start=r-obstech-${tokenMint}`;
          const dexScreenerLink = `https://dexscreener.com/solana/${tokenMint}`;

          // --- STEP 3: DISPATCH ROCKET EMBED SIGNALS ---
          const telegramAlert = `
🚨 <b>EARLY MOMENTUM SIGNAL</b> 🚨
────────────────────────
▶ <b>TOKEN ID</b>
• <b>Mint Contract:</b> <code>${tokenMint}</code>
────────────────────────
▶ <b>📈 BREAKOUT METRICS (SUB-3K VOLUME)</b>
• <b>Current Entry Volume:</b> <code>$${Number(volume24h).toLocaleString()}</code> 🚀
• <b>Initial Pool Liquidity:</b> <code>$${Number(liquidityUsd).toLocaleString()}</code>
• <b>Early Whales Injected:</b> <b>${whaleCount} Tracked</b> 🔥
────────────────────────
▶ <b>🛡️ SAFETY PARAMETERS</b>
• <b>LP Status:</b> ${hasLockedLiquidity ? 'Locked 🔒' : 'Active Setup 📊'}
• <b>Mint Authority:</b> Renounced 🚫
────────────────────────
▶ <b>⚔️ SPEED ENTRY LINKS</b>
• <a href="${dexScreenerLink}">DexScreener Live Entry Chart</a>
• <a href="${trojanTradeLink}">⚔️ Snag Entry via Trojan Sniper Bot</a>
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

app.use((err, req, res, next) => {
  res.status(500).send('Engine Fault Handler');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Pre-Pump Breakout Core Listening on Port ${PORT}`);
});