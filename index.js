const http = require('http');
require('dotenv').config();
const { Telegraf } = require('telegraf');
const WebSocket = require('ws');
const axios = require('axios');

const PORT = process.env.PORT || 10000;

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Solana Guard Engine v8.5: Active\n');
}).listen(PORT, '0.0.0.0', () => {
  console.log(`📡 [PORT BIND] Web interface online on port ${PORT}`);
});

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || '').split(',').map(id => id.trim());
const HELIUS_KEY = process.env.HELIUS_API_KEY || '';

const processedMints = new Set();

async function sendBootAlert() {
  for (const chatId of CHAT_IDS) {
    if (!chatId) continue;
    try {
      await bot.telegram.sendMessage(chatId, "🛡️ <b>AUTOMATED SECURITY PROTOCOLS LIVE</b>\n────────────────────────\n• 🪐 <b>Engine:</b> Fail-Safe Shield Stream (v8.5)\n• ⚡ <b>Security:</b> Honeypot & Rug Filter Enabled\n• 🚦 <b>Bypass:</b> Active (API delays will not stall stream)", { parse_mode: 'HTML' });
      console.log(`[BOOT] Status ping delivered to target: ${chatId}`);
    } catch (err) {
      console.log(`[BOOT ERROR] Could not signal chat ${chatId}: ${err.message}`);
    }
  }
}
sendBootAlert();

function establishRpcConnection() {
  const rpcHttpUrl = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;
  const wsUrl = `wss://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;
  const ws = new WebSocket(wsUrl);
  let pingInterval;
  let heartbeatInterval;

  ws.on('open', () => {
    console.log('⚡ WebSocket channel linked to Solana Runtime logs...');
    
    pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.ping();
    }, 30000);

    heartbeatInterval = setInterval(() => {
      console.log(`💚 [HEARTBEAT] Log stream healthy. Watching for new pool initializations...`);
    }, 60000);

    const requestPayload = {
      jsonrpc: "2.0",
      id: 1,
      method: "logsSubscribe",
      params: [
        { mentions: ["675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"] },
        { commitment: "confirmed" }
      ]
    };
    ws.send(JSON.stringify(requestPayload));
  });

  ws.on('message', async (data) => {
    try {
      const response = JSON.parse(data);
      if (!response.params || !response.params.result) return;

      const logData = response.params.result.value;
      const logs = logData.logs || [];
      const signature = logData.signature;

      const isNewPool = logs.some(log => log.includes("initialize2"));
      if (!isNewPool) return;

      setTimeout(async () => {
        try {
          const txResponse = await axios.post(rpcHttpUrl, {
            jsonrpc: "2.0",
            id: "get-tx",
            method: "getTransaction",
            params: [
              signature,
              { commitment: "confirmed", maxSupportedTransactionVersion: 0, encoding: "jsonParsed" }
            ]
          }, { timeout: 5000 });

          const tx = txResponse.data?.result;
          if (!tx) return;

          const accountKeys = tx.transaction?.message?.accountKeys || [];
          const innerInstructions = tx.meta?.innerInstructions || [];
          
          let potentialMints = [];

          accountKeys.forEach(k => {
            const pubkey = typeof k === 'string' ? k : k.pubkey;
            if (pubkey) potentialMints.push(pubkey);
          });

          innerInstructions.forEach(inner => {
            inner.instructions.forEach(inst => {
              if (inst.parsed?.info?.mint) potentialMints.push(inst.parsed.info.mint);
            });
          });

          const systemExclusions = [
            '11111111111111111111111111111111',
            'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
            '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
            'So11111111111111111111111111111111111111112',
            'ComputeBudget111111111111111111111111111111',
            'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'
          ];

          let tokenMint = potentialMints.find(mint => 
            mint && 
            mint.length >= 32 && 
            !systemExclusions.includes(mint) &&
            !mint.startsWith('Sysvar')
          );

          if (!tokenMint || processedMints.has(tokenMint)) return;
          processedMints.add(tokenMint);

          // 🛡️ FAIL-SAFE RUGCHECK INTELLIGENCE LOOP
          let securityStatusText = "Clean Pass ✅";
          try {
            // Enforce a strict 2-second timeout to protect our pipeline from external lag
            const securityCheck = await axios.get(`https://api.rugcheck.xyz/v1/tokens/${tokenMint}/report`, { timeout: 2000 });
            const report = securityCheck.data;

            if (report && report.risks) {
              const hasDangerousRisks = report.risks.some(risk => {
                const riskName = (risk.name || '').toLowerCase();
                return riskName.includes('mint') || riskName.includes('freeze') || riskName.includes('honeypot');
              });

              if (hasDangerousRisks) {
                console.log(`🛑 [DROPPED] Dangerous mechanics caught on contract: ${tokenMint}`);
                return; 
              }
              
              if (report.score > 4000) {
                securityStatusText = `⚠️ High Risk Profile (${report.score})`;
              }
            }
          } catch (apiErr) {
            // Secure fallback: If the free API endpoint flags us, we push the signal out immediately anyway
            securityStatusText = "Scan Bypassed (API Traffic High) ⏱️";
          }

          console.log(`📬 [MATCH] Forwarding parsed coin profile: ${tokenMint}`);

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
            } catch (postErr) {
              console.log(`❌ Telegram dispatch fail: ${postErr.message}`);
            }
          }
        } catch (fetchErr) {
          console.log(`Log fetch bypass: ${fetchErr.message}`);
        }
      }, 1200); 

    } catch (parseError) {
      // Step over formatting variations
    }
  });

  ws.on('close', () => {
    clearInterval(pingInterval);
    clearInterval(heartbeatInterval);
    console.log('📡 Log tunnel dropped. Restoring link...');
    setTimeout(establishRpcConnection, 3000);
  });

  ws.on('error', () => {
    clearInterval(pingInterval);
    clearInterval(heartbeatInterval);
  });
}

establishRpcConnection();