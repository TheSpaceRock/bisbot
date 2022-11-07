import dotenv from 'dotenv'

import express from 'express'
//import fetch from 'node-fetch'
import { discord_fetch } from './api.js'

import { verifyKeyMiddleware, InteractionType, InteractionResponseType } from 'discord-interactions'

dotenv.config()
const app = express();

app.get('/foobar', (req, res) => {
    res.send('foobar 2!')
})

app.use(verifyKeyMiddleware(process.env.CLIENT_PUBLIC_KEY))

app.post('/interactions', (req, res) => {
    const { type, data } = req.body;
    console.log(req.body);
    if (type === InteractionType.APPLICATION_COMMAND) {
        if (data.name === 'bis') {
            return res.send({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: 'Foobar!' },
            })
        }
    }
});

async function register_commands() {
    try {
        console.log('Registering bot commands');
        const res = await discord_fetch(`applications/${process.env.APP_ID}/commands`, {
            method: 'POST',
            body: JSON.stringify({
                name: 'bis',
                description: 'A command',
                type: 1,
            }),
        });
        if (!res.ok) {
            console.log(res.status);
            throw new Error(JSON.stringify(await res.json()));
        } else {
            console.log(await res.json());
        }
    } catch (err) {
        console.error('Error registering commands: ', err)
    }
}

app.listen(8080, () => {
    console.log('Server is starting!');
    register_commands();
});