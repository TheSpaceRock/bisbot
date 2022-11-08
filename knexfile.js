// Update with your config settings.

/**
 * @type { Object.<string, import("knex").Knex.Config> }
 */
export default {
    development: {
        client: 'sqlite3',
        connection: {
            filename: 'bis.db',
        }
    },
    production: {
        client: 'sqlite3',
        connection: {
            filename: process.env.BISBOT_DB_FILE,
        }
    },
};
