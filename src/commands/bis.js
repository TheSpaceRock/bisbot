import moment from 'moment';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SelectMenuBuilder, SlashCommandBuilder } from "discord.js";

import { verify_raider } from "./util.js";
import { is_etro_gearset, etro_parse_gearset } from "../api.js";
import { LootRule, resolve_loot_rollers } from "../lootrule.js";
import { GearType } from '../enum.js';

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

async function bis_set(interaction, params) {
    if (!await verify_raider(interaction, params)) return;
    let bis_url;
    try {
        bis_url = new URL(interaction.options.getString('bis_url'));
    } catch (err) {
        await interaction.reply({ content: 'Only etro.gg gearsets are supported.', ephemeral: true });
        return;
    }
    if (!is_etro_gearset(bis_url)) {
        await interaction.reply({ content: 'Only etro.gg gearsets are supported.', ephemeral: true });
        return;
    }
    try {
        await interaction.deferReply({ephemeral: true});
        const gear_info = await params.bis_db.get_gear_info();
        const bis = await etro_parse_gearset(bis_url, gear_info);
        console.log('check bis: ', bis.slots);
        await params.bis_db.update_bis(interaction.guildId, interaction.user.id, bis_url.href, bis.job, bis.slots);
        await interaction.editReply({ content: `Bis set to ${bis_url} !`, ephemeral: true });
    } catch (err) {
        console.error(err);
        await interaction.editReply({ content: 'Failed to set BiS.', ephemeral: true });
    }
}

async function bis_get(interaction, params) {
    if (!await verify_raider(interaction, params)) return;
    let user = interaction.options.getUser('raider') ?? interaction.user;
    const gear_info = await params.bis_db.get_gear_info();
    const raider = await params.bis_db.get_raider_data(interaction.guildId, user.id);
    const ring_slots = gear_info.slots().filter(x => x.name.includes('Ring'));
    console.log(raider);
    function slot_info(slot, gear_key) {
        const gear = raider[gear_key][slot.id];
        let result = `i${gear.ilvl} ${gear.name}`;
        if (gear_key === 'bis_gear') {
            let has_bis = false;
            if (slot.name.includes('Ring')) {
                has_bis = ring_slots.some(x => raider['current_gear'][x.id].grade_id === raider['bis_gear'][slot.id].grade_id);
            } else {
                has_bis = raider['current_gear'][slot.id].grade_id === raider['bis_gear'][slot.id].grade_id;
            }
            result = ((has_bis) ? ':white_check_mark:' : ':x:') + result;
        }
        return result;
    }
    if (raider !== null) {
        let upgrades_needed = await params.bis_db.get_required_upgrades(interaction.guildId, user.id);
        let upgrade_rows = [
            {name: 'Weapon', id: GearType.Weapon},
            {name: 'Clothing', id: GearType.Clothing},
            {name: 'Accessory', id: GearType.Accessory},
        ];

        const upgrade_col = { name: 'Upgrade Materials', value: upgrade_rows.filter(x => {
            return upgrades_needed[x.id].total > 0;
        }).map(x => {
            const total = upgrades_needed[x.id].total;
            const needed = upgrades_needed[x.id].total - upgrades_needed[x.id].current;
            const check_or_x = (total === needed) ? ':white_check_mark:' : ':x:';
            return `${x.name}: ${needed} of ${total} ${check_or_x}`;
        }).join('\n'), inline: true };
        if (upgrade_col.value.length === 0) {
            upgrade_col.value = 'Nothing required!'
        }
        const tomestone_total = raider.get_tomestones_required(gear_info);
        const tomestone_weeks = Math.ceil(tomestone_total / 450); 
        const tome_check_or_x = (tomestone_total <= 0) ? ':white_check_mark:' : ':x:';
        const tomestone_col = { name: 'Tomestones', value: `Required: ${tomestone_total} ${tome_check_or_x}\nWeeks: ${tomestone_weeks}`, inline: true };
        const member = interaction.guild.members.resolve(user);
        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`BiS for ${member.displayName} (${raider.job ?? 'Unknown Job'})`)
                .setDescription(raider.bis_url ?? 'No BiS set')
                .addFields(
                    { name: '\u200B', value: gear_info.slots().map(x => x.name).join('\n'), inline: true },
                    { name: 'Current', value: gear_info.slots().map(x => slot_info(x, 'current_gear')).join('\n'), inline: true },
                    { name: 'BiS', value: gear_info.slots().map(x => slot_info(x, 'bis_gear')).join('\n'), inline: true },
                    { name: '\u200B', value: '\u200B', inline: false },
                    upgrade_col, tomestone_col
                )
            ],
            allowedMentions: false,
        });
    } else {
        await interaction.reply({ content: 'I do not know about this raider.', ephemeral: true })
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
        let warnings = '';
        let loot_rule_header = `Loot rules for ${target_raid_id}:`;
        if (!await params.bis_db.can_guild_clear(interaction.guildId, target_raid_id)) {
            loot_rule_header = `You've already cleared ${target_raid_id} this week. Here are some loot rules anyways:`
        }
        let warning_raiders = await params.bis_db.get_gear_errors(interaction.guildId);
        if (warning_raiders.length > 0) {
            warnings += '**WARNING**: These raiders haven\'t set their gear properly, **they may be excluded from rolls** - ';
            warnings += warning_raiders.map((x) => `<@${x.user_id}>`).join(' ');
            warnings += '\nCheck your gear with /bis get, and update with /bis update\n'
        }
        let drops = await params.bis_db.get_loot_rollers(interaction.guildId, target_raid_id);
        drops = resolve_loot_rollers(drops, LootRule.PriorityFFA);
        if (warnings !== '') {
            warnings += "\n"
        }
        let content = `${warnings}${loot_rule_header}\n\n`;
        for (const k in drops) {
            const drop = drops[k];
            let rule_text = 'Everyone rolls Greed!'
            if (drop.rollers.length > 0) {
                rule_text = drop.rollers.map((x) => `<@${x.user_id}>`).join(' ') + ' rolls Need!';
            }
            content += `${drop.name}: ${rule_text}\n`;
        }
        await interaction.reply(content);
        await params.bis_db.insert_clear(interaction.guildId, target_raid_id, moment().utc());
    } catch (err) {
        console.error(err);
        await interaction.reply({ content: 'There was an error displaying loot rules!', ephemeral: true });
    }
}