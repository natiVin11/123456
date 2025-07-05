// server.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const multer = require('multer');
const xlsx = require('xlsx');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const app = express();
const db = new sqlite3.Database('./data.sqlite1');
const upload = multer({ dest: 'uploads/' });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'secret-key', resave: false, saveUninitialized: true }));
app.use(express.static('public'));

function initDB() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            role TEXT
        )`);

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
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS user_projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            project TEXT,
            address TEXT,
            UNIQUE(user_id, project, address),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        const defaultUsers = [
            { username: 'ניסים_מנהל', password: 'ניסים עשור', role: 'admin' },
            { username: 'אליהו_מנהל', password: 'אליהו אללוף', role: 'admin' },
            { username: 'ניסים עשור', password: 'ניסים עשור', role: 'user' },
            { username: 'אליהו אללוף', password: 'אליהו אללוף', role: 'user' },
        ];

        defaultUsers.forEach(u => {
            bcrypt.hash(u.password, 12).then(hashed => {
                db.run('INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)', [u.username, hashed, u.role]);
            });
        });
    });
}

initDB();

app.get('/me', (req, res) => {
    if (req.session && req.session.user) {
        res.json(req.session.user);
    } else {
        res.status(401).json({ error: 'לא מחובר' });
    }
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).send('Missing username or password');

    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err) return res.status(500).send('DB Error');
        if (!user) return res.status(401).send('Unauthorized');

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).send('Unauthorized');

        req.session.user = { id: user.id, username: user.username, role: user.role };
        res.redirect(user.role === 'admin' ? '/admin.html' : '/user.html');
    });
});

app.get('/my-buildings', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = req.session.user.id;

    db.all('SELECT * FROM user_projects WHERE user_id = ?', [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: 'DB Error' });
        res.json(rows);
    });
});

app.get('/residents-by-building', (req, res) => {
    const { project, address } = req.query;
    if (!project || !address) return res.status(400).json({ error: 'Missing parameters' });

    db.all('SELECT * FROM residents WHERE project = ? AND address = ?', [project, address], (err, rows) => {
        if (err) return res.status(500).json({ error: 'DB Error' });
        res.json(rows);
    });
});

app.post('/update-resident', (req, res) => {
    const { id, status, mobile_phone, house_number, note } = req.body;
    if (!id) return res.status(400).send('Missing resident id');

    const fields = [];
    const values = [];

    if (status) { fields.push('status = ?'); values.push(status); }
    if (mobile_phone) { fields.push('mobile_phone = ?'); values.push(mobile_phone); }
    if (house_number) { fields.push('house_number = ?'); values.push(house_number); }
    if (note) { fields.push('note = ?'); values.push(note); }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    const sql = `UPDATE residents SET ${fields.join(', ')} WHERE id = ?`;
    db.run(sql, values, err => {
        if (err) return res.status(500).send('DB Error');
        res.send('עודכן בהצלחה');
    });
});

app.post('/upload', upload.single('file'), (req, res) => {
    const { project, address } = req.body;
    if (!project || !address || !req.file) {
        if (req.file) fs.unlinkSync(req.file.path); // Clean up uploaded file if validation fails
        return res.status(400).send('Missing project name, address, or file.');
    }

    try {
        const wb = xlsx.readFile(req.file.path);
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(sheet);

        if (data.length === 0) {
            fs.unlinkSync(req.file.path);
            return res.status(400).send('קובץ האקסל ריק או לא מכיל נתונים תקינים.');
        }

        const stmt = db.prepare(`INSERT INTO residents (
            precise_address, owner_full_name, mobile_phone, email, property_right, residing, special_needs,
            household_number, signed_document, representation_member, house_number, entrance, parcel,
            sub_parcel, apartment_number, floor, id_number, status, note, updated_at, project, address
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

        db.serialize(() => { // Use serialize to ensure sequential inserts if many rows
            data.forEach(row => {
                stmt.run([
                    row['כתובת מדוייקת'] || '',
                    row['שם בעל הדירה (מלא)'] || '',
                    row['טלפון נייד'] || '',
                    row['כתובת אי מייל'] || '',
                    row['הזכות בנכס בעלות / שכירות'] || '',
                    row['מגורים בדירה כן/לא'] === 'כן' ? 1 : 0,
                    row['קשיש (70+) / מוגבלות / צרכים מיוחדים'] || '',
                    row['מספר נפשות המגוררות בבית'] || '',
                    row['האם חתם על מסמך...'] || '',
                    row['האם חבר בנציגות כן/לא'] === 'כן' ? 1 : 0,
                    row['מ\' בית'] || '',
                    row['כניסה'] || '',
                    row['חלקה'] || '',
                    row['תת חלקה'] || '',
                    row['מ\' דירה'] || '',
                    row['קומה'] || '',
                    row['ת.\u05d6'] || '', // Corrected for 'ת.ז'
                    'טרם טופל', '', new Date().toISOString(), project, address
                ], function(err) {
                    if (err) {
                        console.error('Error inserting row:', err.message, row);
                    }
                });
            });
            stmt.finalize();
            fs.unlinkSync(req.file.path);
            res.send('הקובץ הועלה בהצלחה');
        });

    } catch (e) {
        console.error(e);
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).send('Error processing file');
    }
});

// מחזיר את כל המשתמשים (ללא סיסמאות)
app.get('/users', (req, res) => {
    db.all('SELECT id, username, role FROM users', [], (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'DB Error' });
        }
        res.json(rows);
    });
});

// עדכון סיסמת משתמש
app.post('/update-user', async (req, res) => {
    const { id, password } = req.body;
    if (!id || !password) return res.status(400).send('Missing user ID or password');

    try {
        const hashedPassword = await bcrypt.hash(password, 12);
        db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, id], function(err) {
            if (err) {
                console.error(err);
                return res.status(500).send('DB Error');
            }
            if (this.changes === 0) {
                return res.status(404).send('User not found');
            }
            res.send('הסיסמה עודכנה בהצלחה');
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error hashing password');
    }
});

// מחיקת משתמש
app.post('/delete-user', (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).send('Missing user ID');

    db.run('DELETE FROM users WHERE id = ?', [id], function(err) {
        if (err) {
            console.error(err);
            return res.status(500).send('DB Error');
        }
        if (this.changes === 0) {
            return res.status(404).send('User not found');
        }
        res.send('המשתמש נמחק בהצלחה');
    });
});

// הוספת משתמש חדש
app.post('/add-user', async (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password || !role) return res.status(400).send('Missing username, password, or role');

    try {
        const hashedPassword = await bcrypt.hash(password, 12);
        db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, hashedPassword, role], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).send('שם המשתמש כבר קיים');
                }
                console.error(err);
                return res.status(500).send('DB Error');
            }
            res.status(201).send('המשתמש נוסף בהצלחה');
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error hashing password');
    }
});


// מחזיר את כל שמות הפרויקטים עם מספר הדיירים בכל פרויקט
app.get('/all-projects', (req, res) => {
    const sql = `
    SELECT project, COUNT(*) AS total
    FROM residents
    GROUP BY project
  `;
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'DB Error' });
        }
        res.json(rows);
    });
});

// חדש: מחיקת פרויקט (כל הדיירים הקשורים לפרויקט יימחקו)
app.post('/delete-project', (req, res) => {
    const { project } = req.body;
    if (!project) {
        return res.status(400).json({ success: false, message: 'Missing project name.' });
    }

    db.serialize(() => {
        db.run('PRAGMA foreign_keys = ON;'); // Enable foreign key constraints

        // Delete assignments first (if user_projects has ON DELETE CASCADE to users,
        // it doesn't automatically cascade to residents, so we manage it)
        db.run('DELETE FROM user_projects WHERE project = ?', [project], function(err) {
            if (err) {
                console.error('Error deleting project assignments:', err.message);
                return res.status(500).json({ success: false, message: 'Database error during assignment deletion.' });
            }

            // Then delete the residents
            db.run('DELETE FROM residents WHERE project = ?', [project], function(err) {
                if (err) {
                    console.error('Error deleting project residents:', err.message);
                    return res.status(500).json({ success: false, message: 'Database error during resident deletion.' });
                }
                if (this.changes > 0 || this.changes === 0) { // If no residents, it's still a "success" for deleting the project
                    res.json({ success: true, message: `Project "${project}" and its residents/assignments deleted successfully.` });
                } else {
                    res.status(404).json({ success: false, message: `Project "${project}" not found or no residents to delete.` });
                }
            });
        });
    });
});

// חדש: מחזיר את כל הכתובות הייחודיות עבור פרויקט מסוים, יחד עם סטטוסים
app.get('/project-addresses', (req, res) => {
    const { project } = req.query;
    if (!project) {
        return res.status(400).json({ error: 'Missing project parameter.' });
    }

    const sql = `
        SELECT
            address,
            COUNT(*) AS total_residents,
            SUM(CASE WHEN status = 'טופל' THEN 1 ELSE 0 END) AS handled_residents,
            SUM(CASE WHEN status = 'טרם טופל' THEN 1 ELSE 0 END) AS unhandled_residents
        FROM residents
        WHERE project = ?
        GROUP BY address;
    `;

    db.all(sql, [project], (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'DB Error' });
        }
        res.json(rows);
    });
});

// חדש: מחזיר את כל זוגות הפרויקט-כתובת הייחודיים
app.get('/all-project-addresses', (req, res) => {
    const sql = `SELECT DISTINCT project, address FROM residents ORDER BY project, address;`;
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'DB Error' });
        }
        res.json(rows);
    });
});


// חדש: שיוך פרויקט-כתובת למשתמש
app.post('/assign-project-to-user', (req, res) => {
    const { userId, project, address } = req.body;
    if (!userId || !project || !address) {
        return res.status(400).json({ success: false, message: 'Missing user ID, project, or address.' });
    }

    db.run('INSERT OR IGNORE INTO user_projects (user_id, project, address) VALUES (?, ?, ?)',
        [userId, project, address], function(err) {
            if (err) {
                console.error('Error assigning project to user:', err.message);
                return res.status(500).json({ success: false, message: 'Database error during assignment.' });
            }
            if (this.changes > 0) {
                res.json({ success: true, message: 'Project assigned to user successfully.' });
            } else {
                res.status(200).json({ success: false, message: 'Assignment already exists or user/project not found.' });
            }
        });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));