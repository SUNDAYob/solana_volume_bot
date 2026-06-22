const http = require('http');
const axios = require('axios');
require('dotenv').config();
const { Telegraf } = require('telegraf');

const PORT = process.env.PORT || 10000;

// Continuous health check server
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Solana Real Utility Project Engine: Online\n');
}).listen(PORT, '0.0.0.0', () => {
  console.log(`📡 Utility Scanner bound securely to port ${PORT}`);
});

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || '').split(',').map(id => id.trim());

async function sendSystemTest() {
  for (const chatId of CHAT_IDS) {
    if (!chatId) continue;
    try {
      await bot.telegram.sendMessage(chatId, "🦅 <b>REAL UTILITY & DEPLOYED PROJECT ENGINE ACTIVE:</b>\n────────────────────────\n• 🌐 <b>Mode:</b> Strict Deployed Project Tracking (No Raw Memes)\n• 🔍 <b>Verification:</b> Deep Profile Text Audit + Live URLs\n• 📊 <b>Liquidity Floor:</b> $15,000 Deep Pools (Blocks Trench Spam)\n• 🛡️ <b>Guard Protocol:</b> Freeze/Blacklist Anti-Honeypot Active", { parse_mode: 'HTML' });
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
    let tokenMetadataMap = new Map();
    
    // 🔍 SCAN THE REAL-TIME PROFILE PIPELINE TO EXTRACT PROJECT WEB METADATA
    try {
      const freshProfiles = await axios.get('https://api.dexscreener.com/token-profiles/latest/v1', { timeout: 4000 });
      if (freshProfiles.data && Array.isArray(freshProfiles.data)) {
        freshProfiles.data.forEach(p => {
          if (p.chainId === 'solana' && p.tokenAddress) {
            mintsList.push(p.tokenAddress);
            
            const customDescription = p.description || "";
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
      executionDelay = 5000; 
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

    // 🛑 UTILITY FILTER PROTOCOL: INSISTS ON HIGHER CAPITAL STANDARDS
    const viablePairs = marketDataResponse.data.pairs.filter(p => 
      p.chainId === 'solana' &&
      p.marketCap && p.marketCap >= 15000 && p.marketCap <= 150000 &&   // Early-stage token valuation bracket
      p.liquidity && p.liquidity.usd && p.liquidity.usd >= 15000 &&     // 🔥 DEEP LIQUIDITY FLOOR: Discards small, dangerous meme micro-pools
      p.volume && p.volume.h1 && p.volume.h1 >= 10000                  // Verifies initial transactional activity
    );

    for (const pair of viablePairs) {
      const pairAddress = pair.pairAddress;
      const tokenMint = pair.baseToken.address;

      if (processedPairs.has(pairAddress)) continue;

      const hourlyTxns = pair.txns?.h1;
      if (!hourlyTxns) continue;

      const poolLiquidity = pair.liquidity.usd;
      const hourlyVolume = pair.volume?.h1 || 0;
      const priceChangeM5 = pair.priceChange?.m5 || 0;

      // Pull and examine metadata content
      const projectMeta = tokenMetadataMap.get(tokenMint) || { description: "", website: "", twitter: "" };
      
      // 🛑 RULE 1: STRICT LINKS REQUIREMENT
      if (!projectMeta.website) continue; 

      // 🛑 RULE 2: ANTI-MEME TEXT HEURISTICS
      const descText = projectMeta.description.toLowerCase();
      const memeKeywords = ['meme', 'dog', 'cat', 'inu', 'pepe', 'wif', 'viral', 'chill guy', 'pump', 'moon', 'fugu'];
      const hasMemeSign = memeKeywords.some(keyword => descText.includes(keyword));
      if (hasMemeSign) continue; // Instantly bypasses basic meme descriptions

      // 🛑 RULE 3: POSITIVE UTILITY SIGNALS CHECK
      const utilityKeywords = ['utility', 'tool', 'bot', 'dapp', 'protocol', 'ai agent', 'platform', 'api', 'ecosystem', 'saas', 'software', 'staking', 'yield'];
      const hasUtilitySign = utilityKeywords.some(keyword => descText.includes(keyword));
      
      // If description isn't blank, we prefer it to have an explicit operational signal
      if (descText.length > 0 && !hasUtilitySign) continue;

      let securityPassed = false;

      // 🛡️ ANTI-HONEYPOT BLOCKER CORE
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
        if (poolLiquidity >= 25000) securityPassed = true; 
      }

      if (!securityPassed) continue;

      processedPairs.add(pairAddress);

      // ⚔️ TARGETED DIRECT REF-LINK ROUTING TO TROJAN
      const trojanTradeLink = `https://t.me/solana_trojanbot?start=r-obstech-${tokenMint}`;

      const telegramAlert = `
🛠️ <b>NEW UTILITY PROJECT LAUNCH</b> 🛠️
────────────────────────
▶ <b>PROJECT IDENTIFICATION</b>
• <b>Symbol:</b> $${pair.baseToken.symbol}
• <b>Contract:</b> <code>${tokenMint}</code>

▶ <b>APPLICATION METADATA</b>
• <b>Core Purpose:</b> 📝 <i>${projectMeta.description ? projectMeta.description.slice(0, 200) : "Operational platform deployment."}...</i>
• <b>Official App/Site:</b> <a href="${projectMeta.website}">🌐 Open dApp Website</a>
• <b>Developer Feed:</b> <a href="${projectMeta.twitter || '#'}">🐦 View Documentation/X</a>

▶ <b>MARKET VALIDATION</b>
• <b>Market Capitalization:</b> $${pair.marketCap.toLocaleString()}
• <b>Liquidity Pool Depth:</b> 📊 <b>$${poolLiquidity.toLocaleString()}</b> [STABLE DEPLOY]
• <b>5 Min Price Move:</b> 📈 ${priceChangeM5}%
────────────────────────
▶ <b>LIGHTNING TRADE EXECUTION</b>
• <a href="${pair.url}">DexScreener Link</a>
• <a href="${trojanTradeLink}">⚔️ Trade Utility Token via Trojan Bot</a>
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