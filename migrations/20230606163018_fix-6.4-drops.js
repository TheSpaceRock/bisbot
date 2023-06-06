/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async function(knex) {
    await knex('raid_loot').where({raid_id: 'p12s', loot_type_id: 3}).del();
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async function(knex) {
    await knex('raid_loot').insert([{raid_id: 'p12s', loot_type_id: 3}]);
};
