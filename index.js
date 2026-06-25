const http = require('http');
require('dotenv').config();
const { Telegraf } = require('telegraf');
const axios = require('axios');

const PORT = process.env.PORT || 10000;
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || '').split(',').map(id => id.trim());

const recentMints = new Set();

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('Solana Complete Alpha Filtration Core\n');
  }

  if (req.method === 'POST' && req.url === '/helius-stream') {
    let chunks = [];
    req.on('data', chunk => { chunks.push(chunk); });
    req.on('end', async () => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('OK');

      try {
        const buffer = Buffer.concat(chunks);
        const rawBody = buffer.toString('utf8');
        if (!rawBody) return;

        const transactions = JSON.parse(rawBody);
        if (!Array.isArray(transactions)) return;

        for (const tx of transactions) {
          let tokenMint = null;
          const tokenTransfers = tx.tokenTransfers || [];
          if (tokenTransfers.length > 0 && tokenTransfers[0].tokenMint) {
            tokenMint = tokenTransfers[0].tokenMint;
          }

          if (!tokenMint || tokenMint.includes('11111111111111111111111111111111')) continue;

          // 1. Anti-Spam Gate
          if (recentMints.has(tokenMint)) continue;
          recentMints.add(tokenMint);
          setTimeout(() => recentMints.delete(tokenMint), 60000);

          // Execute matching on a 15-second delay to allow aggregate metrics to compile
          setTimeout(async () => {
            try {
              // --------------------------------------------------------
              // REQUIREMENT 1: RugCheck Security, LP Lock & Mint Authority
              // --------------------------------------------------------
              const rcConfig = process.env.RUGCHECK_JWT ? {
                headers: { 'Authorization': `Bearer ${process.env.RUGCHECK_JWT}` }
              } : {};
              
              const rcRes = await axios.get(`https://api.rugcheck.xyz/v1/tokens/${tokenMint}/report`, rcConfig);
              const report = rcRes.data;
              
              if (!report) return;

              // Validate Liquidity Lock status
              const hasLockedLiquidity = report.markets?.some(m => m.lpLocked === true || m.lpPercent === 100);
              
              // Validate Honeypot Risks
              const isHoneypot = report.risks?.some(r => r.name?.toLowerCase().includes('freeze') || r.name?.toLowerCase().includes('honeypot'));

              // Validate Mint Authority (Strictly block if dev can still mint coins)
              // RugCheck details the mint authority state in token meta properties or risk naming conventions
              const canMintMore = report.risks?.some(r => r.name?.toLowerCase().includes('mint authority') || r.name?.toLowerCase().includes('mintable'));

              if (isHoneypot || !hasLockedLiquidity || canMintMore) {
                console.log(`🛑 [FILTERED] Failed Safety Criteria (Honeypot: ${isHoneypot}, Locked LP: ${hasLockedLiquidity}, Mintable: ${canMintMore}) for ${tokenMint}`);
                return; // Silently drop unsafe tokens
              }

              // --------------------------------------------------------
              // REQUIREMENT 2, 3 & 4: Wallet Profiling, Volume, & Whales
              // --------------------------------------------------------
              const trackerRes = await axios.get(`https://api.solanatracker.io/tokens/${tokenMint}`, {
                headers: { 'x-api-key': process.env.SOLANA_TRACKER_API_KEY }
              });
              const marketData = trackerRes.data;

              if (!marketData) return;

              const devAddress = marketData.creator;
              const volume24h = marketData.pools?.[0]?.volume?.h24 || 0;
              const whaleCount = marketData.events?.whales?.length || 0;

              // Check Dev Wallet Reputation History
              const devHistory = await axios.get(`https://api.solanatracker.io/wallets/${devAddress}/history`, {
                headers: { 'x-api-key': process.env.SOLANA_TRACKER_API_KEY }
              });
              
              const totalPreviousLaunches = devHistory.data?.summary?.totalTokensTraded || 0;
              const avgHoldTime = devHistory.data?.summary?.avgHoldTimeSecs || 999;

              // If dev has launched historical tokens and instantly dumped them within 60s, flag as malicious
              if (avgHoldTime < 60 && totalPreviousLaunches > 3) {
                console.log(`🛑 [FILTERED] Dev profile marked as malicious launcher: ${devAddress}`);
                return;
              }

              // Establish parameters for active trade volume velocity (e.g., minimum $5,000 to register momentum)
              if (volume24h < 5000) { 
                console.log(`🛑 [FILTERED] Insufficient early trading volume: $${volume24h}`);
                return; 
              }

              // --------------------------------------------------------
              // PIPELINE PASSED: Dispatch High-Conviction Alert
              // --------------------------------------------------------
              const trojanTradeLink = `https://t.me/solana_trojanbot?start=r-obstech-${tokenMint}`;
              const dexScreenerLink = `https://dexscreener.com/solana/${tokenMint}`;

              const telegramAlert = `
💎 <b>HIGH CONVICTION POOL MATCHED</b> 💎
────────────────────────
▶ <b>BLOCK METADATA</b>
• <b>Token Contract:</b> <code>${tokenMint}</code>
• <b>Dev Wallet:</b> <code>${devAddress}</code>
────────────────────────
▶ <b>🛡️ AUDIT STATUS (PASSED)</b>
• <b>Liquidity Pool:</b> Locked 🔒
• <b>Mint Status:</b> Renounced (No More Minting) 🚫🖨️
• <b>Honeypot Rules:</b> Clean Pass ✅
• <b>Dev Reputation:</b> Safe History 👍 (${totalPreviousLaunches} setups found)
────────────────────────
▶ <b>📊 MARKET VELOCITY METRICS</b>
• <b>Current Volume Run:</b> $${Number(volume24h).toLocaleString()}
• <b>Active Whale Wallets:</b> ${whaleCount} tracked
────────────────────────
▶ <b>LIGHTNING TRADE EXECUTION</b>
• <a href="${dexScreenerLink}">DexScreener Market Chart</a>
• <a href="${trojanTradeLink}">⚔️ Instant Buy Entry via Trojan Bot</a>
────────────────────────
`;

              for (const chatId of CHAT_IDS) {
                if (!chatId) continue;
                await bot.telegram.sendMessage(chatId, telegramAlert, { 
                  parse_mode: 'HTML',
                  disable_web_page_preview: true 
                });
              }

            } catch (err) {
              console.log(`Scan Processing Interrupted: ${err.message}`);
            }
          }, 15000); 
        }
      } catch (parseError) {}
    });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Automated Alpha Core Active on Port ${PORT}`);
});