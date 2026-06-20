import { EmbedBuilder } from "discord.js";

export function buildDailyEmbed() {
    const today = new Date().toLocaleDateString("fr-FR", {
        timeZone: "Europe/Paris",
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    return new EmbedBuilder()
        .setColor(0x7c3aed)
        .setTitle("Nouveau défi Covergle disponible !")
        .setURL("https://covergle.fr")
        .setDescription(
            `Le défi du **${today}** est maintenant disponible !\n\n` +
            `Saurez-vous deviner le jeu vidéo à partir de sa couverture pixelisée ? 🕹️`
        )
        .addFields(
            { name: "🔗 Jouer", value: "[covergle.fr](https://covergle.fr)", inline: true },
            { name: "⏱️ Tentatives", value: "6 max", inline: true }
        )
        .setFooter({ text: "Covergle • Un défi par jour" })
        .setTimestamp();
}
