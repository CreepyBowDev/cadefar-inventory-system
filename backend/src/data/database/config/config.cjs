'use strict';

require('dotenv').config();
const { BASE_PRUEBAS, esPruebaLocal } = require('../../../shared/utils/pagos-entorno.cjs');
const local = esPruebaLocal();
if (!local && [process.env.DB_NAME, process.env.DB_NAME_PRODUCTION].includes(BASE_PRUEBAS)) {
  throw new Error('La base exclusiva de pruebas requiere el modo PRUEBA_LOCAL');
}

module.exports = {
  development: {
    username: process.env.DB_USER,
    password: process.env.PASSWORD_DB,
    database: local ? BASE_PRUEBAS : process.env.DB_NAME,
    host: process.env.DB_HOST,
    dialect: 'mysql',
    logging: false
  },

  test: {
    username: process.env.DB_USER,
    password: process.env.PASSWORD_DB,
    database: process.env.DB_NAME_TEST,
    host: process.env.DB_HOST,
    dialect: 'mysql',
    logging: false
  },

  production: {
    username: process.env.DB_USER,
    password: process.env.PASSWORD_DB,
    database: process.env.DB_NAME_PRODUCTION,
    host: process.env.DB_HOST,
    dialect: 'mysql',
    logging: false
  }
};
