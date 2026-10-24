require('dotenv').config();

// Release fixtures may select a separate loopback cluster without changing production defaults.
function releaseTestConnection() {
  const value = process.env.LOCAL_RELEASE_TEST_PORT;
  if (!value) return {};
  const port = Number(value);
  if (process.env.DB_HOST !== '127.0.0.1' || !/^security_[a-z0-9_]+_test_[a-f0-9]+$/i.test(process.env.DB_NAME || '') || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Local release database override requires a disposable security test database on loopback.');
  }
  return { port };
}

module.exports = {
  development: {
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || 'password',
    database: process.env.DB_NAME || 'home_accounting_dev',
    host: process.env.DB_HOST || '127.0.0.1',
    dialect: 'postgres',
    ...releaseTestConnection(),
    logging: false
  },
  production: {
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || 'password',
    database: process.env.DB_NAME || 'home_accounting_dev',
    host: process.env.DB_HOST || '127.0.0.1',
    dialect: 'postgres',
    ...releaseTestConnection(),
    logging: false
  }
};
