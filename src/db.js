import knex_conf from '../knexfile.js';
import knex from 'knex';
import moment from 'moment'

import { RaidRole } from './enum.js'
import { GearInfo } from "./gear.js";
import { Raider } from "./raider.js";

export class BisDb {

    #knex = knex(knex_conf[process.env.NODE_ENV]);

    is_raider_registered(guild_id, user_id) {
        return this.#knex('raiders').select('user_id').where({
            guild_id: guild_id,
            user_id: user_id,
        }).then((x) => (x.length !== 0) ? true : false);
    }

    get_gear_info() {
        let slots = this.#knex
            .select(['gs.id', 'gs.name', 'gs.etro_id', 'lt.gear_type'])
            .from('gear_slots as gs')
            .join('loot_types as lt', {
                'lt.id': 'gs.loot_type_id',
            })
            .orderBy('gs.id');
        let grades = this.#knex
            .select(['id', 'name', 'ilvl', 'allowed_types', 'etro_hint'])
            .from('loot_grade')
            .orderBy('ilvl', 'id');
        return Promise.all([slots, grades]).then((x) => {
            const [slots, grades] = x;
            return new GearInfo(slots, grades);
        });
    }

    async get_raider_data(guild_id, user_id) {
        let basics = this.#knex
            .select(['r.guild_id', 'r.user_id', 'r.bis_url', 'r.job', 'j.role'])
            .from('raiders as r')
            .leftJoin('job_info as j', {
                'j.job': 'r.job',
            })
            .where({
                guild_id: guild_id,
                user_id: user_id,
            });
        let clears = this.#knex
            .select(['raid_id', 'books', 'last_clear'])
            .from('raid_clears')
            .where({
                guild_id: guild_id,
                user_id: user_id,
            }).then((clears) => {
                return clears.map((x) => {
                    x.last_clear = moment.unix(x.last_clear).utc();
                    return x;
                });
            });
        let slot_data = this.#knex
            .select([
                'slot_id',
                'gcur.id as current_grade',
                'gcur.name as current_name',
                'gcur.ilvl as current_ilvl',
                'gbis.id as bis_grade',
                'gbis.name as bis_name',
                'gbis.ilvl as bis_ilvl',
            ])
            .from('gearset as gs')
            .join('loot_grade as gcur', {'gcur.id': 'gs.current'})
            .join('loot_grade as gbis', {'gbis.id': 'gs.bis'})
            .where({
                guild_id: guild_id,
                user_id: user_id,
            });
        return Promise.all([basics, clears, slot_data]).then((x) => {
            let [basics, clears, slot_data] = x;
            return new Raider(basics[0], clears, slot_data);
        })
    }

    get_raid_roles(guild_id) {
        return this.#knex
            .select('r.user_id')
            .select(this.#knex.raw('IFNULL(j.role, ?) as role', [RaidRole.Unknown]))
            .from('raiders as r')
            .leftJoin('job_info as j', {
                'j.job': 'r.job',
            })
            .where({
                'r.guild_id': guild_id,
            })
            .then((rows) => {
                let result = {};
                for (const row of rows) {
                    result[row.user_id] = row.role
                }
                return result;
            });
    }

    can_guild_clear(guild_id, raid_id, last_weekly_reset) {
        return this.#knex
            .select('user_id')
            .from('raid_clears')
            .where({
                guild_id: guild_id,
                raid_id: raid_id,
            })
            .andWhere('last_clear', '<', last_weekly_reset.unix())
            .then((x) => (x.length > 0));
    }

    get_loot_rollers(guild_id, raid_id) {
        return this.#knex
            .select(['lt.id', 'lt.name', 'lt.gear_type', 'lt.raid_grade'])
            .from('raid_loot as rl')
            .join('loot_types as lt', {'lt.id': 'rl.loot_type_id'})
            .where({'rl.raid_id': raid_id})
            .then((drops) => {
                return Promise.all(drops.map((drop) => {
                    return Promise.all([drop, this.#knex
                        .select('r.user_id')
                        .select(this.#knex.raw('IFNULL(j.role, ?) as role', [RaidRole.Unknown]))
                        .from(this.#knex.raw(`
                            (SELECT user_id FROM
                                -- Select users who have this in bis
                                (SELECT DISTINCT gs.user_id
                                FROM gearset gs
                                JOIN gear_slots sl
                                    ON sl.id = gs.slot_id
                                WHERE gs.guild_id = :guild_id
                                    AND sl.loot_type_id = :lt_id
                                    AND gs.bis = :grade_id
                                    AND gs.bis != 0
                                UNION
                                -- Select users who can upgrade
                                SELECT DISTINCT gs.user_id
                                FROM gearset gs
                                JOIN gear_slots sl
                                    ON sl.id = gs.slot_id
                                JOIN loot_types lt
                                    ON lt.id = sl.loot_type_id
                                WHERE gs.guild_id = :guild_id
                                    AND lt.gear_type = :gear_type
                                    AND gs.current IN (
                                        SELECT grade_from
                                        FROM gear_upgrades
                                        WHERE loot_type_id = :lt_id
                                        )
                                )
                            -- Exclude users who already have this gear
                            EXCEPT
                            SELECT user_id FROM
                                (SELECT DISTINCT gs.user_id
                                FROM gearset gs
                                JOIN gear_slots sl
                                    ON sl.id = gs.slot_id
                                WHERE gs.guild_id = :guild_id
                                    AND sl.loot_type_id = :lt_id
                                    AND gs.current = :grade_id
                                    AND gs.current != 0
                                )
                            ) as user_set`, {
                                guild_id: guild_id,
                                lt_id: drop.id,
                                grade_id: drop.raid_grade,
                                gear_type: drop.gear_type,
                            }))
                        .join('raiders as r', {'r.user_id': 'user_set.user_id'})
                        .leftJoin('job_info as j', {'j.job': 'r.job'})
                        .where({'r.guild_id': guild_id})
                        ]);
                })).then((drops) => {
                    let result = {}
                    for (const [drop, rollers] of drops) {
                        result[drop.id] = {
                            name: drop.name,
                            rollers: rollers,
                        };
                    }
                    return result;
                });
            });
    }

    async create_raider(guild_id, user_id) {
        await this.#knex.transaction(async (trx) => {
            await trx.insert({
                    guild_id: guild_id,
                    user_id: user_id,
                    bis_url: null,
                    job: null,
                }).into('raiders');
            await trx.insert(trx.raw(`
                    SELECT  :guild_id as guild_id,
                            :user_id as user_id,
                            raid_id,
                            0 as last_clear,
                            0 as books
                    FROM (SELECT DISTINCT raid_id FROM raid_loot)
                    `, {guild_id: guild_id, user_id: user_id})
                ).into('raid_clears');
            await trx.insert(trx.raw(`
                    SELECT  :guild_id as guild_id,
                            :user_id as user_id,
                            id as slot_id,
                            0 AS current,
                            0 AS bis
                    FROM gear_slots
                    `, {guild_id: guild_id, user_id: user_id})
                ).into('gearset');
        });
    }

    async delete_raider(guild_id, user_id) {
        await this.#knex.transaction(async (trx) => {
            await trx('raiders')
                .where({
                    guild_id: guild_id,
                    user_id: user_id,
                })
                .del();
            await trx('raid_clears')
                .where({
                    guild_id: guild_id,
                    user_id: user_id,
                })
                .del();
            await trx('gearset')
                .where({
                    guild_id: guild_id,
                    user_id: user_id,
                })
                .del();
        });
    }

    async update_clear(guild_id, raid_id, clear_time, last_weekly_reset) {
        await this.#knex('raid_clears')
            .update({
                'books': this.#knex.raw('books + 1'),
                'last_clear': clear_time.unix(),
            })
            .where({
                guild_id: guild_id,
                raid_id: raid_id,
            })
            .andWhere('last_clear', '<', last_weekly_reset.unix());
    }

    async update_books(guild_id, user_id, raid_id, books) {
        await this.#knex('raid_clears')
            .update({
                books: books,
            })
            .where({
                guild_id: guild_id,
                user_id: user_id,
                raid_id: raid_id,
            });
    }

    async update_bis(guild_id, user_id, bis_url, job, bis_slots) {
        await this.#knex.transaction(async (trx) => {
            await trx('raiders')
                .update({
                    bis_url: bis_url,
                    job: job,
                })
                .where({
                    guild_id: guild_id,
                    user_id: user_id,
                });
            for (const slot of bis_slots) {
                await trx('gearset')
                    .update({
                        bis: slot.grade_id,
                    })
                    .where({
                        guild_id: guild_id,
                        user_id: user_id,
                        slot_id: slot.slot_id,
                    });
            }
        });
    }

    async update_gear(guild_id, user_id, slots) {
        await this.#knex.transaction(async (trx) => {
            for (const slot of slots) {
                await trx('gearset')
                    .update({
                        current: slot.grade_id,
                    })
                    .where({
                        guild_id: guild_id,
                        user_id: user_id,
                        slot_id: slot.slot_id
                    });
            }
        });
    }

}