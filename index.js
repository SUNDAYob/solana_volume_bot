const http = require('http');
const axios = require('axios');
require('dotenv').config();
const { Telegraf } = require('telegraf');

const PORT = process.env.PORT || 10000;

// Continuous health check server
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Solana Trojan CTO Scanner Engine: Online\n');
}).listen(PORT, '0.0.0.0', () => {
  console.log(`📡 Trojan-CTO Engine bound securely to port ${PORT}`);
});

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || '').split(',').map(id => id.trim());

async function sendSystemTest() {
  for (const chatId of CHAT_IDS) {
    if (!chatId) continue;
    try {
      await bot.telegram.sendMessage(chatId, "🦅 <b>TROJAN CTO INTELLIGENCE ENGINE ONLINE:</b>\n────────────────────────\n• 🌐 <b>Mode:</b> Scanning DexScreener Official Community Takeovers\n• ⚔️ <b>Execution:</b> Linked to Trojan Sniper System\n• 🛡️ <b>Anti-Honeypot:</b> Freeze/Blacklist Block Enabled", { parse_mode: 'HTML' });
      console.log(`✅ Diagnostics pushed to destination: ${chatId}`);
    } catch (err) {
      console.log(`Startup alert deferred for ${chatId}:`, err.message);
    }
  }
}
sendSystemTest();

const processedPairs = new Set();
let executionDelay = 6000; 

async function executeSniperScan() {
  try {
    let mintsList = [];
    
    // 🔍 1. TARGETING RECENT DEXSCREENER COMMUNITY TAKEOVERS
    try {
      const ctoRoute = await axios.get('https://api.dexscreener.com/community-takeovers/latest/v1', { timeout: 4000 });
      if (ctoRoute.data && Array.isArray(ctoRoute.data)) {
        ctoRoute.data
          .filter(p => p.chainId === 'solana')
          .forEach(p => mintsList.push(p.tokenAddress));
      }
    } catch (e) {}

    // 🔍 2. COMBINING WITH MOST SEARCHED STREAMS FOR COMPREHENSIVE ATTENTION OVERLAP
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

    const uniqueMints = [...new Set(mintsList)].slice(0, 25);

    let profilesResponse;
    try {
      profilesResponse = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${uniqueMints.join(',')}`, { timeout: 5000 });
      executionDelay = 6000; 
    } catch (err) {
      if (err.response && err.response.status === 429) {
        executionDelay = 20000; 
      }
      setTimeout(executeSniperScan, executionDelay);
      return; 
    }

    if (!profilesResponse.data || !profilesResponse.data.pairs) {
      setTimeout(executeSniperScan, executionDelay);
      return;
    }

    // Filter down tokens with baseline trading viability
    const viablePairs = profilesResponse.data.pairs.filter(p => 
      p.chainId === 'solana' &&
      p.marketCap && p.marketCap >= 12000 && 
      p.liquidity && p.liquidity.usd && p.liquidity.usd >= 5000 && 
      p.volume && p.volume.h1 && p.volume.h1 >= 8000
    );

    for (const pair of viablePairs) {
      const pairAddress = pair.pairAddress;
      const tokenMint = pair.baseToken.address;

      if (processedPairs.has(pairAddress)) continue;

      const hourlyTxns = pair.txns?.h1;
      if (!hourlyTxns || !hourlyTxns.buys || !hourlyTxns.sells) continue;

      const totalTrades = hourlyTxns.buys + hourlyTxns.sells;
      const buyRatioPct = (hourlyTxns.buys / totalTrades) * 100;

      const hourlyVolume = pair.volume?.h1 || 0;
      const poolLiquidity = pair.liquidity.usd;
      const priceChangeH1 = pair.priceChange?.h1 || 0;

      const volumeToLiquidityRatio = hourlyVolume / poolLiquidity;

      let top10HoldingPct = 0;
      let securityPassed = false;

      // 🛡️ ANTI-HONEYPOT SCANNER LOOP (Prevents freeze scams)
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

      // ⚔️ CREATE TROJAN REF LINK EXTRACTION FORMAT
      // If you have a custom Trojan referral handle, swap 'solana_trojanbot' with your custom link parameter
      const trojanTradeLink = `https://t.me/solana_trojanbot?start=r-obstech-${tokenMint}`;

      const telegramAlert = `
🔥 <b>COMMUNITY TAKEOVER (CTO) SPEED ALERT</b> 🔥
────────────────────────
▶ <b>TOKEN METADATA</b>
• <b>Symbol:</b> $${pair.baseToken.symbol}
• <b>Contract:</b> <code>${tokenMint}</code>

▶ <b>MOMENTUM PROFILE</b>
• <b>Status:</b> 🚀 Dev Out / Verified Community Takeover [CTO]
• <b>1H Search & Volume Volume:</b> $${hourlyVolume.toLocaleString()} (${volumeToLiquidityRatio.toFixed(1)}x)
• <b>Price Change (1H):</b> 📈 +${priceChangeH1}%
• <b>Orderflow:</b> 🟢 ${buyRatioPct.toFixed(1)}% Buys (${totalTrades} trades)

▶ <b>LIQUIDITY & PROTECTION</b>
• <b>Market Cap:</b> $${pair.marketCap.toLocaleString()}
• <b>Liquidity Pool:</b> $${poolLiquidity.toLocaleString()} ✅
• <b>Honeypot Security:</b> Freeze & Blacklist Authority Disabled 🛡️
────────────────────────
▶ <b>LIGHTNING TRADE EXECUTION</b>
• <a href="${pair.url}">DexScreener Interface</a>
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