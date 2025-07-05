const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const DB_FILE = './data.sqlite1';

// מחיקת המסד הקיים
if (fs.existsSync(DB_FILE)) {
    fs.unlinkSync(DB_FILE);
    console.log('✔️ הקובץ נמחק');
} else {
    console.log('ℹ️ לא נמצא קובץ קודם למחיקה');
}

// יצירת מסד חדש
const db = new sqlite3.Database(DB_FILE);

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
    UNIQUE(user_id, project, address)
  )`);

    console.log('✅ מסד הנתונים נבנה בהצלחה');
});

db.close();
