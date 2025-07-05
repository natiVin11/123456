// public/main.js

// פונקציות הקשורות לחיפוש, הוספה, וטבלאות
function searchTable() {
    // לוגיקה של חיפוש
    console.log('Search function called');
}

function clearSearch() {
    // לוגיקה של ניקוי חיפוש
    console.log('Clear search function called');
}

function toggleAddResidentForm() {
    const form = document.getElementById('addResidentForm');
    if (form.style.display === 'none' || form.style.display === '') {
        form.style.display = 'block';
    } else {
        form.style.display = 'none';
    }
    console.log('Toggle add resident form');
}

function addResident() {
    // לוגיקה של הוספת דייר
    // תקבל את הנתונים מהטופס ותשלח לשרת באמצעות fetch
    console.log('Add resident function called');
    alert('פונקציית הוספת דייר עדיין לא מיושמת במלואה.');
    // יש לוודא שיש לך נקודת קצה מתאימה ב-server.js
}

// פונקציה לטעינת נתוני דיירים (לדוגמה, עבור user.html)
async function loadResidents(project, address) {
    try {
        const response = await fetch(`/residents-by-building?project=${project}&address=${address}`);
        if (!response.ok) {
            throw new Error('Failed to fetch residents');
        }
        const residents = await response.json();
        const tableBody = document.querySelector('#dataTable tbody');
        tableBody.innerHTML = ''; // נקה טבלה קיימת

        residents.forEach(resident => {
            const row = tableBody.insertRow();
            row.insertCell().textContent = resident.address;
            row.insertCell().textContent = resident.id_number; // ת.ז של התושב
            row.insertCell().textContent = resident.owner_full_name; // כאן אולי תרצה שם אחר
            row.insertCell().textContent = resident.mobile_phone;
            // הוסף תאים נוספים לפי הצורך והנתונים מהשרת
        });
    } catch (error) {
        console.error('Error loading residents:', error);
        // הצג הודעת שגיאה למשתמש
    }
}

// דוגמה לקוד שירוץ כאשר הדף user.html נטען
// document.addEventListener('DOMContentLoaded', () => {
//     // טען את הבניינים המשויכים למשתמש
//     // ואז טען דיירים לבניין הראשון או שבקש מהמשתמש לבחור
//     loadResidents('פרויקט לדוגמה', 'כתובת לדוגמה');
// });
