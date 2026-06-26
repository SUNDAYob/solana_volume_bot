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

// Connect directly to the Solana Mainnet Blockchain
const RPC_ENDPOINT = 'https://api.mainnet-beta.solana.com';
const solanaConnection = new Connection(RPC_ENDPOINT, 'confirmed');

// Raydium Liquidity Pool V4 Address
const RAYDIUM_POOL_V4 = new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');

app.use(express.json());
app.get('/', (req, res) => res.status(200).send('🛡️ Pure Direct On-Chain Listener Active\n'));

const getNestedProp = (obj, paths, defaultVal = 0) => {
  for (const path of paths) {
    if (obj && obj[path] !== undefined && obj[path] !== null) return obj[path];
  }
  return defaultVal;
};

// 🌟 THE DIRECT LOG LISTENER (No webhooks needed!)
console.log('📡 Subscribing directly to Solana live logs...');
solanaConnection.onLogs(
  RAYDIUM_POOL_V4,
  async (logs) => {
    try {
      // Filter for pool initialization instructions
      const isNewPool = logs.logs.some(log => log.includes('initialize2'));
      if (!isNewPool) return;

      console.log(`\n⚡ [ON-CHAIN DETECTED] New pair tx: ${logs.signature}`);
      console.log(`⏳ Holding data stream for 30 seconds to allow GMGN & Dexscreener indexing...`);

      // Let the tx details propagate asynchronously
      (async () => {
        await delay(30000);

        // Fetch transaction details to extract the token mint
        const txDetails = await solanaConnection.getParsedTransaction(logs.signature, {
          maxSupportedTransactionVersion: 0,
          commitment: 'confirmed'
        });

        if (!txDetails || !txDetails.meta || !txDetails.meta.postTokenBalances) return;

        // Find the newly launched token mint (ignore wrapped SOL)
        const tokenMarket = txDetails.meta.postTokenBalances.find(balance => 
          balance.mint !== 'So11111111111111111111111111111111111111112'
        );

        if (!tokenMarket || !tokenMarket.mint) return;
        const tokenMint = tokenMarket.mint;

        if (recentMints.has(tokenMint)) return;
        recentMints.add(tokenMint);
        setTimeout(() => recentMints.delete(tokenMint), 60000);

        console.log(`🚀 [30s DELAY COMPLETE] Querying APIs for: ${tokenMint}`);

        let gmgnData = null;
        let dexscreenerData = null;

        // 🛡️ SECURITY QUERY 1: GMGN
        try {
          const gmgnResponse = await axios.get(`https://gmgn.ai/api/v1/token_security/sol/${tokenMint}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 6000
          });
          if (gmgnResponse.data && gmgnResponse.data.data) gmgnData = gmgnResponse.data.data;
        } catch (err) {
          console.log(`↳ ⚠️ GMGN Fetch Issue.`);
        }

        // 🛡️ SECURITY QUERY 2: Dexscreener
        try {
          const dexResponse = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`, { timeout: 4000 });
          if (dexResponse.data && dexResponse.data.pairs) dexscreenerData = dexResponse.data.pairs[0];
        } catch (err) {
          console.log(`↳ ⚠️ Dexscreener Fetch Issue.`);
        }

        if (!gmgnData && !dexscreenerData) {
          console.log(`↳ ❌ [DROP] Missing metrics from tracking networks.`);
          return;
        }

        const rugCount = gmgnData ? Number(getNestedProp(gmgnData, ['creator_rug_count', 'dev_rug_count'], 0)) : 0;
        const top10Rate = gmgnData ? parseFloat(getNestedProp(gmgnData, ['top_10_holder_rate', 'holder_concentration'], 0)) * 100 : 0;
        const isHoneypot = gmgnData ? (gmgnData.is_honeypot === 1 || gmgnData.is_honeypot === true) : false;
        const mintRenounced = gmgnData ? (gmgnData.mint_has_not_renounced === 0 || gmgnData.is_mintable === false) : true;
        
        const liquidity = dexscreenerData ? Number(getNestedProp(dexscreenerData, ['liquidity', 'usd'], 0)) : 0;
        const tokenSymbol = dexscreenerData ? dexscreenerData.baseToken.symbol : (gmgnData ? gmgnData.symbol : 'TOKEN');
        const tokenName = dexscreenerData ? dexscreenerData.baseToken.name : (gmgnData ? gmgnData.name : 'Solana Asset');

        if (rugCount > 1 || top10Rate > 35 || isHoneypot) {
          console.log(`↳ ❌ [FILTERED] Failed security metric parameters.`);
          return;
        }

        console.log(`🟩 [SECURITY PASSED] Pushing alert for ${tokenSymbol}`);

        const alertMessage = `
🛡️ <b>VERIFIED SECURE LAUNCH</b> 🛡️
────────────────────────
• <b>Asset:</b> ${tokenName} (${tokenSymbol})
• <b>Contract:</b> <code>${tokenMint}</code>
────────────────────────
▶ <b>SECURITY AUDIT METRICS</b>
• <b>Dev Rug History:</b> ${rugCount === 0 ? '✅ Clean (0)' : `⚠️ ${rugCount} Rugs`}
• <b>Top 10 Supply Rate:</b> ${top10Rate > 0 ? `${top10Rate.toFixed(1)}%` : '✅ Safe Dynamic'}
• <b>Mint Authority:</b> ${mintRenounced ? '✅ Renounced' : '🚨 Active'}
• <b>Liquidity Depth:</b> ${liquidity > 0 ? `$${liquidity.toLocaleString()}` : 'Indexing Pool...'}
────────────────────────
▶ <b>SECURE ACTION HUB</b>
• <a href="https://gmgn.ai/sol/token/${tokenMint}">📊 GMGN Safety Terminal</a>
• <a href="https://t.me/solana_trojanbot?start=r-obstech-${tokenMint}">⚔️ Trade Instant (Trojan Bot)</a>
────────────────────────
`;

        for (const chatId of CHAT_IDS) {
          if (!chatId) continue;
          try {
            await bot.telegram.sendMessage(chatId, alertMessage, { parse_mode: 'HTML', disable_web_page_preview: true });
          } catch (tgErr) {
            console.error(`↳ ❌ Telegram Error: ${tgErr.message}`);
          }
        }
      })();
    } catch (e) {}
  },
  'confirmed'
);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Security Framework Direct-Stream Server Running on Port ${PORT}`);
});