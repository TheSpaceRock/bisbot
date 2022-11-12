import { SlashCommandBuilder } from "discord.js";

export default {
    name: 'bisadmin',
    handler: false,
    sub_handlers: {
        register: bisadmin_register,
        unregister: bisadmin_unregister,
    },
    register_data: () => new SlashCommandBuilder()
        .setName('bisadmin')
        .setDescription('Admin commands for BiS Bot')
        .setDefaultMemberPermissions('0')
        .setDMPermission(false)
        .addSubcommand(sub =>
            sub.setName('register')
            .setDescription('Register raider')
            .addUserOption(opt =>
                opt.setName('raider')
                .setDescription('Raider')
                .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('unregister')
            .setDescription('Unregister raider')
            .addUserOption(opt =>
                opt.setName('raider')
                .setDescription('Raider')
                .setRequired(true))),
}

async function bisadmin_register(interaction, params) {
    try {
        const target_user = interaction.options.getUser('raider');
        await params.bis_db.create_raider(interaction.guildId, target_user.id);
        interaction.reply({ content: `<@${target_user.id}> successfully registered!`, ephemeral: true });
    } catch (err) {
        console.log(err);
        interaction.reply({ content: `Failed to register user.`, ephemeral: true });
    }
}

async function bisadmin_unregister(interaction, params) {
    try {
        const target_user = interaction.options.getUser('raider');
        await params.bis_db.delete_raider(interaction.guildId, target_user.id);
        interaction.reply({ content: `<@${target_user.id}> successfully unregistered!`, ephemeral: true });
    } catch (err) {
        console.log(err);
        interaction.reply({ content: `Failed to unregister user.`, ephemeral: true });
    }
}