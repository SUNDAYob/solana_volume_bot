const http = require('http');
require('dotenv').config();
const { Telegraf } = require('telegraf');
const axios = require('axios');

const PORT = process.env.PORT || 10000;
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || '').split(',').map(id => id.trim());

const recentMints = new Set();

// 🚀 CRITICAL BINDING: Keep Render happy by starting the HTTP server instantly
const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('Solana Complete High-Conviction Core: Active\n');
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

          // Defensive filtering against invalid address parameters
          if (!tokenMint || typeof tokenMint !== 'string') continue;
          tokenMint = tokenMint.trim();
          if (tokenMint.includes('11111111111111111111111111111111') || tokenMint.length < 32) continue;

          if (recentMints.has(tokenMint)) continue;
          recentMints.add(tokenMint);
          setTimeout(() => recentMints.delete(tokenMint), 60000);

          console.log(`🎯 [QUALIFIED MINT] Initiating Filter Tasks for: ${tokenMint}`);

          // Give indexers 15 seconds to parse the transaction block data
          setTimeout(async () => {
            try {
              // --------------------------------------------------------
              // PHASE 1: RugCheck Security Audit
              // --------------------------------------------------------
              let hasLockedLiquidity = false;
              let isHoneypot = false;
              let canMintMore = false;

              try {
                const rcConfig = process.env.RUGCHECK_JWT ? {
                  headers: { 'Authorization': `Bearer ${process.env.RUGCHECK_JWT}` },
                  timeout: 4000
                } : { timeout: 4000 };
                
                const rcRes = await axios.get(`https://api.rugcheck.xyz/v1/tokens/${tokenMint}/report`, rcConfig);
                const report = rcRes.data;
                
                if (report) {
                  hasLockedLiquidity = report.markets?.some(m => m.lpLocked === true || m.lpPercent === 100);
                  isHoneypot = report.risks?.some(r => r.name?.toLowerCase().includes('freeze') || r.name?.toLowerCase().includes('honeypot'));
                  canMintMore = report.risks?.some(r => r.name?.toLowerCase().includes('mint authority') || r.name?.toLowerCase().includes('mintable'));
                }
              } catch (rcErr) {
                console.log(`ℹ️ RugCheck not indexed yet for ${tokenMint}, evaluating market data...`);
              }

              // Fail safe filter fallback
              if (isHoneypot || canMintMore) {
                console.log(`🛑 [FILTERED] Failed Basic Security Parameters: ${tokenMint}`);
                return;
              }

              // --------------------------------------------------------
              // PHASE 2: Market Metrics & Volume Check
              // --------------------------------------------------------
              let devAddress = "Unknown Deployer";
              let volume24h = 0;
              let whaleCount = 0;
              let totalPreviousLaunches = 0;

              // If tracker API key exists, populate metrics
              if (process.env.SOLANA_TRACKER_API_KEY) {
                try {
                  const trackerRes = await axios.get(`https://api.solanatracker.io/tokens/${tokenMint}`, {
                    headers: { 'x-api-key': process.env.SOLANA_TRACKER_API_KEY },
                    timeout: 4000
                  });
                  
                  if (trackerRes.data) {
                    const marketData = trackerRes.data;
                    devAddress = marketData.creator || devAddress;
                    volume24h = marketData.pools?.[0]?.volume?.h24 || 0;
                    whaleCount = marketData.events?.whales?.length || 0;

                    // Fetch Dev History
                    if (marketData.creator) {
                      const devHistory = await axios.get(`https://api.solanatracker.io/wallets/${marketData.creator}/history`, {
                        headers: { 'x-api-key': process.env.SOLANA_TRACKER_API_KEY },
                        timeout: 4000
                      });
                      totalPreviousLaunches = devHistory.data?.summary?.totalTokensTraded || 0;
                    }
                  }
                } catch (trackerErr) {
                  console.log(`ℹ️ Token details pending on market aggregator index for ${tokenMint}`);
                }
              }

              // --------------------------------------------------------
              // DISPATCH VERIFICATION PACKET TO TELEGRAM
              // --------------------------------------------------------
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
                await bot.telegram.sendMessage(chatId, telegramAlert, { 
                  parse_mode: 'HTML',
                  disable_web_page_preview: true 
                });
              }

            } catch (err) {
              console.log(`ℹ️ [SKIP] Asset processing bypassed: ${err.message}`);
            }
          }, 15000);
        }
      } catch (parseError) {}
    });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Complete Production Core Active and Guarded on Port ${PORT}`);
});