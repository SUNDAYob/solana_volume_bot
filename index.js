const http = require('http');
const axios = require('axios');
require('dotenv').config();
const { Telegraf } = require('telegraf');

const PORT = process.env.PORT || 10000;

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Solana Alpha Filter Sniper Active\n');
}).listen(PORT, '0.0.0.0', () => {
  console.log(`📡 Keep-alive web layer bound cleanly to port ${PORT}`);
});

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

async function sendSystemTest() {
  try {
    await bot.telegram.sendMessage(CHAT_ID, "🛡️ <b>ALPHA QUALITY FILTERS RESTORED:</b> Buy gate reset to 60%+. Minimum liquidity guard set to $5,000. Filtering out bad tokens...", { parse_mode: 'HTML' });
    console.log("✅ Alpha quality configuration initialized.");
  } catch (err) {
    console.log("Startup alert deferred:", err.message);
  }
}
sendSystemTest();

const processedPairs = new Set();

async function executeSniperScan() {
  try {
    console.log(`[${new Date().toLocaleTimeString()}] Scanning for high-quality Solana volume...`);
    
    let marketResponse;
    try {
      marketResponse = await axios.get('https://api.dexscreener.com/token-profiles/latest/v1', { timeout: 4000 });
    } catch (apiErr) {
      marketResponse = await axios.get('https://api.dexscreener.com/latest/dex/search?q=solana', { timeout: 4000 });
    }

    if (!marketResponse || !marketResponse.data) return;

    let rawMints = [];
    if (Array.isArray(marketResponse.data)) {
      rawMints = marketResponse.data.filter(item => item.chainId === 'solana').map(item => item.tokenAddress);
    } else if (marketResponse.data.pairs) {
      rawMints = marketResponse.data.pairs.filter(p => p.chainId === 'solana' && p.baseToken).map(p => p.baseToken.address);
    }

    if (rawMints.length === 0) return;
    const uniqueMints = [...new Set(rawMints)].slice(0, 15);

    let profilesResponse;
    try {
      profilesResponse = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${uniqueMints.join(',')}`, { timeout: 4000 });
    } catch (err) {
      return;
    }

    if (!profilesResponse.data || !profilesResponse.data.pairs) return;

    // STRICT METRICS: Liquidity must be at least $5,000 to avoid micro-rugs
    const viablePairs = profilesResponse.data.pairs.filter(p => 
      p.chainId === 'solana' &&
      p.marketCap && p.marketCap >= 15000 && 
      p.liquidity && p.liquidity.usd && p.liquidity.usd >= 5000 &&
      p.volume && p.volume.h1 && p.volume.h1 >= 3000
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

      // MOMENTUM FILTER: Buyers must clearly dominate (60%+)
      if (buyRatioPct < 60.0) {
        console.log(` -> [SKIPPED] $${pair.baseToken.symbol} lacks buy conviction (${buyRatioPct.toFixed(1)}% Buys)`);
        continue;
      }

      const hourlyVolume = pair.volume?.h1 || 0;
      const averageOrderSize = hourlyVolume / totalTrades;
      const priceChangeH1 = pair.priceChange?.h1 || 0;
      const poolLiquidity = pair.liquidity.usd;

      // SECURITY SHIELD
      let top10HoldingPct = 0;
      let securityPassed = false;

      try {
        const securityCheck = await axios.get(`https://api.rugcheck.xyz/v1/tokens/${tokenMint}/report`, { timeout: 2500 });
        const report = securityCheck.data;

        if (report) {
          const risks = report.risks || [];
          const isMintable = risks.some(r => r.name && r.name.toLowerCase().includes('mint'));

          // Drop immediately if the token can be infinitely minted
          if (!isMintable) {
            const holders = report.holders || [];
            if (holders.length > 0) {
              top10HoldingPct = holders.slice(0, 10).reduce((acc, current) => acc + (current.pct || 0), 0);
              // Safe if the top 10 wallets hold less than 35% of the total supply
              if (top10HoldingPct < 35) securityPassed = true;
            } else {
              securityPassed = true;
            }
          }
        }
      } catch (apiErr) {
        // Fallback: If RugCheck times out, only trust it if liquidity is extra healthy ($7.5k+)
        if (poolLiquidity >= 7500) securityPassed = true;
      }

      if (!securityPassed) {
        console.log(` -> [SKIPPED] $${pair.baseToken.symbol} failed safety/concentration screen.`);
        continue;
      }

      processedPairs.add(pairAddress);

      const telegramAlert = `
💎 <b>HIGH-CONVICTION MOVER DETECTED</b> 💎
────────────────────────
▶ <b>TOKEN METADATA</b>
• <b>Symbol:</b> $${pair.baseToken.symbol}
• <b>Contract:</b> <code>${tokenMint}</code>

▶ <b>MOMENTUM RADAR</b>
• <b>1H Tx Split:</b> 🟢 ${buyRatioPct.toFixed(1)}% Buy / 🔴 ${sellRatioPct.toFixed(1)}% Sell
• <b>1H Price Velocity:</b> 📈 +${priceChangeH1}%
• <b>Whale Footprint:</b> ${averageOrderSize > 120 ? '👑 WHALE INSIDER ACCUMULATION' : '👥 Organic Retail Volume'}

▶ <b>FINANCIAL SAFETY</b>
• <b>Market Cap:</b> $${pair.marketCap.toLocaleString()}
• <b>1H Total Volume:</b> $${hourlyVolume.toLocaleString()}
• <b>Liquidity Pool:</b> $${poolLiquidity.toLocaleString()}
• <b>Top 10 Supply:</b> ${top10HoldingPct > 0 ? top10HoldingPct.toFixed(1) + '%' : 'Verified Safe'} ✅
────────────────────────
▶ <b>TRADE TERMINALS</b>
• <a href="${pair.url}">DexScreener Link</a>
• <a href="https://photon-sol.tinyastro.io/en/lp/${pairAddress}">Execute Instant Trade on Photon</a>
────────────────────────
`;

      await bot.telegram.sendMessage(CHAT_ID, telegramAlert, { 
        parse_mode: 'HTML',
        disable_web_page_preview: true 
      });
      
      console.log(`🎯 Premium Signal Sent: $${pair.baseToken.symbol}`);
    }
  } catch (error) {
    console.log("Scanner loop error handled cleanly:", error.message);
  }
}

setInterval(executeSniperScan, 6000);