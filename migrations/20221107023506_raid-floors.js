/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async function(knex) {
    await knex.schema
        .alterTable('raid_clears', (t) => {
            t.dropColumn('books');
            t.renameColumn('last_clear', 'clear_time');
            t.dropPrimary();
            t.primary(['guild_id', 'raid_id', 'user_id', 'clear_time']);
        })
        .createTable('raid_info', (t) => {
            t.string('raid_id').notNullable().primary();
            t.boolean('has_lockout').notNullable();
            t.integer('floor').notNullable().unique();
            t.string('progression_group').notNullable();
        });
    await knex('raid_clears')
        .where({
            clear_time: 0,
        })
        .del();
    await knex('raid_info').insert([
        {raid_id: 'p5s', has_lockout: true, floor: 1, progression_group: '6.2'},
        {raid_id: 'p6s', has_lockout: true, floor: 2, progression_group: '6.2'},
        {raid_id: 'p7s', has_lockout: true, floor: 3, progression_group: '6.2'},
        {raid_id: 'p8s', has_lockout: true, floor: 4, progression_group: '6.2'},
    ]);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = function(knex) {
    return knex.schema
        .alterTable('raid_clears', (t) => {
            t.integer('books').notNullable().defaultTo(0);
            t.renameColumn('clear_time', 'last_clear');
            t.dropPrimary();
            t.primary(['guild_id', 'user_id', 'raid_id']);
        })
        .dropTable('raid_info');
};
