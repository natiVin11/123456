// public/login.js

async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const loginMessage = document.getElementById('loginMessage');

    loginMessage.textContent = ''; // נקה הודעות קודמות

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        // אם השרת ביצע הפניה (כפי ש-res.redirect() אמור לעשות), הדפדפן כבר יעקוב
        // המאפיין 'redirected' יהיה true אם היתה הפניה אוטומטית מצד fetch
        if (response.redirected) {
            // ה-URL החדש (user.html או admin.html) כבר טוען, אין צורך בפעולה נוספת כאן
            return;
        }

        // אם השרת לא ביצע הפניה (לדוגמה, במקרה של שגיאת התחברות),
        // אנו נטפל בתגובת השגיאה (שהיא כנראה טקסט).
        const errorMessage = await response.text(); // נקרא את התגובה כטקסט
        loginMessage.textContent = errorMessage; // הצג את הודעת השגיאה למשתמש
        console.error('Login failed:', errorMessage);

    } catch (error) {
        console.error('Error during login:', error);
        loginMessage.textContent = 'שגיאה בחיבור לשרת. ודא שהשרת פועל.';
    }
}

// קוד בדיקה אוטומטית במקרה של רענון/טעינת דף
// בודק אם המשתמש כבר מחובר כאשר הדף נטען
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/me');
        if (response.ok) {
            // המשתמש מחובר, בצע הפניה לדף המתאים (או הצג את התוכן אם זה עמוד יחיד)
            const user = await response.json();
            if (user.role === 'admin') {
                window.location.href = '/admin.html';
            } else {
                window.location.href = '/user.html';
            }
        } else {
            // המשתמש לא מחובר, ודא שעמוד ההתחברות מוצג
            document.getElementById('loginContainer').style.display = 'block';
            document.getElementById('appContent').style.display = 'none';
        }
    } catch (error) {
        console.error('Error checking login status:', error);
        document.getElementById('loginContainer').style.display = 'block';
        document.getElementById('appContent').style.display = 'none';
    }
});
