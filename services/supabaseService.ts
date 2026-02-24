import { supabase } from '../utils/supabaseClient';
import * as db from '../utils/db';
import type { 
    Product, ProductBatch, SaleInvoice, PurchaseInvoice, InTransitInvoice, Supplier, Customer, 
    Employee, Expense, Role, User, StoreSettings, ActivityLog, 
    CustomerTransaction, SupplierTransaction, PayrollTransaction, AppState, Service,
    DepositHolder, DepositTransaction
} from '../types';

export interface AdminProfile {
    id: string;
    email: string;
    is_approved: boolean;
    current_device_id: string | null;
}

// DEFAULT ADMIN ROLE (Local Fallback)
const DEFAULT_ADMIN_ROLE: Role = {
    id: 'admin-role',
    name: 'Admin',
    permissions: [
        'page:dashboard', 'page:inventory', 'page:pos', 'page:purchases', 'page:accounting', 'page:reports', 'page:settings', 'page:in_transit', 'page:deposits',
        'inventory:add_product', 'inventory:edit_product', 'inventory:delete_product',
        'pos:create_invoice', 'pos:edit_invoice', 'pos:apply_discount', 'pos:create_credit_sale',
        'purchase:create_invoice', 'purchase:edit_invoice',
        'in_transit:confirm_receipt',
        'accounting:manage_suppliers', 'accounting:manage_customers', 'accounting:manage_payroll', 'accounting:manage_expenses', 'accounting:manage_deposits',
        'settings:manage_store', 'settings:manage_users', 'settings:manage_backup', 'settings:manage_services', 'settings:manage_alerts'
    ]
};

const DEFAULT_SETTINGS: StoreSettings = {
    storeName: 'پویا پارسا',
    address: '',
    phone: '',
    lowStockThreshold: 10,
    expiryThresholdMonths: 3,
    currencyName: 'افغانی',
    currencySymbol: 'AFN',
    packageLabel: 'بسته',
    unitLabel: 'عدد',
    baseCurrency: 'AFN',
    currencyConfigs: {
        AFN: { code: 'AFN', name: 'افغانی', symbol: 'AFN', method: 'multiply' },
        USD: { code: 'USD', name: 'دلار', symbol: '$', method: 'divide' },
        IRT: { code: 'IRT', name: 'تومان', symbol: 'IRT', method: 'multiply' }
    }
};

export const api = {
    // --- ADMIN AUTH & PROFILES (Online Only) ---
    getProfile: async (userId: string): Promise<AdminProfile | null> => {
        try {
            const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
            if (error) return null;
            return data;
        } catch (e) {
            return null;
        }
    },
    updateProfile: async (userId: string, updates: Partial<AdminProfile>): Promise<boolean> => {
        try {
            const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
            if (error) {
                console.error("Supabase update error:", error);
                return false;
            }
            return true;
        } catch (e) {
            console.error("Profile update failed:", e);
            return false;
        }
    },

    // --- CLOUD BACKUP ---
    saveCloudBackup: async (userId: string, appState: any): Promise<boolean> => {
        try {
            const { error } = await supabase.from('backups').upsert({
                user_id: userId,
                data: appState,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });
            return !error;
        } catch (e) {
            return false;
        }
    },
    getCloudBackup: async (userId: string): Promise<any | null> => {
        try {
            const { data, error } = await supabase.from('backups').select('data').eq('user_id', userId).maybeSingle();
            if (error || !data) return null;
            return data.data;
        } catch (e) {
            return null;
        }
    },
    
    // --- STAFF AUTH (100% LOCAL) ---
    verifyStaffCredentials: async (username: string, password: string): Promise<User | null> => {
        const users = await db.getAll<User>(db.STORES.USERS);
        const user = users.find(u => u.username === username && u.password === password);
        return user || null;
    },

    // --- SETTINGS (Local) ---
    getSettings: async () => {
        const settings = await db.getById<StoreSettings>(db.STORES.SETTINGS, 'current');
        return settings || DEFAULT_SETTINGS;
    },
    updateSettings: async (settings: StoreSettings) => {
        await db.putItem(db.STORES.SETTINGS, { ...settings, id: 'current' });
    },

    // --- USERS & ROLES (LOCAL) ---
    getUsers: async () => db.getAll<User>(db.STORES.USERS),
    getRoles: async () => {
        const roles = await db.getAll<Role>(db.STORES.ROLES);
        if (roles.length === 0) {
            await db.putItem(db.STORES.ROLES, DEFAULT_ADMIN_ROLE);
            return [DEFAULT_ADMIN_ROLE];
        }
        return roles;
    },
    addUser: async (user: Omit<User, 'id'>) => {
        const newId = crypto.randomUUID();
        const newUser = { ...user, id: newId };
        await db.putItem(db.STORES.USERS, newUser);
        return newUser;
    },
    updateUser: async (user: Partial<User> & { id: string }) => {
        const existing = await db.getById<User>(db.STORES.USERS, user.id);
        if (existing) await db.putItem(db.STORES.USERS, { ...existing, ...user });
    },
    deleteUser: async (id: string) => db.deleteItem(db.STORES.USERS, id),
    addRole: async (role: Omit<Role, 'id'>) => {
        const newId = crypto.randomUUID();
        const newRole = { ...role, id: newId };
        await db.putItem(db.STORES.ROLES, newRole);
        return newRole;
    },
    updateRole: async (role: Role) => db.putItem(db.STORES.ROLES, role),
    deleteRole: async (id: string) => {
        if (id === 'admin-role') return;
        await db.deleteItem(db.STORES.ROLES, id);
    },

    // --- SHOP ENTITIES ---
    getProducts: async () => db.getAll<Product>(db.STORES.PRODUCTS),
    addProduct: async (product: Omit<Product, 'id'|'batches'>, firstBatch: Omit<ProductBatch, 'id'>) => {
        const productId = crypto.randomUUID();
        const batchId = crypto.randomUUID();
        const newProduct: Product = { ...product, id: productId, batches: [{ ...firstBatch, id: batchId }] };
        await db.putItem(db.STORES.PRODUCTS, newProduct);
        return newProduct;
    },
    updateProduct: async (product: Product) => db.putItem(db.STORES.PRODUCTS, product),
    deleteProduct: async (id: string) => db.deleteItem(db.STORES.PRODUCTS, id),

    getServices: async () => db.getAll<Service>(db.STORES.SERVICES),
    addService: async (service: Omit<Service, 'id'>) => {
        const id = crypto.randomUUID();
        const newService = { ...service, id };
        await db.putItem(db.STORES.SERVICES, newService);
        return newService;
    },
    deleteService: async (id: string) => db.deleteItem(db.STORES.SERVICES, id),

    getEntities: async () => {
        const [customers, suppliers, employees, expenses, depositHolders] = await Promise.all([
            db.getAll<Customer>(db.STORES.CUSTOMERS),
            db.getAll<Supplier>(db.STORES.SUPPLIERS),
            db.getAll<Employee>(db.STORES.EMPLOYEES),
            db.getAll<Expense>(db.STORES.EXPENSES),
            db.getAll<DepositHolder>(db.STORES.DEPOSIT_HOLDERS)
        ]);
        return { customers, suppliers, employees, expenses, depositHolders };
    },
    addCustomer: async (c: any) => { 
        const id = crypto.randomUUID(); 
        const item = { ...c, id, balance: 0, balanceAFN: 0, balanceUSD: 0, balanceIRT: 0 }; 
        await db.putItem(db.STORES.CUSTOMERS, item); 
        return item; 
    },
    updateCustomer: async (c: Customer) => db.putItem(db.STORES.CUSTOMERS, c),
    deleteCustomer: async (id: string) => db.deleteItem(db.STORES.CUSTOMERS, id),
    addSupplier: async (s: any) => { 
        const id = crypto.randomUUID(); 
        const item = { ...s, id, balance: 0, balanceAFN: 0, balanceUSD: 0, balanceIRT: 0 }; 
        await db.putItem(db.STORES.SUPPLIERS, item); 
        return item; 
    },
    updateSupplier: async (s: Supplier) => db.putItem(db.STORES.SUPPLIERS, s),
    deleteSupplier: async (id: string) => db.deleteItem(db.STORES.SUPPLIERS, id),
    addEmployee: async (e: any) => { const id = crypto.randomUUID(); const item = { ...e, id, balance: 0 }; await db.putItem(db.STORES.EMPLOYEES, item); return item; },
    addExpense: async (e: any) => { const id = crypto.randomUUID(); const item = { ...e, id }; await db.putItem(db.STORES.EXPENSES, item); return item; },

    // --- SECURITY DEPOSITS (LOCAL) ---
    addDepositHolder: async (holder: Omit<DepositHolder, 'id' | 'balanceAFN' | 'balanceUSD' | 'balanceIRT' | 'createdAt'>) => {
        const id = crypto.randomUUID();
        const newHolder: DepositHolder = { ...holder, id, balanceAFN: 0, balanceUSD: 0, balanceIRT: 0, createdAt: new Date().toISOString() };
        await db.putItem(db.STORES.DEPOSIT_HOLDERS, newHolder);
        return newHolder;
    },
    updateDepositHolder: async (holder: DepositHolder) => db.putItem(db.STORES.DEPOSIT_HOLDERS, holder),
    deleteDepositHolder: async (id: string) => db.deleteItem(db.STORES.DEPOSIT_HOLDERS, id),
    addDepositTransaction: async (tx: DepositTransaction) => db.putItem(db.STORES.DEPOSIT_TRANSACTIONS, tx),

    getTransactions: async () => {
        const [customerTransactions, supplierTransactions, payrollTransactions, depositTransactions] = await Promise.all([
            db.getAll<CustomerTransaction>(db.STORES.CUSTOMER_TX),
            db.getAll<SupplierTransaction>(db.STORES.SUPPLIER_TX),
            db.getAll<PayrollTransaction>(db.STORES.PAYROLL_TX),
            db.getAll<DepositTransaction>(db.STORES.DEPOSIT_TRANSACTIONS)
        ]);
        return { customerTransactions, supplierTransactions, payrollTransactions, depositTransactions };
    },

    getInvoices: async () => {
        const [saleInvoices, purchaseInvoices, inTransitInvoices] = await Promise.all([
            db.getAll<SaleInvoice>(db.STORES.SALE_INVOICES),
            db.getAll<PurchaseInvoice>(db.STORES.PURCHASE_INVOICES),
            db.getAll<InTransitInvoice>(db.STORES.IN_TRANSIT_INVOICES)
        ]);
        return { 
            saleInvoices: saleInvoices.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()), 
            purchaseInvoices: purchaseInvoices.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
            inTransitInvoices: inTransitInvoices.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        };
    },

    getActivities: async () => {
        const logs = await db.getAll<ActivityLog>(db.STORES.ACTIVITY);
        return logs.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 100);
    },
    addActivity: async (log: ActivityLog) => db.putItem(db.STORES.ACTIVITY, log),

    createSale: async (invoice: SaleInvoice, stockUpdates: {batchId: string, newStock: number}[], customerUpdate?: {id: string, newBalances: {AFN: number, USD: number, IRT: number, Total: number}, transaction: CustomerTransaction}) => {
        await db.putItem(db.STORES.SALE_INVOICES, invoice);
        for (const update of stockUpdates) {
            const product = await findProductByBatchId(update.batchId);
            if (product) {
                product.batches = product.batches.map(b => b.id === update.batchId ? { ...b, stock: update.newStock } : b);
                await db.putItem(db.STORES.PRODUCTS, product);
            }
        }
        if (customerUpdate) {
            const customer = await db.getById<Customer>(db.STORES.CUSTOMERS, customerUpdate.id);
            if (customer) {
                await db.putItem(db.STORES.CUSTOMERS, { ...customer, balanceAFN: customerUpdate.newBalances.AFN, balanceUSD: customerUpdate.newBalances.USD, balanceIRT: customerUpdate.newBalances.IRT, balance: customerUpdate.newBalances.Total });
                await db.putItem(db.STORES.CUSTOMER_TX, customerUpdate.transaction);
            }
        }
    },

    updateSale: async (invoiceId: string, newInvoiceData: SaleInvoice, stockRestores: {batchId: string, quantity: number}[], stockUpdates: {batchId: string, newStock: number}[], customerUpdates: {id: string, newBalances: {AFN: number, USD: number, IRT: number, Total: number}}[], transaction: CustomerTransaction) => {
        await db.putItem(db.STORES.SALE_INVOICES, newInvoiceData);
        for (const restore of stockRestores) {
            const product = await findProductByBatchId(restore.batchId);
            if (product) {
                product.batches = product.batches.map(b => b.id === restore.batchId ? { ...b, stock: b.stock + restore.quantity } : b);
                await db.putItem(db.STORES.PRODUCTS, product);
            }
        }
        for (const update of stockUpdates) {
            const product = await findProductByBatchId(update.batchId);
            if (product) {
                product.batches = product.batches.map(b => b.id === update.batchId ? { ...b, stock: update.newStock } : b);
                await db.putItem(db.STORES.PRODUCTS, product);
            }
        }
        for (const cu of customerUpdates) {
            const customer = await db.getById<Customer>(db.STORES.CUSTOMERS, cu.id);
            if (customer) await db.putItem(db.STORES.CUSTOMERS, { ...customer, balanceAFN: cu.newBalances.AFN, balanceUSD: cu.newBalances.USD, balanceIRT: cu.newBalances.IRT, balance: cu.newBalances.Total });
        }
        const txs = await db.getAll<CustomerTransaction>(db.STORES.CUSTOMER_TX);
        const existingTx = txs.find(t => t.invoiceId === invoiceId);
        if (existingTx) {
            Object.assign(existingTx, { amount: transaction.amount, date: transaction.date, currency: transaction.currency, customerId: transaction.customerId });
            await db.putItem(db.STORES.CUSTOMER_TX, existingTx);
        } else if (transaction.customerId) await db.putItem(db.STORES.CUSTOMER_TX, transaction);
    },

    createSaleReturn: async (returnInvoice: SaleInvoice, stockRestores: {batchId: string, quantity: number}[], customerRefund?: {id: string, amount: number, currency: 'AFN'|'USD'|'IRT', newBalances: any}) => {
        await db.putItem(db.STORES.SALE_INVOICES, returnInvoice);
        for (const restore of stockRestores) {
            const product = await findProductByBatchId(restore.batchId);
            if (product) {
                product.batches = product.batches.map(b => b.id === restore.batchId ? { ...b, stock: b.stock + restore.quantity } : b);
                await db.putItem(db.STORES.PRODUCTS, product);
            }
        }
        if (customerRefund) {
            const customer = await db.getById<Customer>(db.STORES.CUSTOMERS, customerRefund.id);
            if (customer) {
                await db.putItem(db.STORES.CUSTOMERS, { ...customer, balanceAFN: customerRefund.newBalances.AFN, balanceUSD: customerRefund.newBalances.USD, balanceIRT: customerRefund.newBalances.IRT, balance: customerRefund.newBalances.Total });
                const returnTx: CustomerTransaction = { id: crypto.randomUUID(), customerId: customerRefund.id, type: 'sale_return', amount: customerRefund.amount, date: returnInvoice.timestamp, description: `مرجوعی فاکتور #${returnInvoice.originalInvoiceId}`, invoiceId: returnInvoice.id, currency: customerRefund.currency };
                await db.putItem(db.STORES.CUSTOMER_TX, returnTx);
            }
        }
    },

    createPurchase: async (invoice: PurchaseInvoice, supplierUpdate: {id: string, newBalances: any, transaction: SupplierTransaction}, newBatches: any[]) => {
        await db.putItem(db.STORES.PURCHASE_INVOICES, invoice);
        await db.putItem(db.STORES.SUPPLIER_TX, supplierUpdate.transaction);
        const supplier = await db.getById<Supplier>(db.STORES.SUPPLIERS, supplierUpdate.id);
        if (supplier) await db.putItem(db.STORES.SUPPLIERS, { ...supplier, balanceAFN: supplierUpdate.newBalances.AFN, balanceUSD: supplierUpdate.newBalances.USD, balanceIRT: supplierUpdate.newBalances.IRT, balance: supplierUpdate.newBalances.Total });
        for (const b of newBatches) {
            const p = await db.getById<Product>(db.STORES.PRODUCTS, b.productId);
            if (p) { p.batches.push(b); await db.putItem(db.STORES.PRODUCTS, p); }
        }
    },

    updatePurchase: async (invoiceId: string, newInvoiceData: PurchaseInvoice, supplierUpdate?: {id: string, newBalances: any}) => {
        const settings = await api.getSettings();
        const oldInvoice = await db.getById<PurchaseInvoice>(db.STORES.PURCHASE_INVOICES, invoiceId);
        if (oldInvoice) {
            for (const item of oldInvoice.items) {
                const product = await db.getById<Product>(db.STORES.PRODUCTS, item.productId);
                if (product) {
                    const bIdx = product.batches.findIndex(b => b.lotNumber === item.lotNumber);
                    if (bIdx !== -1) { product.batches[bIdx].stock -= item.quantity; await db.putItem(db.STORES.PRODUCTS, product); }
                }
            }
        }

        await db.putItem(db.STORES.PURCHASE_INVOICES, newInvoiceData);

        const totalQty = newInvoiceData.items.reduce((s, i) => s + (i.quantity || 0), 0);
        const rate = newInvoiceData.exchangeRate || 1;
        const config = settings.currencyConfigs[newInvoiceData.currency || settings.baseCurrency];
        
        const additionalCostBase = newInvoiceData.additionalCost 
            ? (newInvoiceData.currency === settings.baseCurrency ? newInvoiceData.additionalCost : (config.method === 'multiply' ? newInvoiceData.additionalCost / rate : newInvoiceData.additionalCost * rate)) 
            : 0;
        const costPerUnitBase = totalQty > 0 ? additionalCostBase / totalQty : 0;

        for (const item of newInvoiceData.items) {
            const product = await db.getById<Product>(db.STORES.PRODUCTS, item.productId);
            if (product) {
                const bIdx = product.batches.findIndex(b => b.lotNumber === item.lotNumber);
                const priceBase = (newInvoiceData.currency === settings.baseCurrency ? item.purchasePrice : (config.method === 'multiply' ? item.purchasePrice / rate : item.purchasePrice * rate)) + costPerUnitBase;
                if (bIdx !== -1) {
                    product.batches[bIdx].stock += item.quantity;
                    product.batches[bIdx].purchasePrice = priceBase;
                    product.batches[bIdx].expiryDate = item.expiryDate;
                } else {
                    product.batches.push({ id: crypto.randomUUID(), lotNumber: item.lotNumber, stock: item.quantity, purchasePrice: priceBase, purchaseDate: newInvoiceData.timestamp, expiryDate: item.expiryDate });
                }
                await db.putItem(db.STORES.PRODUCTS, product);
            }
        }

        if (supplierUpdate) {
            const supplier = await db.getById<Supplier>(db.STORES.SUPPLIERS, supplierUpdate.id);
            if (supplier) {
                await db.putItem(db.STORES.SUPPLIERS, { ...supplier, balanceAFN: supplierUpdate.newBalances.AFN, balanceUSD: supplierUpdate.newBalances.USD, balanceIRT: supplierUpdate.newBalances.IRT, balance: supplierUpdate.newBalances.Total });
                const txs = await db.getAll<SupplierTransaction>(db.STORES.SUPPLIER_TX);
                const existingTx = txs.find(t => t.invoiceId === invoiceId);
                if (existingTx) {
                    Object.assign(existingTx, { amount: newInvoiceData.totalAmount, date: newInvoiceData.timestamp, currency: newInvoiceData.currency });
                    await db.putItem(db.STORES.SUPPLIER_TX, existingTx);
                }
            }
        }
    },

    createPurchaseReturn: async (returnInvoice: PurchaseInvoice, stockDeductions: {productId: string, quantity: number, lotNumber: string}[], supplierRefund?: {id: string, amount: number, currency: 'AFN'|'USD'|'IRT', newBalances: any}) => {
        await db.putItem(db.STORES.PURCHASE_INVOICES, returnInvoice);
        for (const deduct of stockDeductions) {
            const p = await db.getById<Product>(db.STORES.PRODUCTS, deduct.productId);
            if (p) {
                const batch = p.batches.find(b => b.lotNumber === deduct.lotNumber);
                if (batch) { batch.stock = Math.max(0, batch.stock - deduct.quantity); await db.putItem(db.STORES.PRODUCTS, p); }
            }
        }
        if (supplierRefund) {
            const supplier = await db.getById<Supplier>(db.STORES.SUPPLIERS, supplierRefund.id);
            if (supplier) {
                await db.putItem(db.STORES.SUPPLIERS, { ...supplier, balanceAFN: supplierRefund.newBalances.AFN, balanceUSD: supplierRefund.newBalances.USD, balanceIRT: supplierRefund.newBalances.IRT, balance: supplierRefund.newBalances.Total });
                const returnTx: SupplierTransaction = { id: crypto.randomUUID(), supplierId: supplierRefund.id, type: 'purchase_return', amount: supplierRefund.amount, date: returnInvoice.timestamp, description: `مرجوعی خرید فاکتور #${returnInvoice.originalInvoiceId}`, invoiceId: returnInvoice.id, currency: supplierRefund.currency };
                await db.putItem(db.STORES.SUPPLIER_TX, returnTx);
            }
        }
    },

    createInTransit: async (invoice: InTransitInvoice) => db.putItem(db.STORES.IN_TRANSIT_INVOICES, invoice),
    updateInTransit: async (invoice: InTransitInvoice) => db.putItem(db.STORES.IN_TRANSIT_INVOICES, invoice),
    deleteInTransit: async (id: string) => db.deleteItem(db.STORES.IN_TRANSIT_INVOICES, id),

    processPayment: async (entityType: 'customer' | 'supplier' | 'employee', entityId: string, newBalance: any, transaction: any) => {
        const store = entityType === 'customer' ? db.STORES.CUSTOMERS : (entityType === 'supplier' ? db.STORES.SUPPLIERS : db.STORES.EMPLOYEES);
        const txStore = entityType === 'customer' ? db.STORES.CUSTOMER_TX : (entityType === 'supplier' ? db.STORES.SUPPLIER_TX : db.STORES.PAYROLL_TX);
        const entity = await db.getById<any>(store, entityId);
        if (entity) {
            if (entityType === 'supplier' || entityType === 'customer') {
                await db.putItem(store, { ...entity, balanceAFN: newBalance.AFN, balanceUSD: newBalance.USD, balanceIRT: newBalance.IRT, balance: newBalance.Total });
            } else await db.putItem(store, { ...entity, balance: newBalance });
            await db.putItem(txStore, transaction);
        }
    },

    processPayroll: async (updates: {id: string, balance: 0}[], transactions: PayrollTransaction[], expense: Expense) => {
        for (const u of updates) {
            const emp = await db.getById<Employee>(db.STORES.EMPLOYEES, u.id);
            if (emp) await db.putItem(db.STORES.EMPLOYEES, { ...emp, balance: 0 });
        }
        for (const tx of transactions) await db.putItem(db.STORES.PAYROLL_TX, tx);
        await db.putItem(db.STORES.EXPENSES, expense);
    },

    clearAndRestoreData: async (data: AppState) => {
        const stores = Object.values(db.STORES);
        for (const storeName of stores) await db.clearStore(storeName);
        if (data.storeSettings) await db.putItem(db.STORES.SETTINGS, { ...data.storeSettings, id: 'current' });
        if (data.products) for (const p of data.products) await db.putItem(db.STORES.PRODUCTS, p);
        if (data.saleInvoices) for (const s of data.saleInvoices) await db.putItem(db.STORES.SALE_INVOICES, s);
        if (data.purchaseInvoices) for (const p of data.purchaseInvoices) await db.putItem(db.STORES.PURCHASE_INVOICES, p);
        if (data.inTransitInvoices) for (const i of data.inTransitInvoices) await db.putItem(db.STORES.IN_TRANSIT_INVOICES, i);
        if (data.customers) for (const c of data.customers) await db.putItem(db.STORES.CUSTOMERS, c);
        if (data.suppliers) for (const s of data.suppliers) await db.putItem(db.STORES.SUPPLIERS, s);
        if (data.employees) for (const e of data.employees) await db.putItem(db.STORES.EMPLOYEES, e);
        if (data.expenses) for (const e of data.expenses) await db.putItem(db.STORES.EXPENSES, e);
        if (data.services) for (const s of data.services) await db.putItem(db.STORES.SERVICES, s);
        if (data.depositHolders) for (const h of data.depositHolders) await db.putItem(db.STORES.DEPOSIT_HOLDERS, h);
        if (data.customerTransactions) for (const t of data.customerTransactions) await db.putItem(db.STORES.CUSTOMER_TX, t);
        if (data.supplierTransactions) for (const t of data.supplierTransactions) await db.putItem(db.STORES.SUPPLIER_TX, t);
        if (data.payrollTransactions) for (const t of data.payrollTransactions) await db.putItem(db.STORES.PAYROLL_TX, t);
        if (data.depositTransactions) for (const t of data.depositTransactions) await db.putItem(db.STORES.DEPOSIT_TRANSACTIONS, t);
        if (data.activities) for (const a of data.activities) await db.putItem(db.STORES.ACTIVITY, a);
        if (data.users) for (const u of data.users) await db.putItem(db.STORES.USERS, u);
        if (data.roles) for (const r of data.roles) await db.putItem(db.STORES.ROLES, r);
    }
};

async function findProductByBatchId(batchId: string): Promise<Product | undefined> {
    const products = await db.getAll<Product>(db.STORES.PRODUCTS);
    return products.find(p => p.batches.some(b => b.id === batchId));
}