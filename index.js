const http = require('http');
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Solana Bot is Alive\n');
}).listen(process.env.PORT || 3000);
const axios = require('axios');
require('dotenv').config();
const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const alertedTokens = new Set();

async function scanSolanaMarkets() {
    try {
        console.log("Scanning Solana meme markets via DexScreener...");
        
        const response = await axios.get('https://api.dexscreener.com/token-profiles/latest/v1');
        const profiles = response.data;
        const solanaTokens = profiles.filter(p => p.chainId === 'solana');
        const tokenAddresses = solanaTokens.map(p => p.tokenAddress).join(',');

        if (!tokenAddresses) return;

        const marketResponse = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddresses}`);
        const pairs = marketResponse.data.pairs;

        if (!pairs) return;

        for (const pair of pairs) {
            const mintAddress = pair.baseToken.address;
            const symbol = pair.baseToken.symbol;
            const liquidity = pair.liquidity ? pair.liquidity.usd : 0;
            const volume5m = pair.volume ? pair.volume.m5 : 0;
            const marketCap = pair.fdv || 0;

            if (liquidity > 20000 && volume5m > 5000 && marketCap < 15000000) {
                if (!alertedTokens.has(mintAddress)) {
                    alertedTokens.add(mintAddress);
                    await sendTelegramAlert(symbol, mintAddress, volume5m, liquidity, marketCap);
                }
            }
        }
    } catch (error) {
        console.error("Error fetching market data:", error.message);
    }
}

async function sendTelegramAlert(symbol, address, vol5m, liq, mc) {
    const message = `🚨 *SOLANA MEME COIN VOLUME SPIKE* 🚨\n\n` +
                    `*Token:* $${symbol}\n` +
                    `*5m Volume:* $${vol5m.toLocaleString()}\n` +
                    `*Liquidity:* $${liq.toLocaleString()}\n` +
                    `*Market Cap:* $${mc.toLocaleString()}\n\n` +
                    `*Mint Address:* \`${address}\`\n\n` +
                    `[View on DEX Screener](https://dexscreener.com/solana/${address})`;
    
    try {
        await bot.telegram.sendMessage(CHAT_ID, message, { parse_mode: 'Markdown' });
        console.log(`Alert sent for ${symbol}`);
    } catch (err) {
        console.error("Failed to send Telegram alert:", err.message);
    }
}

setInterval(scanSolanaMarkets, 30000);
scanSolanaMarkets();