import fetch from 'node-fetch'

export async function discord_fetch(endpoint, options = {}) {
    options.headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bot ' + process.env.BOT_TOKEN,
    }
    fetch('https://discord.com/api/v10/' + endpoint, options)
}