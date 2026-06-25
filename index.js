const http = require('http');
require('dotenv').config();
const { Telegraf } = require('telegraf');
const axios = require('axios');

const PORT = process.env.PORT || 10000;
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || '').split(',').map(id => id.trim());

// Create native web server without express
const server = http.createServer((req, res) => {
  // 1. Health check route for Render/UptimeRobot
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('Solana Server Core: Stable Native Protocol Live.');
  }

  // 2. Core Webhook Endpoint
  if (req.method === 'POST' && req.url === '/helius-stream') {
    let body = '';

    // Collect JSON data streams
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      // Send 200 OK back to Helius immediately
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('OK');

      try {
        if (!body) return;
        const transactions = JSON.parse(body);
        if (!Array.isArray(transactions) || transactions.length === 0) return;

        for (const tx of transactions) {
          const tokenTransfers = tx.tokenTransfers || [];
          const instructions = tx.instructions || [];
          let tokenMint = null;

          if (tokenTransfers.length > 0) {
            tokenMint = tokenTransfers[0].tokenMint;
          } else {
            const mintInstruction = instructions.find(inst => 
              inst.innerInstructions && 
              inst.innerInstructions.some(inner => inner.parsed?.type === 'initializeMint')
            );
            if (mintInstruction) {
              const inner = mintInstruction.innerInstructions.find(i => i.parsed?.type === 'initializeMint');
              tokenMint = inner.parsed?.info?.mint;
            }
          }

          if (!tokenMint || tokenMint.endsWith('11111111111111111111111111111111')) continue;

          console.log(`📬 [WEBHOOK RECOVERY] Parsed Token Address: ${tokenMint}`);

          let securityStatusText = "Clean Pass ✅";
          try {
            const securityCheck = await axios.get(`https://api.rugcheck.xyz/v1/tokens/${tokenMint}/report`, { timeout: 1800 });
            const report = securityCheck.data;

            if (report && report.risks) {
              const isHoneypot = report.risks.some(risk => {
                const riskName = (risk.name || '').toLowerCase();
                return riskName.includes('mint') || riskName.includes('freeze') || riskName.includes('honeypot');
              });

              if (isHoneypot) {
                console.log(`🛑 Blocked dangerous asset properties: ${tokenMint}`);
                continue; 
              }
              if (report.score > 4000) securityStatusText = `⚠️ High Risk (${report.score})`;
            }
          } catch {
            securityStatusText = "Scan Bypassed (Traffic High) ⏱️";
          }

          const trojanTradeLink = `https://t.me/solana_trojanbot?start=r-obstech-${tokenMint}`;
          const dexScreenerLink = `https://dexscreener.com/solana/${tokenMint}`;

          const telegramAlert = `
🔥 <b>NEW LIVE POOL DETECTED</b> 🔥
────────────────────────
▶ <b>BLOCK METADATA</b>
• <b>Token Contract:</b> <code>${tokenMint}</code>
• <b>Router Target:</b> Raydium AMM V4 🪐
────────────────────────
▶ <b>🛡️ AUTOMATED SECURITY SCAN</b>
• <b>Status Result:</b> <b>${securityStatusText}</b>
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
            } catch (err) {
              console.log(`Telegram Send Alert Error: ${err.message}`);
            }
          }
        }
      } catch (parseError) {
        console.log(`Internal Webhook Processing Bypass: ${parseError.message}`);
      }
    });
  } else {
    // Catch-all for any other routes
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 [SERVER LIVE] Listening for Webhook signals on port ${PORT}`);
});