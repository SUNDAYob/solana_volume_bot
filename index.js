const http = require('http');
require('dotenv').config();
const { Telegraf } = require('telegraf');
const axios = require('axios');

const PORT = process.env.PORT || 10000;
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || '').split(',').map(id => id.trim());

// Anti-spam deduplication cache
const recentMints = new Set();

// Helper function to pause execution for retries
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('Solana Anti-Spam Core Native: Operational\n');
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

          if (!tokenMint || tokenMint.includes('11111111111111111111111111111111')) continue;

          // 🛡️ TELEGRAM ANTI-SPAM GUARD
          if (recentMints.has(tokenMint)) {
            console.log(`♻️ [DEDUPLICATED] Skipped duplicate webhook record for: ${tokenMint}`);
            continue;
          }
          recentMints.add(tokenMint);
          setTimeout(() => recentMints.delete(tokenMint), 45000);

          console.log(`🎯 [STREAM MATCH] Target Mint Identified: ${tokenMint}`);

          // 🛡️ RUGCHECK SMART RETRY ENGINE
          let securityStatusText = "Scan Bypassed (Not Indexed) ⏱️";
          let maxRetries = 3;
          let delayBetweenRetries = 3000; // 3 seconds
          let isHoneypot = false;

          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              console.log(`🔍 Checking RugCheck for ${tokenMint} (Attempt ${attempt}/${maxRetries})...`);
              const securityCheck = await axios.get(`https://api.rugcheck.xyz/v1/tokens/${tokenMint}/report`, { timeout: 2000 });
              const report = securityCheck.data;

              if (report) {
                if (report.risks) {
                  isHoneypot = report.risks.some(risk => {
                    const name = (risk.name || '').toLowerCase();
                    return name.includes('mint') || name.includes('freeze') || name.includes('honeypot');
                  });

                  if (report.score > 4000) {
                    securityStatusText = `⚠️ High Risk (${report.score})`;
                  } else {
                    securityStatusText = `Clean Pass ✅ (${report.score || 0} pts)`;
                  }
                } else {
                  securityStatusText = "Clean Pass ✅ (0 pts)";
                }
                break; // Report fetched successfully! Break out of the retry loop.
              }
            } catch (error) {
              if (attempt < maxRetries) {
                console.log(`⏱️ Token not indexed yet on attempt ${attempt}. Waiting ${delayBetweenRetries / 1000}s...`);
                await sleep(delayBetweenRetries);
              } else {
                console.log(`❌ Max retries reached for ${tokenMint}. Proceeding with fallback status.`);
              }
            }
          }

          // If the verified retry scan flags a honeypot, drop it cleanly
          if (isHoneypot) {
            console.log(`🛑 Shield Filter dropped malicious asset: ${tokenMint}`);
            continue; 
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
  console.log(`🚀 [ENGINE ONLINE] Optimized Webhook Core active on port ${PORT}`);
});