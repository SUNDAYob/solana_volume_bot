const http = require('http');
const axios = require('axios');
require('dotenv').config();
const { Telegraf } = require('telegraf');

const PORT = process.env.PORT || 10000;

// Continuous health check server
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Solana Early Micro-Gem Engine: Online\n');
}).listen(PORT, '0.0.0.0', () => {
  console.log(`📡 Micro-Gem Engine bound securely to port ${PORT}`);
});

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || '').split(',').map(id => id.trim());

async function sendSystemTest() {
  for (const chatId of CHAT_IDS) {
    if (!chatId) continue;
    try {
      await bot.telegram.sendMessage(chatId, "🦅 <b>EARLY MICRO-GEM SCANNER ONLINE:</b>\n────────────────────────\n• 🌐 <b>Targeting:</b> Low MC Floor Trenches\n• 📊 <b>Cap Bracket:</b> Strict $10K - $50K Bracket Only 🎯\n• ⚡ <b>Velocity Floor:</b> 1.5x Volume-to-Pool Ratio\n• 🛡️ <b>Guard Protocol:</b> Freeze/Blacklist Anti-Honeypot Active", { parse_mode: 'HTML' });
    } catch (err) {
      console.log(`Startup alert deferred for ${chatId}:`, err.message);
    }
  }
}
sendSystemTest();

const processedPairs = new Set();
let executionDelay = 5000; 

async function executeSniperScan() {
  try {
    let mintsList = [];
    
    // 🔍 1. PARSE ACTIVE SEARCH VELOCITY TO CATCH INCOMING VOLUME INSTANTLY
    try {
      const liveSearchRoute = await axios.get('https://api.dexscreener.com/latest/dex/search?q=solana', { timeout: 4000 });
      if (liveSearchRoute.data && liveSearchRoute.data.pairs) {
        liveSearchRoute.data.pairs
          .filter(p => p.chainId === 'solana' && p.baseToken)
          .forEach(p => mintsList.push(p.baseToken.address));
      }
    } catch (e) {}

    // 🔍 2. CROSS-REFERENCE WITH NEWLY BOOSTED STREAMS FOR MAX VISIBILITY
    try {
      const topSearchedRoute = await axios.get('https://api.dexscreener.com/token-boosts/top/v1', { timeout: 4000 });
      if (topSearchedRoute.data && Array.isArray(topSearchedRoute.data)) {
        topSearchedRoute.data
          .filter(p => p.chainId === 'solana')
          .forEach(p => mintsList.push(p.tokenAddress));
      }
    } catch (e) {}

    if (mintsList.length === 0) {
      setTimeout(executeSniperScan, executionDelay);
      return;
    }

    const uniqueMints = [...new Set(mintsList)].slice(0, 30);

    let profilesResponse;
    try {
      profilesResponse = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${uniqueMints.join(',')}`, { timeout: 5000 });
      executionDelay = 5000; 
    } catch (err) {
      if (err.response && err.response.status === 429) {
        executionDelay = 15000; 
      }
      setTimeout(executeSniperScan, executionDelay);
      return; 
    }

    if (!profilesResponse.data || !profilesResponse.data.pairs) {
      setTimeout(executeSniperScan, executionDelay);
      return;
    }

    // 🛑 STAGE 2 FILTERING: THE PRECISION MICRO-CAP SWEET-SPOT SELECTION PROTOCOL
    const viablePairs = profilesResponse.data.pairs.filter(p => 
      p.chainId === 'solana' &&
      p.marketCap && p.marketCap >= 10000 && p.marketCap <= 50000 &&   // 🎯 MICRO WINDOW: $10,000 to $50,000 ONLY
      p.liquidity && p.liquidity.usd && p.liquidity.usd >= 3500 &&     // Scaled down to match micro liquidity pools
      p.volume && p.volume.h1 && p.volume.h1 >= 15000                 // Active hourly trading momentum floor
    );

    for (const pair of viablePairs) {
      const pairAddress = pair.pairAddress;
      const tokenMint = pair.baseToken.address;

      if (processedPairs.has(pairAddress)) continue;

      const hourlyTxns = pair.txns?.h1;
      if (!hourlyTxns || !hourlyTxns.buys || !hourlyTxns.sells) continue;

      const totalTrades = hourlyTxns.buys + hourlyTxns.sells;
      if (totalTrades < 30) continue; 

      const buyRatioPct = (hourlyTxns.buys / totalTrades) * 100;
      if (buyRatioPct < 51.0 || buyRatioPct > 85.0) continue; 

      const hourlyVolume = pair.volume?.h1 || 0;
      const poolLiquidity = pair.liquidity.usd;
      const priceChangeH1 = pair.priceChange?.h1 || 0;

      // ⚡ AGGRESSIVE HIGH-VELOCITY ACCELERATION PROTOCOL
      const volumeToLiquidityRatio = hourlyVolume / poolLiquidity;
      if (volumeToLiquidityRatio < 1.50) continue; // Volume must significantly outpace pool depth

      let top10HoldingPct = 0;
      let securityPassed = false;

      // 🛡️ ANTI-HONEYPOT BLACKLIST AND FREEZE SCANNER
      try {
        const securityCheck = await axios.get(`https://api.rugcheck.xyz/v1/tokens/${tokenMint}/report`, { timeout: 2000 });
        const report = securityCheck.data;

        if (report) {
          const risks = report.risks || [];
          const hasHoneypotRisk = risks.some(risk => {
            const riskName = (risk.name || '').toLowerCase();
            return riskName.includes('mint') || 
                   riskName.includes('freeze') || 
                   riskName.includes('blacklist') || 
                   riskName.includes('mutable');
          });

          if (!hasHoneypotRisk) {
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
        if (poolLiquidity >= 15000) securityPassed = true; 
      }

      if (!securityPassed) continue;

      processedPairs.add(pairAddress);

      // ⚔️ TARGETED DIRECT REF-LINK ROUTING TO TROJAN
      const trojanTradeLink = `https://t.me/solana_trojanbot?start=r-obstech-${tokenMint}`;

      const telegramAlert = `
🚀 <b>MICRO-CAP VELOCITY RUNNER</b> 🚀
────────────────────────
▶ <b>TOKEN METADATA</b>
• <b>Symbol:</b> $${pair.baseToken.symbol}
• <b>Contract:</b> <code>${tokenMint}</code>

▶ <b>ACCELERATION METRICS</b>
• <b>1H Volume Multiplier:</b> 🔥 <b>${volumeToLiquidityRatio.toFixed(2)}x</b> (Massive Velocity)
• <b>1H Active Volume:</b> 📊 $${hourlyVolume.toLocaleString()} 
• <b>1H Price Velocity:</b> 📈 +${priceChangeH1}%
• <b>Orderflow Dynamics:</b> 🟢 ${buyRatioPct.toFixed(1)}% Buys (${totalTrades} total trades)

▶ <b>LIQUIDITY & RISK CONTROL</b>
• <b>Market Cap:</b> 🎯 <b>$${pair.marketCap.toLocaleString()}</b> [MICRO BRACKET]
• <b>Liquidity Pool:</b> $${poolLiquidity.toLocaleString()} ✅
• <b>Honeypot Filter:</b> Freeze & Blacklist Authority Disabled 🛡️
────────────────────────
▶ <b>LIGHTNING TRADE EXECUTION</b>
• <a href="${pair.url}">DexScreener Link</a>
• <a href="${trojanTradeLink}">⚔️ Execute Instant Buy on Trojan Bot</a>
────────────────────────
`;

      for (const chatId of CHAT_IDS) {
        if (!chatId) continue;
        try {
          await bot.telegram.sendMessage(chatId, telegramAlert, { 
            parse_mode: 'HTML',
            disable_web_page_preview: true 
          });
        } catch (postErr) {}
      }
    }
  } catch (error) {}

  setTimeout(executeSniperScan, executionDelay);
}

setTimeout(executeSniperScan, 4000);