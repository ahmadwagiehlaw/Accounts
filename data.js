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
        if (!plan) return {
            totalRevenue: 0,
            planCost: 0,
            netProfit: 0,
            membersCount: 0,
            planType: 'private',
            maxMembers: 1,
            remainingSlots: 0,
            breakEvenPercent: 0,
            isProfitable: false
        };

        const members = this.getServicePlanAccounts(planId);
        let totalRevenue = 0;
        let totalRefunds = 0;
        members.forEach(acc => {
            totalRevenue += parseFloat(acc.revenue || 0);
            totalRefunds += parseFloat(acc.refund || 0);
        });

        const netCollected = totalRevenue - totalRefunds;

        // Plan type fallback: 'private' (خاصة), 'group' (مجموعة), 'family' (عائلة)
        const planType = plan.planType || (plan.pricePerMember ? 'group' : 'private');

        // Determine cost: support new monthly/yearly cost structure or fallback to registrationCost
        let planCost = 0;
        if (plan.billingCycle === 'yearly') {
            planCost = parseFloat(plan.yearlyCost || plan.registrationCost || 0);
        } else if (plan.billingCycle === 'monthly') {
            planCost = parseFloat(plan.monthlyCost || plan.registrationCost || 0);
        } else {
            planCost = parseFloat(plan.registrationCost || plan.yearlyCost || plan.monthlyCost || 0);
        }

        // Slots calculation
        let maxMembers = 1;
        if (planType === 'private') {
            maxMembers = 1;
        } else if (planType === 'family') {
            maxMembers = parseInt(plan.maxMembers || plan.familySlots || 6);
        } else if (planType === 'group') {
            maxMembers = parseInt(plan.maxMembers || 4);
        }

        const remainingSlots = Math.max(0, maxMembers - members.length);
        const netProfit = netCollected - planCost;
        const breakEvenPercent = planCost > 0 ? Math.min(100, Math.round((netCollected / planCost) * 100)) : (netCollected > 0 ? 100 : 0);

        return {
            totalRevenue,
            totalRefunds,
            netCollected,
            planCost,
            netProfit,
            membersCount: members.length,
            planType,
            maxMembers,
            remainingSlots,
            breakEvenPercent,
            isProfitable: netProfit >= 0
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

        // Cost from plans using dynamic financials
        this.servicePlans.forEach(plan => {
            const fin = this.getPlanFinancials(plan.id);
            stats.totalCost += fin.planCost;
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

    static async cleanupDatabase() {
        if (!this.isFirebaseReady) return;

        console.log("Starting database cleanup... Merging duplicates and normalizing plans.");
        try {
            const platforms = [...this.platforms];
            const plans = [...this.servicePlans];
            const accounts = [...this.accounts];

            // 1. Group duplicate plans by platform + plan name
            const planGroups = {};
            plans.forEach(plan => {
                const key = (plan.platformId || '') + '_' + (plan.name || '').trim().toLowerCase();
                if (!planGroups[key]) planGroups[key] = [];
                planGroups[key].push(plan);
            });

            let mergedPlansCount = 0;
            for (const [key, group] of Object.entries(planGroups)) {
                if (group.length > 1) {
                    const primary = group[0];
                    const duplicates = group.slice(1);

                    for (const dup of duplicates) {
                        const accsToUpdate = accounts.filter(a => a.servicePlanId === dup.id);
                        for (const acc of accsToUpdate) {
                            await this.updateAccount({ id: acc.id, servicePlanId: primary.id });
                        }
                        await this.deleteServicePlan(dup.id);
                        mergedPlansCount++;
                    }
                }
            }

            Swal.fire({
                title: 'تم الدمج والتنظيف!',
                text: mergedPlansCount > 0 
                    ? `تم دمج ${mergedPlansCount} خطة مكررة وتوجيه اشتراكاتها للخطط الموحدة بنجاح دون أي مساس ببيانات العملاء.`
                    : 'الخطط موحدة بالفعل ولا توجد خطط مكررة متطابقة.',
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
    }
}

DataManager.init();
