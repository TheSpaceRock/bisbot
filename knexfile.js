// Update with your config settings.

import dotenv from 'dotenv';
dotenv.config();

/**
 * @type { Object.<string, import("knex").Knex.Config> }
 */
export default {
    development: {
        client: 'sqlite3',
        connection: {
            filename: process.env.DB_CONN_STRING,
        }
    },
    production: {
        client: 'sqlite3',
        connection: {
            filename: process.env.DB_CONN_STRING,
        }
    },
};
