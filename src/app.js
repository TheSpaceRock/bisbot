import dotenv from 'dotenv';

import express from 'express';
import { verifyKeyMiddleware, InteractionType, InteractionResponseType, MessageComponentTypes } from 'discord-interactions';
import { CommandRegistry, InteractionQueue } from './command.js';
import { BisDb } from './db.js';

dotenv.config();

const app = express();
const cmd = new CommandRegistry();
const component_handler = new InteractionQueue();
const bis_db = new BisDb();

app.get('/foobar', (req, res) => {
    res.send('foobar 2!')
})

app.use(verifyKeyMiddleware(process.env.CLIENT_PUBLIC_KEY))

app.post('/interactions', (req, res) => {
    const interaction = req.body;
    if (interaction.type === InteractionType.APPLICATION_COMMAND) {
        cmd.dispatch(interaction, {
            res: res,
            component_handler: component_handler,
            bis_db: bis_db,
            guild_id: interaction.guild_id,
            user_id: interaction.member.user.id,
        });
    } else if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
        component_handler.dispatch(interaction.message.interaction.id, interaction, {
            res: res,
            bis_db: bis_db,
            guild_id: interaction.guild_id,
            user_id: interaction.member.user.id,
        });
    }
});

app.listen(8080, () => {
    console.log('Server is starting!');
    cmd.initialize();
});