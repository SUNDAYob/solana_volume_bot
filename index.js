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
  res.status(200).send('Solana Tracker Core V5 Optimized: Online\n');
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

      console.log(`🎯 [POOL SEEN] Ingesting token: ${tokenMint}`);

      // Safe isolated async processing background worker
      (async () => {
        try {
          // Wait 45 seconds to give external databases a fair setup window
          await delay(45000);

          let marketData = null;
          let report = null;
          let devAddress = "Unknown Deployer";
          let volume24h = "Pending Check";
          let whaleCount = 0;

          // --- STEP 1: READ AUDIT REPORT VIA RUGCHECK ---
          try {
            const rcConfig = process.env.RUGCHECK_JWT ? {
              headers: { 'Authorization': `Bearer ${process.env.RUGCHECK_JWT}` },
              timeout: 6000
            } : { timeout: 6000 };
            
            const rcRes = await axios.get(`https://api.rugcheck.xyz/v1/tokens/${tokenMint}/report`, rcConfig);
            if (rcRes.data) report = rcRes.data;
          } catch (rcErr) {
            console.log(`ℹ️ Rugcheck 404/Timeout skipped for ${tokenMint.substring(0,6)}`);
          }

          // --- STEP 2: CONSERVATIVE SINGLE-CALL MARKET EXTRACTION ---
          if (process.env.SOLANA_TRACKER_API_KEY) {
            try {
              const trackerRes = await axios.get(`https://api.solanatracker.io/tokens/${tokenMint}`, {
                headers: { 'x-api-key': process.env.SOLANA_TRACKER_API_KEY },
                timeout: 5000
              });
              if (trackerRes.data) {
                marketData = trackerRes.data;
                volume24h = marketData.pools?.[0]?.volume?.h24 ? `$${Number(marketData.pools[0].volume.h24).toLocaleString()}` : "$0";
                whaleCount = marketData.events?.whales?.length || 0;
                if (marketData.creator) devAddress = marketData.creator;
              }
            } catch (e) {
              console.log(`ℹ️ Solana Tracker unindexed (404) for ${tokenMint.substring(0,6)} - Dispatching with fallback metadata.`);
            }
          }

          let devReputationString = "New Dev Profile 👤";
          
          // --- STEP 3: OPTIONAL WALLET HISTORY CHECK ---
          if (marketData && marketData.creator && process.env.SOLANA_TRACKER_API_KEY) {
            try {
              const devHistoryRes = await axios.get(`https://api.solanatracker.io/wallets/${devAddress}/history`, {
                headers: { 'x-api-key': process.env.SOLANA_TRACKER_API_KEY },
                timeout: 5000
              });
              if (devHistoryRes.data && devHistoryRes.data.summary) {
                const summary = devHistoryRes.data.summary;
                const totalTokens = summary.totalTokensTraded || 0;
                const totalWins = summary.totalWins || 0; 
                if (totalTokens > 0) {
                  const winRate = Math.round((totalWins / totalTokens) * 100);
                  devReputationString = winRate >= 60 
                    ? `Dev 60%+ Good Track Record 📈 (${winRate}% Wins)` 
                    : `Low Historical Track Record ⚠️ (${winRate}% Win-Rate)`;
                }
              }
            } catch (err) {}
          }

          let hasLockedLiquidity = false;
          let canMintMore = false;

          if (report) {
            hasLockedLiquidity = report.markets?.some(m => m.lpLocked === true || m.lpPercent === 100) || false;
            canMintMore = report.risks?.some(r => r.name?.toLowerCase().includes('mint authority') || r.name?.toLowerCase().includes('mintable')) || false;
          }

          // --- STEP 4: TELEGRAM PACKAGING ---
          const trojanTradeLink = `https://t.me/solana_trojanbot?start=r-obstech-${tokenMint}`;
          const dexScreenerLink = `https://dexscreener.com/solana/${tokenMint}`;

          const telegramAlert = `
💎 <b>POOL METRICS DISCOVERED</b> 💎
────────────────────────
▶ <b>BLOCK METADATA</b>
• <b>Token Contract:</b> <code>${tokenMint}</code>
• <b>Dev Wallet:</b> <code>${devAddress}</code>
────────────────────────
▶ <b>🛡️ AUDIT STATUS</b>
• <b>Liquidity Pool:</b> ${hasLockedLiquidity ? 'Locked 🔒' : 'Active Trading 📊'}
• <b>Mint Status:</b> ${canMintMore ? 'Warning (Mintable) ⚠️' : 'Renounced 🚫🖨️'}
• <b>Dev Reputation:</b> <b>${devReputationString}</b>
────────────────────────
▶ <b>📊 LIVE MARKET METRICS</b>
• <b>Current Volume Velocity:</b> ${volume24h}
• <b>Early Whales Tracked:</b> ${whaleCount} 🔥
────────────────────────
▶ <b>LIGHTNING TRADE EXECUTION</b>
• <a href="${dexScreenerLink}">DexScreener Market Chart</a>
• <a href="${trojanTradeLink}">⚔️ Instant Buy Entry via Trojan Bot</a>
────────────────────────
`;

          for (const chatId of CHAT_IDS) {
            if (!chatId) continue;
            try {
              await bot.telegram.sendMessage(chatId, telegramAlert, { 
                parse_mode: 'HTML',
                disable_web_page_preview: true 
              });
            } catch (tgErr) {
              console.log(`❌ Telegram Send Failure: ${tgErr.message}`);
            }
          }
        } catch (innerError) {
          console.log(`❌ Core background worker error: ${innerError.message}`);
        }
      })();
    }
  } catch (error) {
    console.log(`Core stream parsing error: ${error.message}`);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Express Core Engine Listening on Port ${PORT}`);
});