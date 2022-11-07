import moment from 'moment'
import { InteractionResponseType, InteractionResponseFlags } from "discord-interactions";
import { discord_fetch, etro_parse_gearset, is_etro_gearset } from "./api.js";
import { LootRule, resolve_loot_rollers } from "./lootrule.js";
import { last_weekly_reset, next_weekly_reset } from "./util.js";

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
        return send_ephemeral(params.res, 'Only etro.gg gearsets are supported.');
    }
    if (!is_etro_gearset(bis_url)) {
        return send_ephemeral(params.res, 'Only etro.gg gearsets are supported.');
    }
    try {
        const gear_info = await params.bis_db.get_gear_info();
        const bis = await etro_parse_gearset(bis_url, gear_info);
        console.log('check bis: ', bis.slots);
        await params.bis_db.update_bis(params.guild_id, params.user_id, bis_url, bis.job, bis.slots)
        return send_ephemeral(params.res, `Bis set to ${bis_url} !`)
    } catch (err) {
        console.error(err);
        return send_ephemeral(params.res, "Failed to set BiS.");
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
    gear_info.slots()
    params.res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content: "Select a gear slot to update:",
            components: [{
                type: 1,
                components: [{
                    custom_id: 'gear_slot',
                    type: 3,
                    placeholder: 'Select a gear slot',
                    options: gear_info.slots().map((slot) => {
                        const current = raider.current_gear[slot.id];
                        return {
                            label: `${slot.name} (i${current.ilvl} ${current.name})`,
                            value: slot.id,
                        };
                    }),
                }],
            }],
            flags: InteractionResponseFlags.EPHEMERAL,
        },
    });
    params.component_handler.add(interaction.id, async (interaction, params) => {
        const raider = await params.bis_db.get_raider_data(params.guild_id, params.user_id);
        const selected_slot_id = parseInt(interaction.data.values[0]);
        const current_grade = raider.current_gear[selected_slot_id].grade_id;
        const slot_gear_type = gear_info.slots().filter((x) => x.id === selected_slot_id)[0].gear_type;
        params.res.send({
            type: InteractionResponseType.UPDATE_MESSAGE,
            data: {
                content: "Select your gear:",
                components: [{
                    type: 1,
                    components: [{
                        custom_id: 'gear_grade',
                        type: 3,
                        options: gear_info.grades().filter((grade) => (grade.allowed_types & slot_gear_type) !== 0).map((grade) => {
                            return {
                                label: `${grade.name} (i${grade.ilvl})`,
                                value: grade.id,
                                default: grade.id === current_grade,
                            };
                        }),
                    }],
                }],
            },
        });
        return async (interaction, params) => {
            const selected_grade = parseInt(interaction.data.values[0]);
            params.bis_db.update_gear(params.guild_id, params.user_id, [{ slot_id: selected_slot_id, grade_id: selected_grade }])
            params.res.send({
                type: InteractionResponseType.UPDATE_MESSAGE,
                data: {
                    content: "Gear updated!",
                    components: [],
                },
            });
        };
    });
}

async function bis_clear(interaction, params) {
    if (!verify_raider(interaction, params)) return;
    try {
        const target_raid_id = interaction.data.options[0].options[0].value;
        const weekly_reset = last_weekly_reset();
        if (!await params.bis_db.can_guild_clear(params.guild_id, target_raid_id, weekly_reset)) {
            params.res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: "You've all cleared this week... There's no loot to roll on.",
            },
            });
            return;
        }
        let drops = await params.bis_db.get_loot_rollers(params.guild_id, target_raid_id);
        const roles = await params.bis_db.get_raid_roles(params.guild_id);
        drops = resolve_loot_rollers(drops, LootRule.PriorityFFA, roles);
        let content = "Displaying loot rules:\n\n"
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
        params.bis_db.update_clear(params.guild_id, target_raid_id, moment().utc(), weekly_reset);
    } catch (err) {
        console.error(err);
        send_ephemeral(params.res, 'There was an error displaying loot rules!');
    }
}

async function bisadmin_register(interaction, params) {
    try {
        const target_user_id = interaction.data.options[0].options[0].value;
        await params.bis_db.create_raider(params.guild_id, target_user_id);
        return send_ephemeral(params.res, `<@${target_user_id}> successfully registered!`);
    } catch (err) {
        console.log(err);
        return send_ephemeral(params.res, `Failed to register user.`)
    }
}

async function bisadmin_unregister(interaction, params) {
    try {
        const target_user_id = interaction.data.options[0].options[0].value;
        await params.bis_db.delete_raider(params.guild_id, target_user_id);
        return send_ephemeral(params.res, `<@${target_user_id}> successfully unregistered!`);
    } catch (err) {
        console.log(err);
        return send_ephemeral(params.res, 'Failed to unregister user.');
    }
}


export class CommandRegistry {
    
    #dispatch = {};

    async initialize() {
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
                                choices: ['p5s', 'p6s', 'p7s', 'p8s'].map((x) => ({name: x, value: x})),
                                //choices: bis_db.get_raid_floors().map((x) => ({name: x, value: x})),
                            }],
                        },
                    ],
                },
            },
            bisadmin: {
                handlers: {
                    register: bisadmin_register,
                    unregister: bisadmin_unregister,
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
            this.#dispatch[res_command.id] = COMMAND_LIST[res_command.name].handlers;
        }
    }

    async dispatch(interaction, params) {
        //console.log('to dispatch:', JSON.stringify(interaction.data, null, 2));
        const subcommand = interaction.data.options[0].name;
        this.#dispatch[interaction.data.id][subcommand](interaction, params);
    }
    
}


export class InteractionQueue {

    #queue = {};

    add(id, callback) {
        console.log(`Add/update handler for ${id}`);
        this.#queue[id] = callback;
    }

    remove(id) {
        delete this.#queue[id];
    }

    async dispatch(id, interaction, params) {
        if (id in this.#queue) {
            let cb = await this.#queue[id](interaction, params);
            if (cb) {
                this.#queue[id] = cb;
            }
            return true;
        } else {
            console.error(`I do not know about interaction ${id} -- skipping`)
            return false;
        }
    }

}