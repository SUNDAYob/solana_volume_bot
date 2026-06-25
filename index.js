const http = require('http');
require('dotenv').config();
const { Telegraf } = require('telegraf');
const WebSocket = require('ws');
const axios = require('axios');

const PORT = process.env.PORT || 10000;

// Keep-alive web portal for Render & UptimeRobot
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Solana Direct Log Engine v7: Active\n');
}).listen(PORT, '0.0.0.0', () => {
  console.log(`📡 [PORT BIND] Web interface online on port ${PORT}`);
});

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || '').split(',').map(id => id.trim());
const HELIUS_KEY = process.env.HELIUS_API_KEY || '';

const processedSignatures = new Set();

async function sendBootAlert() {
  for (const chatId of CHAT_IDS) {
    if (!chatId) continue;
    try {
      await bot.telegram.sendMessage(chatId, "🎯 <b>LIGHTSPEED LOG CORES ONLINE</b>\n────────────────────────\n• 🪐 <b>Engine:</b> Log Subscription Filter (v7)\n• ⚡ <b>Throughput:</b> Zero-Buffer Blockchain Capture\n• 🛡️ <b>Status:</b> Listening for Raydium Initializations...", { parse_mode: 'HTML' });
      console.log(`[BOOT] Status ping delivered to target: ${chatId}`);
    } catch (err) {
      console.log(`[BOOT ERROR] Could not signal chat ${chatId}: ${err.message}`);
    }
  }
}
sendBootAlert();

function establishRpcConnection() {
  // Use the standard Helius RPC HTTP URL for fast transaction lookups
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

    // Subscribe ONLY to Raydium Program logs mentioning initialize2
    const requestPayload = {
      jsonrpc: "2.0",
      id: 1,
      method: "logsSubscribe",
      params: [
        {
          mentions: ["675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"]
        },
        {
          commitment: "confirmed"
        }
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

      // Check for Raydium pool creation signature
      const isNewPool = logs.some(log => log.includes("initialize2"));
      if (!isNewPool) return;

      if (processedSignatures.has(signature)) return;
      processedSignatures.add(signature);

      console.log(`🚀 [FOUND POOL] Raydium creation signature identified: ${signature}`);

      // Fetch the transaction details via standard HTTP post to prevent WebSocket choking
      setTimeout(async () => {
        try {
          const txResponse = await axios.post(rpcHttpUrl, {
            jsonrpc: "2.0",
            id: "get-tx",
            method: "getTransaction",
            params: [
              signature,
              {
                commitment: "confirmed",
                maxSupportedTransactionVersion: 0,
                encoding: "jsonParsed"
              }
            ]
          }, { timeout: 5000 });

          const tx = txResponse.data?.result;
          if (!tx) return;

          const accountKeys = tx.transaction?.message?.accountKeys || [];
          let tokenMint = null;

          // Extract token mint from account logs or internal keys
          if (accountKeys.length >= 9) {
            tokenMint = accountKeys[8]?.pubkey || accountKeys[8];
          }

          if (!tokenMint || typeof tokenMint !== 'string' || tokenMint.endsWith('11111111111111111111111111111111')) return;

          console.log(`📬 [MATCH] Forwarding verified mint: ${tokenMint}`);

          const trojanTradeLink = `https://t.me/solana_trojanbot?start=r-obstech-${tokenMint}`;
          const dexScreenerLink = `https://dexscreener.com/solana/${tokenMint}`;

          const telegramAlert = `
🔥 <b>NEW LIVE POOL DETECTED</b> 🔥
────────────────────────
▶ <b>BLOCK METADATA</b>
• <b>Token Contract:</b> <code>${tokenMint}</code>
• <b>Router Target:</b> Raydium AMM V4 🪐
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
          console.log(`⚠️ Transaction parsing bypassed: ${fetchErr.message}`);
        }
      }, 1000); // Tiny 1-second delay to ensure ledger index matches perfectly

    } catch (parseError) {
      // Step over formatting variations gracefully
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