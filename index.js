const http = require('http');
require('dotenv').config();
const { Telegraf } = require('telegraf');
const axios = require('axios');

const PORT = process.env.PORT || 10000;
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || '').split(',').map(id => id.trim());

const server = http.createServer((req, res) => {
  // 1. Health Ping
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('Solana Dynamic Core Native: Operational\n');
  }

  // 2. High-Catch Webhook Endpoint
  if (req.method === 'POST' && req.url === '/helius-stream') {
    let chunks = [];

    req.on('data', chunk => { chunks.push(chunk); });
    req.on('end', async () => {
      // Release Helius thread immediately
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
          
          // Strategy A: Check Token Arrays
          const tokenTransfers = tx.tokenTransfers || [];
          if (tokenTransfers.length > 0 && tokenTransfers[0].tokenMint) {
            tokenMint = tokenTransfers[0].tokenMint;
          }

          // Strategy B: Deep System Instruction Scan Fallback
          if (!tokenMint && tx.instructions) {
            for (const inst of tx.instructions) {
              // Check outer accounts
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

          // Safety Gate
          if (!tokenMint || tokenMint.includes('11111111111111111111111111111111')) continue;

          console.log(`🎯 [STREAM MATCH] Target Mint Identified: ${tokenMint}`);

          let securityStatusText = "Clean Pass ✅";
          try {
            const securityCheck = await axios.get(`https://api.rugcheck.xyz/v1/tokens/${tokenMint}/report`, { timeout: 1500 });
            const report = securityCheck.data;

            if (report && report.risks) {
              const isHoneypot = report.risks.some(risk => {
                const name = (risk.name || '').toLowerCase();
                return name.includes('mint') || name.includes('freeze') || name.includes('honeypot');
              });

              if (isHoneypot) {
                console.log(`🛑 Shield Filter dropped malicious asset: ${tokenMint}`);
                continue; 
              }
              if (report.score > 4000) securityStatusText = `⚠️ High Risk (${report.score})`;
            }
          } catch {
            securityStatusText = "Scan Bypassed (Traffic Peak) ⏱️";
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
              console.log(`Telegram Dispatch Failure: ${err.message}`);
            }
          }
        }
      } catch (parseError) {
        // Step over structural discrepancies cleanly
      }
    });
  } else if (req.url !== '/') {
    res.writeHead(404);
    res.end();
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 [ENGINE ONLINE] Multi-Strategy Webhook Core active on port ${PORT}`);
});