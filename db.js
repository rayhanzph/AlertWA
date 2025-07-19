// db.js
const sql = require('mssql');

const config = {
  user: 'sa',
  password: '#gr3@t_d!5c0v3ry,.', // ← GANTI
  server: 'ariasqco402',       // ← GANTI jika pakai IP
  database: 'db_collaboration',
  options: {
    trustServerCertificate: true,
    encrypt: false
  }
};

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log('✅ Connected to SQL Server');
    return pool;
  })
  .catch(err => {
    console.error('❌ DB Connection Failed:', err.message);
    process.exit(1);
  });

module.exports = {
  sql,
  poolPromise
};
