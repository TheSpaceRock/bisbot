import { BisDb } from './db.js';

import { Client, Events, REST, Routes } from 'discord.js';

import cmd_bis from './commands/bis.js';
import cmd_bisadmin from './commands/bisadmin.js';

const bis_db = new BisDb();

const client = new Client({
    intents: [],
});
client.login(process.env.BOT_TOKEN);
const command_registry = new Map([
    [cmd_bisadmin.name, cmd_bisadmin],
    [cmd_bis.name, cmd_bis],
])

async function register_commands() {
    const rest = new REST({version: '10'}).setToken(process.env.BOT_TOKEN);
    try {
        console.log('Registering global commands');
        const cmd_data = await Promise.all(Array.from(command_registry)
            .map(async ([, x]) => (await x.register_data(bis_db)).toJSON()));
        const resp = await rest.put(Routes.applicationCommands(process.env.APP_ID), { body: cmd_data });
        console.log(`Registered ${resp.length} commands!`);
        resp.forEach(x => console.log(`  - ${x.name}`));
    } catch (err) {
        console.error('Failed to register bot commands: ', err);
    }
}

client.once(Events.ClientReady, c => {
    console.log(`Ready! Logged in as ${c.user.tag}`)
    register_commands();
});

client.on(Events.InteractionCreate, async interaction => {
    try {
        const params = {
            bis_db: bis_db,
        }
        if (interaction.isChatInputCommand()) {
            const command = command_registry.get(interaction.commandName);
            if (command.handler && command.handler instanceof Function) {
                console.log(`Disptach command /${command.name}`);
                await command.handler(interaction, params);
            } else {
                const subcommand = interaction.options.getSubcommand();
                console.log(`Dispatch command /${command.name} ${subcommand}`);
                await command.sub_handlers[subcommand](interaction, params);
            }
        }
    } catch (err) {
        console.error('Failed to handle interaction: ', err);
    }
});