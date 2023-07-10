var mysql = require ("mysql2");

var connection = mysql.createConnection({
    host : 'localhost',
    database : 'LibManagement',
    user : 'root',
    password : 'MyNewPass'
});

module.exports = connection;