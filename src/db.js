import knex_conf from '../knexfile.js';
import knex from 'knex';
import moment from 'moment'

import { RaidRole, GearType } from './enum.js'
import { GearInfo } from "./gear.js";
import { Raider } from "./raider.js";
import { last_weekly_reset } from './util.js';

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
        let upgrades = this.#knex
            .select(['gu.loot_type_id', 'gu.grade_from', 'gu.grade_to', 'lt.gear_type'])
            .from('gear_upgrades as gu')
            .join('loot_types as lt', {
                'lt.id': 'gu.loot_type_id',
            })
            .orderBy(['grade_from', 'grade_to', 'loot_type_id']);
        let tomes = this.#knex
            .select(['slot_id', 'grade_id', 'value'])
            .from('tomestone_values')
            .orderBy(['slot_id', 'grade_id']);
        return Promise.all([slots, grades, upgrades, tomes]).then((x) => {
            const [slots, grades, upgrades, tomes] = x;
            return new GearInfo(slots, grades, upgrades, tomes);
        });
    }

    get_raid_floors() {
        return this.#knex
            .select('raid_id')
            .from('raid_info');
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
        let books = this.#knex
            .select('raid_id')
            .count('clear_time as books')
            .from('raid_clears')
            .where({
                guild_id: guild_id,
                user_id: user_id,
            })
            .groupBy('raid_id');
        let recent_clears = this.#knex
            .select('raid_id')
            .max('clear_time as last_clear')
            .from('raid_clears')
            .where({
                guild_id: guild_id,
                user_id: user_id,
            })
            .groupBy('raid_id')
            .then((clears) => {
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
        return Promise.all([basics, books, recent_clears, slot_data]).then((x) => {
            let [basics, books, recent_clears, slot_data] = x;
            if (basics.length === 1) {
                return new Raider(basics[0], books, recent_clears, slot_data);
            } else {
                return null;
            }
        })
    }

    #select_raider_upgrade_to_bis(knex, guild_id, user_id) {
        return knex
            .select('slot_id')
            .from('gearset')
            .where({
                'guild_id': guild_id,
                'user_id': user_id,
            })
            .whereIn('bis', knex
                .select('grade_to')
                .from('gear_upgrades'));
    }

    #select_raider_slots_with_bis(knex, guild_id, user_id) {
        return knex
            .select('gbis.slot_id')
            .from(knex
                .select(['gs.slot_id', 'sl.loot_type_id', 'gs.bis'])
                .from('gearset as gs')
                .join('gear_slots as sl', {'sl.id': 'gs.slot_id'})
                .where({
                    'gs.guild_id': guild_id,
                    'gs.user_id': user_id,
                })
                .as('gbis'))
            .join(knex
                .select(['sl.loot_type_id', 'gs.current'])
                .from('gearset as gs')
                .join('gear_slots as sl', {'sl.id': 'gs.slot_id'})
                .where({
                    'gs.guild_id': guild_id,
                    'gs.user_id': user_id,
                })
                .as('gcur'),
                {'gcur.loot_type_id': 'gbis.loot_type_id'})
            .where({'gbis.bis': knex.ref('gcur.current')});
    }

    async get_required_upgrades(guild_id, user_id) {
        const current_required = await this.#knex
            .select('lt.gear_type')
            .count('sl.id as slots')
            .from('gear_slots as sl')
            .join('loot_types as lt', {'lt.id': 'sl.loot_type_id'})
            .whereNotIn('sl.id', this.#select_raider_slots_with_bis(this.#knex, guild_id, user_id))
            .whereIn('sl.id', this.#select_raider_upgrade_to_bis(this.#knex, guild_id, user_id))
            .groupBy('lt.gear_type');
        const total_required = await this.#knex
            .select('lt.gear_type')
            .count('sl.id as slots')
            .from('gear_slots as sl')
            .join('loot_types as lt', {'lt.id': 'sl.loot_type_id'})
            .whereIn('sl.id', this.#select_raider_upgrade_to_bis(this.#knex, guild_id, user_id))
            .groupBy('lt.gear_type');
        const result = {};
        result[GearType.Weapon] = { current: 0, total: 0 };
        result[GearType.Clothing] = { current: 0, total: 0 };
        result[GearType.Accessory] = { current: 0, total: 0 };
        total_required.forEach(x => { result[x.gear_type].total = x.slots });
        current_required.forEach(x => { result[x.gear_type].current = x.slots });
        return result;
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

    #select_raid_lockout_floors(knex, raid_id) {
        return knex
            .select('ri.raid_id')
            .from('raid_info as ri')
            .join('raid_info as ri_target', {
                'ri_target.progression_group': 'ri.progression_group',
            })
            .where({'ri_target.raid_id': raid_id})
            .andWhere({'ri.has_lockout': true})
            .andWhere('ri.floor', '>=', knex.ref('ri_target.floor'));
    }

    #select_raider_locking_clears(knex, guild_id, user_id, raid_id) {
        return knex
            .select(['raid_id', 'clear_time'])
            .from('raid_clears')
            .where({
                guild_id: guild_id,
                user_id: user_id,
            })
            .whereIn('raid_id', this.#select_raid_lockout_floors(knex, raid_id))
            .andWhere('clear_time', '>', last_weekly_reset().unix());
    }

    can_guild_clear(guild_id, raid_id) {
        return this.#knex
            .select('user_id')
            .from('raiders')
            .where({
                guild_id: guild_id,
            })
            // Select users missing a clear from any floors >= the raid id
            // for the current reset.
            .whereNotIn('user_id', this.#knex
                .select('user_id')
                .from('raid_clears')
                .where({
                    guild_id: guild_id,
                })
                // Select raids of the same progression group
                // where the floor >= the provided raid id and has lockout
                .whereIn('raid_id', this.#select_raid_lockout_floors(this.#knex, raid_id))
                .andWhere('clear_time', '>', last_weekly_reset().unix())
            ).then((x) => (x.length > 0));
    }

    async can_raider_clear(guild_id, user_id, raid_id) {
        return (await this.#select_raider_locking_clears(this.#knex, guild_id, user_id, raid_id)).length === 0;
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

    get_gear_errors(guild_id) {
        return this.#knex
            .select('user_id')
            .from('gearset')
            .where('guild_id', guild_id)
            .andWhere((x) => {
                x.where('current', 0)
                .orWhere('bis', 0)
            })
            .orderBy('user_id')
            .distinct();
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

    async insert_clear(guild_id, raid_id, clear_time) {
        await this.#knex.transaction(async (trx) => {
            const users = await trx.select('user_id').from('raiders').where({guild_id: guild_id});
            for (const row of users) {
                const has_clear = (await this.#select_raider_locking_clears(trx, guild_id, row.user_id, raid_id)).length > 0;
                if (!has_clear) {
                    await trx('raid_clears').insert({
                        guild_id: guild_id,
                        raid_id: raid_id,
                        user_id: row.user_id,
                        clear_time: clear_time.unix(),
                    });
                }
            }
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