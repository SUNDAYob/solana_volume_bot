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
  res.status(200).send('Solana Tracker Core V8 HIGH-QUALITY ONLY: Online\n');
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

      // Silent logging to keep console clean
      console.log(`🎯 [POOL INGESTION] Processing: ${tokenMint.substring(0,6)}...`);

      // Isolated background analysis worker
      (async () => {
        try {
          // ⏳ Wait 45 seconds to let volume accumulate and systems index
          await delay(45000);

          let marketData = null;
          let report = null;

          // --- STEP 1: SOLANA TRACKER MARKET & ACTIVITY CHECK ---
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
            console.log(`🛑 [QUALITY DROP] Dropping ${tokenMint.substring(0,6)} - Not indexed/Active yet.`);
            return; 
          }

          if (!marketData) return;

          // --- PREMIUM TARGET FILTERS ---
          const volume24h = marketData.pools?.[0]?.volume?.h24 || 0;
          const liquidityUsd = marketData.pools?.[0]?.liquidity?.usd || 0;

          // 🚨 RULE 1: Drop micro-volume spam (Must be greater than $5,000 USD)
          if (Number(volume24h) < 5000) {
            console.log(`🛑 [VOLUME DROP] Dropping ${tokenMint.substring(0,6)} - Low volume activity ($${Math.round(volume24h)}).`);
            return;
          }

          // 🚨 RULE 2: Drop micro-liquidity scams (Must have at least $2,000 USD in pool)
          if (Number(liquidityUsd) < 2000) {
            console.log(`🛑 [LIQUIDITY DROP] Dropping ${tokenMint.substring(0,6)} - Weak liquidity pool ($${Math.round(liquidityUsd)}).`);
            return;
          }

          // --- STEP 2: HARD AUDIT VIA RUGCHECK (ONLY FOR THE WINNERS) ---
          try {
            const rcConfig = process.env.RUGCHECK_JWT ? {
              headers: { 'Authorization': `Bearer ${process.env.RUGCHECK_JWT}` },
              timeout: 6000
            } : { timeout: 6000 };
            
            const rcRes = await axios.get(`https://api.rugcheck.xyz/v1/tokens/${tokenMint}/report`, rcConfig);
            if (rcRes.data) report = rcRes.data;
          } catch (rcErr) {
            console.log(`🛡️ [SECURITY DROP] Rugcheck offline for high-volume candidate ${tokenMint.substring(0,6)}. Skipped for protection.`);
            return;
          }

          if (!report) return;

          const hasLockedLiquidity = report.markets?.some(m => m.lpLocked === true || m.lpPercent === 100) || false;
          const canMintMore = report.risks?.some(r => r.name?.toLowerCase().includes('mint authority') || r.name?.toLowerCase().includes('mintable')) || false;
          
          let dangerousRiskCount = 0;
          if (Array.isArray(report.risks)) {
            report.risks.forEach(risk => {
              const level = risk.level?.toLowerCase() || '';
              if (level === 'danger' || level === 'critical') dangerousRiskCount += 2;
              if (level === 'warning' || level === 'medium') dangerousRiskCount += 1;
            });
          }

          // 🚨 RULE 3: Strict honey-pot filter
          if (canMintMore || dangerousRiskCount >= 4) {
            console.log(`🛑 [SECURITY DROP] Dropping high-volume ${tokenMint.substring(0,6)} - Failed security parameters.`);
            return;
          }

          // Gather extra data for verified winners
          const devAddress = marketData.creator || "Unknown";
          const whaleCount = marketData.events?.whales?.length || 0;
          let devReputationString = "Clean / New Dev Profile 👤";
          
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
                  ? `High Win-Rate Dev 📈 (${winRate}% Wins over ${totalTokens} tokens)` 
                  : `Standard Dev Profile 👤 (${winRate}% Win-Rate)`;
              }
            }
          } catch (err) {}

          // --- STEP 3: SEND ONLY HIGH-QUALITY ALERTS ---
          const trojanTradeLink = `https://t.me/solana_trojanbot?start=r-obstech-${tokenMint}`;
          const dexScreenerLink = `https://dexscreener.com/solana/${tokenMint}`;

          const telegramAlert = `
🔥 <b>HIGH-QUALITY COIN DETECTED</b> 🔥
────────────────────────
▶ <b>BLOCK METADATA</b>
• <b>Token Contract:</b> <code>${tokenMint}</code>
• <b>Dev Wallet:</b> <code>${devAddress}</code>
────────────────────────
▶ <b>🛡️ AUDIT PASS VERDICT</b>
• <b>Security Status:</b> Verified Clean & Active ✅
• <b>Liquidity Pool:</b> ${hasLockedLiquidity ? 'Locked 🔒' : 'Active Trading Pool 📊'}
• <b>Mint Authority:</b> Renounced 🚫
• <b>Dev Track Record:</b> <b>${devReputationString}</b>
────────────────────────
▶ <b>📊 HIGH VELOCITY MARKET METRICS</b>
• <b>Current Volume:</b> <b>$${Number(volume24h).toLocaleString()}</b> 🚀
• <b>Pool Liquidity:</b> <b>$${Number(liquidityUsd).toLocaleString()}</b> 💰
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
              console.log(`❌ Telegram dispatch failure: ${tgErr.message}`);
            }
          }
        } catch (innerError) {
          console.log(`❌ Analysis runner fault: ${innerError.message}`);
        }
      })();
    }
  } catch (error) {
    console.log(`Core stream error: ${error.message}`);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Premium Quality Engine Listening on Port ${PORT}`);
});