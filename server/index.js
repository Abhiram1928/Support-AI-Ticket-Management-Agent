const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Initialize SQLite Database File
const dbPath = path.join(__dirname, 'tickets.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to SQLite database:', err.message);
  } else {
    console.log('Connected to local SQLite database at:', dbPath);
    // Create the tickets table if it doesn't exist
    db.run(`CREATE TABLE IF NOT EXISTS tickets (
      ticket_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      priority TEXT NOT NULL,
      desc TEXT,
      status TEXT DEFAULT 'Pending Assignment',
      resolved_by TEXT
    )`, (createErr) => {
      if (createErr) {
        console.error('Error creating tickets table:', createErr.message);
      } else {
        console.log('Tickets database table ready.');
        // Run database migration to add resolved_by column if upgrading an existing db file
        db.run('ALTER TABLE tickets ADD COLUMN resolved_by TEXT', (migrationErr) => {
          if (migrationErr) {
            // Silence warning if column already exists (which is expected on normal runs)
          } else {
            console.log('Database migration successful: added resolved_by column.');
          }
        });
      }
    });
  }
});

// --------------------------------------------------------------------------
// API ENDPOINTS
// --------------------------------------------------------------------------

// 1. GET: Fetch all active tickets
app.get('/api/tickets', (req, res) => {
  const sql = 'SELECT * FROM tickets';
  db.all(sql, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

// 2. POST: Add a new ticket
app.post('/api/tickets', (req, res) => {
  const { ticket_id, name, email, title, category, priority, desc, status } = req.body;
  if (!ticket_id || !name || !email || !title || !category || !priority) {
    return res.status(400).json({ error: 'Missing required ticket fields.' });
  }

  const sql = `INSERT INTO tickets (ticket_id, name, email, title, category, priority, desc, status, resolved_by) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`;
  const params = [ticket_id, name, email, title, category, priority, desc, status || 'Pending Assignment'];

  db.run(sql, params, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.status(201).json({ 
        message: 'Ticket successfully created', 
        ticketId: ticket_id 
      });
    }
  });
});

// 3. PUT: Escalate an existing ticket
app.put('/api/tickets/:id', (req, res) => {
  const ticketId = req.params.id;
  const { priority, status } = req.body;

  const sql = `UPDATE tickets 
               SET priority = ?, status = ? 
               WHERE ticket_id = ?`;
  const params = [priority || 'Critical', status || 'Escalated', ticketId];

  db.run(sql, params, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (this.changes === 0) {
      res.status(404).json({ error: 'Ticket not found.' });
    } else {
      res.json({ message: `Ticket ${ticketId} successfully escalated.` });
    }
  });
});

// 4. PUT: Resolve a ticket (update status to 'Resolved' and track who resolved it)
app.put('/api/tickets/:id/resolve', (req, res) => {
  const ticketId = req.params.id;
  const { resolved_by } = req.body;

  const sql = `UPDATE tickets 
               SET status = 'Resolved', resolved_by = ? 
               WHERE ticket_id = ?`;
  const params = [resolved_by || 'System Default', ticketId];

  db.run(sql, params, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (this.changes === 0) {
      res.status(404).json({ error: 'Ticket not found.' });
    } else {
      res.json({ message: `Ticket ${ticketId} successfully resolved by ${resolved_by || 'System Default'}.` });
    }
  });
});

// 5. DELETE: Legacy resolve fallback
app.delete('/api/tickets/:id', (req, res) => {
  const ticketId = req.params.id;
  const sql = `UPDATE tickets SET status = 'Resolved', resolved_by = 'System Legacy' WHERE ticket_id = ?`;

  db.run(sql, ticketId, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (this.changes === 0) {
      res.status(404).json({ error: 'Ticket not found.' });
    } else {
      res.json({ message: `Ticket ${ticketId} successfully resolved.` });
    }
  });
});

// Close database connection gracefully on process shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database connection:', err.message);
    } else {
      console.log('SQLite database connection closed.');
    }
    process.exit(0);
  });
});

app.listen(PORT, () => {
  console.log(`Support AI Express Server running on http://localhost:${PORT}`);
});
