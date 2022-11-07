import dotenv from 'dotenv';

import express from 'express';
import { verifyKeyMiddleware } from 'discord-interactions';
import { CommandRegistry } from './command.js';
import { BisDb } from './db.js';

dotenv.config();

const app = express();
const cmd = new CommandRegistry();
const bis_db = new BisDb();

app.get('/foobar', (req, res) => {
    res.send('foobar 2!')
})

app.use(verifyKeyMiddleware(process.env.CLIENT_PUBLIC_KEY))

app.post('/interactions', (req, res) => {
    const interaction = req.body;
    cmd.dispatch(interaction, {
        res: res,
        bis_db: bis_db,
    })
});

app.listen(8080, () => {
    console.log('Server is starting!');
    cmd.initialize(bis_db);
});