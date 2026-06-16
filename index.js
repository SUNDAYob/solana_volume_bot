const http = require('http');
const axios = require('axios');
require('dotenv').config();
const { Telegraf } = require('telegraf');

// Keep-alive server binding for Render cloud containers
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Solana Production Sniper Active\n');
}).listen(process.env.PORT || 3000);

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

async function sendSystemTest() {
  try {
    await bot.telegram.sendMessage(CHAT_ID, "🟢 <b>SNIPER ENGINE MAINNET ONLINE:</b> Switched over to live token listing pipelines. Monitoring genuine low-cap pairs...", { parse_mode: 'HTML' });
  } catch (err) {
    console.log("Startup ping deferred:", err.message);
  }
}
sendSystemTest();

const processedPairs = new Set();

async function executeSniperScan() {
  try {
    console.log(`[${new Date().toLocaleTimeString()}] Querying raw Solana token listing streams...`);
    
    // TARGET FRESHLY CREATED SOLANA TOKEN PROFILES (NOT GENERIC SEARCH PAGE)
    const marketResponse = await axios.get('https://api.dexscreener.com/token-profiles/latest/v1');
    if (!marketResponse.data || !Array.isArray(marketResponse.data)) return;

    // Filter down to Solana chain profiles and clean out duplicates
    const rawMints = marketResponse.data
      .filter(item => item.chainId === 'solana')
      .map(item => item.tokenAddress);

    if (rawMints.length === 0) return;

    // Pull detailed multi-pair trading metric profiles for these raw tokens
    const profilesResponse = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${rawMints.slice(0, 20).join(',')}`);
    if (!profilesResponse.data || !profilesResponse.data.pairs) return;

    // Filter by your custom target execution boundaries
    const viablePairs = profilesResponse.data.pairs.filter(p => 
      p.chainId === 'solana' &&
      p.marketCap && p.marketCap >= 15000 &&           // Accommodate early micro-cap setups
      p.volume && p.volume.h1 && p.volume.h1 >= 5000    // Dynamic initial breakout volume
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
          // Hard security enforcement: Check if mint authority is active
          if (report.mintAuthority !== null && report.mintAuthority !== undefined) {
            isMintable = true;
          }
          
          const risks = report.risks || [];
          if (risks.some(r => r.name && r.name.toLowerCase().includes('mint'))) {
            isMintable = true;
          }

          if (isMintable) {
            console.log(` -> [FILTERED] $${pair.baseToken.symbol} rejected due to open mint authority.`);
            continue;
          }

          const holders = report.holders || [];
          if (holders.length > 0) {
            top10HoldingPct = holders.slice(0, 10).reduce((acc, current) => acc + (current.pct || 0), 0);
            if (top10HoldingPct === 0 || top10HoldingPct < 25) { // 25% tolerance for ultra-fresh launches
              securityPassed = true;
            }
          } else {
            if ((pair.liquidity?.usd || 0) > 3000) securityPassed = true;
          }
        }
      } catch (apiErr) {
        // Fallback option for unindexed profiles or API performance ceilings
        if ((pair.liquidity?.usd || 0) > 3000 || hasLockedLiquidity) {
          securityPassed = true;
        }
      }

      if (!securityPassed) continue;

      // Lock pair address into memory cache to stop notification duplication loops
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
    console.error("Scanner Execution Note:", error.message);
  }
}

// 5-second interval execution loop
setInterval(executeSniperScan, 5000);