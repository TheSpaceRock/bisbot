import dotenv from 'dotenv';

import express from 'express';
import { CommandRegistry, InteractionQueue } from './command.js';

import { verifyKeyMiddleware, InteractionType, InteractionResponseType, MessageComponentTypes } from 'discord-interactions';

dotenv.config();

const app = express();
const cmd = new CommandRegistry();
const component_handler = new InteractionQueue();

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
        });
    } else if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
        component_handler.dispatch(interaction.message.interaction.id, interaction, {
            res: res,
        })
    }
});

app.listen(8080, () => {
    console.log('Server is starting!');
    cmd.initialize();
});