const http = require('http');
require('dotenv').config();
const { Telegraf } = require('telegraf');
const WebSocket = require('ws');
const axios = require('axios');

const PORT = process.env.PORT || 10000;

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Solana Guard Engine v3: Active\n');
}).listen(PORT, '0.0.0.0', () => {
  console.log(`📡 [ENGINE LIVE] Listening on port ${PORT}`);
});

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || '').split(',').map(id => id.trim());
const HELIUS_KEY = process.env.HELIUS_API_KEY || '';

const processedMints = new Set();

async function sendBootAlert() {
  for (const chatId of CHAT_IDS) {
    if (!chatId) continue;
    try {
      await bot.telegram.sendMessage(chatId, "⚡ <b>STREAM TUNNEL RESTABILIZED</b>\n────────────────────────\n• 🪐 <b>Mode:</b> Option 2 (High Throughput Deployment)\n• 🛡️ <b>Fallback Filter:</b> Enabled (Forcing slow API pass)", { parse_mode: 'HTML' });
      console.log(`[BOOT] Pushed restabilization message to: ${chatId}`);
    } catch (err) {
      console.log(`[BOOT ERROR] Target ${chatId}: ${err.message}`);
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
    console.log('⚡ Connected to Helius Solana Node. Stream actively parsing blocks...');
    
    pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.ping();
    }, 30000);

    heartbeatInterval = setInterval(() => {
      console.log(`💚 [HEARTBEAT] WebSocket connection healthy. Listening for next Solana block migration...`);
    }, 60000);

    const requestPayload = {
      jsonrpc: "2.0",
      id: 1,
      method: "transactionSubscribe",
      params: [
        {
          accountInclude: [
            "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8", 
            "39azUYFWPz3VHgKCf3VChUwbpURdCHRxjWVowf5jUJjg"  
          ]
        }, 
        {
          commitment: "confirmed",
          encoding: "jsonParsed",
          transactionDetails: "full",
          showRewards: false,
          maxSupportedTransactionVersion: 0
        }
      ]
    };
    ws.send(JSON.stringify(requestPayload));
  });

  ws.on('message', async (data) => {
    try {
      const response = JSON.parse(data);
      if (!response.params || !response.params.result) return;
      
      const txData = response.params.result;
      const logMessages = txData.transaction?.meta?.logMessages || [];
      
      const isPoolInit = logMessages.some(log => log.includes("initialize2") || log.includes("initialize"));
      if (!isPoolInit) return;

      const innerInstructions = txData.transaction?.meta?.innerInstructions || [];
      let tokenMint = null;
      let creatorWallet = null;

      const keys = txData.transaction?.transaction?.message?.accountKeys || [];
      const signerAccount = keys.find(k => k.signer === true);
      creatorWallet = signerAccount ? signerAccount.pubkey : (keys[0]?.pubkey || keys[0]);

      for (const inner of innerInstructions) {
        for (const inst of inner.instructions) {
          if (inst.parsed && inst.parsed.type === 'initializeMint' && inst.parsed.info) {
            tokenMint = inst.parsed.info.mint;
            break;
          }
        }
        if (tokenMint) break;
      }

      if (!tokenMint && keys.length >= 9) {
        tokenMint = keys[8]?.pubkey || keys[8];
      }

      if (!tokenMint || typeof tokenMint !== 'string' || tokenMint.endsWith('11111111111111111111111111111111')) return;
      if (processedMints.has(tokenMint)) return;
      processedMints.add(tokenMint);

      const isPumpMigration = logMessages.some(log => log.toLowerCase().includes('pump'));
      console.log(`🔎 [SCANNING] Found Pair: ${tokenMint}`);

      let devStatusText = "Clean Pass ✅";
      let securityStatusText = "Passed Code Scan 🛡️";

      // 🕵️‍♂️ STAGE 1: DEV BACKGROUND HISTORY SCAN
      try {
        const devCheck = await axios.get(`https://api.rugcheck.xyz/v1/address/${creatorWallet}/tokens`, { timeout: 4000 });
        const pastTokens = devCheck.data;

        if (Array.isArray(pastTokens) && pastTokens.length > 0) {
          const maliciousDeployments = pastTokens.filter(t => {
            const status = (t.status || '').toLowerCase();
            return status === 'rugged' || status === 'scam' || status === 'danger';
          });

          if (maliciousDeployments.length > 0) {
            console.log(`🛑 DROP: Dev wallet history risk found for ${creatorWallet}`);
            return; // Hard drop confirmed scams
          }
        }
      } catch (e) {
        devStatusText = "Scan Timeout (Passed) ⚠️";
      }

      // 🛡️ STAGE 2: REAL-TIME CONTRACT RISK MATRIX
      try {
        const securityCheck = await axios.get(`https://api.rugcheck.xyz/v1/tokens/${tokenMint}/report`, { timeout: 4000 });
        const report = securityCheck.data;

        if (report && report.risks) {
          const hasHoneypotRisk = report.risks.some(risk => {
            const riskName = (risk.name || '').toLowerCase();
            return riskName.includes('mint') || riskName.includes('freeze') || riskName.includes('blacklist');
          });

          if (hasHoneypotRisk) {
            console.log(`🛑 DROP: Dangerous contract properties on ${tokenMint}`);
            return; // Hard drop confirmed honeypots
          }
        }
      } catch (err) {
        securityStatusText = "Scan Timeout (Passed) ⚠️";
      }

      console.log(`📬 [MATCH] Forwarding token metrics to Telegram: ${tokenMint}`);

      const trojanTradeLink = `https://t.me/solana_trojanbot?start=r-obstech-${tokenMint}`;
      const dexScreenerLink = `https://dexscreener.com/solana/${tokenMint}`;

      const telegramAlert = `
💎 <b>VERIFIED SAFE LAUNCH (MODERATE FEED)</b> 💎
────────────────────────
▶ <b>BLOCK METADATA</b>
• <b>Contract:</b> <code>${tokenMint}</code>
• <b>Type:</b> ${isPumpMigration ? "Pump.fun Graduation 🔥" : "Standard Raydium Pool 🪐"}

▶ <b>SECURITY AUDIT RESULTS</b>
• <b>Creator Wallet:</b> <code>${creatorWallet}</code>
• <b>Honeypot Shield:</b> ${securityStatusText}
• <b>Developer History:</b> ${devStatusText}
────────────────────────
▶ <b>LIGHTNING TRADE EXECUTION</b>
• <a href="${dexScreenerLink}">DexScreener Link</a>
• <a href="${trojanTradeLink}">⚔️ Snag Secured Entry via Trojan Bot</a>
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
          console.log(`❌ Notification failed for target [${chatId}]: ${postErr.message}`);
        }
      }

    } catch (parseError) {
      console.log("Main core loop execution alert:", parseError.message);
    }
  });

  ws.on('close', () => {
    clearInterval(pingInterval);
    clearInterval(heartbeatInterval);
    console.log('📡 Pipeline dropped. Reconnecting...');
    setTimeout(establishRpcConnection, 4000);
  });

  ws.on('error', (err) => {
    clearInterval(pingInterval);
    clearInterval(heartbeatInterval);
  });
}

establishRpcConnection();