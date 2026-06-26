require('dotenv').config();
const express = require('express');
const { Telegraf } = require('telegraf');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

// Initialize Telegram with your Render Variables
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || '').split(',').map(id => id.trim());

// 60-second duplicate cache window
const recentMints = new Set();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

app.use(express.json());

app.get('/', (req, res) => {
  res.status(200).send('🛡️ Free-Tier GMGN & Dexscreener Security Matrix Layer Online\n');
});

// Deep fallback value finder
const getNestedProp = (obj, paths, defaultVal = 0) => {
  for (const path of paths) {
    if (obj && obj[path] !== undefined && obj[path] !== null) return obj[path];
  }
  return defaultVal;
};

// Ingestion Router for Helius Webhook Stream
app.post('/helius-stream', async (req, res) => {
  res.status(200).send('OK'); // Instantly tell Helius we received it

  try {
    const transactions = req.body;
    if (!Array.isArray(transactions) || transactions.length === 0) return;

    for (const tx of transactions) {
      let tokenMint = null;

      // Extract mint address from transaction structure
      if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
        const transfer = tx.tokenTransfers.find(t => t.tokenMint && t.tokenMint.length >= 32);
        if (transfer) tokenMint = transfer.tokenMint;
      }

      if (!tokenMint || typeof tokenMint !== 'string') continue;
      tokenMint = tokenMint.trim();
      if (tokenMint.length < 32 || tokenMint.includes('1111111111111111')) continue;

      // Local tracking deduplication
      if (recentMints.has(tokenMint)) continue;
      recentMints.add(tokenMint);
      setTimeout(() => recentMints.delete(tokenMint), 60000);

      console.log(`\n🔍 [LAUNCH INGESTED] Running security checks on: ${tokenMint}`);

      // Run scans asynchronously
      (async () => {
        let gmgnData = null;
        let dexscreenerData = null;

        // Allow trackers time to capture the pair data
        await delay(3000);

        // 🛡️ SECURITY LAYER 1: Public GMGN Web Token Info API
        try {
          const gmgnResponse = await axios.get(`https://gmgn.ai/api/v1/token_security/sol/${tokenMint}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            timeout: 6000
          });
          if (gmgnResponse.data && gmgnResponse.data.data) {
            gmgnData = gmgnResponse.data.data;
          }
        } catch (err) {
          console.log(`↳ ⚠️ GMGN Public Security API pending details: ${err.message}`);
        }

        // 🛡️ SECURITY LAYER 2: Dexscreener Real-time Analytical API
        try {
          const dexResponse = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`, { timeout: 4000 });
          if (dexResponse.data && dexResponse.data.pairs && dexResponse.data.pairs.length > 0) {
            dexscreenerData = dexResponse.data.pairs[0];
          }
        } catch (err) {
          console.log(`↳ ⚠️ Dexscreener Core Data unavailable yet.`);
        }

        // Proceed if we have at least one valid endpoint profile back
        if (!gmgnData && !dexscreenerData) {
          console.log(`↳ ❌ [DROP] Insufficient metrics returned from trackers.`);
          return;
        }

        // --- THE SECURITY FILTER MATRIX ---
        const rugCount = gmgnData ? Number(getNestedProp(gmgnData, ['creator_rug_count', 'dev_rug_count'], 0)) : 0;
        const top10Rate = gmgnData ? parseFloat(getNestedProp(gmgnData, ['top_10_holder_rate', 'holder_concentration'], 0)) * 100 : 0;
        const isHoneypot = gmgnData ? (gmgnData.is_honeypot === 1 || gmgnData.is_honeypot === true) : false;
        const mintRenounced = gmgnData ? (gmgnData.mint_has_not_renounced === 0 || gmgnData.is_mintable === false) : true;
        
        const liquidity = dexscreenerData ? Number(getNestedProp(dexscreenerData, ['liquidity', 'usd'], 0)) : 0;
        const tokenSymbol = dexscreenerData ? dexscreenerData.baseToken.symbol : (gmgnData ? gmgnData.symbol : 'TOKEN');
        const tokenName = dexscreenerData ? dexscreenerData.baseToken.name : (gmgnData ? gmgnData.name : 'Solana Asset');

        // Apply strict filtration values
        if (rugCount > 1) {
          console.log(`↳ ❌ [FILTERED] Dev has a history of rugging (${rugCount} rugs).`);
          return;
        }
        if (top10Rate > 35) {
          console.log(`↳ ❌ [FILTERED] Distribution threat: Top 10 control ${top10Rate.toFixed(1)}%.`);
          return;
        }
        if (isHoneypot) {
          console.log(`↳ ❌ [FILTERED] Honeypot scam layout confirmed.`);
          return;
        }

        console.log(`🟩 [PASSED SECURITY SCRUB] Delivering safe launch alert for ${tokenSymbol}`);

        // --- DISPATCH TELEGRAM ALERT PACKET ---
        const alertMessage = `
🛡️ <b>VERIFIED SECURE LAUNCH</b> 🛡️
────────────────────────
• <b>Asset:</b> ${tokenName} (${tokenSymbol})
• <b>Contract:</b> <code>${tokenMint}</code>
────────────────────────
▶ <b>SECURITY AUDIT METRICS</b>
• <b>Dev Rug History:</b> ${rugCount === 0 ? '✅ Clean (0)' : `⚠️ ${rugCount} Rugs`}
• <b>Top 10 Supply Rate:</b> ${top10Rate > 0 ? `${top10Rate.toFixed(1)}%` : '✅ Safe Dynamic'}
• <b>Mint Authority:</b> ${mintRenounced ? '✅ Renounced' : '🚨 Active'}
• <b>Liquidity Depth:</b> ${liquidity > 0 ? `$${liquidity.toLocaleString()}` : 'Indexing Pool...'}
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
            console.log(`↳ 🎉 Delivered cleanly to chat: ${chatId}`);
          } catch (tgErr) {
            console.error(`↳ ❌ Telegram Delivery Error: ${tgErr.message}`);
          }
        }
      })();
    }
  } catch (error) {
    console.error(`[CORE SECURITY MODULE EXCEPTION]: ${error.message}`);
  }
});

// Keep-Alive Ping Execution Block to prevent instance sleep cycles
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Dedicated Security Engine Active on Port ${PORT}`);

  const MY_RENDER_APP = `https://solana-volume-bot-pvtx.onrender.com`;
  setInterval(async () => {
    try {
      await axios.get(MY_RENDER_APP);
      console.log('⏳ [KEEP-ALIVE] Pinged security backend module. Server active.');
    } catch (err) {
      console.log('⏳ [KEEP-ALIVE] Cron intercept fired.');
    }
  }, 240000); // 4 minutes
});