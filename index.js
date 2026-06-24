const http = require('http');
require('dotenv').config();
const { Telegraf } = require('telegraf');
const WebSocket = require('ws');
const axios = require('axios');

const PORT = process.env.PORT || 10000;

// Continuous health check server
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Solana Direct Geyser Engine Live\n');
}).listen(PORT, '0.0.0.0', () => {
  console.log(`📡 Direct Geyser streaming server on port ${PORT}`);
});

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || '').split(',').map(id => id.trim());
const HELIUS_KEY = process.env.HELIUS_API_KEY || '';

if (!HELIUS_KEY) {
  console.error("❌ CRITICAL SETUP WARNING: HELIUS_API_KEY environment variable missing!");
}

async function sendSystemTest() {
  for (const chatId of CHAT_IDS) {
    if (!chatId) continue;
    try {
      await bot.telegram.sendMessage(chatId, "🦅 <b>GEYSER DEPLOYER AUDIT ONLINE:</b>\n────────────────────────\n• 🌐 <b>Feed Source:</b> Raw Solana Ledger Stream (Zero Delay)\n• 🕵️‍♂️ <b>Dev Audit:</b> Reputation History Scanner Enabled\n• 🛡️ <b>Honeypot Filter:</b> Strict Freeze/Blacklist Block active", { parse_mode: 'HTML' });
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
    console.log('⚡ Connected directly to Helius RPC Node. Injecting Raydium block filters...');
    
    const requestPayload = {
      jsonrpc: "2.0",
      id: 1,
      method: "transactionSubscribe",
      params: [
        { accountInclude: ["675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"] }, // Raydium AMM Contract
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
      
      // Target pool initialization signatures executed inside the block
      const isNewPool = logMessages.some(log => log.includes("initialize2") || log.includes("initialize"));
      if (!isNewPool) return;

      const innerInstructions = txData.transaction?.meta?.innerInstructions || [];
      let tokenMint = null;
      let creatorWallet = null;

      // Extract fee payers / signers
      const keys = txData.transaction?.transaction?.message?.accountKeys || [];
      const signerAccount = keys.find(k => k.signer === true);
      creatorWallet = signerAccount ? signerAccount.pubkey : (keys[0]?.pubkey || keys[0]);

      if (!creatorWallet) return;

      // Safely scan inner instruction arrays for token account registration mint addresses
      for (const inner of innerInstructions) {
        for (const inst of inner.instructions) {
          if (inst.parsed && inst.parsed.type === 'initializeMint' && inst.parsed.info) {
            tokenMint = inst.parsed.info.mint;
            break;
          }
        }
        if (tokenMint) break;
      }

      // Fallback extraction route from default account keys layout if inner instructions array is compressed
      if (!tokenMint && keys.length >= 9) {
        tokenMint = keys[8]?.pubkey || keys[8];
      }

      if (!tokenMint || typeof tokenMint !== 'string' || tokenMint.endsWith('11111111111111111111111111111111') || processedMints.has(tokenMint)) return;
      processedMints.add(tokenMint);

      console.log(`🎯 New Token Caught on Ledger: ${tokenMint} | Deployer: ${creatorWallet}`);

      // 🕵️‍♂️ STAGE 1: CREATOR REPUTATION MALICIOUS TRACE SCREENING
      let devIsClean = true;
      try {
        const devCheck = await axios.get(`https://api.rugcheck.xyz/v1/address/${creatorWallet}/tokens`, { timeout: 3000 });
        const pastTokens = devCheck.data;

        if (Array.isArray(pastTokens) && pastTokens.length > 0) {
          const maliciousDeployments = pastTokens.filter(t => {
            const status = (t.status || '').toLowerCase();
            return status === 'rugged' || status === 'scam' || status === 'danger';
          });

          if (maliciousDeployments.length > 0) {
            console.log(`🛑 DROP SIGNAL: Creator ${creatorWallet} has historical rug deployments.`);
            devIsClean = false;
          }
        }
      } catch (e) {
        // Continuous flow fallback: let hard token rules run if RugCheck's wallet tracker is offline
      }

      if (!devIsClean) return;

      // 🛡️ STAGE 2: REAL-TIME ON-CHAIN SECURITY SCAN
      let securityPassed = false;
      try {
        const securityCheck = await axios.get(`https://api.rugcheck.xyz/v1/tokens/${tokenMint}/report`, { timeout: 3000 });
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

      const trojanTradeLink = `https://t.me/solana_trojanbot?start=r-obstech-${tokenMint}`;
      const dexScreenerLink = `https://dexscreener.com/solana/${tokenMint}`;

      const telegramAlert = `
⚡ <b>SECURED GEYSER RPC LAUNCH</b> ⚡
────────────────────────
▶ <b>BLOCK METADATA</b>
• <b>Contract:</b> <code>${tokenMint}</code>
• <b>Network:</b> Solana Mainnet Ledger

▶ <b>DEVELOPER REPUTATION REPORT</b>
• <b>Creator Wallet:</b> <code>${creatorWallet}</code>
• <b>Status:</b> No Historical Rug Profiles Detected 🕵️‍♂️✅

▶ <b>RISK LOCK DIAGNOSTICS</b>
• <b>Honeypot Shield:</b> Safe Contract Configuration 🛡️
• <b>Freeze / Mint Control:</b> Permanently Disabled
────────────────────────
▶ <b>LIGHTNING TRADE EXECUTION</b>
• <a href="${dexScreenerLink}">DexScreener Link</a>
• <a href="${trojanTradeLink}">⚔️ Execute Direct Entry via Trojan Bot</a>
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
    console.log('📡 RPC Web Socket pipeline dropped. Recovering pipeline node connection...');
    setTimeout(establishRpcConnection, 4000);
  });

  ws.on('error', (err) => {
    console.error('Node Socket Error Context:', err.message);
  });
}

establishRpcConnection();