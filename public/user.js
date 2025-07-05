// Function to fetch username
async function fetchUserName() {
    try {
        const res = await fetch('/me');
        if (!res.ok) {
            // If not authorized, redirect to login page
            if (res.status === 401) {
                window.location.href = '/index.html';
                return;
            }
            throw new Error('לא ניתן לטעון את שם המשתמש');
        }
        const data = await res.json();
        if (data.username) {
            document.getElementById('welcomeUser').textContent = `ברוך הבא ${data.username}`;
        }
    } catch (e) {
        console.error('Error fetching user name:', e);
        alert('שגיאה בטעינת פרטי המשתמש. נא לנסות להתחבר מחדש.');
        window.location.href = '/index.html'; // Redirect on error
    }
}

// Function to load buildings assigned to the current user
function loadUserBuildings() {
    fetch('/my-buildings')
        .then(res => {
            if (!res.ok) {
                if (res.status === 401) throw new Error('אינך מורשה לגשת למשאב זה. אנא התחבר מחדש.');
                throw new Error('שגיאה בטעינת הבניינים של המשתמש');
            }
            return res.json();
        })
        .then(buildings => {
            const container = document.getElementById('userBuildingsContainer');
            if (!container) {
                console.error('לא נמצא אלמנט להצגת הבניינים');
                return;
            }

            if (buildings.length === 0) {
                container.innerHTML = '<p>אין בניינים משוייכים למשתמש זה.</p>';
                return;
            }

            const projectsMap = {};
            buildings.forEach(b => {
                if (!projectsMap[b.project]) projectsMap[b.project] = [];
                projectsMap[b.project].push(b.address);
            });

            container.innerHTML = ''; // Clear previous content

            for (const [project, addresses] of Object.entries(projectsMap)) {
                const projectDiv = document.createElement('div');
                projectDiv.innerHTML = `<h4>פרויקט: ${project}</h4>`;
                const ul = document.createElement('ul');
                addresses.forEach(address => {
                    const li = document.createElement('li');
                    li.textContent = address;
                    // Clicking on an assigned building loads its residents
                    li.onclick = () => loadResidentsForDisplay(project, address);
                    ul.appendChild(li);
                });
                projectDiv.appendChild(ul);
                container.appendChild(projectDiv);
            }
        })
        .catch(err => {
            alert(`שגיאה: ${err.message}`);
            console.error(err);
            if (err.message.includes('התחבר מחדש')) {
                window.location.href = '/index.html'; // Redirect to login
            }
        });
}

// Function to load residents for a specific building (project and address)
// This function is called when clicking on an assigned building or by the "טען דיירים" button
function loadResidentsForDisplay(project, address) {
    const statusFilter = document.getElementById('statusSelect').value;
    let url = `/residents-by-building?project=${encodeURIComponent(project)}&address=${encodeURIComponent(address)}`;

    fetch(url)
        .then(res => {
            if (!res.ok) throw new Error('שגיאה בטעינת הדיירים');
            return res.json();
        })
        .then(residents => {
            const container = document.getElementById('residentsContainer');
            container.innerHTML = `<h3>דיירים בכתובת: ${address} בפרויקט: ${project}</h3>`;

            // Client-side filtering by status if a specific status is selected
            let filteredResidents = residents;
            if (statusFilter && statusFilter !== "") {
                filteredResidents = residents.filter(r => r.status === statusFilter);
            }

            if (filteredResidents.length === 0) {
                container.innerHTML += '<p>אין דיירים בבניין זה העונים לסינון.</p>';
                return;
            }

            const table = document.createElement('table');
            table.border = '1';
            table.style.width = '100%';

            table.innerHTML = `
                <tr>
                    <th>שם בעל הדירה (מלא)</th>
                    <th>מספר דירה</th>
                    <th>טלפון נייד</th>
                    <th>מספר בית</th>
                    <th>סטטוס</th>
                    <th>הערות</th>
                    <th>עדכון</th>
                </tr>
            `;

            filteredResidents.forEach(r => {
                const tr = document.createElement('tr');

                // Status options for dropdown
                const statusOptions = ['טרם טופל', 'ללא מענה', 'ענה ונקבע פגישה', 'סרבן', 'חתם'];
                let statusSelectHtml = `<select>`;
                statusOptions.forEach(opt => {
                    statusSelectHtml += `<option value="${opt}" ${r.status === opt ? 'selected' : ''}>${opt}</option>`;
                });
                statusSelectHtml += `</select>`;

                // Corrected field names based on your database schema:
                // r.owner_full_name, r.apartment_number, r.mobile_phone
                tr.innerHTML = `
                    <td>${r.owner_full_name || ''}</td>
                    <td>${r.apartment_number || ''}</td>
                    <td><input type="text" value="${r.mobile_phone || ''}" style="width:120px" /></td>
                    <td><input type="text" value="${r.house_number || ''}" style="width:80px" /></td>
                    <td>${statusSelectHtml}</td>
                    <td><input type="text" value="${r.note || ''}" /></td>
                    <td><button>שמור</button></td>
                `;

                const btn = tr.querySelector('button');
                btn.onclick = () => {
                    const select = tr.querySelector('select');
                    // Get input values directly from their current positions
                    const phoneInput = tr.querySelector('input[type="text"][style="width:120px"]');
                    const houseNumberInput = tr.querySelector('input[type="text"][style="width:80px"]');
                    const noteInput = tr.querySelector('input[type="text"]:not([style])'); // Get the note input

                    const phoneVal = phoneInput ? phoneInput.value : '';
                    const houseNumVal = houseNumberInput ? houseNumberInput.value : '';
                    const noteVal = noteInput ? noteInput.value : '';
                    const newStatus = select.value;

                    fetch('/update-resident', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            id: r.id, // Ensure resident ID is passed
                            status: newStatus,
                            note: noteVal,
                            mobile_phone: phoneVal,
                            house_number: houseNumVal
                        })
                    })
                        .then(res => {
                            if (!res.ok) throw new Error('שגיאה בעדכון הנתונים');
                            alert('הנתונים עודכנו בהצלחה');
                            // Reload residents for the current building/project after update
                            loadResidentsForDisplay(project, address);
                        })
                        .catch(err => {
                            alert(`שגיאה: ${err.message}`);
                            console.error(err);
                        });
                };

                table.appendChild(tr);
            });

            container.appendChild(table);
        })
        .catch(err => {
            alert(`שגיאה: ${err.message}`);
            console.error(err);
        });
}

// This function handles the "טען דיירים" button click
function handleLoadResidentsButtonClick() {
    const project = document.getElementById('projectInput').value.trim();
    const address = document.getElementById('addressInput').value.trim();

    if (!project || !address) {
        alert('אנא מלא שם פרויקט וכתובת בניין.');
        return;
    }

    loadResidentsForDisplay(project, address);
}

// Attach event listener to the "טען דיירים" button
document.getElementById('loadResidentsBtn').addEventListener('click', handleLoadResidentsButtonClick);

// Initial load when the page is ready
window.addEventListener('DOMContentLoaded', () => {
    fetchUserName();
    loadUserBuildings();
});