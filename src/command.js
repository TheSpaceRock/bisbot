import moment from 'moment'
import LRU from 'lru-cache';
import { InteractionType, InteractionResponseType, InteractionResponseFlags } from "discord-interactions";
import { discord_fetch, etro_parse_gearset, is_etro_gearset } from "./api.js";
import { LootRule, resolve_loot_rollers } from "./lootrule.js";

const CommandType = Object.freeze({
    ChatInput: 1,
    User:      2,
    Message:   3,
});

const CommandOptionType = Object.freeze({
    SubCommand:         1,
    SubCommandGroup:    2,
    String:             3,
    Integer:            4,
    Boolean:            5,
    User:               6,
    Channel:            7,
    Role:               8,
    Mentionable:        9,
    Number:             10,
    Attachment:         11,
});

function send_ephemeral(res, msg) {
    res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content: msg,
            flags: InteractionResponseFlags.EPHEMERAL,
        },
    });
}

async function verify_raider(interaction, params) {
    const dbres = await params.bis_db.is_raider_registered(params.guild_id, params.user_id);
    if (dbres) return true;
    send_ephemeral(params.res, "You are not registered in this server.")
    return false;
}

async function bis_set(interaction, params) {
    if (!verify_raider(interaction, params)) return;
    let bis_url;
    try {
        bis_url = new URL(interaction.data.options[0].options[0].value);
    } catch (err) {
        send_ephemeral(params.res, 'Only etro.gg gearsets are supported.');
        return;
    }
    if (!is_etro_gearset(bis_url)) {
        send_ephemeral(params.res, 'Only etro.gg gearsets are supported.');
        return;
    }
    try {
        const gear_info = await params.bis_db.get_gear_info();
        const bis = await etro_parse_gearset(bis_url, gear_info);
        console.log('check bis: ', bis.slots);
        await params.bis_db.update_bis(params.guild_id, params.user_id, bis_url, bis.job, bis.slots)
        send_ephemeral(params.res, `Bis set to ${bis_url} !`);
        return;
    } catch (err) {
        console.error(err);
        send_ephemeral(params.res, "Failed to set BiS.");
        return;
    }
}

async function bis_get(interaction, params) {
    if (!verify_raider(interaction, params)) return;
    const raider = await params.bis_db.get_raider_data(params.guild_id, params.user_id);
    console.log(raider);
    params.res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content: `BiS for <@${params.user_id}>: ${raider.bis_url}`,
        },
    });
}

async function bis_update(interaction, params) {
    if (!verify_raider(interaction, params)) return;
    const gear_info = await params.bis_db.get_gear_info();
    const raider = await params.bis_db.get_raider_data(params.guild_id, params.user_id);
    const slot_name_to_id = gear_info.slot_name_to_id();
    const action_row = (x) => {
        return { type: 1, components: x }
    };
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
        return {
            type: 2,
            custom_id: id,
            style: 1,
            label: label,
        };
    };
    const resp_type = (interaction.type === InteractionType.APPLICATION_COMMAND) ?
        InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE : InteractionResponseType.UPDATE_MESSAGE;
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
    ]
    // This doesn't work because Discord isn't monospace font lmao
    //let max_padding = left_buttons.reduce((i, x) => Math.max(i, x.label.length), 0);
    //for (const btn of left_buttons) {
    //    const padding = max_padding - btn.label.length;
    //    console.log(`padding: ${padding}`);
    //    btn.label += '\u00A0'.repeat(padding);
    //}
    params.res.send({
        type: resp_type,
        data: {
            content: "Select a gear slot to update:",
            components: left_buttons.map((x, i) => action_row([x, right_buttons[i]])),
            flags: InteractionResponseFlags.EPHEMERAL,
        },
    });
    return async (interaction, params) => {
        const raider = await params.bis_db.get_raider_data(params.guild_id, params.user_id);
        const slot_name = interaction.data.custom_id;
        const gear_select_list = (slot_id) => {
            const slot_gear_type = gear_info.slots().filter((x) => x.id === slot_id)[0].gear_type;
            const current_grade = raider.current_gear[slot_id].grade_id;
            return {
                type: 1,
                components: [{
                    custom_id: `${slot_id}`,
                    type: 3,
                    options: gear_info.grades().filter((grade) => {
                        return grade.id !== 0 && (grade.allowed_types & slot_gear_type) !== 0;
                    }).map((grade) => {
                        return {
                            label: `${grade.name} (i${grade.ilvl})`,
                            value: grade.id,
                            default: grade.id === current_grade,
                        };
                    }),
                }],
            };
        }
        params.res.send({
            type: InteractionResponseType.UPDATE_MESSAGE,
            data: {
                content: `Select your ${slot_name} gear:`,
                components: ((slot_name === 'Rings') ? ['Left Ring', 'Right Ring'] : [slot_name])
                    .map((x) => gear_select_list(slot_name_to_id[x]))
            },
        });
        return async (interaction, params) => {
            const selected_slot_id = parseInt(interaction.data.custom_id);
            const selected_grade = parseInt(interaction.data.values[0]);
            console.log(`Update gear: ${params.user_id} slot:${selected_slot_id} grade:${selected_grade}`)
            params.bis_db.update_gear(params.guild_id, params.user_id, [{ slot_id: selected_slot_id, grade_id: selected_grade }])
            return bis_update(interaction, params);
        };
    };
}

async function bis_clear(interaction, params) {
    if (!verify_raider(interaction, params)) return;
    try {
        const target_raid_id = interaction.data.options[0].options[0].value;
        if (!await params.bis_db.can_guild_clear(params.guild_id, target_raid_id)) {
            params.res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: `You've all cleared ${target_raid_id} this week... There's no loot to roll on.`,
            },
            });
            return;
        }
        let drops = await params.bis_db.get_loot_rollers(params.guild_id, target_raid_id);
        const roles = await params.bis_db.get_raid_roles(params.guild_id);
        drops = resolve_loot_rollers(drops, LootRule.PriorityFFA, roles);
        let content = `Loot rules for ${target_raid_id}:\n\n`;
        for (const k in drops) {
            const drop = drops[k];
            let rule_text = 'Everyone rolls Greed!'
            if (drop.rollers.length > 0) {
                rule_text = drop.rollers.map((x) => `<@${x.user_id}>`).join(' ') + ' rolls Need!';
            }
            content += `${drop.name}: ${rule_text}\n`;
        }
        params.res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: content,
            },
        });
        params.bis_db.insert_clear(params.guild_id, target_raid_id, moment().utc());
    } catch (err) {
        console.error(err);
        send_ephemeral(params.res, 'There was an error displaying loot rules!');
    }
}

async function bisadmin_register(interaction, params) {
    try {
        const target_user_id = interaction.data.options[0].options[0].value;
        await params.bis_db.create_raider(params.guild_id, target_user_id);
        send_ephemeral(params.res, `<@${target_user_id}> successfully registered!`);
        return;
    } catch (err) {
        console.log(err);
        send_ephemeral(params.res, `Failed to register user.`);
        return;
    }
}

async function bisadmin_unregister(interaction, params) {
    try {
        const target_user_id = interaction.data.options[0].options[0].value;
        await params.bis_db.delete_raider(params.guild_id, target_user_id);
        send_ephemeral(params.res, `<@${target_user_id}> successfully unregistered!`);
        return;
    } catch (err) {
        console.log(err);
        send_ephemeral(params.res, 'Failed to unregister user.');
        return;
    }
}


async function bisadmin_loop(interaction, params) {
    const resp_type = (interaction.type === InteractionType.APPLICATION_COMMAND) ?
        InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE : InteractionResponseType.UPDATE_MESSAGE;
    params.res.send({
        type: resp_type,
        data: {
            content: `A simple loop!`,
            components: [{
                type: 1,
                components: [{
                    type: 2,
                    custom_id: 'repeat',
                    style: 1,
                    label: 'Loop me',
                }],
            }],
        },
    })
    return bisadmin_loop;
}


export class CommandRegistry {
    
    #command_handlers = {};
    #component_handlers = new LRU({
        max: 1000,
        ttl: 900000,
    });

    async initialize(bis_db) {
        const COMMAND_LIST = Object.freeze({
            bis: {
                handlers: {
                    set: bis_set,
                    get: bis_get,
                    update: bis_update,
                    clear: bis_clear,
                },
                register_data: {
                    type: CommandType.ChatInput,
                    name: 'bis',
                    description: 'BiS Bot',
                    dm_permission: false,
                    options: [
                        {
                            type: CommandOptionType.SubCommand,
                            name: 'set',
                            description: 'Set BiS',
                            options: [{
                                type: CommandOptionType.String,
                                name: 'bis_url',
                                description: 'etro.gg URL of your BiS',
                                required: true,
                            }],
                        },
                        {
                            type: CommandOptionType.SubCommand,
                            name: 'get',
                            description: 'Display BiS and current gear',
                        },
                        {
                            type: CommandOptionType.SubCommand,
                            name: 'update',
                            description: 'Update current gear',
                        },
                        {
                            type: CommandOptionType.SubCommand,
                            name: 'clear',
                            description: 'Update last clear and display loot rules',
                            options: [{
                                type: CommandOptionType.String,
                                name: 'raid',
                                description: 'Floor of raid tier that was cleared',
                                required: true,
                                choices: (await bis_db.get_raid_floors()).map((x) => {
                                    return {name: x.raid_id, value: x.raid_id}
                                }),
                            }],
                        },
                    ],
                },
            },
            bisadmin: {
                handlers: {
                    register: bisadmin_register,
                    unregister: bisadmin_unregister,
                    loop: bisadmin_loop,
                },
                register_data: {
                    type: CommandType.ChatInput,
                    name: 'bisadmin',
                    description: 'Admin commands for BiS Bot',
                    default_member_permissions: "0",
                    dm_permission: false,
                    options: [
                        {
                            type: CommandOptionType.SubCommand,
                            name: 'register',
                            description: 'Register raider',
                            options: [{
                                type: CommandOptionType.User,
                                name: 'raider',
                                description: 'Raider',
                                required: true,
                            }]
                        },
                        {
                            type: CommandOptionType.SubCommand,
                            name: 'unregister',
                            description: 'Unregister raider',
                            options: [{
                                type: CommandOptionType.User,
                                name: 'raider',
                                description: 'Raider',
                                required: true,
                            }]
                        },
                        {
                            type: CommandOptionType.SubCommand,
                            name: 'loop',
                            description: 'Loop!',
                        },
                    ],
                },
            },
        });

        console.log('Register commands to Discord')
        let command_batch = [];
        for (const key in COMMAND_LIST) {
            command_batch.push(COMMAND_LIST[key].register_data);
        }
        const res = await discord_fetch(`applications/${process.env.APP_ID}/commands`, {
            method: 'PUT',
            body: JSON.stringify(command_batch),
        });
        if (!res.ok) {
            throw new Error(JSON.stringify(await res.json()));
        }

        console.log('Got response from Discord; Mapping command IDs to handlers');
        for (const res_command of await res.json()) {
            console.log(` - register ${res_command.name} as ${res_command.id}`);
            this.#command_handlers[res_command.id] = COMMAND_LIST[res_command.name].handlers;
        }
    }

    async dispatch(interaction, params) {
        try {
            if (interaction.type === InteractionType.APPLICATION_COMMAND) {
                const subcommand = interaction.data.options[0].name;
                console.log(`Dispatch app cmd: ${interaction.data.name} ${subcommand} ${interaction.id}`)
                params.guild_id = interaction.guild_id;
                params.user_id = interaction.member.user.id;
                const handler = await this.#command_handlers[interaction.data.id][subcommand](interaction, params)
                if (handler instanceof Function) {
                    console.log(`Set component handler: ${interaction.id}`)
                    this.#component_handlers.set(interaction.id, handler)
                }
            } else if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
                const source_id = interaction.message.interaction.id;
                const handler = this.#component_handlers.get(source_id);
                params.guild_id = interaction.guild_id;
                params.user_id = interaction.member.user.id;
                if (handler instanceof Function) {
                    console.log(`Dispatch component: ${source_id} ${interaction.id}`)
                    const new_handler = await handler(interaction, params);
                    if (new_handler) {
                        this.#component_handlers.set(source_id, new_handler);
                    } else {
                        this.#component_handlers.delete(source_id);
                    }
                } else {
                    console.warn(`Failed to dispatch component: source ${source_id} (likely timed out)`)
                    params.res.send({
                        type: InteractionResponseType.UPDATE_MESSAGE,
                        data: {
                            content: `Error: Command timed out.`,
                            components: [],
                        },
                    });
                }
            } else {
                console.error(`Unknown interaction type: ${interaction.type}`)
            }
        } catch (err) {
            console.error('Dispatch error: ', err)
            console.log(JSON.stringify(interaction, null, 2));
        }
    }
    
}