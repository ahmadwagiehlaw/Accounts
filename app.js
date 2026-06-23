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

    function bindNotificationActions(container) {
        if (!container) return;
        container.querySelectorAll('.notif-renew-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const acc = DataManager.getAccounts().find(a => a.id === btn.dataset.id);
                if (acc && acc.billingCycle === 'monthly') renewMonthlyAccountFromUi(btn.dataset.id);
                else renewAccountFromUi(btn.dataset.id);
            });
        });
        container.querySelectorAll('.notif-close-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                closeAccountFromUi(btn.dataset.id);
            });
        });
        container.querySelectorAll('.notif-whatsapp-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openWhatsAppAccount(btn.dataset.id);
            });
        });
    }

    function triggerDailyLocalNotification(total) {
        if ('Notification' in window) {
            if (Notification.permission === 'default') {
                Notification.requestPermission();
            }
            if (Notification.permission === 'granted') {
                const notifiedKey = 'submaster_notified_' + new Date().toDateString();
                if (!localStorage.getItem(notifiedKey)) {
                    new Notification('SubMaster - تنبيهات الاشتراكات', {
                        body: `لديك ${total} اشتراك بحاجة للمتابعة (منتهية أو قاربت على الانتهاء).`,
                        icon: 'assets/icon-192x192.png'
                    });
                    localStorage.setItem(notifiedKey, 'true');
                }
            }
        }
    }

    function buildFollowUpNotificationGroups(accounts = DataManager.getAccounts()) {
        const actionableAccounts = accounts.filter(acc => {
            const status = DataManager.getAccountStatus(acc).status;
            return !['closed', 'paused', 'cancelled'].includes(status);
        });
        const renewalActionableAccounts = actionableAccounts.filter(acc => !isRenewalStopped(acc));
        const expired = renewalActionableAccounts.filter(acc => DataManager.getAccountStatus(acc).status === 'expired');
        const warningAll = renewalActionableAccounts.filter(acc => DataManager.getAccountStatus(acc).status === 'warning');
        const urgentWarning = warningAll.filter(acc => {
            const daysLeft = DataManager.getAccountStatus(acc).daysLeft;
            return daysLeft !== null && daysLeft !== undefined && daysLeft <= 5;
        });
        const warning = warningAll.filter(acc => {
            const daysLeft = DataManager.getAccountStatus(acc).daysLeft;
            return daysLeft !== null && daysLeft !== undefined && daysLeft > 5;
        });
        const needsReview = renewalActionableAccounts.filter(acc => DataManager.getAccountStatus(acc).status === 'needs_review');
        const unpaid = actionableAccounts.filter(acc => acc.isPaid !== true);
        const urgent = [...expired, ...needsReview, ...urgentWarning];
        const uniqueIds = new Set([...urgent, ...warning, ...unpaid].map(acc => acc.id));
        return {
            urgent,
            expired,
            warning,
            urgentWarning,
            needsReview,
            unpaid,
            total: uniqueIds.size
        };
    }

    function isRenewalStopped(acc) {
        return acc && (
            acc.renewalIntent === 'cancel_at_period_end' ||
            acc.cancelAtPeriodEnd === true ||
            acc.autoRenew === false
        );
    }

    function updateHeaderNotificationBadge(groups = buildFollowUpNotificationGroups()) {
        const badge = document.getElementById('notificationBellBadge');
        const button = document.getElementById('btnNotificationCenter');
        if (!badge || !button) return;

        const total = groups.total;
        button.classList.toggle('has-alerts', total > 0);
        button.classList.toggle('has-expired', groups.urgent.length > 0);
        button.classList.toggle('has-warning', groups.urgent.length === 0 && groups.warning.length > 0);

        if (total === 0) {
            badge.style.display = 'none';
            badge.textContent = '0';
            return;
        }

        badge.style.display = 'inline-flex';
        badge.textContent = total > 99 ? '99+' : String(total);
    }

    function getDefaultNotificationTab(groups) {
        if (groups.urgent.length > 0) return 'urgent';
        if (groups.warning.length > 0) return 'warning';
        if (groups.unpaid.length > 0) return 'unpaid';
        return 'urgent';
    }

    function renderNotificationCenterPanel() {
        const modal = document.getElementById('notificationCenterModal');
        const list = document.getElementById('notificationCenterList');
        if (!modal || !list) return;

        const groups = buildFollowUpNotificationGroups();
        updateHeaderNotificationBadge(groups);

        document.getElementById('notification-urgent-count').textContent = groups.urgent.length;
        document.getElementById('notification-warning-count').textContent = groups.warning.length;
        document.getElementById('notification-unpaid-count').textContent = groups.unpaid.length;

        let selectedTab = modal.dataset.activeTab;
        if (!selectedTab || !groups[selectedTab] || groups[selectedTab].length === 0) {
            selectedTab = getDefaultNotificationTab(groups);
        }
        modal.dataset.activeTab = selectedTab;

        modal.querySelectorAll('[data-notification-tab]').forEach(tab => {
            const isActive = tab.dataset.notificationTab === selectedTab;
            tab.classList.toggle('active', isActive);
            if (!tab.hasAttribute('data-bound')) {
                tab.setAttribute('data-bound', 'true');
                tab.addEventListener('click', () => {
                    modal.dataset.activeTab = tab.dataset.notificationTab;
                    renderNotificationCenterPanel();
                });
            }
        });

        list.innerHTML = renderFollowUpItems(groups[selectedTab], selectedTab);
        bindFollowUpActions(modal);
    }

    function openNotificationCenter() {
        renderNotificationCenterPanel();
        openModal('notificationCenterModal');
    }

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
        window.isDataLoaded = true;
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

    const btnRepairAccountPlatforms = document.getElementById('btnRepairAccountPlatforms');

    if (btnDisplaySettings) {
        btnDisplaySettings.addEventListener('click', () => {
            openModal('settingsModal');
        });
    }

    if (btnRepairAccountPlatforms) {
        btnRepairAccountPlatforms.innerHTML = '<i class="fa-solid fa-screwdriver-wrench"></i> إصلاح أسماء الخدمات في الاشتراكات';
        btnRepairAccountPlatforms.addEventListener('click', async () => {
            const res = await Swal.fire({
                title: 'إصلاح أسماء الخدمات؟',
                text: 'سيتم فقط تحديث الاشتراكات المرتبطة بخطة لتستخدم نفس خدمة الخطة. لن يتم دمج أو حذف أي خدمة.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'إصلاح الآن',
                cancelButtonText: 'إلغاء'
            });
            if (res.isConfirmed) {
                const count = await DataManager.repairAccountPlatformsFromPlans();
                renderAccounts();
                renderPlans();
                renderDashboard();
                checkNotifications();
                Swal.fire({
                    icon: 'success',
                    title: 'تم الإصلاح',
                    text: count > 0 ? `تم تحديث ${count} اشتراك.` : 'لا توجد اشتراكات تحتاج إلى إصلاح.',
                    background: '#111827',
                    color: '#fff'
                });
            }
        });
    }

    enhanceSettingsModal();

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

    function enhanceSettingsModal() {
        const modal = document.getElementById('settingsModal');
        if (!modal || modal.dataset.enhanced === 'true') return;

        const content = modal.querySelector('.modal-content');
        const title = modal.querySelector('.modal-header h3');
        const body = modal.querySelector('.modal-body');
        const settingsList = modal.querySelector('.settings-list');
        const repairBtn = document.getElementById('btnRepairAccountPlatforms');
        if (!content || !body || !settingsList || !repairBtn) return;

        modal.dataset.enhanced = 'true';
        content.classList.add('settings-modal-content');
        body.classList.add('settings-modal-body');
        if (title) title.textContent = 'الإعدادات وأدوات الإدارة';

        const oldDivider = repairBtn.previousElementSibling;
        if (oldDivider && oldDivider.tagName === 'HR') oldDivider.remove();

        const tabs = document.createElement('div');
        tabs.className = 'settings-tabs';
        tabs.innerHTML = `
            <button class="settings-tab active" type="button" data-settings-tab="display">
                <i class="fa-solid fa-sliders"></i><span>العرض</span>
            </button>
            <button class="settings-tab" type="button" data-settings-tab="alerts">
                <i class="fa-solid fa-bell"></i><span>المتابعة</span>
            </button>
            <button class="settings-tab" type="button" data-settings-tab="tools">
                <i class="fa-solid fa-screwdriver-wrench"></i><span>الأدوات</span>
            </button>`;

        const displayPanel = document.createElement('div');
        displayPanel.className = 'settings-panel active';
        displayPanel.dataset.settingsPanel = 'display';
        settingsList.classList.add('compact-settings-list');
        displayPanel.appendChild(settingsList);

        const alertsPanel = document.createElement('div');
        alertsPanel.className = 'settings-panel';
        alertsPanel.dataset.settingsPanel = 'alerts';
        alertsPanel.innerHTML = `
            <div class="settings-note">
                <i class="fa-solid fa-circle-info text-info"></i>
                <div>
                    <strong>مركز المتابعة الحالي</strong>
                    <span>يعرض الاشتراكات المنتهية، القريبة من الانتهاء، غير المسددة، والحالات التي تحتاج مراجعة.</span>
                </div>
            </div>
            <div class="settings-note">
                <i class="fa-solid fa-calendar-days text-warning"></i>
                <div>
                    <strong>نافذة قرب الانتهاء</strong>
                    <span>الحد الحالي مضبوط على 14 يوم ويستخدم في التنبيهات ومركز المتابعة.</span>
                </div>
            </div>`;

        const toolsPanel = document.createElement('div');
        toolsPanel.className = 'settings-panel';
        toolsPanel.dataset.settingsPanel = 'tools';
        const toolbox = document.createElement('div');
        toolbox.className = 'settings-toolbox';
        repairBtn.classList.add('settings-wide-action');
        repairBtn.removeAttribute('style');
        toolbox.appendChild(repairBtn);
        toolbox.insertAdjacentHTML('beforeend', '<p class="settings-helper-text">هذه الأداة تصلح ربط الاشتراكات بالخدمة الموجودة في الخطة فقط، ولا تدمج أو تحذف أي خدمة.</p>');
        toolsPanel.appendChild(toolbox);

        body.innerHTML = '';
        body.appendChild(tabs);
        body.appendChild(displayPanel);
        body.appendChild(alertsPanel);
        body.appendChild(toolsPanel);

        tabs.addEventListener('click', (e) => {
            const tab = e.target.closest('[data-settings-tab]');
            if (!tab) return;
            const target = tab.dataset.settingsTab;
            tabs.querySelectorAll('.settings-tab').forEach(btn => btn.classList.toggle('active', btn === tab));
            body.querySelectorAll('[data-settings-panel]').forEach(panel => {
                panel.classList.toggle('active', panel.dataset.settingsPanel === target);
            });
        });
    }

    // ============================================================
    //  NAVIGATION
    // ============================================================
    setupFinancialLedgerView();

    function setupFinancialLedgerView() {
        const viewsContainer = document.querySelector('.views-container');
        if (viewsContainer && !document.getElementById('view-financial-ledger')) {
            const section = document.createElement('section');
            section.id = 'view-financial-ledger';
            section.className = 'view';
            section.innerHTML = `
                <div class="financial-ledger-page">
                    <div class="ledger-empty">جار تحميل كشف المعاملات...</div>
                </div>
            `;
            viewsContainer.appendChild(section);
        }

        const sidebarNav = document.querySelector('.sidebar-nav');
        if (sidebarNav && !sidebarNav.querySelector('[data-view="financial-ledger"]')) {
            const item = document.createElement('a');
            item.href = '#';
            item.className = 'nav-item';
            item.dataset.view = 'financial-ledger';
            item.innerHTML = '<i class="fa-solid fa-receipt"></i><span>كشف المعاملات</span>';
            const platformsItem = sidebarNav.querySelector('[data-view="platforms"]');
            sidebarNav.insertBefore(item, platformsItem || null);
            item.addEventListener('click', (e) => {
                e.preventDefault();
                navigateToView('financial-ledger', 'كشف المعاملات');
            });
        }
    }

    function navigateToView(viewId, title = '') {
        document.querySelectorAll('.nav-item').forEach(nav => {
            nav.classList.toggle('active', nav.getAttribute('data-view') === viewId);
            if (!title && nav.getAttribute('data-view') === viewId) {
                title = nav.querySelector('span')?.innerText || title;
            }
        });

        const bNavItems = document.querySelectorAll('.b-nav-item');
        bNavItems.forEach(nav => nav.classList.toggle('active', nav.getAttribute('data-view') === viewId));

        if (pageTitle) pageTitle.innerText = title || pageTitle.innerText;
        document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
        const view = document.getElementById(`view-${viewId}`);
        if (view) view.classList.add('active');
        closeMobileSidebar();
        refreshView(viewId);
    }

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const viewId = item.getAttribute('data-view');
            navigateToView(viewId, item.querySelector('span').innerText);
        });
    });

    // ---- Bottom Nav ----
    const bNavItems = document.querySelectorAll('.b-nav-item');
    bNavItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const viewId = item.getAttribute('data-view');

            navigateToView(viewId);
        });
    });

    function refreshView(viewId) {
        if (viewId === 'dashboard') renderDashboard();
        if (viewId === 'customers') renderCustomers();
        if (viewId === 'accounts') renderAccounts();
        if (viewId === 'plans') renderPlans();
        if (viewId === 'platforms') { renderPlatforms(); renderLookups(); }
        if (viewId === 'financial-ledger') renderFinancialLedgerPage();
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

    function openModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.add('show');
        resetModalFormTabs(modal);
    }
    function closeModal(id) { document.getElementById(id).classList.remove('show'); }

    function resetModalFormTabs(modal) {
        const firstTab = modal.querySelector('.modal-form-tab');
        if (firstTab) setActiveFormTab(firstTab.closest('form'), firstTab.dataset.formTab);
    }

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

    const btnNotificationCenter = document.getElementById('btnNotificationCenter');
    if (btnNotificationCenter) {
        btnNotificationCenter.addEventListener('click', openNotificationCenter);
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

        const groups = buildFollowUpNotificationGroups();
        const expired = groups.expired;
        const expiring = groups.warning;
        const total = expired.length + expiring.length;
        updateHeaderNotificationBadge(groups);

        if (document.getElementById('btnNotificationCenter')) {
            bar.style.display = 'none';
            if (document.getElementById('notificationCenterModal')?.classList.contains('show')) {
                renderNotificationCenterPanel();
            }
            return;
        }

        if (total === 0) {
            bar.style.display = 'none';
            if (document.getElementById('notificationCenterModal')?.classList.contains('show')) {
                renderNotificationCenterPanel();
            }
            return;
        }

        bar.style.display = 'flex';
        let notificationHtml = '';

        expired.forEach(acc => {
            const cust = DataManager.getCustomerById(acc.customerId);
            const platform = DataManager.getPlatformById(acc.platformId);
            const custName = cust ? cust.name : (acc.customerName || 'عميل');
            const platName = platform ? platform.name : '';
            const hasPhone = !!(cust && cust.phone) || !!acc.customerPhone;
            notificationHtml += `<span class="notif-item notif-expired">
                <i class="fa-solid fa-circle-xmark"></i>
                <strong>${escapeHtml(custName)}</strong> — ${escapeHtml(platName)}: انتهى الاشتراك
                <span class="notif-actions">
                    <button class="notif-action-btn notif-renew-btn" data-id="${escapeAttr(acc.id)}" type="button">تجديد</button>
                    <button class="notif-action-btn notif-close-btn" data-id="${escapeAttr(acc.id)}" type="button">إغلاق</button>
                    ${hasPhone ? `<button class="notif-action-btn notif-whatsapp-btn" data-id="${escapeAttr(acc.id)}" type="button"><i class="fa-brands fa-whatsapp"></i></button>` : ''}
                </span>
            </span>`;
        });

        expiring.forEach(acc => {
            const status = DataManager.getAccountStatus(acc);
            const cust = DataManager.getCustomerById(acc.customerId);
            const platform = DataManager.getPlatformById(acc.platformId);
            const custName = cust ? cust.name : (acc.customerName || 'عميل');
            const platName = platform ? platform.name : '';
            const hasPhone = !!(cust && cust.phone) || !!acc.customerPhone;
            notificationHtml += `<span class="notif-item notif-warning">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <strong>${escapeHtml(custName)}</strong> — ${escapeHtml(platName)}: يتبقى ${status.daysLeft} يوم
                <span class="notif-actions">
                    <button class="notif-action-btn notif-renew-btn" data-id="${escapeAttr(acc.id)}" type="button">تجديد</button>
                    ${hasPhone ? `<button class="notif-action-btn notif-whatsapp-btn" data-id="${escapeAttr(acc.id)}" type="button"><i class="fa-brands fa-whatsapp"></i></button>` : ''}
                </span>
            </span>`;
        });

        list.innerHTML = notificationHtml;
        bindNotificationActions(list);
        if (document.getElementById('notificationCenterModal')?.classList.contains('show')) {
            renderNotificationCenterPanel();
        }
        triggerDailyLocalNotification(total);
        return;

        bar.style.display = 'flex';
        let html = '';

        expired.forEach(n => {
            const acc = DataManager.getAccounts().find(a => a.id === n.id);
            const cust = acc ? DataManager.getCustomerById(acc.customerId) : null;
            const hasPhone = !!(cust && cust.phone) || !!(acc && acc.customerPhone);
            html += `<span class="notif-item notif-expired">
                <i class="fa-solid fa-circle-xmark"></i>
                <strong>${escapeHtml(n.custName)}</strong> — ${escapeHtml(n.platName)}: انتهى الاشتراك
            </span>`;
        });

        expiring.forEach(n => {
            const acc = DataManager.getAccounts().find(a => a.id === n.id);
            const cust = acc ? DataManager.getCustomerById(acc.customerId) : null;
            const hasPhone = !!(cust && cust.phone) || !!(acc && acc.customerPhone);
            html += `<span class="notif-item notif-warning">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <strong>${escapeHtml(n.custName)}</strong> — ${escapeHtml(n.platName)}: يتبقى ${n.daysLeft} يوم
                <span class="notif-actions">
                    <button class="notif-action-btn notif-renew-btn" data-id="${escapeAttr(n.id)}" type="button">تجديد</button>
                    ${hasPhone ? `<button class="notif-action-btn notif-whatsapp-btn" data-id="${escapeAttr(n.id)}" type="button"><i class="fa-brands fa-whatsapp"></i></button>` : ''}
                </span>
            </span>`;
        });

        expired.forEach(n => {
            const acc = DataManager.getAccounts().find(a => a.id === n.id);
            const cust = acc ? DataManager.getCustomerById(acc.customerId) : null;
            const hasPhone = !!(cust && cust.phone) || !!(acc && acc.customerPhone);
            html += `<span class="notif-actions notif-action-group">
                <button class="notif-action-btn notif-renew-btn" data-id="${escapeAttr(n.id)}" type="button">تجديد</button>
                <button class="notif-action-btn notif-close-btn" data-id="${escapeAttr(n.id)}" type="button">إغلاق</button>
                ${hasPhone ? `<button class="notif-action-btn notif-whatsapp-btn" data-id="${escapeAttr(n.id)}" type="button"><i class="fa-brands fa-whatsapp"></i></button>` : ''}
                <span class="notif-actions">
                    <button class="notif-action-btn notif-renew-btn" data-id="${escapeAttr(n.id)}" type="button">تجديد</button>
                    <button class="notif-action-btn notif-close-btn" data-id="${escapeAttr(n.id)}" type="button">إغلاق</button>
                    ${hasPhone ? `<button class="notif-action-btn notif-whatsapp-btn" data-id="${escapeAttr(n.id)}" type="button"><i class="fa-brands fa-whatsapp"></i></button>` : ''}
                </span>
                <span class="notif-actions">
                    <button class="notif-action-btn notif-renew-btn" data-id="${escapeAttr(n.id)}" type="button">تجديد</button>
                    ${hasPhone ? `<button class="notif-action-btn notif-whatsapp-btn" data-id="${escapeAttr(n.id)}" type="button"><i class="fa-brands fa-whatsapp"></i></button>` : ''}
                </span>
                <span class="notif-actions">
                    <button class="notif-action-btn notif-renew-btn" data-id="${escapeAttr(n.id)}" type="button">تجديد</button>
                    <button class="notif-action-btn notif-close-btn" data-id="${escapeAttr(n.id)}" type="button">إغلاق</button>
                    ${hasPhone ? `<button class="notif-action-btn notif-whatsapp-btn" data-id="${escapeAttr(n.id)}" type="button"><i class="fa-brands fa-whatsapp"></i></button>` : ''}
                </span>
            </span>`;
        });

        expiring.forEach(n => {
            const acc = DataManager.getAccounts().find(a => a.id === n.id);
            const cust = acc ? DataManager.getCustomerById(acc.customerId) : null;
            const hasPhone = !!(cust && cust.phone) || !!(acc && acc.customerPhone);
            html += `<span class="notif-actions notif-action-group">
                <button class="notif-action-btn notif-renew-btn" data-id="${escapeAttr(n.id)}" type="button">تجديد</button>
                ${hasPhone ? `<button class="notif-action-btn notif-whatsapp-btn" data-id="${escapeAttr(n.id)}" type="button"><i class="fa-brands fa-whatsapp"></i></button>` : ''}
            </span>`;
        });

        list.innerHTML = html;
        bindNotificationActions();

        // Trigger Local OS Notification once per day if enabled
        if ('Notification' in window) {
            if (Notification.permission === 'default') {
                Notification.requestPermission();
            }
            if (Notification.permission === 'granted') {
                const notifiedKey = 'submaster_notified_' + new Date().toDateString();
                if (!localStorage.getItem(notifiedKey)) {
                    new Notification('SubMaster - تنبيهات الاشتراكات', {
                        body: `لديك ${total} اشتراك بحاجة للمتابعة (منتهية أو قاربت على الانتهاء).`,
                        icon: 'assets/icon-192x192.png'
                    });
                    localStorage.setItem(notifiedKey, 'true');
                }
            }
        }
    }

    // ============================================================
    //  DASHBOARD
    // ============================================================
    function renderDashboard() {
        // Welcome Greeting in Top Bar
        const pageTitle = document.getElementById('pageTitle');
        const now = new Date();
        const hour = now.getHours();
        let greeting = 'مرحباً بك!';
        if (hour < 12) greeting = 'صباح الخير ☀️';
        else if (hour < 18) greeting = 'مساء الخير 🌤️';
        else greeting = 'مساء الخير 🌙';

        const dateStr = now.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        if (pageTitle) {
            pageTitle.innerHTML = `
                <div style="line-height:1.2;">
                    <div style="font-size:1.1rem;font-weight:700;color:var(--text-light);">${greeting} <span style="display:inline-block;animation: wave 2s infinite;transform-origin: bottom right;">👋</span></div>
                    <div style="font-size:0.75rem;color:var(--text-muted);font-weight:normal;">${dateStr}</div>
                </div>
            `;
        }

        const stats = DataManager.calculateStats();
        const accounts = DataManager.getAccounts();
        const fmt = (num) => Number(num).toLocaleString('ar-EG');

        document.getElementById('stat-revenue').innerHTML = fmt(stats.totalPaid !== undefined ? stats.totalPaid : stats.totalRevenue) + ' <span>ج.م</span>';
        document.getElementById('stat-cost').innerHTML = fmt(stats.totalCost) + ' <span>ج.م</span>';
        document.getElementById('stat-profit').innerHTML = fmt(stats.netCollected !== undefined ? stats.netCollected : stats.netProfit) + ' <span>ج.م</span>';
        document.getElementById('stat-refunds').innerHTML = fmt(stats.totalRefunds) + ' <span>ج.م</span>';

        let activeCount = 0, warningCount = 0, expiredCount = 0;
        accounts.forEach(acc => {
            const s = DataManager.getAccountStatus(acc);
            if (s.status === 'active') activeCount++;
            else if (s.status === 'warning') warningCount++;
            else if (s.status === 'expired') expiredCount++;
        });
        document.getElementById('stat-customers-count').textContent = DataManager.getCustomers().length;
        document.getElementById('stat-active-count').textContent = activeCount;
        document.getElementById('stat-warning-count').textContent = warningCount;
        document.getElementById('stat-expired-count').textContent = expiredCount;
        renderFollowUpCenter(accounts);

        // Skeletons while loading
        if (!window.isDataLoaded) {
            document.getElementById('apexDonutChart').innerHTML = '<div class="skeleton skeleton-box" style="height:220px;"></div>';
            document.getElementById('apexAreaChart').innerHTML = '<div class="skeleton skeleton-box" style="height:220px;"></div>';
            return;
        }

        const platformCounts = {};
        accounts.forEach(acc => {
            platformCounts[acc.platformId] = (platformCounts[acc.platformId] || 0) + 1;
        });

        const platformLabels = [];
        const platformSeries = [];
        const platformColors = [];

        Object.keys(platformCounts).forEach(pid => {
            const p = DataManager.getPlatformById(pid);
            if (p) {
                platformLabels.push(p.name);
                platformSeries.push(platformCounts[pid]);
                platformColors.push(p.color);
            }
        });

        if (platformSeries.length > 0) {
            if (!window.donutChartInstance) {
                const donutOptions = {
                    series: platformSeries,
                    labels: platformLabels,
                    chart: { type: 'donut', height: 220, background: 'transparent' },
                    theme: { mode: 'dark' },
                    colors: platformColors,
                    stroke: { show: true, colors: ['#0b0f19'], width: 2 },
                    dataLabels: { enabled: false },
                    legend: { position: 'bottom', fontSize: '14px', fontFamily: 'Tajawal', markers: { radius: 12 } }
                };
                window.donutChartInstance = new ApexCharts(document.querySelector("#apexDonutChart"), donutOptions);
                window.donutChartInstance.render();
            } else {
                window.donutChartInstance.updateOptions({ labels: platformLabels, colors: platformColors });
                window.donutChartInstance.updateSeries(platformSeries);
            }
        } else {
            document.querySelector("#apexDonutChart").innerHTML = '<p class="text-muted text-center" style="padding:2rem 0;width:100%;">لا توجد بيانات كافية لاستعراض التحليلات.</p>';
            if (window.donutChartInstance) { window.donutChartInstance.destroy(); window.donutChartInstance = null; }
        }

        // Mock Area Chart based on total revenue points
        if (accounts.length > 0) {
            if (!window.areaChartInstance) {
                const areaOptions = {
                    series: [{ name: 'الإيرادات المتوقعة', data: [10, 41, 35, 51, 49, 62, 69, 91, 148] }],
                    chart: { type: 'area', height: 220, background: 'transparent', toolbar: { show: false } },
                    theme: { mode: 'dark' },
                    colors: ['#8b5cf6'],
                    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.7, opacityTo: 0.1, stops: [0, 90, 100] } },
                    dataLabels: { enabled: false },
                    stroke: { curve: 'smooth', width: 2 },
                    xaxis: { categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'] },
                    tooltip: { theme: 'dark', y: { formatter: function (val) { return val + " اشتراك" } } }
                };
                window.areaChartInstance = new ApexCharts(document.querySelector("#apexAreaChart"), areaOptions);
                window.areaChartInstance.render();
            }
        } else {
            document.querySelector("#apexAreaChart").innerHTML = '<p class="text-muted text-center" style="padding:2rem 0;width:100%;">لا توجد بيانات كافية لاستعراض التحليلات.</p>';
            if (window.areaChartInstance) { window.areaChartInstance.destroy(); window.areaChartInstance = null; }
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
                        <small style="display:block;margin-top:2px;">
                            ${acc.startDate} • 
                            <span class="${statusInfo.daysLeft !== null && statusInfo.daysLeft <= 7 ? 'text-danger' : 'text-warning'}" style="font-weight:bold;">${statusInfo.daysLeft === null ? statusInfo.label : 'متبقي ' + statusInfo.daysLeft + ' يوم'}</span> • 
                            <span class="status-badge status-${statusInfo.status}">${statusInfo.label}</span>
                        </small>
                    </div>
                </div>`;
            });
            recentContainer.innerHTML = html;
        }

        const btnTabDonut = document.getElementById('btnTabDonut');
        const btnTabArea = document.getElementById('btnTabArea');
        const chartTitle = document.getElementById('chartTitle');
        if (btnTabDonut && !btnTabDonut.hasAttribute('data-bound')) {
            btnTabDonut.setAttribute('data-bound', 'true');
            btnTabDonut.addEventListener('click', () => {
                document.getElementById('apexDonutChart').style.display = 'block';
                document.getElementById('apexAreaChart').style.display = 'none';
                btnTabDonut.classList.replace('btn-secondary', 'btn-primary');
                btnTabArea.classList.replace('btn-primary', 'btn-secondary');
                if (chartTitle) chartTitle.innerHTML = '<i class="fa-solid fa-chart-pie"></i> توزيع الاشتراكات';
            });
            btnTabArea.addEventListener('click', () => {
                document.getElementById('apexDonutChart').style.display = 'none';
                document.getElementById('apexAreaChart').style.display = 'block';
                btnTabArea.classList.replace('btn-secondary', 'btn-primary');
                btnTabDonut.classList.replace('btn-primary', 'btn-secondary');
                if (chartTitle) chartTitle.innerHTML = '<i class="fa-solid fa-chart-area"></i> ملخص الإيرادات';
            });
        }
    }

    function buildFinancialLedgerRows() {
        const formatLedgerTransactionDate = (value) => {
            if (!value) return '';
            const parsed = new Date(value);
            if (!Number.isNaN(parsed.getTime()) && String(value).includes('T')) {
                return parsed.toLocaleString('ar-EG', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
            return value;
        };
        const rows = [];
        DataManager.getAccounts().forEach(acc => {
            const customer = DataManager.getCustomerById(acc.customerId);
            const platform = DataManager.getPlatformById(acc.platformId);
            const plan = acc.servicePlanId ? DataManager.getServicePlanById(acc.servicePlanId) : null;
            const entries = DataManager.getAccountBillingEntries ? DataManager.getAccountBillingEntries(acc) : [];
            const latestRenewal = DataManager.getLatestRenewalForAccount ? DataManager.getLatestRenewalForAccount(acc.id) : null;

            entries.forEach(entry => {
                const isRenewal = entry.type === 'renewal';
                const paidAmount = Number(entry.paidAmount || 0);
                rows.push({
                    id: entry.id || `${acc.id}_initial`,
                    kind: isRenewal ? 'renewal' : 'subscription',
                    accountId: acc.id,
                    renewalId: isRenewal ? entry.id : '',
                    canUndo: isRenewal && latestRenewal && latestRenewal.id === entry.id,
                    date: formatLedgerTransactionDate(entry.transactionDate || entry.createdAt || entry.periodStart || ''),
                    sortDate: entry.transactionDate || entry.createdAt || entry.periodStart || '',
                    type: isRenewal ? 'تجديد' : 'اشتراك أصلي',
                    source: `${customer ? customer.name : (acc.customerName || 'عميل')} - ${platform ? platform.name : 'خدمة'}${plan ? ' / ' + plan.name : ''}`,
                    period: `${entry.periodStart || '-'} إلى ${entry.periodEnd || '-'}`,
                    amount: Number(entry.amount || 0),
                    paidAmount,
                    unpaidAmount: Math.max(0, Number(entry.amount || 0) - paidAmount),
                    status: paidAmount > 0 ? `محصل ${paidAmount.toLocaleString('ar-EG')} ج.م` : 'غير مسدد',
                    statusClass: entry.isPaid ? 'text-success' : 'text-danger'
                });
            });
        });

        DataManager.getServicePlans().forEach(plan => {
            const platform = DataManager.getPlatformById(plan.platformId);
            const expenses = DataManager.getPlanExpenses ? DataManager.getPlanExpenses(plan.id) : [];
            if (expenses.length > 0) {
                expenses.forEach(expense => {
                    rows.push({
                        id: expense.id,
                        kind: 'expense',
                        date: formatLedgerTransactionDate(expense.paidAt || expense.createdAt || expense.periodStart || ''),
                        sortDate: expense.paidAt || expense.createdAt || expense.periodStart || '',
                        type: 'مصروف خطة',
                        source: `${platform ? platform.name : 'خدمة'}${plan.name ? ' / ' + plan.name : ''}`,
                        period: `${expense.periodStart || '-'} إلى ${expense.periodEnd || '-'}`,
                        amount: -Number(expense.amount || 0),
                        status: expense.note || 'مصروف',
                        statusClass: 'text-warning',
                        expenseId: expense.id
                    });
                });
                return;
            }

            const cost = Number(plan.registrationCost || 0);
            if (!cost) return;
            rows.push({
                id: plan.id,
                kind: 'legacy_cost',
                date: formatLedgerTransactionDate(plan.createdAt || plan.startDate || ''),
                sortDate: plan.createdAt || plan.startDate || '',
                type: 'تكلفة خطة قديمة',
                source: `${platform ? platform.name : 'خدمة'}${plan.name ? ' / ' + plan.name : ''}`,
                period: 'Fallback للتوافق',
                amount: -cost,
                status: 'تكلفة افتراضية',
                statusClass: 'text-warning'
            });
        });

        return rows.sort((a, b) => (b.sortDate || b.date || '').localeCompare(a.sortDate || a.date || ''));
    }

    function getFinancialLedgerSummaryHtml(stats) {
        const fmt = (num) => Number(num || 0).toLocaleString('ar-EG');
        return `
            <div class="ledger-summary-card"><small>المستحق</small><strong>${fmt(stats.totalRevenue)} ج.م</strong></div>
            <div class="ledger-summary-card success"><small>المحصل</small><strong>${fmt(stats.totalPaid)} ج.م</strong></div>
            <div class="ledger-summary-card danger"><small>غير المسدد</small><strong>${fmt(stats.totalUnpaid)} ج.م</strong></div>
            <div class="ledger-summary-card warning"><small>التكلفة</small><strong>${fmt(stats.totalCost)} ج.م</strong></div>
            <div class="ledger-summary-card"><small>صافي المحصل</small><strong>${fmt(stats.netCollected)} ج.م</strong></div>
        `;
    }

    function openFinancialLedger() {
        const summary = document.getElementById('financialLedgerSummary');
        const body = document.getElementById('financialLedgerBody');
        if (!summary || !body) return;

        const stats = DataManager.calculateStats();
        const rows = buildFinancialLedgerRows();
        const fmt = (num) => Number(num || 0).toLocaleString('ar-EG');

        summary.innerHTML = `
            <div class="ledger-summary-card"><small>المستحق</small><strong>${fmt(stats.totalRevenue)} ج.م</strong></div>
            <div class="ledger-summary-card success"><small>المحصل</small><strong>${fmt(stats.totalPaid)} ج.م</strong></div>
            <div class="ledger-summary-card danger"><small>غير المسدد</small><strong>${fmt(stats.totalUnpaid)} ج.م</strong></div>
            <div class="ledger-summary-card warning"><small>التكلفة</small><strong>${fmt(stats.totalCost)} ج.م</strong></div>
            <div class="ledger-summary-card"><small>صافي المحصل</small><strong>${fmt(stats.netCollected)} ج.م</strong></div>
        `;

        if (rows.length === 0) {
            body.innerHTML = '<div class="ledger-empty">لا توجد معاملات مالية مسجلة.</div>';
            openModal('financialLedgerModal');
            return;
        }

        body.innerHTML = `
            <div class="ledger-toolbar">
                <div class="search-box ledger-search-box">
                    <i class="fa-solid fa-search"></i>
                    <input type="text" id="ledgerSearch" placeholder="ابحث في المعاملات...">
                </div>
                <select id="ledgerTypeFilter" class="form-control">
                    <option value="all">كل المعاملات</option>
                    <option value="subscription">اشتراكات أصلية</option>
                    <option value="renewal">تجديدات</option>
                    <option value="expense">مصروفات خطط</option>
                    <option value="legacy_cost">تكلفة قديمة</option>
                </select>
            </div>
            <div id="ledgerRowsContainer"></div>
        `;
        renderFinancialLedgerRows(rows);
        document.getElementById('ledgerSearch')?.addEventListener('input', () => renderFinancialLedgerRows(rows));
        document.getElementById('ledgerTypeFilter')?.addEventListener('change', () => renderFinancialLedgerRows(rows));
        openModal('financialLedgerModal');
    }

    function renderFinancialLedgerPage() {
        const view = document.getElementById('view-financial-ledger');
        if (!view) return;

        const stats = DataManager.calculateStats();
        const rows = buildFinancialLedgerRows();
        view.innerHTML = `
            <div class="financial-ledger-page">
                <div class="ledger-page-header">
                    <div>
                        <h2><i class="fa-solid fa-receipt"></i> كشف المعاملات المالية</h2>
                        <p>راجع الاشتراكات والتجديدات ومصروفات الخطط من مكان واحد.</p>
                    </div>
                    <button class="btn btn-secondary btn-sm" id="btnLedgerCompareBackup">
                        <i class="fa-solid fa-code-compare"></i> مقارنة نسخة احتياطية
                    </button>
                </div>
                <div class="ledger-summary-grid ledger-page-summary">
                    ${getFinancialLedgerSummaryHtml(stats)}
                </div>
                <div class="ledger-page-shell glass-panel">
                    <div class="ledger-toolbar ledger-page-toolbar">
                        <div class="search-box ledger-search-box">
                            <i class="fa-solid fa-search"></i>
                            <input type="text" id="ledgerPageSearch" placeholder="ابحث باسم العميل، الخطة، الخدمة أو الفترة...">
                        </div>
                        <select id="ledgerPageTypeFilter" class="form-control">
                            <option value="all">كل المعاملات</option>
                            <option value="subscription">اشتراكات أصلية</option>
                            <option value="renewal">تجديدات</option>
                            <option value="expense">مصروفات خطط</option>
                            <option value="legacy_cost">تكلفة قديمة</option>
                        </select>
                    </div>
                    <div id="ledgerPageRowsContainer" class="ledger-page-rows"></div>
                </div>
            </div>
        `;

        const renderRows = () => renderFinancialLedgerRows(rows, {
            containerId: 'ledgerPageRowsContainer',
            searchId: 'ledgerPageSearch',
            typeId: 'ledgerPageTypeFilter'
        });
        renderRows();
        document.getElementById('ledgerPageSearch')?.addEventListener('input', renderRows);
        document.getElementById('ledgerPageTypeFilter')?.addEventListener('change', renderRows);
        document.getElementById('btnLedgerCompareBackup')?.addEventListener('click', () => document.getElementById('backupCompareInput')?.click());
    }

    function getLedgerActionHtml(row) {
        const editAction = row.accountId
            ? `<button class="btn-icon ledger-edit-account-btn" data-id="${escapeAttr(row.accountId)}" title="تعديل الاشتراك"><i class="fa-solid fa-pen text-primary"></i></button>`
            : '';
        if (row.kind === 'renewal') {
            if (!row.canUndo) {
                return `${editAction}<span class="ledger-muted-action">آخر تجديد فقط</span>`;
            }
            return `${editAction}<button class="btn-icon ledger-action-chip ledger-undo-renewal-btn" data-id="${escapeAttr(row.renewalId)}" title="تراجع عن التجديد"><i class="fa-solid fa-rotate-left text-warning"></i><span>تراجع</span></button>`;
        }
        if (row.kind === 'subscription') {
            return `${editAction}<button class="btn-icon ledger-delete-account-btn" data-id="${escapeAttr(row.accountId)}" title="حذف الاشتراك وملحقاته"><i class="fa-solid fa-trash text-danger"></i></button>`;
        }
        if (row.expenseId) {
            return `<button class="btn-icon ledger-delete-expense-btn" data-id="${escapeAttr(row.expenseId)}" title="حذف المصروف"><i class="fa-solid fa-trash text-danger"></i></button>`;
        }
        return '<span class="ledger-muted-action">للعرض فقط</span>';
    }

    function renderFinancialLedgerRows(rows, options = {}) {
        const container = document.getElementById(options.containerId || 'ledgerRowsContainer');
        if (!container) return;
        const term = (document.getElementById(options.searchId || 'ledgerSearch')?.value || '').trim().toLowerCase();
        const type = document.getElementById(options.typeId || 'ledgerTypeFilter')?.value || 'all';
        const filteredRows = rows.filter(row => {
            const matchesType = type === 'all' || row.kind === type;
            const text = `${row.date} ${row.type} ${row.source} ${row.period} ${row.status}`.toLowerCase();
            return matchesType && (!term || text.includes(term));
        });

        if (filteredRows.length === 0) {
            container.innerHTML = '<div class="ledger-empty">لا توجد معاملات مطابقة.</div>';
            return;
        }

        const fmt = (num) => Number(num || 0).toLocaleString('ar-EG');
        container.innerHTML = `
            <table class="ledger-table">
                <thead>
                    <tr>
                        <th>التاريخ</th>
                        <th>النوع</th>
                        <th>البيان</th>
                        <th>الفترة</th>
                        <th>الحالة</th>
                        <th>المبلغ</th>
                        <th>إجراء</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredRows.map((row, index) => `
                        <tr class="ledger-row-clickable" data-ledger-index="${index}">
                            <td>${escapeHtml(row.date || '-')}</td>
                            <td>${escapeHtml(row.type)}</td>
                            <td>${escapeHtml(row.source)}</td>
                            <td>${escapeHtml(row.period)}</td>
                            <td><span class="${row.statusClass}">${escapeHtml(row.status)}</span></td>
                            <td class="${row.amount < 0 ? 'text-warning' : 'text-success'}">${row.amount < 0 ? '-' : ''}${fmt(Math.abs(row.amount))} ج.م</td>
                            <td>${getLedgerActionHtml(row)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div class="ledger-card-list">
                ${filteredRows.map((row, index) => `
                    <div class="ledger-card ledger-row-clickable" data-ledger-index="${index}">
                        <div class="ledger-card-head">
                            <strong>${escapeHtml(row.type)}</strong>
                            <span class="${row.amount < 0 ? 'text-warning' : 'text-success'}">${row.amount < 0 ? '-' : ''}${fmt(Math.abs(row.amount))} ج.م</span>
                        </div>
                        <div class="ledger-card-source">${escapeHtml(row.source)}</div>
                        <div class="ledger-card-meta">
                            <span>${escapeHtml(row.date || '-')}</span>
                            <span>${escapeHtml(row.period)}</span>
                            <span class="${row.statusClass}">${escapeHtml(row.status)}</span>
                        </div>
                        <div class="ledger-card-actions">${getLedgerActionHtml(row)}</div>
                    </div>
                `).join('')}
            </div>
        `;
        bindLedgerActions(container);
        bindLedgerRowDetails(container, filteredRows);
    }

    function bindLedgerActions(container) {
        container.querySelectorAll('.ledger-delete-expense-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.target.closest('.swal2-popup')) Swal.close();
                deletePlanExpenseFromUi(btn.dataset.id);
            });
        });
        container.querySelectorAll('.ledger-undo-renewal-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.target.closest('.swal2-popup')) Swal.close();
                undoRenewalFromLedger(btn.dataset.id);
            });
        });
        container.querySelectorAll('.ledger-delete-account-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.target.closest('.swal2-popup')) Swal.close();
                deleteAccountCascadeFromLedger(btn.dataset.id);
            });
        });
        container.querySelectorAll('.ledger-edit-account-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.target.closest('.swal2-popup')) Swal.close();
                closeModal('financialLedgerModal');
                editAccount(btn.dataset.id);
            });
        });
    }

    function bindLedgerRowDetails(container, rows) {
        container.querySelectorAll('.ledger-row-clickable').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('button, a, input, select')) return;
                const row = rows[Number(item.dataset.ledgerIndex)];
                if (row) showLedgerTransactionDetails(row);
            });
        });
    }

    function showLedgerTransactionDetails(row) {
        const fmt = (num) => Number(num || 0).toLocaleString('ar-EG');
        const amountClass = row.amount < 0 ? 'text-warning' : 'text-success';
        const actions = getLedgerActionHtml(row);
        Swal.fire({
            title: 'تفاصيل المعاملة',
            html: `
                <div class="ledger-detail-grid">
                    <div><span>النوع</span><strong>${escapeHtml(row.type || '-')}</strong></div>
                    <div><span>التاريخ</span><strong>${escapeHtml(row.date || '-')}</strong></div>
                    <div class="wide"><span>البيان</span><strong>${escapeHtml(row.source || '-')}</strong></div>
                    <div class="wide"><span>الفترة</span><strong>${escapeHtml(row.period || '-')}</strong></div>
                    <div><span>الحالة</span><strong class="${row.statusClass || ''}">${escapeHtml(row.status || '-')}</strong></div>
                    <div><span>المبلغ</span><strong class="${amountClass}">${row.amount < 0 ? '-' : ''}${fmt(Math.abs(row.amount || 0))} ج.م</strong></div>
                </div>
                <div class="ledger-detail-actions">${actions}</div>
            `,
            showConfirmButton: false,
            showCloseButton: true,
            background: '#111827',
            color: '#fff',
            didOpen: (popup) => bindLedgerActions(popup)
        });
    }

    function refreshFinancialLedgerDisplays() {
        if (document.getElementById('view-financial-ledger')?.classList.contains('active')) {
            renderFinancialLedgerPage();
        }
        if (document.getElementById('financialLedgerModal')?.classList.contains('show')) {
            openFinancialLedger();
        }
    }

    const btnFinancialLedger = document.getElementById('btnFinancialLedger');
    if (btnFinancialLedger) {
        btnFinancialLedger.addEventListener('click', () => navigateToView('financial-ledger', 'كشف المعاملات'));
    }

    function readBackupComparisonFile(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const backup = JSON.parse(event.target.result);
                showBackupFinancialComparison(backup);
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'ملف غير صالح', text: 'تعذر قراءة ملف النسخة الاحتياطية.', background: '#111827', color: '#fff' });
            }
        };
        reader.readAsText(file);
    }

    function compareNumberField(beforeValue, afterValue) {
        const before = Number(beforeValue || 0);
        const after = Number(afterValue || 0);
        return {
            before,
            after,
            diff: after - before,
            changed: before !== after
        };
    }

    function showBackupFinancialComparison(backup) {
        const rows = [];
        const backupPlans = Array.isArray(backup.servicePlans) ? backup.servicePlans : [];
        const backupAccounts = Array.isArray(backup.accounts) ? backup.accounts : [];
        const backupPlanMap = new Map(backupPlans.map(plan => [plan.id, plan]));
        const backupAccountMap = new Map(backupAccounts.map(acc => [acc.id, acc]));

        DataManager.getServicePlans().forEach(plan => {
            const oldPlan = backupPlanMap.get(plan.id);
            if (!oldPlan) return;
            [
                { key: 'registrationCost', label: 'تكلفة دورة الخطة' },
                { key: 'pricePerMember', label: 'سعر دورة العضو' }
            ].forEach(field => {
                const result = compareNumberField(oldPlan[field.key], plan[field.key]);
                if (!result.changed) return;
                rows.push({
                    type: 'خطة',
                    name: plan.name || oldPlan.name || 'خطة',
                    field: field.label,
                    before: result.before,
                    after: result.after,
                    diff: result.diff
                });
            });
        });

        DataManager.getAccounts().forEach(acc => {
            const oldAcc = backupAccountMap.get(acc.id);
            if (!oldAcc) return;
            [
                { key: 'revenue', label: 'قيمة اشتراك الأكونت' },
                { key: 'refund', label: 'التعويض' }
            ].forEach(field => {
                const result = compareNumberField(oldAcc[field.key], acc[field.key]);
                if (!result.changed) return;
                const customer = DataManager.getCustomerById(acc.customerId);
                const platform = DataManager.getPlatformById(acc.platformId);
                rows.push({
                    type: 'اشتراك',
                    name: `${customer ? customer.name : 'عميل'} - ${platform ? platform.name : 'خدمة'}`,
                    field: field.label,
                    before: result.before,
                    after: result.after,
                    diff: result.diff
                });
            });
        });

        if (rows.length === 0) {
            Swal.fire({ icon: 'success', title: 'لا توجد فروق مالية', text: 'لم يتم العثور على اختلافات في حقول التكلفة أو سعر الدورة أو قيمة الاشتراكات.', background: '#111827', color: '#fff' });
            return;
        }

        const fmt = (num) => Number(num || 0).toLocaleString('ar-EG');
        const html = `
            <div class="backup-compare-wrap">
                <table class="ledger-table backup-compare-table">
                    <thead>
                        <tr>
                            <th>النوع</th>
                            <th>البيان</th>
                            <th>الحقل</th>
                            <th>في النسخة</th>
                            <th>الحالي</th>
                            <th>الفرق</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map(row => `
                            <tr>
                                <td>${escapeHtml(row.type)}</td>
                                <td>${escapeHtml(row.name)}</td>
                                <td>${escapeHtml(row.field)}</td>
                                <td>${fmt(row.before)} ج.م</td>
                                <td>${fmt(row.after)} ج.م</td>
                                <td class="${row.diff >= 0 ? 'text-success' : 'text-danger'}">${row.diff >= 0 ? '+' : ''}${fmt(row.diff)} ج.م</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <p class="text-muted" style="text-align:right;margin-top:0.75rem;">هذه مقارنة فقط ولم يتم تعديل أي بيانات.</p>
        `;

        Swal.fire({
            title: 'فروق مالية بين النسخة الاحتياطية والحالية',
            html,
            width: 950,
            confirmButtonText: 'إغلاق',
            background: '#111827',
            color: '#fff'
        });
    }

    const btnCompareBackupLedger = document.getElementById('btnCompareBackupLedger');
    const backupCompareInput = document.getElementById('backupCompareInput');
    if (btnCompareBackupLedger && backupCompareInput) {
        btnCompareBackupLedger.addEventListener('click', () => backupCompareInput.click());
        backupCompareInput.addEventListener('change', (event) => {
            readBackupComparisonFile(event.target.files[0]);
            event.target.value = '';
        });
    }

    function renderFollowUpCenter(accounts) {
        const center = document.querySelector('.followup-center');
        const activeList = document.getElementById('followup-active-list');
        if (!center || !activeList) return;

        const groups = buildFollowUpNotificationGroups(accounts);
        const urgentAccounts = groups.urgent || [];
        const warningAccounts = groups.warning;
        const expiredAccounts = groups.expired;
        const reviewAccounts = groups.needsReview || [];
        const unpaidAccounts = groups.unpaid;
        const seen = new Set();
        const previewItems = [...urgentAccounts, ...warningAccounts, ...unpaidAccounts]
            .filter(acc => {
                if (seen.has(acc.id)) return false;
                seen.add(acc.id);
                return true;
            })
            .slice(0, 3);

        const urgentCountEl = document.getElementById('followup-expired-count');
        if (urgentCountEl && urgentCountEl.parentElement) {
            const labelNode = Array.from(urgentCountEl.parentElement.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
            if (labelNode) labelNode.textContent = 'عاجلة ';
        }
        document.getElementById('followup-warning-count').textContent = warningAccounts.length;
        document.getElementById('followup-expired-count').textContent = urgentAccounts.length;
        document.getElementById('followup-unpaid-count').textContent = unpaidAccounts.length;

        center.classList.toggle('is-empty', previewItems.length === 0);
        activeList.innerHTML = previewItems.length > 0
            ? renderFollowUpItems(previewItems, 'dashboard')
            : '<div class="followup-empty dashboard-followup-empty">لا توجد عناصر تحتاج متابعة الآن</div>';
        bindFollowUpActions(center);

        const showAllBtn = document.getElementById('btnFollowupShowAll');
        if (showAllBtn && !showAllBtn.hasAttribute('data-bound')) {
            showAllBtn.setAttribute('data-bound', 'true');
            showAllBtn.addEventListener('click', openNotificationCenter);
        }
    }

    function renderFollowUpItems(items, groupType) {
        if (items.length === 0) {
            return '<div class="followup-empty">لا توجد عناصر تحتاج متابعة</div>';
        }

        return items.map(acc => {
            const statusInfo = DataManager.getAccountStatus(acc);
            const customer = DataManager.getCustomerById(acc.customerId);
            const platform = DataManager.getPlatformById(acc.platformId);
            const custName = customer ? customer.name : (acc.customerName || 'غير محدد');
            const platName = platform ? platform.name : 'غير محدد';
            const phone = customer ? customer.phone : (acc.customerPhone || '');
            const isPaid = acc.isPaid === true;
            const timingText = getFollowUpTimingText(acc, statusInfo);
            const paymentLabel = isPaid ? 'تم السداد' : 'غير مسدد';
            const paymentClass = isPaid ? 'text-success' : 'text-danger';
            const canClose = statusInfo.status === 'expired';
            const canMarkPaid = !isPaid;
            const canInvoice = acc.revenue !== undefined && acc.revenue !== null && acc.revenue !== '' && !Number.isNaN(Number(acc.revenue));
            const isMonthly = acc.billingCycle === 'monthly';
            const renewalStopped = isRenewalStopped(acc);
            const overlapBadge = groupType === 'unpaid' && (statusInfo.status === 'expired' || statusInfo.status === 'warning' || statusInfo.status === 'needs_review')
                ? `<span class="followup-overlap-badge status-${statusInfo.status}">${statusInfo.status === 'expired' ? 'منتهي' : statusInfo.status === 'needs_review' ? 'يحتاج مراجعة' : 'قارب على الانتهاء'}</span>`
                : '';

            return `<div class="followup-item">
                <div class="followup-main">
                    <div class="followup-title">
                        <strong>${escapeHtml(custName)}</strong>
                        <span>${escapeHtml(platName)}</span>
                    </div>
                    <div class="followup-meta">
                        <span class="status-badge status-${statusInfo.status}">${statusInfo.label}</span>
                        ${overlapBadge}
                        <span>${escapeHtml(timingText)}</span>
                        <span class="${paymentClass}">${paymentLabel}</span>
                    </div>
                </div>
                <div class="followup-actions">
                    ${!renewalStopped && isMonthly ? `<button class="btn-icon followup-renew-monthly-btn" data-id="${escapeAttr(acc.id)}" title="تجديد شهري"><i class="fa-solid fa-calendar-plus text-success"></i></button>` : ''}
                    ${!renewalStopped && !isMonthly ? `<button class="btn-icon followup-renew-btn" data-id="${escapeAttr(acc.id)}" title="تجديد"><i class="fa-solid fa-rotate-right text-primary"></i></button>` : ''}
                    ${!renewalStopped ? `<button class="btn-icon followup-cancel-renewal-btn" data-id="${escapeAttr(acc.id)}" title="لن يجدد بنهاية الفترة"><i class="fa-solid fa-calendar-xmark text-warning"></i></button>` : ''}
                    ${renewalStopped ? `<button class="btn-icon followup-restore-renewal-btn" data-id="${escapeAttr(acc.id)}" title="إعادة التجديد"><i class="fa-solid fa-calendar-check text-success"></i></button>` : ''}
                    ${canClose ? `<button class="btn-icon followup-close-btn" data-id="${escapeAttr(acc.id)}" title="إغلاق"><i class="fa-solid fa-circle-stop text-danger"></i></button>` : ''}
                    ${phone ? `<button class="btn-icon followup-whatsapp-btn" data-id="${escapeAttr(acc.id)}" title="واتساب"><i class="fa-brands fa-whatsapp text-success"></i></button>` : ''}
                    ${canInvoice ? `<button class="btn-icon followup-invoice-btn" data-id="${escapeAttr(acc.id)}" title="فاتورة"><i class="fa-solid fa-file-invoice-dollar text-warning"></i></button>` : ''}
                    ${canMarkPaid ? `<button class="btn-icon followup-paid-btn" data-id="${escapeAttr(acc.id)}" title="تعليم كمدفوع"><i class="fa-solid fa-circle-check text-success"></i></button>` : ''}
                </div>
            </div>`;
        }).join('');
    }

    function getFollowUpTimingText(acc, statusInfo) {
        if (statusInfo.status === 'needs_review') {
            return 'تاريخ النهاية غير واضح';
        }
        if (statusInfo.status === 'expired') {
            const expiredDays = Math.abs(statusInfo.daysLeft || 0);
            if (expiredDays < 1) return 'منتهي اليوم';
            return `منتهي منذ ${expiredDays} يوم`;
        }
        if (statusInfo.status === 'warning') {
            if (statusInfo.daysLeft === 0) return 'ينتهي اليوم';
            return `متبقي ${statusInfo.daysLeft} يوم`;
        }
        if (statusInfo.daysLeft === null || statusInfo.daysLeft === undefined) return statusInfo.label;
        return `متبقي ${statusInfo.daysLeft} يوم`;
    }

    let accountEndDateManuallyEdited = false;

    function addDaysToDate(startDate, durationDays) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + (parseInt(durationDays, 10) || 30));
        return DataManager.formatDate(date);
    }

    function buildBillingFields(startDate, durationDays, billingCycle, endDateOverride = '') {
        const cycle = billingCycle || 'custom';
        const parsedDuration = parseInt(durationDays, 10) || 30;
        const monthCount = DataManager.getBillingCycleMonths(cycle);
        const calculatedEndDate = monthCount
            ? DataManager.addCalendarMonths(startDate, monthCount)
            : addDaysToDate(startDate, parsedDuration);
        const currentPeriodEnd = endDateOverride || calculatedEndDate;
        const syncedDuration = DataManager.daysBetween(startDate, currentPeriodEnd);

        if (monthCount) {
            return {
                billingCycle: cycle,
                recurringEnabled: true,
                currentPeriodStart: startDate,
                currentPeriodEnd,
                nextBillingDate: currentPeriodEnd,
                durationDays: syncedDuration
            };
        }
        return {
            billingCycle: cycle,
            recurringEnabled: false,
            currentPeriodStart: startDate,
            currentPeriodEnd,
            nextBillingDate: '',
            durationDays: syncedDuration
        };
    }

    function syncAccountDurationFromEndDate() {
        const startInput = document.getElementById('accStartDate');
        const endInput = document.getElementById('accEndDate');
        const durationInput = document.getElementById('accDurationDays');
        if (!startInput || !endInput || !durationInput || !startInput.value || !endInput.value) return;
        durationInput.value = DataManager.daysBetween(startInput.value, endInput.value);
    }

    function setAccountEndDate(endDate, manual = false) {
        const endInput = document.getElementById('accEndDate');
        if (!endInput || !endDate) return;
        endInput.value = endDate;
        if (manual) accountEndDateManuallyEdited = true;
        syncAccountDurationFromEndDate();
    }

    function syncAccountEndDateFromDuration(manual = true) {
        const startInput = document.getElementById('accStartDate');
        const durationInput = document.getElementById('accDurationDays');
        if (!startInput || !durationInput || !startInput.value) return;
        setAccountEndDate(addDaysToDate(startInput.value, durationInput.value), manual);
    }

    function compactAccountPaymentFields() {
        if (document.querySelector('.subscription-payment-row')) return;
        const revenueInput = document.getElementById('accRevenue');
        const paidInput = document.getElementById('accIsPaid');
        if (!revenueInput || !paidInput) return;

        const revenueGroup = revenueInput.closest('.form-group');
        const paidGroup = paidInput.closest('.form-group');
        const paidLabel = paidInput.closest('.payment-toggle-label');
        if (!revenueGroup || !paidGroup || !paidLabel) return;

        const row = document.createElement('div');
        row.className = 'subscription-payment-row';
        revenueInput.parentNode.insertBefore(row, revenueInput);
        row.appendChild(revenueInput);

        const paidAmountInput = document.createElement('input');
        paidAmountInput.type = 'number';
        paidAmountInput.id = 'accPaidAmount';
        paidAmountInput.className = 'form-control paid-amount-input';
        paidAmountInput.min = '0';
        paidAmountInput.step = '0.01';
        paidAmountInput.placeholder = 'المدفوع فعليًا';
        paidAmountInput.title = 'المبلغ المدفوع فعليًا';
        row.appendChild(paidAmountInput);

        paidLabel.classList.add('inline-payment-toggle');
        row.appendChild(paidLabel);
        revenueGroup.classList.add('full-width', 'compact-payment-group');
        paidGroup.remove();

        const syncPaidAmount = () => {
            if (paidInput.checked) {
                if (!paidAmountInput.value || Number(paidAmountInput.value) <= 0) {
                    paidAmountInput.value = revenueInput.value || 0;
                }
            } else {
                paidAmountInput.value = 0;
            }
        };
        paidInput.addEventListener('change', syncPaidAmount);
        revenueInput.addEventListener('change', () => {
            if (paidInput.checked && (!paidAmountInput.value || Number(paidAmountInput.value) <= 0)) {
                paidAmountInput.value = revenueInput.value || 0;
            }
        });
    }

    compactAccountPaymentFields();

    function setAccountPaidAmount(value) {
        const paidAmountInput = document.getElementById('accPaidAmount');
        if (paidAmountInput) paidAmountInput.value = value ?? 0;
    }

    enhanceWorkflowModals();

    function enhanceWorkflowModals() {
        enhanceTabbedForm('accountModal', [
            {
                key: 'plan',
                label: 'الخطة',
                icon: 'fa-solid fa-box-open',
                selectors: ['#accCustomerBanner', '#accPlansCheckboxes', '#planInfoBanner']
            },
            {
                key: 'customer',
                label: 'المشترك',
                icon: 'fa-solid fa-user-check',
                selectors: ['#accCustomer', '#accPlatform']
            },
            {
                key: 'billing',
                label: 'الفوترة',
                icon: 'fa-solid fa-coins',
                selectors: ['#accRevenue', '#accBillingCycle']
            },
            {
                key: 'dates',
                label: 'الفترة',
                icon: 'fa-solid fa-calendar-days',
                selectors: ['#accStartDate', '#accEndDate', '#accDurationDays', '#accRefund']
            },
            {
                key: 'login',
                label: 'الدخول',
                icon: 'fa-solid fa-key',
                selectors: ['#accUsername', '#accPassword', '#accActivationCode', '#accNotes']
            }
        ]);

        enhanceTabbedForm('planModal', [
            {
                key: 'basic',
                label: 'الخطة',
                icon: 'fa-solid fa-layer-group',
                selectors: ['#planPlatform', '#planName']
            },
            {
                key: 'pricing',
                label: 'التسعير',
                icon: 'fa-solid fa-coins',
                selectors: ['#planPricePerMember', '#planRegistrationCost', '#planBillingCycle', '#planDurationDays']
            },
            {
                key: 'account',
                label: 'الحساب',
                icon: 'fa-solid fa-key',
                selectors: ['#planEmail', '#planPassword', '#planNotes', '#planStartDate']
            }
        ]);

        enhanceTabbedForm('platformModal', [
            {
                key: 'basic',
                label: 'الخدمة',
                icon: 'fa-solid fa-star',
                selectors: ['#platName']
            },
            {
                key: 'style',
                label: 'الشكل',
                icon: 'fa-solid fa-palette',
                selectors: ['#platIcon', '#platColor', '#platformPreview']
            }
        ]);
    }

    function enhanceTabbedForm(modalId, tabConfigs) {
        const modal = document.getElementById(modalId);
        const form = modal?.querySelector('form');
        if (!modal || !form || form.dataset.tabbed === 'true') return;

        form.dataset.tabbed = 'true';
        modal.querySelector('.modal-content')?.classList.add('workflow-modal-content');
        form.classList.add('modal-tabbed-form');

        const tabs = document.createElement('div');
        tabs.className = 'modal-form-tabs';

        const panels = document.createElement('div');
        panels.className = 'modal-form-panels';

        const hiddenFields = Array.from(form.children).filter(node => node.matches?.('input[type="hidden"]'));
        hiddenFields.forEach(node => form.appendChild(node));

        tabConfigs.forEach((config, index) => {
            const tab = document.createElement('button');
            tab.type = 'button';
            tab.className = `modal-form-tab${index === 0 ? ' active' : ''}`;
            tab.dataset.formTab = config.key;
            tab.innerHTML = `<i class="${config.icon}"></i><span>${config.label}</span>`;
            tabs.appendChild(tab);

            const panel = document.createElement('div');
            panel.className = `modal-form-panel${index === 0 ? ' active' : ''}`;
            panel.dataset.formPanel = config.key;
            panel.appendChild(buildPanelGrid(config.selectors));
            panels.appendChild(panel);
        });

        const firstVisible = Array.from(form.children).find(node => !node.matches?.('input[type="hidden"]'));
        form.insertBefore(tabs, firstVisible || null);
        form.insertBefore(panels, tabs.nextSibling);

        form.querySelectorAll('.form-section-title').forEach(title => {
            if (!title.closest('.modal-form-panel')) title.remove();
        });
        form.querySelectorAll('.form-collapsible').forEach(details => {
            if (!details.querySelector('input, select, textarea, button')) details.remove();
        });

        tabs.addEventListener('click', (e) => {
            const tab = e.target.closest('[data-form-tab]');
            if (!tab) return;
            setActiveFormTab(form, tab.dataset.formTab);
        });
    }

    function buildPanelGrid(selectors) {
        const grid = document.createElement('div');
        grid.className = 'grid-form modal-form-panel-grid';
        selectors.forEach(selector => {
            const node = document.querySelector(selector);
            const group = getMovableFormBlock(node);
            if (group && !grid.contains(group)) grid.appendChild(group);
        });
        return grid;
    }

    function getMovableFormBlock(node) {
        if (!node) return null;
        if (node.classList?.contains('plan-info-banner')) return node;
        if (node.classList?.contains('platform-preview')) return node.closest('.form-group') || node;
        return node.closest('.form-group') || node;
    }

    function setActiveFormTab(form, key) {
        if (!form || !key) return;
        form.querySelectorAll('.modal-form-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.formTab === key);
        });
        form.querySelectorAll('.modal-form-panel').forEach(panel => {
            panel.classList.toggle('active', panel.dataset.formPanel === key);
        });
    }

    function refreshAccountEndDateFromSelectedPlan() {
        if (accountEndDateManuallyEdited) {
            syncAccountDurationFromEndDate();
            return;
        }

        const selectedPlanIds = getSelectedPlanIds();
        const plan = selectedPlanIds.length > 0 ? DataManager.getServicePlanById(selectedPlanIds[0]) : null;
        const startDate = document.getElementById('accStartDate').value || new Date().toISOString().split('T')[0];
        const durationDays = plan ? (plan.durationDays || 30) : (document.getElementById('accDurationDays').value || 30);
        const cycle = plan
            ? DataManager.normalizePlanBillingCycle(plan)
            : (document.getElementById('accBillingCycle') ? document.getElementById('accBillingCycle').value : 'custom');
        const billingFields = buildBillingFields(startDate, durationDays, cycle);
        setAccountEndDate(billingFields.currentPeriodEnd, false);
    }

    const accStartDateInput = document.getElementById('accStartDate');
    const accEndDateInput = document.getElementById('accEndDate');
    const accDurationInput = document.getElementById('accDurationDays');
    const accBillingCycleInput = document.getElementById('accBillingCycle');
    if (accStartDateInput) {
        accStartDateInput.addEventListener('change', () => {
            if (accountEndDateManuallyEdited) syncAccountDurationFromEndDate();
            else refreshAccountEndDateFromSelectedPlan();
        });
    }
    if (accEndDateInput) {
        accEndDateInput.addEventListener('change', () => {
            accountEndDateManuallyEdited = true;
            syncAccountDurationFromEndDate();
        });
    }
    if (accDurationInput) {
        accDurationInput.addEventListener('change', () => {
            syncAccountEndDateFromDuration(true);
        });
    }
    if (accBillingCycleInput) {
        accBillingCycleInput.addEventListener('change', () => {
            if (accountEndDateManuallyEdited) syncAccountDurationFromEndDate();
            else refreshAccountEndDateFromSelectedPlan();
        });
    }

    function bindFollowUpActions(container) {
        if (!container) return;
        container.querySelectorAll('.followup-renew-btn').forEach(btn => {
            btn.addEventListener('click', () => renewAccountFromUi(btn.dataset.id));
        });
        container.querySelectorAll('.followup-renew-monthly-btn').forEach(btn => {
            btn.addEventListener('click', () => renewMonthlyAccountFromUi(btn.dataset.id));
        });
        container.querySelectorAll('.followup-close-btn').forEach(btn => {
            btn.addEventListener('click', () => closeAccountFromUi(btn.dataset.id));
        });
        container.querySelectorAll('.followup-cancel-renewal-btn').forEach(btn => {
            btn.addEventListener('click', () => cancelRenewalAtPeriodEndFromUi(btn.dataset.id));
        });
        container.querySelectorAll('.followup-restore-renewal-btn').forEach(btn => {
            btn.addEventListener('click', () => restoreRenewalIntentFromUi(btn.dataset.id));
        });
        container.querySelectorAll('.followup-whatsapp-btn').forEach(btn => {
            btn.addEventListener('click', () => openWhatsAppAccount(btn.dataset.id));
        });
        container.querySelectorAll('.followup-invoice-btn').forEach(btn => {
            btn.addEventListener('click', () => showInvoice(btn.dataset.id));
        });
        container.querySelectorAll('.followup-paid-btn').forEach(btn => {
            btn.addEventListener('click', () => toggleAccountPaid(btn.dataset.id, false));
        });
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

    function getBillingCycleLabel(cycle) {
        const labels = {
            custom: 'أيام مخصصة',
            custom_days: 'أيام مخصصة',
            monthly: 'شهري',
            quarterly: 'ربع سنوي',
            semi_annual: 'نصف سنوي',
            yearly: 'سنوي'
        };
        return labels[cycle] || labels.custom;
    }

    function getBillingCycleBadge(cycle, extraClass = '') {
        return `<span class="status-badge billing-cycle-badge ${extraClass}">${getBillingCycleLabel(cycle)}</span>`;
    }

    function getPlanCompatibilityDuration(cycle, durationDays) {
        const parsedDuration = parseInt(durationDays, 10);
        if (cycle === 'custom_days') return parsedDuration || 365;

        const months = DataManager.getBillingCycleMonths(cycle);
        if (!months) return parsedDuration || 365;

        const today = new Date().toISOString().split('T')[0];
        return DataManager.daysBetween(today, DataManager.addCalendarMonths(today, months));
    }

    function syncPlanBillingCycleUi() {
        const cycleSelect = document.getElementById('planBillingCycle');
        const durationInput = document.getElementById('planDurationDays');
        if (!cycleSelect || !durationInput) return;
        const isCustom = cycleSelect.value === 'custom_days';
        const durationGroup = durationInput.closest('.form-group');
        durationInput.disabled = !isCustom;
        durationInput.required = isCustom;
        if (durationGroup) {
            durationGroup.classList.toggle('is-disabled', !isCustom);
            durationGroup.style.display = isCustom ? '' : 'none';
        }
    }

    const planBillingCycleSelect = document.getElementById('planBillingCycle');
    if (planBillingCycleSelect) {
        planBillingCycleSelect.addEventListener('change', syncPlanBillingCycleUi);
    }

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

        const plans = DataManager.getCanonicalServicePlans ? DataManager.getCanonicalServicePlans() : DataManager.getServicePlans();
        grid.innerHTML = '';

        if (plans.length === 0) {
            if (emptyState) emptyState.style.display = 'flex';
            return;
        }
        if (emptyState) emptyState.style.display = 'none';

        plans.forEach(plan => {
            const platform = DataManager.getPlatformById(plan.platformId);
            const membersCount = DataManager.getServicePlanMembersCount(plan.id);
            const planFin = DataManager.getPlanFinancials(plan.id);
            const planCycle = DataManager.normalizePlanBillingCycle(plan);
            const planExpenses = DataManager.getPlanExpenses ? DataManager.getPlanExpenses(plan.id) : [];
            const billingBadge = getBillingCycleBadge(planCycle);
            const durationText = planCycle === 'custom_days'
                ? `${parseInt(plan.durationDays || 365, 10)} يوم`
                : 'تحسب من تاريخ الاشتراك';
            const costText = planExpenses.length > 0
                ? `مصروفات الخطة: ${Number(planFin.planCost).toLocaleString('ar-EG')} ج.م (${planExpenses.length})`
                : `تكلفة دورة افتراضية: ${Number(plan.registrationCost || 0).toLocaleString('ar-EG')} ج.م`;

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
                    ${billingBadge}
                </div>
                <div class="plan-card-body">
                    <div class="plan-stat"><i class="fa-solid fa-users text-primary"></i> <span>${membersCount} عضو</span></div>
                    <div class="plan-stat"><i class="fa-solid fa-tag text-success"></i> <span>${Number(plan.pricePerMember || 0).toLocaleString('ar-EG')} ج.م / عضو</span></div>
                    <div class="plan-stat"><i class="fa-solid fa-calendar-day text-info"></i> <span>${durationText}</span></div>
                    <div class="plan-stat"><i class="fa-solid fa-envelope text-muted"></i> <span>${escapeHtml(maskedEmail)}</span></div>
                    ${planFin.planCost ? `<div class="plan-stat"><i class="fa-solid fa-receipt text-warning"></i> <span>${costText}</span></div>` : ''}
                    <div class="plan-stat" style="border-top:1px solid rgba(255,255,255,0.06); padding-top:0.5rem; margin-top:0.3rem;">
                        <i class="fa-solid fa-coins text-success"></i>
                        <span>محصّل: <strong class="text-success">${Number(planFin.totalPaid !== undefined ? planFin.totalPaid : planFin.totalRevenue).toLocaleString('ar-EG')}</strong> ج.م</span>
                    </div>
                    ${planFin.planCost ? `<div class="plan-stat">
                        <i class="fa-solid fa-chart-line ${(planFin.netCollected !== undefined ? planFin.netCollected : planFin.netProfit) >= 0 ? 'text-success' : 'text-danger'}"></i>
                        <span>صافي محصّل: <strong class="${(planFin.netCollected !== undefined ? planFin.netCollected : planFin.netProfit) >= 0 ? 'text-success' : 'text-danger'}">${(planFin.netCollected !== undefined ? planFin.netCollected : planFin.netProfit) >= 0 ? '+' : ''}${Number(planFin.netCollected !== undefined ? planFin.netCollected : planFin.netProfit).toLocaleString('ar-EG')}</strong> ج.م</span>
                    </div>` : ''}
                </div>
                <div class="plan-card-actions">
                    <button class="btn btn-sm btn-outline edit-plan-btn" data-id="${plan.id}">
                        <i class="fa-solid fa-pen"></i> تعديل
                    </button>
                    <button class="btn btn-sm btn-outline add-plan-expense-btn" data-id="${plan.id}">
                        <i class="fa-solid fa-receipt"></i> مصروف
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
        grid.querySelectorAll('.add-plan-expense-btn').forEach(btn => {
            btn.addEventListener('click', (e) => { e.stopPropagation(); addPlanExpenseFromUi(btn.dataset.id); });
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
        const cycleSelect = document.getElementById('planBillingCycle');
        if (cycleSelect) cycleSelect.value = 'custom_days';
        populatePlanPlatformsDropdown('');
        syncPlanBillingCycleUi();
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
        const cycleSelect = document.getElementById('planBillingCycle');
        if (cycleSelect) cycleSelect.value = DataManager.normalizePlanBillingCycle(plan);
        syncPlanBillingCycleUi();
        document.getElementById('planModalTitle').innerText = 'تعديل خطة الاشتراك';
        openModal('planModal');
    }

    async function addPlanExpenseFromUi(planId) {
        const plan = DataManager.getServicePlanById(planId);
        if (!plan) return;
        const today = new Date().toISOString().split('T')[0];
        const defaultAmount = Number(plan.registrationCost || 0);
        const planCycle = DataManager.normalizePlanBillingCycle(plan);
        const cycleMonths = DataManager.getBillingCycleMonths(planCycle);
        const expenses = DataManager.getPlanExpenses ? DataManager.getPlanExpenses(plan.id).slice() : [];
        const latestExpense = expenses
            .filter(expense => expense.periodEnd)
            .sort((a, b) => (b.periodEnd || '').localeCompare(a.periodEnd || ''))[0];
        const defaultStart = latestExpense?.periodEnd || today;
        const defaultEnd = cycleMonths
            ? DataManager.addCalendarMonths(defaultStart, cycleMonths)
            : addDaysToDate(defaultStart, parseInt(plan.durationDays || 30, 10));
        const result = await Swal.fire({
            title: 'إضافة مصروف للخطة',
            html: `
                <div class="swal-form-grid">
                    <div class="swal-inline-note">سجل هنا تكلفة دورة الخطة فقط. هذا لا يحدث تلقائيًا بدون تسجيل تجديد أو إضافة مصروف دورة.</div>
                    <label style="display:block;text-align:right;margin-bottom:0.35rem;">المبلغ</label>
                    <input type="number" id="planExpenseAmount" class="swal2-input" min="0" step="0.01" value="${defaultAmount || ''}" style="width:100%;margin:0 0 0.75rem;">
                    <label style="display:block;text-align:right;margin-bottom:0.35rem;">من تاريخ</label>
                    <input type="date" id="planExpenseStart" class="swal2-input" value="${defaultStart}" style="width:100%;margin:0 0 0.75rem;">
                    <label style="display:block;text-align:right;margin-bottom:0.35rem;">إلى تاريخ</label>
                    <input type="date" id="planExpenseEnd" class="swal2-input" value="${defaultEnd}" style="width:100%;margin:0 0 0.75rem;">
                    <label style="display:block;text-align:right;margin-bottom:0.35rem;">ملاحظة</label>
                    <input type="text" id="planExpenseNote" class="swal2-input" value="مصروف دورة فوترة" style="width:100%;margin:0;">
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'إضافة المصروف',
            cancelButtonText: 'إلغاء',
            background: '#111827',
            color: '#fff',
            preConfirm: () => {
                const amount = parseFloat(document.getElementById('planExpenseAmount').value);
                const periodStart = document.getElementById('planExpenseStart').value;
                const periodEnd = document.getElementById('planExpenseEnd').value;
                if (!amount || amount < 0 || !periodStart || !periodEnd) {
                    Swal.showValidationMessage('يرجى إدخال مبلغ وفترة صحيحة');
                    return false;
                }
                return {
                    planId,
                    platformId: plan.platformId || '',
                    amount,
                    periodStart,
                    periodEnd,
                    paidAt: today,
                    note: document.getElementById('planExpenseNote').value.trim()
                };
            }
        });

        if (!result.isConfirmed) return;
        try {
            await DataManager.addPlanExpense(result.value);
            renderPlans();
            renderAccounts();
            renderDashboard();
            showToast('تمت إضافة مصروف الخطة');
        } catch (error) {
            console.error('Failed to add plan expense:', error);
            Swal.fire({ icon: 'error', title: 'تعذر إضافة المصروف', text: 'حدث خطأ أثناء حفظ مصروف الخطة.', background: '#111827', color: '#fff' });
        }
    }

    async function deletePlanExpenseFromUi(expenseId) {
        const result = await Swal.fire({
            title: 'حذف مصروف الخطة؟',
            text: 'سيتم حذف هذا السطر من مصروفات الخطة فقط.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'حذف',
            cancelButtonText: 'إلغاء',
            background: '#111827',
            color: '#fff'
        });
        if (!result.isConfirmed) return;

        try {
            await DataManager.deletePlanExpense(expenseId);
            renderPlans();
            renderDashboard();
            refreshFinancialLedgerDisplays();
            showToast('تم حذف مصروف الخطة');
        } catch (error) {
            console.error('Failed to delete plan expense:', error);
            Swal.fire({ icon: 'error', title: 'تعذر حذف المصروف', text: 'حدث خطأ أثناء حذف مصروف الخطة.', background: '#111827', color: '#fff' });
        }
    }

    async function undoRenewalFromLedger(renewalId) {
        const result = await Swal.fire({
            title: 'تراجع عن التجديد؟',
            text: 'سيتم حذف آخر تجديد وإرجاع الاشتراك للفترة السابقة. لا يمكن التراجع إلا عن آخر تجديد للحفاظ على تسلسل الفترات.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'تراجع عن التجديد',
            cancelButtonText: 'إلغاء',
            confirmButtonColor: '#f59e0b',
            background: '#111827',
            color: '#fff'
        });
        if (!result.isConfirmed) return;

        try {
            await DataManager.undoRenewal(renewalId);
            refreshAccountViews();
            refreshFinancialLedgerDisplays();
            showToast('تم التراجع عن التجديد');
        } catch (error) {
            console.error('Failed to undo renewal:', error);
            const message = error && error.message === 'Only latest renewal can be undone safely'
                ? 'يمكن التراجع عن آخر تجديد فقط لهذا الاشتراك.'
                : 'حدث خطأ أثناء التراجع عن التجديد.';
            Swal.fire({ icon: 'error', title: 'تعذر التراجع', text: message, background: '#111827', color: '#fff' });
        }
    }

    async function deleteAccountCascadeFromLedger(accountId) {
        const account = DataManager.getAccounts().find(acc => acc.id === accountId);
        if (!account) return;
        const relatedRenewals = DataManager.getRenewalsForAccount(accountId).length;
        const result = await Swal.fire({
            title: 'حذف الاشتراك وملحقاته؟',
            text: `سيتم حذف الاشتراك و ${relatedRenewals} تجديد مرتبط به، وأي مصروف خطة مسجل بسبب هذا الاشتراك فقط.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'حذف الاشتراك',
            cancelButtonText: 'إلغاء',
            confirmButtonColor: '#ef4444',
            background: '#111827',
            color: '#fff'
        });
        if (!result.isConfirmed) return;

        try {
            await DataManager.deleteAccountCascade(accountId);
            refreshAccountViews();
            renderCustomers();
            refreshFinancialLedgerDisplays();
            showToast('تم حذف الاشتراك وملحقاته');
        } catch (error) {
            console.error('Failed to delete account cascade:', error);
            Swal.fire({ icon: 'error', title: 'تعذر الحذف', text: 'حدث خطأ أثناء حذف الاشتراك وملحقاته.', background: '#111827', color: '#fff' });
        }
    }

    document.getElementById('btnSavePlan').addEventListener('click', async (e) => {
        e.preventDefault();
        const platformId = document.getElementById('planPlatform').value;
        const startDate = document.getElementById('planStartDate').value;
        const billingCycle = document.getElementById('planBillingCycle').value || 'custom_days';
        const rawDurationDays = document.getElementById('planDurationDays').value;
        const durationDays = getPlanCompatibilityDuration(billingCycle, rawDurationDays);

        if (!platformId) {
            Swal.fire({ icon: 'error', title: 'بيانات ناقصة', text: 'يرجى اختيار المنصة على الأقل', background: '#111827', color: '#fff' });
            return;
        }

        if (billingCycle === 'custom_days' && (!parseInt(rawDurationDays, 10) || parseInt(rawDurationDays, 10) < 1)) {
            Swal.fire({ icon: 'error', title: 'مدة غير صحيحة', text: 'مدة الخطة مطلوبة فقط عند اختيار أيام مخصصة.', background: '#111827', color: '#fff' });
            return;
        }

        const planData = {
            platformId,
            name: document.getElementById('planName').value.trim(),
            startDate,
            billingCycle,
            durationDays,
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
        if (document.getElementById('view-accounts')?.classList.contains('active')) renderAccounts();
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
                if (document.getElementById('view-accounts')?.classList.contains('active')) renderAccounts();
                showToast('تم حذف الخطة');
            }
        });
    }

    // ============================================================
    //  ACCOUNTS (Subscriptions)
    // ============================================================
    searchAccounts.addEventListener('input', renderAccounts);
    filterStatus.addEventListener('change', renderAccounts);
    const filterPayment = document.getElementById('filterPayment');
    if (filterPayment) { filterPayment.addEventListener('change', renderAccounts); }
    const filterPlan = ensureAccountsPlanFilter();
    if (filterPlan) { filterPlan.addEventListener('change', renderAccounts); }

    function ensureAccountsPlanFilter() {
        const existing = document.getElementById('filterPlan');
        if (existing) return existing;
        const filterBox = document.querySelector('#view-accounts .filter-box');
        if (!filterBox) return null;
        const select = document.createElement('select');
        select.id = 'filterPlan';
        select.className = 'form-control';
        select.style.minWidth = '160px';
        filterBox.appendChild(select);
        return select;
    }

    function ensureAccountsPlanSummary() {
        const existing = document.getElementById('accountsPlanSummary');
        if (existing) return existing;
        const tableHeader = document.querySelector('#view-accounts .table-header');
        if (!tableHeader) return null;
        const summary = document.createElement('div');
        summary.id = 'accountsPlanSummary';
        summary.className = 'accounts-plan-summary';
        tableHeader.insertAdjacentElement('afterend', summary);
        return summary;
    }

    function populateAccountsPlanFilter(selectedValue = 'all') {
        const select = document.getElementById('filterPlan');
        if (!select) return;
        const plans = (DataManager.getCanonicalServicePlans ? DataManager.getCanonicalServicePlans() : DataManager.getServicePlans())
            .slice()
            .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
        const validValues = new Set(['all', 'none', ...plans.map(plan => plan.id)]);
        const nextValue = validValues.has(selectedValue) ? selectedValue : 'all';
        select.innerHTML = `
            <option value="all">كل الخطط</option>
            <option value="none">بدون خطة</option>
            ${plans.map(plan => `<option value="${escapeAttr(plan.id)}">${escapeHtml(plan.name || 'خطة بدون اسم')}</option>`).join('')}
        `;
        select.value = nextValue;
    }

    function renderAccountsPlanSummary(planFilterVal, visibleAccounts) {
        const summary = ensureAccountsPlanSummary();
        if (!summary) return;
        if (!planFilterVal || planFilterVal === 'all') {
            summary.style.display = 'none';
            summary.innerHTML = '';
            return;
        }

        const selectedPlan = planFilterVal === 'none' ? null : DataManager.getServicePlanById(planFilterVal);
        const summaryTitle = selectedPlan ? selectedPlan.name || 'خطة بدون اسم' : 'اشتراكات بدون خطة';
        const uniqueCustomers = new Set(visibleAccounts.map(acc => acc.customerId || acc.customerName || acc.id));
        const statusCounts = visibleAccounts.reduce((counts, account) => {
            const status = DataManager.getAccountStatus(account).status;
            if (status === 'active' || status === 'warning') counts.active++;
            else if (status === 'expired') counts.expired++;
            else if (['paused', 'cancelled', 'closed'].includes(status)) counts.inactive++;
            else counts.needsReview++;
            return counts;
        }, { active: 0, expired: 0, inactive: 0, needsReview: 0 });
        const totals = visibleAccounts.reduce((accum, account) => {
            const financials = DataManager.getAccountFinancials(account);
            accum.billed += financials.billedAmount || 0;
            accum.paid += financials.paidAmount || 0;
            accum.unpaid += financials.unpaidAmount || 0;
            return accum;
        }, { billed: 0, paid: 0, unpaid: 0 });
        const planCost = selectedPlan ? DataManager.getPlanCost(selectedPlan) : 0;
        const netCollected = totals.paid - planCost;
        const netClass = netCollected >= 0 ? 'success' : 'danger';

        summary.style.display = '';
        summary.innerHTML = `
            <div class="accounts-plan-summary-title">
                <span><i class="fa-solid fa-chart-simple text-primary"></i> ${escapeHtml(summaryTitle)}</span>
                ${selectedPlan ? `<button class="btn btn-secondary btn-sm btn-plan-summary-expense" data-id="${escapeAttr(selectedPlan.id)}">
                    <i class="fa-solid fa-receipt"></i> تسجيل مصروف دورة
                </button>` : ''}
            </div>
            <div class="accounts-plan-summary-grid">
                <div class="accounts-plan-summary-card">
                    <small>الاشتراكات الظاهرة</small>
                    <strong>${visibleAccounts.length.toLocaleString('ar-EG')}</strong>
                </div>
                <div class="accounts-plan-summary-card">
                    <small>الأعضاء</small>
                    <strong>${uniqueCustomers.size.toLocaleString('ar-EG')}</strong>
                </div>
                <div class="accounts-plan-summary-card success">
                    <small>نشط/قارب</small>
                    <strong>${statusCounts.active.toLocaleString('ar-EG')}</strong>
                </div>
                <div class="accounts-plan-summary-card danger">
                    <small>منتهي</small>
                    <strong>${statusCounts.expired.toLocaleString('ar-EG')}</strong>
                </div>
                <div class="accounts-plan-summary-card">
                    <small>موقوف/ملغي/مغلق</small>
                    <strong>${statusCounts.inactive.toLocaleString('ar-EG')}</strong>
                </div>
                <div class="accounts-plan-summary-card">
                    <small>تكلفة الخطة عليك</small>
                    <strong>${Number(planCost).toLocaleString('ar-EG')} ج.م</strong>
                </div>
                <div class="accounts-plan-summary-card">
                    <small>مستحق من الأعضاء</small>
                    <strong>${Number(totals.billed).toLocaleString('ar-EG')} ج.م</strong>
                </div>
                <div class="accounts-plan-summary-card success">
                    <small>محصل من الأعضاء</small>
                    <strong>${Number(totals.paid).toLocaleString('ar-EG')} ج.م</strong>
                </div>
                <div class="accounts-plan-summary-card danger">
                    <small>غير المسدد</small>
                    <strong>${Number(totals.unpaid).toLocaleString('ar-EG')} ج.م</strong>
                </div>
                <div class="accounts-plan-summary-card ${netClass}">
                    <small>صافي المحصل</small>
                    <strong>${netCollected >= 0 ? '+' : ''}${Number(netCollected).toLocaleString('ar-EG')} ج.م</strong>
                </div>
            </div>
        `;
        summary.querySelector('.btn-plan-summary-expense')?.addEventListener('click', () => addPlanExpenseFromUi(selectedPlan.id));
    }

    function renderAccounts() {
        const tableBody = document.querySelector('#accountsTable tbody');
        const emptyState = document.getElementById('accountsEmptyState');
        const searchTerm = searchAccounts.value.toLowerCase();
        const statusFilterVal = filterStatus.value;
        const paymentFilterVal = filterPayment ? filterPayment.value : 'all';
        const planFilterVal = filterPlan ? filterPlan.value : 'all';
        const accounts = DataManager.getAccounts();
        populateAccountsPlanFilter(planFilterVal);

        tableBody.innerHTML = '';

        if (accounts.length === 0) {
            emptyState.style.display = 'block';
            document.querySelector('#accountsTable').style.display = 'none';
            return;
        }

        let visibleCount = 0;
        const visibleAccounts = [];

        accounts.forEach(acc => {
            const platform = DataManager.getPlatformById(acc.platformId);
            const pName = platform ? platform.name : 'غير محدد';
            const cust = DataManager.getCustomerById(acc.customerId);
            const custName = cust ? cust.name : (acc.customerName || 'غير محدد');
            const custPhone = cust ? cust.phone : (acc.customerPhone || '');
            const statusInfo = DataManager.getAccountStatus(acc);
            const plan = acc.servicePlanId ? DataManager.getServicePlanById(acc.servicePlanId) : null;
            const planName = plan ? (plan.name || '') : '';
            const planPlatform = plan?.platformId ? DataManager.getPlatformById(plan.platformId) : null;
            const planPlatformName = planPlatform ? (planPlatform.name || '') : '';

            const matchesSearch =
                custName.toLowerCase().includes(searchTerm) ||
                (custPhone || '').toLowerCase().includes(searchTerm) ||
                pName.toLowerCase().includes(searchTerm) ||
                planName.toLowerCase().includes(searchTerm) ||
                planPlatformName.toLowerCase().includes(searchTerm) ||
                (acc.username || '').toLowerCase().includes(searchTerm);

            const matchesStatus = statusFilterVal === 'all' || statusInfo.status === statusFilterVal;
            const matchesPlan =
                planFilterVal === 'all' ||
                (planFilterVal === 'none' && !acc.servicePlanId) ||
                (DataManager.isAccountInServicePlanGroup
                    ? DataManager.isAccountInServicePlanGroup(acc, planFilterVal)
                    : acc.servicePlanId === planFilterVal);

            const isPaid = acc.isPaid === true;
            let matchesPayment = true;
            if (paymentFilterVal === 'paid') matchesPayment = isPaid;
            if (paymentFilterVal === 'unpaid') matchesPayment = !isPaid;

            if (!matchesSearch || !matchesStatus || !matchesPayment || !matchesPlan) return;
            visibleCount++;
            visibleAccounts.push(acc);

            const revenue = parseFloat(acc.revenue || 0);
            const refund = parseFloat(acc.refund || 0);
            const netRevenue = revenue - refund;
            const accCycle = acc.billingCycle || 'custom';
            const isMonthly = accCycle === 'monthly';
            const isFollowedLifecycle = ['active', 'warning', 'expired'].includes(statusInfo.status);
            const renewalStopped = isRenewalStopped(acc);
            const lifecycleButtons = `
                ${isFollowedLifecycle && !renewalStopped && isMonthly ? `<button class="btn-icon btn-action-pill text-success renew-monthly-acc-btn" data-id="${acc.id}" title="تجديد شهري"><i class="fa-solid fa-calendar-plus"></i><span>تجديد</span></button>` : ''}
                ${isFollowedLifecycle && !renewalStopped && !isMonthly ? `<button class="btn-icon btn-action-pill text-primary renew-acc-btn" data-id="${acc.id}" title="تجديد"><i class="fa-solid fa-rotate-right"></i><span>تجديد</span></button>` : ''}
                ${isFollowedLifecycle && !renewalStopped ? `<button class="btn-icon text-warning cancel-renewal-acc-btn" data-id="${acc.id}" title="لن يجدد بنهاية الفترة"><i class="fa-solid fa-calendar-xmark"></i></button>` : ''}
                ${isFollowedLifecycle && renewalStopped ? `<button class="btn-icon text-success restore-renewal-acc-btn" data-id="${acc.id}" title="إعادة التجديد"><i class="fa-solid fa-calendar-check"></i></button>` : ''}
                ${isFollowedLifecycle ? `<button class="btn-icon text-warning pause-acc-btn" data-id="${acc.id}" title="إيقاف مؤقت"><i class="fa-solid fa-pause"></i></button>` : ''}
                ${isFollowedLifecycle || statusInfo.status === 'paused' ? `<button class="btn-icon text-danger cancel-acc-btn" data-id="${acc.id}" title="إلغاء الاشتراك"><i class="fa-solid fa-ban"></i></button>` : ''}
                ${statusInfo.status === 'paused' || statusInfo.status === 'cancelled' ? `<button class="btn-icon text-success reactivate-acc-btn" data-id="${acc.id}" title="إعادة تفعيل"><i class="fa-solid fa-play"></i></button>` : ''}
                ${statusInfo.status === 'expired' ? `<button class="btn-icon text-danger close-acc-btn" data-id="${acc.id}" title="إغلاق الاشتراك"><i class="fa-solid fa-circle-stop"></i></button>` : ''}
            `;

            const lifecycleDateMap = {
                closed: acc.closedAt,
                paused: acc.pausedAt,
                cancelled: acc.cancelledAt
            };
            const isNonTemporalStatus = ['closed', 'paused', 'cancelled'].includes(statusInfo.status);
            const accountTimingText = getFollowUpTimingText(acc, statusInfo);
            const dateDurationHtml = isNonTemporalStatus
                ? `<div>${acc.startDate || '-'}</div><div class="text-muted" style="font-size:0.82rem;font-weight:700;">${statusInfo.label}${lifecycleDateMap[statusInfo.status] ? ' - ' + new Date(lifecycleDateMap[statusInfo.status]).toLocaleDateString('ar-EG') : ''}</div>`
                : `<div>${acc.startDate || '-'}</div>
                    <div class="text-primary" style="font-size:0.82rem;font-weight:700;">
                        ${acc.durationDays} يوم إجمالي
                        <div class="${['expired', 'needs_review'].includes(statusInfo.status) || (statusInfo.daysLeft !== null && statusInfo.daysLeft <= 7) ? 'text-danger' : 'text-warning'}" style="font-size:0.9rem; margin-top:2px;">
                            (${accountTimingText})
                        </div>
                    </div>`;

            const paidBtn = `<button class="btn-icon toggle-paid-btn" data-id="${acc.id}" data-paid="${isPaid}" title="${isPaid ? 'تم السداد - اضغط للتغيير' : 'لم يسدد - اضغط للتغيير'}">
                <i class="fa-solid ${isPaid ? 'fa-circle-check text-success' : 'fa-circle-xmark text-danger'}"></i>
            </button>`;

            const billingLabel = accCycle ? `<div class="account-billing-row">${getBillingCycleBadge(accCycle, 'account-billing-badge')}</div>` : '';
            const serviceLabel = plan
                ? `<div>${escapeHtml(pName)}</div><div class="text-muted" style="font-size:0.78rem">${escapeHtml(plan.name || '')}</div>${billingLabel}`
                : `<div>${escapeHtml(pName)}</div>${billingLabel}`;

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
                <td data-label="التاريخ/المدة">${dateDurationHtml}</td>
                <td data-label="الماليات" class="col-financials">
                    <div>اشتراك: <span class="text-success">${Number(acc.revenue).toLocaleString('ar-EG')}</span> ج.م</div>
                    ${refund > 0 ? '<div>تعويض: <span class="text-danger">' + Number(acc.refund).toLocaleString('ar-EG') + '</span> ج.م</div>' : ''}
                </td>
                <td data-label="سدّد؟" class="text-center">${paidBtn}</td>
                <td data-label="الكود / ملاحظات">
                    <div style="font-family:monospace;user-select:text;font-size:0.85rem;">${escapeHtml(acc.activationCode || '-')}</div>
                    <div class="text-muted" style="font-size:0.78rem">${escapeHtml(acc.notes ? (acc.notes.length > 30 ? acc.notes.substring(0, 30) + '...' : acc.notes) : '')}</div>
                </td>
                <td data-label="الحالة">
                    <span class="status-badge status-${statusInfo.status}">${statusInfo.label}</span>
                    ${renewalStopped ? '<span class="status-badge no-renewal-badge">لن يجدد</span>' : ''}
                </td>
                <td data-label="إجراءات">
                    <div class="actions-cell">
                        <button class="btn-icon edit-acc-btn" data-id="${acc.id}" title="تعديل"><i class="fa-solid fa-pen text-info"></i></button>
                        <button class="btn-icon delete-acc-btn" data-id="${acc.id}" title="حذف"><i class="fa-solid fa-trash text-danger"></i></button>
                        ${lifecycleButtons}
                        <button class="btn-icon text-success whatsapp-acc-btn" data-id="${acc.id}" title="مراسلة عبر واتساب"><i class="fa-brands fa-whatsapp"></i></button>
                        <button class="btn-icon text-warning invoice-acc-btn" data-id="${acc.id}" title="توليد فاتورة"><i class="fa-solid fa-file-invoice-dollar"></i></button>
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
        tableBody.querySelectorAll('.renew-acc-btn').forEach(btn => {
            btn.addEventListener('click', () => renewAccountFromUi(btn.dataset.id));
        });
        tableBody.querySelectorAll('.renew-monthly-acc-btn').forEach(btn => {
            btn.addEventListener('click', () => renewMonthlyAccountFromUi(btn.dataset.id));
        });
        tableBody.querySelectorAll('.close-acc-btn').forEach(btn => {
            btn.addEventListener('click', () => closeAccountFromUi(btn.dataset.id));
        });
        tableBody.querySelectorAll('.pause-acc-btn').forEach(btn => {
            btn.addEventListener('click', () => pauseAccountFromUi(btn.dataset.id));
        });
        tableBody.querySelectorAll('.cancel-renewal-acc-btn').forEach(btn => {
            btn.addEventListener('click', () => cancelRenewalAtPeriodEndFromUi(btn.dataset.id));
        });
        tableBody.querySelectorAll('.restore-renewal-acc-btn').forEach(btn => {
            btn.addEventListener('click', () => restoreRenewalIntentFromUi(btn.dataset.id));
        });
        tableBody.querySelectorAll('.cancel-acc-btn').forEach(btn => {
            btn.addEventListener('click', () => cancelAccountFromUi(btn.dataset.id));
        });
        tableBody.querySelectorAll('.reactivate-acc-btn').forEach(btn => {
            btn.addEventListener('click', () => reactivateAccountFromUi(btn.dataset.id));
        });
        tableBody.querySelectorAll('.show-creds-btn').forEach(btn => {
            btn.addEventListener('click', () => showCredentials(btn.dataset.id));
        });
        tableBody.querySelectorAll('.whatsapp-acc-btn').forEach(btn => {
            btn.addEventListener('click', () => openWhatsAppAccount(btn.dataset.id));
        });
        tableBody.querySelectorAll('.invoice-acc-btn').forEach(btn => {
            btn.addEventListener('click', () => showInvoice(btn.dataset.id));
        });

        if (visibleCount === 0) {
            emptyState.style.display = 'block';
            document.querySelector('#accountsTable').style.display = 'none';
        } else {
            emptyState.style.display = 'none';
            document.querySelector('#accountsTable').style.display = 'table';
        }
        renderAccountsPlanSummary(planFilterVal, visibleAccounts);
    }

    function openWhatsAppAccount(id) {
        const acc = DataManager.getAccounts().find(a => a.id === id);
        if (!acc) return;
        const cust = DataManager.getCustomerById(acc.customerId);
        const platform = DataManager.getPlatformById(acc.platformId);
        const pName = platform ? platform.name : 'الخدمة';
        const cPhone = cust ? cust.phone : acc.customerPhone;
        const cName = cust ? cust.name : acc.customerName;

        if (!cPhone) {
            Swal.fire({ icon: 'error', title: 'عفواً', text: 'لا يوجد رقم هاتف مسجل لهذا العميل', background: '#111827', color: '#fff' });
            return;
        }

        let phone = cPhone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
        if (phone.startsWith('01')) phone = '+20' + phone.substring(1);

        const msg = encodeURIComponent(`مرحباً أ. ${cName}،\nنذكركم بانتهاء اشتراككم في خدمة (${pName}) قريباً.\nيرجى التجديد لضمان استمرار الخدمة. شكراً لاختياركم لنا!`);
        window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
    }

    function showInvoice(id) {
        const acc = DataManager.getAccounts().find(a => a.id === id);
        if (!acc) return;
        const cust = DataManager.getCustomerById(acc.customerId);
        const platform = DataManager.getPlatformById(acc.platformId);

        document.getElementById('invNumber').innerText = '#' + acc.id.substring(0, 6).toUpperCase();
        document.getElementById('invDate').innerText = new Date(acc.startDate || Date.now()).toLocaleDateString('ar-EG');
        document.getElementById('invCustomerName').innerText = cust ? cust.name : (acc.customerName || '—');
        document.getElementById('invCustomerPhone').innerText = cust ? cust.phone : (acc.customerPhone || '—');
        document.getElementById('invPlatformName').innerText = platform ? platform.name : '—';
        document.getElementById('invDuration').innerText = acc.durationDays + ' يوم';
        document.getElementById('invTotalAmount').innerText = Number(acc.revenue).toLocaleString('ar-EG') + ' ج.م';

        openModal('invoiceModal');
    }

    const btnDownloadInvoice = document.getElementById('btnDownloadInvoice');
    if (btnDownloadInvoice) {
        btnDownloadInvoice.addEventListener('click', () => {
            const element = document.getElementById('invoicePrintArea');
            const invNum = document.getElementById('invNumber').innerText;
            const opt = {
                margin: [0.5, 0.5, 0.5, 0.5],
                filename: `Invoice_${invNum}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'in', format: 'a5', orientation: 'portrait' }
            };
            html2pdf().set(opt).from(element).save();
        });
    }

    function toggleAccountPaid(id, currentPaid) {
        DataManager.updateAccountPaid(id, !currentPaid);
        renderAccounts();
        checkNotifications();
        if (document.getElementById('view-dashboard').classList.contains('active')) renderDashboard();
    }

    async function closeAccountFromUi(id) {
        const acc = DataManager.getAccounts().find(a => a.id === id);
        if (!acc) return;

        const result = await Swal.fire({
            title: 'إغلاق الاشتراك؟',
            text: 'سيبقى الاشتراك محفوظًا في البيانات، وسيختفي فقط من تنبيهات المتابعة.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'نعم، أغلقه',
            cancelButtonText: 'إلغاء',
            background: '#111827',
            color: '#fff'
        });

        if (!result.isConfirmed) return;

        try {
            await DataManager.closeAccount(id, 'expired');
            renderAccounts();
            checkNotifications();
            if (document.getElementById('view-dashboard').classList.contains('active')) renderDashboard();
            showToast('تم إغلاق الاشتراك بنجاح');
        } catch (error) {
            console.error('Failed to close account:', error);
            Swal.fire({ icon: 'error', title: 'تعذر الإغلاق', text: 'حدث خطأ أثناء تحديث الاشتراك.', background: '#111827', color: '#fff' });
        }
    }

    function refreshAccountViews() {
        renderAccounts();
        checkNotifications();
        if (document.getElementById('view-dashboard').classList.contains('active')) renderDashboard();
        if (document.getElementById('view-plans').classList.contains('active')) renderPlans();
    }

    function getPlanCycleExpensePrompt(acc, periodStart, periodEnd) {
        const plan = acc && acc.servicePlanId ? DataManager.getServicePlanById(acc.servicePlanId) : null;
        const amount = plan ? DataManager.getPlanCycleCost(plan) : 0;
        const alreadyRegistered = plan ? DataManager.hasPlanExpenseForPeriod(plan.id, periodStart, periodEnd) : false;
        return { plan, amount, alreadyRegistered, canRegister: !!plan && amount > 0 && !alreadyRegistered };
    }

    function renderPlanExpensePrompt(promptData) {
        if (!promptData.plan || promptData.amount <= 0) return '';
        if (promptData.alreadyRegistered) {
            return `<div class="swal-inline-note">تم تسجيل تكلفة دورة الخطة لهذه الفترة من قبل.</div>`;
        }
        return `
            <label style="display:block;margin-top:0.75rem;">
                <input type="checkbox" id="renewRegisterPlanExpense" checked style="margin-left:0.4rem;">
                تسجيل تكلفة دورة الخطة (${Number(promptData.amount).toLocaleString('ar-EG')} ج.م)
            </label>`;
    }

    async function pauseAccountFromUi(id) {
        const acc = DataManager.getAccounts().find(a => a.id === id);
        if (!acc) return;

        const result = await Swal.fire({
            title: 'إيقاف الاشتراك مؤقتًا؟',
            input: 'textarea',
            inputPlaceholder: 'سبب الإيقاف (اختياري)',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'إيقاف مؤقت',
            cancelButtonText: 'إلغاء',
            background: '#111827',
            color: '#fff'
        });

        if (!result.isConfirmed) return;

        try {
            await DataManager.pauseAccount(id, result.value || '');
            refreshAccountViews();
            showToast('تم إيقاف الاشتراك مؤقتًا');
        } catch (error) {
            console.error('Failed to pause account:', error);
            Swal.fire({ icon: 'error', title: 'تعذر الإيقاف', text: 'حدث خطأ أثناء تحديث الاشتراك.', background: '#111827', color: '#fff' });
        }
    }

    async function cancelRenewalAtPeriodEndFromUi(id) {
        const acc = DataManager.getAccounts().find(a => a.id === id);
        if (!acc) return;

        const period = DataManager.getAccountPeriod(acc);
        const result = await Swal.fire({
            title: 'إيقاف التجديد؟',
            text: `سيظل الاشتراك نشطًا حتى ${period.endDate || 'نهاية مدته'}، لكنه لن يظهر كتجديد مطلوب.`,
            input: 'textarea',
            inputPlaceholder: 'سبب عدم التجديد (اختياري)',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'لن يجدد',
            cancelButtonText: 'رجوع',
            background: '#111827',
            color: '#fff'
        });

        if (!result.isConfirmed) return;

        try {
            await DataManager.cancelRenewalAtPeriodEnd(id, result.value || '');
            refreshAccountViews();
            showToast('تم تحديد الاشتراك: لن يجدد بنهاية الفترة');
        } catch (error) {
            console.error('Failed to cancel renewal intent:', error);
            Swal.fire({ icon: 'error', title: 'تعذر تحديث التجديد', text: 'حدث خطأ أثناء تحديث حالة التجديد.', background: '#111827', color: '#fff' });
        }
    }

    async function restoreRenewalIntentFromUi(id) {
        const acc = DataManager.getAccounts().find(a => a.id === id);
        if (!acc) return;

        const result = await Swal.fire({
            title: 'إعادة التجديد؟',
            text: 'سيعود الاشتراك للظهور في المتابعة عند قرب نهاية الفترة.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'إعادة التجديد',
            cancelButtonText: 'إلغاء',
            background: '#111827',
            color: '#fff'
        });

        if (!result.isConfirmed) return;

        try {
            await DataManager.restoreRenewalIntent(id);
            refreshAccountViews();
            showToast('تمت إعادة التجديد للاشتراك');
        } catch (error) {
            console.error('Failed to restore renewal intent:', error);
            Swal.fire({ icon: 'error', title: 'تعذر تحديث التجديد', text: 'حدث خطأ أثناء تحديث حالة التجديد.', background: '#111827', color: '#fff' });
        }
    }

    async function cancelAccountFromUi(id) {
        const acc = DataManager.getAccounts().find(a => a.id === id);
        if (!acc) return;

        const result = await Swal.fire({
            title: 'إلغاء الاشتراك؟',
            text: 'سيبقى الاشتراك محفوظًا في الجدول ولن يظهر في التنبيهات أو مركز المتابعة.',
            input: 'textarea',
            inputPlaceholder: 'سبب الإلغاء (اختياري)',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'إلغاء الاشتراك',
            cancelButtonText: 'رجوع',
            confirmButtonColor: '#ef4444',
            background: '#111827',
            color: '#fff'
        });

        if (!result.isConfirmed) return;

        try {
            await DataManager.cancelAccount(id, result.value || '');
            refreshAccountViews();
            showToast('تم إلغاء الاشتراك');
        } catch (error) {
            console.error('Failed to cancel account:', error);
            Swal.fire({ icon: 'error', title: 'تعذر الإلغاء', text: 'حدث خطأ أثناء تحديث الاشتراك.', background: '#111827', color: '#fff' });
        }
    }

    async function reactivateAccountFromUi(id) {
        const acc = DataManager.getAccounts().find(a => a.id === id);
        if (!acc) return;

        const today = new Date().toISOString().split('T')[0];
        const cycleMonths = DataManager.getBillingCycleMonths(acc.billingCycle);
        const defaultEnd = cycleMonths
            ? DataManager.addCalendarMonths(today, cycleMonths)
            : addDaysToDate(today, acc.durationDays || 30);
        let endDateTouched = false;

        const result = await Swal.fire({
            title: 'إعادة تفعيل الاشتراك',
            html: `
                <div class="swal-form-grid">
                    <label style="display:block;text-align:right;margin-bottom:0.35rem;">تاريخ البداية</label>
                    <input type="date" id="reactivateStartDate" class="swal2-input" value="${today}" style="width:100%;margin:0 0 0.75rem;">
                    <label style="display:block;text-align:right;margin-bottom:0.35rem;">تاريخ النهاية</label>
                    <input type="date" id="reactivateEndDate" class="swal2-input" value="${defaultEnd}" style="width:100%;margin:0 0 0.75rem;">
                    <label style="display:block;text-align:right;margin-bottom:0.35rem;">سبب إعادة التفعيل (اختياري)</label>
                    <textarea id="reactivateReason" class="swal2-textarea" style="width:100%;margin:0;min-height:5rem;"></textarea>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'إعادة تفعيل',
            cancelButtonText: 'إلغاء',
            background: '#111827',
            color: '#fff',
            didOpen: () => {
                const startInput = document.getElementById('reactivateStartDate');
                const endInput = document.getElementById('reactivateEndDate');
                endInput.addEventListener('change', () => {
                    endDateTouched = true;
                });
                startInput.addEventListener('change', () => {
                    if (endDateTouched) return;
                    endInput.value = cycleMonths
                        ? DataManager.addCalendarMonths(startInput.value, cycleMonths)
                        : addDaysToDate(startInput.value, acc.durationDays || 30);
                });
            },
            preConfirm: () => {
                const startDate = document.getElementById('reactivateStartDate').value;
                const endDate = document.getElementById('reactivateEndDate').value;
                const reason = document.getElementById('reactivateReason').value.trim();
                if (!startDate || !endDate) {
                    Swal.showValidationMessage('يرجى إدخال تاريخ البداية والنهاية');
                    return false;
                }
                if (new Date(endDate) < new Date(startDate)) {
                    Swal.showValidationMessage('تاريخ النهاية يجب أن يكون بعد تاريخ البداية أو مساويًا له');
                    return false;
                }
                return { startDate, endDate, reason };
            }
        });

        if (!result.isConfirmed) return;

        try {
            await DataManager.reactivateAccount(id, result.value);
            refreshAccountViews();
            showToast('تمت إعادة تفعيل الاشتراك');
        } catch (error) {
            console.error('Failed to reactivate account:', error);
            Swal.fire({ icon: 'error', title: 'تعذر إعادة التفعيل', text: 'حدث خطأ أثناء تحديث الاشتراك.', background: '#111827', color: '#fff' });
        }
    }

    async function renewAccountFromUi(id) {
        const acc = DataManager.getAccounts().find(a => a.id === id);
        if (!acc) return;
        if (acc.billingCycle === 'monthly') {
            await renewMonthlyAccountFromUi(id);
            return;
        }

        const today = new Date().toISOString().split('T')[0];
        const currentDuration = parseInt(acc.durationDays || 30);
        const defaultEndDate = addDaysToDate(today, currentDuration);
        const planExpensePrompt = getPlanCycleExpensePrompt(acc, today, defaultEndDate);
        const result = await Swal.fire({
            title: 'تجديد الاشتراك',
            html: `
                <div class="swal-form-grid">
                    <label style="display:block;text-align:right;margin-bottom:0.35rem;">تاريخ البداية الجديد</label>
                    <input type="date" id="renewStartDate" class="swal2-input" value="${today}" style="width:100%;margin:0 0 0.75rem;">
                    <label style="display:block;text-align:right;margin-bottom:0.35rem;">المدة بالأيام</label>
                    <input type="number" id="renewDurationDays" class="swal2-input" value="${currentDuration}" min="1" style="width:100%;margin:0 0 0.75rem;">
                    <label style="display:block;text-align:right;margin-bottom:0.35rem;">مبلغ الفاتورة</label>
                    <input type="number" id="renewAmount" class="swal2-input" value="${Number(acc.revenue || 0)}" min="0" step="0.01" style="width:100%;margin:0 0 0.75rem;">
                    <label style="display:block;margin:0.25rem 0 0.5rem;">
                        <input type="checkbox" id="renewPaid" style="margin-left:0.4rem;">
                        تم السداد
                    </label>
                    <label style="display:block;text-align:right;margin-bottom:0.35rem;">المدفوع فعليًا</label>
                    <input type="number" id="renewPaidAmount" class="swal2-input" value="0" min="0" step="0.01" style="width:100%;margin:0;">
                    ${renderPlanExpensePrompt(planExpensePrompt)}
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'تجديد',
            cancelButtonText: 'إلغاء',
            background: '#111827',
            color: '#fff',
            didOpen: () => {
                const paidCheck = document.getElementById('renewPaid');
                const amountInput = document.getElementById('renewAmount');
                const paidAmountInput = document.getElementById('renewPaidAmount');
                if (paidCheck && amountInput && paidAmountInput) {
                    paidCheck.addEventListener('change', () => {
                        paidAmountInput.value = paidCheck.checked ? (amountInput.value || 0) : 0;
                    });
                }
            },
            preConfirm: () => {
                const startDate = document.getElementById('renewStartDate').value;
                const durationDays = parseInt(document.getElementById('renewDurationDays').value);
                if (!startDate || !durationDays || durationDays < 1) {
                    Swal.showValidationMessage('يرجى إدخال تاريخ ومدة صحيحة');
                    return false;
                }
                return {
                    startDate,
                    durationDays,
                    amount: parseFloat(document.getElementById('renewAmount').value) || 0,
                    isPaid: document.getElementById('renewPaid').checked,
                    paidAmount: parseFloat(document.getElementById('renewPaidAmount').value) || 0,
                    registerPlanExpense: document.getElementById('renewRegisterPlanExpense')?.checked === true,
                    planExpenseAmount: planExpensePrompt.amount
                };
            }
        });

        if (!result.isConfirmed) return;

        try {
            await DataManager.renewAccount(id, result.value);
            refreshAccountViews();
            showToast('تم تجديد الاشتراك بنجاح');
        } catch (error) {
            console.error('Failed to renew account:', error);
            Swal.fire({ icon: 'error', title: 'تعذر التجديد', text: 'حدث خطأ أثناء تحديث الاشتراك.', background: '#111827', color: '#fff' });
        }
    }

    async function renewMonthlyAccountFromUi(id) {
        const acc = DataManager.getAccounts().find(a => a.id === id);
        if (!acc) return;
        window.renewingMonthlyIds = window.renewingMonthlyIds || {};
        if (window.renewingMonthlyIds[id]) return;
        const period = DataManager.getAccountPeriod(acc);
        const newStart = period.endDate || new Date().toISOString().split('T')[0];
        const newEnd = DataManager.addCalendarMonths(newStart, 1);
        const planExpensePrompt = getPlanCycleExpensePrompt(acc, newStart, newEnd);

        const result = await Swal.fire({
            title: 'تجديد شهري',
            html: `
                <div style="text-align:right;line-height:1.8;">
                    <div>الفترة الجديدة:</div>
                    <strong>${newStart}</strong> إلى <strong>${newEnd}</strong>
                    <label style="display:block;margin-top:0.75rem;">
                        <input type="checkbox" id="renewMonthlyPaid" style="margin-left:0.4rem;">
                        تم السداد
                    </label>
                    <label style="display:block;margin-top:0.75rem;">مبلغ الفاتورة</label>
                    <input type="number" id="renewMonthlyAmount" class="swal2-input" min="0" step="0.01" value="${Number(acc.revenue || 0)}" style="width:100%;margin:0 0 0.5rem;">
                    <label style="display:block;">المدفوع فعليًا</label>
                    <input type="number" id="renewMonthlyPaidAmount" class="swal2-input" min="0" step="0.01" value="0" style="width:100%;margin:0;">
                    ${renderPlanExpensePrompt(planExpensePrompt)}
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'تجديد الشهر',
            cancelButtonText: 'إلغاء',
            background: '#111827',
            color: '#fff',
            didOpen: () => {
                const paidCheck = document.getElementById('renewMonthlyPaid');
                const amountInput = document.getElementById('renewMonthlyAmount');
                const paidAmountInput = document.getElementById('renewMonthlyPaidAmount');
                if (paidCheck && amountInput && paidAmountInput) {
                    paidCheck.addEventListener('change', () => {
                        paidAmountInput.value = paidCheck.checked ? (amountInput.value || 0) : 0;
                    });
                }
            },
            preConfirm: () => ({
                startDate: newStart,
                endDate: newEnd,
                isPaid: document.getElementById('renewMonthlyPaid').checked,
                amount: parseFloat(document.getElementById('renewMonthlyAmount').value) || 0,
                paidAmount: parseFloat(document.getElementById('renewMonthlyPaidAmount').value) || 0,
                registerPlanExpense: document.getElementById('renewRegisterPlanExpense')?.checked === true,
                planExpenseAmount: planExpensePrompt.amount
            })
        });

        if (!result.isConfirmed) return;

        try {
            window.renewingMonthlyIds[id] = true;
            await DataManager.renewMonthlyAccount(id, result.value);
            refreshAccountViews();
            showToast('تم تجديد الاشتراك الشهري بنجاح');
        } catch (error) {
            console.error('Failed to renew monthly account:', error);
            Swal.fire({ icon: 'error', title: 'تعذر التجديد الشهري', text: 'حدث خطأ أثناء تحديث الاشتراك.', background: '#111827', color: '#fff' });
        } finally {
            window.renewingMonthlyIds[id] = false;
        }
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
    function enhancePlatformsPage() {
        const section = document.getElementById('view-platforms');
        const grid = document.getElementById('platformsGrid');
        if (!section || !grid || section.dataset.enhanced === 'true') return;

        section.dataset.enhanced = 'true';
        const newPlatformBtn = document.getElementById('btnNewPlatform');

        const tabs = document.createElement('div');
        tabs.className = 'subtabs platforms-subtabs';
        tabs.innerHTML = `
            <button class="subtab active" type="button" data-platform-tab="services">
                <i class="fa-solid fa-layer-group"></i><span>الخدمات</span>
            </button>
            <button class="subtab" type="button" data-platform-tab="jobs">
                <i class="fa-solid fa-briefcase"></i><span>الوظائف</span>
            </button>
            <button class="subtab" type="button" data-platform-tab="workplaces">
                <i class="fa-solid fa-building"></i><span>جهات العمل</span>
            </button>`;

        const servicesPanel = document.createElement('div');
        servicesPanel.className = 'platform-tab-panel active';
        servicesPanel.dataset.platformPanel = 'services';
        grid.parentNode.insertBefore(tabs, grid);
        grid.parentNode.insertBefore(servicesPanel, grid);
        servicesPanel.appendChild(grid);

        const jobPanel = document.getElementById('jobTitlesList')?.closest('.lookup-section');
        const workplacePanel = document.getElementById('workplacesList')?.closest('.lookup-section');
        if (jobPanel) {
            jobPanel.classList.add('platform-tab-panel');
            jobPanel.dataset.platformPanel = 'jobs';
        }
        if (workplacePanel) {
            workplacePanel.classList.add('platform-tab-panel');
            workplacePanel.dataset.platformPanel = 'workplaces';
        }

        tabs.addEventListener('click', (e) => {
            const tab = e.target.closest('[data-platform-tab]');
            if (!tab) return;
            const target = tab.dataset.platformTab;
            tabs.querySelectorAll('.subtab').forEach(btn => btn.classList.toggle('active', btn === tab));
            section.querySelectorAll('[data-platform-panel]').forEach(panel => {
                panel.classList.toggle('active', panel.dataset.platformPanel === target);
            });
            if (newPlatformBtn) newPlatformBtn.style.display = target === 'services' ? '' : 'none';
        });
    }

    function renderPlatforms() {
        enhancePlatformsPage();
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
        const plans = DataManager.getCanonicalServicePlans ? DataManager.getCanonicalServicePlans() : DataManager.getServicePlans();
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
            const isChecked = selArr.includes(plan.id) || (DataManager.getServicePlanGroupKey
                && selArr.some(id => DataManager.getServicePlanGroupKey(id) === DataManager.getServicePlanGroupKey(plan)));
            const label = (plan.name || (platform ? platform.name : 'خطة'));
            const platName = platform ? platform.name : '';
            const cycle = DataManager.normalizePlanBillingCycle(plan);
            html += `<label class="plan-checkbox-item${isChecked ? ' checked' : ''}">
                <input type="checkbox" name="accPlanCb" value="${plan.id}" ${isChecked ? 'checked' : ''}>
                <div class="plan-cb-icon" style="background:${platform ? platform.color + '25' : '#33333355'};color:${platform ? platform.color : '#fff'};">
                    <i class="${platform ? escapeHtml(platform.icon) : 'fa-solid fa-server'}"></i>
                </div>
                <div class="plan-cb-info">
                    <strong>${escapeHtml(label)}</strong>
                    <small>${escapeHtml(platName)} · ${getBillingCycleLabel(cycle)}</small>
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

    function applyPlanBillingToAccountForm(plan) {
        if (!plan) return;
        accountEndDateManuallyEdited = false;
        const cycle = DataManager.normalizePlanBillingCycle(plan);
        const startDate = document.getElementById('accStartDate').value || new Date().toISOString().split('T')[0];
        const billingFields = buildBillingFields(startDate, plan.durationDays || 30, cycle);

        const billingCycleSelect = document.getElementById('accBillingCycle');
        if (billingCycleSelect) billingCycleSelect.value = billingFields.billingCycle;

        setAccountEndDate(billingFields.currentPeriodEnd, false);
    }

    function applyPlanToAccountData(accountData, plan, fallbackPlatformId, fallbackRevenue) {
        if (!plan) return accountData;
        const cycle = DataManager.normalizePlanBillingCycle(plan);
        const endDateOverride = accountEndDateManuallyEdited ? accountData.currentPeriodEnd : '';
        const billingFields = buildBillingFields(accountData.startDate, plan.durationDays || accountData.durationDays, cycle, endDateOverride);

        return {
            ...accountData,
            platformId: plan.platformId || fallbackPlatformId,
            revenue: plan.pricePerMember || fallbackRevenue,
            billingCycle: billingFields.billingCycle,
            recurringEnabled: billingFields.recurringEnabled,
            currentPeriodStart: billingFields.currentPeriodStart,
            currentPeriodEnd: billingFields.currentPeriodEnd,
            nextBillingDate: billingFields.nextBillingDate,
            durationDays: billingFields.durationDays,
            username: plan.email || accountData.username,
            password: plan.password || accountData.password
        };
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
        // Auto-fill billing cycle and compatible duration from the account start date
        applyPlanBillingToAccountForm(plan);
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
                const cycle = DataManager.normalizePlanBillingCycle(plan);
                banner.style.display = 'block';
                banner.innerHTML = `
                    <i class="fa-solid fa-circle-info text-primary"></i>
                    <span>تم تعبئة البيانات من خطة: <strong>${escapeHtml(plan.name || (platform ? platform.name : 'الخطة'))}</strong>
                    — ${getBillingCycleLabel(cycle)} — يمكنك تعديل أي حقل.</span>
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
        accountEndDateManuallyEdited = false;
        syncAccountEndDateFromDuration(false);
        document.getElementById('accRevenue').value = 0;
        setAccountPaidAmount(0);
        document.getElementById('accRefund').value = 0;
        const billingCycleSelect = document.getElementById('accBillingCycle');
        if (billingCycleSelect) billingCycleSelect.value = 'custom';

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
        accountEndDateManuallyEdited = false;
        syncAccountEndDateFromDuration(false);
        document.getElementById('accRevenue').value = 0;
        setAccountPaidAmount(0);
        document.getElementById('accRefund').value = 0;
        const billingCycleSelect = document.getElementById('accBillingCycle');
        if (billingCycleSelect) billingCycleSelect.value = 'custom';

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
        const endDate = document.getElementById('accEndDate').value;
        const durationDays = document.getElementById('accDurationDays').value;
        const revenue = document.getElementById('accRevenue').value;

        if (!customerId || !platformId || !startDate || !endDate || !durationDays || revenue === '') {
            Swal.fire({ icon: 'error', title: 'بيانات ناقصة', text: 'يرجى إكمال الحقول الإلزامية المميزة بعلامة *', confirmButtonText: 'حسناً', background: '#111827', color: '#fff' });
            return;
        }

        if (new Date(endDate) < new Date(startDate)) {
            Swal.fire({ icon: 'error', title: 'تاريخ غير صحيح', text: 'تاريخ نهاية الاشتراك يجب أن يكون بعد تاريخ البداية أو مساويًا له.', confirmButtonText: 'حسناً', background: '#111827', color: '#fff' });
            return;
        }

        const isPaidCheck = document.getElementById('accIsPaid');
        const paidAmountInput = document.getElementById('accPaidAmount');
        const isPaid = isPaidCheck ? isPaidCheck.checked : false;
        const paidAmount = paidAmountInput
            ? (isPaid ? (paidAmountInput.value || revenue || 0) : (paidAmountInput.value || 0))
            : (isPaid ? revenue : 0);
        const accId = document.getElementById('accId').value;
        const selectedPlanIds = getSelectedPlanIds();
        const billingCycle = document.getElementById('accBillingCycle') ? document.getElementById('accBillingCycle').value : 'custom';
        let billingFields = buildBillingFields(startDate, durationDays, billingCycle, endDate);

        const baseData = {
            customerId,
            platformId,
            username: document.getElementById('accUsername').value.trim(),
            password: document.getElementById('accPassword').value,
            startDate,
            durationDays: billingFields.durationDays,
            revenue,
            refund: document.getElementById('accRefund').value || '0',
            activationCode: document.getElementById('accActivationCode').value.trim(),
            notes: document.getElementById('accNotes').value.trim(),
            isPaid,
            paidAmount,
            billingCycle: billingFields.billingCycle,
            recurringEnabled: billingFields.recurringEnabled,
            currentPeriodStart: billingFields.currentPeriodStart,
            currentPeriodEnd: billingFields.currentPeriodEnd,
            nextBillingDate: billingFields.nextBillingDate
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
                    let accountData = { ...baseData, servicePlanId: planId };
                    accountData = applyPlanToAccountData(accountData, plan, platformId, revenue);
                    await DataManager.addAccount(accountData);
                }
                showToast(`تم إضافة ${selectedPlanIds.length} اشتراكات بنجاح`);
            } else {
                // Single plan or no plan
                baseData.servicePlanId = selectedPlanIds.length === 1 ? selectedPlanIds[0] : '';
                if (baseData.servicePlanId) {
                    const plan = DataManager.getServicePlanById(baseData.servicePlanId);
                    Object.assign(baseData, applyPlanToAccountData(baseData, plan, platformId, revenue));
                }
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
        const period = DataManager.getAccountPeriod(acc);
        const endInput = document.getElementById('accEndDate');
        if (endInput) endInput.value = period.endDate || addDaysToDate(acc.startDate, acc.durationDays || 30);
        accountEndDateManuallyEdited = !!acc.currentPeriodEnd;
        syncAccountDurationFromEndDate();
        document.getElementById('accRevenue').value = acc.revenue || 0;
        setAccountPaidAmount(acc.paidAmount !== undefined && acc.paidAmount !== null && acc.paidAmount !== '' ? acc.paidAmount : (acc.isPaid === true ? acc.revenue || 0 : 0));
        document.getElementById('accRefund').value = acc.refund || 0;
        document.getElementById('accActivationCode').value = acc.activationCode || '';
        document.getElementById('accNotes').value = acc.notes || '';
        document.getElementById('accountModalTitle').innerText = 'تعديل بيانات الاشتراك';
        const billingCycleSelect = document.getElementById('accBillingCycle');
        if (billingCycleSelect) {
            billingCycleSelect.value = acc.billingCycle || 'custom';
        }

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
        if (DataManager.isFirebaseReady) {
            Swal.fire({
                icon: 'info',
                title: 'الاستيراد المباشر معطل',
                text: 'التطبيق متصل بـ Firebase، لذلك لا يتم استبدال بيانات السحابة من ملف احتياطي حتى لا تُمسح البيانات الحالية بالخطأ.',
                background: '#111827',
                color: '#fff'
            });
            return;
        }
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
                reader.onload = async (ev) => {
                    const success = await DataManager.importData(ev.target.result);
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
