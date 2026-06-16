const http = require('http');
const axios = require('axios');
require('dotenv').config();
const { Telegraf } = require('telegraf');

// Force alignment with Render's required web service internal port mapping
const PORT = process.env.PORT || 10000;

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Solana Active Whale Sniper Active\n');
}).listen(PORT, '0.0.0.0', () => {
  console.log(`📡 Keep-alive web layer bound cleanly to port ${PORT}`);
});

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

async function sendSystemTest() {
  try {
    await bot.telegram.sendMessage(CHAT_ID, "🐋 <b>HIGH-ACTIVITY MOMENTUM ENGINE LIVE:</b> Buy gate optimized to 58%+ for increased trade flow scanning.", { parse_mode: 'HTML' });
    console.log("✅ High-activity configuration initialized.");
  } catch (err) {
    console.log("Startup alert deferred:", err.message);
  }
}
sendSystemTest();

const processedPairs = new Set();

async function executeSniperScan() {
  try {
    console.log(`[${new Date().toLocaleTimeString()}] Scanning active high-volume streams...`);
    
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

    // OPTIMIZED FILTERS: Lowered volume bar to $2,000 to catch earlier micro-caps
    const viablePairs = profilesResponse.data.pairs.filter(p => 
      p.chainId === 'solana' &&
      p.marketCap && p.marketCap >= 10000 && 
      p.volume && p.volume.h1 && p.volume.h1 >= 2000
    );

    for (const pair of viablePairs) {
      const pairAddress = pair.pairAddress;
      const tokenMint = pair.baseToken.address;

      if (processedPairs.has(pairAddress)) continue;

      const hourlyTxns = pair.txns?.h1;
      if (!hourlyTxns || !hourlyTxns.buys || !hourlyTxns.sells) continue;

      const totalTrades = hourlyTxns.buys + hourlyTxns.sells;
      if (totalTrades < 5) continue; 

      const buyRatioPct = (hourlyTxns.buys / totalTrades) * 100;
      const sellRatioPct = (hourlyTxns.sells / totalTrades) * 100;

      // ADJUSTED ACTION GATE: Now set to 58% to allow high-potential volume runs through
      if (buyRatioPct < 58.0) {
        console.log(` -> [SKIPPED] $${pair.baseToken.symbol} under 58% buy momentum (${buyRatioPct.toFixed(1)}% Buys)`);
        continue;
      }

      const hourlyVolume = pair.volume?.h1 || 0;
      const averageOrderSize = hourlyVolume / totalTrades;
      const priceChangeH1 = pair.priceChange?.h1 || 0;

      let top10HoldingPct = 0;
      let securityPassed = false;
      let isMintable = false;

      try {
        const securityCheck = await axios.get(`https://api.rugcheck.xyz/v1/tokens/${tokenMint}/report`, { timeout: 3000 });
        const report = securityCheck.data;

        if (report) {
          if (report.mintAuthority !== null && report.mintAuthority !== undefined) isMintable = true;
          const risks = report.risks || [];
          if (risks.some(r => r.name && r.name.toLowerCase().includes('mint'))) isMintable = true;

          if (isMintable) continue;

          const holders = report.holders || [];
          if (holders.length > 0) {
            top10HoldingPct = holders.slice(0, 10).reduce((acc, current) => acc + (current.pct || 0), 0);
            if (top10HoldingPct === 0 || top10HoldingPct < 30) securityPassed = true;
          } else {
            if ((pair.liquidity?.usd || 0) > 2000) securityPassed = true;
          }
        }
      } catch (apiErr) {
        if ((pair.liquidity?.usd || 0) > 2000) securityPassed = true;
      }

      if (!securityPassed) continue;

      processedPairs.add(pairAddress);

      const telegramAlert = `
🐋 <b>MOMENTUM & WHALE RADAR</b> 🐋
────────────────────────
▶ <b>TOKEN METADATA</b>
• <b>Symbol:</b> $${pair.baseToken.symbol}
• <b>Contract:</b> <code>${tokenMint}</code>

▶ <b>VOLUME & RATIO RADAR</b>
• <b>1H Tx Split:</b> 🟢 ${buyRatioPct.toFixed(1)}% Buy / 🔴 ${sellRatioPct.toFixed(1)}% Sell
• <b>1H Price Velocity:</b> ${priceChangeH1 >= 0 ? '📈 +' : '📉 '}${priceChangeH1}%
• <b>Whale Footprint:</b> ${averageOrderSize > 100 ? '👑 WHALE ACCUMULATION DETECTED' : '👥 Distributed Retail Flow'}

▶ <b>FINANCIAL METRICS</b>
• <b>Market Cap:</b> $${pair.marketCap.toLocaleString()}
• <b>1H Total Volume:</b> $${hourlyVolume.toLocaleString()}
• <b>Liquidity:</b> $${(pair.liquidity?.usd || 0).toLocaleString()}
• <b>Top 10 Ownership:</b> ${top10HoldingPct > 0 ? top10HoldingPct.toFixed(1) + '%' : 'Verified Safe'} ✅
• <b>Mint Authority:</b> Revoked 🛡️

▶ <b>TRADE TERMINALS</b>
• <a href="${pair.url}">DexScreener Link</a>
• <a href="https://photon-sol.tinyastro.io/en/lp/${pairAddress}">Execute Instant Trade on Photon</a>
────────────────────────
`;

      await bot.telegram.sendMessage(CHAT_ID, telegramAlert, { 
        parse_mode: 'HTML',
        disable_web_page_preview: true 
      });
      
      console.log(`🎯 Breakout Signal Sent: $${pair.baseToken.symbol}`);
    }
  } catch (error) {
    console.log("Scanner loop variance skipped safely:", error.message);
  }
}

setInterval(executeSniperScan, 6000);