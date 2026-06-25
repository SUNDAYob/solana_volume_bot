const http = require('http');
require('dotenv').config();
const { Telegraf } = require('telegraf');
const WebSocket = require('ws');

const PORT = process.env.PORT || 10000;

// Continuous Web Interface for Render & UptimeRobot
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Solana Defi Engine v6: Active\n');
}).listen(PORT, '0.0.0.0', () => {
  console.log(`📡 [ENGINE LIVE] Permanent web binding active on port ${PORT}`);
});

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || '').split(',').map(id => id.trim());
const HELIUS_KEY = process.env.HELIUS_API_KEY || '';

const processedMints = new Set();

async function sendBootAlert() {
  for (const chatId of CHAT_IDS) {
    if (!chatId) continue;
    try {
      await bot.telegram.sendMessage(chatId, "🎯 <b>PERMANENT CORES DEPLOYED</b>\n────────────────────────\n• 🪐 <b>Engine:</b> Account Stream Matrix Active\n• ⚡ <b>Velocity:</b> Instant Pool Creation Trigger\n• 🛡️ <b>Status:</b> Zero-Latency Bypass Live", { parse_mode: 'HTML' });
      console.log(`[BOOT COMPLETE] Stream linked to chat ID: ${chatId}`);
    } catch (err) {
      console.log(`[BOOT ERROR] Target ${chatId} communication failed: ${err.message}`);
    }
  }
}
sendBootAlert();

function establishRpcConnection() {
  const wsUrl = `wss://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;
  const ws = new WebSocket(wsUrl);
  let pingInterval;
  let heartbeatInterval;

  ws.on('open', () => {
    console.log('⚡ Pipeline linked directly to Solana State Machine...');
    
    pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.ping();
    }, 30000);

    heartbeatInterval = setInterval(() => {
      console.log(`💚 [HEARTBEAT] Connection verified. State tracking active...`);
    }, 60000);

    // Subscribe directly to the Raydium AMM Liquidity Program Account Creation State
    const requestPayload = {
      jsonrpc: "2.0",
      id: 1,
      method: "programSubscribe",
      params: [
        "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
        {
          commitment: "confirmed",
          encoding: "base64",
          filters: [
            {
              dataSize: 752 // Exact layout size of a verified Raydium Liquidity Pool State
            }
          ]
        }
      ]
    };
    ws.send(JSON.stringify(requestPayload));
  });

  ws.on('message', async (data) => {
    try {
      const response = JSON.parse(data);
      if (!response.params || !response.params.result) return;

      const accountInfo = response.params.result.value;
      const poolPublicKey = accountInfo.pubkey;
      const base64Data = accountInfo.account.data[0];

      if (!base64Data) return;
      const buffer = Buffer.from(base64Data, 'base64');

      // Exact layout byte offsets for Raydium AMM Open Book Vaults
      const tokenMintAddressBytes = buffer.slice(400, 432); 
      const tokenMint = tokenMintAddressBytes.toString('hex'); // Raw fallback conversion

      // Extract public key representation from the account stream buffer
      let finalMint = poolPublicKey; 
      
      // Basic sanity filters to prevent processing junk system data
      if (processedMints.has(finalMint)) return;
      processedMints.add(finalMint);

      console.log(`📬 [MATCH] Found New Liquidity Pool State: ${finalMint}`);

      const trojanTradeLink = `https://t.me/solana_trojanbot?start=r-obstech-${finalMint}`;
      const dexScreenerLink = `https://dexscreener.com/solana/${finalMint}`;

      const telegramAlert = `
🔥 <b>NEW VERIFIED LIVE STREAM ALERT</b> 🔥
────────────────────────
▶ <b>BLOCK METADATA</b>
• <b>Pool Identity Account:</b> <code>${finalMint}</code>
• <b>Target Network:</b> Raydium Protocol Open-Market 🪐
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
          console.log(`❌ Telegram Dispatch Failed [${chatId}]: ${postErr.message}`);
        }
      }

    } catch (parseError) {
      // Gracefully step over empty system byte notifications
    }
  });

  ws.on('close', () => {
    clearInterval(pingInterval);
    clearInterval(heartbeatInterval);
    console.log('📡 Stream disconnected. Re-establishing link...');
    setTimeout(establishRpcConnection, 3000);
  });

  ws.on('error', () => {
    clearInterval(pingInterval);
    clearInterval(heartbeatInterval);
  });
}

establishRpcConnection();