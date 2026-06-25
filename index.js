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
    return res.end('Solana Production Filtration Core: Active\n');
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

          // 🛡️ STRICT VALIDATION GATE: Eradicate 400 Bad Requests completely
          if (!tokenMint || typeof tokenMint !== 'string') continue;
          tokenMint = tokenMint.trim();
          
          if (
            tokenMint.includes('11111111111111111111111111111111') || 
            tokenMint === 'So11111111111111111111111111111111111111112' ||
            tokenMint.toLowerCase() === 'undefined' ||
            tokenMint.length < 32
          ) {
            continue; 
          }

          if (recentMints.has(tokenMint)) continue;
          recentMints.add(tokenMint);
          setTimeout(() => recentMints.delete(tokenMint), 60000);

          console.log(`🎯 [QUALIFIED MINT] Initiating Filter Tasks for: ${tokenMint}`);

          setTimeout(async () => {
            try {
              // 1. RugCheck API Setup
              const rcConfig = process.env.RUGCHECK_JWT ? {
                headers: { 'Authorization': `Bearer ${process.env.RUGCHECK_JWT}` },
                timeout: 3000
              } : { timeout: 3000 };
              
              const rcRes = await axios.get(`https://api.rugcheck.xyz/v1/tokens/${tokenMint}/report`, rcConfig);
              const report = rcRes.data;
              if (!report) return;

              const hasLockedLiquidity = report.markets?.some(m => m.lpLocked === true || m.lpPercent === 100);
              const isHoneypot = report.risks?.some(r => r.name?.toLowerCase().includes('freeze') || r.name?.toLowerCase().includes('honeypot'));
              const canMintMore = report.risks?.some(r => r.name?.toLowerCase().includes('mint authority') || r.name?.toLowerCase().includes('mintable'));

              if (isHoneypot || !hasLockedLiquidity || canMintMore) {
                console.log(`🛑 [FILTERED] Failed Security Check: ${tokenMint}`);
                return; 
              }

              // 2. Data Provider Request Setup
              if (!process.env.SOLANA_TRACKER_API_KEY) {
                console.log("⚠️ Missing SOLANA_TRACKER_API_KEY in environment variables configuration.");
                return;
              }

              const trackerRes = await axios.get(`https://api.solanatracker.io/tokens/${tokenMint}`, {
                headers: { 'x-api-key': process.env.SOLANA_TRACKER_API_KEY },
                timeout: 3000
              });
              
              const marketData = trackerRes.data;
              if (!marketData || !marketData.creator) return;

              const devAddress = marketData.creator;
              const volume24h = marketData.pools?.[0]?.volume?.h24 || 0;
              const whaleCount = marketData.events?.whales?.length || 0;

              // 3. Dev Wallet History Profiling
              const devHistory = await axios.get(`https://api.solanatracker.io/wallets/${devAddress}/history`, {
                headers: { 'x-api-key': process.env.SOLANA_TRACKER_API_KEY },
                timeout: 3000
              });
              
              const totalPreviousLaunches = devHistory.data?.summary?.totalTokensTraded || 0;
              const avgHoldTime = devHistory.data?.summary?.avgHoldTimeSecs || 999;

              if (avgHoldTime < 60 && totalPreviousLaunches > 3) {
                console.log(`🛑 [FILTERED] Malicious Dev profile flagged: ${devAddress}`);
                return;
              }

              if (volume24h < 5000) return; 

              // Send Telegram Notification
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
              // Gracefully handle specific token omissions without cluttering log displays
              console.log(`ℹ️ [SKIP] Asset processing bypassed: ${err.message}`);
            }
          }, 15000); 
        }
      } catch (parseError) {}
    });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Production Core Active and Guarded on Port ${PORT}`);
});