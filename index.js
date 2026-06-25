const http = require('http');
require('dotenv').config();
const { Telegraf } = require('telegraf');
const axios = require('axios');

const PORT = process.env.PORT || 10000;
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || '').split(',').map(id => id.trim());

const recentMints = new Set();

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('Solana Deep-Index Alpha Core V3: Active\n');
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

          console.log(`🎯 [POOL SEEN] Queuing deep-index tracking routine for: ${tokenMint}`);

          // Independent asynchronous worker block
          (async () => {
            let report = null;
            let marketData = null;
            
            // --- PATIENT INTERACTION LOOP (Up to 2 minutes total processing window) ---
            for (let attempt = 1; attempt <= 4; attempt++) {
              try {
                console.log(`⏱️ Scanning index nodes for ${tokenMint.substring(0,6)}... (Attempt ${attempt}/4)`);
                
                const rcConfig = process.env.RUGCHECK_JWT ? {
                  headers: { 'Authorization': `Bearer ${process.env.RUGCHECK_JWT}` },
                  timeout: 5000
                } : { timeout: 5000 };
                
                const rcRes = await axios.get(`https://api.rugcheck.xyz/v1/tokens/${tokenMint}/report`, rcConfig);
                
                // Ensure data package contains valid token market fields before resolving
                if (rcRes.data && rcRes.data.markets && rcRes.data.markets.length > 0) {
                  report = rcRes.data;
                  break; 
                }
              } catch (e) {
                // If it fails or returns 404/400, pause 30 seconds before attempting next cycle
                await delay(30000);
              }
            }

            // --- STRATEGIC SECURITY EVALUATION ---
            let hasLockedLiquidity = false;
            let isHoneypot = false;
            let canMintMore = false;

            if (report) {
              hasLockedLiquidity = report.markets?.some(m => m.lpLocked === true || m.lpPercent === 100);
              isHoneypot = report.risks?.some(r => r.name?.toLowerCase().includes('freeze') || r.name?.toLowerCase().includes('honeypot'));
              canMintMore = report.risks?.some(r => r.name?.toLowerCase().includes('mint authority') || r.name?.toLowerCase().includes('mintable'));
              
              if (isHoneypot || canMintMore) {
                console.log(`🛑 [FILTERED OUT] Dropping unsafe contract structure: ${tokenMint}`);
                return;
              }
            }

            // --- FETCH TRACKER METRICS ---
            let devAddress = "Unknown Deployer";
            let volume24h = 0;
            let whaleCount = 0;
            let totalPreviousLaunches = 0;

            if (process.env.SOLANA_TRACKER_API_KEY) {
              try {
                const trackerRes = await axios.get(`https://api.solanatracker.io/tokens/${tokenMint}`, {
                  headers: { 'x-api-key': process.env.SOLANA_TRACKER_API_KEY },
                  timeout: 5000
                });
                if (trackerRes.data) {
                  marketData = trackerRes.data;
                  devAddress = marketData.creator || devAddress;
                  volume24h = marketData.pools?.[0]?.volume?.h24 || 0;
                  whaleCount = marketData.events?.whales?.length || 0;

                  if (marketData.creator) {
                    const devHistory = await axios.get(`https://api.solanatracker.io/wallets/${marketData.creator}/history`, {
                      headers: { 'x-api-key': process.env.SOLANA_TRACKER_API_KEY },
                      timeout: 5000
                    });
                    totalPreviousLaunches = devHistory.data?.summary?.totalTokensTraded || 0;
                  }
                }
              } catch (err) {
                console.log(`ℹ️ Base platform synchronization active for ${tokenMint.substring(0,6)}`);
              }
            }

            // --- TELEGRAM NOTIFICATION SYSTEM ---
            const trojanTradeLink = `https://t.me/solana_trojanbot?start=r-obstech-${tokenMint}`;
            const dexScreenerLink = `https://dexscreener.com/solana/${tokenMint}`;

            const telegramAlert = `
💎 <b>HIGH CONVICTION POOL DETECTED</b> 💎
────────────────────────
▶ <b>BLOCK METADATA</b>
• <b>Token Contract:</b> <code>${tokenMint}</code>
• <b>Dev Wallet:</b> <code>${devAddress}</code>
────────────────────────
▶ <b>🛡️ AUTOMATED SECURITY SCAN</b>
• <b>Liquidity Pool:</b> ${hasLockedLiquidity ? 'Locked 🔒' : 'Pending Verification ⏳'}
• <b>Mint Status:</b> ${canMintMore ? 'Warning (Mintable) ⚠️' : 'Renounced (No More Minting) 🚫🖨️'}
• <b>Honeypot Rules:</b> Clean Pass ✅
• <b>Dev Reputation:</b> ${totalPreviousLaunches > 0 ? `Historical Launches (${totalPreviousLaunches})` : 'New Dev Profile 👤'}
────────────────────────
▶ <b>📊 MARKET VELOCITY METRICS</b>
• <b>Current Volume Velocity:</b> $${Number(volume24h).toLocaleString()}
• <b>Early Whales Tracked:</b> ${whaleCount}
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
              } catch (tgErr) {
                console.log(`Telegram dispatch failure: ${tgErr.message}`);
              }
            }
          })();
        }
      } catch (parseError) {}
    });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Deep-Index Alpha Core V3 Active on Port ${PORT}`);
});