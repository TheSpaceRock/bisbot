import { GearType, RaidRole } from "../src/enum.js";

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async function(knex) {
    await knex.schema
        .createTable('raiders', (t) => {
            t.primary(['guild_id', 'user_id']);
            t.string('guild_id').notNullable();
            t.string('user_id').notNullable();
            t.string('bis_url');
            t.string('job');
        })
        .createTable('job_info', (t) => {
            t.primary(['job']);
            t.string('job')
            t.integer('role')
        })
        .createTable('raid_clears', (t) => {
            t.primary(['guild_id', 'user_id', 'raid_id']);
            t.string('guild_id').notNullable();
            t.string('user_id').notNullable();
            t.string('raid_id').notNullable();
            t.timestamp('last_clear').notNullable();
            t.integer('books').notNullable();
        })
        .createTable('loot_grade', (t) => {
            t.integer('id').notNullable().primary();
            t.string('name').notNullable();
            t.integer('ilvl').notNullable();
            t.integer('allowed_types').notNullable();
            t.string('etro_hint');
        })
        .createTable('loot_types', (t) => {
            t.integer('id').notNullable().primary();
            t.string('name').notNullable();
            t.integer('raid_grade').notNullable();
            t.integer('gear_type').notNullable();
        })
        .createTable('gear_upgrades', (t) => {
            t.primary(['loot_type_id', 'grade_from']);
            t.integer('loot_type_id').notNullable();
            t.integer('grade_from').notNullable();
            t.integer('grade_to').notNullable();
        })
        .createTable('raid_loot', (t) => {
            t.primary(['raid_id', 'loot_type_id']);
            t.integer('raid_id').notNullable();
            t.integer('loot_type_id').notNullable();
        })
        .createTable('gear_slots', (t) => {
            t.integer('id').notNullable().primary();
            t.integer('loot_type_id').notNullable();
            t.string('name').notNullable();
            t.string('etro_id').notNullable();
        })
        .createTable('gearset', (t) => {
            t.primary(['guild_id', 'user_id', 'slot_id']);
            t.integer('guild_id').notNullable();
            t.integer('user_id').notNullable();
            t.integer('slot_id').notNullable();
            t.integer('current').notNullable().defaultTo(0);
            t.integer('bis').notNullable().defaultTo(0);
        });
    return Promise.all([
        knex('job_info').insert([
            {job: 'BLM', role: RaidRole.DPS},
            {job: 'DRG', role: RaidRole.DPS},
            {job: 'NIN', role: RaidRole.DPS},
            {job: 'MCH', role: RaidRole.DPS},
            {job: 'SMN', role: RaidRole.DPS},
            {job: 'SAM', role: RaidRole.DPS},
            {job: 'DNC', role: RaidRole.DPS},
            {job: 'RPR', role: RaidRole.DPS},
            {job: 'BRD', role: RaidRole.DPS},
            {job: 'MNK', role: RaidRole.DPS},
            {job: 'RDM', role: RaidRole.DPS},
            {job: 'WHM', role: RaidRole.Healer},
            {job: 'AST', role: RaidRole.Healer},
            {job: 'SCH', role: RaidRole.Healer},
            {job: 'SGE', role: RaidRole.Healer},
            {job: 'WAR', role: RaidRole.Tank},
            {job: 'GNB', role: RaidRole.Tank},
            {job: 'PLD', role: RaidRole.Tank},
            {job: 'DRK', role: RaidRole.Tank},
        ]),
        knex('loot_grade').insert([
            {id: 0, name: 'Unknown', ilvl: 0, allowed_types: GearType.All, etro_hint: null},
            {id: 1, name: 'Crafted/Normal', ilvl: 610, allowed_types: GearType.All, etro_hint: 'Rinascita'},
            {id: 2, name: 'Extreme/Relic', ilvl: 615, allowed_types: GearType.Weapon, etro_hint: null},
            {id: 3, name: 'Tomestone', ilvl: 620, allowed_types: GearType.All, etro_hint: 'Lunar Envoy'},
            {id: 4, name: 'Augmented', ilvl: 630, allowed_types: GearType.All, etro_hint: 'Augmented'},
            {id: 5, name: 'Raid', ilvl: 630, allowed_types: GearType.Clothing | GearType.Accessory, etro_hint: 'Abyssos'},
            {id: 6, name: 'Raid', ilvl: 635, allowed_types: GearType.Weapon, etro_hint: 'Abyssos'},
        ]),
        knex('loot_types').insert([
            {id: 0,     name: 'Mount',              raid_grade: 0, gear_type: GearType.None},
            {id: 1,     name: 'Weapon',             raid_grade: 6, gear_type: GearType.Weapon},
            {id: 2,     name: 'Head',               raid_grade: 5, gear_type: GearType.Clothing},
            {id: 3,     name: 'Body',               raid_grade: 5, gear_type: GearType.Clothing},
            {id: 4,     name: 'Hands',              raid_grade: 5, gear_type: GearType.Clothing},
            {id: 5,     name: 'Legs',               raid_grade: 5, gear_type: GearType.Clothing},
            {id: 6,     name: 'Feet',               raid_grade: 5, gear_type: GearType.Clothing},
            {id: 7,     name: 'Earrings',           raid_grade: 5, gear_type: GearType.Accessory},
            {id: 8,     name: 'Necklace',           raid_grade: 5, gear_type: GearType.Accessory},
            {id: 9,     name: 'Bracelets',          raid_grade: 5, gear_type: GearType.Accessory},
            {id: 10,    name: 'Ring',               raid_grade: 5, gear_type: GearType.Accessory},
            {id: 11,    name: 'Weapon Upgrade',     raid_grade: 0, gear_type: GearType.Weapon},
            {id: 12,    name: 'Weapon Tomestone',   raid_grade: 0, gear_type: GearType.Weapon},
            {id: 13,    name: 'Clothing Upgrade',   raid_grade: 0, gear_type: GearType.Clothing},
            {id: 14,    name: 'Accessory Upgrade',  raid_grade: 0, gear_type: GearType.Accessory},
        ]),
        knex('gear_upgrades').insert([
            {loot_type_id: 11, grade_from: 3, grade_to: 4},
            {loot_type_id: 13, grade_from: 3, grade_to: 4},
            {loot_type_id: 14, grade_from: 3, grade_to: 4},
            {loot_type_id: 12, grade_from: 0, grade_to: 3},
            {loot_type_id: 12, grade_from: 1, grade_to: 3},
            {loot_type_id: 12, grade_from: 2, grade_to: 3},
        ]),
        knex('raid_loot').insert([
            {raid_id: 'p5s', loot_type_id: 7},
            {raid_id: 'p5s', loot_type_id: 8},
            {raid_id: 'p5s', loot_type_id: 9},
            {raid_id: 'p5s', loot_type_id: 10},
            {raid_id: 'p6s', loot_type_id: 2},
            {raid_id: 'p6s', loot_type_id: 4},
            {raid_id: 'p6s', loot_type_id: 6},
            {raid_id: 'p6s', loot_type_id: 12},
            {raid_id: 'p6s', loot_type_id: 14},
            {raid_id: 'p7s', loot_type_id: 2},
            {raid_id: 'p7s', loot_type_id: 4},
            {raid_id: 'p7s', loot_type_id: 5},
            {raid_id: 'p7s', loot_type_id: 6},
            {raid_id: 'p7s', loot_type_id: 11},
            {raid_id: 'p7s', loot_type_id: 13},
            {raid_id: 'p8s', loot_type_id: 0},
            {raid_id: 'p8s', loot_type_id: 1},
            {raid_id: 'p8s', loot_type_id: 3},
        ]),
        knex('gear_slots').insert([
            {id: 0, loot_type_id: 1,    name: 'Weapon',     etro_id: 'weapon'},
            {id: 1, loot_type_id: 2,    name: 'Head',       etro_id: 'head'},
            {id: 2, loot_type_id: 3,    name: 'Body',       etro_id: 'body'},
            {id: 3, loot_type_id: 4,    name: 'Hands',      etro_id: 'hands'},
            {id: 4, loot_type_id: 5,    name: 'Legs',       etro_id: 'legs'},
            {id: 5, loot_type_id: 6,    name: 'Feet',       etro_id: 'feet'},
            {id: 6, loot_type_id: 7,    name: 'Earrings',   etro_id: 'ears'},
            {id: 7, loot_type_id: 8,    name: 'Necklace',   etro_id: 'neck'},
            {id: 8, loot_type_id: 9,    name: 'Bracelets',  etro_id: 'wrists'},
            {id: 9, loot_type_id: 10,   name: 'Left Ring',  etro_id: 'fingerL'},
            {id: 10, loot_type_id: 10,  name: 'Right Ring', etro_id: 'fingerR'},
        ]),
    ]);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = function(knex) {
    return knex.schema
        .dropTable('raiders')
        .dropTable('job_info')
        .dropTable('raid_clears')
        .dropTable('loot_grade')
        .dropTable('loot_types')
        .dropTable('gear_upgrades')
        .dropTable('raid_loot')
        .dropTable('gear_slots')
        .dropTable('gearset')
};
