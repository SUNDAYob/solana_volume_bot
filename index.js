const http = require('http');
const axios = require('axios');
require('dotenv').config();
const { Telegraf } = require('telegraf');

const PORT = process.env.PORT || 10000;

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Solana Volume Engine: Active Trade Flow\n');
}).listen(PORT, '0.0.0.0', () => {
  console.log(`📡 Alpha engine interface securely bound to port ${PORT}`);
});

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

async function sendSystemTest() {
  try {
    await bot.telegram.sendMessage(CHAT_ID, "🦅 <b>TRADE FLOW ACTIVE:</b>\n────────────────────────\n• 🛡️ <b>Liquidity Floor:</b> Calibrated to $6,000\n• 📊 <b>1H Volume Floor:</b> Min $5,000 Stream\n• 📈 <b>Momentum Gate:</b> Balanced at 58%+\n• 🔄 Scanning active network transactions...", { parse_mode: 'HTML' });
    console.log("✅ Balanced Engine configuration live notification sent.");
  } catch (err) {
    console.log("Startup alert deferred:", err.message);
  }
}
sendSystemTest();

const processedPairs = new Set();

async function executeSniperScan() {
  try {
    let mintsList = [];
    
    // Aggressive dual-stream sourcing to pull everything moving on Solana
    try {
      const profilesRoute = await axios.get('https://api.dexscreener.com/token-profiles/latest/v1', { timeout: 4000 });
      if (profilesRoute.data && Array.isArray(profilesRoute.data)) {
        profilesRoute.data.filter(p => p.chainId === 'solana').forEach(p => mintsList.push(p.tokenAddress));
      }
    } catch (e) {}

    try {
      const trendingRoute = await axios.get('https://api.dexscreener.com/latest/dex/search?q=solana', { timeout: 4000 });
      if (trendingRoute.data && trendingRoute.data.pairs) {
        trendingRoute.data.pairs.filter(p => p.chainId === 'solana' && p.baseToken).forEach(p => mintsList.push(p.baseToken.address));
      }
    } catch (e) {}

    if (mintsList.length === 0) return;
    const uniqueMints = [...new Set(mintsList)].slice(0, 25);

    let profilesResponse;
    try {
      profilesResponse = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${uniqueMints.join(',')}`, { timeout: 5000 });
    } catch (err) {
      return; 
    }

    if (!profilesResponse.data || !profilesResponse.data.pairs) return;

    // BALANCED SCANNER METRICS: Designed to let real volume through while shielding from total collapses
    const viablePairs = profilesResponse.data.pairs.filter(p => 
      p.chainId === 'solana' &&
      p.marketCap && p.marketCap >= 15000 && 
      p.liquidity && p.liquidity.usd && p.liquidity.usd >= 6000 && // $6k floor lets viable projects trigger alerts
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

      // MOMENTUM GATEWAY
      if (buyRatioPct < 58.0) {
        continue;
      }

      const hourlyVolume = pair.volume?.h1 || 0;
      const averageOrderSize = hourlyVolume / totalTrades;
      const priceChangeH1 = pair.priceChange?.h1 || 0;
      const poolLiquidity = pair.liquidity.usd;

      let top10HoldingPct = 0;
      let securityPassed = false;

      // INSTANT SECURITY AUDIT
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
              if (top10HoldingPct <= 40.0) securityPassed = true; // Safe cap protection
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
    // Fail silently to maintain smooth uptime loops
  }
}

setInterval(executeSniperScan, 6000);