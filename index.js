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

// 🎯 TARGET: Official Pump.fun Core Mint Program
const PUMP_FUN_PROGRAM = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');

app.use(express.json());
app.get('/', (req, res) => res.status(200).send('🛡️ Pump.fun Live Shield Active\n'));

const getNestedProp = (obj, paths, defaultVal = 0) => {
  for (const path of paths) {
    if (obj && obj[path] !== undefined && obj[path] !== null) return obj[path];
  }
  return defaultVal;
};

console.log('📡 Subscribing directly to Pump.fun live creation logs...');
solanaConnection.onLogs(
  PUMP_FUN_PROGRAM,
  async (logs) => {
    try {
      // Catch tokens the exact millisecond they are minted on Pump.fun
      const isNewMint = logs.logs.some(log => log.includes('Instruction: Create'));
      if (!isNewMint) return;

      (async () => {
        // ⏱️ Hold 30 seconds to allow GMGN indexing and holder metadata processing
        await delay(30000);

        const txDetails = await solanaConnection.getParsedTransaction(logs.signature, {
          maxSupportedTransactionVersion: 0,
          commitment: 'confirmed'
        });

        if (!txDetails || !txDetails.meta || !txDetails.meta.postTokenBalances) return;

        // Extract the new token's mint address from transaction balance adjustments
        const tokenMarket = txDetails.meta.postTokenBalances.find(balance => 
          balance.owner === '11111111111111111111111111111111' || 
          (balance.mint && balance.mint !== 'So11111111111111111111111111111111111111112')
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
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 6000
          });
          if (gmgnResponse.data && gmgnResponse.data.data) gmgnData = gmgnResponse.data.data;
        } catch (err) {}

        try {
          const dexResponse = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`, { timeout: 4000 });
          if (dexResponse.data && dexResponse.data.pairs) dexscreenerData = dexResponse.data.pairs[0];
        } catch (err) {}

        if (!gmgnData) return;

        // --- SECURITY PARSING GATE ---
        const rugCount = Number(getNestedProp(gmgnData, ['creator_rug_count', 'dev_rug_count'], 0));
        const top10Rate = parseFloat(getNestedProp(gmgnData, ['top_10_holder_rate', 'holder_concentration'], 0)) * 100;
        const isHoneypot = gmgnData.is_honeypot === 1 || gmgnData.is_honeypot === true;
        const totalCreatedCount = Number(getNestedProp(gmgnData, ['token_created_count', 'creator_token_count'], 0));

        // Optimized filters for early Pump.fun launches
        if (rugCount > 0) return;
        if (isHoneypot) return;
        if (top10Rate > 45) return; // Dropped to 45% to capture explosive projects while dropping heavy bundle farms
        if (totalCreatedCount > 10) return; // Dropped to 10 to filter serial spammers but allow seasoned token builders

        const tokenSymbol = dexscreenerData ? dexscreenerData.baseToken.symbol : gmgnData.symbol;
        const tokenName = dexscreenerData ? dexscreenerData.baseToken.name : gmgnData.name;

        const alertMessage = `
💊 <b>NEW PUMP.FUN DETECTED</b> 💊
────────────────────────
• <b>Asset:</b> ${tokenName} (${tokenSymbol})
• <b>Contract:</b> <code>${tokenMint}</code>
────────────────────────
▶ <b>SECURITY AUDIT METRICS</b>
• <b>Top 10 Concentration:</b> ${top10Rate.toFixed(1)}%
• <b>Dev Deployment History:</b> ${totalCreatedCount} Created
• <b>Contract Exploits:</b> None Detected ✅
────────────────────────
▶ <b>TRADING PORTS</b>
• <a href="https://gmgn.ai/sol/token/${tokenMint}">GMGN Chart Terminal</a>
• <a href="https://t.me/solana_trojanbot?start=r-cryptonigh-${tokenMint}">Trade via Trojan Bot</a>
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
  console.log(`🚀 Pump.fun Engine Running on Port ${PORT}`);
});