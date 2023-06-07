import fetch from 'node-fetch'

export async function discord_fetch(endpoint, options = {}) {
    options.headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bot ' + process.env.BOT_TOKEN,
    }
    return fetch('https://discord.com/api/v10/' + endpoint, options);
}

export async function etro_fetch(endpoint, options = {}, retry = 3) {
    let result;
    let idx = 0;
    do {
        if (idx > 0) {
            console.log(`Retry etro request ${idx+1} of ${retry}`);
            await (new Promise(resolve => setTimeout(resolve, 3000)));
        }
        result = await fetch('https://etro.gg/api/' + endpoint, options);
        idx++;
    } while (!result.ok && idx < retry);
    return result;
}


export function is_etro_gearset(url) {
    return url.host === 'etro.gg' && url.pathname && url.pathname.startsWith('/gearset/');
}

export async function etro_parse_gearset(bis_url, gear_info) {
    if (!is_etro_gearset(bis_url)) {
        throw new Error('Failed to parse gearset URL');
    }
    const gearset_id = bis_url.pathname.split('/').at(-1);
    const res = await etro_fetch(`gearsets/${gearset_id}`);
    const res_json = await res.json();
    if (!res.ok) {
        console.error('etro.gg error: ', JSON.stringify(await res_json, null, 2));
        throw new Error('Failed to request gearset from etro.gg');
    }
    let bis = await Promise.all(gear_info.slots().map(async (slot) => {
        let grade = 0;
        let etro_equip_id = null;
        if (slot.etro_id in res_json) {
            etro_equip_id = res_json[slot.etro_id];
        }
        if (etro_equip_id !== null) {
            const equip_res = await etro_fetch(`equipment/${etro_equip_id}`);
            const equip_json = await equip_res.json();
            if (!equip_res.ok) {
                console.error('etro.gg equip error: ', JSON.stringify(equip_json, null, 2));
                throw new Error('Failed to request equip from etro.gg');
            } else {
                grade = gear_info.resolve_grade({
                    slot: slot,
                    ilvl: equip_json.itemLevel,
                    name: equip_json.name,
                });
            }
        }
        return {
            slot_id: slot.id,
            grade_id: grade,
        };
    }));
    return { job: res_json.jobAbbrev, slots: bis }
}