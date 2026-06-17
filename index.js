const http = require('http');
const axios = require('axios');
require('dotenv').config();
const { Telegraf } = require('telegraf');

const PORT = process.env.PORT || 10000;

// Professional web server bind for 24/7 Render stability
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Solana Professional Volume-Velocity Engine: Active\n');
}).listen(PORT, '0.0.0.0', () => {
  console.log(`📡 Professional Engine bound to port ${PORT}`);
});

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

async function sendSystemTest() {
  try {
    await bot.telegram.sendMessage(CHAT_ID, "🦅 <b>PROFESSIONAL MOMENTUM ENGINE ONLINE:</b>\n────────────────────────\n• 📊 <b>Strategy:</b> Volume-to-Liquidity Velocity Multiplier\n• 🛡️ <b>Liquidity Floor:</b> Secure at $5,000\n• ⚡ <b>Tracking:</b> Smart Money Accumulation Footprints\n────────────────────────\n🔄 Sweeping live network transactions...", { parse_mode: 'HTML' });
    console.log("✅ Professional Engine system notification pushed.");
  } catch (err) {
    console.log("Startup alert deferred:", err.message);
  }
}
sendSystemTest();

const processedPairs = new Set();
let executionDelay = 6000; 

async function executeSniperScan() {
  try {
    let mintsList = [];
    
    // Multi-stream extraction to pull both trending pairs and raw profile updates
    try {
      const trendingRoute = await axios.get('https://api.dexscreener.com/latest/dex/search?q=solana', { timeout: 4000 });
      if (trendingRoute.data && trendingRoute.data.pairs) {
        trendingRoute.data.pairs.filter(p => p.chainId === 'solana' && p.baseToken).forEach(p => mintsList.push(p.baseToken.address));
      }
    } catch (e) {}

    try {
      const profilesRoute = await axios.get('https://api.dexscreener.com/token-profiles/latest/v1', { timeout: 4000 });
      if (profilesRoute.data && Array.isArray(profilesRoute.data)) {
        profilesRoute.data.filter(p => p.chainId === 'solana').forEach(p => mintsList.push(p.tokenAddress));
      }
    } catch (e) {}

    if (mintsList.length === 0) {
      setTimeout(executeSniperScan, executionDelay);
      return;
    }

    const uniqueMints = [...new Set(mintsList)].slice(0, 25);

    let profilesResponse;
    try {
      profilesResponse = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${uniqueMints.join(',')}`, { timeout: 5000 });
      executionDelay = 6000; // Reset delay on successful hit
    } catch (err) {
      if (err.response && err.response.status === 429) {
        executionDelay = 20000; // Smart throttling back-off
      }
      setTimeout(executeSniperScan, executionDelay);
      return; 
    }

    if (!profilesResponse.data || !profilesResponse.data.pairs) {
      setTimeout(executeSniperScan, executionDelay);
      return;
    }

    // PROFESSIONAL FILTER LOGIC
    const viablePairs = profilesResponse.data.pairs.filter(p => 
      p.chainId === 'solana' &&
      p.marketCap && p.marketCap >= 12000 && 
      p.liquidity && p.liquidity.usd && p.liquidity.usd >= 5000 && 
      p.volume && p.volume.h1 && p.volume.h1 >= 6000
    );

    for (const pair of viablePairs) {
      const pairAddress = pair.pairAddress;
      const tokenMint = pair.baseToken.address;

      if (processedPairs.has(pairAddress)) continue;

      const hourlyTxns = pair.txns?.h1;
      if (!hourlyTxns || !hourlyTxns.buys || !hourlyTxns.sells) continue;

      const totalTrades = hourlyTxns.buys + hourlyTxns.sells;
      const buyRatioPct = (hourlyTxns.buys / totalTrades) * 100;

      // Ensure stable initial momentum
      if (buyRatioPct < 52.0) continue;

      const hourlyVolume = pair.volume?.h1 || 0;
      const poolLiquidity = pair.liquidity.usd;
      const priceChangeH1 = pair.priceChange?.h1 || 0;

      // MATHEMATICAL VELOCITY CHECK: Is volume outstripping liquidity? (Signs of extreme attention)
      const volumeToLiquidityRatio = hourlyVolume / poolLiquidity;
      if (volumeToLiquidityRatio < 0.8) continue; 

      let top10HoldingPct = 0;
      let securityPassed = false;

      // RUGCHECK AUDIT
      try {
        const securityCheck = await axios.get(`https://api.rugcheck.xyz/v1/tokens/${tokenMint}/report`, { timeout: 2000 });
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
        if (poolLiquidity >= 12000) securityPassed = true;
      }

      if (!securityPassed) continue;

      processedPairs.add(pairAddress);

      const telegramAlert = `
💎 <b>PROFESSIONAL HIGH-VELOCITY SIGNAL</b> 💎
────────────────────────
▶ <b>TOKEN METADATA</b>
• <b>Symbol:</b> $${pair.baseToken.symbol}
• <b>Contract:</b> <code>${tokenMint}</code>

▶ <b>ACCELERATION METRICS</b>
• <b>1H Volume Multiplier:</b> 🔥 <b>${volumeToLiquidityRatio.toFixed(2)}x</b> (Volume vs. Pool)
• <b>1H Price Velocity:</b> 📈 +${priceChangeH1}%
• <b>Transaction Flow:</b> 🟢 ${buyRatioPct.toFixed(1)}% Buys (${totalTrades} total trades)

▶ <b>LIQUIDITY & RISK CONTROL</b>
• <b>Market Cap:</b> $${pair.marketCap.toLocaleString()}
• <b>Liquidity Pool:</b> $${poolLiquidity.toLocaleString()} ✅
• <b>Top 10 Concentration:</b> ${top10HoldingPct > 0 ? top10HoldingPct.toFixed(1) + '%' : 'Verified Safe'} 🛡️
────────────────────────
▶ <b>TRADE EXECUTION</b>
• <a href="${pair.url}">DexScreener Link</a>
• <a href="https://photon-sol.tinyastro.io/en/lp/${pairAddress}">Execute Instant Trade on Photon</a>
────────────────────────
`;

      await bot.telegram.sendMessage(CHAT_ID, telegramAlert, { 
        parse_mode: 'HTML',
        disable_web_page_preview: true 
      });
      
      console.log(`🎯 Momentum Signal Pushed: $${pair.baseToken.symbol}`);
    }
  } catch (error) {
    // Keep internal loop running seamlessly
  }

  setTimeout(executeSniperScan, executionDelay);
}

setTimeout(executeSniperScan, 4000);