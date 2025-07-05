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
const upload = multer({ dest: 'uploads/' }); // תיקייה זמנית לקבצים מועלים

// --- הגדרות Middleware ---
app.use(express.json()); // מאפשר לנתח בקשות JSON
app.use(express.urlencoded({ extended: true })); // מאפשר לנתח בקשות עם נתוני טפסים
app.use(session({
    secret: 'secret-key', // מפתח סודי לחתימה על העוגיות של הסשן
    resave: false, // מונע שמירה מחדש של סשנים שלא שונו
    saveUninitialized: true // שומר סשנים חדשים גם אם הם לא אותחלו
}));
app.use(express.static('public')); // מגיש קבצים סטטיים מהתיקייה 'public'

// --- פונקציית אתחול מסד נתונים ---
function initDB() {
    db.serialize(() => {
        // טבלת משתמשים
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            role TEXT
        )`);

        // טבלת דיירים
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

        // טבלת שיוכי פרויקטים למשתמשים
        db.run(`CREATE TABLE IF NOT EXISTS user_projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            project TEXT,
            address TEXT,
            UNIQUE(user_id, project, address),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        // משתמשי ברירת מחדל לאתחול ראשוני
        const defaultUsers = [
            { username: 'ניסים_מנהל', password: 'ניסים עשור', role: 'admin' },
            { username: 'אליהו_מנהל', password: 'אליהו אללוף', role: 'admin' },
            { username: 'ניסים עשור', password: 'ניסים עשור', role: 'user' },
            { username: 'אליהו אללוף', password: 'אליהו אללוף', role: 'user' },
        ];

        // הוספת משתמשי ברירת המחדל (רק אם אינם קיימים כבר)
        defaultUsers.forEach(u => {
            bcrypt.hash(u.password, 12).then(hashed => {
                db.run('INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)', [u.username, hashed, u.role]);
            });
        });
    });
}

// קריאה לפונקציית אתחול מסד הנתונים
initDB();

// --- נקודות קצה (API Endpoints) ---

// בדיקת מצב התחברות המשתמש
app.get('/me', (req, res) => {
    if (req.session && req.session.user) {
        res.json(req.session.user);
    } else {
        res.status(401).json({ error: 'לא מחובר' });
    }
});

// התחברות משתמש
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).send('שם משתמש או סיסמה חסרים.');

    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err) return res.status(500).send('שגיאת מסד נתונים.');
        if (!user) return res.status(401).send('שם משתמש או סיסמה שגויים.');

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).send('שם משתמש או סיסמה שגויים.');

        req.session.user = { id: user.id, username: user.username, role: user.role };
        // הפנייה לדף המתאים לפי תפקיד המשתמש
        res.redirect(user.role === 'admin' ? '/admin.html' : '/user.html');
    });
});

// קבלת בניינים (פרויקטים וכתובות) המשויכים למשתמש המחובר
app.get('/my-buildings', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'לא מורשה. אנא התחבר.' });
    }
    const userId = req.session.user.id;

    db.all('SELECT * FROM user_projects WHERE user_id = ?', [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: 'שגיאת מסד נתונים.' });
        res.json(rows);
    });
});

// קבלת דיירים לפי פרויקט וכתובת
app.get('/residents-by-building', (req, res) => {
    const { project, address } = req.query;
    if (!project || !address) return res.status(400).json({ error: 'חסרים פרמטרים: פרויקט או כתובת.' });

    db.all('SELECT * FROM residents WHERE project = ? AND address = ?', [project, address], (err, rows) => {
        if (err) return res.status(500).json({ error: 'שגיאת מסד נתונים.' });
        res.json(rows);
    });
});

// עדכון פרטי דייר
app.post('/update-resident', (req, res) => {
    const { id, status, mobile_phone, house_number, note } = req.body;
    if (!id) return res.status(400).send('חסר מזהה דייר (ID).');

    const fields = [];
    const values = [];

    if (status) { fields.push('status = ?'); values.push(status); }
    if (mobile_phone) { fields.push('mobile_phone = ?'); values.push(mobile_phone); }
    if (house_number) { fields.push('house_number = ?'); values.push(house_number); }
    if (note) { fields.push('note = ?'); values.push(note); }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id); // ה-ID של הדייר הוא הערך האחרון ב-values

    const sql = `UPDATE residents SET ${fields.join(', ')} WHERE id = ?`;
    db.run(sql, values, err => {
        if (err) {
            console.error('שגיאה בעדכון דייר:', err.message);
            return res.status(500).send('שגיאת מסד נתונים בעת עדכון דייר.');
        }
        res.send('הדייר עודכן בהצלחה.');
    });
});

// --- העלאת קובץ אקסל וייבוא דיירים (החלק המעודכן ביותר) ---
app.post('/upload', upload.single('file'), (req, res) => {
    // שם הפרויקט נלקח מגוף הבקשה (יוזן על ידי האדמין)
    const { project } = req.body;

    if (!project || !req.file) {
        if (req.file) fs.unlinkSync(req.file.path); // נקה קובץ אם חסר פרויקט או קובץ
        return res.status(400).send('חסר שם פרויקט או קובץ להעלאה.');
    }

    try {
        const wb = xlsx.readFile(req.file.path);
        // קח את שמו של הגיליון הראשון (שזה בעצם הכתובת במקרה זה)
        const sheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];

        // המר את נתוני הגיליון לפורמט JSON
        const data = xlsx.utils.sheet_to_json(sheet);

        if (data.length === 0) {
            fs.unlinkSync(req.file.path); // נקה את הקובץ שהועלה
            return res.status(400).send('קובץ האקסל ריק או לא מכיל נתונים תקינים.');
        }

        // הכתובת תיקבע משם הגיליון
        const address = sheetName;

        // הכנת הצהרה להכנסת דיירים למסד הנתונים
        const stmt = db.prepare(`INSERT INTO residents (
            precise_address, owner_full_name, mobile_phone, email, property_right, residing, special_needs,
            household_number, signed_document, representation_member, house_number, entrance, parcel,
            sub_parcel, apartment_number, floor, id_number, status, note, updated_at, project, address
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

        db.serialize(() => { // שימוש ב-serialize כדי להבטיח הכנסות רציפות של שורות
            data.forEach(row => {
                stmt.run([
                    row['כתובת מדוייקת'] || '',
                    row['שם בעל הדירה (מלא)'] || '',
                    row['טלפון נייד'] || '',
                    row['כתובת אי מייל'] || '',
                    row['הזכות בנכס בעלות / שכירות'] || '',
                    // המרה של "כן"/"לא" ל-1/0 עבור שדות בוליאניים
                    (row['מגורים בדירה כן/לא'] && String(row['מגורים בדירה כן/לא']).toLowerCase() === 'כן') ? 1 : 0,
                    row['קשיש (70+) / מוגבלות / צרכים מיוחדים'] || '',
                    row['מספר נפשות המגוררות בבית'] || 0, // ברירת מחדל 0 למספרים
                    row['האם חתם על מסמך...'] || '',
                    (row['האם חבר בנציגות כן/לא'] && String(row['האם חבר בנציגות כן/לא']).toLowerCase() === 'כן') ? 1 : 0,
                    row['מ\' בית'] || '',
                    row['כניסה'] || '',
                    row['חלקה'] || '',
                    row['תת חלקה'] || '',
                    row['מ\' דירה'] || '',
                    row['קומה'] || '',
                    row['ת.ז'] || '', // ודא שכותרת העמודה באקסל היא "ת.ז"
                    'טרם טופל', // סטטוס ברירת מחדל
                    row['הערות'] || '', // הוספתי תמיכה בעמודת "הערות" מהאקסל
                    new Date().toISOString(), // זמן עדכון נוכחי
                    project, // הפרויקט שקיבלנו מהאדמין
                    address   // הכתובת שחולצה משם הגיליון
                ], function(err) {
                    if (err) {
                        console.error('שגיאה בהכנסת שורה:', err.message, row);
                    }
                });
            });
            stmt.finalize(); // סגירת הצהרת ההכנה לאחר סיום הלולאה
            fs.unlinkSync(req.file.path); // מחיקת הקובץ הזמני לאחר העיבוד
            res.send(`הקובץ הועלה בהצלחה ונתוני הדיירים יובאו עבור פרויקט "${project}" בכתובת "${address}".`);
        });

    } catch (e) {
        console.error('שגיאה בעיבוד קובץ האקסל:', e);
        if (req.file) fs.unlinkSync(req.file.path); // מחיקת הקובץ גם במקרה של שגיאה
        res.status(500).send('אירעה שגיאה בעיבוד הקובץ. ודא שהפורמט תקין ושמות העמודות נכונים.');
    }
});

// --- ניהול משתמשים (עבור מנהלים) ---

// מחזיר את כל המשתמשים (ללא סיסמאות מטעמי אבטחה)
app.get('/users', (req, res) => {
    db.all('SELECT id, username, role FROM users', [], (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'שגיאת מסד נתונים.' });
        }
        res.json(rows);
    });
});

// עדכון סיסמת משתמש קיים
app.post('/update-user', async (req, res) => {
    const { id, password } = req.body;
    if (!id || !password) return res.status(400).send('חסר מזהה משתמש או סיסמה.');

    try {
        const hashedPassword = await bcrypt.hash(password, 12);
        db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, id], function(err) {
            if (err) {
                console.error(err);
                return res.status(500).send('שגיאת מסד נתונים בעת עדכון סיסמה.');
            }
            if (this.changes === 0) {
                return res.status(404).send('משתמש לא נמצא.');
            }
            res.send('הסיסמה עודכנה בהצלחה.');
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('שגיאה בגיבוב סיסמה.');
    }
});

// מחיקת משתמש
app.post('/delete-user', (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).send('חסר מזהה משתמש.');

    db.run('DELETE FROM users WHERE id = ?', [id], function(err) {
        if (err) {
            console.error(err);
            return res.status(500).send('שגיאת מסד נתונים בעת מחיקת משתמש.');
        }
        if (this.changes === 0) {
            return res.status(404).send('משתמש לא נמצא.');
        }
        res.send('המשתמש נמחק בהצלחה.');
    });
});

// הוספת משתמש חדש
app.post('/add-user', async (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password || !role) return res.status(400).send('חסרים שם משתמש, סיסמה או תפקיד.');

    try {
        const hashedPassword = await bcrypt.hash(password, 12);
        db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, hashedPassword, role], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).send('שם המשתמש כבר קיים. בחר שם אחר.');
                }
                console.error(err);
                return res.status(500).send('שגיאת מסד נתונים בעת הוספת משתמש.');
            }
            res.status(201).send('המשתמש נוסף בהצלחה.');
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('שגיאה בגיבוב סיסמה.');
    }
});

// --- ניהול פרויקטים וכתובות ---

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
            return res.status(500).json({ error: 'שגיאת מסד נתונים.' });
        }
        res.json(rows);
    });
});

// מחיקת פרויקט (כולל כל הדיירים והשיוכים למשתמשים הקשורים לפרויקט)
app.post('/delete-project', (req, res) => {
    const { project } = req.body;
    if (!project) {
        return res.status(400).json({ success: false, message: 'חסר שם פרויקט.' });
    }

    db.serialize(() => {
        db.run('PRAGMA foreign_keys = ON;'); // הפעלת אכיפת מפתחות זרים כדי לוודא עקביות

        // מחיקת שיוכים למשתמשים עבור הפרויקט
        db.run('DELETE FROM user_projects WHERE project = ?', [project], function(err) {
            if (err) {
                console.error('שגיאה במחיקת שיוכי פרויקטים:', err.message);
                return res.status(500).json({ success: false, message: 'שגיאת מסד נתונים במחיקת שיוכים לפרויקט.' });
            }

            // לאחר מכן, מחיקת הדיירים הקשורים לפרויקט
            db.run('DELETE FROM residents WHERE project = ?', [project], function(err) {
                if (err) {
                    console.error('שגיאה במחיקת דיירי הפרויקט:', err.message);
                    return res.status(500).json({ success: false, message: 'שגיאת מסד נתונים במחיקת דיירים בפרויקט.' });
                }
                // אם היו שינויים (נמחקו דיירים) או אם לא היו דיירים מלכתחילה (changes === 0), זה עדיין נחשב להצלחה
                res.json({ success: true, message: `הפרויקט "${project}" וכל הנתונים הקשורים אליו (דיירים ושיוכים) נמחקו בהצלחה.` });
            });
        });
    });
});

// מחזיר את כל הכתובות הייחודיות עבור פרויקט מסוים, יחד עם סטטוסים (טופל/טרם טופל)
app.get('/project-addresses', (req, res) => {
    const { project } = req.query;
    if (!project) {
        return res.status(400).json({ error: 'חסר פרמטר פרויקט.' });
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
            return res.status(500).json({ error: 'שגיאת מסד נתונים.' });
        }
        res.json(rows);
    });
});

// מחזיר את כל זוגות הפרויקט-כתובת הייחודיים הקיימים במערכת
app.get('/all-project-addresses', (req, res) => {
    const sql = `SELECT DISTINCT project, address FROM residents ORDER BY project, address;`;
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'שגיאת מסד נתונים.' });
        }
        res.json(rows);
    });
});

// שיוך פרויקט-כתובת למשתמש ספציפי
app.post('/assign-project-to-user', (req, res) => {
    const { userId, project, address } = req.body;
    if (!userId || !project || !address) {
        return res.status(400).json({ success: false, message: 'חסרים מזהה משתמש, פרויקט או כתובת.' });
    }

    // INSERT OR IGNORE מונע יצירת כפילויות אם השיוך כבר קיים
    db.run('INSERT OR IGNORE INTO user_projects (user_id, project, address) VALUES (?, ?, ?)',
        [userId, project, address], function(err) {
            if (err) {
                console.error('שגיאה בשיוך פרויקט למשתמש:', err.message);
                return res.status(500).json({ success: false, message: 'שגיאת מסד נתונים במהלך השיוך.' });
            }
            if (this.changes > 0) {
                res.json({ success: true, message: 'הפרויקט שויך למשתמש בהצלחה.' });
            } else {
                res.status(200).json({ success: false, message: 'השיוך כבר קיים עבור משתמש זה.' });
            }
        });
});

// --- הפעלת השרת ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`שרת מנהל דיירים פועל על פורט: http://localhost:${PORT}`));
