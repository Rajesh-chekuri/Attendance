// ─── Firebase Config ──────────────────────────────────────────────────────────
const firebaseConfig = {
    apiKey: "AIzaSyDDekdnngKWnxb-Hw4JZlK0SaphNvRoyn0",
    authDomain: "attendance-e6b42.firebaseapp.com",
    projectId: "attendance-e6b42",
    storageBucket: "attendance-e6b42.firebasestorage.app",
    messagingSenderId: "8657719820",
    appId: "1:8657719820:web:292588ed8053c4408fd429",
    measurementId: "G-DYZ1W0HS7D"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const branches = ['CSE','IT','ECE','CE','ME','CSBS','AIDS','AIML','EEE'];

// ─── Toast Notifications ─────────────────────────────────────────────────────────
function showToast(msg, obj = '') {
    let t = document.getElementById('global-toast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'global-toast';
        t.style.position = 'fixed';
        t.style.bottom = '20px';
        t.style.left = '50%';
        t.style.transform = 'translateX(-50%)';
        t.style.backgroundColor = '#fef08a';
        t.style.color = '#854d0e';
        t.style.padding = '16px 24px';
        t.style.borderRadius = '8px';
        t.style.boxShadow = '0 4px 6px rgba(0,0,0,0.2)';
        t.style.fontWeight = '700';
        t.style.zIndex = '9999';
        t.style.border = '2px solid #facc15';
        t.style.whiteSpace = 'pre-line';
        document.body.appendChild(t);
    }
    t.innerText = obj ? msg + ' ' + obj : msg;
    t.style.display = 'block';
    
    if (window.toastTimeout) clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(() => { t.style.display = 'none'; }, 5000);
}


// ─── State ────────────────────────────────────────────────────────────────────
let currentUser   = null;
let currentView   = 'main';   // 'main' | 'reports' | 'students' | 'teachers'
let selectedDate  = new Date().toISOString().split('T')[0];
let currentData   = {};
const appDiv      = document.getElementById('app');

// ─── Super-Admin & Principal bootstrap ───────────────────────────────────────
async function ensureSuperAdmin() {
    try {
        const snap = await db.collection('users').where('role','==','superadmin').get();
        if (snap.empty) {
            await db.collection('users').add({
                role: 'superadmin',
                name: 'Super Admin',
                email: 'admin@vishnu.edu.in',
                password: 'admin@939'
            });
        }
    } catch(e){ showToast('SuperAdmin init:', e); }
}

// ─── Router ───────────────────────────────────────────────────────────────────
async function render() {
    if (!currentUser) { renderLogin(); return; }
    showLoading();
    await loadData();
    renderDashboard();
}

function showLoading() {
    appDiv.innerHTML = `
        <div class="login-container">
            <div class="glass-panel login-box fade-in" style="text-align:center;">
                <div class="spinner"></div>
                <h2 class="gradient-text" style="margin-top:16px;">Loading…</h2>
                <p style="color:var(--text-muted);margin-top:8px;">Fetching data from Firebase…</p>
            </div>
        </div>`;
}

// ─── Data Loader ──────────────────────────────────────────────────────────────
async function loadData() {
    currentData = {};
    try {
        const r = currentUser.role;

        if (r === 'superadmin') {
            const [pSnap, hodSnap, pwdSnap] = await Promise.all([
                db.collection('users').where('role','==','principal').get(),
                db.collection('users').where('role','==','hod').get(),
                db.collection('passwordChanges').orderBy('timestamp', 'desc').get()
            ]);
            currentData.principals = pSnap.docs.map(d=>({id:d.id,...d.data()}));
            currentData.hods = hodSnap.docs.map(d=>({id:d.id,...d.data()}));
            currentData.passwordChanges = pwdSnap.docs.map(d=>({id:d.id,...d.data()}));
        }

        if (r === 'principal') {
            const snap = await db.collection('users').where('role','==','hod').get();
            currentData.hods = snap.docs.map(d=>({id:d.id,...d.data()}));
            if (currentView === 'reports') {
                // Load all students + attendance for report
                const [stuSnap, attSnap] = await Promise.all([
                    db.collection('users').where('role','==','student').get(),
                    db.collection('attendance').get()
                ]);
                currentData.allStudents   = stuSnap.docs.map(d=>({id:d.id,...d.data()}));
                currentData.allAttendance = attSnap.docs.map(d=>d.data());
            }
        }

        if (r === 'hod') {
            const snap = await db.collection('users')
                .where('role','==','incharge')
                .where('branch','==',currentUser.branch).get();
            currentData.incharges = snap.docs.map(d=>({id:d.id,...d.data()}));
            if (currentView === 'hod_students') {
                const stuSnap = await db.collection('users')
                    .where('role','==','student')
                    .where('branch','==',currentUser.branch).get();
                currentData.allStudents = stuSnap.docs.map(d=>({id:d.id,...d.data()}));
            }
            if (currentView === 'hod_teachers') {
                const tchSnap = await db.collection('users')
                    .where('role','==','teacher')
                    .where('branch','==',currentUser.branch).get();
                currentData.allTeachers = tchSnap.docs.map(d=>({id:d.id,...d.data()}));
            }
            if (currentView === 'reports') {
                const [stuSnap, attSnap] = await Promise.all([
                    db.collection('users').where('role','==','student').where('branch','==',currentUser.branch).get(),
                    db.collection('attendance').where('branch','==',currentUser.branch).get()
                ]);
                currentData.allStudents   = stuSnap.docs.map(d=>({id:d.id,...d.data()}));
                currentData.allAttendance = attSnap.docs.map(d=>d.data());
            }
        }

        if (r === 'incharge') {
            const [stuSnap, tchSnap] = await Promise.all([
                db.collection('users').where('role','==','student')
                    .where('branch','==',currentUser.branch)
                    .where('section','==',currentUser.section).get(),
                db.collection('users').where('role','==','teacher')
                    .where('branch','==',currentUser.branch)
                    .where('section','==',currentUser.section).get()
            ]);
            currentData.students = stuSnap.docs.map(d=>({id:d.id,...d.data()}));
            currentData.teachers = tchSnap.docs.map(d=>({id:d.id,...d.data()}));

            if (currentView === 'students') {
                // Load attendance for each student
                const attSnap = await db.collection('attendance')
                    .where('branch','==',currentUser.branch)
                    .where('section','==',currentUser.section).get();
                currentData.allAttendance = attSnap.docs.map(d=>d.data());
            }
        }

        if (r === 'teacher') {
            const [stuSnap, attSnap] = await Promise.all([
                db.collection('users').where('role','==','student')
                    .where('branch','==',currentUser.branch)
                    .where('section','==',currentUser.section).get(),
                db.collection('attendance')
                    .where('teacherId','==',currentUser.id)
                    .where('date','==',selectedDate).get()
            ]);
            currentData.students        = stuSnap.docs.map(d=>({id:d.id,...d.data()}));
            currentData.attendanceRecords = attSnap.docs.map(d=>({id:d.id,...d.data()}));
        }

        if (r === 'student') {
            const snap = await db.collection('attendance').where('studentId','==',currentUser.id).get();
            currentData.attendanceRecords = snap.docs.map(d=>d.data());
        }

    } catch(e){ showToast('loadData error:', e); }
}

// ─── Login & Role Selection ─────────────────────────────────────────────────────
function renderLogin() {
    appDiv.innerHTML = `
        <div class="login-container">
            <div class="glass-panel login-box fade-in">
                <div style="text-align:center;margin-bottom:16px;">
                    <div class="logo-icon"></div>
                    <h2 class="gradient-text" style="margin:0;">Vishnu Institute</h2>
                    <p style="color:var(--text-muted);font-size:14px;margin-top:4px;">Login to continue</p>
                </div>
                <form id="loginForm">
                    <div class="form-group">
                        <label>Email Address</label>
                        <input type="email" id="email" required placeholder="Enter email">
                    </div>
                    <div class="form-group">
                        <label>Password</label>
                        <div class="pwd-wrapper">
                            <input type="password" id="password" required placeholder="Enter password">
                            <button type="button" class="pwd-toggle" id="pwdToggle">SHOW</button>
                        </div>
                    </div>
                    <button type="submit" id="loginBtn" style="width:100%;margin-top:8px;"> Login</button>
                    <p id="loginError" style="color:var(--error);font-size:14px;margin-top:10px;display:none;"></p>
                </form>
                <div style="text-align:center;margin-top:16px;border-top:1px solid var(--border);padding-top:16px;">
                    <button class="btn-text" onclick="renderChangePassword()">Change Password?</button>
                </div>
            </div>
        </div>`;

    document.getElementById('pwdToggle').addEventListener('click', () => {
        const p = document.getElementById('password');
        p.type = p.type === 'password' ? 'text' : 'password';
    });

    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email    = document.getElementById('email').value.trim().toLowerCase();
        const password = document.getElementById('password').value;
        const errorEl  = document.getElementById('loginError');
        const btn      = document.getElementById('loginBtn');
        btn.textContent = 'Authenticating…'; btn.disabled = true;
        errorEl.style.display = 'none';
        try {
            const snap = await db.collection('users')
                .where('email','==',email)
                .where('password','==',password).get();
            if (!snap.empty) {
                const d = snap.docs[0];
                currentUser = { id: d.id, ...d.data() };
                currentView = 'main';
                await render();
            } else {
                errorEl.textContent = ' Invalid email or password.';
                errorEl.style.display = 'block';
                btn.textContent = ' Login'; btn.disabled = false;
            }
        } catch(err) {
            errorEl.textContent = 'Firebase error: ' + err.message;
            errorEl.style.display = 'block';
            btn.textContent = ' Login'; btn.disabled = false;
        }
    });
}

function renderChangePassword() {
    appDiv.innerHTML = `
        <div class="login-container">
            <div class="glass-panel login-box fade-in">
                <div style="display:flex;align-items:center;margin-bottom:16px;">
                    <button class="btn-text" onclick="renderLogin()" style="font-size:20px;padding-right:12px;">←</button>
                    <h2 style="margin:0;">Change Password</h2>
                </div>
                <form id="changePwdForm">
                    <div class="form-group">
                        <label>Email Address</label>
                        <input type="email" id="cpEmail" required placeholder="Enter email">
                    </div>
                    <div class="form-group">
                        <label>Old Password</label>
                        <div class="pwd-wrapper">
                            <input type="password" id="cpOld" required placeholder="Enter old password">
                            <button type="button" class="pwd-toggle" onclick="const p=document.getElementById('cpOld');p.type=p.type==='password'?'text':'password'">SHOW</button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>New Password</label>
                        <div class="pwd-wrapper">
                            <input type="password" id="cpNew" required placeholder="Enter new password">
                            <button type="button" class="pwd-toggle" onclick="const p=document.getElementById('cpNew');p.type=p.type==='password'?'text':'password'">SHOW</button>
                        </div>
                    </div>
                    <button type="submit" id="cpBtn" style="width:100%;margin-top:8px;">Update Password</button>
                    <p id="cpError" style="color:var(--error);font-size:14px;margin-top:10px;display:none;"></p>
                </form>
            </div>
        </div>`;

    document.getElementById('changePwdForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('cpEmail').value.trim().toLowerCase();
        const oldP  = document.getElementById('cpOld').value;
        const newP  = document.getElementById('cpNew').value;
        const btn   = document.getElementById('cpBtn');
        const err   = document.getElementById('cpError');
        
        btn.disabled = true; btn.textContent = 'Verifying...';
        err.style.display = 'none';

        try {
            const snap = await db.collection('users').where('email','==',email).where('password','==',oldP).get();
            if (snap.empty) {
                err.textContent = ' Invalid email or old password.';
                err.style.display = 'block';
                btn.disabled = false; btn.textContent = 'Update Password';
                return;
            }
            
            const userDoc = snap.docs[0];
            const userData = userDoc.data();
            
            // Cannot change student password
            if (userData.role === 'student') {
                err.textContent = ' Students are not allowed to change their password.';
                err.style.display = 'block';
                btn.disabled = false; btn.textContent = 'Update Password';
                return;
            }

            // 1. Update password
            await db.collection('users').doc(userDoc.id).update({ password: newP });
            
            // 2. Log to passwordChanges
            await db.collection('passwordChanges').add({
                userId: userDoc.id,
                name: userData.name,
                role: userData.role,
                oldPassword: oldP,
                newPassword: newP,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            showToast(' Password changed successfully! You can now log in.');
            renderLogin();
        } catch (error) {
            err.textContent = 'Error: ' + error.message;
            err.style.display = 'block';
            btn.disabled = false; btn.textContent = 'Update Password';
        }
    });
}

// ─── Dashboard Shell ──────────────────────────────────────────────────────────
function renderDashboard() {
    const roleInfo = {
        superadmin: { label: 'Super Admin', icon: '', color: '#f59e0b' },
        principal:  { label: 'Principal',   icon: '', color: 'var(--primary-light)' },
        hod:        { label: 'HOD',         icon: '', color: 'var(--secondary)' },
        incharge:   { label: 'Class Incharge', icon: '👨‍', color: '#818CF8' },
        teacher:    { label: 'Teacher',     icon: '', color: '#34D399' },
        student:    { label: 'Student',     icon: '', color: '#60A5FA' }
    };
    const info = roleInfo[currentUser.role] || { label: currentUser.role, icon: '', color: 'white' };

    // Build sidebar nav items per role
    let navItems = '';
    if (currentUser.role === 'principal') {
        navItems = `
            <div class="nav-item ${currentView==='main'?'active':''}" data-view="main"> Dashboard</div>
            <div class="nav-item ${currentView==='reports'?'active':''}" data-view="reports"> Reports</div>`;
    } else if (currentUser.role === 'hod') {
        navItems = `
            <div class="nav-item ${currentView==='main'?'active':''}" data-view="main"> Dashboard</div>
            <div class="nav-item ${currentView==='hod_students'?'active':''}" data-view="hod_students"> Students</div>
            <div class="nav-item ${currentView==='hod_teachers'?'active':''}" data-view="hod_teachers">👨‍ Subject Teachers</div>
            <div class="nav-item ${currentView==='reports'?'active':''}" data-view="reports"> Reports</div>`;
    } else if (currentUser.role === 'incharge') {
        navItems = `
            <div class="nav-item ${currentView==='main'?'active':''}" data-view="main"> Dashboard</div>
            <div class="nav-item ${currentView==='students'?'active':''}" data-view="students"> Students</div>
            <div class="nav-item ${currentView==='teachers'?'active':''}" data-view="teachers">👨‍ Teachers</div>`;
    } else if (currentUser.role === 'superadmin') {
        navItems = `
            <div class="nav-item ${currentView==='main'?'active':''}" data-view="main"> Admin Panel</div>
            <div class="nav-item ${currentView==='pwd_history'?'active':''}" data-view="pwd_history"> Password History</div>`;
    } else if (currentUser.role === 'teacher') {
        navItems = `<div class="nav-item active"> Attendance</div>`;
    } else if (currentUser.role === 'student') {
        navItems = `<div class="nav-item active"> My Attendance</div>`;
    }

    const mainContent = getViewContent();

    appDiv.innerHTML = `
        <div class="dashboard-layout fade-in">
            <div class="sidebar">
                <div class="sidebar-brand">
                    <span class="brand-icon"></span>
                    <span class="brand-text">VishNU IT</span>
                </div>
                <div class="user-card">
                    <div class="user-avatar" style="background:${info.color}20;color:${info.color};">
                        ${info.icon}
                    </div>
                    <div>
                        <p class="user-name">${currentUser.name || 'User'}</p>
                        <p class="user-role" style="color:${info.color};">${info.label}</p>
                        ${currentUser.branch ? `<p class="user-branch">${currentUser.branch}${currentUser.section ? '-'+currentUser.section : ''}</p>` : ''}
                    </div>
                </div>
                <nav class="sidebar-nav">
                    ${navItems}
                </nav>
                <div class="nav-item logout" id="logoutBtn"> Logout</div>
            </div>
            <div class="main-content">${mainContent}</div>
        </div>`;

    // Sidebar navigation
    document.querySelectorAll('.nav-item[data-view]').forEach(el => {
        el.addEventListener('click', async () => {
            currentView = el.dataset.view;
            showLoading();
            await loadData();
            renderDashboard();
        });
    });

    document.getElementById('logoutBtn').addEventListener('click', () => {
        currentUser = null; currentView = 'main';
        render();
    });

    attachEvents();
}

function getViewContent() {
    const r = currentUser.role;
    if (r === 'superadmin') return currentView === 'pwd_history' ? getAdminPasswordHistoryView() : getSuperAdminView();
    if (r === 'principal')  return currentView === 'reports' ? getReportsView('principal') : getPrincipalView();
    if (r === 'hod') {
        if (currentView === 'hod_students') return getHODStudentsView();
        if (currentView === 'hod_teachers') return getHODTeachersView();
        if (currentView === 'reports') return getReportsView('hod');
        return getHODView();
    }
    if (r === 'incharge') {
        if (currentView === 'students') return getInchargeStudentsView();
        if (currentView === 'teachers') return getInchargeTeachersView();
        return getInchargeView();
    }
    if (r === 'teacher') return getTeacherView();
    if (r === 'student')  return getStudentView();
    return '<p>Unknown role.</p>';
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW: SUPER ADMIN
// ─────────────────────────────────────────────────────────────────────────────
function getAdminPasswordHistoryView() {
    const changes = currentData.passwordChanges || [];
    const rows = changes.map((c, i) => `
        <tr>
            <td>${i+1}</td>
            <td>${c.name}</td>
            <td><span class="badge-branch">${c.role}</span></td>
            <td><span class="pwd-cell" style="color:var(--text-muted);">${c.oldPassword}</span></td>
            <td><span class="pwd-cell" style="color:var(--secondary);">${c.newPassword}</span></td>
        </tr>`).join('') || `<tr><td colspan="5" class="empty-cell">No password changes recorded yet.</td></tr>`;

    return `
        <h1 class="page-title"> Password History</h1>
        <div class="glass-panel" style="padding:24px;">
            <p style="color:var(--text-muted);margin-bottom:16px;">
                This table tracks all password changes made by users in the system.
            </p>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>S.No</th><th>User Name</th><th>Role</th><th>Old Password</th><th>New Password</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>`;
}

function getSuperAdminView() {
    const principals = currentData.principals || [];
    const hods       = currentData.hods || [];
    const principalHTML = principals.length
        ? principals.map(p => `
            <tr>
                <td>${p.name}</td>
                <td>${p.email}</td>
                <td>
                    <button class="btn-danger delete-principal" data-id="${p.id}"> Delete</button>
                </td>
            </tr>`).join('')
        : `<tr><td colspan="3" class="empty-cell">No principal added yet</td></tr>`;

    const hodHTML = hods.map(h => `
        <tr>
            <td>${h.name}</td>
            <td><span class="badge-branch">${h.branch}</span></td>
            <td>${h.email}</td>
            <td>
                <button class="btn-danger delete-hod" data-id="${h.id}"> Delete</button>
            </td>
        </tr>`).join('') || `<tr><td colspan="4" class="empty-cell">No HODs added yet</td></tr>`;

    return `
        <h1 class="page-title"> Super Admin Panel</h1>
        <div class="alert-info" style="margin-bottom:24px;">
             You have full control over the entire system. Changes here affect all users.
        </div>

        <!-- Add Principal -->
        <div style="display:grid;grid-template-columns:1fr 2fr;gap:24px;margin-bottom:28px;">
            <div class="glass-panel" style="padding:24px;">
                <h3> Add Principal</h3>
                <p style="font-size:13px;color:var(--text-muted);margin:8px 0 16px;">
                    Only one principal can exist system-wide.
                </p>
                <form id="addPrincipalForm">
                    <div class="form-group">
                        <label>Full Name</label>
                        <input type="text" id="pName" required placeholder="e.g. Dr. A. Suresh">
                    </div>
                    <button type="submit" id="addPrincipalBtn" style="width:100%;">Add Principal</button>
                </form>
            </div>
            <div class="glass-panel" style="padding:24px;">
                <h3> Current Principal</h3>
                <div class="table-container" style="margin-top:16px;">
                    <table>
                        <thead><tr><th>Name</th><th>Email</th><th>Action</th></tr></thead>
                        <tbody>${principalHTML}</tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- HODs overview -->
        <div class="glass-panel" style="padding:24px;">
            <h3> HOD Directory (All Branches)</h3>
            <div class="table-container" style="margin-top:16px;">
                <table>
                    <thead><tr><th>Name</th><th>Branch</th><th>Email</th><th>Action</th></tr></thead>
                    <tbody>${hodHTML}</tbody>
                </table>
            </div>
        </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW: PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
function getPrincipalView() {
    const hods = currentData.hods || [];
    const rows = hods.map(h => `
        <tr>
            <td>${h.name}</td>
            <td><span class="badge-branch">${h.branch}</span></td>
            <td>${h.email}</td>
            <td><span style="color:var(--text-muted);font-size:12px;">HOD@9009</span></td>
            <td>
                <button class="btn-danger delete-hod" data-id="${h.id}"> Delete</button>
            </td>
        </tr>`).join('') || `<tr><td colspan="5" class="empty-cell">No HODs added yet</td></tr>`;

    return `
        <h1 class="page-title"> Principal Dashboard</h1>
        <div class="stats-grid">
            <div class="glass-panel stat-card">
                <div class="stat-value">${hods.length}</div>
                <div class="stat-label">Total HODs</div>
            </div>
            <div class="glass-panel stat-card">
                <div class="stat-value">${branches.length}</div>
                <div class="stat-label">Departments</div>
            </div>
            <div class="glass-panel stat-card">
                <div class="stat-value">${branches.length - hods.length}</div>
                <div class="stat-label">Vacancies</div>
            </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 2fr;gap:24px;">
            <div class="glass-panel" style="padding:24px;">
                <h3> Add New HOD</h3>
                <form id="addHodForm" style="margin-top:16px;">
                    <div class="form-group">
                        <label>Full Name</label>
                        <input type="text" id="hName" required placeholder="e.g. Dr. Ramesh Kumar">
                    </div>
                    <div class="form-group">
                        <label>Department</label>
                        <select id="hDept">
                            ${branches.map(b=>`<option value="${b}">${b}</option>`).join('')}
                        </select>
                    </div>
                    <button type="submit" id="addHodBtn" style="width:100%;margin-top:8px;">Add HOD</button>
                </form>
            </div>
            <div class="glass-panel" style="padding:24px;">
                <h3> HOD Directory</h3>
                <div class="table-container" style="margin-top:16px;">
                    <table>
                        <thead><tr><th>Name</th><th>Branch</th><th>Email</th><th>Password</th><th>Action</th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>
        </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW: HOD
// ─────────────────────────────────────────────────────────────────────────────
function getHODView() {
    const incharges = currentData.incharges || [];
    const rows = incharges.map(i => `
        <tr>
            <td>${i.name}</td>
            <td><span class="badge-section">${i.section}</span></td>
            <td>${i.email}</td>
            <td><span style="color:var(--text-muted);font-size:12px;">Incharge@1234</span></td>
            <td>
                <button class="btn-danger delete-incharge" data-id="${i.id}"> Delete</button>
            </td>
        </tr>`).join('') || `<tr><td colspan="5" class="empty-cell">No incharges yet</td></tr>`;

    return `
        <h1 class="page-title"> ${currentUser.branch} Department</h1>
        <div class="stats-grid">
            <div class="glass-panel stat-card">
                <div class="stat-value">${incharges.length}</div>
                <div class="stat-label">Class Incharges</div>
            </div>
            <div class="glass-panel stat-card">
                <div class="stat-value">${currentUser.branch}</div>
                <div class="stat-label">Department</div>
            </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 2fr;gap:24px;">
            <div class="glass-panel" style="padding:24px;">
                <h3> Add Class Incharge</h3>
                <form id="addInchargeForm" style="margin-top:16px;">
                    <div class="form-group">
                        <label>Full Name</label>
                        <input type="text" id="iName" required placeholder="e.g. Dr. Priya">
                    </div>
                    <div class="form-group">
                        <label>Section (A/B/C…)</label>
                        <input type="text" id="iSection" required placeholder="e.g. A" maxlength="3">
                    </div>
                    <button type="submit" id="addInchargeBtn" style="width:100%;margin-top:8px;">Add Incharge</button>
                </form>
            </div>
            <div class="glass-panel" style="padding:24px;">
                <h3>👨‍ Class Incharges — ${currentUser.branch}</h3>
                <div class="table-container" style="margin-top:16px;">
                    <table>
                        <thead><tr><th>Name</th><th>Section</th><th>Email</th><th>Password</th><th>Action</th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>
        </div>
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:24px;">
            <!-- Add Student -->
            <div class="glass-panel" style="padding:24px;">
                <h3> Add Student to Section</h3>
                <form id="addStudentForm" style="margin-top:16px;">
                    <div class="form-group">
                        <label>Full Name</label>
                        <input type="text" id="sName" required placeholder="e.g. Ravi Kumar">
                    </div>
                    <div class="form-group">
                        <label>Roll Number (n) — must be unique</label>
                        <input type="number" id="sId" required placeholder="e.g. 21">
                    </div>
                    <div class="form-group">
                        <label>Section (A/B/C…)</label>
                        <input type="text" id="sSection" required placeholder="e.g. A" maxlength="3">
                    </div>
                    <button type="submit" id="addStudentBtn" style="width:100%;margin-top:8px;">Add Student</button>
                </form>
            </div>
            <!-- Add Teacher -->
            <div class="glass-panel" style="padding:24px;">
                <h3> Add Subject Teacher to Section</h3>
                <form id="addTeacherForm" style="margin-top:16px;">
                    <div class="form-group">
                        <label>Full Name</label>
                        <input type="text" id="tName" required placeholder="e.g. Prof. Sharma">
                    </div>
                    <div class="form-group">
                        <label>Subject</label>
                        <input type="text" id="tSubject" required placeholder="e.g. Data Structures">
                    </div>
                    <div class="form-group">
                        <label>Section (A/B/C…)</label>
                        <input type="text" id="tSection" required placeholder="e.g. A" maxlength="3">
                    </div>
                    <button type="submit" id="addTeacherBtn" style="width:100%;margin-top:8px;">Add Teacher</button>
                </form>
            </div>
        </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW: HOD – All Students (grouped by section)
// ─────────────────────────────────────────────────────────────────────────────
function getHODStudentsView() {
    const students = currentData.allStudents || [];
    // Group by section
    const sections = {};
    students.forEach(s => {
        const sec = s.section || 'Unknown';
        if (!sections[sec]) sections[sec] = [];
        sections[sec].push(s);
    });
    const sectionKeys = Object.keys(sections).sort();

    const sectionTables = sectionKeys.length ? sectionKeys.map(sec => {
        const rows = sections[sec].map((s, idx) => `
            <tr>
                <td>${idx+1}</td>
                <td>${s.name}</td>
                <td>${s.rollNumber || '-'}</td>
                <td>${s.email}</td>
                <td><span class="badge-section">${sec}</span></td>
                <td><button class="btn-danger delete-student" data-id="${s.id}"> Delete</button></td>
            </tr>`).join('');
        return `
            <div style="margin-bottom:28px;">
                <h3 style="margin-bottom:12px;color:var(--primary);font-size:16px;font-weight:700;">
                    Section ${sec} <span class="badge-branch" style="margin-left:8px;">${sections[sec].length} students</span>
                </h3>
                <div class="table-container">
                    <table>
                        <thead><tr><th>#</th><th>Name</th><th>Roll No.</th><th>Email</th><th>Section</th><th>Action</th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>`;
    }).join('') : `<div class="glass-panel" style="padding:36px;text-align:center;color:var(--text-muted);">No students added yet for ${currentUser.branch}.</div>`;

    return `
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;flex-wrap:wrap;">
            <h1 class="page-title" style="margin-bottom:0;"> All Students — ${currentUser.branch}</h1>
            <span class="badge-branch" style="font-size:14px;">${students.length} total</span>
            <button id="refreshHodStudentsBtn" style="background:var(--secondary-bg);color:var(--secondary);border:1.5px solid #6ee7b7;font-size:13px;padding:8px 16px;margin-left:auto;">🔄 Refresh</button>
        </div>
        ${sectionTables}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW: HOD – All Subject Teachers (grouped by section)
// ─────────────────────────────────────────────────────────────────────────────
function getHODTeachersView() {
    const teachers = currentData.allTeachers || [];
    // Group by section
    const sections = {};
    teachers.forEach(t => {
        const sec = t.section || 'Unknown';
        if (!sections[sec]) sections[sec] = [];
        sections[sec].push(t);
    });
    const sectionKeys = Object.keys(sections).sort();

    const sectionTables = sectionKeys.length ? sectionKeys.map(sec => {
        const rows = sections[sec].map((t, idx) => `
            <tr>
                <td>${idx+1}</td>
                <td>${t.name}</td>
                <td>${t.subject || '-'}</td>
                <td style="font-size:13px;">${t.email}</td>
                <td><span class="badge-section">${sec}</span></td>
                <td><button class="btn-danger delete-teacher" data-id="${t.id}"> Delete</button></td>
            </tr>`).join('');
        return `
            <div style="margin-bottom:28px;">
                <h3 style="margin-bottom:12px;color:var(--primary);font-size:16px;font-weight:700;">
                    Section ${sec} <span class="badge-branch" style="margin-left:8px;">${sections[sec].length} teachers</span>
                </h3>
                <div class="table-container">
                    <table>
                        <thead><tr><th>#</th><th>Name</th><th>Subject</th><th>Email</th><th>Section</th><th>Action</th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>`;
    }).join('') : `<div class="glass-panel" style="padding:36px;text-align:center;color:var(--text-muted);">No subject teachers added yet for ${currentUser.branch}.</div>`;

    return `
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;flex-wrap:wrap;">
            <h1 class="page-title" style="margin-bottom:0;">👨‍ Subject Teachers — ${currentUser.branch}</h1>
            <span class="badge-branch" style="font-size:14px;">${teachers.length} total</span>
            <button id="refreshHodTeachersBtn" style="background:var(--secondary-bg);color:var(--secondary);border:1.5px solid #6ee7b7;font-size:13px;padding:8px 16px;margin-left:auto;">🔄 Refresh</button>
        </div>
        ${sectionTables}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW: INCHARGE – main (add students/teachers)
// ─────────────────────────────────────────────────────────────────────────────
function getInchargeView() {
    return `
        <h1 class="page-title">👨‍ Section ${currentUser.branch}-${currentUser.section}</h1>
        <div class="stats-grid">
            <div class="glass-panel stat-card">
                <div class="stat-value">${(currentData.students||[]).length}</div>
                <div class="stat-label">Students</div>
            </div>
            <div class="glass-panel stat-card">
                <div class="stat-value">${(currentData.teachers||[]).length}</div>
                <div class="stat-label">Teachers</div>
            </div>
        </div>
        <div class="glass-panel" style="padding:24px; text-align:center;">
            <h3>Attendance Monitoring</h3>
            <p style="color:var(--text-muted);margin-top:16px;">
                As a Class Incharge, you have the authority to monitor student attendance for your section.
            </p>
        </div>
        <p style="margin-top:24px;color:var(--text-muted);font-size:14px;text-align:center;">
            Use the sidebar to view Students and 👨‍ Teachers lists.
        </p>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW: INCHARGE – Students list with attendance
// ─────────────────────────────────────────────────────────────────────────────
function getInchargeStudentsView() {
    const students   = currentData.students   || [];
    const attendance = currentData.allAttendance || [];

    const rows = students.map((s, idx) => {
        const recs    = attendance.filter(a => a.studentId === s.id);
        const total   = recs.length;
        const present = recs.filter(a => a.present).length;
        const pct     = total > 0 ? ((present/total)*100).toFixed(1) + '%' : 'N/A';
        const color   = total > 0 && (present/total)*100 < 75 ? 'var(--error)' : 'var(--secondary)';
        return `
        <tr>
            <td>${idx+1}</td>
            <td>${s.name}</td>
            <td>${s.email}</td>
            <td style="color:${color};font-weight:600;">${pct}</td>
            <td><button class="btn-danger delete-student" data-id="${s.id}"></button></td>
        </tr>`;
    }).join('') || `<tr><td colspan="5" class="empty-cell">No students yet</td></tr>`;

    return `
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;flex-wrap:wrap;">
            <h1 class="page-title" style="margin-bottom:0;"> Students — ${currentUser.branch}-${currentUser.section}</h1>
            <button id="refreshStudentsBtn" style="background:var(--secondary);font-size:13px;padding:8px 16px;">🔄 Refresh</button>
        </div>
        <div class="glass-panel" style="padding:24px;">
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>S.No</th><th>Name</th><th>Email</th><th>Attendance %</th><th>Delete</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW: INCHARGE – Teachers list
// ─────────────────────────────────────────────────────────────────────────────
function getInchargeTeachersView() {
    const teachers = currentData.teachers || [];
    const rows = teachers.map((t, idx) => `
        <tr>
            <td>${idx+1}</td>
            <td>${t.name}</td>
            <td style="font-size:13px;">${t.email}</td>
            <td>${t.subject}</td>
            <td><span class="pwd-cell">${t.password}</span></td>
            <td><button class="btn-danger delete-teacher" data-id="${t.id}"></button></td>
        </tr>`).join('') || `<tr><td colspan="6" class="empty-cell">No teachers added yet</td></tr>`;

    return `
        <h1 class="page-title">👨‍ Teachers — ${currentUser.branch}-${currentUser.section}</h1>
        <div class="glass-panel" style="padding:24px;">
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>S.No</th><th>Name</th><th>Email</th><th>Subject</th><th>Password</th><th>Delete</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW: REPORTS (Principal → all branches | HOD → all sections of branch)
// ─────────────────────────────────────────────────────────────────────────────
function getReportsView(role) {
    const students   = currentData.allStudents   || [];
    const attendance = currentData.allAttendance || [];

    // Group students by branch (principal) or section (hod)
    const groupKey = role === 'principal' ? 'branch' : 'section';
    const groups   = {};
    students.forEach(s => {
        const key = s[groupKey] || 'Unknown';
        if (!groups[key]) groups[key] = [];
        groups[key].push(s);
    });

    const sorted = Object.keys(groups).sort();
    if (!sorted.length) {
        return `
            <h1 class="page-title"> Reports</h1>
            <div class="glass-panel" style="padding:40px;text-align:center;">
                <div style="font-size:48px;margin-bottom:16px;">📭</div>
                <h3>No student data available yet</h3>
                <p style="color:var(--text-muted);margin-top:8px;">Add students to generate reports.</p>
            </div>`;
    }

    const sections = sorted.map(key => {
        const grpStudents = groups[key];
        const rows = grpStudents.map((s, idx) => {
            const recs    = attendance.filter(a => a.studentId === s.id);
            const total   = recs.length;
            const present = recs.filter(a => a.present).length;
            const pct     = total > 0 ? ((present/total)*100).toFixed(1)+'%' : 'N/A';
            const color   = total > 0 && (present/total)*100 < 75 ? 'var(--error)' : 'var(--secondary)';
            return `
            <tr>
                <td>${idx+1}</td>
                <td>${s.name}</td>
                <td>${s.email}</td>
                <td>${s.section || '—'}</td>
                <td style="color:${color};font-weight:600;">${pct}</td>
            </tr>`;
        }).join('');

        const title = role === 'principal'
            ? ` Branch: ${key}`
            : `📂 Section: ${currentUser.branch}-${key}`;

        const avgArr = grpStudents.map(s => {
            const recs = attendance.filter(a => a.studentId === s.id);
            return recs.length ? (recs.filter(a=>a.present).length/recs.length)*100 : null;
        }).filter(v => v !== null);
        const avgPct = avgArr.length ? (avgArr.reduce((a,b)=>a+b,0)/avgArr.length).toFixed(1)+'%' : 'N/A';

        return `
        <div class="glass-panel" style="padding:24px;margin-bottom:24px;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
                <h3>${title}</h3>
                <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
                    <span class="badge-stat"> ${grpStudents.length} Students</span>
                    <span class="badge-stat">📈 Avg: ${avgPct}</span>
                    <button class="btn-print" data-section="${key}"> Print</button>
                </div>
            </div>
            <div class="table-container" id="report-${key}">
                <table>
                    <thead><tr>
                        <th>S.No</th><th>Name</th><th>Email</th><th>Section</th><th>Attendance %</th>
                    </tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>`;
    }).join('');

    return `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px;">
            <h1 class="page-title" style="margin-bottom:0;"> Attendance Reports</h1>
            <button id="printAllBtn"> Print All Reports</button>
        </div>
        ${sections}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW: TEACHER
// ─────────────────────────────────────────────────────────────────────────────
function getTeacherView() {
    const markedMap    = {};
    (currentData.attendanceRecords||[]).forEach(r => { markedMap[r.studentId] = r.present; });
    const alreadyMarked = Object.keys(markedMap).length > 0;
    const students     = currentData.students || [];

    const rows = students.map(s => {
        const isPresent = markedMap[s.id] !== undefined ? markedMap[s.id] : true;
        const status    = markedMap[s.id] === undefined ? 'Not marked'
                        : markedMap[s.id] ? '✔ Present' : '✘ Absent';
        const statusClr = markedMap[s.id] === undefined ? 'var(--text-muted)'
                        : markedMap[s.id] ? 'var(--secondary)' : 'var(--error)';
        return `
        <tr>
            <td>${s.name}</td>
            <td>
                <input type="checkbox" class="attendance-cb" data-id="${s.id}"
                    ${isPresent ? 'checked' : ''}
                    ${alreadyMarked ? 'disabled' : ''}
                    style="width:20px;height:20px;cursor:pointer;accent-color:var(--secondary);">
            </td>
            <td><span style="font-size:12px;padding:3px 10px;border-radius:20px;
                background:${markedMap[s.id]===undefined?'rgba(148,163,184,0.2)':markedMap[s.id]?'rgba(16,185,129,0.2)':'rgba(239,68,68,0.2)'};
                color:${statusClr};">${status}</span></td>
        </tr>`;
    }).join('') || `<tr><td colspan="3" class="empty-cell">No students in this section</td></tr>`;

    return `
        <h1 class="page-title"> Attendance — ${currentUser.subject}</h1>
        <div class="glass-panel" style="padding:24px;margin-bottom:24px;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;">
                <div>
                    <p style="color:var(--text-muted);font-size:13px;">Teacher</p>
                    <h3>${currentUser.name}</h3>
                    <p style="color:var(--primary-light);font-size:13px;margin-top:2px;">
                        ${currentUser.subject} &nbsp;|&nbsp; ${currentUser.branch}-${currentUser.section}
                    </p>
                </div>
                <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;">
                    <label style="color:var(--text-muted);font-size:13px;">📆 Select Date</label>
                    <input type="date" id="attendanceDatePicker" value="${selectedDate}"
                           max="${new Date().toISOString().split('T')[0]}"
                           style="padding:10px 14px;border-radius:8px;border:1px solid var(--border);
                                  background:rgba(0,0,0,0.3);color:var(--text);font-size:14px;cursor:pointer;">
                </div>
            </div>
        </div>
        <div class="glass-panel" style="padding:24px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
                <div>
                    <h3>Student List</h3>
                    <p style="font-size:13px;color:var(--text-muted);margin-top:4px;">
                        ${new Date(selectedDate+'T00:00:00').toLocaleDateString('en-IN',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
                    </p>
                    ${alreadyMarked
                        ? `<span class="badge-success" style="margin-top:6px;display:inline-block;"> Attendance already marked</span>`
                        : `<span class="badge-pending" style="margin-top:6px;display:inline-block;">⏳ Not yet marked</span>`
                    }
                </div>
                ${!alreadyMarked
                    ? `<button id="submitAttendanceBtn" style="background:var(--secondary);">💾 Save Attendance</button>`
                    : `<button disabled style="background:rgba(255,255,255,0.1);cursor:not-allowed;">✔ Already Saved</button>`
                }
            </div>
            <div class="table-container">
                <table>
                    <thead><tr><th>Student Name</th><th>Present</th><th>Status</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW: STUDENT
// ─────────────────────────────────────────────────────────────────────────────
function getStudentView() {
    const records = currentData.attendanceRecords || [];
    const total   = records.length;
    const present = records.filter(r=>r.present).length;
    const pct     = total > 0 ? ((present/total)*100).toFixed(1) : '—';
    const color   = pct !== '—' && parseFloat(pct) < 75 ? '#ef4444' : 'var(--secondary)';

    const bySubject = {};
    records.forEach(r => {
        if (!bySubject[r.subject]) bySubject[r.subject] = {total:0,present:0};
        bySubject[r.subject].total++;
        if (r.present) bySubject[r.subject].present++;
    });

    const subjectRows = Object.entries(bySubject).map(([sub,v]) => {
        const p = ((v.present/v.total)*100).toFixed(1);
        const c = parseFloat(p) < 75 ? '#ef4444' : 'var(--secondary)';
        return `<tr>
            <td>${sub}</td>
            <td>${v.total}</td>
            <td>${v.present}</td>
            <td style="color:${c};font-weight:600;">${p}%</td>
        </tr>`;
    }).join('') || `<tr><td colspan="4" class="empty-cell">No attendance records yet</td></tr>`;

    return `
        <h1 class="page-title"> My Attendance</h1>
        <div class="stats-grid">
            <div class="glass-panel stat-card">
                <div class="stat-value" style="color:${color};">${pct}${pct!=='—'?'%':''}</div>
                <div class="stat-label">Overall Attendance</div>
            </div>
            <div class="glass-panel stat-card">
                <div class="stat-value">${present}/${total}</div>
                <div class="stat-label">Classes Attended</div>
            </div>
        </div>
        <div class="glass-panel" style="padding:24px;">
            <h3> Subject-Wise Breakdown</h3>
            <div class="table-container" style="margin-top:16px;">
                <table>
                    <thead><tr><th>Subject</th><th>Classes Held</th><th>Attended</th><th>Percentage</th></tr></thead>
                    <tbody>${subjectRows}</tbody>
                </table>
            </div>
        </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENT HANDLERS
// ─────────────────────────────────────────────────────────────────────────────
function attachEvents() {

    // ── HOD: Refresh Students/Teachers views ─────────────────────────────────
    const refreshHodStudentsBtn = document.getElementById('refreshHodStudentsBtn');
    if (refreshHodStudentsBtn) {
        refreshHodStudentsBtn.addEventListener('click', async () => {
            showLoading(); await loadData(); renderDashboard();
        });
    }
    const refreshHodTeachersBtn = document.getElementById('refreshHodTeachersBtn');
    if (refreshHodTeachersBtn) {
        refreshHodTeachersBtn.addEventListener('click', async () => {
            showLoading(); await loadData(); renderDashboard();
        });
    }


    const addPrincipalForm = document.getElementById('addPrincipalForm');
    if (addPrincipalForm) {
        addPrincipalForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn  = document.getElementById('addPrincipalBtn');
            const name = document.getElementById('pName').value.trim();
            btn.textContent = 'Adding…'; btn.disabled = true;
            try {
                // Only one principal allowed
                const existing = await db.collection('users').where('role','==','principal').get();
                if (!existing.empty) {
                    showToast(' A Principal already exists! Delete the current one first.');
                    btn.textContent = 'Add Principal'; btn.disabled = false;
                    return;
                }
                await db.collection('users').add({
                    role: 'principal',
                    name,
                    email: 'principal@vishnu.edu.in',
                    password: 'principal@123'
                });
                showToast(' Principal added!\n📧 Email: principal@vishnu.edu.in\n Password: principal@123');
                await render();
            } catch(err) {
                showToast(' Error: ' + err.message);
                btn.textContent = 'Add Principal'; btn.disabled = false;
            }
        });
    }

    // ── Delete Principal (Super Admin) ────────────────────────────────────────
    document.querySelectorAll('.delete-principal').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm(' Delete this Principal? This cannot be undone.')) return;
            try {
                await db.collection('users').doc(btn.dataset.id).delete();
                showToast(' Principal deleted.');
                await render();
            } catch(err) { showToast(' Error: ' + err.message); }
        });
    });

    // ── Add HOD (Principal) ───────────────────────────────────────────────────
    const addHodForm = document.getElementById('addHodForm');
    if (addHodForm) {
        addHodForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn    = document.getElementById('addHodBtn');
            const name   = document.getElementById('hName').value.trim();
            const branch = document.getElementById('hDept').value;
            btn.textContent = 'Adding…'; btn.disabled = true;
            try {
                // Unique HOD per branch
                const existing = await db.collection('users')
                    .where('role','==','hod').where('branch','==',branch).get();
                if (!existing.empty) {
                    showToast(` A HOD for ${branch} already exists! Delete the current one first.`);
                    btn.textContent = 'Add HOD'; btn.disabled = false;
                    return;
                }
                const hodEmail = `HOD${branch}@vishnu.edu.in`.toLowerCase();
                await db.collection('users').add({
                    role: 'hod', name, branch,
                    email: hodEmail,
                    password: 'HOD@9009'
                });
                showToast(` HOD for ${branch} added!\n📧 Email: ${hodEmail}\n Password: HOD@9009`);
                await render();
            } catch(err) {
                showToast(' Error: ' + err.message);
                btn.textContent = 'Add HOD'; btn.disabled = false;
            }
        });
    }

    // ── Delete HOD ────────────────────────────────────────────────────────────
    document.querySelectorAll('.delete-hod').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm(' Delete this HOD? This cannot be undone.')) return;
            try {
                await db.collection('users').doc(btn.dataset.id).delete();
                showToast(' HOD deleted.');
                await render();
            } catch(err) { showToast(' Error: ' + err.message); }
        });
    });

    // ── Add Incharge (HOD) ────────────────────────────────────────────────────
    const addInchargeForm = document.getElementById('addInchargeForm');
    if (addInchargeForm) {
        addInchargeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn     = document.getElementById('addInchargeBtn');
            const name    = document.getElementById('iName').value.trim();
            const section = document.getElementById('iSection').value.trim().toUpperCase();
            btn.textContent = 'Adding…'; btn.disabled = true;
            try {
                // Unique Incharge per branch-section
                const existing = await db.collection('users')
                    .where('role','==','incharge')
                    .where('branch','==',currentUser.branch)
                    .where('section','==',section).get();
                if (!existing.empty) {
                    showToast(` An Incharge for ${currentUser.branch}-${section} already exists! Delete the current one first.`);
                    btn.textContent = 'Add Incharge'; btn.disabled = false;
                    return;
                }
                const inchargeEmail = `incharge${currentUser.branch}${section}@vishnu.edu.in`.toLowerCase();
                await db.collection('users').add({
                    role: 'incharge', name,
                    branch: currentUser.branch, section,
                    email: inchargeEmail,
                    password: 'Incharge@1234'
                });
                showToast(` Incharge for ${currentUser.branch}-${section} added!\n📧 Email: ${inchargeEmail}\n Password: Incharge@1234`);
                await render();
            } catch(err) {
                showToast(' Error: ' + err.message);
                btn.textContent = 'Add Incharge'; btn.disabled = false;
            }
        });
    }

    // ── Delete Incharge ───────────────────────────────────────────────────────
    document.querySelectorAll('.delete-incharge').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm(' Delete this Incharge? This cannot be undone.')) return;
            try {
                await db.collection('users').doc(btn.dataset.id).delete();
                showToast(' Incharge deleted.');
                await render();
            } catch(err) { showToast(' Error: ' + err.message); }
        });
    });

    // ── Add Student (HOD) ──────────────────────────────────────────────────────
    const addStudentForm = document.getElementById('addStudentForm');
    if (addStudentForm) {
        addStudentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn  = document.getElementById('addStudentBtn');
            const name = document.getElementById('sName').value.trim();
            const sId  = document.getElementById('sId').value.trim();
            const section = document.getElementById('sSection').value.trim().toUpperCase();
            btn.textContent = 'Adding…'; btn.disabled = true;
            try {
                // Unique roll number per section
                const existing = await db.collection('users')
                    .where('role','==','student')
                    .where('branch','==',currentUser.branch)
                    .where('section','==',section)
                    .where('rollNumber','==',sId).get();
                if (!existing.empty) {
                    showToast(` Roll number ${sId} already exists in ${currentUser.branch}-${section}! Please use a different roll number.`);
                    btn.textContent = 'Add Student'; btn.disabled = false;
                    return;
                }
                const email = `student${sId}${currentUser.branch}${section}@vishnu.edu.in`.toLowerCase();
                await db.collection('users').add({
                    role: 'student', name,
                    branch: currentUser.branch,
                    section: section,
                    rollNumber: sId,
                    email,
                    password: 'student@123'
                });
                showToast(` Student ${name} added to Section ${section}!\n📧 Email: ${email}\n Password: student@123`);
                document.getElementById('sName').value = '';
                document.getElementById('sId').value = '';
                document.getElementById('sSection').value = '';
                btn.textContent = 'Add Student'; btn.disabled = false;
                await render();
            } catch(err) {
                showToast(' Error: ' + err.message);
                btn.textContent = 'Add Student'; btn.disabled = false;
            }
        });
    }

    // ── Add Teacher (HOD) ──────────────────────────────────────────────────────
    const addTeacherForm = document.getElementById('addTeacherForm');
    if (addTeacherForm) {
        addTeacherForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn     = document.getElementById('addTeacherBtn');
            const name    = document.getElementById('tName').value.trim();
            const subject = document.getElementById('tSubject').value.trim();
            const section = document.getElementById('tSection').value.trim().toUpperCase();
            const branch  = currentUser.branch;
            const subjectSlug    = subject.replace(/\s+/g,'');
            const teacherEmail   = `teacher${subjectSlug}-${branch}-${section}@vishnu.edu.in`.toLowerCase();
            const teacherPassword= `teacher${subjectSlug}@123`;
            btn.textContent = 'Adding…'; btn.disabled = true;
            try {
                // Unique teacher per subject per section
                const existing = await db.collection('users')
                    .where('role','==','teacher')
                    .where('branch','==',branch)
                    .where('section','==',section)
                    .where('subject','==',subject).get();
                if (!existing.empty) {
                    showToast(` A teacher for "${subject}" in ${branch}-${section} already exists! Only one teacher per subject per section is allowed.`);
                    btn.textContent = 'Add Teacher'; btn.disabled = false;
                    return;
                }
                await db.collection('users').add({
                    role: 'teacher', name, subject,
                    branch, section,
                    email:    teacherEmail,
                    password: teacherPassword
                });
                showToast(` Teacher ${name} added to Section ${section}!\n📧 Email: ${teacherEmail}\n Password: ${teacherPassword}`);
                document.getElementById('tName').value = '';
                document.getElementById('tSubject').value = '';
                document.getElementById('tSection').value = '';
                btn.textContent = 'Add Teacher'; btn.disabled = false;
                await render();
            } catch(err) {
                showToast(' Error: ' + err.message);
                btn.textContent = 'Add Teacher'; btn.disabled = false;
            }
        });
    }

    // ── Delete Student ─────────────────────────────────────────────────────────
    document.querySelectorAll('.delete-student').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm(' Delete this student? All their attendance records will remain but the student will be removed.')) return;
            try {
                await db.collection('users').doc(btn.dataset.id).delete();
                showToast(' Student deleted.');
                await render();
            } catch(err) { showToast(' Error: ' + err.message); }
        });
    });

    // ── Delete Teacher ─────────────────────────────────────────────────────────
    document.querySelectorAll('.delete-teacher').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm(' Delete this teacher?')) return;
            try {
                await db.collection('users').doc(btn.dataset.id).delete();
                showToast(' Teacher deleted.');
                await render();
            } catch(err) { showToast(' Error: ' + err.message); }
        });
    });

    // ── Refresh Students ───────────────────────────────────────────────────────
    const refreshBtn = document.getElementById('refreshStudentsBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            showLoading();
            await loadData();
            renderDashboard();
        });
    }

    // ── Date picker (Teacher) ──────────────────────────────────────────────────
    const datePicker = document.getElementById('attendanceDatePicker');
    if (datePicker) {
        datePicker.addEventListener('change', async () => {
            selectedDate = datePicker.value;
            showLoading();
            await loadData();
            renderDashboard();
        });
    }

    // ── Save Attendance (Teacher) ─────────────────────────────────────────────
    const submitBtn = document.getElementById('submitAttendanceBtn');
    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            submitBtn.textContent = 'Saving…'; submitBtn.disabled = true;
            const cbs = document.querySelectorAll('.attendance-cb');
            try {
                const batch = db.batch();
                cbs.forEach(cb => {
                    const ref = db.collection('attendance').doc();
                    batch.set(ref, {
                        studentId: cb.dataset.id,
                        teacherId: currentUser.id,
                        subject:   currentUser.subject,
                        branch:    currentUser.branch,
                        section:   currentUser.section,
                        date:      selectedDate,
                        present:   cb.checked
                    });
                });
                await batch.commit();
                showToast(` Attendance for ${selectedDate} saved!`);
                showLoading();
                await loadData();
                renderDashboard();
            } catch(err) {
                showToast(' Error: ' + err.message);
                submitBtn.textContent = '💾 Save Attendance'; submitBtn.disabled = false;
            }
        });
    }

    // ── Print Reports ──────────────────────────────────────────────────────────
    document.querySelectorAll('.btn-print').forEach(btn => {
        btn.addEventListener('click', () => {
            const key      = btn.dataset.section;
            const tableEl  = document.getElementById(`report-${key}`);
            if (!tableEl) return;
            const win = window.open('', '_blank');
            win.document.write(`
                <html><head><title>Attendance Report — ${key}</title>
                <style>
                    body{font-family:sans-serif;padding:24px;color:#111;}
                    h2{margin-bottom:12px;}
                    table{width:100%;border-collapse:collapse;}
                    th,td{border:1px solid #ccc;padding:8px 12px;text-align:left;}
                    th{background:#f3f4f6;}
                    tr:nth-child(even) td{background:#fafafa;}
                </style></head><body>
                <h2>Attendance Report — ${key} (${new Date().toLocaleDateString('en-IN')})</h2>
                ${tableEl.innerHTML}
                <script>window.print();window.close();<\/script>
                </body></html>`);
        });
    });

    const printAllBtn = document.getElementById('printAllBtn');
    if (printAllBtn) {
        printAllBtn.addEventListener('click', () => window.print());
    }
}

// ─── Start ────────────────────────────────────────────────────────────────────
ensureSuperAdmin().then(() => render());



