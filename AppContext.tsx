
import React, { createContext, useContext, ReactNode, useState, useEffect, useCallback, useRef } from 'react';
import type {
    Product, ProductBatch, SaleInvoice, PurchaseInvoice, InTransitInvoice, PurchaseInvoiceItem, InvoiceItem,
    Customer, Supplier, Employee, Expense, Service, StoreSettings, CartItem,
    CustomerTransaction, SupplierTransaction, PayrollTransaction, ActivityLog,
    User, Role, Permission, AppState, DepositHolder, DepositTransaction
} from './types';
import { api } from './services/supabaseService';
import { supabase } from './utils/supabaseClient';

interface AppContextType extends AppState {
    showToast: (message: string) => void;
    isLoading: boolean;
    isLoggingOut: boolean;
    isShopActive: boolean;
    
    // Auth
    login: (identifier: string, password: string, type: 'admin' | 'staff') => Promise<{ success: boolean; message: string; pending?: boolean; locked?: boolean }>;
    signup: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
    logout: (type: 'full' | 'switch') => Promise<{ success: boolean; message: string }>;
    hasPermission: (permission: Permission) => boolean;
    
    // Backup & Restore
    exportData: () => void;
    importData: (file: File) => void;
    cloudBackup: (isSilent?: boolean) => Promise<boolean>;
    cloudRestore: () => Promise<boolean>;
    autoBackupEnabled: boolean;
    setAutoBackupEnabled: (enabled: boolean) => void;

    // Users & Roles
    addUser: (user: Omit<User, 'id'>) => Promise<{ success: boolean; message: string }>;
    updateUser: (user: Partial<User> & { id: string }) => Promise<{ success: boolean; message: string }>;
    deleteUser: (userId: string) => Promise<void>;
    addRole: (role: Omit<Role, 'id'>) => Promise<{ success: boolean; message: string }>;
    updateRole: (role: Role) => Promise<{ success: boolean; message: string }>;
    deleteRole: (roleId: string) => Promise<void>;

    // Inventory Actions
    addProduct: (product: Omit<Product, 'id' | 'batches'>, firstBatch: Omit<ProductBatch, 'id'>) => { success: boolean; message: string }; 
    updateProduct: (product: Product) => { success: boolean; message: string };
    deleteProduct: (productId: string) => void;
    
    // POS Actions
    addToCart: (itemToAdd: Product | Service, type: 'product' | 'service') => { success: boolean; message: string };
    updateCartItemQuantity: (itemId: string, itemType: 'product' | 'service', newQuantity: number) => { success: boolean; message: string };
    updateCartItemFinalPrice: (itemId: string, itemType: 'product' | 'service', finalPrice: number) => void;
    removeFromCart: (itemId: string, itemType: 'product' | 'service') => void;
    completeSale: (cashier: string, customerId?: string, currency?: 'AFN'|'USD'|'IRT', exchangeRate?: number) => Promise<{ success: boolean; invoice?: SaleInvoice; message: string }>;
    beginEditSale: (invoiceId: string) => { success: boolean; message: string; customerId?: string; };
    cancelEditSale: () => void;
    addSaleReturn: (originalInvoiceId: string, returnItems: { id: string; type: 'product' | 'service'; quantity: number }[], cashier: string) => Promise<{ success: boolean, message: string }>;
    setInvoiceTransientCustomer: (invoiceId: string, customerName: string) => Promise<void>;
    
    // Purchase Actions
    addPurchaseInvoice: (invoiceData: Omit<PurchaseInvoice, 'id' | 'totalAmount' | 'items' | 'type' | 'originalInvoiceId'> & { items: Omit<PurchaseInvoiceItem, 'productName' | 'atFactoryQty' | 'inTransitQty' | 'receivedQty'>[], sourceInTransitId?: string, additionalCost?: number, costDescription?: string }) => Promise<{ success: boolean, message: string, invoice?: PurchaseInvoice }>;
    beginEditPurchase: (invoiceId: string) => { success: boolean; message: string };
    cancelEditPurchase: () => void;
    updatePurchaseInvoice: (invoiceData: Omit<PurchaseInvoice, 'id' | 'totalAmount' | 'items' | 'type' | 'originalInvoiceId'> & { items: Omit<PurchaseInvoiceItem, 'productName' | 'atFactoryQty' | 'inTransitQty' | 'receivedQty'>[], additionalCost?: number, costDescription?: string }) => Promise<{ success: boolean, message: string }>;
    addPurchaseReturn: (originalInvoiceId: string, returnItems: { productId: string; lotNumber: string, quantity: number }[]) => Promise<{ success: boolean, message: string }>;

    // In-Transit Actions
    addInTransitInvoice: (invoiceData: Omit<InTransitInvoice, 'id' | 'totalAmount' | 'items' | 'type'> & { items: Omit<PurchaseInvoiceItem, 'productName' | 'atFactoryQty' | 'inTransitQty' | 'receivedQty'>[] }) => { success: boolean, message: string };
    updateInTransitInvoice: (invoiceData: Omit<InTransitInvoice, 'totalAmount' | 'items' | 'type'> & { items: Omit<PurchaseInvoiceItem, 'productName' | 'atFactoryQty' | 'inTransitQty' | 'receivedQty'>[] }) => { success: boolean, message: string };
    deleteInTransitInvoice: (id: string) => void;
    archiveInTransitInvoice: (id: string) => Promise<void>;
    moveInTransitItems: (invoiceId: string, movements: { [pid: string]: { toTransit: number, toReceived: number, lotNumber: string, expiryDate?: string } }, additionalCost?: number, costDescription?: string) => Promise<{ success: boolean, message: string }>;
    addInTransitPayment: (invoiceId: string, amount: number, description: string, currency?: 'AFN' | 'USD' | 'IRT', exchangeRate?: number) => Promise<SupplierTransaction | null>;

    // Settings
    updateSettings: (newSettings: StoreSettings) => void;
    
    // Services
    addService: (service: Omit<Service, 'id'>) => void;
    deleteService: (serviceId: string) => void;
    
    // Accounting
    addSupplier: (supplier: Omit<Supplier, 'id' | 'balance' | 'balanceAFN' | 'balanceUSD' | 'balanceIRT'>, initialBalance?: { amount: number, type: 'creditor' | 'debtor', currency: 'AFN' | 'USD' | 'IRT', exchangeRate?: number }) => void;
    deleteSupplier: (id: string) => void;
    addSupplierPayment: (supplierId: string, amount: number, description: string, currency?: 'AFN' | 'USD' | 'IRT', exchangeRate?: number) => Promise<SupplierTransaction>;
    
    addCustomer: (customer: Omit<Customer, 'id' | 'balance' | 'balanceAFN' | 'balanceUSD' | 'balanceIRT'>, initialBalance?: { amount: number, type: 'creditor' | 'debtor', currency: 'AFN' | 'USD' | 'IRT', exchangeRate?: number }) => void;
    deleteCustomer: (id: string) => void;
    addCustomerPayment: (customerId: string, amount: number, description: string, currency?: 'AFN' | 'USD' | 'IRT', exchangeRate?: number, trusteeId?: string) => Promise<CustomerTransaction | null>;
    
    addEmployee: (employee: Omit<Employee, 'id'|'balance'>) => void;
    addEmployeeAdvance: (employeeId: string, amount: number, description: string) => void;
    processAndPaySalaries: () => { success: boolean; message: string };
    addEmployeeAdvanceToEmployee: (employeeId: string, amount: number, description: string) => void;
    addExpense: (expense: Omit<Expense, 'id'>) => void;

    // Security Deposits
    addDepositHolder: (holder: Omit<DepositHolder, 'id' | 'balanceAFN' | 'balanceUSD' | 'balanceIRT' | 'createdAt'>) => Promise<void>;
    deleteDepositHolder: (id: string) => Promise<void>;
    processDepositTransaction: (holderId: string, type: 'deposit' | 'withdrawal', amount: number, currency: 'AFN' | 'USD' | 'IRT', description: string) => Promise<{ success: boolean; message: string }>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const SYSTEM_SUPER_OWNER_ID = 'system-super-owner';

const getDeviceId = () => {
    let id = localStorage.getItem('kasebyar_device_id');
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem('kasebyar_device_id', id);
    }
    return id;
};

const getDefaultState = (): AppState => {
    return {
        products: [], saleInvoices: [], purchaseInvoices: [], inTransitInvoices: [], customers: [],
        suppliers: [], employees: [], expenses: [], services: [], depositHolders: [], depositTransactions: [],
        storeSettings: {
            storeName: 'پویا پارسا', address: '', phone: '', lowStockThreshold: 10,
            expiryThresholdMonths: 3, currencyName: 'افغانی', currencySymbol: 'AFN',
            packageLabel: 'بسته', unitLabel: 'عدد',
            baseCurrency: 'AFN',
            currencyConfigs: {
                AFN: { code: 'AFN', name: 'افغانی', symbol: 'AFN', method: 'multiply' },
                USD: { code: 'USD', name: 'دلار', symbol: 'USD', method: 'divide' },
                IRT: { code: 'IRT', name: 'تومان', symbol: 'IRT', method: 'multiply' }
            }
        },
        cart: [], customerTransactions: [], supplierTransactions: [], payrollTransactions: [],
        activities: [], saleInvoiceCounter: 0, editingSaleInvoiceId: null, editingPurchaseInvoiceId: null,
        isAuthenticated: false, currentUser: null,
        users: [],
        roles: [],
    };
};

const generateNextId = (prefix: string, ids: string[]): string => {
    let max = 0;
    const regex = new RegExp(`^${prefix}(\\d+)$`); 
    for (const id of ids) {
        const match = id.match(regex);
        if (match) {
             const num = parseInt(match[1], 10);
             if (!isNaN(num)) {
                 if (num > max) max = num;
             }
        }
    }
    return `${prefix}${max + 1}`;
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, setState] = useState<AppState>(getDefaultState());
    const [isLoading, setIsLoading] = useState(true);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isShopActive, setIsShopActive] = useState(() => localStorage.getItem('kasebyar_shop_active') === 'true');
    const [autoBackupEnabled, setAutoBackupEnabled] = useState(() => localStorage.getItem('kasebyar_auto_backup') === 'true');

    const showToast = useCallback((message: string) => {
        console.log("Toast:", message);
    }, []);

    const fetchData = useCallback(async (isSilent = false) => {
        if (!isSilent) setIsLoading(true);
        try {
            const [settings, users, roles, products, services, entities, transactions, invoices, activity] = await Promise.all([
                api.getSettings().catch(() => ({})),
                api.getUsers().catch(() => []),
                api.getRoles().catch(() => []),
                api.getProducts().catch(() => []),
                api.getServices().catch(() => []),
                api.getEntities().catch(() => ({ customers: [], suppliers: [], employees: [], expenses: [], depositHolders: [] })),
                api.getTransactions().catch(() => ({ customerTransactions: [], supplierTransactions: [], payrollTransactions: [], depositTransactions: [] })),
                api.getInvoices().catch(() => ({ saleInvoices: [], purchaseInvoices: [], inTransitInvoices: [] })),
                api.getActivities().catch(() => [])
            ]);

            const isSessionLocked = localStorage.getItem('kasebyar_session_locked') === 'true';
            const cachedOwner = localStorage.getItem('kasebyar_user_identity');
            let ownerIdentity = null;
            if (cachedOwner) {
                try { ownerIdentity = JSON.parse(cachedOwner); } catch(e) { console.error("Identity cache corruption", e); }
            }

            const shopStatus = !!ownerIdentity;
            localStorage.setItem('kasebyar_shop_active', String(shopStatus));
            setIsShopActive(shopStatus);

            let isAuth = false;
            let restoredUser = null;

            if (!isSessionLocked) {
                const localStaff = localStorage.getItem('kasebyar_staff_user');
                if (localStaff && shopStatus) {
                    try {
                        const parsedStaff = JSON.parse(localStaff) as User;
                        const dbUser = users.find(u => u.id === parsedStaff.id);
                        if (dbUser) { isAuth = true; restoredUser = dbUser; }
                    } catch(e) {}
                }
                if (!restoredUser && ownerIdentity) {
                    isAuth = true;
                    restoredUser = { id: ownerIdentity.id, username: ownerIdentity.email || 'Owner', roleId: SYSTEM_SUPER_OWNER_ID };
                }
                if (!restoredUser && navigator.onLine) {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session?.user) {
                        const profile = await api.getProfile(session.user.id);
                        if (profile?.is_approved) {
                            localStorage.setItem('kasebyar_user_identity', JSON.stringify(profile));
                            isAuth = true;
                            restoredUser = { id: session.user.id, username: session.user.email || 'Owner', roleId: SYSTEM_SUPER_OWNER_ID };
                            setIsShopActive(true);
                            localStorage.setItem('kasebyar_shop_active', 'true');
                        }
                    }
                }
            }

            setState(prev => {
                const mergedSettings = (settings as StoreSettings).storeName ? { ...prev.storeSettings, ...settings } : prev.storeSettings;
                
                // Ensure currencyConfigs exists for backward compatibility
                if (!mergedSettings.currencyConfigs) {
                    mergedSettings.currencyConfigs = prev.storeSettings.currencyConfigs;
                }
                if (!mergedSettings.baseCurrency) {
                    mergedSettings.baseCurrency = prev.storeSettings.baseCurrency;
                }

                return {
                    ...prev,
                    storeSettings: mergedSettings,
                    users,
                    roles: roles.length > 0 ? roles : [{ id: 'admin-role', name: 'Admin', permissions: ['page:dashboard', 'page:inventory', 'page:pos', 'page:purchases', 'page:accounting', 'page:reports', 'page:settings', 'page:in_transit', 'page:deposits'] }],
                    products, services, customers: entities.customers, suppliers: entities.suppliers,
                    employees: entities.employees, expenses: entities.expenses,
                    depositHolders: entities.depositHolders, depositTransactions: transactions.depositTransactions,
                    customerTransactions: transactions.customerTransactions,
                    supplierTransactions: transactions.supplierTransactions,
                    payrollTransactions: transactions.payrollTransactions,
                    saleInvoices: invoices.saleInvoices, 
                    purchaseInvoices: invoices.purchaseInvoices,
                    inTransitInvoices: invoices.inTransitInvoices,
                    activities: activity,
                    isAuthenticated: isAuth,
                    currentUser: restoredUser
                };
            });
        } catch (error) {
            console.error("Critical Error fetching data:", error);
            showToast("⚠️ خطا در بارگذاری برنامه. لطفاً صفحه را رفرش کنید.");
        } finally {
            if (!isSilent) setIsLoading(false);
        }
    }, [showToast]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const logActivity = useCallback(async (type: ActivityLog['type'], description: string, refId?: string, refType?: ActivityLog['refType']) => {
        if (!state.currentUser) return;
        const displayName = state.currentUser.roleId === SYSTEM_SUPER_OWNER_ID ? 'صاحب فروشگاه' : state.currentUser.username;
        const newActivity: ActivityLog = { id: crypto.randomUUID(), type, description, timestamp: new Date().toISOString(), user: displayName, refId, refType };
        setState(prev => ({ ...prev, activities: [newActivity, ...prev.activities] }));
        try { await api.addActivity(newActivity); } catch (e) {}
    }, [state.currentUser]);

    const login = async (identifier: string, password: string, type: 'admin' | 'staff'): Promise<{ success: boolean; message: string; pending?: boolean; locked?: boolean }> => {
        if (type === 'admin') {
            try {
                const { data, error } = await supabase.auth.signInWithPassword({ email: identifier, password });
                if (error) return { success: false, message: 'ایمیل یا رمز عبور اشتباه است.' };
                const profile = await api.getProfile(data.user.id);
                if (!profile) return { success: false, message: 'پروفایل یافت نشد.' };
                if (!profile.is_approved) return { success: false, message: 'حساب در انتظار تایید است.', pending: true };
                const deviceId = getDeviceId();
                if (profile.current_device_id && profile.current_device_id !== deviceId) return { success: false, message: 'این حساب در دستگاه دیگری فعال است.', locked: true };
                if (!profile.current_device_id) await api.updateProfile(data.user.id, { current_device_id: deviceId });
                localStorage.setItem('kasebyar_user_identity', JSON.stringify(profile));
                localStorage.setItem('kasebyar_offline_auth', 'true');
                localStorage.setItem('kasebyar_shop_active', 'true');
                localStorage.setItem('kasebyar_session_locked', 'false');
                setIsShopActive(true);
                await fetchData();
                return { success: true, message: '✅ ورود موفق و بازگشایی فروشگاه' };
            } catch (e) { return { success: false, message: '❌ خطا در اتصال به سرور جهت تایید اولیه.' }; }
        } else {
            if (localStorage.getItem('kasebyar_shop_active') !== 'true') return { success: false, message: '❌ فروشگاه قفل است. مدیر باید ابتدا وارد شود.' };
            const user = await api.verifyStaffCredentials(identifier, password);
            if (user) {
                localStorage.setItem('kasebyar_staff_user', JSON.stringify(user));
                localStorage.setItem('kasebyar_session_locked', 'false');
                await fetchData();
                return { success: true, message: `✅ خوش آمدید ${user.username}` };
            } else return { success: false, message: 'نام کاربری یا رمز عبور اشتباه است.' };
        }
    };

    const logout = async (type: 'full' | 'switch'): Promise<{ success: boolean; message: string }> => {
        setIsLoggingOut(true);
        localStorage.removeItem('kasebyar_staff_user');
        if (type === 'full') {
            try {
                localStorage.removeItem('kasebyar_user_identity');
                const { data: { user } } = await supabase.auth.getUser();
                if (user && navigator.onLine) await api.updateProfile(user.id, { current_device_id: null });
                await supabase.auth.signOut();
                localStorage.removeItem('kasebyar_offline_auth');
                localStorage.setItem('kasebyar_shop_active', 'false');
                setIsShopActive(false);
            } catch (e) {}
        }
        localStorage.setItem('kasebyar_session_locked', 'true');
        setTimeout(() => { setState(prev => ({ ...prev, isAuthenticated: false, currentUser: null })); setIsLoggingOut(false); }, 500);
        return { success: true, message: 'خروج با موفقیت انجام شد.' };
    };

    const hasPermission = useCallback((permission: Permission): boolean => {
        if (!state.currentUser) return false;
        if (state.currentUser.roleId === SYSTEM_SUPER_OWNER_ID) return true;
        const userRole = state.roles.find(r => r.id === state.currentUser!.roleId);
        if (!userRole || !userRole.permissions) return false;
        return userRole.permissions.includes(permission);
    }, [state.currentUser, state.roles]);

    const addUser = async (userData: Omit<User, 'id'>) => {
        const newUser = await api.addUser(userData);
        setState(prev => ({ ...prev, users: [...prev.users, newUser] }));
        logActivity('login', `کاربر جدید اضافه شد: ${userData.username}`);
        return { success: true, message: '✅ کاربر اضافه شد.' };
    };

    const updateUser = async (userData: Partial<User> & { id: string }) => {
        await api.updateUser(userData);
        setState(prev => {
            const updatedUsers = prev.users.map(u => u.id === userData.id ? { ...u, ...userData } : u);
            let updatedCurrentUser = prev.currentUser;
            if (prev.currentUser?.id === userData.id) {
                updatedCurrentUser = { ...prev.currentUser, ...userData };
                if (localStorage.getItem('kasebyar_staff_user')) localStorage.setItem('kasebyar_staff_user', JSON.stringify(updatedCurrentUser));
            }
            return { ...prev, users: updatedUsers, currentUser: updatedCurrentUser };
        });
        logActivity('login', `اطلاعات کاربر ${userData.username || ''} بروزرسانی شد.`);
        return { success: true, message: '✅ بروزرسانی شد.' };
    };

    const addRole = async (roleData: Omit<Role, 'id'>) => {
        const newRole = await api.addRole(roleData);
        setState(prev => ({ ...prev, roles: [...prev.roles, newRole] }));
        logActivity('login', `نقش جدید تعریف شد: ${roleData.name}`);
        return { success: true, message: '✅ نقش اضافه شد.' };
    };

    const updateRole = async (roleData: Role) => {
        await api.updateRole(roleData);
        setState(prev => ({ ...prev, roles: prev.roles.map(r => r.id === roleData.id ? roleData : r) }));
        logActivity('login', `دسترسی‌های نقش ${roleData.name} تغییر یافت.`);
        return { success: true, message: '✅ نقش بروزرسانی شد.' };
    };

    const deleteRole = async (roleId: string) => {
        if (roleId === 'admin-role') return;
        await api.deleteRole(roleId);
        setState(prev => ({ ...prev, roles: prev.roles.filter(r => r.id !== roleId) }));
    };

    const signup = async (email: string, password: string) => {
        try {
            const { error } = await supabase.auth.signUp({ email, password });
            if (error) return { success: false, message: error.message };
            return { success: true, message: '✅ ثبت‌نام انجام شد.' };
        } catch (e) { return { success: false, message: '❌ خطا در ثبت‌نام.' }; }
    };

    const exportData = () => {
        const dataStr = JSON.stringify({ ...state, isAuthenticated: false, currentUser: null, cart: [] }, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `KasebYar_Backup_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const importData = async (file: File) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target?.result as string) as AppState;
                await api.clearAndRestoreData(data);
                await fetchData();
                showToast("✅ بازیابی با موفقیت انجام شد.");
            } catch (err) { showToast("❌ خطا در ساختار فایل."); }
        };
        reader.readAsText(file);
    };

    const cloudBackup = async (isSilent = false) => {
        if (!navigator.onLine || !state.currentUser) return false;
        try {
            const success = await api.saveCloudBackup(state.currentUser.id, { ...state, isAuthenticated: false, currentUser: null, cart: [] });
            if (success) localStorage.setItem('kasebyar_last_backup', Date.now().toString());
            return success;
        } catch (error) { return false; }
    };

    const cloudRestore = async () => {
        if (!navigator.onLine || !state.currentUser) return false;
        try {
            const data = await api.getCloudBackup(state.currentUser.id);
            if (data) { await api.clearAndRestoreData(data); await fetchData(); return true; }
            return false;
        } catch (error) { return false; }
    };

    const addProduct = (p: any, b: any) => { 
        api.addProduct(p, b).then(np => { setState(prev => ({ ...prev, products: [...prev.products, np] })); logActivity('inventory', `محصول جدید: ${p.name}`, np.id, 'product'); }); 
        return { success: true, message: 'ذخیره شد.' }; 
    };
    const updateProduct = (p: any) => { 
        api.updateProduct(p).then(() => { setState(prev => ({ ...prev, products: prev.products.map(x => x.id === p.id ? p : x) })); logActivity('inventory', `ویرایش: ${p.name}`, p.id, 'product'); }); 
        return { success: true, message: 'ویرایش شد.' }; 
    };
    const deleteProduct = (id: string) => { api.deleteProduct(id).then(() => setState(prev => ({ ...prev, products: prev.products.filter(p => p.id !== id) }))); };

    const addToCart = (item: any, type: any) => {
        let success = true;
        setState(prev => {
            const existing = prev.cart.findIndex(i => i.id === item.id && i.type === type);
            if (existing > -1) {
                const up = [...prev.cart];
                up[existing].quantity += 1;
                return { ...prev, cart: up };
            }
            return { ...prev, cart: [...prev.cart, { ...item, quantity: 1, type } as any] };
        });
        return { success, message: '' };
    };

    const updateCartItemQuantity = (id: string, type: any, qty: number) => {
        setState(prev => ({ ...prev, cart: prev.cart.map(i => (i.id === id && i.type === type) ? { ...i, quantity: qty } : i).filter(i => i.quantity > 0) }));
        return { success: true, message: '' };
    };

    const updateCartItemFinalPrice = (id: string, type: any, price: number) => {
        setState(prev => ({ ...prev, cart: prev.cart.map(i => (i.id === id && i.type === type && i.type === 'product') ? { ...i, finalPrice: price } : i) }));
    };

    const removeFromCart = (id: string, type: any) => {
        setState(prev => ({ ...prev, cart: prev.cart.filter(i => !(i.id === id && i.type === type)) }));
    };

    // --- Standardized POS Logic: Sales with FIFO Stock Updates and Atomic Replacement ---
    const completeSale = async (cashier: string, customerId?: string, currency: 'AFN'|'USD'|'IRT' = 'AFN', exchangeRate: number = 1): Promise<{ success: boolean; invoice?: SaleInvoice; message: string }> => {
        const { cart, products, editingSaleInvoiceId, saleInvoices, customers } = state;
        if (cart.length === 0) return { success: false, message: "سبد خالی است!" };

        const oldInv = editingSaleInvoiceId ? saleInvoices.find(inv => inv.id === editingSaleInvoiceId) : null;
        
        // 1. Virtual Inventory Restoration for FIFO Calculation
        const virtualProducts = JSON.parse(JSON.stringify(products)) as Product[];
        if (oldInv) {
            oldInv.items.forEach(item => {
                if (item.type === 'product' && item.batchDeductions) {
                    item.batchDeductions.forEach(d => {
                        const vp = virtualProducts.find(p => p.batches.some(b => b.id === d.batchId));
                        const vb = vp?.batches.find(b => b.id === d.batchId);
                        if (vb) vb.stock += d.quantity;
                    });
                }
            });
        }

        // 2. FIFO Calculation on Virtual Inventory
        const stockUpdates: {batchId: string, newStock: number}[] = [];
        const itemsWithBatches = cart.map(item => {
            if (item.type === 'product') {
                const p = virtualProducts.find(x => x.id === item.id);
                if (p) {
                    let remainingToDeduct = item.quantity;
                    const deductions: { batchId: string, quantity: number }[] = [];
                    const sortedBatches = [...p.batches].sort((a,b) => new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime());
                    
                    for (const b of sortedBatches) {
                        if (remainingToDeduct <= 0) break;
                        const deduct = Math.min(b.stock, remainingToDeduct);
                        if (deduct > 0) {
                            deductions.push({ batchId: b.id, quantity: deduct });
                            b.stock -= deduct; // Update virtual stock
                            
                            // Track final stock for this batch
                            const existingUpdate = stockUpdates.find(u => u.batchId === b.id);
                            if (existingUpdate) existingUpdate.newStock = b.stock;
                            else stockUpdates.push({ batchId: b.id, newStock: b.stock });
                            
                            remainingToDeduct -= deduct;
                        }
                    }
                    const totalCost = deductions.reduce((s, d) => s + (d.quantity * (p.batches.find(bx => bx.id === d.batchId)?.purchasePrice || 0)), 0);
                    return { ...item, batchDeductions: deductions, purchasePrice: deductions.length > 0 ? totalCost / item.quantity : 0 };
                }
            }
            return item;
        });

        // 3. Financial Totals (Dynamic Logic)
        const totalBaseAmount = cart.reduce((t, i) => {
            const price = (i.type === 'product' && i.finalPrice !== undefined) ? i.finalPrice : (i.type === 'product' ? i.salePrice : i.price);
            return (price * i.quantity) + t;
        }, 0);

        // Transactional amount calculation based on the user's dynamic rules:
        const config = state.storeSettings.currencyConfigs[currency];
        const totalTransactional = currency === state.storeSettings.baseCurrency 
            ? totalBaseAmount 
            : (config.method === 'multiply' ? totalBaseAmount * exchangeRate : totalBaseAmount / exchangeRate);

        const invId = editingSaleInvoiceId || generateNextId('F', saleInvoices.map(i => i.id));
        
        const finalInv: SaleInvoice = { 
            id: invId, 
            type: 'sale', 
            items: itemsWithBatches, 
            subtotal: totalTransactional, 
            totalAmount: totalTransactional, 
            totalAmountAFN: totalBaseAmount, // This field name is legacy, it stores the base amount
            totalDiscount: 0, 
            timestamp: new Date().toISOString(), 
            cashier, 
            customerId, 
            currency, 
            exchangeRate 
        };

        // 4. Atomic Balance Update
        const customerUpdates: {id: string, newBalances: {AFN: number, USD: number, IRT: number, Total: number}}[] = [];
        
        // Revert Old
        if (oldInv && oldInv.customerId) {
            const oc = customers.find(c => c.id === oldInv.customerId);
            if (oc) {
                let balAFN = oc.balanceAFN, balUSD = oc.balanceUSD, balIRT = oc.balanceIRT, balTotal = oc.balance;
                if (oldInv.currency === 'USD') balUSD -= oldInv.totalAmount;
                else if (oldInv.currency === 'IRT') balIRT -= oldInv.totalAmount;
                else balAFN -= oldInv.totalAmount;
                balTotal -= oldInv.totalAmountAFN;
                customerUpdates.push({ id: oc.id, newBalances: { AFN: balAFN, USD: balUSD, IRT: balIRT, Total: balTotal } });
            }
        }

        // Apply New (Fixing the currency balance error)
        if (customerId) {
            const nc = customers.find(c => c.id === customerId);
            if (nc) {
                const prevUpdate = customerUpdates.find(u => u.id === customerId);
                let balAFN = prevUpdate ? prevUpdate.newBalances.AFN : nc.balanceAFN;
                let balUSD = prevUpdate ? prevUpdate.newBalances.USD : nc.balanceUSD;
                let balIRT = prevUpdate ? prevUpdate.newBalances.IRT : nc.balanceIRT;
                let balTotal = prevUpdate ? prevUpdate.newBalances.Total : nc.balance;

                // FIX: Add the transactional amount to the specific currency wallet
                if (currency === 'USD') balUSD += totalTransactional;
                else if (currency === 'IRT') balIRT += totalTransactional;
                else balAFN += totalTransactional;
                
                // The total balance is always trackable in base currency
                balTotal += totalBaseAmount;

                const finalBal = { AFN: balAFN, USD: balUSD, IRT: balIRT, Total: balTotal };
                if (prevUpdate) prevUpdate.newBalances = finalBal;
                else customerUpdates.push({ id: nc.id, newBalances: finalBal });
            }
        }

        const tx: CustomerTransaction = { id: crypto.randomUUID(), customerId: customerId || '', type: 'credit_sale', amount: totalTransactional, date: finalInv.timestamp, description: `فاکتور #${invId}`, invoiceId: invId, currency };

        try {
            if (editingSaleInvoiceId) {
                const stockRestores: {batchId: string, quantity: number}[] = [];
                oldInv?.items.forEach(it => {
                    if (it.type === 'product' && it.batchDeductions) {
                        it.batchDeductions.forEach(d => stockRestores.push(d));
                    }
                });
                await api.updateSale(editingSaleInvoiceId, finalInv, stockRestores, stockUpdates, customerUpdates, tx);
            } else {
                await api.createSale(finalInv, stockUpdates, customerUpdates[0] ? { ...customerUpdates[0], transaction: tx } : undefined);
            }
            
            await fetchData(true);
            setState(prev => ({ ...prev, cart: [], editingSaleInvoiceId: null }));
            logActivity('sale', `${editingSaleInvoiceId ? 'ویرایش' : 'ثبت'} فاکتور فروش: ${invId}`, invId, 'saleInvoice');
            return { success: true, invoice: finalInv, message: 'فاکتور با موفقیت ثبت شد.' };
        } catch (e) { return { success: false, message: 'خطا در ثبت نهایی فاکتور.' }; }
    };

    // --- Standardized POS Logic: Sale Returns with Inventory Referencing ---
    const addSaleReturn = async (originalInvoiceId: string, returnItems: { id: string; type: 'product' | 'service'; quantity: number }[], cashier: string): Promise<{ success: boolean, message: string }> => {
        const { saleInvoices, products, customers } = state;
        const originalInv = saleInvoices.find(inv => inv.id === originalInvoiceId);
        if (!originalInv) return { success: false, message: "فاکتور اصلی یافت نشد." };

        const stockRestores: { batchId: string, quantity: number }[] = [];
        let returnTotalAFN = 0;
        let returnTotalTransactional = 0;

        const returnItemsDetails: CartItem[] = returnItems.map(ret => {
            const originalItem = originalInv.items.find(it => it.id === ret.id && it.type === ret.type);
            if (!originalItem) throw new Error("کالا در فاکتور اصلی یافت نشد.");
            if (ret.quantity > originalItem.quantity) throw new Error("تعداد مرجوعی بیش از تعداد فروخته شده است.");

            const itemPriceBase = (originalItem.type === 'product' && originalItem.finalPrice !== undefined) ? originalItem.finalPrice : (originalItem.type === 'product' ? originalItem.salePrice : originalItem.price);
            const rate = originalInv.exchangeRate || 1;
            
            // Re-calculate the transactional price for returning
            let lineTotalTransactional = 0;
            const config = state.storeSettings.currencyConfigs[originalInv.currency];
            
            if (originalInv.currency === state.storeSettings.baseCurrency) {
                lineTotalTransactional = itemPriceBase * ret.quantity;
            } else if (config.method === 'multiply') {
                lineTotalTransactional = (itemPriceBase * rate) * ret.quantity;
            } else {
                lineTotalTransactional = (itemPriceBase / rate) * ret.quantity;
            }

            returnTotalTransactional += lineTotalTransactional;
            returnTotalAFN += (itemPriceBase * ret.quantity);

            if (originalItem.type === 'product' && originalItem.batchDeductions) {
                let remainingToRestore = ret.quantity;
                originalItem.batchDeductions.forEach(d => {
                    if (remainingToRestore <= 0) return;
                    const restoreQty = Math.min(d.quantity, remainingToRestore);
                    stockRestores.push({ batchId: d.batchId, quantity: restoreQty });
                    remainingToRestore -= restoreQty;
                });
            }

            return { ...originalItem, quantity: ret.quantity } as CartItem;
        });

        const returnId = generateNextId('R', saleInvoices.map(i => i.id));
        const returnInv: SaleInvoice = {
            id: returnId,
            type: 'return',
            originalInvoiceId,
            items: returnItemsDetails,
            subtotal: returnTotalTransactional,
            totalAmount: returnTotalTransactional,
            totalAmountAFN: returnTotalAFN,
            totalDiscount: 0,
            timestamp: new Date().toISOString(),
            cashier,
            customerId: originalInv.customerId,
            currency: originalInv.currency,
            exchangeRate: originalInv.exchangeRate
        };

        let customerRefund = undefined;
        if (originalInv.customerId) {
            const customer = customers.find(c => c.id === originalInv.customerId);
            if (customer) {
                const newBalances = { ...customer };
                if (originalInv.currency === 'USD') newBalances.balanceUSD -= returnTotalTransactional;
                else if (originalInv.currency === 'IRT') newBalances.balanceIRT -= returnTotalTransactional;
                else newBalances.balanceAFN -= returnTotalTransactional;
                newBalances.balance -= returnTotalAFN;

                customerRefund = {
                    id: originalInv.customerId,
                    amount: returnTotalTransactional,
                    currency: originalInv.currency,
                    newBalances: { AFN: newBalances.balanceAFN, USD: newBalances.balanceUSD, IRT: newBalances.balanceIRT, Total: newBalances.balance }
                };
            }
        }

        try {
            await api.createSaleReturn(returnInv, stockRestores, customerRefund);
            await fetchData(true);
            logActivity('sale', `ثبت مرجوعی فروش: فاکتور ${returnId} (مرجع: ${originalInvoiceId})`, returnId, 'saleInvoice');
            return { success: true, message: "مرجوعی با موفقیت ثبت و انبار بروزرسانی شد." };
        } catch (e) {
            return { success: false, message: "خطا در ثبت مرجوعی." };
        }
    };

    const beginEditSale = (id: string) => {
        const inv = state.saleInvoices.find(i => i.id === id);
        if (!inv) return { success: false, message: "فاکتور یافت نشد." };
        setState(prev => ({ ...prev, editingSaleInvoiceId: id, cart: [...inv.items] }));
        return { success: true, message: "آماده ویرایش.", customerId: inv.customerId };
    };

    const cancelEditSale = () => setState(prev => ({ ...prev, editingSaleInvoiceId: null, cart: [] }));
    
    // --- Purchase Logic: Standardized Logic with Restoration Pattern ---
    const addPurchaseInvoice = async (data: any) => {
        const { suppliers, products, purchaseInvoices } = state;
        const supplier = suppliers.find(s => s.id === data.supplierId);
        if (!supplier) return { success: false, message: "تأمین کننده یافت نشد." };

        const id = data.id || generateNextId('P', purchaseInvoices.map(i => i.id));
        const rate = data.exchangeRate || 1;
        const totalCurrencyAmount = data.items.reduce((s: number, i: any) => s + (i.quantity * i.purchasePrice), 0);
        
        const config = state.storeSettings.currencyConfigs[data.currency || state.storeSettings.baseCurrency];
        const totalAmountBase = data.currency === state.storeSettings.baseCurrency 
            ? totalCurrencyAmount 
            : (config.method === 'multiply' ? totalCurrencyAmount / rate : totalCurrencyAmount * rate);
        
        // Calculate additional cost per unit in base currency
        const totalQty = data.items.reduce((s: number, i: any) => s + i.quantity, 0);
        const additionalCostBase = data.additionalCost 
            ? (data.currency === state.storeSettings.baseCurrency ? data.additionalCost : (config.method === 'multiply' ? data.additionalCost / rate : data.additionalCost * rate)) 
            : 0;
        const costPerUnitBase = totalQty > 0 ? additionalCostBase / totalQty : 0;

        const purchaseItems: PurchaseInvoiceItem[] = data.items.map((it: any) => ({
            ...it,
            productName: products.find(p => p.id === it.productId)?.name || 'ناشناس',
            atFactoryQty: 0, inTransitQty: 0, receivedQty: it.quantity
        }));

        const invoice: PurchaseInvoice = { ...data, id, items: purchaseItems, totalAmount: totalCurrencyAmount, type: 'purchase' };
        
        const newBalances = { ...supplier };
        if (data.currency === 'USD') newBalances.balanceUSD += totalCurrencyAmount;
        else if (data.currency === 'IRT') newBalances.balanceIRT += totalCurrencyAmount;
        else newBalances.balanceAFN += totalCurrencyAmount;
        newBalances.balance += totalAmountBase;

        const supplierUpdate = {
            id: data.supplierId,
            newBalances: { AFN: newBalances.balanceAFN, USD: newBalances.balanceUSD, IRT: newBalances.balanceIRT, Total: newBalances.balance },
            transaction: { id: crypto.randomUUID(), supplierId: data.supplierId, type: 'purchase', amount: totalCurrencyAmount, date: data.timestamp, description: `خرید فاکتور #${data.invoiceNumber || id}`, invoiceId: id, currency: data.currency } as SupplierTransaction
        };

        const newBatches = data.items.map((it: any) => ({
            id: crypto.randomUUID(),
            productId: it.productId,
            lotNumber: it.lotNumber,
            stock: it.quantity,
            purchasePrice: (data.currency === state.storeSettings.baseCurrency ? it.purchasePrice : (config.method === 'multiply' ? it.purchasePrice / rate : it.purchasePrice * rate)) + costPerUnitBase,
            purchaseDate: data.timestamp,
            expiryDate: it.expiryDate
        }));

        try {
            await api.createPurchase(invoice, supplierUpdate, newBatches);
            await fetchData(true);
            logActivity('purchase', `خرید جدید ثبت شد: ${id}`, id, 'purchaseInvoice');
            return { success: true, message: 'خرید با موفقیت ثبت و به انبار اضافه شد.' };
        } catch (e) { return { success: false, message: 'خطا در ثبت خرید.' }; }
    };

    const beginEditPurchase = (id: string) => {
        const inv = state.purchaseInvoices.find(i => i.id === id);
        if (!inv) return { success: false, message: "فاکتور یافت نشد." };
        setState(prev => ({ ...prev, editingPurchaseInvoiceId: id }));
        return { success: true, message: "آماده ویرایش." };
    };

    const cancelEditPurchase = () => setState(prev => ({ ...prev, editingPurchaseInvoiceId: null }));

    const updatePurchaseInvoice = async (invoiceData: any) => {
        const { purchaseInvoices, suppliers, products, editingPurchaseInvoiceId } = state;
        if (!editingPurchaseInvoiceId) return { success: false, message: "فاکتوری برای ویرایش انتخاب نشده است." };

        const oldInv = purchaseInvoices.find(inv => inv.id === editingPurchaseInvoiceId);
        if (!oldInv) return { success: false, message: "فاکتور قدیمی یافت نشد." };

        const supplier = suppliers.find(s => s.id === invoiceData.supplierId);
        if (!supplier) return { success: false, message: "تأمین کننده یافت نشد." };

        const rate = invoiceData.exchangeRate || 1;
        const totalCurrencyAmount = invoiceData.items.reduce((s: number, i: any) => s + (i.quantity * i.purchasePrice), 0);
        
        const config = state.storeSettings.currencyConfigs[invoiceData.currency || state.storeSettings.baseCurrency];
        const totalAmountBase = invoiceData.currency === state.storeSettings.baseCurrency 
            ? totalCurrencyAmount 
            : (config.method === 'multiply' ? totalCurrencyAmount / rate : totalCurrencyAmount * rate);

        const oldRate = oldInv.exchangeRate || 1;
        const oldConfig = state.storeSettings.currencyConfigs[oldInv.currency || state.storeSettings.baseCurrency];
        const oldTotalBase = oldInv.currency === state.storeSettings.baseCurrency 
            ? oldInv.totalAmount 
            : (oldConfig.method === 'multiply' ? oldInv.totalAmount / oldRate : oldInv.totalAmount * oldRate);

        let balAFN = supplier.balanceAFN, balUSD = supplier.balanceUSD, balIRT = supplier.balanceIRT, balTotal = supplier.balance;
        if (oldInv.currency === 'USD') balUSD -= oldInv.totalAmount;
        else if (oldInv.currency === 'IRT') balIRT -= oldInv.totalAmount;
        else balAFN -= oldInv.totalAmount;
        balTotal -= oldTotalBase;

        if (invoiceData.currency === 'USD') balUSD += totalCurrencyAmount;
        else if (invoiceData.currency === 'IRT') balIRT += totalCurrencyAmount;
        else balAFN += totalCurrencyAmount;
        balTotal += totalAmountBase;

        const supplierUpdate = {
            id: invoiceData.supplierId,
            newBalances: { AFN: balAFN, USD: balUSD, IRT: balIRT, Total: balTotal }
        };

        const newInvoice: PurchaseInvoice = {
            ...oldInv,
            ...invoiceData,
            totalAmount: totalCurrencyAmount,
            items: invoiceData.items.map((it: any) => ({
                ...it,
                productName: products.find(p => p.id === it.productId)?.name || '?',
                atFactoryQty: 0, inTransitQty: 0, receivedQty: it.quantity
            }))
        };

        try {
            await api.updatePurchase(editingPurchaseInvoiceId, newInvoice, supplierUpdate);
            await fetchData(true);
            setState(prev => ({ ...prev, editingPurchaseInvoiceId: null }));
            logActivity('purchase', `ویرایش فاکتور خرید: ${newInvoice.id}`, newInvoice.id, 'purchaseInvoice');
            return { success: true, message: 'فاکتور با موفقیت بروزرسانی شد.' };
        } catch (e) { return { success: false, message: 'خطا در ویرایش فاکتور.' }; }
    };

    const addPurchaseReturn = async (originalInvoiceId: string, returnItems: { productId: string; lotNumber: string, quantity: number }[]) => {
        const { purchaseInvoices, suppliers, products } = state;
        const originalInv = purchaseInvoices.find(inv => inv.id === originalInvoiceId);
        if (!originalInv) return { success: false, message: "فاکتور اصلی یافت نشد." };

        const supplier = suppliers.find(s => s.id === originalInv.supplierId);
        if (!supplier) return { success: false, message: "تأمین کننده یافت نشد." };

        const id = generateNextId('PR', purchaseInvoices.map(i => i.id));
        const rate = originalInv.exchangeRate || 1;
        
        let returnTotalCurrency = 0;
        const items = returnItems.map(ret => {
            const originalItem = originalInv.items.find(it => it.productId === ret.productId && it.lotNumber === ret.lotNumber);
            if (!originalItem) throw new Error("کالا در فاکتور یافت نشد");
            returnTotalCurrency += (originalItem.purchasePrice * ret.quantity);
            return { ...originalItem, quantity: ret.quantity, receivedQty: ret.quantity };
        });

        const config = state.storeSettings.currencyConfigs[originalInv.currency || state.storeSettings.baseCurrency];
        const totalAmountBase = originalInv.currency === state.storeSettings.baseCurrency 
            ? returnTotalCurrency 
            : (config.method === 'multiply' ? returnTotalCurrency / rate : returnTotalCurrency * rate);

        const returnInv: PurchaseInvoice = {
            id, type: 'return', originalInvoiceId, supplierId: originalInv.supplierId,
            invoiceNumber: `R-${originalInv.invoiceNumber || originalInv.id}`,
            items, totalAmount: returnTotalCurrency, timestamp: new Date().toISOString(),
            currency: originalInv.currency, exchangeRate: originalInv.exchangeRate
        };

        const newBalances = { ...supplier };
        if (originalInv.currency === 'USD') newBalances.balanceUSD -= returnTotalCurrency;
        else if (originalInv.currency === 'IRT') newBalances.balanceIRT -= returnTotalCurrency;
        else newBalances.balanceAFN -= returnTotalCurrency;
        newBalances.balance -= totalAmountBase;

        const supplierRefund = {
            id: supplier.id,
            amount: returnTotalCurrency,
            currency: originalInv.currency,
            newBalances: { AFN: newBalances.balanceAFN, USD: newBalances.balanceUSD, IRT: newBalances.balanceIRT, Total: newBalances.balance }
        };

        try {
            await api.createPurchaseReturn(returnInv, returnItems, supplierRefund);
            await fetchData(true);
            logActivity('purchase', `ثبت مرجوعی خرید: ${id}`, id, 'purchaseInvoice');
            return { success: true, message: 'مرجوعی با موفقیت ثبت شد.' };
        } catch (e) { return { success: false, message: 'خطا در ثبت مرجوعی.' }; }
    };

    // --- Logistics Logic: In-Transit Movements ---
    const addInTransitInvoice = (d: any) => { 
        const id = crypto.randomUUID();
        const total = d.items.reduce((s:number, i:any) => s + (i.quantity*i.purchasePrice), 0);
        const inv = { ...d, id, type: 'in_transit', status: 'active', totalAmount: total, items: d.items.map((it:any)=>({ ...it, productName: state.products.find(p=>p.id===it.productId)?.name || '?', atFactoryQty: it.quantity, inTransitQty: 0, receivedQty: 0 })) };
        api.createInTransit(inv).then(() => fetchData(true)); 
        return { success: true, message: 'سفارش در لیست انتظار ثبت شد.' }; 
    };

    const moveInTransitItems = async (invoiceId: string, movements: { [pid: string]: { toTransit: number, toReceived: number, lotNumber: string, expiryDate?: string } }, additionalCost?: number, costDescription?: string) => {
        const inv = state.inTransitInvoices.find(i => i.id === invoiceId);
        if (!inv) return { success: false, message: "سفارش یافت نشد." };

        const receivedItemsForInvoice: any[] = [];
        const updatedItems = inv.items.map(item => {
            const m = movements[item.productId];
            if (!m) return item;
            
            const toT = Math.min(m.toTransit, item.atFactoryQty);
            const toR = Math.min(m.toReceived, item.inTransitQty + toT);
            
            if (toR > 0) {
                receivedItemsForInvoice.push({
                    productId: item.productId,
                    quantity: toR,
                    purchasePrice: item.purchasePrice,
                    lotNumber: m.lotNumber,
                    expiryDate: m.expiryDate
                });
            }

            return { 
                ...item, 
                atFactoryQty: item.atFactoryQty - toT, 
                inTransitQty: item.inTransitQty + toT - toR, 
                receivedQty: item.receivedQty + toR 
            };
        });

        if (receivedItemsForInvoice.length > 0) {
            const subInvoiceId = generateNextId('P', state.purchaseInvoices.map(i => i.id));
            const subInvoiceData = {
                id: subInvoiceId,
                supplierId: inv.supplierId,
                invoiceNumber: `Part-${inv.invoiceNumber || inv.id.slice(0,5)}`,
                items: receivedItemsForInvoice,
                timestamp: new Date().toISOString(),
                currency: inv.currency,
                exchangeRate: inv.exchangeRate,
                sourceInTransitId: inv.id,
                additionalCost,
                costDescription
            };
            await addPurchaseInvoice(subInvoiceData);
        }

        const isFullyReceived = updatedItems.every(i => i.atFactoryQty === 0 && i.inTransitQty === 0);
        if (isFullyReceived) {
            await api.updateInTransit({ ...inv, items: updatedItems, status: 'closed' });
        } else {
            await api.updateInTransit({ ...inv, items: updatedItems });
        }
        
        await fetchData(true);
        logActivity('inventory', `وصول محموله: ${inv.invoiceNumber || inv.id.slice(0,8)}`, inv.id, 'purchaseInvoice');
        return { success: true, message: 'جابجایی کالا و اسناد مالی با موفقیت بروزرسانی شد.' };
    };

    const archiveInTransitInvoice = async (id: string) => {
        const inv = state.inTransitInvoices.find(i => i.id === id);
        if (inv) {
            await api.updateInTransit({ ...inv, status: 'closed' });
            await fetchData(true);
            logActivity('inventory', `بایگانی دستی محموله: ${inv.invoiceNumber || inv.id.slice(0,8)}`, inv.id, 'purchaseInvoice');
        }
    };

    const addInTransitPayment = async (invId: string, amount: number, description: string, currency: 'AFN' | 'USD' | 'IRT' = 'AFN', exchangeRate: number = 1) => {
        const inv = state.inTransitInvoices.find(i => i.id === invId);
        if (!inv) return null;

        // 1. Calculate precise amount in the invoice's original currency for internal tracking
        let amountInInvoiceCurrency = amount;
        if (currency !== inv.currency) {
            // First, convert the payment to base currency
            const configPay = state.storeSettings.currencyConfigs[currency];
            const amountInBase = currency === state.storeSettings.baseCurrency 
                ? amount 
                : (configPay.method === 'multiply' ? amount / exchangeRate : amount * exchangeRate);
            
            // Then, convert from base back to the invoice currency using the invoice's own historical rate
            const invoiceRate = inv.exchangeRate || 1;
            const configInv = state.storeSettings.currencyConfigs[inv.currency || state.storeSettings.baseCurrency];
            
            amountInInvoiceCurrency = inv.currency === state.storeSettings.baseCurrency 
                ? amountInBase 
                : (configInv.method === 'multiply' ? amountInBase * invoiceRate : amountInBase / invoiceRate);
        }

        // 2. Create updated invoice object with the newly added payment (Immutable Update)
        const updatedInv: InTransitInvoice = { 
            ...inv, 
            paidAmount: (inv.paidAmount || 0) + amountInInvoiceCurrency 
        };

        // 3. Persist the logistics update to the database first
        await api.updateInTransit(updatedInv);
        
        // 4. Record the financial transaction in the supplier's account
        // Note: addSupplierPayment internally calls fetchData(true) which refreshes the state
        const tx = await addSupplierPayment(inv.supplierId, amount, description, currency, exchangeRate);
        
        return tx;
    };

    // --- Basic Actions & Placeholders ---
    const deleteUser = async (id: string) => { await api.deleteUser(id); await fetchData(true); };
    const updateSettings = (n: any) => { api.updateSettings(n).then(() => fetchData(true)); };
    const addService = (s: any) => { api.addService(s).then(() => fetchData(true)); };
    const deleteService = (id: string) => { api.deleteService(id).then(() => fetchData(true)); };
    
    const addSupplier = (s: any, initial?: any) => { 
        api.addSupplier(s).then(ns => {
            if (initial && initial.amount > 0) {
                const rate = initial.exchangeRate || 1;
                const config = state.storeSettings.currencyConfigs[initial.currency as 'AFN'|'USD'|'IRT'];
                const baseAmount = initial.currency === state.storeSettings.baseCurrency 
                    ? initial.amount 
                    : (config.method === 'multiply' ? initial.amount / rate : initial.amount * rate);
                
                const tx: SupplierTransaction = { id: crypto.randomUUID(), supplierId: ns.id, type: initial.type === 'creditor' ? 'purchase' : 'payment', amount: initial.amount, date: new Date().toISOString(), description: 'تراز اول دوره', currency: initial.currency };
                const newB = { AFN: initial.currency === 'AFN' ? (initial.type==='creditor'?initial.amount:-initial.amount) : 0, USD: initial.currency === 'USD' ? (initial.type==='creditor'?initial.amount:-initial.amount) : 0, IRT: initial.currency === 'IRT' ? (initial.type==='creditor'?initial.amount:-initial.amount) : 0, Total: initial.type === 'creditor' ? baseAmount : -baseAmount };
                api.processPayment('supplier', ns.id, newB, tx).then(() => fetchData(true));
            } else fetchData(true);
        });
    };
    const deleteSupplier = (id: string) => { api.deleteSupplier(id).then(() => fetchData(true)); };
    const addSupplierPayment = async (sid: string, a: number, d: string, cur: any = 'AFN', rate: number = 1) => {
        const s = state.suppliers.find(x => x.id === sid);
        const config = state.storeSettings.currencyConfigs[cur as 'AFN'|'USD'|'IRT'];
        const baseAmount = cur === state.storeSettings.baseCurrency ? a : (config.method === 'multiply' ? a / rate : a * rate);
        const tx: SupplierTransaction = { id: crypto.randomUUID(), supplierId: sid, type: 'payment', amount: a, date: new Date().toISOString(), description: d, currency: cur };
        const newB = { AFN: s!.balanceAFN - (cur==='AFN'?a:0), USD: s!.balanceUSD - (cur==='USD'?a:0), IRT: s!.balanceIRT - (cur==='IRT'?a:0), Total: s!.balance - baseAmount };
        await api.processPayment('supplier', sid, newB, tx);
        await fetchData(true);
        return tx;
    };

    const addCustomer = (c: any, initial?: any) => {
        api.addCustomer(c).then(nc => {
            if (initial && initial.amount > 0) {
                const rate = initial.exchangeRate || 1;
                const config = state.storeSettings.currencyConfigs[initial.currency as 'AFN'|'USD'|'IRT'];
                const baseAmount = initial.currency === state.storeSettings.baseCurrency 
                    ? initial.amount 
                    : (config.method === 'multiply' ? initial.amount / rate : initial.amount * rate);
                
                const tx: CustomerTransaction = { id: crypto.randomUUID(), customerId: nc.id, type: initial.type === 'debtor' ? 'credit_sale' : 'payment', amount: initial.amount, date: new Date().toISOString(), description: 'تراز اول دوره', currency: initial.currency };
                const newB = { AFN: initial.currency === 'AFN' ? (initial.type==='debtor'?initial.amount:-initial.amount) : 0, USD: initial.currency === 'USD' ? (initial.type==='debtor'?initial.amount:-initial.amount) : 0, IRT: initial.currency === 'IRT' ? (initial.type==='debtor'?initial.amount:-initial.amount) : 0, Total: initial.type === 'debtor' ? baseAmount : -baseAmount };
                api.processPayment('customer', nc.id, newB, tx).then(() => fetchData(true));
            } else fetchData(true);
        });
    };
    const deleteCustomer = (id: string) => { api.deleteCustomer(id).then(() => fetchData(true)); };
    const addCustomerPayment = async (cid: string, a: number, d: string, cur: any = 'AFN', rate: number = 1, trusteeId?: string) => {
        const c = state.customers.find(x => x.id === cid);
        if (!c) return null;
        
        const config = state.storeSettings.currencyConfigs[cur as 'AFN'|'USD'|'IRT'];
        const baseAmount = cur === state.storeSettings.baseCurrency ? a : (config.method === 'multiply' ? a / rate : a * rate);
        const tx: CustomerTransaction = { 
            id: crypto.randomUUID(), 
            customerId: cid, 
            type: 'payment', 
            amount: a, 
            date: new Date().toISOString(), 
            description: d + (trusteeId ? ' (تحویل به واسطه)' : ''), 
            currency: cur 
        };
        
        const newB = { 
            AFN: c.balanceAFN - (cur === 'AFN' ? a : 0), 
            USD: c.balanceUSD - (cur === 'USD' ? a : 0), 
            IRT: c.balanceIRT - (cur === 'IRT' ? a : 0), 
            Total: c.balance - baseAmount 
        };

        await api.processPayment('customer', cid, newB, tx);
        
        if (trusteeId) {
            await processDepositTransaction(
                trusteeId, 
                'withdrawal', 
                a, 
                cur, 
                `دریافتی از مشتری: ${c.name} - بابت: ${d}`
            );
        }

        await fetchData(true);
        return tx;
    };

    const addEmployee = (e: any) => { api.addEmployee(e).then(() => fetchData(true)); };

    // FIX: Optimized and connected to Expenses for Reports/Capital integration
    const addEmployeeAdvance = async (eid: string, a: number, d: string) => {
        const emp = state.employees.find(x => x.id === eid);
        if (!emp) return;
        const now = new Date().toISOString();
        const tx: PayrollTransaction = { id: crypto.randomUUID(), employeeId: eid, type: 'advance', amount: a, date: now, description: d };
        
        // Auto-log to Expenses to ensure reports are accurate
        const expense: Expense = { 
            id: crypto.randomUUID(), 
            category: 'salary', 
            amount: a, 
            description: `مساعده/تسویه میان‌دوره به ${emp.name}: ${d}`, 
            date: now 
        };

        await api.processPayment('employee', eid, emp.balance + a, tx);
        await api.addExpense(expense);
        await fetchData(true);
        const baseCurrencyName = state.storeSettings.currencyConfigs[state.storeSettings.baseCurrency]?.name || 'AFN';
        logActivity('payroll', `ثبت مساعده/تسویه برای ${emp.name}: ${a.toLocaleString()} ${baseCurrencyName}`);
    };

    const processAndPaySalaries = () => {
        const txs: PayrollTransaction[] = [];
        const updates = state.employees.map(e => {
            const net = e.monthlySalary - e.balance;
            if (net > 0) txs.push({ id: crypto.randomUUID(), employeeId: e.id, type: 'salary_payment', amount: net, date: new Date().toISOString(), description: 'تسویه حقوق ماهانه' });
            return { id: e.id, balance: 0 as const };
        });
        const totalPaid = txs.reduce((s,t) => s+t.amount, 0);
        const expense: Expense = { id: crypto.randomUUID(), category: 'salary', amount: totalPaid, description: 'پرداخت حقوق کارکنان (تسویه نهایی)', date: new Date().toISOString() };
        api.processPayroll(updates, txs, expense).then(() => fetchData(true));
        return { success: true, message: 'حقوق تمام کارکنان تسویه و در مصارف ثبت شد.' };
    };

    const addExpense = (e: any) => { api.addExpense(e).then(() => fetchData(true)); };
    const addDepositHolder = async (h: any) => { await api.addDepositHolder(h); await fetchData(true); };
    const deleteDepositHolder = async (id: string) => { await api.deleteDepositHolder(id); await fetchData(true); };
    const processDepositTransaction = async (hid: string, t: any, a: number, c: any, d: string) => {
        const holder = state.depositHolders.find(x => x.id === hid);
        const tx: DepositTransaction = { id: crypto.randomUUID(), holderId: hid, type: t, amount: a, currency: c, description: d, date: new Date().toISOString() };
        const newH = { ...holder! };
        const factor = t === 'deposit' ? 1 : -1;
        if (c === 'USD') newH.balanceUSD += factor * a; 
        else if (c === 'IRT') newH.balanceIRT += factor * a; 
        else newH.balanceAFN += factor * a;
        await api.updateDepositHolder(newH);
        await api.addDepositTransaction(tx);
        await fetchData(true);
        return { success: true, message: 'تراکنش با موفقیت ثبت شد.' };
    };

    const setInvoiceTransientCustomer = async (id: string, n: string) => {};
    const updateInTransitInvoice = (d: any) => { api.updateInTransit(d as any).then(() => fetchData(true)); return { success: true, message: 'بروزرسانی شد' }; };
    const deleteInTransitInvoice = (id: string) => { api.deleteInTransit(id).then(() => fetchData(true)); };
    const addEmployeeAdvanceToEmployee = (eid: string, a: number, d: string) => { addEmployeeAdvance(eid, a, d); };

    if (isLoading) return <div className="flex items-center justify-center h-screen text-xl font-bold text-blue-600">در حال دریافت اطلاعات...</div>;

    return <AppContext.Provider value={{
        ...state, showToast, isLoading, isLoggingOut, isShopActive, login, signup, logout, hasPermission, addUser, updateUser, deleteUser, addRole, updateRole, deleteRole, exportData, importData,
        cloudBackup, cloudRestore, autoBackupEnabled, setAutoBackupEnabled,
        addProduct, updateProduct, deleteProduct, addToCart, updateCartItemQuantity, updateCartItemFinalPrice, removeFromCart, completeSale,
        beginEditSale, cancelEditSale, addSaleReturn, addPurchaseInvoice, beginEditPurchase, cancelEditPurchase, updatePurchaseInvoice, addPurchaseReturn,
        addInTransitInvoice, updateInTransitInvoice, deleteInTransitInvoice, archiveInTransitInvoice, moveInTransitItems, addInTransitPayment,
        updateSettings, addService, deleteService, addSupplier, deleteSupplier, addSupplierPayment, addCustomer, deleteCustomer, addCustomerPayment,
        addEmployee, addEmployeeAdvance, addEmployeeAdvanceToEmployee, processAndPaySalaries, addExpense, setInvoiceTransientCustomer,
        addDepositHolder, deleteDepositHolder, processDepositTransaction
    }}>{children}</AppContext.Provider>;
};

export const useAppContext = (): AppContextType => {
    const context = useContext(AppContext);
    if (context === undefined) throw new Error('useAppContext must be used within AppProvider');
    return context;
};
