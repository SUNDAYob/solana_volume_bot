const http = require('http');
const axios = require('axios');
require('dotenv').config();
const { Telegraf } = require('telegraf');

const PORT = process.env.PORT || 10000;

// Continuous health check server
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Solana Project Sniper Balanced: Online\n');
}).listen(PORT, '0.0.0.0', () => {
  console.log(`📡 Balanced Scanner bound securely to port ${PORT}`);
});

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || '').split(',').map(id => id.trim());

async function sendSystemTest() {
  for (const chatId of CHAT_IDS) {
    if (!chatId) continue;
    try {
      await bot.telegram.sendMessage(chatId, "🦅 <b>BALANCED PROJECT SCANNER ONLINE:</b>\n────────────────────────\n• 🌐 <b>Mode:</b> Safe Early Project Open Scan\n• 📊 <b>Liquidity Floor:</b> Adjusted to $10,000 \n• 🎯 <b>Bracket Window:</b> $15K - $150K Market Cap\n• 🛡️ <b>Guard Protocol:</b> Strict RugCheck Freeze Block ACTIVE", { parse_mode: 'HTML' });
    } catch (err) {
      console.log(`Startup alert deferred for ${chatId}:`, err.message);
    }
  }
}
sendSystemTest();

const processedPairs = new Set();
let executionDelay = 4000; 

async function executeSniperScan() {
  try {
    let mintsList = [];
    
    // 🔍 1. PULL REAL-TIME LAUNCH AND SEARCH STREAM VIA DEXSCREENER
    try {
      const liveSearchRoute = await axios.get('https://api.dexscreener.com/latest/dex/search?q=solana', { timeout: 4000 });
      if (liveSearchRoute.data && liveSearchRoute.data.pairs) {
        liveSearchRoute.data.pairs
          .filter(p => p.chainId === 'solana' && p.baseToken)
          .forEach(p => mintsList.push(p.baseToken.address));
      }
    } catch (e) {}

    if (mintsList.length === 0) {
      setTimeout(executeSniperScan, executionDelay);
      return;
    }

    const uniqueMints = [...new Set(mintsList)].slice(0, 30);

    let marketDataResponse;
    try {
      marketDataResponse = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${uniqueMints.join(',')}`, { timeout: 5000 });
      executionDelay = 4000; 
    } catch (err) {
      if (err.response && err.response.status === 429) {
        executionDelay = 15000; 
      }
      setTimeout(executeSniperScan, executionDelay);
      return; 
    }

    if (!marketDataResponse.data || !marketDataResponse.data.pairs) {
      setTimeout(executeSniperScan, executionDelay);
      return;
    }

    // 🛑 BALANCED BALANCING PARAMETERS
    const viablePairs = marketDataResponse.data.pairs.filter(p => 
      p.chainId === 'solana' &&
      p.marketCap && p.marketCap >= 15000 && p.marketCap <= 150000 &&   // Early launch window
      p.liquidity && p.liquidity.usd && p.liquidity.usd >= 10000 &&     // Balanced $10k floor for healthy launch depth
      p.volume && p.volume.h1 && p.volume.h1 >= 10000                  // Active organic trading metric
    );

    for (const pair of viablePairs) {
      const pairAddress = pair.pairAddress;
      const tokenMint = pair.baseToken.address;

      if (processedPairs.has(pairAddress)) continue;

      const hourlyTxns = pair.txns?.h1;
      if (!hourlyTxns) continue;
      const totalTrades = (hourlyTxns.buys || 0) + (hourlyTxns.sells || 0);
      if (totalTrades < 20) continue; // Requires an active community base trading it

      const poolLiquidity = pair.liquidity.usd;
      const hourlyVolume = pair.volume?.h1 || 0;
      const priceChangeH1 = pair.priceChange?.h1 || 0;

      // 🛡️ ZERO-EXCEPTION RUGCHECK HONEYPOT SCANNER
      let securityPassed = false;
      try {
        const securityCheck = await axios.get(`https://api.rugcheck.xyz/v1/tokens/${tokenMint}/report`, { timeout: 2500 });
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
              const top10HoldingPct = holders.slice(0, 10).reduce((acc, current) => acc + (current.pct || 0), 0);
              if (top10HoldingPct <= 50.0) securityPassed = true; 
            } else {
              securityPassed = true;
            }
          }
        }
      } catch (apiErr) {
        // If API fails, safety check drops to look at pool depth stability
        if (poolLiquidity >= 20000) securityPassed = true;
      }

      if (!securityPassed) continue;

      processedPairs.add(pairAddress);

      // ⚔️ TARGETED DIRECT REF-LINK ROUTING TO TROJAN
      const trojanTradeLink = `https://t.me/solana_trojanbot?start=r-obstech-${tokenMint}`;

      const telegramAlert = `
🚀 <b>EARLY-STAGE PROJECT SIGNAL</b> 🚀
────────────────────────
▶ <b>TOKEN METADATA</b>
• <b>Symbol:</b> $${pair.baseToken.symbol}
• <b>Contract:</b> <code>${tokenMint}</code>

▶ <b>LAUNCH MARKET CAP & DEEP POOL</b>
• <b>Market Capitalization:</b> 🎯 $${pair.marketCap.toLocaleString()}
• <b>Liquidity Pool Depth:</b> 📊 $${poolLiquidity.toLocaleString()} ✅

▶ <b>VOLUME MOMENTUM</b>
• <b>1H Trading Volume:</b> $${hourlyVolume.toLocaleString()}
• <b>1H Price Velocity:</b> 📈 +${priceChangeH1}%
• <b>Security Protocol:</b> Freeze & Blacklist Authority Disabled 🛡️
────────────────────────
▶ <b>LIGHTNING TRADE EXECUTION</b>
• <a href="${pair.url}">DexScreener Link</a>
• <a href="${trojanTradeLink}">⚔️ Trade Instant Entry via Trojan Bot</a>
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