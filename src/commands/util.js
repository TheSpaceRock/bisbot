export async function verify_raider(interaction, params) {
    const dbres = await params.bis_db.is_raider_registered(interaction.guildId, interaction.user.id);
    if (dbres) return true;
    interaction.reply({ content: "You are not registered in this server.", ephemeral: true })
    return false;
}
