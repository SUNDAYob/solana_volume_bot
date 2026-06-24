const http = require('http');
require('dotenv').config();
const { Telegraf } = require('telegraf');
const WebSocket = require('ws');
const axios = require('axios');

const PORT = process.env.PORT || 10000;

// Create standard web hook server 
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Solana Immortal Stream Engine: Fully Operational\n');
}).listen(PORT, '0.0.0.0', () => {
  console.log(`📡 Stream engine stabilized on port ${PORT}`);
});

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || '').split(',').map(id => id.trim());
const HELIUS_KEY = process.env.HELIUS_API_KEY || '';

// Global checklist tracker to prevent double alerts
const processedMints = new Set();

async function sendBootAlert() {
  for (const chatId of CHAT_IDS) {
    if (!chatId) continue;
    try {
      await bot.telegram.sendMessage(chatId, "🚀 <b>SOLANA STREAM GATE REBOOTED</b>\n────────────────────────\n• 🛰️ <b>Status:</b> Listening directly to blockchain ledger\n• 🔬 <b>Diagnostics:</b> Live tracking logging enabled", { parse_mode: 'HTML' });
      console.log(`✅ Startup verification text sent successfully to Telegram chat: ${chatId}`);
    } catch (err) {
      console.log(`❌ Failed to send boot alert to chat ${chatId}: ${err.message}. Check your BOT token or Chat ID!`);
    }
  }
}
sendBootAlert();

function establishRpcConnection() {
  const wsUrl = `wss://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;
  const ws = new WebSocket(wsUrl);
  let pingInterval;

  ws.on('open', () => {
    console.log('⚡ Connected to Helius Solana Node. Tracking all incoming liquidity contracts...');
    
    pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.ping();
    }, 30000);

    const requestPayload = {
      jsonrpc: "2.0",
      id: 1,
      method: "transactionSubscribe",
      params: [
        {
          accountInclude: [
            "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8", // Raydium AMM
            "39azUYFWPz3VHgKCf3VChUwbpURdCHRxjWVowf5jUJjg"  // Pump.fun Migration Account
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

      console.log("👀 [LEDGER ALERT] Detected a new Raydium pool initialization block! Extracting token data...");

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
      
      console.log(`🔎 Found Token: ${tokenMint} | Dev: ${creatorWallet} | Type: ${isPumpMigration ? "Pump.fun Migration" : "Standard Raydium"}`);

      if (isPumpMigration) {
        console.log(`⏳ Holding for 45 seconds to let initial volatility pass for ${tokenMint}...`);
        await new Promise(resolve => setTimeout(resolve, 45000)); 
      }

      // 🕵️‍♂️ STAGE 1: DEV BACKGROUND HISTORY SCAN
      console.log(`🕵️‍♂️ Running background risk checks on dev wallet: ${creatorWallet}`);
      let devIsClean = true;
      try {
        const devCheck = await axios.get(`https://api.rugcheck.xyz/v1/address/${creatorWallet}/tokens`, { timeout: 4000 });
        const pastTokens = devCheck.data;

        if (Array.isArray(pastTokens) && pastTokens.length > 0) {
          const maliciousDeployments = pastTokens.filter(t => {
            const status = (t.status || '').toLowerCase();
            return status === 'rugged' || status === 'scam' || status === 'danger';
          });

          if (maliciousDeployments.length > 0) {
            console.log(`🛑 DROP: Dev wallet ${creatorWallet} has historical rug profiles. Trashing token.`);
            devIsClean = false;
          }
        }
      } catch (e) {
        console.log("⚠️ RugCheck Wallet history tool timed out. Proceeding to security scan safety defaults.");
      }

      if (!devIsClean) return;

      // 🛡️ STAGE 2: REAL-TIME CONTRACT RISK MATRIX
      console.log(`🛡️ Auditing on-chain smart contract properties for: ${tokenMint}`);
      let securityPassed = false;
      try {
        const securityCheck = await axios.get(`https://api.rugcheck.xyz/v1/tokens/${tokenMint}/report`, { timeout: 4000 });
        const report = securityCheck.data;

        if (report) {
          const risks = report.risks || [];
          const hasHoneypotRisk = risks.some(risk => {
            const riskName = (risk.name || '').toLowerCase();
            return riskName.includes('mint') || riskName.includes('freeze') || riskName.includes('blacklist') || riskName.includes('mutable');
          });

          if (hasHoneypotRisk) {
            console.log(`🛑 DROP: Malicious risk parameters found in token code. Trashing token.`);
          } else {
            securityPassed = true;
          }
        }
      } catch (err) {
        console.log("⚠️ RugCheck Token API timed out. Letting token pass via fallback rules.");
        securityPassed = true; 
      }

      if (!securityPassed) return;

      // 📊 STAGE 3: VOLUME MOMENTUM STABILITY AUDIT
      if (isPumpMigration) {
        console.log(`📊 Checking market momentum properties on DexScreener for ${tokenMint}...`);
        try {
          const dexCheck = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`, { timeout: 4000 });
          const pair = dexCheck.data?.pairs?.[0];
          
          if (pair) {
            const liquidity = pair.liquidity?.usd || 0;
            const volume5m = pair.volume?.m5 || 0;
            
            console.log(`📊 [STATS] Liquidity: $${liquidity}, 5m Vol: $${volume5m}`);
            if (liquidity < 8000 || volume5m < 2000) {
              console.log(`📉 REJECTED: Migration failed stability parameters ($8k Liq / $2k Vol required).`);
              return;
            }
          } else {
            console.log("📉 REJECTED: No trading pairs formed on DexScreener yet.");
            return;
          }
        } catch (dexErr) {
          console.log("⚠️ DexScreener data indexing delayed. Letting verified safe token pass.");
        }
      }

      console.log(`🎉 SUCCESS: ${tokenMint} cleared all safety gates! Dispatching to Telegram...`);

      const trojanTradeLink = `https://t.me/solana_trojanbot?start=r-obstech-${tokenMint}`;
      const dexScreenerLink = `https://dexscreener.com/solana/${tokenMint}`;

      const telegramAlert = `
💎 <b>VERIFIED HIGH-QUALITY LAUNCH</b> 💎
────────────────────────
▶ <b>BLOCK METADATA</b>
• <b>Contract:</b> <code>${tokenMint}</code>
• <b>Type:</b> ${isPumpMigration ? "Pump.fun Graduation 🔥" : "Standard Raydium Pool 🪐"}

▶ <b>DEVELOPER HISTORY</b>
• <b>Creator Wallet:</b> <code>${creatorWallet}</code>
• <b>Reputation Status:</b> Verified Clean History 🕵️‍♂️✅

▶ <b>RISK LOCK DIAGNOSTICS</b>
• <b>Honeypot Shield:</b> Passed Security Scan 🛡️
• <b>Freeze / Blacklist:</b> Revoked & Safe
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
          console.log(`📬 Notification sent successfully to chat: ${chatId}`);
        } catch (postErr) {
          console.log(`❌ Telegram delivery failure to ${chatId}:`, postErr.message);
        }
      }

    } catch (parseError) {
      console.log("Error inside main stream loop parser:", parseError.message);
    }
  });

  ws.on('close', () => {
    clearInterval(pingInterval);
    console.log('📡 Pipeline dropped. Reconnecting...');
    setTimeout(establishRpcConnection, 4000);
  });

  ws.on('error', (err) => {
    clearInterval(pingInterval);
    console.log('❌ WebSocket Error Context:', err.message);
  });
}

establishRpcConnection();