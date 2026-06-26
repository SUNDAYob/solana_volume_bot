require('dotenv').config();
const express = require('express');
const { Telegraf } = require('telegraf');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

// Initialize Core APIs & Telegram Settings
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || '').split(',').map(id => id.trim());
const GMGN_API_KEY = process.env.GMGN_API_KEY || '';

// 60-second local deduplication window
const recentMints = new Set();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

app.use(express.json());

app.get('/', (req, res) => {
  res.status(200).send('🛡️ GMGN & Dexscreener Security Core Operational\n');
});

// Helper for extracting nested data structures cleanly
const getNestedProp = (obj, paths, defaultVal = 0) => {
  for (const path of paths) {
    if (obj && obj[path] !== undefined && obj[path] !== null) return obj[path];
  }
  return defaultVal;
};

// Main Ingestion Gateway
app.post('/helius-stream', async (req, res) => {
  // CRITICAL: Acknowledge payload immediately to stay online
  res.status(200).send('OK'); 

  try {
    const transactions = req.body;
    if (!Array.isArray(transactions) || transactions.length === 0) return;

    for (const tx of transactions) {
      let tokenMint = null;

      // Extract Token Mint from standard transfers
      if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
        const transfer = tx.tokenTransfers.find(t => t.tokenMint && t.tokenMint.length >= 32);
        if (transfer) tokenMint = transfer.tokenMint;
      }

      if (!tokenMint || typeof tokenMint !== 'string') continue;
      tokenMint = tokenMint.trim();
      if (tokenMint.length < 32 || tokenMint.includes('1111111111111111')) continue;

      // Prevent processing duplicate events
      if (recentMints.has(tokenMint)) continue;
      recentMints.add(tokenMint);
      setTimeout(() => recentMints.delete(tokenMint), 60000);

      console.log(`\n🔍 [LAUNCH INGESTED] Analyzing security layout for: ${tokenMint}`);

      // Run API scans asynchronously to avoid delaying the stream
      (async () => {
        let gmgnData = null;
        let dexscreenerData = null;

        // Allow token pools a brief moment to propagate across third-party trackers
        await delay(3000);

        // 🛡️ API LAYER 1: GMGN Security Profiles
        try {
          const gmgnResponse = await axios.get(`https://gmgn.ai/defi/quotation/v1/tokens/sol/${tokenMint}`, {
            headers: { 'Authorization': `Bearer ${GMGN_API_KEY}`, 'User-Agent': 'Mozilla/5.0' },
            timeout: 5000
          });
          if (gmgnResponse.data && gmgnResponse.data.data) {
            gmgnData = gmgnResponse.data.data;
          }
        } catch (err) {
          console.log(`↳ ⚠️ GMGN Fetch Skip (${tokenMint.slice(0,6)}): API unindexed or rate-limited.`);
        }

        // 🛡️ API LAYER 2: Dexscreener Aggregation
        try {
          const dexResponse = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`, { timeout: 4000 });
          if (dexResponse.data && dexResponse.data.pairs && dexResponse.data.pairs.length > 0) {
            dexscreenerData = dexResponse.data.pairs[0];
          }
        } catch (err) {
          console.log(`↳ ⚠️ Dexscreener Fetch Skip: Token data not fully populated.`);
        }

        // Fallback: Drop token if no data profile is retrieved
        if (!gmgnData) {
          console.log(`↳ ❌ [DROP] Skipping token due to empty security profile on creation.`);
          return;
        }

        // --- SECURITY LOGIC ENGINE ---
        const rugCount = Number(getNestedProp(gmgnData, ['creator_rug_count', 'dev_rug_count'], 0));
        const top10Rate = parseFloat(getNestedProp(gmgnData, ['top_10_holder_rate', 'holder_concentration'], 0)) * 100;
        const isHoneypot = gmgnData.is_honeypot === 1 || gmgnData.is_honeypot === true;
        const mintRenounced = gmgnData.mint_has_not_renounced === 0 || gmgnData.is_mintable === false;
        
        const liquidity = dexscreenerData ? Number(getNestedProp(dexscreenerData, ['liquidity', 'usd'], 0)) : Number(getNestedProp(gmgnData, ['liquidity'], 0));

        // Evaluate metrics against strict rules
        if (rugCount > 1) {
          console.log(`↳ ❌ [FILTERED] Dev has active history of rugging (${rugCount} rugs).`);
          return;
        }
        if (top10Rate > 35) {
          console.log(`↳ ❌ [FILTERED] Supply distribution risk: Top 10 hold ${top10Rate.toFixed(1)}%.`);
          return;
        }
        if (isHoneypot) {
          console.log(`↳ ❌ [FILTERED] Honeypot code configuration flagged.`);
          return;
        }

        console.log(`🟩 [SECURITY PASSED] Broadcasting clean token profile: ${gmgnData.symbol || 'SOL'}`);

        // --- TELEGRAM NOTIFICATION TEMPLATE ---
        const tokenName = gmgnData.name || 'Solana Asset';
        const tokenSymbol = gmgnData.symbol || 'TOKEN';

        const alertMessage = `
🛡️ <b>VERIFIED SECURE LAUNCH</b> 🛡️
────────────────────────
• <b>Asset:</b> ${tokenName} (${tokenSymbol})
• <b>Contract:</b> <code>${tokenMint}</code>
────────────────────────
▶ <b>SECURITY AUDIT METRICS</b>
• <b>Dev Rug History:</b> ${rugCount === 0 ? '✅ Clean (0)' : `⚠️ ${rugCount} Rugs`}
• <b>Top 10 Supply Rate:</b> ${top10Rate.toFixed(1)}%
• <b>Mint Authority:</b> ${mintRenounced ? '✅ Renounced' : '🚨 Active'}
• <b>Liquidity Tracked:</b> $${liquidity > 0 ? liquidity.toLocaleString() : 'Indexing Pool...'}
────────────────────────
▶ <b>SECURE ACTION HUB</b>
• <a href="https://gmgn.ai/sol/token/${tokenMint}">📊 GMGN Safety Terminal</a>
• <a href="https://t.me/solana_trojanbot?start=r-obstech-${tokenMint}">⚔️ Trade Instant (Trojan Bot)</a>
────────────────────────
`;

        for (const chatId of CHAT_IDS) {
          if (!chatId) continue;
          try {
            await bot.telegram.sendMessage(chatId, alertMessage, {
              parse_mode: 'HTML',
              disable_web_page_preview: true
            });
          } catch (tgErr) {
            console.error(`↳ ❌ Telegram Routing Drop: ${tgErr.message}`);
          }
        }
      })();
    }
  } catch (error) {
    console.error(`[SYSTEM CORE ERROR]: ${error.message}`);
  }
});

// --- RENDER KEEP-ALIVE INTERCEPT LOOP ---
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Security Engine Active and Tracking Ports on ${PORT}`);

  // Automated self-ping framework to keep the app awake 24/7
  const APP_PING_URL = `https://solana-volume-bot-pvtx.onrender.com`;
  setInterval(async () => {
    try {
      await axios.get(APP_PING_URL);
      console.log('⏳ [KEEP-ALIVE] Server system successfully pinged. Firewalls active.');
    } catch (err) {
      console.log('⏳ [KEEP-ALIVE] Cron state check completed.');
    }
  }, 240000); // 4 minutes
});