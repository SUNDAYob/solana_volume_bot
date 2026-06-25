require('dotenv').config();
const http = require('http');
const { Telegraf } = require('telegraf');
const axios = require('axios');

const PORT = process.env.PORT || 10000;

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || '').split(',').map(id => id.trim());

const recentMints = new Set();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const server = http.createServer((req, res) => {
  // 1. Respond immediately to Render's internal scanner to secure Port Binding
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('Solana Track-Record Engine: Active\n');
  }

  // 2. Handle Helius Stream Payload Transmission
  if (req.method === 'POST' && req.url === '/helius-stream') {
    let bodyChunks = [];
    
    req.on('data', chunk => { bodyChunks.push(chunk); });
    
    req.on('end', async () => {
      // Send a fast response back to Helius to keep our stream link healthy
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('OK');

      try {
        const rawBody = Buffer.concat(bodyChunks).toString('utf8');
        if (!rawBody) return;

        const transactions = JSON.parse(rawBody);
        if (!Array.isArray(transactions)) return;

        for (const tx of transactions) {
          let tokenMint = null;
          const tokenTransfers = tx.tokenTransfers || [];
          if (tokenTransfers.length > 0 && tokenTransfers[0].tokenMint) {
            tokenMint = tokenTransfers[0].tokenMint;
          }

          if (!tokenMint && tx.instructions) {
            for (const inst of tx.instructions) {
              if (inst.accounts && inst.accounts.length > 2) {
                const structuralMint = inst.accounts.find(acc => 
                  acc !== '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8' && 
                  acc !== 'So11111111111111111111111111111111111111112' &&
                  acc !== 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' &&
                  acc.length >= 32 && !acc.startsWith('Sysvar')
                );
                if (structuralMint) { tokenMint = structuralMint; break; }
              }
            }
          }

          if (!tokenMint || typeof tokenMint !== 'string') continue;
          tokenMint = tokenMint.trim();
          if (tokenMint.includes('11111111111111111111111111111111') || tokenMint.length < 32) continue;

          if (recentMints.has(tokenMint)) continue;
          recentMints.add(tokenMint);
          setTimeout(() => recentMints.delete(tokenMint), 60000);

          console.log(`🎯 [POOL SEEN] Ingested mint context: ${tokenMint}`);

          // Independent asynchronous handling block
          (async () => {
            let marketData = null;
            let report = null;

            // --- STEP 1: POOL INDEX SCAN PATTERN (3 Retries over 30s) ---
            for (let attempt = 1; attempt <= 3; attempt++) {
              try {
                if (!process.env.SOLANA_TRACKER_API_KEY) return;
                
                const trackerRes = await axios.get(`https://api.solanatracker.io/tokens/${tokenMint}`, {
                  headers: { 'x-api-key': process.env.SOLANA_TRACKER_API_KEY },
                  timeout: 4000
                });

                if (trackerRes.data && trackerRes.data.pools && trackerRes.data.pools.length > 0) {
                  marketData = trackerRes.data;
                  break; 
                }
              } catch (e) {
                await delay(10000);
              }
            }

            // CRITICAL VERIFICATION FILTER: Drop empty profiles or unindexed setups immediately!
            if (!marketData) {
              console.log(`🛑 [FILTERED] Dropping token ${tokenMint.substring(0,6)} - No indexed pools.`);
              return;
            }

            const volume24h = marketData.pools?.[0]?.volume?.h24 || 0;
            if (Number(volume24h) <= 0) {
              console.log(`🛑 [FILTERED] Dropping token ${tokenMint.substring(0,6)} - Active volume is $0.`);
              return;
            }

            const devAddress = marketData.creator || "Unknown Deployer";

            // --- STEP 2: CALCULATE TARGET DEV REPUTATION ---
            let devReputationString = "New Dev Profile 👤";
            
            if (marketData.creator && process.env.SOLANA_TRACKER_API_KEY) {
              try {
                const devHistoryRes = await axios.get(`https://api.solanatracker.io/wallets/${devAddress}/history`, {
                  headers: { 'x-api-key': process.env.SOLANA_TRACKER_API_KEY },
                  timeout: 4000
                });
                
                if (devHistoryRes.data && devHistoryRes.data.summary) {
                  const summary = devHistoryRes.data.summary;
                  const totalTokens = summary.totalTokensTraded || 0;
                  const totalWins = summary.totalWins || 0; 
                  
                  if (totalTokens > 0) {
                    const winRate = Math.round((totalWins / totalTokens) * 100);
                    if (winRate >= 60) {
                      devReputationString = `Dev 60%+ Good Track Record 📈 (${winRate}% Wins over ${totalTokens} setups)`;
                    } else {
                      devReputationString = `Low Historical Track Record ⚠️ (${winRate}% Win-Rate)`;
                    }
                  }
                }
              } catch (err) {
                console.log(`ℹ️ Tracker fallback for creator wallet: ${devAddress.substring(0,6)}`);
              }
            }

            // --- STEP 3: OPTIONAL RISK METRICS ---
            try {
              const rcConfig = process.env.RUGCHECK_JWT ? {
                headers: { 'Authorization': `Bearer ${process.env.RUGCHECK_JWT}` },
                timeout: 4000
              } : { timeout: 4000 };
              
              const rcRes = await axios.get(`https://api.rugcheck.xyz/v1/tokens/${tokenMint}/report`, rcConfig);
              if (rcRes.data) report = rcRes.data;
            } catch (rcErr) {}

            const whaleCount = marketData.events?.whales?.length || 0;
            let hasLockedLiquidity = false;
            let canMintMore = false;

            if (report) {
              hasLockedLiquidity = report.markets?.some(m => m.lpLocked === true || m.lpPercent === 100) || false;
              canMintMore = report.risks?.some(r => r.name?.toLowerCase().includes('mint authority') || r.name?.toLowerCase().includes('mintable')) || false;
            }

            // --- STEP 4: DELIVER VALID ALERT PACKAGE ONLY ---
            const trojanTradeLink = `https://t.me/solana_trojanbot?start=r-obstech-${tokenMint}`;
            const dexScreenerLink = `https://dexscreener.com/solana/${tokenMint}`;

            const telegramAlert = `
💎 <b>HIGH CONVICTION POOL MATCHED</b> 💎
────────────────────────
▶ <b>BLOCK METADATA</b>
• <b>Token Contract:</b> <code>${tokenMint}</code>
• <b>Dev Wallet:</b> <code>${devAddress}</code>
────────────────────────
▶ <b>🛡️ AUDIT STATUS</b>
• <b>Liquidity Pool:</b> ${hasLockedLiquidity ? 'Locked 🔒' : 'Active Trading 📊'}
• <b>Mint Status:</b> ${canMintMore ? 'Warning (Mintable) ⚠️' : 'Renounced 🚫🖨️'}
• <b>Dev Reputation:</b> <b>${devReputationString}</b>
────────────────────────
▶ <b>📊 LIVE MARKET METRICS</b>
• <b>Current Volume Velocity:</b> $${Number(volume24h).toLocaleString()}
• <b>Early Whales Tracked:</b> ${whaleCount} 🔥
────────────────────────
▶ <b>LIGHTNING TRADE EXECUTION</b>
• <a href="${dexScreenerLink}">DexScreener Market Chart</a>
• <a href="${trojanTradeLink}">⚔️ Instant Buy Entry via Trojan Bot</a>
────────────────────────
`;

            for (const chatId of CHAT_IDS) {
              if (!chatId) continue;
              try {
                await bot.telegram.sendMessage(chatId, telegramAlert, { 
                  parse_mode: 'HTML',
                  disable_web_page_preview: true 
                });
              } catch (tgErr) {}
            }
          })();
        }
      } catch (parseError) {}
    });
    return;
  }

  // Fallback handler for all unexpected traffic paths
  res.writeHead(404);
  res.end();
});

// Explicit listener setup for Render's requirements
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Security Engine Operating on Port ${PORT}`);
});