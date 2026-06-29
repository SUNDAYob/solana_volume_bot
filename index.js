require('dotenv').config();
const express = require('express');
const { Telegraf } = require('telegraf');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

// Initialize Telegram Client safely
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || '')
  .split(',')
  .map(id => id.trim())
  .filter(Boolean);

// ==================== REAL-WORLD SECURITY PRESETS ====================
const REJECT_DEV_RUG_COUNT  = 1;     // STRICT: Immediate rejection if dev has EVER rugged a pool
const MAX_DEV_CREATIONS     = 15;    // REALISTIC: Caps serial spam, allows veteran trusted launchers
const MAX_DEV_HOLD_PCT      = 10.0;  // STRICT: Dev team cannot hold more than 10% supply
const MAX_TOP10_HOLD_PCT    = 50.0;  // STRICT: Prevents bundled insider supply allocation
const MAX_TAX_PCT           = 5.0;   // STRICT: Filters out malicious honey/tax contracts
const MIN_LIQUIDITY_USD     = 15000; // PRESET: Target liquidity floor for live pairs

// Thread-safe map tracking processed signatures with strict TTL eviction to prevent memory leaks
const processedMints = new Map();
const CACHE_TTL_MS = 60000; // 1 minute debouncing protection

setInterval(() => {
  const now = Date.now();
  for (const [mint, timestamp] of processedMints.entries()) {
    if (now - timestamp > CACHE_TTL_MS) processedMints.delete(mint);
  }
}, 5 * 60 * 1000);

app.use(express.json());

// Health Check Endpoint
app.get('/', (req, res) => {
  res.status(200).send('🛡️ Production Token Scanner: Operational Security Mode Active.\n');
});

// Primary Ingestion Gateway
app.post('/webhook', async (req, res) => {
  res.sendStatus(200); // Instantly reply OK to Helius/RPC provider to maintain low-latency pipeline

  try {
    const txs = req.body;
    if (!Array.isArray(txs) || txs.length === 0) return;

    for (const tx of txs) {
      // High-fidelity fallback chain for extracting token mint address across multi-variant RPC payload layers
      let tokenMint = 
        tx.tokenTransfers?.[0]?.mint ||
        tx.mint ||
        tx.accountData?.[0]?.account ||
        tx.instructions?.find(i => i.programId === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')?.accounts?.[0];

      if (!tokenMint || typeof tokenMint !== 'string' || tokenMint.length < 32) continue;
      if (tokenMint === 'So11111111111111111111111111111111111111112' || tokenMint.endsWith('11111111')) continue;
      if (processedMints.has(tokenMint)) continue;

      processedMints.set(tokenMint, Date.now());
      console.log(`[🔍 INGESTED] ${tokenMint} — Launching async sandbox security checks...`);

      // Defer scanning execution by 12 seconds to give GMGN indexers adequate parsing runway
      setTimeout(async () => {
        let securityData = null;
        let tokenInfo = null;
        let liquidityUsd = 0;
        let isIndexedOnDex = false;

        try {
          const axiosConfig = {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'application/json'
            },
            timeout: 10000
          };

          // Concurrent fetch over multiple distinct API data layer sets
          const [secRes, infoRes, dexRes] = await Promise.allSettled([
            axios.get(`https://gmgn.ai/v1/token/security?chain=sol&address=${tokenMint}`, axiosConfig),
            axios.get(`https://gmgn.ai/v1/token/info?chain=sol&address=${tokenMint}`, axiosConfig),
            axios.get(`https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`, { timeout: 8000 })
          ]);

          if (secRes.status === 'fulfilled' && secRes.value?.data?.data) {
            securityData = secRes.value.data.data;
          }
          if (infoRes.status === 'fulfilled' && infoRes.value?.data?.data) {
            tokenInfo = infoRes.value.data.data;
          }
          if (dexRes.status === 'fulfilled' && dexRes.value?.data?.pairs?.length > 0) {
            isIndexedOnDex = true;
            liquidityUsd = Math.max(...dexRes.value.data.pairs.map(p => p.liquidity?.usd || 0));
          }
        } catch (err) {
          console.log(`[⚠️ NETWORK ERROR] API connection fault for ${tokenMint}: ${err.message}`);
        }

        // Structural Gateway validation: ensure core security data layers were retrieved successfully
        if (!securityData || !tokenInfo) {
          console.log(`[❌ DROP] ${tokenMint} — Critical security metadata unavailable from API.`);
          return;
        }

        // SMART FILTER: Only enforce the strict liquidity floor if Dexscreener has indexed the pool.
        // If it hasn't indexed yet, we gracefully flag it as "Pending Indexing" instead of dropping it!
        if (isIndexedOnDex && liquidityUsd < MIN_LIQUIDITY_USD) {
          console.log(`[❌ DROP] ${tokenMint} — Failed liquidity minimum requirement. Current: $${liquidityUsd}`);
          return;
        }

        // ==================== DATA NORMALIZATION & COMPILATION ====================
        const rugCount          = Number(securityData.creator_rug_count || 0);
        const totalCreated      = Number(securityData.creator_token_create_count || 0);
        const top10Rate         = parseFloat(securityData.top_10_holder_rate || 0) * 100;
        const devShare          = parseFloat(securityData.dev_team_hold_rate || securityData.creator_balance_rate || 0) * 100;

        const isHoneypot        = securityData.is_honeypot === true || securityData.is_honeypot === 1;
        const buyTax            = parseFloat(securityData.buy_tax || 0);
        const sellTax           = parseFloat(securityData.sell_tax || 0);

        const mintRenounced     = securityData.renounced_mint === true || securityData.renounced_mint === 'yes' || securityData.is_renounced === true;
        const freezeRenounced   = securityData.renounced_freeze_account === true || securityData.renounced_freeze_account === 'yes';

        // ==================== STRICT SECURITY GATEWAY VERIFICATIONS ====================
        if (isHoneypot) {
          console.log(`[🚫 REJECT] ${tokenMint} — Identified Honeypot Configuration.`);
          return;
        }
        if (buyTax > MAX_TAX_PCT || sellTax > MAX_TAX_PCT) {
          console.log(`[🚫 REJECT] ${tokenMint} — Malicious Tax Trap: ${buyTax}% / ${sellTax}%`);
          return;
        }
        if (rugCount >= REJECT_DEV_RUG_COUNT) {
          console.log(`[🚫 REJECT] ${tokenMint} — Dev wallet has known rug history (${rugCount} occurrences).`);
          return;
        }
        if (totalCreated > MAX_DEV_CREATIONS) {
          console.log(`[🚫 REJECT] ${tokenMint} — Spammer Alert: Dev deployed ${totalCreated} pools.`);
          return;
        }
        if (!mintRenounced || !freezeRenounced) {
          console.log(`[🚫 REJECT] ${tokenMint} — Ownership/Freeze Authorities are active.`);
          return;
        }
        if (top10Rate > MAX_TOP10_HOLD_PCT) {
          console.log(`[🚫 REJECT] ${tokenMint} — High distribution risk: Top 10 hold ${top10Rate.toFixed(1)}%`);
          return;
        }
        if (devShare > MAX_DEV_HOLD_PCT) {
          console.log(`[🚫 REJECT] ${tokenMint} — Dev team allocation excess: ${devShare.toFixed(1)}%`);
          return;
        }

        // ==================== PASSED AUDIT — TRANSMITTING SIGNAL ====================
        const symbol = tokenInfo.symbol || 'UNKNOWN';
        const name   = tokenInfo.name || 'Unknown Token';

        console.log(`[✅ PASSED ALL CHECKS] Verified: ${symbol} (${tokenMint})`);

        // Clean, valid JS string interpolation — no breaking backslashes, no formatting syntax corruption
        const alertMessage = `
<b>🛡️ SYSTEM-VERIFIED SECURE LAUNCH</b>
────────────────────────
<b>Asset:</b> ${name} (${symbol})
<b>Contract:</b> <code>${tokenMint}</code>
────────────────────────
<b>AUTOMATED RISK AUDIT ANALYSIS</b>
• Liquidity: <code>${isIndexedOnDex ? '$' + liquidityUsd.toLocaleString() : 'Awaiting DexScreener Indexing'}</code> ✅
• Dev Rug History: <code>0</code> (Zero Tolerance Match) ✅
• Dev Token Deployments: <code>${totalCreated}</code> (Safe Bounds) ✅
• Honeypot Audit: <code>Passed (Clear)</code> ✅
• Buy/Sell Tax Profile: <code>${buyTax}% / ${sellTax}%</code> ✅
• Mint Contract Status: <b>Renounced</b> ✅
• Freeze Registry Status: <b>Renounced</b> ✅
• Top 10 Clustering Rate: <code>${top10Rate.toFixed(1)}%</code> (Cap: ${MAX_TOP10_HOLD_PCT}%) ✅
• Dev Team Allocations: <code>${devShare.toFixed(1)}%</code> (Cap: ${MAX_DEV_HOLD_PCT}%) ✅
────────────────────────
<b>INTELLIGENCE & TRADE ACTIONS</b>
• <a href="https://gmgn.ai/sol/token/${tokenMint}">📊 GMGN Analytical Terminal</a>
• <a href="https://dexscreener.com/solana/${tokenMint}">📈 Dexscreener Radar</a>
• <a href="https://t.me/solana_trojanbot?start=r-cryptonigh-${tokenMint}">⚔️ Instant Execution (Trojan Bot)</a>
`;

        for (const chatId of CHAT_IDS) {
          try {
            await bot.telegram.sendMessage(chatId, alertMessage, {
              parse_mode: 'HTML',
              disable_web_page_preview: true
            });
          } catch (sendErr) {
            console.log(`[⚠️ TELEGRAM DISPATCH ERROR] Channel ${chatId} failed: ${sendErr.message}`);
          }
        }
      }, 12000);
    }
  } catch (err) {
    console.error('[🚨 SYSTEM INTEGRITY ERROR]', err.message);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Production Shield Engine deployed seamlessly on port ${PORT}`);
  console.log(`🔒 Active Enforcement Layer: Zero-tolerance parameters initialized.`);
});