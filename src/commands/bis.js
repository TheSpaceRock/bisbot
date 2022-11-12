import moment from 'moment';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SelectMenuBuilder, SlashCommandBuilder } from "discord.js";

import { verify_raider } from "./util.js";
import { is_etro_gearset, etro_parse_gearset } from "../api.js";
import { LootRule, resolve_loot_rollers } from "../lootrule.js";

export default {
    name: 'bis',
    handler: false,
    sub_handlers: {
        set: bis_set,
        get: bis_get,
        update: bis_update,
        clear: bis_clear,
    },
    register_data: async bis_db => {
        const raid_choices = (await bis_db.get_raid_floors()).map(x => ({ name: x.raid_id, value: x.raid_id }));
        return new SlashCommandBuilder()
            .setName('bis')
            .setDescription('BiS Bot')
            .setDMPermission(false)
            .addSubcommand(sub =>
                sub.setName('set')
                .setDescription('Set BiS')
                .addStringOption(opt =>
                    opt.setName('bis_url')
                    .setDescription('etro.gg URL of your BiS')
                    .setRequired(true)))
            .addSubcommand(sub =>
                sub.setName('get')
                .setDescription('Display BiS and current gear')
                .addUserOption(opt =>
                    opt.setName('raider')
                    .setDescription('Raider')
                    .setRequired(false)))
            .addSubcommand(sub => 
                sub.setName('update')
                .setDescription('Update current gear'))
            .addSubcommand(sub => 
                sub.setName('clear')
                .setDescription('Update the last clear and display loot rules')
                .addStringOption(opt => {
                    opt.setName('raid')
                    .setDescription('Raid that was cleared')
                    .setRequired(true);
                    raid_choices.forEach(x => opt.addChoices(x));
                    return opt;
                }));
    }
}
//                    type: CommandType.ChatInput,
//                    name: 'bis',
//                    description: 'BiS Bot',
//                    dm_permission: false,
//                        {
//                            type: CommandOptionType.SubCommand,
//                            name: 'update',
//                            description: 'Update current gear',
//                        },
//                        {
//                            type: CommandOptionType.SubCommand,
//                            name: 'clear',
//                            description: 'Update last clear and display loot rules',
//                            options: [{
//                                type: CommandOptionType.String,
//                                name: 'raid',
//                                description: 'Floor of raid tier that was cleared',
//                                required: true,
//                                choices: (await bis_db.get_raid_floors()).map((x) => {
//                                    return {name: x.raid_id, value: x.raid_id}
//                                }),
//                            }],
//                        },
//                    ],
//                },

async function bis_set(interaction, params) {
    if (!await verify_raider(interaction, params)) return;
    let bis_url;
    try {
        bis_url = new URL(interaction.options.getString('bis_url'));
    } catch (err) {
        interaction.reply({ content: 'Only etro.gg gearsets are supported.', ephemeral: true });
        return;
    }
    if (!is_etro_gearset(bis_url)) {
        interaction.reply({ content: 'Only etro.gg gearsets are supported.', ephemeral: true });
        return;
    }
    try {
        interaction.deferReply({ephemeral: true});
        const gear_info = await params.bis_db.get_gear_info();
        const bis = await etro_parse_gearset(bis_url, gear_info);
        console.log('check bis: ', bis.slots);
        await params.bis_db.update_bis(interaction.guildId, interaction.user.id, bis_url, bis.job, bis.slots);
        interaction.reply({ content: `Bis set to ${bis_url} !`, ephemeral: true });
    } catch (err) {
        console.error(err);
        interaction.reply({ content: 'Failed to set BiS.', ephemeral: true });
    }
}

async function bis_get(interaction, params) {
    if (!await verify_raider(interaction, params)) return;
    let user = interaction.options.getUser('raider') ?? interaction.user;
    const raider = await params.bis_db.get_raider_data(interaction.guildId, user.id);
    console.log(raider);
    if (raider !== null) {
        interaction.reply({
            content: `BiS for <@${user.id}>: ${raider.bis_url}`,
            allowedMentions: false,
        });
    } else {
        interaction.reply({ content: 'I do not know about this raider.', ephemeral: true })
    }
}

async function bis_update(interaction, params) {
    if (!await verify_raider(interaction, params)) return;

    async function create_main_menu(interaction, params) {
        const gear_info = await params.bis_db.get_gear_info();
        const raider = await params.bis_db.get_raider_data(interaction.guildId, interaction.user.id);
        const slot_name_to_id = gear_info.slot_name_to_id();
        const gear_btn = (id) => {
            let label;
            if (id === 'Rings') {
                const lcur = raider.current_gear[slot_name_to_id['Left Ring']];
                const rcur = raider.current_gear[slot_name_to_id['Right Ring']];
                label = `${id} (i${lcur.ilvl}/i${rcur.ilvl})`;
            } else {
                const current = raider.current_gear[slot_name_to_id[id]];
                label = `${id} (i${current.ilvl})`;
            }
            return new ButtonBuilder()
                .setCustomId(`main_${id}`)
                .setLabel(label)
                .setStyle(ButtonStyle.Primary);
        };
        const left_buttons = [
            gear_btn('Head'),
            gear_btn('Body'),
            gear_btn('Hands'),
            gear_btn('Legs'),
            gear_btn('Feet'),
        ];
        const right_buttons = [
            gear_btn('Weapon'),
            gear_btn('Earrings'),
            gear_btn('Necklace'),
            gear_btn('Bracelets'),
            gear_btn('Rings'),
        ];
        return {
            content: 'Select a gear slot to update:',
            components: left_buttons.map((x, i) => new ActionRowBuilder()
                .addComponents(x)
                .addComponents(right_buttons[i])),
            ephemeral: true
        };
    }

    async function create_sub_menu(interaction, params, slot_name) {
        const gear_info = await params.bis_db.get_gear_info();
        const raider = await params.bis_db.get_raider_data(interaction.guildId, interaction.user.id);
        const slot_name_to_id = gear_info.slot_name_to_id();
        const gear_select_list = (slot_id) => {
            const slot_gear_type = gear_info.slots().filter((x) => x.id === slot_id)[0].gear_type;
            const current_grade = raider.current_gear[slot_id].grade_id;
            return new ActionRowBuilder()
                .addComponents(
                    new SelectMenuBuilder()
                        .setCustomId(`sub_${slot_id}`)
                        .setPlaceholder('Select a gear type')
                        .addOptions(
                            gear_info.grades().filter(grade => {
                                return grade.id !== 0 && (grade.allowed_types & slot_gear_type) !== 0;
                            }).map(grade => {
                                return {
                                    label: `${grade.name} (i${grade.ilvl})`,
                                    value: `${grade.id}`,
                                    default: grade.id === current_grade,
                                }
                            })
                        )
                );
        };
        return {
            content: `Select your ${slot_name} gear:`,
            components: ((slot_name === 'Rings') ? ['Left Ring', 'Right Ring'] : [slot_name])
                .map((x) => gear_select_list(slot_name_to_id[x]))
        };
    }

    const message = await interaction.reply(await create_main_menu(interaction, params));
    const collector = message.createMessageComponentCollector({ idle: 900_000 });
    collector.on('collect', async (i) => {
        const split_idx = i.customId.indexOf('_');
        const id_group = i.customId.substring(0, split_idx);
        const id_info = i.customId.substring(split_idx+1);
        if (id_group === 'main') {
            await i.update(await create_sub_menu(i, params, id_info));
        } else if (id_group === 'sub') {
            const selected_slot_id = parseInt(id_info);
            const selected_grade = parseInt(i.values[0]);
            console.log(`Update gear: ${i.user.id} slot:${selected_slot_id} grade:${selected_grade}`);
            params.bis_db.update_gear(i.guildId, i.user.id, [{ slot_id: selected_slot_id, grade_id: selected_grade }]);
            await i.update(await create_main_menu(i, params));
        }
    });
}

async function bis_clear(interaction, params) {
    if (!await verify_raider(interaction, params)) return;
    try {
        const target_raid_id = interaction.options.getString('raid');
        if (!await params.bis_db.can_guild_clear(interaction.guildId, target_raid_id)) {
            interaction.reply({
                content: `You've all cleared ${target_raid_id} this week... There's no loot to roll on.`,
            });
            return;
        }
        let drops = await params.bis_db.get_loot_rollers(interaction.guildId, target_raid_id);
        drops = resolve_loot_rollers(drops, LootRule.PriorityFFA);
        let content = `Loot rules for ${target_raid_id}:\n\n`;
        for (const k in drops) {
            const drop = drops[k];
            let rule_text = 'Everyone rolls Greed!'
            if (drop.rollers.length > 0) {
                rule_text = drop.rollers.map((x) => `<@${x.user_id}>`).join(' ') + ' rolls Need!';
            }
            content += `${drop.name}: ${rule_text}\n`;
        }
        interaction.reply(content);
        await params.bis_db.insert_clear(interaction.guildId, target_raid_id, moment().utc());
    } catch (err) {
        console.error(err);
        interaction.reply({ content: 'There was an error displaying loot rules!', ephemeral: true });
    }
}