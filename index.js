const http = require('http');
const axios = require('axios');
require('dotenv').config();
const { Telegraf } = require('telegraf');

// Maintain port binding to keep Render Free Tier alive
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Solana Pro Scanner Running\n');
}).listen(process.env.PORT || 3000);

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

// DIAGNOSTIC STARTUP CHECK
async function sendSystemTest() {
  try {
    await bot.telegram.sendMessage(CHAT_ID, "🚀 <b>SOLANA SNIPER STREAM ACTIVE:</b> Switched to high-velocity token tracking pipelines. Scanning for strict parameter matches...", { parse_mode: 'HTML' });
    console.log("✅ Diagnostic stream update notification pushed to Telegram.");
  } catch (err) {
    console.log("❌ Telegram Failure Diagnosis:", err.message);
  }
}
sendSystemTest();

// Cache to handle tracking and avoid duplicate alerts
const processedPairs = new Set();

async function executeProScan() {
  try {
    console.log(`[${new Date().toLocaleTimeString()}] Accessing high-velocity token streams...`);
    
    // Switch from text search query to DexScreener Token Boosts endpoint for immediate trending volume data
    const marketResponse = await axios.get('https://api.dexscreener.com/token-boosts/top/v1');
    if (!marketResponse.data || !Array.isArray(marketResponse.data)) return;

    // Extract unique token mint profiles from the stream
    const hotMints = marketResponse.data.slice(0, 30).map(item => item.tokenAddress);
    if (hotMints.length === 0) return;

    // Pull the complete multi-pair metadata array for these active items
    const profilesResponse = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${hotMints.join(',')}`);
    if (!profilesResponse.data || !profilesResponse.data.pairs) return;

    // Filter baseline configurations based on your precise strict metrics
    const targetedPairs = profilesResponse.data.pairs.filter(p => 
      p.chainId === 'solana' &&
      p.marketCap && p.marketCap >= 25000 &&       // Market cap $25k upward
      p.volume && p.volume.h1 && p.volume.h1 >= 15000 // High 1-Hour trading volume threshold
    );

    for (const pair of targetedPairs) {
      const pairAddress = pair.pairAddress;
      const tokenMint = pair.baseToken.address;

      if (processedPairs.has(pairAddress)) continue;

      try {
        // Query RugCheck API engine for granular security properties
        const securityCheck = await axios.get(`https://api.rugcheck.xyz/v1/tokens/${tokenMint}/report`, { timeout: 3000 });
        const report = securityCheck.data;

        if (!report) continue;

        // Metric A: Validate Top 10 Holder Distribution (Strictly below 22%)
        const holders = report.holders || [];
        const top10HoldingPct = holders.slice(0, 10).reduce((acc, current) => acc + (current.pct || 0), 0);

        if (top10HoldingPct > 22 || top10HoldingPct === 0) {
          console.log(` -> [SKIPPED] $${pair.baseToken.symbol} - Concentrated Distribution: ${top10HoldingPct.toFixed(1)}%`);
          continue;
        }

        // Metric B: Verify if Liquidity Pool is Safely Locked or LP Tokens are Burned
        const markets = report.markets || [];
        const lpBurned = markets.some(m => m.lp && m.lp.lpBurned === true);
        const lpLocked = markets.some(m => m.lp && m.lp.lpLocked === true);

        if (!lpBurned && !lpLocked) {
          console.log(` -> [SKIPPED] $${pair.baseToken.symbol} - Vulnerable Liquidity (Unlocked/Unburned)`);
          continue;
        }

        // Cache registration to guarantee no duplicate signal alerts populate your chat
        processedPairs.add(pairAddress);

        const telegramAlert = `
⚡ <b>SOLANA PRO BREAKOUT</b> ⚡
────────────────────────
▶ <b>ASSET INFORMATION</b>
• <b>Token:</b> $${pair.baseToken.symbol}
• <b>Name:</b> ${pair.baseToken.name}
• <b>Mint:</b> <code>${tokenMint}</code>

▶ <b>FINANCIAL METRICS</b>
• <b>Market Cap:</b> $${pair.marketCap.toLocaleString()}
• <b>1H Trading Vol:</b> $${pair.volume.h1.toLocaleString()}
• <b>Liquidity Pool:</b> $${(pair.liquidity?.usd || 0).toLocaleString()}

▶ <b>ON-CHAIN SECURITY AUDIT</b>
• <b>Top 10 Allocation:</b> ${top10HoldingPct.toFixed(1)}% ✅ (Below 22%)
• <b>Liquidity Structure:</b> ${lpBurned ? 'Burned 🔥' : 'Locked 🔒'} ✅

▶ <b>EXECUTION TERMINALS</b>
• <a href="${pair.url}">View DexScreener</a>
• <a href="https://photon-sol.tinyastro.io/en/lp/${pairAddress}">Trade on Photon</a>
────────────────────────
`;

        await bot.telegram.sendMessage(CHAT_ID, telegramAlert, { 
          parse_mode: 'HTML',
          disable_web_page_preview: true 
        });
        
        console.log(`🎯 Breakout Alert Dispatched to Telegram for $${pair.baseToken.symbol}!`);

      } catch (innerError) {
        // Fail-safe pass-through for network rate limits on external data reports
        continue;
      }
    }
  } catch (error) {
    console.error("Scanner Pipeline Stream Warning:", error.message);
  }
}

// 5-Second Pro Cycle Execution Rate
setInterval(executeProScan, 5000);