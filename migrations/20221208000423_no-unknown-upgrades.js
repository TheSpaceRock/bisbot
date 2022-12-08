/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async function(knex) {
    await knex('gear_upgrades')
        .where({grade_from: 0})
        .del();
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async function(knex) {
    await knex('gear_upgrades')
        .insert([
            {loot_type_id: 12, grade_from: 0, grade_to: 3},
        ]);
};
