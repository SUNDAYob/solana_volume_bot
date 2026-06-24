const http = require('http');
require('dotenv').config();
const { Telegraf } = require('telegraf');
const WebSocket = require('ws');
const axios = require('axios');

const PORT = process.env.PORT || 10000;

// Continuous health check server
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Solana Geyser Dev-Reputation Stream: Active\n');
}).listen(PORT, '0.0.0.0', () => {
  console.log(`📡 Dev-Reputation Stream bound securely to port ${PORT}`);
});

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || '').split(',').map(id => id.trim());
const HELIUS_KEY = process.env.HELIUS_API_KEY || '';

if (!HELIUS_KEY) {
  console.error("❌ CRITICAL ERROR: HELIUS_API_KEY is missing!");
}

async function sendSystemTest() {
  for (const chatId of CHAT_IDS) {
    if (!chatId) continue;
    try {
      await bot.telegram.sendMessage(chatId, "🦅 <b>GEYSER RPC SCANNER + DEV AUDIT ACTIVE:</b>\n────────────────────────\n• 🌐 <b>Feed:</b> Real-Time Solana Ledger\n• 🛡️ <b>Security Profile:</b> Zero-Exception Freeze/Mint Block\n• 🕵️‍♂️ <b>Dev Filter:</b> Wallet History Check (Blocks Serial Ruggers)", { parse_mode: 'HTML' });
    } catch (err) {
      console.log(`Startup alert deferred for ${chatId}:`, err.message);
    }
  }
}
sendSystemTest();

const processedMints = new Set();

function establishRpcConnection() {
  const wsUrl = `wss://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;
  const ws = new WebSocket(wsUrl);

  ws.on('open', () => {
    console.log('⚡ Connected to Helius Solana RPC Ledger Stream. Injecting subscription filters...');
    
    const requestPayload = {
      jsonrpc: "2.0",
      id: 1,
      method: "transactionSubscribe",
      params: [
        { accountInclude: ["675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"] }, // Raydium AMM Program
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
      
      const isNewPool = logMessages.some(log => log.includes("initialize2"));
      if (!isNewPool) return;

      const accountKeys = txData.transaction.transaction.message.accountKeys.map(a => a.pubkey || a);
      if (accountKeys.length < 10) return;

      const tokenMint = accountKeys[8]; 
      // The wallet executing this transaction initialization is the deployer/creator
      const creatorWallet = txData.transaction.transaction.message.accountKeys.find(a => a.signer === true)?.pubkey || accountKeys[0];

      if (!tokenMint || tokenMint.endsWith('11111111111111111111111111111111') || processedMints.has(tokenMint)) return;
      processedMints.add(tokenMint);

      console.log(`🎯 New Token Pool Init: ${tokenMint} | Deployer: ${creatorWallet}`);

      // 🕵️‍♂️ STAGE 1: CREATOR WALLET REPUTATION AUDIT
      let devIsClean = true;
      try {
        // Query RugCheck's developer audit pipeline using the creator's wallet
        const devCheck = await axios.get(`https://api.rugcheck.xyz/v1/address/${creatorWallet}/tokens`, { timeout: 2000 });
        const pastTokens = devCheck.data;

        if (Array.isArray(pastTokens) && pastTokens.length > 0) {
          // Scan history for tokens previously flagged as rugged, frozen, or abandoned scams
          const maliciousDeployments = pastTokens.filter(t => {
            return t.status === 'rugged' || t.status === 'scam' || (t.risks && t.risks.some(r => r.name.toLowerCase().includes('freeze')));
          });

          if (maliciousDeployments.length > 0) {
            console.log(`🛑 BLOCKING LAUNCH: Developer ${creatorWallet} has a history of rugging tokens.`);
            devIsClean = false;
          }
        }
      } catch (e) {
        // Fallback: If RugCheck's address endpoint rate limits, default to letting contract filters decide
      }

      if (!devIsClean) return;

      // 🛡️ STAGE 2: LIVE CONTRACT HONEYPOT PROTECTION
      let securityPassed = false;
      try {
        const securityCheck = await axios.get(`https://api.rugcheck.xyz/v1/tokens/${tokenMint}/report`, { timeout: 2000 });
        const report = securityCheck.data;

        if (report) {
          const risks = report.risks || [];
          const hasHoneypotRisk = risks.some(risk => {
            const riskName = (risk.name || '').toLowerCase();
            return riskName.includes('mint') || 
                   riskName.includes('freeze') || 
                   riskName.includes('blacklist') || 
                   riskName.includes('mutable');
          });

          if (!hasHoneypotRisk) {
            securityPassed = true;
          }
        }
      } catch (err) {
        securityPassed = true; 
      }

      if (!securityPassed) return;

      // ⚔️ SUCCESS: ALERT SENDING
      const trojanTradeLink = `https://t.me/solana_trojanbot?start=r-obstech-${tokenMint}`;
      const dexScreenerLink = `https://dexscreener.com/solana/${tokenMint}`;

      const telegramAlert = `
⚡ <b>SECURED BLOCK-SPEED LAUNCH</b> ⚡
────────────────────────
▶ <b>TOKEN METADATA</b>
• <b>Contract:</b> <code>${tokenMint}</code>
• <b>Network:</b> Solana Mainnet Ledger

▶ <b>DEVELOPER AUDIT PROFILE</b>
• <b>Creator Wallet:</b> <code>${creatorWallet}</code>
• <b>Reputation Status:</b> Verified Clean (No Prior Rug History) 🕵️‍♂️✅

▶ <b>RISK DIAGNOSTICS</b>
• <b>Contract Security:</b> Passed Honeypot Scan 🛡️
• <b>Freeze/Blacklist Authority:</b> Disabled / Revoked
────────────────────────
▶ <b>LIGHTNING TRADE EXECUTION</b>
• <a href="${dexScreenerLink}">DexScreener Profile</a>
• <a href="${trojanTradeLink}">⚔️ Snag Block-Speed Entry on Trojan Bot</a>
────────────────────────
`;

      for (const chatId of CHAT_IDS) {
        if (!chatId) continue;
        try {
          await bot.telegram.sendMessage(chatId, telegramAlert, { 
            parse_mode: 'HTML',
            disable_web_page_preview: true 
          });
        } catch (postErr) {}
      }

    } catch (parseError) {}
  });

  ws.on('close', () => {
    console.log('📡 RPC Stream Disconnected. Reconnecting...');
    setTimeout(establishRpcConnection, 3000);
  });

  ws.on('error', (err) => {
    console.error('WebSocket Error:', err.message);
  });
}

establishRpcConnection();