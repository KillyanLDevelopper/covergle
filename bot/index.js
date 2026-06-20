import "dotenv/config";
import { Client, GatewayIntentBits, TextChannel } from "discord.js";
import cron from "node-cron";
import { buildDailyEmbed } from "./message.js";

const token = process.env.DISCORD_BOT_TOKEN;
const channelId = process.env.DISCORD_CHANNEL_ID;

if (!token || !channelId) {
    console.error("[Bot] DISCORD_BOT_TOKEN ou DISCORD_CHANNEL_ID manquant dans .env");
    process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function sendDaily(client) {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel || !(channel instanceof TextChannel)) {
        console.error("[Bot] Channel introuvable ou pas un TextChannel");
        return;
    }
    await channel.send({ embeds: [buildDailyEmbed()] });
    console.log(`[Bot] Message envoyé — ${new Date().toISOString()}`);
}

client.once("clientReady", () => {
    console.log(`[Bot] Connecté en tant que ${client.user?.tag}`);

    // Test : envoi immédiat au démarrage
    sendDaily(client);

    // Tous les jours à 00h00 heure de Paris
    cron.schedule("0 0 * * *", async () => {
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel || !(channel instanceof TextChannel)) {
            console.error("[Bot] Channel introuvable ou pas un TextChannel");
            return;
        }
        await channel.send({ embeds: [buildDailyEmbed()] });
        console.log(`[Bot] Message envoyé — ${new Date().toISOString()}`);
        sendDaily(client);
    }, { timezone: "Europe/Paris" });

    console.log("[Bot] Planificateur actif — envoi chaque jour à 00h00 (Paris)");
});

client.login(token);
