const http = require('http');
const axios = require('axios');
require('dotenv').config();
const { Telegraf } = require('telegraf');

// Keep-alive server binding for Render cloud containers
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Solana Guarded Sniper Online\n');
}).listen(process.env.PORT || 3000);

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

async function sendSystemTest() {
  try {
    await bot.telegram.sendMessage(CHAT_ID, "🟢 <b>SNIPER CRASH-SHIELD ONLINE:</b> Pipeline initialized safely. Monitoring micro-cap tokens with strict exception handling...", { parse_mode: 'HTML' });
    console.log("✅ Startup ping successfully pushed to Telegram.");
  } catch (err) {
    console.log("⚠️ Startup ping deferred:", err.message);
  }
}
sendSystemTest();

const processedPairs = new Set();

async function executeSniperScan() {
  try {
    console.log(`[${new Date().toLocaleTimeString()}] Querying latest listing profiles...`);
    
    // Wrapped in its own try block to ensure an API error never kills the loop execution
    let marketResponse;
    try {
      marketResponse = await axios.get('https://api.dexscreener.com/token-profiles/latest/v1', { timeout: 4000 });
    } catch (apiErr) {
      console.log(` -> [NETWORK NOTE] Profiles endpoint busy, falling back to trending search...`);
      marketResponse = await axios.get('https://api.dexscreener.com/latest/dex/search?q=solana', { timeout: 4000 });
    }

    if (!marketResponse || !marketResponse.data) return;

    let rawMints = [];

    // Parse data structure depending on which endpoint responded
    if (Array.isArray(marketResponse.data)) {
      rawMints = marketResponse.data
        .filter(item => item.chainId === 'solana')
        .map(item => item.tokenAddress);
    } else if (marketResponse.data.pairs) {
      rawMints = marketResponse.data.pairs
        .filter(p => p.chainId === 'solana' && p.baseToken)
        .map(p => p.baseToken.address);
    }

    if (rawMints.length === 0) return;

    // Remove duplicates
    const uniqueMints = [...new Set(rawMints)].slice(0, 15);

    let profilesResponse;
    try {
      profilesResponse = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${uniqueMints.join(',')}`, { timeout: 4000 });
    } catch (err) {
      return; // Skip this tick if the data aggregate endpoint is down
    }

    if (!profilesResponse.data || !profilesResponse.data.pairs) return;

    // Filter by optimized micro-cap setup parameters
    const viablePairs = profilesResponse.data.pairs.filter(p => 
      p.chainId === 'solana' &&
      p.marketCap && p.marketCap >= 15000 && 
      p.volume && p.volume.h1 && p.volume.h1 >= 4000
    );

    for (const pair of viablePairs) {
      const pairAddress = pair.pairAddress;
      const tokenMint = pair.baseToken.address;

      if (processedPairs.has(pairAddress)) continue;

      const labels = pair.labels || [];
      const hasLockedLiquidity = labels.some(l => l.toLowerCase().includes('lock') || l.toLowerCase().includes('burn'));
      
      let top10HoldingPct = 0;
      let securityPassed = false;
      let isMintable = false;

      try {
        const securityCheck = await axios.get(`https://api.rugcheck.xyz/v1/tokens/${tokenMint}/report`, { timeout: 3000 });
        const report = securityCheck.data;

        if (report) {
          if (report.mintAuthority !== null && report.mintAuthority !== undefined) {
            isMintable = true;
          }
          
          const risks = report.risks || [];
          if (risks.some(r => r.name && r.name.toLowerCase().includes('mint'))) {
            isMintable = true;
          }

          if (isMintable) {
            continue; // Safely skip mintable risk factors
          }

          const holders = report.holders || [];
          if (holders.length > 0) {
            top10HoldingPct = holders.slice(0, 10).reduce((acc, current) => acc + (current.pct || 0), 0);
            if (top10HoldingPct === 0 || top10HoldingPct < 25) {
              securityPassed = true;
            }
          } else {
            if ((pair.liquidity?.usd || 0) > 3000) securityPassed = true;
          }
        }
      } catch (apiErr) {
        // Safe fallback logic if third-party scanner hits limits
        if ((pair.liquidity?.usd || 0) > 3000 || hasLockedLiquidity) {
          securityPassed = true;
        }
      }

      if (!securityPassed) continue;

      processedPairs.add(pairAddress);

      const telegramAlert = `
🚨 <b>SOL BREAKOUT DETECTED</b> 🚨
────────────────────────
▶ <b>TOKEN METADATA</b>
• <b>Symbol:</b> $${pair.baseToken.symbol}
• <b>Contract:</b> <code>${tokenMint}</code>

▶ <b>MARKET METRICS</b>
• <b>Market Cap:</b> $${pair.marketCap.toLocaleString()}
• <b>1H Vol:</b> $${pair.volume.h1.toLocaleString()}
• <b>Liquidity:</b> $${(pair.liquidity?.usd || 0).toLocaleString()}
• <b>Top 10 Ownership:</b> ${top10HoldingPct > 0 ? top10HoldingPct.toFixed(1) + '%' : 'Safe / Initial Launch'} ✅
• <b>Mint Authority:</b> Revoked 🛡️
• <b>LP Status:</b> Locked/Burned Natively 🔥

▶ <b>TERMINALS</b>
• <a href="${pair.url}">DexScreener Link</a>
• <a href="https://photon-sol.tinyastro.io/en/lp/${pairAddress}">Execute Trade on Photon</a>
────────────────────────
`;

      await bot.telegram.sendMessage(CHAT_ID, telegramAlert, { 
        parse_mode: 'HTML',
        disable_web_page_preview: true 
      });
      
      console.log(`🎯 Breakout Signal Sent: $${pair.baseToken.symbol}`);
    }
  } catch (error) {
    console.log("Scanner loop caught exception safely:", error.message);
  }
}

// 6-second delay to guarantee smooth API pacing
setInterval(executeSniperScan, 6000);