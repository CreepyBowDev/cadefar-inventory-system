'use strict';

require('dotenv').config();

module.exports = {
  development: {
    username: process.env.DB_USER,
    password: process.env.PASSWORD_DB,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    dialect: 'mysql'
  },

  test: {
    username: process.env.DB_USER,
    password: process.env.PASSWORD_DB,
    database: process.env.DB_NAME_TEST,
    host: process.env.DB_HOST,
    dialect: 'mysql'
  },

  production: {
    username: process.env.DB_USER,
    password: process.env.PASSWORD_DB,
    database: process.env.DB_NAME_PRODUCTION,
    host: process.env.DB_HOST,
    dialect: 'mysql'
  }
};