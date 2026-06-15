const http = require('http');
const axios = require('axios');
require('dotenv').config();
const { Telegraf } = require('telegraf');

// Maintain port binding to keep Render Free Tier alive
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Solana Pro Scanner Running\n');
}).listen(process.env.PORT || 3000);

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Cache to handle tracking and avoid duplicate alerts
const processedPairs = new Set();

async function executeProScan() {
  try {
    console.log(`[${new Date().toLocaleTimeString()}] Fetching market pairs...`);
    
    // 1. Fetch active trending tokens via DexScreener
    const marketResponse = await axios.get('https://api.dexscreener.com/latest/dex/search?q=solana');
    if (!marketResponse.data || !marketResponse.data.pairs) return;

    // Filter baseline configurations based on your criteria
    const targetedPairs = marketResponse.data.pairs.filter(p => 
      p.chainId === 'solana' &&
      p.marketCap && p.marketCap >= 25000 &&       // Market cap $25k upward
      p.volume && p.volume.h1 && p.volume.h1 >= 15000 // Ensure consistent initial trading volume
    );

    for (const pair of targetedPairs) {
      const pairAddress = pair.pairAddress;
      const tokenMint = pair.baseToken.address;

      if (processedPairs.has(pairAddress)) continue;

      try {
        // 2. Query RugCheck to fetch the explicit security & on-chain distribution data
        const securityCheck = await axios.get(`https://api.rugcheck.xyz/v1/tokens/${tokenMint}/report`);
        const report = securityCheck.data;

        if (!report) continue;

        // Metric A: Calculate Top 10 Holder Distribution (Strictly below 22%)
        const holders = report.holders || [];
        const top10HoldingPct = holders.slice(0, 10).reduce((acc, current) => acc + (current.pct || 0), 0);

        if (top10HoldingPct > 22) {
          console.log(`[SKIPPED] $${pair.baseToken.symbol} - Top 10 holds ${top10HoldingPct.toFixed(1)}% (Limit: 22%)`);
          continue;
        }

        // Metric B: Verify if Liquidity Pool is Safely Locked or LP Tokens are Burned
        const markets = report.markets || [];
        const lpBurned = markets.some(m => m.lp && m.lp.lpBurned === true);
        const lpLocked = markets.some(m => m.lp && m.lp.lpLocked === true);

        if (!lpBurned && !lpLocked) {
          console.log(`[SKIPPED] $${pair.baseToken.symbol} - Liquidity is vulnerable (Not locked/burned)`);
          continue;
        }

        // 3. Validation passed! Lock token in cache & dispatch professional alert layout
        processedPairs.add(pairAddress);

        const telegramAlert = `
⚡ *SOLANA BREAKOUT SIGNAL* ⚡
────────────────────────
▶ *ASSET INFORMATION*
• *Token:* $${pair.baseToken.symbol}
• *Name:* ${pair.baseToken.name}
• *Mint:* \`${tokenMint}\`

▶ *FINANCIAL METRICS*
• *Market Cap:* $${pair.marketCap.toLocaleString()}
• *1H Trading Vol:* $${pair.volume.h1.toLocaleString()}
• *Liquidity Pool:* $${(pair.liquidity?.usd || 0).toLocaleString()}

▶ *ON-CHAIN SECURITY RISK AUDIT*
• *Top 10 Allocation:* ${top10HoldingPct.toFixed(1)}% ✅ (Below 22%)
• *Liquidity Structure:* ${lpBurned ? 'Burned 🔥' : 'Locked 🔒'} ✅

▶ *EXECUTION TERMINALS*
• [View DexScreener](${pair.url})
• [Trade on Photon](https://photon-sol.tinyastro.io/en/lp/${pairAddress})
────────────────────────
`;

        await bot.telegram.sendMessage(CHAT_ID, telegramAlert, { 
          parse_mode: 'Markdown',
          disable_web_page_preview: true 
        });
        
        console.log(`🎯 Pro Alert Dispatched for $${pair.baseToken.symbol}!`);

      } catch (innerError) {
        // Suppress individual sub-query failures to keep scanner loops moving fast
        continue;
      }
    }
  } catch (error) {
    console.error("Scanner Pipeline Warning:", error.message);
  }
}

// Optimized Pro Cycle Execution Rate: 5000ms (5 seconds)
setInterval(executeProScan, 5000);