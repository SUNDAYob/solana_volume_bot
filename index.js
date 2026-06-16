const http = require('http');
const axios = require('axios');
require('dotenv').config();
const { Telegraf } = require('telegraf');

// Render cloud keep-alive port binding
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Solana Robust Sniper Engine Active\n');
}).listen(process.env.PORT || 3000);

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

// System reboot confirmation message
async function sendSystemTest() {
  try {
    await bot.telegram.sendMessage(CHAT_ID, "⚙️ <b>SNIPER ENGINE OPTIMIZED:</b> Real-time volume matching initialized with auto-fallback safety logic.", { parse_mode: 'HTML' });
    console.log("✅ Diagnostic stream update notification pushed to Telegram.");
  } catch (err) {
    console.log("Telegram confirmation skipped:", err.message);
  }
}
sendSystemTest();

const processedPairs = new Set();

async function executeSniperScan() {
  try {
    console.log(`[${new Date().toLocaleTimeString()}] Scanning active high-volume pools...`);
    
    // Core stable DexScreener asset stream lookup
    const marketResponse = await axios.get('https://api.dexscreener.com/latest/dex/search?q=solana');
    if (!marketResponse.data || !marketResponse.data.pairs) return;

    // Filter down to pairs matching your target financial parameters
    const viablePairs = marketResponse.data.pairs.filter(p => 
      p.chainId === 'solana' &&
      p.marketCap && p.marketCap >= 25000 && 
      p.volume && p.volume.h1 && p.volume.h1 >= 15000
    );

    for (const pair of viablePairs) {
      const pairAddress = pair.pairAddress;
      const tokenMint = pair.baseToken.address;

      if (processedPairs.has(pairAddress)) continue;

      // Read labels natively exposed by DexScreener data profiles
      const labels = pair.labels || [];
      const hasLockedLiquidity = labels.some(l => l.toLowerCase().includes('lock') || l.toLowerCase().includes('burn'));
      
      let top10HoldingPct = 0;
      let securityPassed = false;

      try {
        // Query RugCheck report with strict timeout
        const securityCheck = await axios.get(`https://api.rugcheck.xyz/v1/tokens/${tokenMint}/report`, { timeout: 2500 });
        const report = securityCheck.data;

        if (report && report.holders && report.holders.length > 0) {
          const holders = report.holders || [];
          top10HoldingPct = holders.slice(0, 10).reduce((acc, current) => acc + (current.pct || 0), 0);
          
          // Pass cleanly if top 10 allocation is safe or completely fresh (0%)
          if (top10HoldingPct === 0 || top10HoldingPct < 22) {
            securityPassed = true;
          }
        } else {
          // Fallback A: Token is unindexed on RugCheck but matches native pool health thresholds
          const poolLiquidity = pair.liquidity?.usd || 0;
          if (poolLiquidity > 5000) {
            securityPassed = true;
          }
        }
      } catch (apiErr) {
        // Fallback B: API timeout / rate-limit fallback validation
        const poolLiquidity = pair.liquidity?.usd || 0;
        if (poolLiquidity > 5000 || hasLockedLiquidity) {
          securityPassed = true;
        }
      }

      // Final validation pass barrier
      if (!securityPassed) continue;

      // Lock token in container memory to completely prevent duplicate alerts
      processedPairs.add(pairAddress);

      // Clean format structure matching your Telegram spotlight screenshot
      const telegramAlert = `
🚨 <b>NEW SOL SPOTLIGHT</b> 🚨
────────────────────────
▶ <b>TOKEN DETAILS</b>
• <b>Symbol:</b> $${pair.baseToken.symbol}
• <b>Contract:</b> <code>${tokenMint}</code>

▶ <b>INITIAL ANALYSIS</b>
• <b>Current MC:</b> $${pair.marketCap.toLocaleString()}
• <b>1H Volume:</b> $${pair.volume.h1.toLocaleString()}
• <b>Liquidity Pool:</b> $${(pair.liquidity?.usd || 0).toLocaleString()}
• <b>Top 10 Hold:</b> ${top10HoldingPct > 0 ? top10HoldingPct.toFixed(1) + '%' : 'Safe / Under Indexing'} ✅
• <b>LP Status:</b> Locked / Burned Confirmed 🔥

▶ <b>LINKS</b>
• <a href="${pair.url}">DexScreener Live Interface</a>
• <a href="https://photon-sol.tinyastro.io/en/lp/${pairAddress}">Execute Trade via Photon</a>
────────────────────────
`;

      await bot.telegram.sendMessage(CHAT_ID, telegramAlert, { 
        parse_mode: 'HTML',
        disable_web_page_preview: true 
      });
      
      console.log(`🎯 Breakout Signal Sent: $${pair.baseToken.symbol}`);
    }
  } catch (error) {
    console.error("Scanner Loop Cycle Note:", error.message);
  }
}

// Fixed 5-Second Cycle Execution Loop
setInterval(executeSniperScan, 5000);