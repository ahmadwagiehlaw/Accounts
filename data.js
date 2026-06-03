// data.js — SubMaster Data Management Layer with Firebase

const STORAGE_PREFIX = 'submaster_';
const PLATFORMS_KEY = STORAGE_PREFIX + 'platforms';
const ACCOUNTS_KEY = STORAGE_PREFIX + 'accounts';
const CUSTOMERS_KEY = STORAGE_PREFIX + 'customers';
const PLANS_KEY = STORAGE_PREFIX + 'service_plans';
const RENEWALS_KEY = STORAGE_PREFIX + 'renewals';
const PLAN_EXPENSES_KEY = STORAGE_PREFIX + 'plan_expenses';
const JOB_TITLES_KEY = STORAGE_PREFIX + 'job_titles';
const WORKPLACES_KEY = STORAGE_PREFIX + 'workplaces';
const FOLLOW_UP_WARNING_DAYS = 14;

// Default Platforms
const defaultPlatforms = [
    { id: '1', name: 'ChatGPT', icon: 'fa-solid fa-robot', color: '#10a37f' },
    { id: '2', name: 'Gemini', icon: 'fa-brands fa-google', color: '#4285F4' },
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
    static renewals = [];
    static planExpenses = [];
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
        this.renewals = JSON.parse(localStorage.getItem(RENEWALS_KEY) || '[]');
        this.planExpenses = JSON.parse(localStorage.getItem(PLAN_EXPENSES_KEY) || '[]');
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

        let platformsInitialized = false;
        // Sync Platforms
        onSnapshot(collection(db, "platforms"), async (snapshot) => {
            this.platforms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (this.platforms.length === 0 && !platformsInitialized) {
                platformsInitialized = true;
                for (const p of defaultPlatforms) {
                    await this.addPlatform(p);
                }
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

        // Sync Renewals
        onSnapshot(collection(db, "renewals"), (snapshot) => {
            this.renewals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            localStorage.setItem(RENEWALS_KEY, JSON.stringify(this.renewals));
            window.dispatchEvent(new Event('dataChanged'));
        });

        // Sync Plan Expenses
        onSnapshot(collection(db, "planExpenses"), (snapshot) => {
            this.planExpenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            localStorage.setItem(PLAN_EXPENSES_KEY, JSON.stringify(this.planExpenses));
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
    static getPlanExpenses(planId) {
        return this.planExpenses.filter(expense => expense.planId === planId);
    }
    static getPlanExpensesTotal(planId) {
        return this.getPlanExpenses(planId).reduce((sum, expense) => sum + this.parseAmount(expense.amount), 0);
    }
    static getPlanCost(plan) {
        if (!plan) return 0;
        const expensesTotal = this.getPlanExpensesTotal(plan.id);
        return expensesTotal > 0 ? expensesTotal : this.parseAmount(plan.registrationCost);
    }
    static getPlanFinancials(planId) {
        const plan = this.getServicePlanById(planId);
        if (!plan) return { totalRevenue: 0, totalPaid: 0, totalUnpaid: 0, planCost: 0, netProfit: 0, netCollected: 0, membersCount: 0 };
        const members = this.getServicePlanAccounts(planId);
        let totalRevenue = 0;
        let totalPaid = 0;
        let totalUnpaid = 0;
        members.forEach(acc => {
            const financials = this.getAccountFinancials(acc);
            totalRevenue += financials.billedAmount;
            totalPaid += financials.paidAmount;
            totalUnpaid += financials.unpaidAmount;
        });
        const planCost = this.getPlanCost(plan);
        return {
            totalRevenue,
            totalPaid,
            totalUnpaid,
            planCost,
            netProfit: totalRevenue - planCost,
            netCollected: totalPaid - planCost,
            membersCount: members.length
        };
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

    static async addPlanExpense(expense) {
        const record = {
            ...expense,
            amount: this.parseAmount(expense.amount),
            createdAt: new Date().toISOString()
        };

        if (!this.isFirebaseReady) {
            record.id = Date.now().toString();
            this.planExpenses.push(record);
            localStorage.setItem(PLAN_EXPENSES_KEY, JSON.stringify(this.planExpenses));
            return record;
        }

        const docRef = await window.firebaseApp.addDoc(
            window.firebaseApp.collection(window.firebaseApp.db, "planExpenses"), record
        );
        const savedRecord = { id: docRef.id, ...record };
        this.planExpenses.push(savedRecord);
        localStorage.setItem(PLAN_EXPENSES_KEY, JSON.stringify(this.planExpenses));
        return savedRecord;
    }

    static async deletePlanExpense(id) {
        const previous = [...this.planExpenses];
        this.planExpenses = this.planExpenses.filter(expense => expense.id !== id);
        localStorage.setItem(PLAN_EXPENSES_KEY, JSON.stringify(this.planExpenses));
        if (!this.isFirebaseReady) return;

        try {
            const ref = window.firebaseApp.doc(window.firebaseApp.db, "planExpenses", id);
            await window.firebaseApp.deleteDoc(ref);
        } catch (error) {
            this.planExpenses = previous;
            localStorage.setItem(PLAN_EXPENSES_KEY, JSON.stringify(this.planExpenses));
            throw error;
        }
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
        let totalPaid = 0, totalBilled = 0, totalUnpaid = 0, activeSubs = 0;
        subs.forEach(acc => {
            const financials = this.getAccountFinancials(acc);
            totalPaid += financials.paidAmount;
            totalBilled += financials.billedAmount;
            totalUnpaid += financials.unpaidAmount;
            const status = this.getAccountStatus(acc);
            if (status.status === 'active' || status.status === 'warning') activeSubs++;
        });
        return { totalSubscriptions: subs.length, activeSubs, totalPaid, totalBilled, totalUnpaid };
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

    static getRenewals() { return this.renewals; }
    static getRenewalsForAccount(accountId) {
        return this.renewals.filter(r => r.accountId === accountId);
    }

    static parseAmount(value) {
        const amount = parseFloat(value);
        return Number.isFinite(amount) ? amount : 0;
    }

    static getAccountBillingEntries(account) {
        if (!account) return [];

        const renewals = this.getRenewalsForAccount(account.id);
        const period = this.getAccountPeriod(account);
        const entries = [];
        const initialAmount = this.parseAmount(account.revenue);

        entries.push({
            id: `${account.id || 'account'}_initial`,
            type: 'initial',
            accountId: account.id || '',
            servicePlanId: account.servicePlanId || '',
            amount: initialAmount,
            isPaid: renewals.length > 0 ? true : account.isPaid === true,
            periodStart: account.previousStartDate || account.startDate || period.startDate || '',
            periodEnd: account.previousPeriodEnd || account.previousCurrentPeriodEnd || period.endDate || '',
            createdAt: account.createdAt || ''
        });

        renewals.forEach(renewal => {
            entries.push({
                id: renewal.id || '',
                type: 'renewal',
                accountId: renewal.accountId || account.id || '',
                servicePlanId: renewal.servicePlanId || account.servicePlanId || '',
                amount: this.parseAmount(renewal.amount !== undefined ? renewal.amount : account.revenue),
                isPaid: renewal.isPaid === true,
                periodStart: renewal.newPeriodStart || renewal.currentPeriodStart || '',
                periodEnd: renewal.newPeriodEnd || renewal.currentPeriodEnd || '',
                createdAt: renewal.renewedAt || renewal.createdAt || ''
            });
        });

        return entries.sort((a, b) => {
            const aDate = a.periodStart || a.createdAt || '';
            const bDate = b.periodStart || b.createdAt || '';
            return aDate.localeCompare(bDate);
        });
    }

    static getAccountFinancials(account) {
        const entries = this.getAccountBillingEntries(account);
        const billedAmount = entries.reduce((sum, entry) => sum + this.parseAmount(entry.amount), 0);
        const paidAmount = entries.reduce((sum, entry) => entry.isPaid ? sum + this.parseAmount(entry.amount) : sum, 0);
        const refundAmount = this.parseAmount(account && account.refund);
        const unpaidAmount = Math.max(0, billedAmount - paidAmount);

        return {
            entries,
            billedAmount,
            paidAmount,
            unpaidAmount,
            refundAmount,
            netAmount: billedAmount - refundAmount,
            netPaidAmount: paidAmount - refundAmount
        };
    }

    static formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    static parseDateOnly(dateString) {
        if (!dateString) return null;
        const date = new Date(dateString);
        if (Number.isNaN(date.getTime())) return null;
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }

    static todayDateOnly() {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    static addCalendarMonths(dateString, months = 1) {
        const start = new Date(dateString);
        const day = start.getDate();
        const targetMonthIndex = start.getMonth() + months;
        const targetYear = start.getFullYear() + Math.floor(targetMonthIndex / 12);
        const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
        const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
        const result = new Date(start);
        result.setFullYear(targetYear, targetMonth, Math.min(day, lastDay));
        return this.formatDate(result);
    }

    static daysBetween(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        return Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
    }

    static getBillingCycleMonths(cycle) {
        const cycles = { monthly: 1, quarterly: 3, semi_annual: 6, yearly: 12 };
        return cycles[cycle] || null;
    }

    static normalizePlanBillingCycle(plan) {
        const cycle = plan && plan.billingCycle ? plan.billingCycle : 'custom_days';
        return cycle === 'custom' ? 'custom_days' : cycle;
    }

    static getAccountPeriod(account) {
        const startDate = account.currentPeriodStart || account.startDate;
        let endDate = account.currentPeriodEnd || '';
        if (!endDate && startDate) {
            const end = new Date(startDate);
            end.setDate(end.getDate() + parseInt(account.durationDays || 30));
            endDate = this.formatDate(end);
        }
        return { startDate, endDate };
    }

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

    static async closeAccount(id, reason = 'expired') {
        const acc = this.accounts.find(a => a.id === id);
        if (!acc) return;
        const previous = { ...acc };
        const closedAt = new Date().toISOString();
        const closedBy = window.firebaseApp && window.firebaseApp.auth && window.firebaseApp.auth.currentUser
            ? window.firebaseApp.auth.currentUser.email || ''
            : '';
        const patch = {
            lifecycleStatus: 'closed',
            closedAt,
            closedReason: reason,
            closedBy
        };

        Object.assign(acc, patch);
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(this.accounts));
        if (!this.isFirebaseReady) return;
        try {
            const ref = window.firebaseApp.doc(window.firebaseApp.db, "accounts", id);
            await window.firebaseApp.updateDoc(ref, patch);
        } catch (error) {
            Object.assign(acc, previous);
            localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(this.accounts));
            throw error;
        }
    }

    static getCurrentUserEmail() {
        return window.firebaseApp && window.firebaseApp.auth && window.firebaseApp.auth.currentUser
            ? window.firebaseApp.auth.currentUser.email || ''
            : '';
    }

    static async updateAccountLifecycle(id, patch) {
        const acc = this.accounts.find(a => a.id === id);
        if (!acc) return;
        const previous = { ...acc };

        Object.assign(acc, patch);
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(this.accounts));
        if (!this.isFirebaseReady) return;

        try {
            const ref = window.firebaseApp.doc(window.firebaseApp.db, "accounts", id);
            await window.firebaseApp.updateDoc(ref, patch);
        } catch (error) {
            Object.assign(acc, previous);
            localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(this.accounts));
            throw error;
        }
    }

    static async pauseAccount(id, reason = '') {
        const acc = this.accounts.find(a => a.id === id);
        if (!acc) return;
        await this.updateAccountLifecycle(id, {
            previousLifecycleStatus: acc.lifecycleStatus || 'active',
            lifecycleStatus: 'paused',
            pausedAt: new Date().toISOString(),
            pausedReason: reason,
            pausedBy: this.getCurrentUserEmail()
        });
    }

    static async cancelAccount(id, reason = '') {
        const acc = this.accounts.find(a => a.id === id);
        if (!acc) return;
        await this.updateAccountLifecycle(id, {
            previousLifecycleStatus: acc.lifecycleStatus || 'active',
            lifecycleStatus: 'cancelled',
            cancelledAt: new Date().toISOString(),
            cancelledReason: reason,
            cancelledBy: this.getCurrentUserEmail()
        });
    }

    static async reactivateAccount(id, options = {}) {
        const acc = this.accounts.find(a => a.id === id);
        if (!acc) return;

        const startDate = options.startDate || new Date().toISOString().split('T')[0];
        const endDate = options.endDate || acc.currentPeriodEnd || acc.startDate;
        const durationDays = this.daysBetween(startDate, endDate);
        const isRecurringCycle = !!this.getBillingCycleMonths(acc.billingCycle);
        const previousLifecycleStatus = acc.lifecycleStatus || this.getAccountStatus(acc).status;

        await this.updateAccountLifecycle(id, {
            previousLifecycleStatus,
            previousCurrentPeriodStart: acc.currentPeriodStart || acc.startDate || null,
            previousCurrentPeriodEnd: acc.currentPeriodEnd || null,
            previousNextBillingDate: acc.nextBillingDate || null,
            lifecycleStatus: 'active',
            startDate,
            durationDays,
            currentPeriodStart: startDate,
            currentPeriodEnd: endDate,
            nextBillingDate: isRecurringCycle ? endDate : '',
            closedAt: null,
            closedReason: null,
            closedBy: null,
            pausedAt: null,
            pausedReason: null,
            pausedBy: null,
            cancelledAt: null,
            cancelledReason: null,
            cancelledBy: null,
            reactivatedAt: new Date().toISOString(),
            reactivatedBy: this.getCurrentUserEmail(),
            reactivationReason: options.reason || ''
        });
    }

    static async renewAccount(id, options = {}) {
        const acc = this.accounts.find(a => a.id === id);
        if (!acc) return;
        const previous = { ...acc };

        const startDate = options.startDate || new Date().toISOString().split('T')[0];
        const durationDays = options.durationDays || acc.durationDays || 30;
        const calculatedEnd = new Date(startDate);
        calculatedEnd.setDate(calculatedEnd.getDate() + parseInt(durationDays || 30, 10));
        const currentPeriodEnd = options.endDate || this.formatDate(calculatedEnd);
        const isRecurringCycle = !!this.getBillingCycleMonths(acc.billingCycle);
        const patch = {
            previousStartDate: acc.startDate || null,
            previousDurationDays: acc.durationDays || null,
            startDate,
            durationDays,
            currentPeriodStart: startDate,
            currentPeriodEnd,
            nextBillingDate: isRecurringCycle ? currentPeriodEnd : '',
            lifecycleStatus: 'active',
            closedAt: null,
            closedReason: null,
            closedBy: null,
            pausedAt: null,
            pausedReason: null,
            pausedBy: null,
            cancelledAt: null,
            cancelledReason: null,
            cancelledBy: null,
            lastRenewedAt: new Date().toISOString(),
            renewalCount: parseInt(acc.renewalCount || 0) + 1
        };

        Object.assign(acc, patch);
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(this.accounts));
        if (!this.isFirebaseReady) return;
        try {
            const ref = window.firebaseApp.doc(window.firebaseApp.db, "accounts", id);
            await window.firebaseApp.updateDoc(ref, patch);
        } catch (error) {
            Object.assign(acc, previous);
            localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(this.accounts));
            throw error;
        }
    }

    static async addRenewalRecord(renewal) {
        const record = { ...renewal, createdAt: new Date().toISOString() };
        if (!this.isFirebaseReady) {
            record.id = Date.now().toString();
            this.renewals.push(record);
            localStorage.setItem(RENEWALS_KEY, JSON.stringify(this.renewals));
            return record;
        }
        const docRef = await window.firebaseApp.addDoc(
            window.firebaseApp.collection(window.firebaseApp.db, "renewals"), record
        );
        return { id: docRef.id, ...record };
    }

    static async renewMonthlyAccount(id, options = {}) {
        const acc = this.accounts.find(a => a.id === id);
        if (!acc) return;
        const previous = { ...acc };
        const previousRenewals = [...this.renewals];
        const period = this.getAccountPeriod(acc);
        const previousStart = period.startDate || acc.startDate;
        const previousEnd = period.endDate || this.addCalendarMonths(previousStart, 1);
        const newStart = options.startDate || previousEnd || new Date().toISOString().split('T')[0];
        const newEnd = options.endDate || this.addCalendarMonths(newStart, 1);
        const durationDays = this.daysBetween(newStart, newEnd);
        const renewedBy = window.firebaseApp && window.firebaseApp.auth && window.firebaseApp.auth.currentUser
            ? window.firebaseApp.auth.currentUser.email || ''
            : '';
        const patch = {
            billingCycle: 'monthly',
            recurringEnabled: true,
            previousStartDate: acc.startDate || null,
            previousDurationDays: acc.durationDays || null,
            currentPeriodStart: newStart,
            currentPeriodEnd: newEnd,
            nextBillingDate: newEnd,
            startDate: newStart,
            durationDays,
            lifecycleStatus: 'active',
            closedAt: null,
            closedReason: null,
            closedBy: null,
            pausedAt: null,
            pausedReason: null,
            pausedBy: null,
            cancelledAt: null,
            cancelledReason: null,
            cancelledBy: null,
            lastRenewedAt: new Date().toISOString(),
            renewalCount: parseInt(acc.renewalCount || 0) + 1,
            isPaid: options.isPaid === true
        };
        const renewalRecord = {
            accountId: acc.id,
            customerId: acc.customerId || '',
            platformId: acc.platformId || '',
            servicePlanId: acc.servicePlanId || '',
            previousPeriodStart: previousStart || '',
            previousPeriodEnd: previousEnd || '',
            newPeriodStart: newStart,
            newPeriodEnd: newEnd,
            amount: parseFloat(options.amount !== undefined ? options.amount : acc.revenue || 0),
            isPaid: options.isPaid === true,
            renewedAt: patch.lastRenewedAt,
            renewedBy,
            note: options.note || ''
        };

        Object.assign(acc, patch);
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(this.accounts));
        try {
            if (this.isFirebaseReady) {
                const batch = window.firebaseApp.db.batch();
                const accountRef = window.firebaseApp.doc(window.firebaseApp.db, "accounts", id);
                const renewalRef = window.firebaseApp.collection(window.firebaseApp.db, "renewals").doc();
                batch.set(renewalRef, { ...renewalRecord, createdAt: new Date().toISOString() });
                batch.update(accountRef, patch);
                await batch.commit();
            } else {
                await this.addRenewalRecord(renewalRecord);
            }
        } catch (error) {
            Object.assign(acc, previous);
            this.renewals = previousRenewals;
            localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(this.accounts));
            localStorage.setItem(RENEWALS_KEY, JSON.stringify(this.renewals));
            throw error;
        }
    }

    // ==================== NOTIFICATIONS ====================
    static getNotifications() {
        const expiring = [];
        const expired = [];
        this.accounts.forEach(acc => {
            const status = this.getAccountStatus(acc);
            if (['closed', 'paused', 'cancelled'].includes(status.status)) return;
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
            totalCost: 0, totalRevenue: 0, totalPaid: 0, totalUnpaid: 0, totalRefunds: 0, netProfit: 0, netCollected: 0,
            activeAccounts: 0, expiredAccounts: 0,
            totalAccounts: this.accounts.length, totalCustomers: this.customers.length
        };
        // Financial totals from initial subscriptions and renewal records.
        this.accounts.forEach(acc => {
            const financials = this.getAccountFinancials(acc);
            stats.totalRevenue += financials.billedAmount;
            stats.totalPaid += financials.paidAmount;
            stats.totalUnpaid += financials.unpaidAmount;
            stats.totalRefunds += financials.refundAmount;
            const status = this.getAccountStatus(acc);
            if (status.status === 'active' || status.status === 'warning') stats.activeAccounts++;
            else if (status.status === 'expired') stats.expiredAccounts++;
        });

        // Cost from plans (registrationCost)
        this.servicePlans.forEach(plan => {
            stats.totalCost += this.getPlanCost(plan);
        });

        stats.netProfit = stats.totalRevenue - stats.totalCost - stats.totalRefunds;
        stats.netCollected = stats.totalPaid - stats.totalCost - stats.totalRefunds;
        return stats;
    }

    static getAccountStatus(account) {
        if (account && account.lifecycleStatus === 'closed') {
            return { status: 'closed', label: 'مغلق', daysLeft: null };
        }
        if (account && account.lifecycleStatus === 'paused') {
            return { status: 'paused', label: 'موقوف', daysLeft: null };
        }
        if (account && account.lifecycleStatus === 'cancelled') {
            return { status: 'cancelled', label: 'ملغي', daysLeft: null };
        }
        const period = this.getAccountPeriod(account);
        const endDate = this.parseDateOnly(period.endDate);
        if (!endDate) {
            return { status: 'needs_review', label: 'يحتاج مراجعة', daysLeft: null };
        }
        const today = this.todayDateOnly();
        const daysLeft = Math.round((endDate - today) / (1000 * 60 * 60 * 24));
        if (daysLeft < 0) return { status: 'expired', label: 'منتهي', daysLeft };
        if (daysLeft <= FOLLOW_UP_WARNING_DAYS) return { status: 'warning', label: 'قارب على الانتهاء', daysLeft };
        return { status: 'active', label: 'نشط', daysLeft };
    }

    static exportData() {
        return JSON.stringify({
            platforms: this.platforms,
            servicePlans: this.servicePlans,
            accounts: this.accounts,
            customers: this.customers,
            renewals: this.renewals,
            planExpenses: this.planExpenses,
            jobTitles: this.jobTitles,
            workplaces: this.workplaces,
            exportDate: new Date().toISOString()
        }, null, 2);
    }

    static async importData(jsonString) {
        if (this.isFirebaseReady) {
            console.warn("Import is disabled when Firebase is active, to prevent overwriting cloud data.");
            return false;
        }

        try {
            const data = JSON.parse(jsonString);
            this.platforms = Array.isArray(data.platforms) ? data.platforms : [];
            this.servicePlans = Array.isArray(data.servicePlans) ? data.servicePlans : [];
            this.accounts = Array.isArray(data.accounts) ? data.accounts : [];
            this.customers = Array.isArray(data.customers) ? data.customers : [];
            this.renewals = Array.isArray(data.renewals) ? data.renewals : [];
            this.planExpenses = Array.isArray(data.planExpenses) ? data.planExpenses : [];
            this.jobTitles = Array.isArray(data.jobTitles) ? data.jobTitles : this.jobTitles;
            this.workplaces = Array.isArray(data.workplaces) ? data.workplaces : this.workplaces;

            localStorage.setItem(PLATFORMS_KEY, JSON.stringify(this.platforms));
            localStorage.setItem(PLANS_KEY, JSON.stringify(this.servicePlans));
            localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(this.accounts));
            localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(this.customers));
            localStorage.setItem(RENEWALS_KEY, JSON.stringify(this.renewals));
            localStorage.setItem(PLAN_EXPENSES_KEY, JSON.stringify(this.planExpenses));
            localStorage.setItem(JOB_TITLES_KEY, JSON.stringify(this.jobTitles));
            localStorage.setItem(WORKPLACES_KEY, JSON.stringify(this.workplaces));
            return true;
        } catch (error) {
            console.error("Failed to import data:", error);
            return false;
        }
    }

    static async cleanupDatabase() {
        console.warn("cleanupDatabase is disabled because the old Claude/ChatGPT merge is no longer safe.");
        return false;

        if (!this.isFirebaseReady) return;

        console.log("Starting database cleanup... Merging duplicates and replacing Claude with ChatGPT.");
        try {
            const platforms = [...this.platforms];
            const plans = [...this.servicePlans];
            const accounts = [...this.accounts];

            const platformGroups = {};
            platforms.forEach(p => {
                let name = p.name ? p.name.trim().toLowerCase() : '';
                if (name === 'claude') name = 'chatgpt';

                if (!platformGroups[name]) platformGroups[name] = [];
                platformGroups[name].push(p);
            });

            for (const [name, group] of Object.entries(platformGroups)) {
                if (group.length > 1) {
                    group.sort((a, b) => {
                        if (a.icon === 'fa-solid fa-robot' && b.icon !== 'fa-solid fa-robot') return -1;
                        if (b.icon === 'fa-solid fa-robot' && a.icon !== 'fa-solid fa-robot') return 1;
                        return 0; // retain first if same priority
                    });

                    const primary = group[0];
                    const duplicates = group.slice(1);

                    for (const dup of duplicates) {
                        const plansToUpdate = plans.filter(p => p.platformId === dup.id);
                        for (const plan of plansToUpdate) {
                            await this.updateServicePlan({ id: plan.id, platformId: primary.id });
                        }

                        const accountsToUpdate = accounts.filter(a => a.platformId === dup.id);
                        for (const acc of accountsToUpdate) {
                            await this.updateAccount({ id: acc.id, platformId: primary.id });
                        }

                        await this.deletePlatform(dup.id);
                        console.log(`Merged and deleted duplicate platform: ${dup.name} (${dup.id}) into ${primary.name} (${primary.id})`);
                    }
                }
            }

            Swal.fire({
                title: 'تم التنظيف!',
                text: 'تمت إزالة الخدمات المكررة ودمج Claude إلى ChatGPT بنجاح.',
                icon: 'success',
                confirmButtonText: 'حسناً'
            });

        } catch (error) {
            console.error("Error during DB cleanup:", error);
            Swal.fire({
                title: 'خطأ',
                text: 'حدث خطأ أثناء تنظيف البيانات.',
                icon: 'error',
                confirmButtonText: 'حسناً'
            });
        }
    }

    static async repairAccountPlatformsFromPlans() {
        const updates = [];
        const previousAccounts = this.accounts.map(acc => ({ ...acc }));
        this.accounts.forEach(acc => {
            if (!acc.servicePlanId) return;
            const plan = this.getServicePlanById(acc.servicePlanId);
            if (!plan || !plan.platformId || acc.platformId === plan.platformId) return;
            updates.push({ account: acc, platformId: plan.platformId });
        });

        updates.forEach(item => {
            item.account.platformId = item.platformId;
        });
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(this.accounts));

        try {
            for (const item of updates) {
                await this.updateAccount({ id: item.account.id, platformId: item.platformId });
            }
        } catch (error) {
            this.accounts = previousAccounts;
            localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(this.accounts));
            throw error;
        }

        return updates.length;
    }
}

DataManager.init();
