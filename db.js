// db.js
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs'); // Added for checking if DB file exists

// Define the database file path
const DB_FILE = path.join(__dirname, 'data.sqlite1');

// Check if the database file exists
const dbExists = fs.existsSync(DB_FILE);

// Connect to the database
const db = new sqlite3.Database(DB_FILE, (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        // If the database file was just created, initialize the schema
        if (!dbExists) {
            console.log('Database file created, initializing schema...');
            initDB();
        }
    }
});

// Function to initialize the database schema and insert default users
function initDB() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            role TEXT
        )`, (err) => {
            if (err) console.error('Error creating users table:', err.message);
        });

        db.run(`CREATE TABLE IF NOT EXISTS residents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            precise_address TEXT,
            owner_full_name TEXT,
            mobile_phone TEXT,
            email TEXT,
            property_right TEXT,
            residing BOOLEAN,
            special_needs TEXT,
            household_number INTEGER,
            signed_document TEXT,
            representation_member BOOLEAN,
            house_number TEXT,
            entrance TEXT,
            parcel TEXT,
            sub_parcel TEXT,
            apartment_number TEXT,
            floor TEXT,
            id_number TEXT,
            status TEXT DEFAULT 'טרם טופל',
            note TEXT,
            updated_at TEXT,
            project TEXT,
            address TEXT
        )`, (err) => {
            if (err) console.error('Error creating residents table:', err.message);
        });

        db.run(`CREATE TABLE IF NOT EXISTS user_projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            project TEXT,
            address TEXT,
            UNIQUE(user_id, project, address),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`, (err) => {
            if (err) console.error('Error creating user_projects table:', err.message);
        });

        // Add default users only if the database was just created
        if (!dbExists) {
            const defaultUsers = [
                { username: 'ניסים_מנהל', password: 'ניסים עשור', role: 'admin' },
                { username: 'אליהו_מנהל', password: 'אליהו אללוף', role: 'admin' },
                { username: 'ניסים עשור', password: 'ניסים עשור', role: 'user' },
                { username: 'אליהו אללוף', password: 'אליהו אללוף', role: 'user' },
            ];

            defaultUsers.forEach(u => {
                bcrypt.hash(u.password, 12).then(hashed => {
                    db.run('INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)', [u.username, hashed, u.role], (err) => {
                        if (err) console.error(`Error inserting default user ${u.username}:`, err.message);
                    });
                });
            });
            console.log('Default users inserted (if not already present).');
        }
    });
}

// Export the database instance for use in server.js
module.exports = db;