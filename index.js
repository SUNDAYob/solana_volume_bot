require('dotenv').config();
const express = require('express');
const { Telegraf } = require('telegraf');
const axios = require('axios');
const { Connection, PublicKey } = require('@solana/web3.js');

const app = express();
const PORT = process.env.PORT || 10000;

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || '').split(',').map(id => id.trim());

const recentMints = new Set();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const RPC_ENDPOINT = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const solanaConnection = new Connection(RPC_ENDPOINT, {
  commitment: 'confirmed',
  wsEndpoint: RPC_ENDPOINT.replace('https://', 'wss://')
});

const RAYDIUM_POOL_V4 = new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');

app.use(express.json());
app.get('/', (req, res) => res.status(200).send('🛡️ Ultra-Strict On-Chain Guard Active\n'));

const getNestedProp = (obj, paths, defaultVal = 0) => {
  for (const path of paths) {
    if (obj && obj[path] !== undefined && obj[path] !== null) return obj[path];
  }
  return defaultVal;
};

console.log('📡 Subscribing directly to Solana live logs...');
solanaConnection.onLogs(
  RAYDIUM_POOL_V4,
  async (logs) => {
    try {
      const isNewPool = logs.logs.some(log => log.includes('initialize2'));
      if (!isNewPool) return;

      (async () => {
        // ⏱️ Hold for 35 seconds to allow deep holder distribution API indexing
        await delay(35000);

        const txDetails = await solanaConnection.getParsedTransaction(logs.signature, {
          maxSupportedTransactionVersion: 0,
          commitment: 'confirmed'
        });

        if (!txDetails || !txDetails.meta || !txDetails.meta.postTokenBalances) return;

        const tokenMarket = txDetails.meta.postTokenBalances.find(balance => 
          balance.mint !== 'So11111111111111111111111111111111111111112'
        );

        if (!tokenMarket || !tokenMarket.mint) return;
        const tokenMint = tokenMarket.mint;

        if (recentMints.has(tokenMint)) return;
        recentMints.add(tokenMint);
        setTimeout(() => recentMints.delete(tokenMint), 60000);

        let gmgnData = null;
        let dexscreenerData = null;

        try {
          const gmgnResponse = await axios.get(`https://gmgn.ai/api/v1/token_security/sol/${tokenMint}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            timeout: 6000
          });
          if (gmgnResponse.data && gmgnResponse.data.data) gmgnData = gmgnResponse.data.data;
        } catch (err) {}

        try {
          const dexResponse = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`, { timeout: 4000 });
          if (dexResponse.data && dexResponse.data.pairs) dexscreenerData = dexResponse.data.pairs[0];
        } catch (err) {}

        if (!gmgnData) return;

        // --- NEW ULTRA-STRICT SECURITY PARSING ---
        const rugCount = Number(getNestedProp(gmgnData, ['creator_rug_count', 'dev_rug_count'], 0));
        const top10Rate = parseFloat(getNestedProp(gmgnData, ['top_10_holder_rate', 'holder_concentration'], 0)) * 100;
        const isHoneypot = gmgnData.is_honeypot === 1 || gmgnData.is_honeypot === true;
        
        // 🔥 CRITICAL NEW FILTER: How many total coins has this dev farmed out?
        const totalCreatedCount = Number(getNestedProp(gmgnData, ['token_created_count', 'creator_token_count'], 0));

        // Evaluate security thresholds strictly
        if (rugCount > 0) {
          console.log(`❌ [FILTERED] Rug history detected.`);
          return;
        }
        if (top10Rate > 30) {
          console.log(`❌ [FILTERED] Critical insider bundling risk: Top 10 control ${top10Rate.toFixed(1)}%`);
          return;
        }
        if (isHoneypot) {
          console.log(`❌ [FILTERED] Honeypot detected.`);
          return;
        }
        // If they have dropped more than 3 tokens in the past, they are a professional coin mill. Blocked!
        if (totalCreatedCount > 3) {
          console.log(`❌ [FILTERED] Serial deployer blocked. Total created: ${totalCreatedCount}`);
          return;
        }

        const liquidity = dexscreenerData ? Number(getNestedProp(dexscreenerData, ['liquidity', 'usd'], 0)) : 0;
        const tokenSymbol = dexscreenerData ? dexscreenerData.baseToken.symbol : gmgnData.symbol;
        const tokenName = dexscreenerData ? dexscreenerData.baseToken.name : gmgnData.name;

        const alertMessage = `
🛡️ <b>VERIFIED SECURE LAUNCH</b> 🛡️
────────────────────────
• <b>Asset:</b> ${tokenName} (${tokenSymbol})
• <b>Contract:</b> <code>${tokenMint}</code>
────────────────────────
▶ <b>SECURITY AUDIT METRICS</b>
• <b>Dev Profile:</b> Clean History
• <b>Total Dev Coins:</b> ${totalCreatedCount} Created
• <b>Top 10 Supply Rate:</b> ${top10Rate.toFixed(1)}%
• <b>Liquidity Depth:</b> $${liquidity.toLocaleString()}
────────────────────────
`;

        for (const chatId of CHAT_IDS) {
          if (!chatId) continue;
          try {
            await bot.telegram.sendMessage(chatId, alertMessage, { parse_mode: 'HTML', disable_web_page_preview: true });
          } catch (tgErr) {}
        }
      })();
    } catch (e) {}
  },
  'confirmed'
);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Strict Security Layer Listening Active on Port ${PORT}`);
});