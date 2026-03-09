// app.js — SubMaster Application Logic

document.addEventListener('DOMContentLoaded', () => {
    // ---- DOM References ----
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const menuToggle = document.getElementById('menuToggle');
    const closeSidebarBtn = document.getElementById('closeSidebar');
    const pageTitle = document.getElementById('pageTitle');
    const btnNewAccount = document.getElementById('btnNewAccount');
    const btnNewPlatform = document.getElementById('btnNewPlatform');
    const btnNewCustomer = document.getElementById('btnNewCustomer');
    const searchAccounts = document.getElementById('searchAccounts');
    const filterStatus = document.getElementById('filterStatus');
    const searchCustomers = document.getElementById('searchCustomers');

    // ============================================================
    //  FIREBASE AUTHENTICATION & SYNC
    // ============================================================
    const loginScreen = document.getElementById('firebaseLoginScreen');
    const globalLoader = document.getElementById('globalLoader');
    const loginForm = document.getElementById('loginForm');
    const loginLoading = document.getElementById('loginLoading');
    const btnLogoutSidebar = document.getElementById('btnLogoutSidebar');

    // Check Auth State
    if (window.firebaseApp) {
        window.firebaseApp.onAuthStateChanged(window.firebaseApp.auth, (user) => {
            if (user) {
                loginScreen.classList.add('fade-out');
                DataManager.startFirebaseSync();
            } else {
                loginScreen.classList.remove('fade-out');
                globalLoader.classList.add('fade-out');
            }
        });

        // Login Submit
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const pass = document.getElementById('loginPassword').value;
            const btn = loginForm.querySelector('.login-btn');

            btn.style.display = 'none';
            loginLoading.style.display = 'block';

            window.firebaseApp.signInWithEmailAndPassword(window.firebaseApp.auth, email, pass)
                .then(() => {
                    loginScreen.classList.add('fade-out');
                    Swal.fire({ icon: 'success', title: 'تم الدخول', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000, background: '#111827', color: '#fff' });
                    btn.style.display = 'block';
                    loginLoading.style.display = 'none';
                    loginForm.reset();
                })
                .catch(() => {
                    btn.style.display = 'block';
                    loginLoading.style.display = 'none';
                    Swal.fire({ icon: 'error', title: 'فشل الدخول', text: 'البريد أو كلمة المرور غير صحيحة', background: '#111827', color: '#fff' });
                });
        });

        // Logout
        if (btnLogoutSidebar) {
            btnLogoutSidebar.addEventListener('click', () => {
                Swal.fire({
                    title: 'تسجيل خروج؟', icon: 'question',
                    showCancelButton: true, confirmButtonColor: '#ef4444',
                    confirmButtonText: 'نعم', cancelButtonText: 'إلغاء',
                    background: '#111827', color: '#fff'
                }).then((res) => {
                    if (res.isConfirmed) {
                        window.firebaseApp.signOut(window.firebaseApp.auth);
                    }
                });
            });
        }
    } else {
        loginScreen.classList.add('fade-out');
        globalLoader.classList.add('fade-out');
    }

    // Refresh views on Firestore data change
    window.addEventListener('dataChanged', () => {
        globalLoader.classList.add('fade-out');
        checkNotifications();
        const activeItem = document.querySelector('.nav-item.active') || document.querySelector('.b-nav-item.active');
        if (activeItem) {
            refreshView(activeItem.getAttribute('data-view'));
        }
    });

    // ============================================================
    //  DISPLAY SETTINGS
    // ============================================================
    const btnDisplaySettings = document.getElementById('btnDisplaySettings');
    const toggleFinancials = document.getElementById('toggleFinancials');
    const toggleCredentials = document.getElementById('toggleCredentials');

    const storedFinancials = localStorage.getItem('submaster_show_financials');
    const storedCredentials = localStorage.getItem('submaster_show_credentials');

    if (storedFinancials === 'false') {
        if (toggleFinancials) toggleFinancials.checked = false;
        document.body.classList.add('hide-financials');
    }
    if (storedCredentials === 'false') {
        if (toggleCredentials) toggleCredentials.checked = false;
        document.body.classList.add('hide-credentials');
    }

    const toggleCompactMode = document.getElementById('toggleCompactMode');
    const storedCompactMode = localStorage.getItem('submaster_compact_mode');

    if (storedCompactMode === 'true') {
        if (toggleCompactMode) toggleCompactMode.checked = true;
        document.body.classList.add('compact-mode');
    }

    const btnCleanupDB = document.getElementById('btnCleanupDB');

    if (btnDisplaySettings) {
        btnDisplaySettings.addEventListener('click', () => {
            openModal('settingsModal');
        });
    }

    if (btnCleanupDB) {
        btnCleanupDB.addEventListener('click', async () => {
            const res = await Swal.fire({
                title: 'تأكيد التنظيف',
                text: 'هل أنت متأكد من رغبتك في دمج وحذف الخدمات المكررة؟',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'نعم، نظف الآن',
                cancelButtonText: 'إلغاء'
            });
            if (res.isConfirmed) {
                await DataManager.cleanupDatabase();
            }
        });
    }

    if (toggleFinancials) {
        toggleFinancials.addEventListener('change', (e) => {
            localStorage.setItem('submaster_show_financials', e.target.checked);
            if (e.target.checked) document.body.classList.remove('hide-financials');
            else document.body.classList.add('hide-financials');
        });
    }

    if (toggleCredentials) {
        toggleCredentials.addEventListener('change', (e) => {
            localStorage.setItem('submaster_show_credentials', e.target.checked);
            if (e.target.checked) document.body.classList.remove('hide-credentials');
            else document.body.classList.add('hide-credentials');
        });
    }

    if (toggleCompactMode) {
        toggleCompactMode.addEventListener('change', (e) => {
            localStorage.setItem('submaster_compact_mode', e.target.checked);
            if (e.target.checked) document.body.classList.add('compact-mode');
            else document.body.classList.remove('compact-mode');
        });
    }

    // ============================================================
    //  NAVIGATION
    // ============================================================
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const viewId = item.getAttribute('data-view');
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            const bNavItems = document.querySelectorAll('.b-nav-item');
            bNavItems.forEach(bNav => {
                bNav.classList.remove('active');
                if (bNav.getAttribute('data-view') === viewId) bNav.classList.add('active');
            });

            pageTitle.innerText = item.querySelector('span').innerText;
            views.forEach(view => view.classList.remove('active'));
            document.getElementById(`view-${viewId}`).classList.add('active');
            closeMobileSidebar();
            refreshView(viewId);
        });
    });

    // ---- Bottom Nav ----
    const bNavItems = document.querySelectorAll('.b-nav-item');
    bNavItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const viewId = item.getAttribute('data-view');

            bNavItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            navItems.forEach(nav => {
                nav.classList.remove('active');
                if (nav.getAttribute('data-view') === viewId) {
                    nav.classList.add('active');
                    pageTitle.innerText = nav.querySelector('span').innerText;
                }
            });

            views.forEach(view => view.classList.remove('active'));
            document.getElementById(`view-${viewId}`).classList.add('active');
            refreshView(viewId);
        });
    });

    function refreshView(viewId) {
        if (viewId === 'dashboard') renderDashboard();
        if (viewId === 'customers') renderCustomers();
        if (viewId === 'accounts') renderAccounts();
        if (viewId === 'plans') renderPlans();
        if (viewId === 'platforms') { renderPlatforms(); renderLookups(); }
    }

    // ---- Mobile Sidebar ----
    function openMobileSidebar() {
        sidebar.classList.add('open');
        sidebarOverlay.classList.add('show');
    }
    function closeMobileSidebar() {
        if (window.innerWidth <= 768) {
            sidebar.classList.remove('open');
            sidebarOverlay.classList.remove('show');
        }
    }
    menuToggle.addEventListener('click', openMobileSidebar);
    closeSidebarBtn.addEventListener('click', closeMobileSidebar);
    sidebarOverlay.addEventListener('click', closeMobileSidebar);

    // ============================================================
    //  MODALS (generic)
    // ============================================================
    document.querySelectorAll('[data-dismiss]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            closeModal(btn.getAttribute('data-dismiss'));
        });
    });

    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('show');
        });
    });

    function openModal(id) { document.getElementById(id).classList.add('show'); }
    function closeModal(id) { document.getElementById(id).classList.remove('show'); }

    // ============================================================
    //  NOTIFICATIONS & PWA INSTALLATION
    // ============================================================
    const dismissNotif = document.getElementById('dismissNotification');
    if (dismissNotif) {
        dismissNotif.addEventListener('click', () => {
            const bar = document.getElementById('notificationBar');
            if (bar) bar.style.display = 'none';
        });
    }

    // PWA Installation & iOS Handling
    let deferredPrompt;
    const pwaBanner = document.getElementById('pwaInstallBanner');
    const iosPwaBanner = document.getElementById('iosPwaBanner');
    const btnInstallPwa = document.getElementById('btnInstallPwa');
    const btnDismissPwa = document.getElementById('btnDismissPwa');
    const btnDismissIosPwa = document.getElementById('btnDismissIosPwa');

    // Check if dismissed before
    const isPwaDismissed = localStorage.getItem('submaster_pwa_dismissed') === 'true';

    // Detect iOS and Standalone mode
    const isIos = () => {
        const userAgent = window.navigator.userAgent.toLowerCase();
        return /iphone|ipad|ipod/.test(userAgent);
    };

    // Fallback detection for Safari on newer iPads which request desktop site
    const isIosFallback = () => {
        return window.navigator.maxTouchPoints &&
            window.navigator.maxTouchPoints > 2 &&
            /MacIntel/.test(window.navigator.platform);
    };

    const isStandalone = () => {
        return window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
    };

    // Show iOS instruction if iOS and not Standalone
    if ((isIos() || isIosFallback()) && !isStandalone() && !isPwaDismissed && iosPwaBanner) {
        // Show after a short delay so user sees it clearly
        setTimeout(() => {
            iosPwaBanner.style.display = 'flex';
        }, 1500);
    }

    if (btnDismissIosPwa) {
        btnDismissIosPwa.addEventListener('click', () => {
            if (iosPwaBanner) iosPwaBanner.style.display = 'none';
            localStorage.setItem('submaster_pwa_dismissed', 'true');
        });
    }

    // Standard Android/Chrome Install Prompt
    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent Chrome 67 and earlier from automatically showing the prompt
        e.preventDefault();
        // Stash the event so it can be triggered later.
        deferredPrompt = e;

        // Show banner if not dismissed yet
        if (!isPwaDismissed && pwaBanner && !isIos() && !isIosFallback()) {
            if (!isStandalone()) {
                pwaBanner.style.display = 'flex';
            }
        }
    });

    if (btnInstallPwa) {
        btnInstallPwa.addEventListener('click', async () => {
            if (pwaBanner) pwaBanner.style.display = 'none';
            if (deferredPrompt) {
                // Show the install prompt
                deferredPrompt.prompt();
                // Wait for the user to respond to the prompt
                const { outcome } = await deferredPrompt.userChoice;
                console.log(`User response to the install prompt: ${outcome}`);
                // We've used the prompt, and can't use it again, throw it away
                deferredPrompt = null;
            }
        });
    }

    if (btnDismissPwa) {
        btnDismissPwa.addEventListener('click', () => {
            if (pwaBanner) pwaBanner.style.display = 'none';
            localStorage.setItem('submaster_pwa_dismissed', 'true');
        });
    }

    function checkNotifications() {
        const bar = document.getElementById('notificationBar');
        const list = document.getElementById('notificationBarContent');
        if (!bar || !list) return;

        const { expiring, expired } = DataManager.getNotifications();
        const total = expiring.length + expired.length;

        if (total === 0) {
            bar.style.display = 'none';
            return;
        }

        bar.style.display = 'flex';
        let html = '';

        expired.forEach(n => {
            html += `<span class="notif-item notif-expired">
                <i class="fa-solid fa-circle-xmark"></i>
                <strong>${escapeHtml(n.custName)}</strong> — ${escapeHtml(n.platName)}: انتهى الاشتراك
            </span>`;
        });

        expiring.forEach(n => {
            html += `<span class="notif-item notif-warning">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <strong>${escapeHtml(n.custName)}</strong> — ${escapeHtml(n.platName)}: يتبقى ${n.daysLeft} يوم
            </span>`;
        });

        list.innerHTML = html;
    }

    // ============================================================
    //  DASHBOARD
    // ============================================================
    function renderDashboard() {
        // Welcome Banner Logic
        const welcomeDate = document.getElementById('welcomeDate');
        const welcomeMsg = document.getElementById('welcomeMsg');
        if (welcomeDate && welcomeMsg) {
            const now = new Date();
            const hour = now.getHours();
            let greeting = 'مرحباً بك!';
            if (hour < 12) greeting = 'صباح الخير ☀️';
            else if (hour < 18) greeting = 'مساء الخير 🌤️';
            else greeting = 'مساء الخير 🌙';

            welcomeMsg.innerText = greeting;
            welcomeDate.innerText = now.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        }

        const stats = DataManager.calculateStats();
        const accounts = DataManager.getAccounts();
        const fmt = (num) => Number(num).toLocaleString('ar-EG');

        document.getElementById('stat-revenue').innerHTML = fmt(stats.totalRevenue) + ' <span>ج.م</span>';
        document.getElementById('stat-cost').innerHTML = fmt(stats.totalCost) + ' <span>ج.م</span>';
        document.getElementById('stat-profit').innerHTML = fmt(stats.netProfit) + ' <span>ج.م</span>';
        document.getElementById('stat-refunds').innerHTML = fmt(stats.totalRefunds) + ' <span>ج.م</span>';

        let activeCount = 0, warningCount = 0, expiredCount = 0;
        accounts.forEach(acc => {
            const s = DataManager.getAccountStatus(acc);
            if (s.status === 'active') activeCount++;
            else if (s.status === 'warning') warningCount++;
            else expiredCount++;
        });
        document.getElementById('stat-customers-count').textContent = DataManager.getCustomers().length;
        document.getElementById('stat-active-count').textContent = activeCount;
        document.getElementById('stat-warning-count').textContent = warningCount;
        document.getElementById('stat-expired-count').textContent = expiredCount;

        const overviewContainer = document.getElementById('dashboard-overview');
        if (accounts.length === 0) {
            overviewContainer.innerHTML = '<p class="text-muted text-center" style="padding:2rem 0;width:100%;">لا توجد بيانات كافية لاستعراض التحليلات.</p>';
        } else {
            const platformCounts = {};
            accounts.forEach(acc => {
                platformCounts[acc.platformId] = (platformCounts[acc.platformId] || 0) + 1;
            });
            let html = '';
            Object.keys(platformCounts).forEach(pid => {
                const p = DataManager.getPlatformById(pid);
                if (p) {
                    html += `<div class="platform-stat-card">
                        <i class="${escapeHtml(p.icon)}" style="color:${escapeHtml(p.color)};"></i>
                        <h4>${escapeHtml(p.name)}</h4>
                        <div class="count">${platformCounts[pid]} حساب</div>
                    </div>`;
                }
            });
            overviewContainer.innerHTML = html;
        }

        const recentContainer = document.getElementById('recent-accounts-list');
        if (accounts.length === 0) {
            recentContainer.innerHTML = '<p class="text-muted text-center" style="padding:1.5rem 0;">لا توجد اشتراكات بعد.</p>';
        } else {
            const sorted = [...accounts].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
            const recent = sorted.slice(0, 5);
            let html = '';
            recent.forEach(acc => {
                const p = DataManager.getPlatformById(acc.platformId);
                const cust = DataManager.getCustomerById(acc.customerId);
                const statusInfo = DataManager.getAccountStatus(acc);
                const custName = cust ? cust.name : (acc.customerName || 'غير محدد');
                html += `<div class="recent-item">
                    <div class="platform-icon-sm" style="background:${p ? p.color + '25' : '#333'};color:${p ? p.color : '#fff'};">
                        <i class="${p ? escapeHtml(p.icon) : 'fa-solid fa-server'}"></i>
                    </div>
                    <div class="info">
                        <strong>${escapeHtml(custName)}</strong> — ${p ? escapeHtml(p.name) : 'غير محدد'}
                        <small>${acc.startDate} • ${acc.durationDays} يوم • <span class="status-badge status-${statusInfo.status}">${statusInfo.label}</span></small>
                    </div>
                </div>`;
            });
            recentContainer.innerHTML = html;
        }
    }

    // ============================================================
    //  CUSTOMERS
    // ============================================================
    searchCustomers.addEventListener('input', renderCustomers);

    document.getElementById('btnAddFirstCustomer').addEventListener('click', () => openNewCustomerModal());

    function renderCustomers() {
        const grid = document.getElementById('customersGrid');
        const emptyState = document.getElementById('customersEmptyState');
        const searchTerm = searchCustomers.value.toLowerCase();
        const customers = DataManager.getCustomers();

        grid.innerHTML = '';

        const filtered = customers.filter(c => {
            return (c.name || '').toLowerCase().includes(searchTerm) ||
                (c.phone || '').toLowerCase().includes(searchTerm);
        });

        if (filtered.length === 0) {
            emptyState.style.display = 'block';
            if (customers.length > 0 && filtered.length === 0) {
                emptyState.innerHTML = '<i class="fa-solid fa-search"></i><p>لا توجد نتائج مطابقة للبحث</p>';
            } else {
                emptyState.innerHTML = '<i class="fa-solid fa-user-slash"></i><p>لا يوجد مشتركين مسجلين حالياً</p><button class="btn btn-primary mt-2" id="btnAddFirstCustomer2">أضف أول مشترك</button>';
                const btn2 = document.getElementById('btnAddFirstCustomer2');
                if (btn2) btn2.addEventListener('click', () => openNewCustomerModal());
            }
            return;
        }

        emptyState.style.display = 'none';

        filtered.forEach(c => {
            const stats = DataManager.getCustomerStats(c.id);
            const initials = (c.name || '?').charAt(0);
            const card = document.createElement('div');
            card.className = 'customer-card glass-panel';
            card.innerHTML = `
                <div class="customer-avatar">${escapeHtml(initials)}</div>
                <div class="customer-info">
                    <h4>${escapeHtml(c.name)}</h4>
                    <div class="phone">${escapeHtml(c.phone || 'بدون رقم')}</div>
                    <div class="job text-muted" style="font-size:0.85rem; margin-top:0.2rem;"><i class="fa-solid fa-briefcase fa-fw"></i> ${escapeHtml(c.job || 'بدون وظيفة')}${c.workplace ? ' &nbsp;•&nbsp; <i class="fa-solid fa-building fa-fw"></i> ' + escapeHtml(c.workplace) : ''}</div>
                    <div class="customer-meta">
                        <span class="badge"><i class="fa-solid fa-layer-group"></i> ${stats.totalSubscriptions} اشتراك</span>
                        <span class="badge active-badge"><i class="fa-solid fa-circle-check"></i> ${stats.activeSubs} نشط</span>
                        <span class="badge money-badge"><i class="fa-solid fa-coins"></i> ${Number(stats.totalPaid).toLocaleString('ar-EG')} ج.م</span>
                    </div>
                </div>
                <div class="customer-card-actions">
                    <button class="btn-icon add-sub-cust-btn" data-id="${c.id}" title="إضافة اشتراك"><i class="fa-solid fa-plus text-success"></i></button>
                    <button class="btn-icon view-cust-btn" data-id="${c.id}" title="عرض التفاصيل"><i class="fa-solid fa-eye text-info"></i></button>
                    <button class="btn-icon edit-cust-btn" data-id="${c.id}" title="تعديل"><i class="fa-solid fa-pen text-primary"></i></button>
                    <button class="btn-icon delete-cust-btn" data-id="${c.id}" title="حذف"><i class="fa-solid fa-trash text-danger"></i></button>
                </div>
            `;
            grid.appendChild(card);
        });

        grid.querySelectorAll('.add-sub-cust-btn').forEach(btn => {
            btn.addEventListener('click', (e) => { e.stopPropagation(); openNewAccountForCustomer(btn.dataset.id); });
        });
        grid.querySelectorAll('.view-cust-btn').forEach(btn => {
            btn.addEventListener('click', (e) => { e.stopPropagation(); viewCustomerDetail(btn.dataset.id); });
        });
        grid.querySelectorAll('.edit-cust-btn').forEach(btn => {
            btn.addEventListener('click', (e) => { e.stopPropagation(); editCustomer(btn.dataset.id); });
        });
        grid.querySelectorAll('.delete-cust-btn').forEach(btn => {
            btn.addEventListener('click', (e) => { e.stopPropagation(); deleteCustomer(btn.dataset.id); });
        });

        grid.querySelectorAll('.customer-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.btn-icon')) return;
                const viewBtn = card.querySelector('.view-cust-btn');
                if (viewBtn) viewCustomerDetail(viewBtn.dataset.id);
            });
        });
    }

    // ---- Customer Form Selects ----
    function populateCustJobSelect(currentVal) {
        const select = document.getElementById('custJobSelect');
        const customInput = document.getElementById('custJobCustom');
        const titles = DataManager.getJobTitles();
        select.innerHTML = '<option value="">-- اختر الوظيفة --</option>';
        titles.forEach(t => {
            const sel = currentVal === t ? ' selected' : '';
            select.innerHTML += `<option value="${escapeHtml(t)}"${sel}>${escapeHtml(t)}</option>`;
        });
        select.innerHTML += '<option value="__custom__">أخرى (اكتب يدوياً)</option>';
        if (currentVal && !titles.includes(currentVal)) {
            select.value = '__custom__';
            customInput.style.display = 'block';
            customInput.value = currentVal;
        } else {
            select.value = currentVal || '';
            customInput.style.display = 'none';
            customInput.value = '';
        }
    }

    function populateCustWorkplaceSelect(currentVal) {
        const select = document.getElementById('custWorkplaceSelect');
        const customInput = document.getElementById('custWorkplaceCustom');
        const places = DataManager.getWorkplaces();
        select.innerHTML = '<option value="">-- اختر جهة العمل --</option>';
        places.forEach(p => {
            const sel = currentVal === p ? ' selected' : '';
            select.innerHTML += `<option value="${escapeHtml(p)}"${sel}>${escapeHtml(p)}</option>`;
        });
        select.innerHTML += '<option value="__custom__">أخرى (اكتب يدوياً)</option>';
        if (currentVal && !places.includes(currentVal)) {
            select.value = '__custom__';
            customInput.style.display = 'block';
            customInput.value = currentVal;
        } else {
            select.value = currentVal || '';
            customInput.style.display = 'none';
            customInput.value = '';
        }
    }

    document.getElementById('custJobSelect').addEventListener('change', (e) => {
        const ci = document.getElementById('custJobCustom');
        if (e.target.value === '__custom__') { ci.style.display = 'block'; ci.focus(); }
        else { ci.style.display = 'none'; ci.value = ''; }
    });

    document.getElementById('custWorkplaceSelect').addEventListener('change', (e) => {
        const ci = document.getElementById('custWorkplaceCustom');
        if (e.target.value === '__custom__') { ci.style.display = 'block'; ci.focus(); }
        else { ci.style.display = 'none'; ci.value = ''; }
    });

    // New Customer
    btnNewCustomer.addEventListener('click', () => openNewCustomerModal());

    function openNewCustomerModal() {
        document.getElementById('customerForm').reset();
        document.getElementById('custId').value = '';
        document.getElementById('customerModalTitle').innerText = 'إضافة مشترك جديد';
        populateCustJobSelect('');
        populateCustWorkplaceSelect('');
        openModal('customerModal');
    }

    // Save Customer
    document.getElementById('btnSaveCustomer').addEventListener('click', (e) => {
        e.preventDefault();
        const name = document.getElementById('custName').value.trim();
        const phone = document.getElementById('custPhone').value.trim();
        const notes = document.getElementById('custNotes').value.trim();
        const custId = document.getElementById('custId').value;

        const jobSel = document.getElementById('custJobSelect').value;
        const job = jobSel === '__custom__' ? document.getElementById('custJobCustom').value.trim() : (jobSel || '');
        const wpSel = document.getElementById('custWorkplaceSelect').value;
        const workplace = wpSel === '__custom__' ? document.getElementById('custWorkplaceCustom').value.trim() : (wpSel || '');

        if (!name) {
            Swal.fire({ icon: 'error', title: 'خطأ', text: 'يرجى كتابة اسم المشترك', background: '#111827', color: '#fff' });
            return;
        }

        if (custId) {
            DataManager.updateCustomer({ id: custId, name, phone, job, workplace, notes });
            showToast('تم تحديث بيانات المشترك');
        } else {
            DataManager.addCustomer({ name, phone, job, workplace, notes });
            showToast('تم إضافة المشترك بنجاح');
        }

        closeModal('customerModal');
        renderCustomers();
        renderDashboard();
    });

    function editCustomer(id) {
        const c = DataManager.getCustomerById(id);
        if (!c) return;
        document.getElementById('custId').value = c.id;
        document.getElementById('custName').value = c.name || '';
        document.getElementById('custPhone').value = c.phone || '';
        document.getElementById('custNotes').value = c.notes || '';
        document.getElementById('customerModalTitle').innerText = 'تعديل بيانات المشترك';
        populateCustJobSelect(c.job || '');
        populateCustWorkplaceSelect(c.workplace || '');
        openModal('customerModal');
    }

    function deleteCustomer(id) {
        const subs = DataManager.getCustomerSubscriptions(id);
        if (subs.length > 0) {
            Swal.fire({
                icon: 'error', title: 'غير ممكن',
                text: `لا يمكن حذف هذا المشترك لوجود ${subs.length} اشتراك مرتبط به. احذف الاشتراكات أولاً.`,
                background: '#111827', color: '#fff'
            });
            return;
        }
        Swal.fire({
            title: 'تأكيد حذف المشترك؟', icon: 'warning',
            showCancelButton: true, confirmButtonColor: '#ef4444',
            confirmButtonText: 'احذف', cancelButtonText: 'إلغاء',
            background: '#111827', color: '#fff'
        }).then(result => {
            if (result.isConfirmed) {
                DataManager.deleteCustomer(id);
                renderCustomers();
                renderDashboard();
                showToast('تم حذف المشترك');
            }
        });
    }

    function viewCustomerDetail(id) {
        const c = DataManager.getCustomerById(id);
        if (!c) return;
        const subs = DataManager.getCustomerSubscriptions(id);
        const stats = DataManager.getCustomerStats(id);

        document.getElementById('customerDetailTitle').innerText = 'تفاصيل المشترك: ' + c.name;

        let subsHtml = '';
        if (subs.length === 0) {
            subsHtml = '<p class="text-muted text-center" style="padding:1rem 0;">لا توجد اشتراكات لهذا المشترك.</p>';
        } else {
            subsHtml = '<div class="detail-subs-list">';
            subs.forEach(acc => {
                const p = DataManager.getPlatformById(acc.platformId);
                const st = DataManager.getAccountStatus(acc);
                const plan = acc.servicePlanId ? DataManager.getServicePlanById(acc.servicePlanId) : null;
                const paidBadge = acc.isPaid
                    ? '<span class="status-badge" style="background:rgba(34,197,94,0.15);color:#22c55e;">سدّد</span>'
                    : '<span class="status-badge" style="background:rgba(239,68,68,0.15);color:#ef4444;">لم يسدد</span>';
                subsHtml += `<div class="detail-sub-item">
                    <div class="sub-platform-icon" style="background:${p ? p.color + '25' : '#333'};color:${p ? p.color : '#fff'};">
                        <i class="${p ? escapeHtml(p.icon) : 'fa-solid fa-server'}"></i>
                    </div>
                    <div class="sub-info">
                        <strong>${p ? escapeHtml(p.name) : 'غير محدد'}</strong>${plan ? ' <small class="text-muted">(' + escapeHtml(plan.name) + ')</small>' : ''}
                        <small>${acc.startDate} • ${acc.durationDays} يوم • اشتراك: ${Number(acc.revenue).toLocaleString('ar-EG')} ج.م</small>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:0.3rem;align-items:flex-end;">
                        <div style="display:flex;gap:0.3rem;">
                            ${paidBadge}
                            <span class="status-badge status-${st.status}">${st.label}</span>
                        </div>
                        <div style="display:flex;gap:0.3rem;">
                            <button class="btn-icon detail-edit-acc-btn" data-id="${acc.id}" title="تعديل"><i class="fa-solid fa-pen text-info" style="font-size:0.75rem;"></i></button>
                            <button class="btn-icon detail-delete-acc-btn" data-id="${acc.id}" title="حذف"><i class="fa-solid fa-trash text-danger" style="font-size:0.75rem;"></i></button>
                        </div>
                    </div>
                </div>`;
            });
            subsHtml += '</div>';
        }

        document.getElementById('customerDetailBody').innerHTML = `
            <div class="customer-detail-header">
                <div class="avatar-lg">${escapeHtml((c.name || '?').charAt(0))}</div>
                <div class="detail-info">
                    <h3>${escapeHtml(c.name)}</h3>
                    <p><i class="fa-solid fa-phone fa-fw"></i> ${escapeHtml(c.phone || 'بدون رقم')}</p>
                    ${c.job ? '<p><i class="fa-solid fa-briefcase fa-fw"></i> ' + escapeHtml(c.job) + '</p>' : ''}
                    ${c.workplace ? '<p><i class="fa-solid fa-building fa-fw"></i> ' + escapeHtml(c.workplace) + '</p>' : ''}
                    ${c.notes ? '<p><i class="fa-solid fa-sticky-note fa-fw"></i> ' + escapeHtml(c.notes) + '</p>' : ''}
                </div>
            </div>
            <div class="detail-stats-row">
                <div class="detail-stat">
                    <span class="val text-primary">${stats.totalSubscriptions}</span>
                    <small>إجمالي الاشتراكات</small>
                </div>
                <div class="detail-stat">
                    <span class="val text-success">${stats.activeSubs}</span>
                    <small>نشط حالياً</small>
                </div>
                <div class="detail-stat">
                    <span class="val text-warning">${Number(stats.totalPaid).toLocaleString('ar-EG')}</span>
                    <small>إجمالي المدفوعات (ج.م)</small>
                </div>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                <h4 style="margin:0;"><i class="fa-solid fa-list-check text-primary"></i> الاشتراكات</h4>
                <button class="btn btn-primary btn-sm" id="btnAddSubFromDetail" data-customer-id="${c.id}">
                    <i class="fa-solid fa-plus"></i> إضافة اشتراك
                </button>
            </div>
            ${subsHtml}
        `;

        // Bind add subscription button in detail modal
        const addSubBtn = document.getElementById('btnAddSubFromDetail');
        if (addSubBtn) {
            addSubBtn.addEventListener('click', () => {
                closeModal('customerDetailModal');
                openNewAccountForCustomer(addSubBtn.dataset.customerId);
            });
        }

        // Bind edit buttons in detail modal
        document.querySelectorAll('.detail-edit-acc-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                closeModal('customerDetailModal');
                editAccount(btn.dataset.id);
            });
        });

        // Bind delete buttons in detail modal
        document.querySelectorAll('.detail-delete-acc-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const accId = btn.dataset.id;
                Swal.fire({
                    title: 'هل أنت متأكد؟', text: 'لن تتمكن من استرجاع بيانات هذا الاشتراك!',
                    icon: 'warning', showCancelButton: true,
                    confirmButtonColor: '#ef4444', cancelButtonColor: '#6b7280',
                    confirmButtonText: 'نعم، احذف', cancelButtonText: 'إلغاء',
                    background: '#111827', color: '#fff'
                }).then(result => {
                    if (result.isConfirmed) {
                        DataManager.deleteAccount(accId);
                        renderAccounts();
                        checkNotifications();
                        if (document.getElementById('view-dashboard').classList.contains('active')) renderDashboard();
                        showToast('تم حذف الاشتراك بنجاح');
                        // Refresh the customer detail modal
                        viewCustomerDetail(id);
                    }
                });
            });
        });

        openModal('customerDetailModal');
    }

    // ============================================================
    //  SERVICE PLANS (خطط الاشتراك)
    // ============================================================
    const btnNewPlan = document.getElementById('btnNewPlan');
    if (btnNewPlan) btnNewPlan.addEventListener('click', () => openNewPlanModal());

    const btnAddFirstPlan = document.getElementById('btnAddFirstPlan');
    if (btnAddFirstPlan) btnAddFirstPlan.addEventListener('click', () => openNewPlanModal());

    // Plan password toggle
    document.querySelectorAll('.toggle-plan-password').forEach(btn => {
        btn.addEventListener('click', function () {
            const input = document.getElementById('planPassword');
            const icon = this.querySelector('i');
            if (input.type === 'password') { input.type = 'text'; icon.classList.replace('fa-eye', 'fa-eye-slash'); }
            else { input.type = 'password'; icon.classList.replace('fa-eye-slash', 'fa-eye'); }
        });
    });

    function populatePlanPlatformsDropdown(selectedId) {
        const select = document.getElementById('planPlatform');
        if (!select) return;
        const platforms = DataManager.getPlatforms();
        select.innerHTML = '<option value="" disabled>اختر المنصة...</option>';
        platforms.forEach(p => {
            const sel = (selectedId && p.id === selectedId) ? ' selected' : '';
            select.innerHTML += `<option value="${p.id}"${sel}>${escapeHtml(p.name)}</option>`;
        });
        if (!selectedId) select.selectedIndex = 0;
    }

    function renderPlans() {
        const grid = document.getElementById('plansGrid');
        const emptyState = document.getElementById('plansEmptyState');
        if (!grid) return;

        const plans = DataManager.getServicePlans();
        grid.innerHTML = '';

        if (plans.length === 0) {
            if (emptyState) emptyState.style.display = 'flex';
            return;
        }
        if (emptyState) emptyState.style.display = 'none';

        plans.forEach(plan => {
            const platform = DataManager.getPlatformById(plan.platformId);
            const membersCount = DataManager.getServicePlanMembersCount(plan.id);
            const statusInfo = DataManager.getAccountStatus({ startDate: plan.startDate, durationDays: plan.durationDays || 365 });
            const planFin = DataManager.getPlanFinancials(plan.id);

            const maskedEmail = plan.email ? plan.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : '—';

            const card = document.createElement('div');
            card.className = 'plan-card glass-panel';
            card.innerHTML = `
                <div class="plan-card-header">
                    <div class="plan-platform-icon" style="background:${platform ? platform.color + '25' : '#33333355'};color:${platform ? platform.color : '#fff'};">
                        <i class="${platform ? escapeHtml(platform.icon) : 'fa-solid fa-server'}"></i>
                    </div>
                    <div class="plan-header-info">
                        <h3>${escapeHtml(plan.name || (platform ? platform.name : 'خطة'))}</h3>
                        <small class="text-muted">${platform ? escapeHtml(platform.name) : 'غير محدد'}</small>
                    </div>
                    <span class="status-badge status-${statusInfo.status}">${statusInfo.label}</span>
                </div>
                <div class="plan-card-body">
                    <div class="plan-stat"><i class="fa-solid fa-users text-primary"></i> <span>${membersCount} عضو</span></div>
                    <div class="plan-stat"><i class="fa-solid fa-tag text-success"></i> <span>${Number(plan.pricePerMember || 0).toLocaleString('ar-EG')} ج.م / عضو</span></div>
                    <div class="plan-stat"><i class="fa-solid fa-calendar-day text-info"></i> <span>${plan.startDate || '—'}</span></div>
                    <div class="plan-stat"><i class="fa-solid fa-envelope text-muted"></i> <span>${escapeHtml(maskedEmail)}</span></div>
                    ${plan.registrationCost ? `<div class="plan-stat"><i class="fa-solid fa-receipt text-warning"></i> <span>تكلفة الخطة: ${Number(plan.registrationCost).toLocaleString('ar-EG')} ج.م</span></div>` : ''}
                    <div class="plan-stat" style="border-top:1px solid rgba(255,255,255,0.06); padding-top:0.5rem; margin-top:0.3rem;">
                        <i class="fa-solid fa-coins text-success"></i>
                        <span>محصّل: <strong class="text-success">${Number(planFin.totalRevenue).toLocaleString('ar-EG')}</strong> ج.م</span>
                    </div>
                    ${plan.registrationCost ? `<div class="plan-stat">
                        <i class="fa-solid fa-chart-line ${planFin.netProfit >= 0 ? 'text-success' : 'text-danger'}"></i>
                        <span>صافي: <strong class="${planFin.netProfit >= 0 ? 'text-success' : 'text-danger'}">${planFin.netProfit >= 0 ? '+' : ''}${Number(planFin.netProfit).toLocaleString('ar-EG')}</strong> ج.م</span>
                    </div>` : ''}
                </div>
                <div class="plan-card-actions">
                    <button class="btn btn-sm btn-outline edit-plan-btn" data-id="${plan.id}">
                        <i class="fa-solid fa-pen"></i> تعديل
                    </button>
                    <button class="btn btn-sm btn-outline text-danger delete-plan-btn" data-id="${plan.id}">
                        <i class="fa-solid fa-trash"></i> حذف
                    </button>
                </div>
            `;
            grid.appendChild(card);
        });

        grid.querySelectorAll('.edit-plan-btn').forEach(btn => {
            btn.addEventListener('click', (e) => { e.stopPropagation(); editPlan(btn.dataset.id); });
        });
        grid.querySelectorAll('.delete-plan-btn').forEach(btn => {
            btn.addEventListener('click', (e) => { e.stopPropagation(); deletePlan(btn.dataset.id); });
        });
    }

    function openNewPlanModal() {
        const form = document.getElementById('planForm');
        if (form) form.reset();
        const planId = document.getElementById('planId');
        if (planId) planId.value = '';
        const title = document.getElementById('planModalTitle');
        if (title) title.innerText = 'إضافة خطة اشتراك جديدة';
        const passInput = document.getElementById('planPassword');
        if (passInput) passInput.type = 'password';
        populatePlanPlatformsDropdown('');
        openModal('planModal');
    }

    function editPlan(id) {
        const plan = DataManager.getServicePlanById(id);
        if (!plan) return;
        document.getElementById('planId').value = plan.id;
        populatePlanPlatformsDropdown(plan.platformId);
        document.getElementById('planName').value = plan.name || '';
        document.getElementById('planStartDate').value = plan.startDate || '';
        document.getElementById('planDurationDays').value = plan.durationDays || 365;
        document.getElementById('planEmail').value = plan.email || '';
        document.getElementById('planPassword').value = plan.password || '';
        document.getElementById('planPassword').type = 'password';
        document.getElementById('planRegistrationCost').value = plan.registrationCost || '';
        document.getElementById('planPricePerMember').value = plan.pricePerMember || '';
        document.getElementById('planNotes').value = plan.notes || '';
        document.getElementById('planModalTitle').innerText = 'تعديل خطة الاشتراك';
        openModal('planModal');
    }

    document.getElementById('btnSavePlan').addEventListener('click', async (e) => {
        e.preventDefault();
        const platformId = document.getElementById('planPlatform').value;
        const startDate = document.getElementById('planStartDate').value;

        if (!platformId || !startDate) {
            Swal.fire({ icon: 'error', title: 'بيانات ناقصة', text: 'يرجى اختيار المنصة وتاريخ البدء على الأقل', background: '#111827', color: '#fff' });
            return;
        }

        const planData = {
            platformId,
            name: document.getElementById('planName').value.trim(),
            startDate,
            durationDays: parseInt(document.getElementById('planDurationDays').value) || 365,
            email: document.getElementById('planEmail').value.trim(),
            password: document.getElementById('planPassword').value,
            registrationCost: parseFloat(document.getElementById('planRegistrationCost').value) || 0,
            pricePerMember: parseFloat(document.getElementById('planPricePerMember').value) || 0,
            notes: document.getElementById('planNotes').value.trim()
        };

        const planId = document.getElementById('planId').value;
        if (planId) {
            planData.id = planId;
            await DataManager.updateServicePlan(planData);
            showToast('تم تحديث الخطة بنجاح');
        } else {
            await DataManager.addServicePlan(planData);
            showToast('تمت إضافة الخطة بنجاح');
        }

        closeModal('planModal');
        renderPlans();
    });

    function deletePlan(id) {
        const membersCount = DataManager.getServicePlanMembersCount(id);
        if (membersCount > 0) {
            Swal.fire({
                icon: 'error', title: 'غير ممكن',
                text: `لا يمكن حذف هذه الخطة لوجود ${membersCount} اشتراك مرتبط بها. احذف الاشتراكات أولاً.`,
                background: '#111827', color: '#fff'
            });
            return;
        }
        Swal.fire({
            title: 'تأكيد حذف الخطة؟', icon: 'warning',
            showCancelButton: true, confirmButtonColor: '#ef4444',
            confirmButtonText: 'احذف', cancelButtonText: 'إلغاء',
            background: '#111827', color: '#fff'
        }).then(async result => {
            if (result.isConfirmed) {
                await DataManager.deleteServicePlan(id);
                renderPlans();
                showToast('تم حذف الخطة');
            }
        });
    }

    // ============================================================
    //  ACCOUNTS (Subscriptions)
    // ============================================================
    searchAccounts.addEventListener('input', renderAccounts);
    filterStatus.addEventListener('change', renderAccounts);

    function renderAccounts() {
        const tableBody = document.querySelector('#accountsTable tbody');
        const emptyState = document.getElementById('accountsEmptyState');
        const searchTerm = searchAccounts.value.toLowerCase();
        const statusFilterVal = filterStatus.value;
        const accounts = DataManager.getAccounts();

        tableBody.innerHTML = '';

        if (accounts.length === 0) {
            emptyState.style.display = 'block';
            document.querySelector('#accountsTable').style.display = 'none';
            return;
        }

        let visibleCount = 0;

        accounts.forEach(acc => {
            const platform = DataManager.getPlatformById(acc.platformId);
            const pName = platform ? platform.name : 'غير محدد';
            const cust = DataManager.getCustomerById(acc.customerId);
            const custName = cust ? cust.name : (acc.customerName || 'غير محدد');
            const custPhone = cust ? cust.phone : (acc.customerPhone || '');
            const statusInfo = DataManager.getAccountStatus(acc);
            const plan = acc.servicePlanId ? DataManager.getServicePlanById(acc.servicePlanId) : null;

            const matchesSearch =
                custName.toLowerCase().includes(searchTerm) ||
                (custPhone || '').toLowerCase().includes(searchTerm) ||
                pName.toLowerCase().includes(searchTerm) ||
                (acc.username || '').toLowerCase().includes(searchTerm);

            const matchesStatus = statusFilterVal === 'all' || statusInfo.status === statusFilterVal;
            if (!matchesSearch || !matchesStatus) return;
            visibleCount++;

            const revenue = parseFloat(acc.revenue || 0);
            const refund = parseFloat(acc.refund || 0);
            const netRevenue = revenue - refund;

            const isPaid = acc.isPaid === true;
            const paidBtn = `<button class="btn-icon toggle-paid-btn" data-id="${acc.id}" data-paid="${isPaid}" title="${isPaid ? 'تم السداد - اضغط للتغيير' : 'لم يسدد - اضغط للتغيير'}">
                <i class="fa-solid ${isPaid ? 'fa-circle-check text-success' : 'fa-circle-xmark text-danger'}"></i>
            </button>`;

            const serviceLabel = plan
                ? `<div>${escapeHtml(pName)}</div><div class="text-muted" style="font-size:0.78rem">${escapeHtml(plan.name || '')}</div>`
                : `<div>${escapeHtml(pName)}</div>`;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="الخدمة / الخطة">
                    <div class="platform-cell">
                        <div class="platform-icon" style="background:${platform ? platform.color + '25' : '#333'};color:${platform ? platform.color : '#fff'};">
                            <i class="${platform ? escapeHtml(platform.icon) : 'fa-solid fa-server'}"></i>
                        </div>
                        ${serviceLabel}
                    </div>
                </td>
                <td data-label="المشترك">
                    <div style="font-weight:700;">${escapeHtml(custName)}</div>
                    <div class="text-muted" style="font-size:0.82rem">${escapeHtml(custPhone || 'بدون رقم')}</div>
                </td>
                <td data-label="بيانات الدخول" class="text-center">
                    <button class="btn-icon show-creds-btn" data-id="${acc.id}" title="عرض بيانات الدخول">
                        <i class="fa-solid fa-key text-warning"></i>
                    </button>
                </td>
                <td data-label="التاريخ/المدة">
                    <div>${acc.startDate || '-'}</div>
                    <div class="text-primary" style="font-size:0.82rem;font-weight:700;">
                        ${acc.durationDays} يوم
                        <span class="text-muted">(${statusInfo.daysLeft} متبقي)</span>
                    </div>
                </td>
                <td data-label="الماليات" class="col-financials">
                    <div>اشتراك: <span class="text-success">${Number(acc.revenue).toLocaleString('ar-EG')}</span> ج.م</div>
                    ${refund > 0 ? '<div>تعويض: <span class="text-danger">' + Number(acc.refund).toLocaleString('ar-EG') + '</span> ج.م</div>' : ''}
                </td>
                <td data-label="سدّد؟" class="text-center">${paidBtn}</td>
                <td data-label="الكود / ملاحظات">
                    <div style="font-family:monospace;user-select:text;font-size:0.85rem;">${escapeHtml(acc.activationCode || '-')}</div>
                    <div class="text-muted" style="font-size:0.78rem">${escapeHtml(acc.notes ? (acc.notes.length > 30 ? acc.notes.substring(0, 30) + '...' : acc.notes) : '')}</div>
                </td>
                <td data-label="الحالة"><span class="status-badge status-${statusInfo.status}">${statusInfo.label}</span></td>
                <td data-label="إجراءات">
                    <div class="actions-cell">
                        <button class="btn-icon edit-acc-btn" data-id="${acc.id}" title="تعديل"><i class="fa-solid fa-pen text-info"></i></button>
                        <button class="btn-icon delete-acc-btn" data-id="${acc.id}" title="حذف"><i class="fa-solid fa-trash text-danger"></i></button>
                    </div>
                </td>`;
            tableBody.appendChild(tr);
        });

        tableBody.querySelectorAll('.edit-acc-btn').forEach(btn => {
            btn.addEventListener('click', () => editAccount(btn.dataset.id));
        });
        tableBody.querySelectorAll('.delete-acc-btn').forEach(btn => {
            btn.addEventListener('click', () => deleteAccount(btn.dataset.id));
        });
        tableBody.querySelectorAll('.toggle-paid-btn').forEach(btn => {
            btn.addEventListener('click', () => toggleAccountPaid(btn.dataset.id, btn.dataset.paid === 'true'));
        });
        tableBody.querySelectorAll('.show-creds-btn').forEach(btn => {
            btn.addEventListener('click', () => showCredentials(btn.dataset.id));
        });

        if (visibleCount === 0) {
            emptyState.style.display = 'block';
            document.querySelector('#accountsTable').style.display = 'none';
        } else {
            emptyState.style.display = 'none';
            document.querySelector('#accountsTable').style.display = 'table';
        }
    }

    function toggleAccountPaid(id, currentPaid) {
        DataManager.updateAccountPaid(id, !currentPaid);
        renderAccounts();
        checkNotifications();
    }

    function showCredentials(accId) {
        const acc = DataManager.getAccounts().find(a => a.id === accId);
        if (!acc) return;

        // Determine credentials: account-specific first, then fall back to plan
        let username = acc.username || '';
        let password = acc.password || '';
        let source = 'خاصة بالعميل';

        if (!username && !password && acc.servicePlanId) {
            const plan = DataManager.getServicePlanById(acc.servicePlanId);
            if (plan) {
                username = plan.email || '';
                password = plan.password || '';
                source = 'من الخطة';
            }
        }

        const cust = DataManager.getCustomerById(acc.customerId);
        const platform = DataManager.getPlatformById(acc.platformId);

        const copyUserBtn = username ? `<button class="btn-icon copy-cred-btn" data-copy="${escapeAttr(username)}" title="نسخ"><i class="fa-solid fa-copy text-muted"></i></button>` : '';
        const copyPassBtn = password ? `<button class="btn-icon copy-cred-btn" data-copy="${escapeAttr(password)}" title="نسخ"><i class="fa-solid fa-copy text-muted"></i></button>` : '';
        const activationRow = acc.activationCode
            ? `<div class="cred-row" style="margin-top:0.75rem;"><label><i class="fa-solid fa-barcode fa-fw text-muted"></i> كود التفعيل</label><div class="cred-value-row"><span class="cred-value" style="font-family:monospace;">${escapeHtml(acc.activationCode)}</span><button class="btn-icon copy-cred-btn" data-copy="${escapeAttr(acc.activationCode)}" title="نسخ"><i class="fa-solid fa-copy text-muted"></i></button></div></div>`
            : '';

        document.getElementById('credentialsModalBody').innerHTML =
            `<p style="font-weight:700;margin-bottom:0.5rem;">${escapeHtml(cust ? cust.name : '')} / ${escapeHtml(platform ? platform.name : '')}</p>` +
            `<p class="text-muted" style="font-size:0.82rem;margin-bottom:1rem;">المصدر: ${source}</p>` +
            `<div class="cred-row"><label><i class="fa-solid fa-user fa-fw text-muted"></i> اسم المستخدم / البريد</label><div class="cred-value-row"><span class="cred-value">${escapeHtml(username || '—')}</span>${copyUserBtn}</div></div>` +
            `<div class="cred-row" style="margin-top:0.75rem;"><label><i class="fa-solid fa-key fa-fw text-muted"></i> كلمة المرور</label><div class="cred-value-row"><span class="cred-value" id="credPassDisplay" style="font-family:monospace;">••••••••</span><button class="btn-icon" id="toggleCredPass" title="إظهار/إخفاء"><i class="fa-solid fa-eye text-muted"></i></button>${copyPassBtn}</div></div>` +
            activationRow;

        // Toggle password visibility
        const toggleBtn = document.getElementById('toggleCredPass');
        const passDisplay = document.getElementById('credPassDisplay');
        let passVisible = false;
        if (toggleBtn && passDisplay) {
            toggleBtn.addEventListener('click', () => {
                passVisible = !passVisible;
                passDisplay.textContent = passVisible ? (password || '—') : '••••••••';
                const icon = toggleBtn.querySelector('i');
                if (passVisible) icon.classList.replace('fa-eye', 'fa-eye-slash');
                else icon.classList.replace('fa-eye-slash', 'fa-eye');
            });
        }

        // Copy buttons in cred modal
        document.getElementById('credentialsModalBody').querySelectorAll('.copy-cred-btn').forEach(btn => {
            btn.addEventListener('click', () => appCopy(btn.dataset.copy));
        });

        openModal('credentialsModal');
    }

    // ============================================================
    //  PLATFORMS
    // ============================================================
    function renderPlatforms() {
        const grid = document.getElementById('platformsGrid');
        const platforms = DataManager.getPlatforms();
        grid.innerHTML = '';
        platforms.forEach(p => {
            const div = document.createElement('div');
            div.className = 'platform-card glass-panel';
            div.innerHTML = `
                <div class="icon-wrapper" style="background:${escapeHtml(p.color)};">
                    <i class="${escapeHtml(p.icon)}"></i>
                </div>
                <h3>${escapeHtml(p.name)}</h3>
                <div class="card-actions">
                    <button class="btn-icon edit-plat-btn" data-id="${p.id}" title="تعديل"><i class="fa-solid fa-pen text-info"></i></button>
                    <button class="btn-icon delete-plat-btn" data-id="${p.id}" title="حذف"><i class="fa-solid fa-trash text-danger"></i></button>
                </div>`;
            grid.appendChild(div);
        });
        grid.querySelectorAll('.edit-plat-btn').forEach(btn => {
            btn.addEventListener('click', (e) => { e.stopPropagation(); editPlatform(btn.dataset.id); });
        });
        grid.querySelectorAll('.delete-plat-btn').forEach(btn => {
            btn.addEventListener('click', (e) => { e.stopPropagation(); deletePlatform(btn.dataset.id); });
        });
    }

    // ============================================================
    //  LOOKUPS (Job Titles & Workplaces)
    // ============================================================
    function renderLookups() {
        renderLookupList('jobTitlesList', DataManager.getJobTitles(), 'job');
        renderLookupList('workplacesList', DataManager.getWorkplaces(), 'workplace');
    }

    function renderLookupList(containerId, items, type) {
        const container = document.getElementById(containerId);
        if (!container) return;
        if (items.length === 0) {
            container.innerHTML = '<p class="text-muted text-center" style="padding:0.75rem;">لا توجد عناصر. أضف عنصراً جديداً.</p>';
            return;
        }
        container.innerHTML = items.map((item, i) => `
            <div class="lookup-item">
                <span class="lookup-item-label">${escapeHtml(item)}</span>
                <div class="lookup-item-actions">
                    <button class="btn-icon edit-lookup-btn" data-type="${type}" data-index="${i}" title="تعديل">
                        <i class="fa-solid fa-pen text-info"></i>
                    </button>
                    <button class="btn-icon delete-lookup-btn" data-type="${type}" data-index="${i}" title="حذف">
                        <i class="fa-solid fa-trash text-danger"></i>
                    </button>
                </div>
            </div>
        `).join('');

        container.querySelectorAll('.edit-lookup-btn').forEach(btn => {
            btn.addEventListener('click', () => editLookupItem(btn.dataset.type, parseInt(btn.dataset.index)));
        });
        container.querySelectorAll('.delete-lookup-btn').forEach(btn => {
            btn.addEventListener('click', () => deleteLookupItem(btn.dataset.type, parseInt(btn.dataset.index)));
        });
    }

    function editLookupItem(type, index) {
        const items = type === 'job' ? DataManager.getJobTitles() : DataManager.getWorkplaces();
        const label = type === 'job' ? 'تعديل الوظيفة' : 'تعديل جهة العمل';
        Swal.fire({
            title: label, input: 'text', inputValue: items[index],
            showCancelButton: true, confirmButtonText: 'حفظ', cancelButtonText: 'إلغاء',
            background: '#111827', color: '#fff',
            inputAttributes: { style: 'text-align:right;font-family:Tajawal;direction:rtl;' }
        }).then(result => {
            if (result.isConfirmed && result.value.trim()) {
                if (type === 'job') DataManager.updateJobTitle(index, result.value.trim());
                else DataManager.updateWorkplace(index, result.value.trim());
                renderLookups();
                showToast('تم التحديث بنجاح');
            }
        });
    }

    function deleteLookupItem(type, index) {
        Swal.fire({
            title: 'تأكيد الحذف؟', icon: 'warning',
            showCancelButton: true, confirmButtonColor: '#ef4444',
            confirmButtonText: 'احذف', cancelButtonText: 'إلغاء',
            background: '#111827', color: '#fff'
        }).then(result => {
            if (result.isConfirmed) {
                if (type === 'job') DataManager.deleteJobTitle(index);
                else DataManager.deleteWorkplace(index);
                renderLookups();
                showToast('تم الحذف');
            }
        });
    }

    document.getElementById('btnAddJobTitle').addEventListener('click', () => {
        Swal.fire({
            title: 'إضافة وظيفة جديدة', input: 'text', inputPlaceholder: 'مثال: مستشار، قاضي...',
            showCancelButton: true, confirmButtonText: 'إضافة', cancelButtonText: 'إلغاء',
            background: '#111827', color: '#fff',
            inputAttributes: { style: 'text-align:right;font-family:Tajawal;direction:rtl;' }
        }).then(result => {
            if (result.isConfirmed && result.value.trim()) {
                DataManager.addJobTitle(result.value.trim());
                renderLookups();
                showToast('تمت إضافة الوظيفة');
            }
        });
    });

    document.getElementById('btnAddWorkplace').addEventListener('click', () => {
        Swal.fire({
            title: 'إضافة جهة عمل جديدة', input: 'text', inputPlaceholder: 'مثال: محكمة الاستئناف...',
            showCancelButton: true, confirmButtonText: 'إضافة', cancelButtonText: 'إلغاء',
            background: '#111827', color: '#fff',
            inputAttributes: { style: 'text-align:right;font-family:Tajawal;direction:rtl;' }
        }).then(result => {
            if (result.isConfirmed && result.value.trim()) {
                DataManager.addWorkplace(result.value.trim());
                renderLookups();
                showToast('تمت إضافة جهة العمل');
            }
        });
    });

    // ============================================================
    //  DIRECTORY (دليل المشتركين)
    // ============================================================
    document.getElementById('btnViewDirectory').addEventListener('click', () => {
        renderDirectory();
        openModal('directoryModal');
    });

    document.getElementById('btnPrintDirectory').addEventListener('click', () => {
        window.print();
    });

    function renderDirectory() {
        const customers = DataManager.getCustomers().slice().sort((a, b) => {
            const wa = a.workplace || '';
            const wb = b.workplace || '';
            if (wa !== wb) return wa.localeCompare(wb, 'ar');
            return (a.name || '').localeCompare(b.name || '', 'ar');
        });

        const container = document.getElementById('directoryContent');

        if (customers.length === 0) {
            container.innerHTML = '<p class="text-muted text-center" style="padding:2rem;">لا توجد بيانات مشتركين بعد.</p>';
            return;
        }

        const dateStr = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });

        let html = `
            <div class="directory-meta">
                <span><i class="fa-solid fa-users text-primary"></i> إجمالي المشتركين: <strong>${customers.length}</strong></span>
                <span class="text-muted" style="font-size:0.85rem;">${dateStr}</span>
            </div>
            <table class="directory-table">
                <thead>
                    <tr>
                        <th>م</th>
                        <th>الاسم</th>
                        <th>الوظيفة</th>
                        <th>جهة العمل</th>
                        <th>رقم الهاتف</th>
                    </tr>
                </thead>
                <tbody>
        `;

        customers.forEach((c, i) => {
            html += `<tr>
                <td>${i + 1}</td>
                <td><strong>${escapeHtml(c.name || '-')}</strong></td>
                <td>${escapeHtml(c.job || '-')}</td>
                <td>${escapeHtml(c.workplace || '-')}</td>
                <td class="dir-phone">${escapeHtml(c.phone || '-')}</td>
            </tr>`;
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    }

    // ============================================================
    //  ACCOUNT FORM
    // ============================================================
    document.querySelector('.toggle-password').addEventListener('click', function () {
        const input = document.getElementById('accPassword');
        const icon = this.querySelector('i');
        if (input.type === 'password') { input.type = 'text'; icon.classList.replace('fa-eye', 'fa-eye-slash'); }
        else { input.type = 'password'; icon.classList.replace('fa-eye-slash', 'fa-eye'); }
    });

    function populateCustomersDropdown(selectedId) {
        const select = document.getElementById('accCustomer');
        const customers = DataManager.getCustomers();
        select.innerHTML = '<option value="" disabled>اختر المشترك...</option>';
        customers.forEach(c => {
            const sel = (selectedId && c.id === selectedId) ? ' selected' : '';
            const label = c.phone ? `${c.name} (${c.phone})` : c.name;
            select.innerHTML += `<option value="${c.id}"${sel}>${escapeHtml(label)}</option>`;
        });
        if (!selectedId) select.selectedIndex = 0;
    }

    function populatePlatformsDropdown(selectedId) {
        const select = document.getElementById('accPlatform');
        const platforms = DataManager.getPlatforms();
        select.innerHTML = '<option value="" disabled>اختر الخدمة...</option>';
        platforms.forEach(p => {
            const sel = (selectedId && p.id === selectedId) ? ' selected' : '';
            select.innerHTML += `<option value="${p.id}"${sel}>${escapeHtml(p.name)}</option>`;
        });
        if (!selectedId) select.selectedIndex = 0;
    }

    function populatePlansCheckboxes(selectedIds) {
        const container = document.getElementById('accPlansCheckboxes');
        if (!container) return;
        const plans = DataManager.getServicePlans();
        const selArr = Array.isArray(selectedIds) ? selectedIds : (selectedIds ? [selectedIds] : []);

        let html = `<label class="plan-checkbox-item no-plan-item${selArr.length === 0 ? ' checked' : ''}">
            <input type="checkbox" name="accPlanCb" value="" ${selArr.length === 0 ? 'checked' : ''}>
            <div class="plan-cb-icon" style="background:rgba(255,255,255,0.05);color:var(--text-muted);">
                <i class="fa-solid fa-pen"></i>
            </div>
            <div class="plan-cb-info">
                <strong>بدون خطة (إدخال يدوي)</strong>
            </div>
        </label>`;

        plans.forEach(plan => {
            const platform = DataManager.getPlatformById(plan.platformId);
            const isChecked = selArr.includes(plan.id);
            const label = (plan.name || (platform ? platform.name : 'خطة'));
            const platName = platform ? platform.name : '';
            html += `<label class="plan-checkbox-item${isChecked ? ' checked' : ''}">
                <input type="checkbox" name="accPlanCb" value="${plan.id}" ${isChecked ? 'checked' : ''}>
                <div class="plan-cb-icon" style="background:${platform ? platform.color + '25' : '#33333355'};color:${platform ? platform.color : '#fff'};">
                    <i class="${platform ? escapeHtml(platform.icon) : 'fa-solid fa-server'}"></i>
                </div>
                <div class="plan-cb-info">
                    <strong>${escapeHtml(label)}</strong>
                    <small>${escapeHtml(platName)}</small>
                </div>
                <span class="plan-cb-price">${Number(plan.pricePerMember || 0).toLocaleString('ar-EG')} ج.م</span>
            </label>`;
        });

        container.innerHTML = html;

        // Handle checkbox toggling
        const noPlanCb = container.querySelector('input[value=""]');
        const planCbs = container.querySelectorAll('input[name="accPlanCb"]:not([value=""])');

        noPlanCb.addEventListener('change', () => {
            if (noPlanCb.checked) {
                planCbs.forEach(cb => { cb.checked = false; cb.closest('.plan-checkbox-item').classList.remove('checked'); });
                noPlanCb.closest('.plan-checkbox-item').classList.add('checked');
                handlePlanCheckboxChange();
            } else {
                noPlanCb.checked = true; // can't uncheck without selecting something
            }
        });

        planCbs.forEach(cb => {
            cb.addEventListener('change', () => {
                const anyPlanChecked = Array.from(planCbs).some(c => c.checked);
                if (anyPlanChecked) {
                    noPlanCb.checked = false;
                    noPlanCb.closest('.plan-checkbox-item').classList.remove('checked');
                } else {
                    noPlanCb.checked = true;
                    noPlanCb.closest('.plan-checkbox-item').classList.add('checked');
                }
                cb.closest('.plan-checkbox-item').classList.toggle('checked', cb.checked);
                handlePlanCheckboxChange();
            });
        });
    }

    function getSelectedPlanIds() {
        const container = document.getElementById('accPlansCheckboxes');
        if (!container) return [];
        const checked = container.querySelectorAll('input[name="accPlanCb"]:checked:not([value=""])');
        return Array.from(checked).map(cb => cb.value);
    }

    function handlePlanCheckboxChange() {
        const selectedIds = getSelectedPlanIds();
        const banner = document.getElementById('planInfoBanner');

        if (selectedIds.length === 0) {
            if (banner) banner.style.display = 'none';
            return;
        }

        // Auto-fill from first selected plan
        const plan = DataManager.getServicePlanById(selectedIds[0]);
        if (!plan) return;

        // Auto-fill platform
        if (plan.platformId) populatePlatformsDropdown(plan.platformId);
        // Auto-fill duration
        const durInput = document.getElementById('accDurationDays');
        if (durInput && plan.durationDays) durInput.value = plan.durationDays;
        // Auto-fill revenue (price per member)
        const revInput = document.getElementById('accRevenue');
        if (revInput && plan.pricePerMember) revInput.value = plan.pricePerMember;
        // Auto-fill credentials
        const userInput = document.getElementById('accUsername');
        if (userInput && plan.email) userInput.value = plan.email;
        const passInput = document.getElementById('accPassword');
        if (passInput && plan.password) passInput.value = plan.password;

        // Show banner
        if (banner) {
            const platform = DataManager.getPlatformById(plan.platformId);
            if (selectedIds.length === 1) {
                banner.style.display = 'block';
                banner.innerHTML = `
                    <i class="fa-solid fa-circle-info text-primary"></i>
                    <span>تم تعبئة البيانات من خطة: <strong>${escapeHtml(plan.name || (platform ? platform.name : 'الخطة'))}</strong>
                    — يمكنك تعديل أي حقل.</span>
                `;
            } else {
                banner.style.display = 'block';
                banner.innerHTML = `
                    <i class="fa-solid fa-circle-info text-primary"></i>
                    <span>تم اختيار <strong>${selectedIds.length} خطط</strong>. سيتم إنشاء اشتراك منفصل لكل خطة عند الحفظ.</span>
                `;
            }
        }
    }

    // Quick Add Customer from Account Modal
    document.getElementById('btnQuickAddCustomer').addEventListener('click', () => {
        Swal.fire({
            title: 'إضافة مشترك سريع',
            html: `
                <input id="swal-cust-name" class="swal2-input" placeholder="اسم المشترك" style="text-align:right;font-family:Tajawal;">
                <input id="swal-cust-phone" class="swal2-input" placeholder="رقم الهاتف (اختياري)" style="text-align:right;font-family:Tajawal;">
                <input id="swal-cust-job" class="swal2-input" placeholder="الوظيفة (اختياري)" style="text-align:right;font-family:Tajawal;">
            `,
            showCancelButton: true,
            confirmButtonText: 'إضافة',
            cancelButtonText: 'إلغاء',
            background: '#111827', color: '#fff',
            preConfirm: () => {
                const name = document.getElementById('swal-cust-name').value.trim();
                if (!name) { Swal.showValidationMessage('يرجى كتابة اسم المشترك'); return false; }
                return {
                    name,
                    phone: document.getElementById('swal-cust-phone').value.trim(),
                    job: document.getElementById('swal-cust-job').value.trim()
                };
            }
        }).then(result => {
            if (result.isConfirmed) {
                const newCust = DataManager.addCustomer({ name: result.value.name, phone: result.value.phone, job: result.value.job, workplace: '', notes: '' });
                populateCustomersDropdown(newCust.id);
                showToast('تم إضافة المشترك');
            }
        });
    });

    // ---- Open account form for a specific customer ----
    function openNewAccountForCustomer(customerId) {
        const cust = DataManager.getCustomerById(customerId);
        if (!cust) return;

        document.getElementById('accountForm').reset();
        document.getElementById('accId').value = '';
        document.getElementById('accountModalTitle').innerText = 'إضافة اشتراك — ' + cust.name;
        document.getElementById('accStartDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('accDurationDays').value = 30;
        document.getElementById('accRevenue').value = 0;
        document.getElementById('accRefund').value = 0;

        const banner = document.getElementById('planInfoBanner');
        if (banner) banner.style.display = 'none';

        const isPaidCheck = document.getElementById('accIsPaid');
        if (isPaidCheck) isPaidCheck.checked = false;

        // Show customer banner
        const custBanner = document.getElementById('accCustomerBanner');
        const custBannerText = document.getElementById('accCustomerBannerText');
        if (custBanner && custBannerText) {
            custBanner.style.display = 'flex';
            custBannerText.innerHTML = `المشترك: <strong>${escapeHtml(cust.name)}</strong>${cust.phone ? ' — ' + escapeHtml(cust.phone) : ''}`;
        }

        // Pre-select and lock customer
        populateCustomersDropdown(customerId);
        const custSelect = document.getElementById('accCustomer');
        if (custSelect) custSelect.disabled = true;
        const quickAddBtn = document.getElementById('btnQuickAddCustomer');
        if (quickAddBtn) quickAddBtn.style.display = 'none';

        populatePlatformsDropdown();
        populatePlansCheckboxes([]);
        openModal('accountModal');
    }

    // New Account (generic — no customer pre-selected)
    btnNewAccount.addEventListener('click', () => {
        document.getElementById('accountForm').reset();
        document.getElementById('accId').value = '';
        document.getElementById('accountModalTitle').innerText = 'إضافة اشتراك جديد';
        document.getElementById('accStartDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('accDurationDays').value = 30;
        document.getElementById('accRevenue').value = 0;
        document.getElementById('accRefund').value = 0;

        const banner = document.getElementById('planInfoBanner');
        if (banner) banner.style.display = 'none';

        const isPaidCheck = document.getElementById('accIsPaid');
        if (isPaidCheck) isPaidCheck.checked = false;

        // Hide customer banner and unlock customer selector
        const custBanner = document.getElementById('accCustomerBanner');
        if (custBanner) custBanner.style.display = 'none';
        const custSelect = document.getElementById('accCustomer');
        if (custSelect) custSelect.disabled = false;
        const quickAddBtn = document.getElementById('btnQuickAddCustomer');
        if (quickAddBtn) quickAddBtn.style.display = '';

        const customers = DataManager.getCustomers();
        if (customers.length === 0) {
            Swal.fire({
                icon: 'info', title: 'أضف مشترك أولاً',
                text: 'يجب إضافة مشترك واحد على الأقل قبل تسجيل اشتراك جديد.',
                showCancelButton: true,
                confirmButtonText: 'أضف مشترك الآن',
                cancelButtonText: 'إلغاء',
                background: '#111827', color: '#fff'
            }).then(r => {
                if (r.isConfirmed) openNewCustomerModal();
            });
            return;
        }

        populateCustomersDropdown();
        populatePlatformsDropdown();
        populatePlansCheckboxes([]);
        openModal('accountModal');
    });

    // Save Account
    document.getElementById('btnSaveAccount').addEventListener('click', async (e) => {
        e.preventDefault();
        const customerId = document.getElementById('accCustomer').value;
        const platformId = document.getElementById('accPlatform').value;
        const startDate = document.getElementById('accStartDate').value;
        const durationDays = document.getElementById('accDurationDays').value;
        const revenue = document.getElementById('accRevenue').value;

        if (!customerId || !platformId || !startDate || !durationDays || revenue === '') {
            Swal.fire({ icon: 'error', title: 'بيانات ناقصة', text: 'يرجى إكمال الحقول الإلزامية المميزة بعلامة *', confirmButtonText: 'حسناً', background: '#111827', color: '#fff' });
            return;
        }

        const isPaidCheck = document.getElementById('accIsPaid');
        const accId = document.getElementById('accId').value;
        const selectedPlanIds = getSelectedPlanIds();

        const baseData = {
            customerId,
            platformId,
            username: document.getElementById('accUsername').value.trim(),
            password: document.getElementById('accPassword').value,
            startDate,
            durationDays,
            revenue,
            refund: document.getElementById('accRefund').value || '0',
            activationCode: document.getElementById('accActivationCode').value.trim(),
            notes: document.getElementById('accNotes').value.trim(),
            isPaid: isPaidCheck ? isPaidCheck.checked : false
        };

        if (accId) {
            // EDITING existing subscription
            baseData.id = accId;
            baseData.servicePlanId = selectedPlanIds.length > 0 ? selectedPlanIds[0] : '';
            await DataManager.updateAccount(baseData);
            showToast('تم تحديث بيانات الاشتراك بنجاح');
        } else {
            // CREATING new subscription(s)
            if (selectedPlanIds.length > 1) {
                // Multi-plan: create one subscription per plan
                for (const planId of selectedPlanIds) {
                    const plan = DataManager.getServicePlanById(planId);
                    const accountData = { ...baseData };
                    accountData.servicePlanId = planId;
                    if (plan) {
                        accountData.platformId = plan.platformId || platformId;
                        accountData.durationDays = plan.durationDays || durationDays;
                        accountData.revenue = plan.pricePerMember || revenue;
                        if (plan.email) accountData.username = plan.email;
                        if (plan.password) accountData.password = plan.password;
                    }
                    await DataManager.addAccount(accountData);
                }
                showToast(`تم إضافة ${selectedPlanIds.length} اشتراكات بنجاح`);
            } else {
                // Single plan or no plan
                baseData.servicePlanId = selectedPlanIds.length === 1 ? selectedPlanIds[0] : '';
                await DataManager.addAccount(baseData);
                showToast('تم إضافة الاشتراك بنجاح');
            }
        }

        // Reset customer dropdown disabled state
        const custSelectAfterSave = document.getElementById('accCustomer');
        if (custSelectAfterSave) custSelectAfterSave.disabled = false;
        const quickAddBtnAfterSave = document.getElementById('btnQuickAddCustomer');
        if (quickAddBtnAfterSave) quickAddBtnAfterSave.style.display = '';
        const custBannerAfterSave = document.getElementById('accCustomerBanner');
        if (custBannerAfterSave) custBannerAfterSave.style.display = 'none';

        closeModal('accountModal');
        renderAccounts();
        renderCustomers();
        checkNotifications();
        if (document.getElementById('view-dashboard').classList.contains('active')) renderDashboard();
        if (document.getElementById('view-plans').classList.contains('active')) renderPlans();
    });

    function editAccount(id) {
        const acc = DataManager.getAccounts().find(a => a.id === id);
        if (!acc) return;

        // Reset customer state
        const custBanner = document.getElementById('accCustomerBanner');
        if (custBanner) custBanner.style.display = 'none';
        const custSelect = document.getElementById('accCustomer');
        if (custSelect) custSelect.disabled = false;
        const quickAddBtn = document.getElementById('btnQuickAddCustomer');
        if (quickAddBtn) quickAddBtn.style.display = '';

        populateCustomersDropdown(acc.customerId);
        populatePlatformsDropdown(acc.platformId);
        populatePlansCheckboxes(acc.servicePlanId ? [acc.servicePlanId] : []);

        document.getElementById('accId').value = acc.id;
        document.getElementById('accUsername').value = acc.username || '';
        document.getElementById('accPassword').value = acc.password || '';
        document.getElementById('accStartDate').value = acc.startDate;
        document.getElementById('accDurationDays').value = acc.durationDays || 30;
        document.getElementById('accRevenue').value = acc.revenue || 0;
        document.getElementById('accRefund').value = acc.refund || 0;
        document.getElementById('accActivationCode').value = acc.activationCode || '';
        document.getElementById('accNotes').value = acc.notes || '';
        document.getElementById('accountModalTitle').innerText = 'تعديل بيانات الاشتراك';

        const isPaidCheck = document.getElementById('accIsPaid');
        if (isPaidCheck) isPaidCheck.checked = acc.isPaid === true;

        // Show plan banner if a plan is linked
        const banner = document.getElementById('planInfoBanner');
        if (banner) {
            if (acc.servicePlanId) {
                const plan = DataManager.getServicePlanById(acc.servicePlanId);
                const platform = plan ? DataManager.getPlatformById(plan.platformId) : null;
                banner.style.display = 'block';
                banner.innerHTML = `
                    <i class="fa-solid fa-circle-info text-primary"></i>
                    <span>مرتبط بخطة: <strong>${escapeHtml(plan ? (plan.name || (platform ? platform.name : 'الخطة')) : '')}</strong></span>
                `;
            } else {
                banner.style.display = 'none';
            }
        }

        openModal('accountModal');
    }

    function deleteAccount(id) {
        Swal.fire({
            title: 'هل أنت متأكد؟', text: 'لن تتمكن من استرجاع بيانات هذا الاشتراك!',
            icon: 'warning', showCancelButton: true,
            confirmButtonColor: '#ef4444', cancelButtonColor: '#6b7280',
            confirmButtonText: 'نعم، احذف', cancelButtonText: 'إلغاء',
            background: '#111827', color: '#fff'
        }).then(result => {
            if (result.isConfirmed) {
                DataManager.deleteAccount(id);
                renderAccounts();
                checkNotifications();
                if (document.getElementById('view-dashboard').classList.contains('active')) renderDashboard();
                showToast('تم حذف الاشتراك بنجاح');
            }
        });
    }

    // ============================================================
    //  PLATFORM FORM
    // ============================================================
    const platColorPicker = document.getElementById('platColor');
    const platColorText = document.getElementById('platColorText');
    const platIcon = document.getElementById('platIcon');
    const platNameInput = document.getElementById('platName');

    platColorPicker.addEventListener('input', (e) => { platColorText.value = e.target.value; updatePlatformPreview(); });
    platColorText.addEventListener('input', (e) => {
        if (/^#[0-9A-F]{6}$/i.test(e.target.value)) platColorPicker.value = e.target.value;
        updatePlatformPreview();
    });
    platIcon.addEventListener('input', updatePlatformPreview);
    platNameInput.addEventListener('input', updatePlatformPreview);

    function updatePlatformPreview() {
        const preview = document.getElementById('platformPreview');
        const color = platColorPicker.value;
        const icon = platIcon.value || 'fa-solid fa-star';
        const name = platNameInput.value || 'اسم الخدمة';
        preview.innerHTML = `<div class="icon-wrapper" style="background:${color};"><i class="${escapeHtml(icon)}"></i></div><span>${escapeHtml(name)}</span>`;
    }

    btnNewPlatform.addEventListener('click', () => {
        document.getElementById('platformForm').reset();
        document.getElementById('platId').value = '';
        document.getElementById('platColor').value = '#6366f1';
        document.getElementById('platColorText').value = '#6366f1';
        document.getElementById('platIcon').value = 'fa-solid fa-star';
        document.getElementById('platformModalTitle').innerText = 'إضافة خدمة جديدة';
        updatePlatformPreview();
        openModal('platformModal');
    });

    document.getElementById('btnSavePlatform').addEventListener('click', (e) => {
        e.preventDefault();
        const name = document.getElementById('platName').value.trim();
        const icon = document.getElementById('platIcon').value.trim() || 'fa-solid fa-star';
        const color = document.getElementById('platColor').value;
        const platId = document.getElementById('platId').value;

        if (!name) { Swal.fire({ icon: 'error', title: 'خطأ', text: 'يرجى كتابة اسم الخدمة', background: '#111827', color: '#fff' }); return; }

        if (platId) { DataManager.updatePlatform({ id: platId, name, icon, color }); showToast('تم تحديث الخدمة بنجاح'); }
        else { DataManager.addPlatform({ name, icon, color }); showToast('تمت إضافة الخدمة بنجاح'); }

        closeModal('platformModal');
        renderPlatforms();
    });

    function editPlatform(id) {
        const p = DataManager.getPlatformById(id);
        if (!p) return;
        document.getElementById('platId').value = p.id;
        document.getElementById('platName').value = p.name;
        document.getElementById('platIcon').value = p.icon;
        document.getElementById('platColor').value = p.color;
        document.getElementById('platColorText').value = p.color;
        document.getElementById('platformModalTitle').innerText = 'تعديل الخدمة';
        updatePlatformPreview();
        openModal('platformModal');
    }

    function deletePlatform(id) {
        const accountsUsingIt = DataManager.getAccounts().some(a => a.platformId === id);
        if (accountsUsingIt) {
            Swal.fire({ icon: 'error', title: 'غير ممكن', text: 'لا يمكن حذف هذه الخدمة لوجود حسابات مرتبطة بها.', background: '#111827', color: '#fff' });
            return;
        }
        Swal.fire({
            title: 'تأكيد حذف الخدمة؟', icon: 'warning',
            showCancelButton: true, confirmButtonColor: '#ef4444',
            confirmButtonText: 'احذف', cancelButtonText: 'إلغاء',
            background: '#111827', color: '#fff'
        }).then(result => {
            if (result.isConfirmed) { DataManager.deletePlatform(id); renderPlatforms(); showToast('تم حذف الخدمة'); }
        });
    }

    // ============================================================
    //  EXPORT / IMPORT
    // ============================================================
    document.getElementById('btnExportData').addEventListener('click', () => {
        const data = DataManager.exportData();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `submaster_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('تم تصدير البيانات بنجاح');
    });

    document.getElementById('btnImportData').addEventListener('click', () => {
        document.getElementById('importFileInput').click();
    });

    document.getElementById('importFileInput').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        Swal.fire({
            title: 'استيراد بيانات', text: 'سيتم استبدال البيانات الحالية. هل تريد المتابعة؟',
            icon: 'warning', showCancelButton: true,
            confirmButtonText: 'نعم، استورد', cancelButtonText: 'إلغاء',
            background: '#111827', color: '#fff'
        }).then(result => {
            if (result.isConfirmed) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const success = DataManager.importData(ev.target.result);
                    if (success) { showToast('تم استيراد البيانات بنجاح'); renderDashboard(); renderAccounts(); renderPlatforms(); renderCustomers(); }
                    else { Swal.fire({ icon: 'error', title: 'خطأ', text: 'فشل في قراءة ملف البيانات.', background: '#111827', color: '#fff' }); }
                };
                reader.readAsText(file);
            }
            e.target.value = '';
        });
    });

    // ============================================================
    //  UTILITIES
    // ============================================================
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function escapeAttr(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function appCopy(text) {
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            showToast('تم النسخ للحافظة');
        }).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta); ta.select(); document.execCommand('copy');
            document.body.removeChild(ta);
            showToast('تم النسخ للحافظة');
        });
    }

    function showToast(message) {
        Swal.fire({
            toast: true, position: 'top-end', icon: 'success',
            title: message, showConfirmButton: false, timer: 1800,
            background: '#111827', color: '#fff', timerProgressBar: true
        });
    }

    // ============================================================
    //  INITIAL RENDER
    // ============================================================
    renderDashboard();
    checkNotifications();

    // SERVICE WORKER
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW registered:', reg.scope))
            .catch(err => console.warn('SW registration failed:', err));
    }
});
