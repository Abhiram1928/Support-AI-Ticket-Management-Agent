const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'tickets.db');
const db = new sqlite3.Database(dbPath);

// Use the SQL query passed in arguments, or select all tickets by default
const query = process.argv.slice(2).join(' ') || 'SELECT * FROM tickets';

db.all(query, [], (err, rows) => {
  if (err) {
    console.error('❌ SQL Error:', err.message);
  } else {
    console.log(`\n📊 Query Results for: "${query}"`);
    if (rows.length === 0) {
      console.log('No rows returned.');
    } else {
      console.table(rows);
    }
  }
  db.close();
});
