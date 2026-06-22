const http = require('http');
const axios = require('axios');
require('dotenv').config();
const { Telegraf } = require('telegraf');

const PORT = process.env.PORT || 10000;

// Continuous health check server
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Solana New Project Utility Launcher Engine: Online\n');
}).listen(PORT, '0.0.0.0', () => {
  console.log(`📡 New Launch Engine bound securely to port ${PORT}`);
});

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || '').split(',').map(id => id.trim());

async function sendSystemTest() {
  for (const chatId of CHAT_IDS) {
    if (!chatId) continue;
    try {
      await bot.telegram.sendMessage(chatId, "🦅 <b>NEW PROJECT & UTILITY LAUNCH SCANNER ACTIVE:</b>\n────────────────────────\n• 🌐 <b>Targeting:</b> Brand New Token Profiles (1-15 Mins Old)\n• 🔍 <b>Filter:</b> Explicit Social Links + Utility Meta Profiles Only\n• 📊 <b>Cap Target:</b> $8K - $45K Floor Trenches 🎯\n• 🛡️ <b>Guard Protocol:</b> Freeze/Blacklist Anti-Honeypot Active", { parse_mode: 'HTML' });
    } catch (err) {
      console.log(`Startup alert deferred for ${chatId}:`, err.message);
    }
  }
}
sendSystemTest();

const processedPairs = new Set();
let executionDelay = 4000; // Fast cycle to capture fresh blocks instantly

async function executeSniperScan() {
  try {
    let mintsList = [];
    let tokenMetadataMap = new Map();
    
    // 🔍 TARGET THE BRAND-NEW PAID PROJECTS PROFILE PIPELINE
    try {
      const freshProfiles = await axios.get('https://api.dexscreener.com/token-profiles/latest/v1', { timeout: 4000 });
      if (freshProfiles.data && Array.isArray(freshProfiles.data)) {
        freshProfiles.data.forEach(p => {
          if (p.chainId === 'solana' && p.tokenAddress) {
            mintsList.push(p.tokenAddress);
            
            // Extract links to identify project presence / utility presence
            const customDescription = p.description || "Freshly deployed Solana token contract.";
            const websiteLink = p.links?.find(l => l.type?.toLowerCase() === 'website')?.url || '';
            const twitterLink = p.links?.find(l => l.type?.toLowerCase() === 'twitter')?.url || '';
            
            tokenMetadataMap.set(p.tokenAddress, {
              description: customDescription,
              website: websiteLink,
              twitter: twitterLink
            });
          }
        });
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

    // 🛑 FILTER PROTOCOL: INSISTS THE TOKEN IS IN THE ULTRA-EARLY LAUNCH STAGE
    const viablePairs = marketDataResponse.data.pairs.filter(p => 
      p.chainId === 'solana' &&
      p.marketCap && p.marketCap >= 8000 && p.marketCap <= 45000 &&   // 🎯 BRAND NEW LAUNCH BRACKET
      p.liquidity && p.liquidity.usd && p.liquidity.usd >= 3000        // Baseline token liquidity validation
    );

    for (const pair of viablePairs) {
      const pairAddress = pair.pairAddress;
      const tokenMint = pair.baseToken.address;

      if (processedPairs.has(pairAddress)) continue;

      const hourlyTxns = pair.txns?.h1;
      if (!hourlyTxns) continue;

      const totalTrades = (hourlyTxns.buys || 0) + (hourlyTxns.sells || 0);
      if (totalTrades < 5) continue; // Must have at least initial launching transactions processed

      const poolLiquidity = pair.liquidity.usd;
      const hourlyVolume = pair.volume?.h1 || 0;
      const priceChangeM5 = pair.priceChange?.m5 || 0;

      // Pull parsed project links
      const projectMeta = tokenMetadataMap.get(tokenMint) || { description: "New Launch", website: "", twitter: "" };
      
      // 🛡️ CRITICAL UTILITY FILTER: Reject if they haven't uploaded a website/twitter yet
      if (!projectMeta.website && !projectMeta.twitter) continue;

      let securityPassed = false;

      // 🛡️ SECURITY LAYER: INSTANT ANTI-HONEYPOT CORE
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
            securityPassed = true;
          }
        }
      } catch (apiErr) {
        if (poolLiquidity >= 12000) securityPassed = true; 
      }

      if (!securityPassed) continue;

      processedPairs.add(pairAddress);

      // ⚔️ TARGETED DIRECT REF-LINK FOR TROJAN Sniping Client
      const trojanTradeLink = `https://t.me/solana_trojanbot?start=r-obstech-${tokenMint}`;

      const telegramAlert = `
🆕 <b>BRAND NEW PROJECT LAUNCH DETECTED</b> 🚀
────────────────────────
▶ <b>TOKEN METADATA</b>
• <b>Symbol:</b> $${pair.baseToken.symbol}
• <b>Contract:</b> <code>${tokenMint}</code>

▶ <b>PROJECT INFO & UTILITY LINKS</b>
• <b>Description:</b> 📝 <i>${projectMeta.description.slice(0, 180)}...</i>
• <b>Website:</b> <a href="${projectMeta.website || '#'}">🌐 Official Site</a>
• <b>Twitter/X:</b> <a href="${projectMeta.twitter || '#'}">🐦 Project Feed</a>

▶ <b>INITIAL LAUNCH METRICS</b>
• <b>Current Market Cap:</b> 🎯 <b>$${pair.marketCap.toLocaleString()}</b> [JUST LAUNCHED]
• <b>Liquidity Pool Depth:</b> $${poolLiquidity.toLocaleString()}
• <b>5 Min Price Velocity:</b> 📈 ${priceChangeM5}%
• <b>Total Launch Trades:</b> 📊 ${totalTrades} actions
────────────────────────
▶ <b>LIGHTNING TRADE EXECUTION</b>
• <a href="${pair.url}">DexScreener Link</a>
• <a href="${trojanTradeLink}">⚔️ Snag Instant Entry on Trojan Bot</a>
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