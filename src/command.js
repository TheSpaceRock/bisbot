import { InteractionResponseType, InteractionResponseFlags } from "discord-interactions";
import { discord_fetch } from "./api.js";

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

async function bis_set(interaction, params) {
    params.res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content: "Display set bis success or error",
            flags: InteractionResponseFlags.EPHEMERAL,
        },
    });
}

async function bis_get(interaction, params) {
    params.res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content: "Displaying the BiS",
        },
    });
}

async function bis_update(interaction, params) {
    params.component_handler.add(interaction.id, (subint, subparams) => {
        subparams.res.send({
            type: InteractionResponseType.UPDATE_MESSAGE,
            data: {
                content: "Gear has been updated!",
                components: [],
            },
        });
    });
    params.res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content: "Prompt the user to update their gear",
            components: [
                {
                    type: 1,
                    components: [{
                        custom_id: 'submit',
                        type: 2,
                        style: 1,
                        label: 'Submit!',
                    }],
                },
            ],
            flags: InteractionResponseFlags.EPHEMERAL,
        },
    });
}

async function bis_clear(interaction, params) {
    params.res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content: "Displaying the loot rules",
        },
    });
}

async function bisadmin_register(interaction, params) {
    params.res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content: "Display register success or error",
            flags: InteractionResponseFlags.EPHEMERAL,
        },
    });
}

async function bisadmin_unregister(interaction, params) {
    params.res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content: "Display unregister success or error",
            flags: InteractionResponseFlags.EPHEMERAL,
        },
    });
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
                        },
                        {
                            type: CommandOptionType.SubCommand,
                            name: 'unregister',
                            description: 'Unregister raider',
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
            this.#queue[id](interaction, params);
            return true;
        } else {
            console.error(`I do not know about interaction ${id} -- skipping`)
            return false;
        }
    }

}