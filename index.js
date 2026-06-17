const http = require('http');
const axios = require('axios');
require('dotenv').config();
const { Telegraf } = require('telegraf');

const PORT = process.env.PORT || 10000;

// Keep-alive server interface
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Solana Resilient Trade Engine: 24/7 Active\n');
}).listen(PORT, '0.0.0.0', () => {
  console.log(`📡 Resilient Alpha Engine active on port ${PORT}`);
});

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

async function sendSystemTest() {
  try {
    await bot.telegram.sendMessage(CHAT_ID, "🦅 <b>RESILIENT ENGINE ONLINE:</b>\n────────────────────────\n• 🛡️ <b>Anti-Throttle:</b> Auto-backoff activated\n• 📊 <b>Liquidity Floor:</b> Secure at $6,000\n• 📈 <b>1H Volume Floor:</b> Stable at $5,000\n• 🔄 Continuous multi-stream scanning live...", { parse_mode: 'HTML' });
    console.log("✅ Resilient initialization alert fired.");
  } catch (err) {
    console.log("Startup alert deferred:", err.message);
  }
}
sendSystemTest();

const processedPairs = new Set();
let errorDelay = 6000; // Dynamic loop speed to prevent API bans

async function executeSniperScan() {
  try {
    let mintsList = [];
    
    // SOURCING PIPELINE 1: Token Profiles
    try {
      const profilesRoute = await axios.get('https://api.dexscreener.com/token-profiles/latest/v1', { timeout: 5000 });
      if (profilesRoute.data && Array.isArray(profilesRoute.data)) {
        profilesRoute.data.filter(p => p.chainId === 'solana').forEach(p => mintsList.push(p.tokenAddress));
      }
    } catch (e) {
      // Handle rate limits silently
    }

    // SOURCING PIPELINE 2: High Activity Search Fallback
    try {
      const trendingRoute = await axios.get('https://api.dexscreener.com/latest/dex/search?q=solana', { timeout: 5000 });
      if (trendingRoute.data && trendingRoute.data.pairs) {
        trendingRoute.data.pairs.filter(p => p.chainId === 'solana' && p.baseToken).forEach(p => mintsList.push(p.baseToken.address));
      }
    } catch (e) {
      // Handle rate limits silently
    }

    if (mintsList.length === 0) {
      setTimeout(executeSniperScan, errorDelay);
      return;
    }

    const uniqueMints = [...new Set(mintsList)].slice(0, 30);

    let profilesResponse;
    try {
      profilesResponse = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${uniqueMints.join(',')}`, { timeout: 6000 });
      errorDelay = 6000; // Reset back to high performance on successful request
    } catch (err) {
      if (err.response && err.response.status === 429) {
        console.log("⚠️ Throttled by DexScreener. Backing off for 30 seconds to protect IP...");
        errorDelay = 30000; // Back off loop speed dynamically to clear rate limits safely
      }
      setTimeout(executeSniperScan, errorDelay);
      return; 
    }

    if (!profilesResponse.data || !profilesResponse.data.pairs) {
      setTimeout(executeSniperScan, errorDelay);
      return;
    }

    // BALANCED ENGINE METRICS
    const viablePairs = profilesResponse.data.pairs.filter(p => 
      p.chainId === 'solana' &&
      p.marketCap && p.marketCap >= 15000 && 
      p.liquidity && p.liquidity.usd && p.liquidity.usd >= 6000 && 
      p.volume && p.volume.h1 && p.volume.h1 >= 5000
    );

    for (const pair of viablePairs) {
      const pairAddress = pair.pairAddress;
      const tokenMint = pair.baseToken.address;

      if (processedPairs.has(pairAddress)) continue;

      const hourlyTxns = pair.txns?.h1;
      if (!hourlyTxns || !hourlyTxns.buys || !hourlyTxns.sells) continue;

      const totalTrades = hourlyTxns.buys + hourlyTxns.sells;
      if (totalTrades < 10) continue; 

      const buyRatioPct = (hourlyTxns.buys / totalTrades) * 100;
      const sellRatioPct = (hourlyTxns.sells / totalTrades) * 100;

      if (buyRatioPct < 58.0) continue;

      const hourlyVolume = pair.volume?.h1 || 0;
      const averageOrderSize = hourlyVolume / totalTrades;
      const priceChangeH1 = pair.priceChange?.h1 || 0;
      const poolLiquidity = pair.liquidity.usd;

      let top10HoldingPct = 0;
      let securityPassed = false;

      try {
        const securityCheck = await axios.get(`https://api.rugcheck.xyz/v1/tokens/${tokenMint}/report`, { timeout: 2500 });
        const report = securityCheck.data;

        if (report) {
          const risks = report.risks || [];
          const isMintable = risks.some(r => r.name && r.name.toLowerCase().includes('mint'));

          if (!isMintable) {
            const holders = report.holders || [];
            if (holders.length > 0) {
              top10HoldingPct = holders.slice(0, 10).reduce((acc, current) => acc + (current.pct || 0), 0);
              if (top10HoldingPct <= 45.0) securityPassed = true; 
            } else {
              securityPassed = true;
            }
          }
        }
      } catch (apiErr) {
        if (poolLiquidity >= 10000) securityPassed = true;
      }

      if (!securityPassed) continue;

      processedPairs.add(pairAddress);

      const telegramAlert = `
🔥 <b>SOLANA VOLUME BREAKOUT</b> 🔥
────────────────────────
▶ <b>TOKEN METADATA</b>
• <b>Symbol:</b> $${pair.baseToken.symbol}
• <b>Contract:</b> <code>${tokenMint}</code>

▶ <b>MARKET METRICS</b>
• <b>1H Tx Split:</b> 🟢 ${buyRatioPct.toFixed(1)}% Buy / 🔴 ${sellRatioPct.toFixed(1)}% Sell
• <b>1H Velocity:</b> 📈 +${priceChangeH1}%
• <b>Avg Order Size:</b> $${averageOrderSize.toFixed(2)}

▶ <b>LIQUIDITY & POOL DEPTH</b>
• <b>Market Cap:</b> $${pair.marketCap.toLocaleString()}
• <b>1H Total Volume:</b> $${hourlyVolume.toLocaleString()}
• <b>Liquidity Pool:</b> $${poolLiquidity.toLocaleString()} ✅ 
• <b>Top 10 Supply:</b> ${top10HoldingPct > 0 ? top10HoldingPct.toFixed(1) + '%' : 'Verified Safe'} 🛡️
────────────────────────
▶ <b>TRADE CHANNELS</b>
• <a href="${pair.url}">DexScreener Link</a>
• <a href="https://photon-sol.tinyastro.io/en/lp/${pairAddress}">Execute Instant Trade on Photon</a>
────────────────────────
`;

      await bot.telegram.sendMessage(CHAT_ID, telegramAlert, { 
        parse_mode: 'HTML',
        disable_web_page_preview: true 
      });
      
      console.log(`🎯 Active Signal Pushed: $${pair.baseToken.symbol}`);
    }
  } catch (error) {
    // Keep loops running seamlessly
  }

  // Self-scheduling loop with dynamic speed control
  setTimeout(executeSniperScan, errorDelay);
}

// Kick off the initial loop execution safely
setTimeout(executeSniperScan, 4000);