const express = require('express');
const { Telegraf } = require('telegraf');

const app = express();
app.use(express.json());

// ==================== CONFIGURATION & SECURITY PRESETS ====================
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_IDS = process.env.TELEGRAM_CHAT_ID ? process.env.TELEGRAM_CHAT_ID.split(',') : [];
const bot = new Telegraf(BOT_TOKEN);

// Strict Alpha Rules for Volume/Migration Filtering
const MIN_SUCCESSFUL_MIGRATIONS = 2;    // Dev must have successfully migrated at least X tokens
const MIN_PAST_VOLUME_USD       = 10000;  // Dev's past successful tokens must have cleared over $10k volume
const MAX_ALLOWED_RUG_COUNT     = 0;      // Hard floor. ZERO tolerance for explicit rug indicators

// ==================== MAIN WEBHOOK PROCESSING ENGINE ====================
app.post('/webhook', async (req, res) => {
  try {
    const data = req.body;
    if (!data || !Array.isArray(data) || data.length === 0) return res.status(200).send('Empty payload');

    const tx = data[0];
    const tokenMint   = tx.tokenUpdates?.[0]?.mint || 'Unknown';
    const tokenName   = tx.tokenUpdates?.[0]?.name || 'Unknown Token';
    const tokenSymbol = tx.tokenUpdates?.[0]?.symbol || 'UNKNOWN';

    // 📊 Extracting Dev History Metrics from Payload
    const devRugHistory     = tx.devHistory?.rugs || 0;
    const devTotalCreated   = tx.devHistory?.totalCreated || 0;
    const devMigratedCount  = tx.devHistory?.migratedCount || 0; // Tracks green checkmarks
    const devMaxPastVolume  = tx.devHistory?.highestVolumeUsd || 0; // Tracks if they hit the $10kk+$500k runs

    console.log(`🔍 [SCANNING] ${tokenSymbol} | Total Launched: ${devTotalCreated} | Migrated: ${devMigratedCount} | Max Vol: $${devMaxPastVolume}`);

    // ==================== THE SMART ELITE DEV FILTER ====================
    let isEliteDeveloper = false;

    // Rule 1: Instant Blacklist if they have active rug markings
    if (devRugHistory > MAX_ALLOWED_RUG_COUNT) {
      console.log(`❌ [REJECTED] Dev wallet flagged with active malicious metrics.`);
      return res.status(200).send('Rejected: Security risk.');
    }

    // Rule 2: The GMGN "Green Check" Matrix (Matching your screenshot behavior)
    // Checks if the dev regularly migrates tokens AND prints actual trading volume
    if (devMigratedCount >= MIN_SUCCESSFUL_MIGRATIONS && devMaxPastVolume >= MIN_PAST_VOLUME_USD) {
      console.log(`👑 [ELITE PASS] Match found. Dev has ${devMigratedCount} migrations and proven market volume.`);
      isEliteDeveloper = true;
    }

    // ==================== ROUTING SYSTEM ====================
    if (!isEliteDeveloper) {
      console.log(`❌ [REJECTED] Dev does not meet Elite Track criteria (Insufficient high-volume track record).`);
      return res.status(200).send('Rejected: Standard tracking parameters unmet.');
    }

    // ==================== DISPATCH DELIVERABLE ====================
    const statsLayout = `👑 **ELITE LAUNCH PROFILED** 👑\n` +
                        `----------------------------------------\n` +
                        `• **Asset:** ${tokenName} (${tokenSymbol})\n` +
                        `• **Contract:** \`${tokenMint}\`\n` +
                        `----------------------------------------\n` +
                        `▶️ **PRO-DEV PERFORMANCE AUDIT**\n` +
                        `• **Total Projects:** ${devTotalCreated}\n` +
                        `• **Successful Migrations:** ✅ ${devMigratedCount} Green Ticks\n` +
                        `• **Proven Vol Profile:** ✅ $${devMaxPastVolume.toLocaleString()} Peak Run\n` +
                        `----------------------------------------\n` +
                        `▶️ **SPEED CHANNELS**\n` +
                        `• 📊 [GMGN Terminal](https://gmgn.ai/sol/token/${tokenMint})\n` +
                        `• ⚔️ [Sniping Portal](https://t.me/solana_trojanbot?start=r-user-${tokenMint})`;

    for (const chatId of CHAT_IDS) {
      await bot.telegram.sendMessage(chatId, statsLayout, { parse_mode: 'Markdown', disable_web_preview: false });
    }

    console.log(`🚀 [DISPATCHED] Verified elite launch sent to channel for ${tokenSymbol}`);
    res.status(200).send('Elite token processed');

  } catch (error) {
    console.error('💥 Error handling payload pipeline:', error.message);
    res.status(500).send('Internal Error');
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`High-Volume Scanner online on port ${PORT}`);
});