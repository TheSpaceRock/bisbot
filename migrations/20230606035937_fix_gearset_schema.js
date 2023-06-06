/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async function(knex) {
    await knex.schema.alterTable('gearset', (t) => {
        t.string('guild_id').notNullable().alter();
        t.string('user_id').notNullable().alter();
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async function(knex) {
    await knex.schema.alterTable('gearset', (t) => {
        t.integer('guild_id').notNullable().alter();
        t.integer('user_id').notNullable().alter();
    });
};
