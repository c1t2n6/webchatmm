const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('mapmo.db');

db.all('SELECT id, username, nickname, status FROM users WHERE username LIKE "test%"', (err, rows) => {
    if (err) {
        console.error('Error:', err.message);
    } else {
        console.log('Test users:');
        rows.forEach(row => console.log(row));
    }
    db.close();
});

