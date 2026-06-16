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

// DIAGNOSTIC TEST: Upgraded with strict error tracking logs
async function sendSystemTest() {
  console.log("=== TELEGRAM ENVIRONMENT DIAGNOSTICS ===");
  console.log("Bot Token Present?:", process.env.TELEGRAM_BOT_TOKEN ? "YES (Starts with: " + process.env.TELEGRAM_BOT_TOKEN.substring(0,6) + ")" : "NO");
  console.log("Chat ID Present?:", process.env.TELEGRAM_CHAT_ID ? "YES (" + process.env.TELEGRAM_CHAT_ID + ")" : "NO");
  console.log("========================================");

  try {
    if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
      throw new Error("Missing credentials entirely in process.env");
    }
    await bot.telegram.sendMessage(CHAT_ID, "🚀 <b>SOLANA SNIPER ONLINE:</b> Connection verified successfully. Waiting for high-conviction market breakouts...", { parse_mode: 'HTML' });
    console.log("✅ Diagnostic test alert successfully sent to Telegram!");
  } catch (err) {
    console.log("❌ TELEGRAM FAILURE DIAGNOSIS:", err.message);
  }
}
sendSystemTest();

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
          console.log(`[SKIPPED] $${pair.baseToken.symbol} - Liquidity vulnerable (Not locked/burned)`);
          continue;
        }

        // 3. Validation passed! Lock token in cache & dispatch professional alert layout
        processedPairs.add(pairAddress);

        const telegramAlert = `
⚡ <b>SOLANA BREAKOUT SIGNAL</b> ⚡
────────────────────────
▶ <b>ASSET INFORMATION</b>
• <b>Token:</b> $${pair.baseToken.symbol}
• <b>Name:</b> ${pair.baseToken.name}
• <b>Mint:</b> <code>${tokenMint}</code>

▶ <b>FINANCIAL METRICS</b>
• <b>Market Cap:</b> $${pair.marketCap.toLocaleString()}
• <b>1H Trading Vol:</b> $${pair.volume.h1.toLocaleString()}
• <b>Liquidity Pool:</b> $${(pair.liquidity?.usd || 0).toLocaleString()}

▶ <b>ON-CHAIN SECURITY RISK AUDIT</b>
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
        
        console.log(`🎯 Pro Alert Dispatched for $${pair.baseToken.symbol}!`);

      } catch (innerError) {
        // Suppress individual API errors to avoid breaking loop execution
        continue;
      }
    }
  } catch (error) {
    console.error("Scanner Pipeline Warning:", error.message);
  }
}

// Optimized Pro Cycle Execution Rate: 5000ms (5 seconds)
setInterval(executeProScan, 5000);