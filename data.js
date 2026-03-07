// data.js — SubMaster Data Management Layer with Firebase

const STORAGE_PREFIX = 'submaster_';
const PLATFORMS_KEY = STORAGE_PREFIX + 'platforms';
const ACCOUNTS_KEY = STORAGE_PREFIX + 'accounts';
const CUSTOMERS_KEY = STORAGE_PREFIX + 'customers';
const PLANS_KEY = STORAGE_PREFIX + 'service_plans';
const JOB_TITLES_KEY = STORAGE_PREFIX + 'job_titles';
const WORKPLACES_KEY = STORAGE_PREFIX + 'workplaces';

// Default Platforms
const defaultPlatforms = [
    { id: '1', name: 'ChatGPT', icon: 'fa-solid fa-robot', color: '#10a37f' },
    { id: '2', name: 'Gemini', icon: 'fa-brands fa-google', color: '#4285F4' },
    { id: '3', name: 'Claude', icon: 'fa-solid fa-brain', color: '#d2b694' },
    { id: '4', name: 'Perplexity', icon: 'fa-solid fa-magnifying-glass-chart', color: '#20808d' },
    { id: '5', name: 'Coursera', icon: 'fa-solid fa-graduation-cap', color: '#0056d2' },
    { id: '6', name: 'LinkedIn', icon: 'fa-brands fa-linkedin', color: '#0a66c2' },
    { id: '7', name: 'LinkedIn Learning', icon: 'fa-solid fa-chalkboard-user', color: '#0073b1' },
    { id: '8', name: 'YouTube', icon: 'fa-brands fa-youtube', color: '#ff0000' },
    { id: '9', name: 'قوانين الشرق', icon: 'fa-solid fa-scale-balanced', color: '#c9a84c' },
];

const defaultJobTitles = ['مستشار', 'دكتور', 'قاضي', 'رئيس محكمة', 'نائب رئيس'];

const defaultWorkplaces = [
    'هيئة قضايا الدولة',
    'محكمة النقض',
    'النيابة العامة',
    'النيابة الإدارية',
    'القضاء العادي',
    'محكمة الاستئناف',
];

class DataManager {
    static platforms = [];
    static accounts = [];
    static customers = [];
    static servicePlans = [];
    static jobTitles = [];
    static workplaces = [];
    static isFirebaseReady = false;

    static init() {
        if (!localStorage.getItem(PLATFORMS_KEY)) {
            localStorage.setItem(PLATFORMS_KEY, JSON.stringify(defaultPlatforms));
        }
        this.platforms = JSON.parse(localStorage.getItem(PLATFORMS_KEY) || '[]');
        this.accounts = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
        this.customers = JSON.parse(localStorage.getItem(CUSTOMERS_KEY) || '[]');
        this.servicePlans = JSON.parse(localStorage.getItem(PLANS_KEY) || '[]');
        this.initLookups();
    }

    static initLookups() {
        if (!localStorage.getItem(JOB_TITLES_KEY)) {
            localStorage.setItem(JOB_TITLES_KEY, JSON.stringify(defaultJobTitles));
        }
        if (!localStorage.getItem(WORKPLACES_KEY)) {
            localStorage.setItem(WORKPLACES_KEY, JSON.stringify(defaultWorkplaces));
        }
        this.jobTitles = JSON.parse(localStorage.getItem(JOB_TITLES_KEY) || '[]');
        this.workplaces = JSON.parse(localStorage.getItem(WORKPLACES_KEY) || '[]');
    }

    static startFirebaseSync() {
        if (!window.firebaseApp || !window.firebaseApp.db) return;
        const db = window.firebaseApp.db;
        const { collection, onSnapshot } = window.firebaseApp;

        this.isFirebaseReady = true;

        // Sync Platforms
        onSnapshot(collection(db, "platforms"), (snapshot) => {
            this.platforms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (this.platforms.length === 0) {
                defaultPlatforms.forEach(p => this.addPlatform(p));
            } else {
                localStorage.setItem(PLATFORMS_KEY, JSON.stringify(this.platforms));
                window.dispatchEvent(new Event('dataChanged'));
            }
        });

        // Sync Service Plans
        onSnapshot(collection(db, "servicePlans"), (snapshot) => {
            this.servicePlans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            localStorage.setItem(PLANS_KEY, JSON.stringify(this.servicePlans));
            window.dispatchEvent(new Event('dataChanged'));
        });

        // Sync Customers
        onSnapshot(collection(db, "customers"), (snapshot) => {
            this.customers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(this.customers));
            window.dispatchEvent(new Event('dataChanged'));
        });

        // Sync Accounts
        onSnapshot(collection(db, "accounts"), (snapshot) => {
            this.accounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(this.accounts));
            window.dispatchEvent(new Event('dataChanged'));
        });
    }

    // ==================== JOB TITLES ====================
    static getJobTitles() { return this.jobTitles; }

    static addJobTitle(title) {
        this.jobTitles.push(title);
        localStorage.setItem(JOB_TITLES_KEY, JSON.stringify(this.jobTitles));
    }

    static updateJobTitle(index, title) {
        this.jobTitles[index] = title;
        localStorage.setItem(JOB_TITLES_KEY, JSON.stringify(this.jobTitles));
    }

    static deleteJobTitle(index) {
        this.jobTitles.splice(index, 1);
        localStorage.setItem(JOB_TITLES_KEY, JSON.stringify(this.jobTitles));
    }

    // ==================== WORKPLACES ====================
    static getWorkplaces() { return this.workplaces; }

    static addWorkplace(name) {
        this.workplaces.push(name);
        localStorage.setItem(WORKPLACES_KEY, JSON.stringify(this.workplaces));
    }

    static updateWorkplace(index, name) {
        this.workplaces[index] = name;
        localStorage.setItem(WORKPLACES_KEY, JSON.stringify(this.workplaces));
    }

    static deleteWorkplace(index) {
        this.workplaces.splice(index, 1);
        localStorage.setItem(WORKPLACES_KEY, JSON.stringify(this.workplaces));
    }

    // ==================== SERVICE PLANS ====================
    static getServicePlans() { return this.servicePlans; }
    static getServicePlanById(id) { return this.servicePlans.find(p => p.id === id) || null; }
    static getServicePlanMembersCount(planId) {
        return this.accounts.filter(a => a.servicePlanId === planId).length;
    }
    static getServicePlanAccounts(planId) {
        return this.accounts.filter(a => a.servicePlanId === planId);
    }
    static getPlanFinancials(planId) {
        const plan = this.getServicePlanById(planId);
        if (!plan) return { totalRevenue: 0, planCost: 0, netProfit: 0, membersCount: 0 };
        const members = this.getServicePlanAccounts(planId);
        let totalRevenue = 0;
        members.forEach(acc => totalRevenue += parseFloat(acc.revenue || 0));
        const planCost = parseFloat(plan.registrationCost || 0);
        return { totalRevenue, planCost, netProfit: totalRevenue - planCost, membersCount: members.length };
    }

    static async addServicePlan(plan) {
        if (!this.isFirebaseReady) return plan;
        plan.createdAt = new Date().toISOString();
        const docRef = await window.firebaseApp.addDoc(
            window.firebaseApp.collection(window.firebaseApp.db, "servicePlans"), plan
        );
        return { id: docRef.id, ...plan };
    }

    static async updateServicePlan(updated) {
        if (!this.isFirebaseReady || !updated.id) return;
        const { id, ...data } = updated;
        const ref = window.firebaseApp.doc(window.firebaseApp.db, "servicePlans", id);
        await window.firebaseApp.updateDoc(ref, data);
    }

    static async deleteServicePlan(id) {
        if (!this.isFirebaseReady) return;
        const ref = window.firebaseApp.doc(window.firebaseApp.db, "servicePlans", id);
        await window.firebaseApp.deleteDoc(ref);
    }

    // ==================== CUSTOMERS ====================
    static getCustomers() { return this.customers; }

    static async addCustomer(customer) {
        if (!this.isFirebaseReady) return customer;
        customer.createdAt = new Date().toISOString();
        const docRef = await window.firebaseApp.addDoc(
            window.firebaseApp.collection(window.firebaseApp.db, "customers"), customer
        );
        return { id: docRef.id, ...customer };
    }

    static async updateCustomer(updated) {
        if (!this.isFirebaseReady || !updated.id) return;
        const { id, ...data } = updated;
        const ref = window.firebaseApp.doc(window.firebaseApp.db, "customers", id);
        await window.firebaseApp.updateDoc(ref, data);
    }

    static async deleteCustomer(id) {
        if (!this.isFirebaseReady) return;
        const ref = window.firebaseApp.doc(window.firebaseApp.db, "customers", id);
        await window.firebaseApp.deleteDoc(ref);
    }

    static getCustomerById(id) { return this.customers.find(c => c.id === id) || null; }
    static getCustomerSubscriptions(customerId) { return this.accounts.filter(a => a.customerId === customerId); }

    static getCustomerStats(customerId) {
        const subs = this.getCustomerSubscriptions(customerId);
        let totalPaid = 0, activeSubs = 0;
        subs.forEach(acc => {
            totalPaid += parseFloat(acc.revenue || 0);
            const status = this.getAccountStatus(acc);
            if (status.status === 'active' || status.status === 'warning') activeSubs++;
        });
        return { totalSubscriptions: subs.length, activeSubs, totalPaid };
    }

    // ==================== PLATFORMS ====================
    static getPlatforms() { return this.platforms; }

    static async addPlatform(platform) {
        if (!this.isFirebaseReady) return platform;
        if (platform.id) delete platform.id;
        await window.firebaseApp.addDoc(
            window.firebaseApp.collection(window.firebaseApp.db, "platforms"), platform
        );
    }

    static async updatePlatform(updated) {
        if (!this.isFirebaseReady || !updated.id) return;
        const { id, ...data } = updated;
        const ref = window.firebaseApp.doc(window.firebaseApp.db, "platforms", id);
        await window.firebaseApp.updateDoc(ref, data);
    }

    static async deletePlatform(id) {
        if (!this.isFirebaseReady) return;
        const ref = window.firebaseApp.doc(window.firebaseApp.db, "platforms", id);
        await window.firebaseApp.deleteDoc(ref);
    }

    static getPlatformById(id) { return this.platforms.find(p => p.id === id) || null; }

    // ==================== ACCOUNTS ====================
    static getAccounts() { return this.accounts; }

    static async addAccount(account) {
        if (!this.isFirebaseReady) return account;
        account.createdAt = new Date().toISOString();
        await window.firebaseApp.addDoc(
            window.firebaseApp.collection(window.firebaseApp.db, "accounts"), account
        );
    }

    static async updateAccount(updatedAccount) {
        if (!this.isFirebaseReady || !updatedAccount.id) return;
        const { id, ...data } = updatedAccount;
        const ref = window.firebaseApp.doc(window.firebaseApp.db, "accounts", id);
        await window.firebaseApp.updateDoc(ref, data);
    }

    static async deleteAccount(id) {
        // Optimistic local removal
        this.accounts = this.accounts.filter(a => a.id !== id);
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(this.accounts));
        if (!this.isFirebaseReady) return;
        const ref = window.firebaseApp.doc(window.firebaseApp.db, "accounts", id);
        await window.firebaseApp.deleteDoc(ref);
    }

    static async updateAccountPaid(id, isPaid) {
        // Optimistic local update
        const acc = this.accounts.find(a => a.id === id);
        if (acc) acc.isPaid = isPaid;
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(this.accounts));
        if (!this.isFirebaseReady) return;
        const ref = window.firebaseApp.doc(window.firebaseApp.db, "accounts", id);
        await window.firebaseApp.updateDoc(ref, { isPaid });
    }

    // ==================== NOTIFICATIONS ====================
    static getNotifications() {
        const expiring = [];
        const expired = [];
        this.accounts.forEach(acc => {
            const status = this.getAccountStatus(acc);
            const customer = this.getCustomerById(acc.customerId);
            const platform = this.getPlatformById(acc.platformId);
            const custName = customer ? customer.name : 'عميل';
            const platName = platform ? platform.name : '';
            if (status.status === 'expired') {
                expired.push({ id: acc.id, custName, platName, daysLeft: status.daysLeft });
            } else if (status.status === 'warning') {
                expiring.push({ id: acc.id, custName, platName, daysLeft: status.daysLeft });
            }
        });
        return { expiring, expired };
    }

    // ==================== ANALYTICS ====================
    static calculateStats() {
        let stats = {
            totalCost: 0, totalRevenue: 0, totalRefunds: 0, netProfit: 0,
            activeAccounts: 0, expiredAccounts: 0,
            totalAccounts: this.accounts.length, totalCustomers: this.customers.length
        };
        const now = new Date();

        // Revenue & refunds from subscriptions
        this.accounts.forEach(acc => {
            stats.totalRevenue += parseFloat(acc.revenue || 0);
            stats.totalRefunds += parseFloat(acc.refund || 0);
            const startDate = new Date(acc.startDate);
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + parseInt(acc.durationDays || 30));
            if (endDate >= now) stats.activeAccounts++;
            else stats.expiredAccounts++;
        });

        // Cost from plans (registrationCost)
        this.servicePlans.forEach(plan => {
            stats.totalCost += parseFloat(plan.registrationCost || 0);
        });

        stats.netProfit = stats.totalRevenue - stats.totalCost - stats.totalRefunds;
        return stats;
    }

    static getAccountStatus(account) {
        const startDate = new Date(account.startDate);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + parseInt(account.durationDays || 30));
        const now = new Date();
        const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
        if (daysLeft < 0) return { status: 'expired', label: 'منتهي', daysLeft: 0 };
        if (daysLeft <= 3) return { status: 'warning', label: 'قارب على الانتهاء', daysLeft };
        return { status: 'active', label: 'نشط', daysLeft };
    }

    static exportData() {
        return JSON.stringify({
            platforms: this.platforms,
            servicePlans: this.servicePlans,
            accounts: this.accounts,
            customers: this.customers,
            exportDate: new Date().toISOString()
        }, null, 2);
    }

    static async importData(jsonString) {
        console.warn("Import is disabled when Firebase is active, to prevent overwriting cloud data.");
        return false;
    }
}

DataManager.init();
