/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async function(knex) {
    await knex('raiders').update('job', null);
    await knex('raiders').update('bis_url', null);
    await knex('gearset').update({
        bis: 0,
        current: 0,
    });
    await knex('raid_info').del();
    await knex('raid_info').insert([ 
        {raid_id: 'p9s', has_lockout: true, floor: 1, progression_group: '6.4'},
        {raid_id: 'p10s', has_lockout: true, floor: 2, progression_group: '6.4'},
        {raid_id: 'p11s', has_lockout: true, floor: 3, progression_group: '6.4'},
        {raid_id: 'p12s', has_lockout: true, floor: 4, progression_group: '6.4'},
     ]);
     await knex('raid_loot').del()
     await knex('raid_loot').insert([
        {raid_id: 'p9s', loot_type_id: 7},
        {raid_id: 'p9s', loot_type_id: 8},
        {raid_id: 'p9s', loot_type_id: 9},
        {raid_id: 'p9s', loot_type_id: 10},
        {raid_id: 'p10s', loot_type_id: 2},
        {raid_id: 'p10s', loot_type_id: 4},
        {raid_id: 'p10s', loot_type_id: 6},
        {raid_id: 'p10s', loot_type_id: 12},
        {raid_id: 'p10s', loot_type_id: 14},
        {raid_id: 'p11s', loot_type_id: 2},
        {raid_id: 'p11s', loot_type_id: 4},
        {raid_id: 'p11s', loot_type_id: 5},
        {raid_id: 'p11s', loot_type_id: 6},
        {raid_id: 'p11s', loot_type_id: 11},
        {raid_id: 'p11s', loot_type_id: 13},
        {raid_id: 'p11s', loot_type_id: 3},
        {raid_id: 'p12s', loot_type_id: 0},
        {raid_id: 'p12s', loot_type_id: 1},
        {raid_id: 'p12s', loot_type_id: 3},
    ]);
    await knex('loot_grade').where({id: 1}).update({
        ilvl: 640, etro_hint: 'Diadochos',
    });
    await knex('loot_grade').where({id: 2}).update({
        ilvl: 645, name: 'Extreme', etro_hint: 'Voidcast',
    });
    await knex('loot_grade').where({id: 3}).update({
        ilvl: 650, etro_hint: 'Credendum',
    });
    await knex('loot_grade').where({id: 4}).update({
        ilvl: 660,
    });
    await knex('loot_grade').where({id: 5}).update({
        ilvl: 660, etro_hint: 'Ascension',
    });
    await knex('loot_grade').where({id: 6}).update({
        ilvl: 665, etro_hint: 'Ascension',
    });
};


/* eslint-disable no-unused-vars */
/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async function(knex) {
    // This is non-trivial to downgrade, it's probably just better to restore
    // from backup or rebuild from scratch. Maybe in the future I'll simplify
    // patch DB updates.
};
/* eslint-enable no-unused-vars */