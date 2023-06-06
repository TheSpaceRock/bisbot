/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async function(knex) {
    await knex.schema.createTable('tomestone_values', (t) => {
        t.primary(['grade_id', 'slot_id']);
        t.integer('grade_id').notNullable();
        t.integer('slot_id').notNullable();
        t.integer('value').notNullable();
    });
    await knex('tomestone_values').insert([
        {slot_id: 0,  grade_id: 3, value: 500 },
        {slot_id: 1,  grade_id: 3, value: 495 },
        {slot_id: 2,  grade_id: 3, value: 825 },
        {slot_id: 3,  grade_id: 3, value: 495 },
        {slot_id: 4,  grade_id: 3, value: 825 },
        {slot_id: 5,  grade_id: 3, value: 495 },
        {slot_id: 6,  grade_id: 3, value: 375 },
        {slot_id: 7,  grade_id: 3, value: 375 },
        {slot_id: 8,  grade_id: 3, value: 375 },
        {slot_id: 9,  grade_id: 3, value: 375 },
        {slot_id: 10, grade_id: 3, value: 375 },
    ]);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async function(knex) {
    return knex.chema.dropTable('tomestone_values');
};