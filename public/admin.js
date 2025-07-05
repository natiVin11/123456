// Function to fetch username (assuming /me endpoint is protected)
async function fetchAdminName() {
    try {
        const res = await fetch('/me');
        if (!res.ok) {
            // If not authorized, redirect to login page
            if (res.status === 401) {
                window.location.href = '/index.html';
                return;
            }
            throw new Error('לא ניתן לטעון את שם המנהל');
        }
        const data = await res.json();
        // Changed ID from welcomeAdmin to main-title as per HTML
        const welcomeElement = document.querySelector('.main-title'); // Assuming the welcome text is part of main-title now
        if (data.username && data.role === 'admin' && welcomeElement) {
            welcomeElement.textContent = `ברוך הבא ${data.username} (מנהל)`;
        } else {
            // If not admin, redirect to user page or login
            window.location.href = '/index.html'; // Or user.html if that's allowed
        }
    } catch (e) {
        console.error('Error fetching admin name:', e);
        alert('שגיאה בטעינת פרטי המשתמש. נא לנסות להתחבר מחדש.');
        window.location.href = '/index.html'; // Redirect on error
    }
}

// Utility function (from previous suggestion)
async function fetchAndRender(url, containerId, renderFunction, errorMessage) {
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`שגיאה בטעינה: ${res.status}`);
        const data = await res.json();
        renderFunction(data);
    } catch (e) {
        console.error(e);
        document.getElementById(containerId).innerHTML = `<p class="error-message">${errorMessage}</p>`;
    }
}

// --- User Management Functions ---
async function loadUsers() {
    fetchAndRender(
        '/users',
        'userList', // Matches the section ID in admin.html
        users => {
            const list = document.getElementById('userList');
            list.innerHTML = '<h4 class="card-subtitle">רשימת משתמשים</h4>'; // Add subtitle back
            if (users.length === 0) {
                list.innerHTML += '<p class="no-data-message">אין משתמשים להצגה.</p>';
                return;
            }
            users.forEach(u => {
                const div = document.createElement('div');
                div.className = 'list-item user-item';
                div.innerHTML = `
                    <b>${u.username}</b> (${u.role})
                    <div class="item-actions">
                        <input type="password" id="pass-${u.id}" placeholder="סיסמה חדשה" class="styled-input password-input" />
                        <button onclick="updateUser(${u.id})" class="secondary-button small-button">עדכן סיסמה</button>
                        <button onclick="deleteUser(${u.id}, '${u.username}')" class="danger-button small-button">מחק</button>
                    </div>
                `;
                list.appendChild(div);
            });
        },
        'שגיאה בטעינת המשתמשים.'
    );
}

// Adjusted addNewUser to use direct input fields and message area
document.getElementById('addUserForm').addEventListener('submit', async e => {
    e.preventDefault();

    const username = document.getElementById('newUsername').value.trim();
    const password = document.getElementById('newPassword').value.trim();
    const role = document.getElementById('newRole').value; // Changed ID to newRole
    const messageDiv = document.getElementById('addUserMessage'); // Changed ID to addUserMessage

    if (!username || !password || !role) {
        messageDiv.textContent = 'נא למלא את כל השדות';
        messageDiv.className = 'message-area error'; // Use new classes
        return;
    }

    try {
        const res = await fetch('/add-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, role }),
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(errorText);
        }

        messageDiv.textContent = 'המשתמש נוסף בהצלחה';
        messageDiv.className = 'message-area success'; // Use new classes
        // Reset fields
        document.getElementById('newUsername').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('newRole').value = '';
        loadUsers();
        // No need to populateAssignUserSelect here, loadAssignments handles it on full page load
    } catch (err) {
        messageDiv.textContent = `שגיאה: ${err.message}`;
        messageDiv.className = 'message-area error'; // Use new classes
        console.error(err);
    }
});


// Simplified updateUser - now it takes ID directly and reads from the input field
async function updateUser(id) {
    const pass = document.getElementById(`pass-${id}`).value.trim();
    if (!pass) {
        alert('יש להזין סיסמה חדשה.');
        return;
    }

    try {
        const res = await fetch('/update-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, password: pass })
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(errorText || 'שגיאה בעדכון הסיסמה.');
        }

        alert('הסיסמה עודכנה בהצלחה!');
        loadUsers(); // Reload to clear the password input field
    } catch (e) {
        alert(`שגיאה בעדכון סיסמה: ${e.message}`);
        console.error('Error updating password:', e);
    }
}

async function deleteUser(userId, username) {
    if (confirm(`האם אתה בטוח שברצונך למחוק את המשתמש ${username}?`)) {
        try {
            const res = await fetch('/delete-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: userId })
            });

            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(errorText || 'שגיאה במחיקת המשתמש.');
            }

            alert('המשתמש נמחק בהצלחה!');
            loadUsers(); // Reload user list
            loadAssignments(); // Refresh users for assignment dropdown (full reload)
        } catch (e) {
            alert(`שגיאה: ${e.message}`);
            console.error('Error deleting user:', e);
        }
    }
}

// --- Excel Upload Functions ---
// Event listener for the form submission
document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault(); // Prevent default form submission

    const projectName = document.getElementById('uploadProject').value.trim(); // Changed ID
    const excelFile = document.getElementById('uploadFile').files[0]; // Changed ID
    const uploadMessage = document.getElementById('uploadMessage'); // Assuming this message div will be added in HTML

    if (!projectName || !excelFile) {
        if (uploadMessage) {
            uploadMessage.textContent = 'אנא מלא את שם הפרויקט ובחר קובץ אקסל.';
            uploadMessage.className = 'message-area error';
        } else {
            alert('אנא מלא את שם הפרויקט ובחר קובץ אקסל.');
        }
        return;
    }

    const formData = new FormData();
    formData.append('project', projectName);
    formData.append('file', excelFile); // No address field here, it's pulled from Excel on server

    try {
        const res = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(errorText || 'שגיאה בהעלאת הקובץ.');
        }

        if (uploadMessage) {
            uploadMessage.textContent = 'הקובץ הועלה בהצלחה!';
            uploadMessage.className = 'message-area success';
        } else {
            alert('הקובץ הועלה בהצלחה!');
        }
        document.getElementById('uploadProject').value = '';
        document.getElementById('uploadFile').value = ''; // Clear file input
        loadAllProjects(); // Refresh project list
        loadAssignments(); // Refresh assignment dropdowns
    } catch (e) {
        if (uploadMessage) {
            uploadMessage.textContent = `שגיאה בהעלאת הקובץ: ${e.message}`;
            uploadMessage.className = 'message-area error';
        } else {
            alert(`שגיאה בהעלאת הקובץ: ${e.message}`);
        }
        console.error('Error uploading file:', e);
    }
});


// --- Project Management Functions ---
async function loadAllProjects() {
    fetchAndRender(
        '/all-projects',
        'projectStats', // Matches the section ID in admin.html
        projects => {
            const container = document.getElementById('projectStats');
            container.innerHTML = '<h4 class="card-subtitle">סטטוסים לפי פרויקט</h4>';
            if (projects.length === 0) {
                container.innerHTML += '<p class="no-data-message">אין פרויקטים להצגה.</p>';
                return;
            }
            projects.forEach(p => {
                const div = document.createElement('div');
                div.className = 'list-item project-summary-item';
                div.innerHTML = `
                        <b>${p.project}</b>: סה"כ דיירים ${p.total}
                        <div class="item-actions">
                            <button onclick="viewProjectAddresses('${p.project}')" class="secondary-button small-button">צפה בכתובות</button>
                            <button onclick="deleteProject('${p.project}')" class="danger-button small-button">מחק פרויקט</button>
                        </div>
                    `;
                container.appendChild(div);
            });
        },
        'שגיאה בטעינת הפרויקטים.'
    );
}

async function deleteProject(projectName) {
    if (confirm(`האם אתה בטוח שברצונך למחוק את הפרויקט "${projectName}"? פעולה זו תמחק את כל הדיירים והשיוכים הקשורים לפרויקט זה.`)) {
        try {
            const res = await fetch('/delete-project', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ project: projectName })
            });

            const data = await res.json();
            if (!data.success) {
                throw new Error(data.message || 'שגיאה במחיקת הפרויקט.');
            }

            alert(data.message);
            loadAllProjects(); // Reload project list
            loadAssignments(); // Refresh assignments (which includes project/address dropdowns)
        } catch (e) {
            alert(`שגיאה: ${e.message}`);
            console.error('Error deleting project:', e);
        }
    }
}


// --- Project Assignment Functions (Modified to fit the admin.html structure) ---
let allUsers = []; // To store users for assignment dropdowns

async function loadAssignments() {
    try {
        const usersRes = await fetch('/users');
        if (!usersRes.ok) throw new Error('שגיאה בטעינת משתמשים');
        allUsers = await usersRes.json(); // Store users globally for dropdowns

        // Fetch all unique project-address pairs
        const projectsRes = await fetch('/all-project-addresses');
        if (!projectsRes.ok) throw new Error('שגיאה בטעינת פרויקטים לשיוך');
        const projectAddresses = await projectsRes.json();

        // Fetch existing assignments
        const assignmentsRes = await fetch('/all-assignments'); // This endpoint needs to be implemented on server
        if (!assignmentsRes.ok) throw new Error('שגיאה בטעינת שיוכים קיימים');
        const existingAssignments = await assignmentsRes.json();

        const container = document.getElementById('assignments'); // This is the main 'assignments' div in admin.html
        container.innerHTML = '<h4 class="card-subtitle">שייכות פרויקטים למשתמשים</h4>';

        if (projectAddresses.length === 0) {
            container.innerHTML += '<p class="no-data-message">אין פרויקטים/כתובות זמינים לשיוך.</p>';
            return;
        }

        // Section for creating new assignments
        const newAssignmentHtml = `
            <div class="new-assignment-form">
                <div class="input-group">
                    <label for="assignProjectSelect">בחר פרויקט:</label>
                    <select id="assignProjectSelect" class="styled-select"></select>
                </div>
                <div class="input-group">
                    <label for="assignAddressSelect">בחר כתובת:</label>
                    <select id="assignAddressSelect" class="styled-select"></select>
                </div>
                <div class="input-group">
                    <label for="assignUserSelect">בחר משתמש:</label>
                    <select id="assignUserSelect" class="styled-select"></select>
                </div>
                <button onclick="assignProjectToUser()" class="primary-button">שייך פרויקט לכתובת</button>
                <div id="assignMessage" class="message-area"></div>
            </div>
        `;
        container.innerHTML += newAssignmentHtml;

        // Populate dropdowns after adding HTML
        populateAssignUserSelect();
        populateAssignProjectAddressSelects(projectAddresses);

        // Section for existing assignments
        container.innerHTML += '<h4 class="card-subtitle" style="margin-top: 30px;">שיוכים קיימים</h4>';
        const existingAssignmentsListDiv = document.createElement('div');
        existingAssignmentsListDiv.id = 'existingAssignmentsList'; // ID for the list of existing assignments
        container.appendChild(existingAssignmentsListDiv);

        renderExistingAssignments(existingAssignments); // Call new function to render these
    } catch (e) {
        console.error(e);
        document.getElementById('assignments').innerHTML = '<p class="error-message">שגיאה בטעינת השייכויות.</p>';
    }
}


function populateAssignUserSelect() {
    const select = document.getElementById('assignUserSelect');
    select.innerHTML = '<option value="">בחר משתמש</option>';
    allUsers.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = user.username;
        select.appendChild(option);
    });
}

function populateAssignProjectAddressSelects(projectAddresses) {
    const projectSelect = document.getElementById('assignProjectSelect');
    const addressSelect = document.getElementById('assignAddressSelect');

    projectSelect.innerHTML = '<option value="">בחר פרויקט</option>';
    const uniqueProjects = [...new Set(projectAddresses.map(pa => pa.project))];
    uniqueProjects.forEach(project => {
        const option = document.createElement('option');
        option.value = project;
        option.textContent = project;
        projectSelect.appendChild(option);
    });

    // Add event listener to filter addresses when project changes
    projectSelect.onchange = () => filterAddressesByProject(projectAddresses);
    filterAddressesByProject(projectAddresses); // Call initially to set address options for no project selected
}

function filterAddressesByProject(projectAddresses) {
    const projectSelect = document.getElementById('assignProjectSelect');
    const addressSelect = document.getElementById('assignAddressSelect');
    const selectedProject = projectSelect.value;

    addressSelect.innerHTML = '<option value="">בחר כתובת</option>';

    if (selectedProject) {
        const filteredAddresses = projectAddresses.filter(pa => pa.project === selectedProject);
        filteredAddresses.forEach(pa => {
            const option = document.createElement('option');
            option.value = pa.address;
            option.textContent = pa.address;
            addressSelect.appendChild(option);
        });
    }
}

async function assignProjectToUser() {
    const userId = document.getElementById('assignUserSelect').value;
    const project = document.getElementById('assignProjectSelect').value;
    const address = document.getElementById('assignAddressSelect').value;
    const assignMessageDiv = document.getElementById('assignMessage');

    if (!userId || !project || !address) {
        assignMessageDiv.textContent = 'אנא בחר משתמש, פרויקט וכתובת.';
        assignMessageDiv.className = 'message-area error';
        return;
    }

    try {
        const res = await fetch('/assign-project-to-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, project, address })
        });

        const data = await res.json();

        if (data.success) {
            assignMessageDiv.textContent = data.message;
            assignMessageDiv.className = 'message-area success';
            loadAssignments(); // Reload all assignments to show the new one
        } else {
            assignMessageDiv.textContent = `שגיאה בשיוך: ${data.message}`;
            assignMessageDiv.className = 'message-area error';
        }
    } catch (e) {
        assignMessageDiv.textContent = `שגיאת רשת בשיוך: ${e.message}`;
        assignMessageDiv.className = 'message-area error';
        console.error('Error assigning project:', e);
    }
}

function renderExistingAssignments(assignments) {
    const assignmentsListDiv = document.getElementById('existingAssignmentsList');
    assignmentsListDiv.innerHTML = ''; // Clear existing content

    if (assignments.length === 0) {
        assignmentsListDiv.innerHTML = '<p class="no-data-message">אין שיוכים קיימים.</p>';
        return;
    }

    assignments.forEach(assignment => {
        const div = document.createElement('div');
        div.className = 'list-item assignment-item'; // Use 'list-item' class
        div.innerHTML = `
            <b>${assignment.username}</b>
            <span>פרויקט: ${assignment.project}</span>
            <span>כתובת: ${assignment.address}</span>
            <div class="item-actions">
                <button onclick="deleteAssignment(${assignment.user_id}, '${assignment.project}', '${assignment.address.replace(/'/g, "\\'")}')" class="danger-button small-button">מחק שיוך</button>
            </div>
        `;
        assignmentsListDiv.appendChild(div);
    });
}


async function deleteAssignment(userId, project, address) {
    if (confirm(`האם אתה בטוח שברצונך למחוק את השיוך של פרויקט "${project}", כתובת "${address}" למשתמש זה?`)) {
        try {
            const res = await fetch('/delete-assignment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, project, address })
            });

            const data = await res.json();
            if (!data.success) {
                throw new Error(data.message || 'שגיאה במחיקת השיוך.');
            }

            alert(data.message);
            loadAssignments(); // Refresh all assignments
        } catch (e) {
            alert(`שגיאה: ${e.message}`);
            console.error('Error deleting assignment:', e);
        }
    }
}

// Add event listener for logout button
document.getElementById('logoutBtn').addEventListener('click', () => {
    // Here you would typically make an API call to log out on the server
    // For now, we'll just redirect to the login page
    window.location.href = '/'; // Or '/login.html'
});


// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    fetchAdminName();
    loadUsers();
    loadAllProjects();
    loadAssignments(); // This function now handles populating all assignment related elements
});