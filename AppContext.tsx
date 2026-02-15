import React, { createContext, useContext, ReactNode, useState, useEffect, useCallback, useRef } from 'react';
import type {
    Product, ProductBatch, SaleInvoice, PurchaseInvoice, InTransitInvoice, PurchaseInvoiceItem, InvoiceItem,
    Customer, Supplier, Employee, Expense, Service, StoreSettings, CartItem,
    CustomerTransaction, SupplierTransaction, PayrollTransaction, ActivityLog,
    User, Role, Permission, AppState
} from './types';
import { formatCurrency } from './utils/formatters';
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
    completeSale: (cashier: string, customerId?: string) => Promise<{ success: boolean; invoice?: SaleInvoice; message: string }>;
    beginEditSale: (invoiceId: string) => { success: boolean; message: string; customerId?: string; };
    cancelEditSale: () => void;
    addSaleReturn: (originalInvoiceId: string, returnItems: { id: string; type: 'product' | 'service'; quantity: number }[], cashier: string) => { success: boolean, message: string };
    setInvoiceTransientCustomer: (invoiceId: string, customerName: string) => Promise<void>;
    
    // Purchase Actions
    addPurchaseInvoice: (invoiceData: Omit<PurchaseInvoice, 'id' | 'totalAmount' | 'items' | 'type' | 'originalInvoiceId'> & { items: Omit<PurchaseInvoiceItem, 'productName'>[] }) => { success: boolean, message: string };
    beginEditPurchase: (invoiceId: string) => { success: boolean; message: string };
    cancelEditPurchase: () => void;
    updatePurchaseInvoice: (invoiceData: Omit<PurchaseInvoice, 'id' | 'totalAmount' | 'items' | 'type' | 'originalInvoiceId'> & { items: Omit<PurchaseInvoiceItem, 'productName'>[] }) => { success: boolean, message: string };
    addPurchaseReturn: (originalInvoiceId: string, returnItems: { productId: string; lotNumber: string, quantity: number }[]) => { success: boolean; message: string };

    // In-Transit Actions
    addInTransitInvoice: (invoiceData: Omit<InTransitInvoice, 'id' | 'totalAmount' | 'items' | 'type'> & { items: Omit<PurchaseInvoiceItem, 'productName'>[] }) => { success: boolean, message: string };
    updateInTransitInvoice: (invoiceData: Omit<InTransitInvoice, 'totalAmount' | 'items' | 'type'> & { items: Omit<PurchaseInvoiceItem, 'productName'>[] }) => { success: boolean, message: string };
    deleteInTransitInvoice: (id: string) => void;
    confirmInTransitArrival: (id: string) => { success: boolean; message: string };

    // Settings
    updateSettings: (newSettings: StoreSettings) => void;
    
    // Services
    addService: (service: Omit<Service, 'id'>) => void;
    deleteService: (serviceId: string) => void;
    
    // Accounting
    addSupplier: (supplier: Omit<Supplier, 'id' | 'balance'>, initialBalance?: { amount: number, type: 'creditor' | 'debtor', currency: 'AFN' | 'USD', exchangeRate?: number }) => void;
    deleteSupplier: (id: string) => void;
    addSupplierPayment: (supplierId: string, amount: number, description: string, currency?: 'AFN' | 'USD', exchangeRate?: number) => SupplierTransaction;
    
    addCustomer: (customer: Omit<Customer, 'id' | 'balance'>, initialBalance?: { amount: number, type: 'creditor' | 'debtor', currency: 'AFN' | 'USD', exchangeRate?: number }) => void;
    deleteCustomer: (id: string) => void;
    addCustomerPayment: (customerId: string, amount: number, description: string) => CustomerTransaction;
    
    addEmployee: (employee: Omit<Employee, 'id'|'balance'>) => void;
    addEmployeeAdvance: (employeeId: string, amount: number, description: string) => void;
    processAndPaySalaries: () => { success: boolean; message: string };
    addExpense: (expense: Omit<Expense, 'id'>) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

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
        suppliers: [], employees: [], expenses: [], services: [],
        storeSettings: {
            storeName: 'پویا پارسا', address: '', phone: '', lowStockThreshold: 10,
            expiryThresholdMonths: 3, currencyName: 'افغانی', currencySymbol: 'AFN'
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
    const [toastMessage, setToastMessage] = useState('');
    const [autoBackupEnabled, setAutoBackupEnabled] = useState(() => localStorage.getItem('kasebyar_auto_backup') === 'true');
    const isFirstLoad = useRef(true);

    const showToast = useCallback((message: string) => {
        setToastMessage(message);
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
                api.getEntities().catch(() => ({ customers: [], suppliers: [], employees: [], expenses: [] })),
                api.getTransactions().catch(() => ({ customerTransactions: [], supplierTransactions: [], payrollTransactions: [] })),
                api.getInvoices().catch(() => ({ saleInvoices: [], purchaseInvoices: [], inTransitInvoices: [] })),
                api.getActivities().catch(() => [])
            ]);

            const { data: { session } } = await supabase.auth.getSession();
            let isAuth = false;
            let restoredUser = null;

            const isSessionLocked = localStorage.getItem('kasebyar_session_locked') === 'true';

            if (session?.user && !isSessionLocked) {
                const profile = await api.getProfile(session.user.id);
                const deviceId = getDeviceId();
                
                if (profile && profile.is_approved) {
                    if (!profile.current_device_id || profile.current_device_id === deviceId) {
                        isAuth = true;
                        restoredUser = { id: session.user.id, username: session.user.email || 'Admin', roleId: 'admin-role' };
                        
                        if (!profile.current_device_id) {
                            await api.updateProfile(session.user.id, { current_device_id: deviceId });
                        }
                        localStorage.setItem('kasebyar_shop_active', 'true');
                        setIsShopActive(true);
                    }
                } else if (!navigator.onLine && localStorage.getItem('kasebyar_offline_auth') === 'true') {
                    isAuth = true;
                    restoredUser = { id: session.user.id, username: session.user.email || 'Admin', roleId: 'admin-role' };
                }
            } else {
                const localStaff = localStorage.getItem('kasebyar_staff_user');
                if (localStaff && !isSessionLocked) {
                    try {
                        const parsedStaff = JSON.parse(localStaff) as User;
                        const dbUser = users.find(u => u.id === parsedStaff.id);
                        if (dbUser && localStorage.getItem('kasebyar_shop_active') === 'true') { 
                            isAuth = true; 
                            restoredUser = dbUser; 
                        } else { 
                            localStorage.removeItem('kasebyar_staff_user'); 
                        }
                    } catch(e) { localStorage.removeItem('kasebyar_staff_user'); }
                }
            }

            setState(prev => ({
                ...prev,
                storeSettings: (settings as StoreSettings).storeName ? (settings as StoreSettings) : prev.storeSettings,
                users,
                roles: roles.length > 0 ? roles : [{ id: 'admin-role', name: 'Admin', permissions: ['page:dashboard', 'page:inventory', 'page:pos', 'page:purchases', 'page:accounting', 'page:reports', 'page:settings', 'page:in_transit', 'inventory:add_product', 'inventory:edit_product', 'inventory:delete_product', 'pos:create_invoice', 'pos:edit_invoice', 'pos:apply_discount', 'pos:create_credit_sale', 'purchase:create_invoice', 'purchase:edit_invoice', 'in_transit:confirm_receipt', 'accounting:manage_suppliers', 'accounting:manage_customers', 'accounting:manage_payroll', 'accounting:manage_expenses', 'settings:manage_store', 'settings:manage_users', 'settings:manage_backup', 'settings:manage_services', 'settings:manage_alerts'] }],
                products, services, customers: entities.customers, suppliers: entities.suppliers,
                employees: entities.employees, expenses: entities.expenses,
                customerTransactions: transactions.customerTransactions,
                supplierTransactions: transactions.supplierTransactions,
                payrollTransactions: transactions.payrollTransactions,
                saleInvoices: invoices.saleInvoices, 
                purchaseInvoices: invoices.purchaseInvoices,
                inTransitInvoices: invoices.inTransitInvoices,
                activities: activity,
                saleInvoiceCounter: invoices.saleInvoices.length,
                isAuthenticated: isAuth,
                currentUser: restoredUser
            }));
        } catch (error) {
            console.error("Error fetching data:", error);
            showToast("⚠️ خطا در دریافت اطلاعات.");
        } finally {
            if (!isSilent) setIsLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const logActivity = useCallback(async (type: ActivityLog['type'], description: string, refId?: string, refType?: ActivityLog['refType']) => {
        if (!state.currentUser) return;
        const displayName = state.currentUser.roleId === 'admin-role' ? 'مدیر کل' : state.currentUser.username;
        const newActivity: ActivityLog = { id: crypto.randomUUID(), type, description, timestamp: new Date().toISOString(), user: displayName, refId, refType };
        setState(prev => ({ ...prev, activities: [newActivity, ...prev.activities] }));
        try { await api.addActivity(newActivity); } catch (e) {}
    }, [state.currentUser]);

    useEffect(() => {
        if (autoBackupEnabled && state.isAuthenticated && state.currentUser?.id && navigator.onLine) {
            const checkAndBackup = async () => {
                const lastBackupTime = localStorage.getItem('kasebyar_last_backup');
                const now = Date.now();
                const twentyFourHours = 24 * 60 * 60 * 1000;
                if (!lastBackupTime || (now - parseInt(lastBackupTime)) > twentyFourHours) {
                    const success = await cloudBackup(true); 
                    if (success) localStorage.setItem('kasebyar_last_backup', now.toString());
                }
            };
            checkAndBackup();
        }
    }, [autoBackupEnabled, state.isAuthenticated, state.currentUser?.id]);

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
                localStorage.setItem('kasebyar_offline_auth', 'true');
                localStorage.setItem('kasebyar_shop_active', 'true');
                localStorage.setItem('kasebyar_session_locked', 'false');
                setIsShopActive(true);
                await fetchData();
                return { success: true, message: '✅ ورود موفق و بازگشایی فروشگاه' };
            } catch (e) { return { success: false, message: '❌ خطا در اتصال.' }; }
        } else {
            if (localStorage.getItem('kasebyar_shop_active') !== 'true') return { success: false, message: '❌ فروشگاه غیرفعال است. مدیر کل باید ابتدا وارد شود.' };
            const user = await api.verifyStaffCredentials(identifier, password);
            if (user) {
                localStorage.setItem('kasebyar_staff_user', JSON.stringify(user));
                localStorage.setItem('kasebyar_session_locked', 'false');
                await fetchData();
                return { success: true, message: `✅ خوش آمدید ${user.username}` };
            } else return { success: false, message: 'نام کاربری یا رمز عبور اشتباه است.' };
        }
    };

    const signup = async (email: string, password: string) => {
        try {
            const { error } = await supabase.auth.signUp({ email, password });
            if (error) return { success: false, message: error.message };
            return { success: true, message: '✅ ثبت‌نام انجام شد.' };
        } catch (e) { return { success: false, message: '❌ خطا در ثبت‌نام.' }; }
    };

    const logout = async (type: 'full' | 'switch'): Promise<{ success: boolean; message: string }> => {
        setIsLoggingOut(true);
        const isStaff = !!localStorage.getItem('kasebyar_staff_user');
        if (isStaff) {
            localStorage.removeItem('kasebyar_staff_user');
            localStorage.setItem('kasebyar_session_locked', 'true');
            setTimeout(() => { setState(prev => ({ ...prev, isAuthenticated: false, currentUser: null })); setIsLoggingOut(false); }, 800);
            return { success: true, message: 'خروج از حساب انجام شد.' };
        }
        if (type === 'full') {
            if (!navigator.onLine) { setIsLoggingOut(false); showToast("⚠️ خروج کامل مدیر نیاز به اینترنت دارد."); return { success: false, message: 'عدم اتصال' }; }
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) await api.updateProfile(user.id, { current_device_id: null });
                await supabase.auth.signOut();
                localStorage.removeItem('kasebyar_offline_auth');
                localStorage.setItem('kasebyar_shop_active', 'false');
                localStorage.setItem('kasebyar_session_locked', 'true');
                setIsShopActive(false);
            } catch (e) { console.error(e); }
        } else localStorage.setItem('kasebyar_session_locked', 'true');
        setTimeout(() => { setState(prev => ({ ...prev, isAuthenticated: false, currentUser: null })); setIsLoggingOut(false); }, 1000);
        return { success: true, message: 'خروج موفق' };
    };

    const hasPermission = (permission: Permission): boolean => {
        if (!state.currentUser) return false;
        const userRole = state.roles.find(r => r.id === state.currentUser!.roleId);
        return userRole?.permissions.includes(permission) ?? false;
    };
    
    const exportData = () => {
        const fullState = { ...state, isAuthenticated: false, currentUser: null, cart: [] };
        const dataStr = JSON.stringify(fullState, null, 2);
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
                showToast("⏳ در حال آماده‌سازی برای بازیابی محلی...");
                await api.clearAndRestoreData(data);
                await fetchData();
                showToast("✅ بازیابی از فایل با موفقیت انجام شد.");
            } catch (err) { showToast("❌ خطا در ساختار فایل نسخه پشتیبان."); }
        };
        reader.readAsText(file);
    };

    const cloudBackup = async (isSilent = false) => {
        if (!navigator.onLine || !state.currentUser) return false;
        if (!isSilent) showToast("☁️ در حال اتصال به سرور ابری...");
        const fullState = { ...state, isAuthenticated: false, currentUser: null, cart: [] };
        try {
            const success = await api.saveCloudBackup(state.currentUser.id, fullState);
            if (success) {
                if (!isSilent) showToast("✅ نسخه ابری با موفقیت ذخیره شد.");
                localStorage.setItem('kasebyar_last_backup', Date.now().toString());
                return true;
            } else return false;
        } catch (error) { return false; }
    };

    const cloudRestore = async () => {
        if (!navigator.onLine || !state.currentUser) return false;
        if (!window.confirm("آیا از بازیابی اطلاعات از ابر اطمینان دارید؟ تمام داده‌های فعلی این دستگاه پاک شده و با نسخه ابری جایگزین خواهد شد.")) return false;
        showToast("☁️ در حال جستجوی نسخه ابری...");
        try {
            const data = await api.getCloudBackup(state.currentUser.id);
            if (data) {
                showToast("📥 در حال دریافت و پاک‌سازی داده‌های محلی...");
                await api.clearAndRestoreData(data);
                await fetchData(); 
                showToast("✅ بازیابی از ابر با موفقیت کامل شد.");
                return true;
            } else return false;
        } catch (error) { return false; }
    };

    const handleSetAutoBackup = (enabled: boolean) => {
        setAutoBackupEnabled(enabled);
        localStorage.setItem('kasebyar_auto_backup', enabled.toString());
        showToast(enabled ? "✅ پشتیبان‌گیری خودکار ۲۴ ساعته فعال شد." : "⚠️ پشتیبان‌گیری خودکار غیرفعال شد.");
    };

    const addUser = async (userData: Omit<User, 'id'>) => {
        try {
            const newUser = await api.addUser(userData);
            setState(prev => ({ ...prev, users: [...prev.users, newUser] }));
            logActivity('login', `کاربر جدید اضافه شد: ${userData.username}`);
            return { success: true, message: '✅ کاربر اضافه شد.' };
        } catch (e) { return { success: false, message: '❌ خطا.' }; }
    };
    const updateUser = async (userData: Partial<User> & { id: string }) => {
        try {
             await api.updateUser(userData);
             setState(prev => ({ ...prev, users: prev.users.map(u => u.id === userData.id ? { ...u, ...userData } : u) }));
             logActivity('login', `اطلاعات کاربر بروزرسانی شد: ${userData.username || 'نامشخص'}`);
             return { success: true, message: '✅ بروزرسانی شد.' };
        } catch (e) { return { success: false, message: '❌ خطا.' }; }
    };
    const deleteUser = async (userId: string) => {
         try {
            const user = state.users.find(u => u.id === userId);
            await api.deleteUser(userId);
            setState(prev => ({ ...prev, users: prev.users.filter(u => u.id !== userId) }));
            logActivity('login', `کاربر حذف شد: ${user?.username || 'نامشخص'}`);
            showToast("✅ کاربر حذف شد.");
         } catch (e) { showToast("❌ خطا."); }
    };
    const addRole = async (roleData: Omit<Role, 'id'>) => {
        try {
            const newRole = await api.addRole(roleData);
            setState(prev => ({ ...prev, roles: [...prev.roles, newRole] }));
            logActivity('login', `نقش جدید تعریف شد: ${roleData.name}`);
            return { success: true, message: '✅ نقش اضافه شد.' };
        } catch (e) { return { success: false, message: '❌ خطا.' }; }
    };
    const updateRole = async (roleData: Role) => {
        try {
            await api.updateRole(roleData);
            setState(prev => ({ ...prev, roles: prev.roles.map(r => r.id === roleData.id ? roleData : r) }));
            logActivity('login', `دسترسی‌های نقش ${roleData.name} تغییر یافت.`);
            return { success: true, message: '✅ نقش بروزرسانی شد.' };
        } catch (e) { return { success: false, message: '❌ خطا.' }; }
    };
    const deleteRole = async (roleId: string) => {
        try {
            const role = state.roles.find(r => r.id === roleId);
            await api.deleteRole(roleId);
            setState(prev => ({ ...prev, roles: prev.roles.filter(r => r.id !== roleId) }));
            logActivity('login', `نقش حذف شد: ${role?.name || 'نامشخص'}`);
        } catch(e) { showToast("❌ خطا."); }
    };

    const addToCart = (itemToAdd: Product | Service, type: 'product' | 'service') => {
        let success = false, message = '';
        setState(prev => {
            const existingItemIndex = prev.cart.findIndex(item => item.id === itemToAdd.id && item.type === type);
            const totalStock = type === 'product' ? (itemToAdd as Product).batches.reduce((sum, b) => sum + b.stock, 0) : Infinity;
            if (existingItemIndex > -1) {
                const updatedCart = [...prev.cart];
                const existingItem = updatedCart[existingItemIndex];
                if (type === 'product' && existingItem.quantity >= totalStock) { message = `حداکثر موجودی است.`; return prev; }
                updatedCart[existingItemIndex] = { ...existingItem, quantity: existingItem.quantity + 1 };
                success = true;
                return { ...prev, cart: updatedCart };
            } else {
                if (type === 'product' && totalStock < 1) { message = `موجودی تمام شده.`; return prev; }
                success = true;
                return { ...prev, cart: [...prev.cart, { ...itemToAdd, quantity: 1, type } as any] };
            }
        });
        return { success, message };
    };
    const updateCartItemQuantity = (itemId: string, itemType: 'product' | 'service', newQuantity: number) => {
        if (newQuantity < 0) return { success: false, message: 'نامعتبر' };
        let success = true, message = '';
        setState(prev => {
            const cart = [...prev.cart];
            const itemIndex = cart.findIndex(i => i.id === itemId && i.type === itemType);
            if (itemIndex === -1) return prev;
            if (itemType === 'product') {
                 const pInStock = prev.products.find(p => p.id === itemId);
                 const total = pInStock?.batches.reduce((sum, b) => sum + b.stock, 0) || 0;
                 if (newQuantity > total) { message = `موجودی فقط ${total} عدد است.`; cart[itemIndex] = { ...cart[itemIndex], quantity: total }; return { ...prev, cart }; }
            }
            cart[itemIndex] = { ...cart[itemIndex], quantity: newQuantity };
            if (newQuantity === 0) return { ...prev, cart: cart.filter(i => !(i.id === itemId && i.type === itemType)) };
            return { ...prev, cart };
        });
        return { success, message };
    };
    const updateCartItemFinalPrice = (itemId: string, itemType: 'product' | 'service', finalPrice: number) => {
        setState(prev => ({ ...prev, cart: prev.cart.map(item => (item.id === itemId && item.type === itemType && item.type === 'product') ? { ...item, finalPrice: finalPrice } : item) }));
    };
    const removeFromCart = (itemId: string, itemType: 'product' | 'service') => {
        setState(prev => ({ ...prev, cart: prev.cart.filter(item => !(item.id === itemId && item.type === itemType)) }));
    };
    const completeSale = async (cashier: string, customerId?: string): Promise<{ success: boolean; invoice?: SaleInvoice; message: string }> => {
        const { cart, products, editingSaleInvoiceId, customers, saleInvoices, storeSettings } = state;
        if (cart.length === 0) return { success: false, message: "خالی است!" };
        
        // Calculate restorations if editing
        const stockRestores: { batchId: string; quantity: number }[] = [];
        if (editingSaleInvoiceId) {
            const oldInv = saleInvoices.find(i => i.id === editingSaleInvoiceId);
            if (oldInv) {
                oldInv.items.forEach(item => {
                    if (item.type === 'product' && item.batchDeductions) {
                        item.batchDeductions.forEach(d => {
                            stockRestores.push({ batchId: d.batchId, quantity: d.quantity });
                        });
                    }
                });
            }
        }

        const subtotal = cart.reduce((total, item) => ((item.type === 'product' ? item.salePrice : item.price) * item.quantity) + total, 0);
        const totalAmount = cart.reduce((total, item) => {
            const price = (item.type === 'product' && item.finalPrice !== undefined) ? item.finalPrice : (item.type === 'product' ? item.salePrice : item.price);
            return (price * item.quantity) + total;
        }, 0);
        
        const stockUpdates: {batchId: string, newStock: number}[] = [];
        const saleItems: CartItem[] = [];
        
        // Use a copy of products to calculate new stocks correctly after restoration logic
        // For simplicity, we apply restorations to the local product copy first
        const updProducts = JSON.parse(JSON.stringify(products));
        stockRestores.forEach(r => {
            const p = updProducts.find((prod: Product) => prod.batches.some(b => b.id === r.batchId));
            if (p) {
                const b = p.batches.find((batch: any) => batch.id === r.batchId);
                if (b) b.stock += r.quantity;
            }
        });

        for (const item of cart) {
            if (item.type === 'service') { saleItems.push(item); continue; }
            const p = updProducts.find((p: Product) => p.id === item.id);
            let qtyToDeduct = item.quantity;
            let totalPurcValue = 0;
            const batchDeductions: { batchId: string; quantity: number }[] = [];
            
            p.batches.sort((a: any, b: any) => new Date(a.expiryDate || a.purchaseDate).getTime() - new Date(b.expiryDate || b.purchaseDate).getTime());
            for (const batch of p.batches) {
                if (qtyToDeduct <= 0) break;
                const deduct = Math.min(qtyToDeduct, batch.stock);
                batch.stock -= deduct; qtyToDeduct -= deduct;
                totalPurcValue += deduct * batch.purchasePrice;
                stockUpdates.push({ batchId: batch.id, newStock: batch.stock });
                batchDeductions.push({ batchId: batch.id, quantity: deduct });
            }
            saleItems.push({ ...item, purchasePrice: totalPurcValue / item.quantity, batchDeductions });
        }
        
        const invoiceId = editingSaleInvoiceId || generateNextId('F', saleInvoices.map(i => i.id));
        const finalInv: SaleInvoice = { id: invoiceId, type: 'sale', items: saleItems, subtotal, totalAmount, totalDiscount: subtotal - totalAmount, timestamp: new Date().toISOString(), cashier, customerId };
        
        let custUpdate;
        if (customerId) {
            const customer = customers.find(c => c.id === customerId)!;
            custUpdate = { id: customerId, newBalance: customer.balance + totalAmount, oldAmount: editingSaleInvoiceId ? (saleInvoices.find(i => i.id === editingSaleInvoiceId)?.totalAmount || 0) : 0, newAmount: totalAmount, transactionDescription: `فاکتور فروش #${invoiceId}`, transaction: { id: crypto.randomUUID(), customerId, type: 'credit_sale' as const, amount: totalAmount, date: new Date().toISOString(), description: `فاکتور فروش #${invoiceId}`, invoiceId } };
        }
        
        try {
            if (editingSaleInvoiceId) { 
                await api.updateSale(invoiceId, finalInv, stockRestores, stockUpdates, custUpdate); 
                logActivity('sale', `فاکتور فروش #${invoiceId} ویرایش شد. مبلغ جدید: ${formatCurrency(totalAmount, storeSettings)}`, invoiceId, 'saleInvoice'); 
            }
            else { 
                await api.createSale(finalInv, stockUpdates, custUpdate); 
                logActivity('sale', `ثبت فاکتور فروش #${invoiceId} - مبلغ: ${formatCurrency(totalAmount, storeSettings)}`, invoiceId, 'saleInvoice'); 
            }
            await fetchData(true); setState(prev => ({ ...prev, cart: [], editingSaleInvoiceId: null }));
            return { success: true, invoice: finalInv, message: 'ثبت شد.' };
        } catch (e) { return { success: false, message: 'خطا.' }; }
    };
    const beginEditSale = (invoiceId: string) => {
        const inv = state.saleInvoices.find(i => i.id === invoiceId);
        if (!inv) return { success: false, message: "یافت نشد." };
        setState(prev => ({ ...prev, editingSaleInvoiceId: invoiceId, cart: inv.items.map(i => ({ ...i } as CartItem)) }));
        return { success: true, message: "ویرایش.", customerId: inv.customerId };
    };
    const cancelEditSale = () => setState(prev => ({ ...prev, editingSaleInvoiceId: null, cart: [] }));
    const addSaleReturn = (id: string, items: any[], cashier: string) => {
        const orig = state.saleInvoices.find(i => i.id === id);
        if (!orig) return { success: false, message: "یافت نشد." };
        let total = 0;
        const stockRestores: { batchId: string; quantity: number }[] = [];
        
        const detItems = items.map(ri => {
            const origI = orig.items.find(i => i.id === ri.id && i.type === ri.type) as CartItem;
            if (!origI) return null;
            const pr = (origI.type === 'product' && origI.finalPrice !== undefined) ? origI.finalPrice : (origI.type === 'product' ? origI.salePrice : origI.price);
            total += pr * ri.quantity;
            
            // Precise batch restoration logic
            if (origI.type === 'product' && origI.batchDeductions) {
                let returnQtyRemaining = ri.quantity;
                // Reverse FIFO for returns: put back into the newest batches first
                const sortedDeductions = [...origI.batchDeductions].reverse();
                for (const deduction of sortedDeductions) {
                    if (returnQtyRemaining <= 0) break;
                    const restoreAmt = Math.min(returnQtyRemaining, deduction.quantity);
                    stockRestores.push({ batchId: deduction.batchId, quantity: restoreAmt });
                    returnQtyRemaining -= restoreAmt;
                }
            }
            
            return { ...origI, quantity: ri.quantity };
        }).filter(Boolean) as CartItem[];

        const returnId = generateNextId('R', state.saleInvoices.map(i => i.id));
        const retInv: SaleInvoice = { id: returnId, type: 'return', originalInvoiceId: id, items: detItems, subtotal: total, totalAmount: total, totalDiscount: 0, timestamp: new Date().toISOString(), cashier, customerId: orig.customerId };
        
        api.createSaleReturn(retInv, stockRestores, orig.customerId ? { id: orig.customerId, amount: total } : undefined)
           .then(() => { fetchData(true); logActivity('sale', `ثبت مرجوعی فروش فاکتور #${id} به مبلغ ${formatCurrency(total, state.storeSettings)}`, returnId, 'saleInvoice'); showToast("✅ مرجوعی ثبت شد."); });
        return { success: true, message: "در حال ثبت..." };
    };
    const setInvoiceTransientCustomer = async (id: string, name: string) => {
         await api.updateSaleInvoiceMetadata(id, { original_invoice_id: name });
         setState(prev => ({ ...prev, saleInvoices: prev.saleInvoices.map(inv => inv.id === id ? { ...inv, originalInvoiceId: name } : inv) }));
    };

    const addProduct = (p: any, b: any) => { 
        api.addProduct(p, b).then(np => { setState(prev => ({ ...prev, products: [...prev.products, np] })); logActivity('inventory', `محصول جدید اضافه شد: ${p.name}`, np.id, 'product'); showToast('✅ ذخیره شد.'); }); 
        return { success: true, message: 'در حال ذخیره...' }; 
    };
    const updateProduct = (p: any) => { 
        api.updateProduct(p).then(() => { setState(prev => ({ ...prev, products: prev.products.map(x => x.id === p.id ? p : x) })); logActivity('inventory', `محصول ویرایش شد: ${p.name}`, p.id, 'product'); showToast('✅ ویرایش شد.'); }); 
        return { success: true, message: 'در حال ویرایش...' }; 
    };
    const deleteProduct = (id: string) => {
        const product = state.products.find(p => p.id === id);
        api.deleteProduct(id).then(() => { setState(prev => ({ ...prev, products: prev.products.filter(p => p.id !== id) })); logActivity('inventory', `محصول حذف شد: ${product?.name || 'نامشخص'}`); showToast('✅ حذف شد.'); });
    };
    const addPurchaseInvoice = (data: any) => {
        const invId = generateNextId('P', state.purchaseInvoices.map(i => i.id));
        let inventoryTotalAFN = 0; 
        let debtTotalCurrency = 0; 
        const nBatches: any[] = []; 
        const itemsNames: any[] = [];
        const rate = (data.currency === 'USD') ? (data.exchangeRate || 1) : 1;

        for (const it of data.items) {
            const pr = state.products.find(p => p.id === it.productId);
            const priceInAFN = it.purchasePrice * rate;
            const b = { id: crypto.randomUUID(), productId: it.productId, lotNumber: it.lotNumber, stock: it.quantity, purchasePrice: priceInAFN, purchaseDate: data.timestamp, expiryDate: it.expiryDate };
            nBatches.push(b); 
            inventoryTotalAFN += it.quantity * priceInAFN;
            debtTotalCurrency += it.quantity * it.purchasePrice;
            itemsNames.push({ ...it, productName: pr?.name || 'ناشناس' });
        }

        const finalP: PurchaseInvoice = { id: invId, type: 'purchase', supplierId: data.supplierId, invoiceNumber: data.invoiceNumber, items: itemsNames, totalAmount: Math.round(inventoryTotalAFN), timestamp: data.timestamp, currency: data.currency, exchangeRate: data.exchangeRate };
        const supplier = state.suppliers.find(x => x.id === data.supplierId);
        
        const isUSD = data.currency === 'USD';
        const sUpd = { 
            id: data.supplierId, 
            newBalanceAFN: (supplier?.balanceAFN || 0) + (isUSD ? 0 : Math.round(debtTotalCurrency)),
            newBalanceUSD: (supplier?.balanceUSD || 0) + (isUSD ? Math.round(debtTotalCurrency) : 0),
            transaction: { 
                id: crypto.randomUUID(), 
                supplierId: data.supplierId, 
                type: 'purchase' as const, 
                amount: Math.round(debtTotalCurrency), 
                date: data.timestamp, 
                description: `فاکتور خرید #${data.invoiceNumber || invId}`, 
                invoiceId: invId,
                currency: data.currency
            } 
        };
        
        return api.createPurchase(finalP, sUpd, nBatches).then(() => { 
            fetchData(true); 
            logActivity('purchase', `فاکتور خرید #${data.invoiceNumber || invId} از ${supplier?.name} ثبت شد.`, invId, 'purchaseInvoice'); 
            showToast("✅ خرید ثبت شد."); 
            return { success: true, message: "خرید با موفقیت ثبت شد." };
        }).catch(err => {
            console.error(err);
            return { success: false, message: "خطا در ثبت خرید." };
        });
    };
    const beginEditPurchase = (id: string) => { setState(prev => ({ ...prev, editingPurchaseInvoiceId: id })); return { success: true, message: "ویرایش." }; };
    const cancelEditPurchase = () => setState(prev => ({ ...prev, editingPurchaseInvoiceId: null }));
    const updatePurchaseInvoice = (data: any) => {
        const orig = state.purchaseInvoices.find(i => i.id === state.editingPurchaseInvoiceId);
        if (!orig) return { success: false, message: "یافت نشد." };
        let inventoryTotalAFN = 0; 
        let debtTotalCurrency = 0;
        const itemsNames: any[] = [];
        const rate = (data.currency === 'USD') ? (data.exchangeRate || 1) : 1;

        for (const it of data.items) {
            const pr = state.products.find(p => p.id === it.productId);
            inventoryTotalAFN += Number(it.quantity) * Number(it.purchasePrice) * rate;
            debtTotalCurrency += Number(it.quantity) * Number(it.purchasePrice);
            itemsNames.push({ ...it, productName: pr?.name || 'ناشناس' });
        }

        const updAmountAFN = Math.round(inventoryTotalAFN);
        const upd: PurchaseInvoice = { id: state.editingPurchaseInvoiceId!, type: 'purchase', supplierId: data.supplierId, invoiceNumber: data.invoiceNumber, items: itemsNames, totalAmount: updAmountAFN, timestamp: data.timestamp, currency: data.currency, exchangeRate: data.exchangeRate };
        
        // Multi-currency update logic
        const supplier = state.suppliers.find(s => s.id === data.supplierId);
        const isUSD = data.currency === 'USD';
        
        // Calculate old debt in its original currency
        let oldDebtCurrency = 0;
        orig.items.forEach(it => oldDebtCurrency += it.quantity * it.purchasePrice);

        const sUpd = orig.supplierId === data.supplierId ? { 
            id: data.supplierId, 
            oldAmount: oldDebtCurrency, 
            newAmount: Math.round(debtTotalCurrency),
            isUSD: isUSD
        } : undefined;

        api.updatePurchase(state.editingPurchaseInvoiceId!, upd, sUpd).then(() => { fetchData(true); logActivity('purchase', `فاکتور خرید #${data.invoiceNumber || state.editingPurchaseInvoiceId} ویرایش شد.`, state.editingPurchaseInvoiceId!, 'purchaseInvoice'); showToast("✅ بروزرسانی شد."); });
        return { success: true, message: "در حال بروزرسانی..." };
    };
    const addPurchaseReturn = (id: string, items: any[]) => {
        const orig = state.purchaseInvoices.find(i => i.id === id);
        if (!orig) return { success: false, message: "یافت نشد." };
        let totalCurrency = 0;
        const detItems = items.map(ri => {
            const origI = orig.items.find(i => i.productId === ri.productId && i.lotNumber === ri.lotNumber);
            if (!origI) return null;
            totalCurrency += origI.purchasePrice * ri.quantity;
            return { ...origI, quantity: ri.quantity };
        }).filter(Boolean) as PurchaseInvoiceItem[];
        
        const returnId = generateNextId('PR', state.purchaseInvoices.map(i => i.id));
        const finalTotalCurrency = Math.round(totalCurrency);
        const ret: PurchaseInvoice = { id: returnId, type: 'return', originalInvoiceId: id, supplierId: orig.supplierId, invoiceNumber: `R-${orig.invoiceNumber || id}`, items: detItems, totalAmount: finalTotalCurrency, timestamp: new Date().toISOString(), currency: orig.currency };
        
        api.createPurchaseReturn(ret, detItems.map(i => ({ productId: i.productId, quantity: i.quantity, lotNumber: i.lotNumber })), { id: orig.supplierId, amount: finalTotalCurrency, isUSD: orig.currency === 'USD' })
           .then(() => { fetchData(true); logActivity('purchase', `ثبت مرجوعی خرید فاکتور #${id} به مبلغ ${finalTotalCurrency} ${orig.currency === 'USD' ? '$' : state.storeSettings.currencyName}`, returnId, 'purchaseInvoice'); showToast("✅ مرجوعی خرید ثبت شد."); });
        return { success: true, message: "در حال ثبت..." };
    };

    // --- IN TRANSIT ACTIONS ---
    const addInTransitInvoice = (data: any) => {
        const invId = generateNextId('IT', state.inTransitInvoices.map(i => i.id));
        let totalInventoryAFN = 0; const itemsNames: any[] = [];
        const rate = (data.currency === 'USD') ? (data.exchangeRate || 1) : 1;
        for (const it of data.items) {
            const pr = state.products.find(p => p.id === it.productId);
            totalInventoryAFN += Number(it.quantity) * Number(it.purchasePrice) * rate;
            itemsNames.push({ ...it, productName: pr?.name || 'ناشناس' });
        }
        const finalTotal = Math.round(totalInventoryAFN);
        const invoice: InTransitInvoice = { id: invId, type: 'in_transit', supplierId: data.supplierId, invoiceNumber: data.invoiceNumber, items: itemsNames, totalAmount: finalTotal, timestamp: data.timestamp, currency: data.currency, exchangeRate: data.exchangeRate, expectedArrivalDate: data.expectedArrivalDate };
        api.createInTransit(invoice).then(() => { fetchData(true); showToast("✅ محموله در لیست انتظار ثبت شد."); });
        return { success: true, message: "در حال ثبت..." };
    };
    const updateInTransitInvoice = (data: any) => {
        let totalInventoryAFN = 0; const itemsNames: any[] = [];
        const rate = (data.currency === 'USD') ? (data.exchangeRate || 1) : 1;
        for (const it of data.items) {
            const pr = state.products.find(p => p.id === it.productId);
            totalInventoryAFN += Number(it.quantity) * Number(it.purchasePrice) * rate;
            itemsNames.push({ ...it, productName: pr?.name || 'ناشناس' });
        }
        const finalTotal = Math.round(totalInventoryAFN);
        const invoice: InTransitInvoice = { id: data.id, type: 'in_transit', supplierId: data.supplierId, invoiceNumber: data.invoiceNumber, items: itemsNames, totalAmount: finalTotal, timestamp: data.timestamp, currency: data.currency, exchangeRate: data.exchangeRate, expectedArrivalDate: data.expectedArrivalDate };
        api.updateInTransit(invoice).then(() => { fetchData(true); showToast("✅ اطلاعات محموله بروزرسانی شد."); });
        return { success: true, message: "در حال بروزرسانی..." };
    };
    const deleteInTransitInvoice = (id: string) => {
        api.deleteInTransit(id).then(() => { fetchData(true); showToast("✅ محموله حذف شد."); });
    };
    const confirmInTransitArrival = (id: string) => {
        const inTransit = state.inTransitInvoices.find(i => i.id === id);
        if (!inTransit) return { success: false, message: "محموله یافت نشد." };
        
        const invoiceDataForPurchase = {
            supplierId: inTransit.supplierId,
            invoiceNumber: inTransit.invoiceNumber,
            timestamp: new Date().toISOString(), 
            currency: inTransit.currency,
            exchangeRate: inTransit.exchangeRate,
            items: inTransit.items.map(i => ({
                productId: i.productId,
                quantity: i.quantity,
                purchasePrice: i.purchasePrice,
                lotNumber: i.lotNumber,
                expiryDate: i.expiryDate
            }))
        };

        addPurchaseInvoice(invoiceDataForPurchase).then(res => {
             if (res.success) {
                 api.deleteInTransit(id).then(() => fetchData(true));
             }
        });
        
        return { success: true, message: "در حال پردازش ورود به انبار..." };
    };

    const updateSettings = (n: any) => api.updateSettings(n).then(() => { setState(prev => ({ ...prev, storeSettings: n })); logActivity('login', 'تنظیمات کلی فروشگاه بروزرسانی شد.'); showToast("✅ تنظیمات ذخیره شد."); });
    const addService = (s: any) => api.addService(s).then(() => { fetchData(true); logActivity('inventory', `خدمت جدید تعریف شد: ${s.name}`); });
    const deleteService = (id: string) => {
        const service = state.services.find(s => s.id === id);
        api.deleteService(id).then(() => { fetchData(true); logActivity('inventory', `خدمت حذف شد: ${service?.name || 'نامشخص'}`); });
    };
    const addSupplier = (s: any, bal: any) => api.addSupplier(s).then(ns => { logActivity('purchase', `تأمین‌کننده جدید اضافه شد: ${s.name}`); if (bal) { 
        const isUSD = bal.currency === 'USD';
        api.processPayment('supplier', ns.id, { 
            newBalanceAFN: isUSD ? 0 : (bal.type === 'creditor' ? bal.amount : -bal.amount),
            newBalanceUSD: isUSD ? (bal.type === 'creditor' ? bal.amount : -bal.amount) : 0
        }, { id: crypto.randomUUID(), supplierId: ns.id, type: 'purchase', amount: bal.amount, date: new Date().toISOString(), description: 'تراز اول', currency: bal.currency }).then(() => fetchData(true)); 
    } else fetchData(true); });
    const deleteSupplier = (id: string) => {
        const supplier = state.suppliers.find(s => s.id === id);
        api.deleteSupplier(id).then(() => { fetchData(true); logActivity('purchase', `تأمین‌کننده حذف شد: ${supplier?.name || 'نامشخص'}`); });
    };
    const addCustomer = (c: any, bal: any) => api.addCustomer(c).then(nc => { logActivity('sale', `مشتری جدید اضافه شد: ${c.name}`); if (bal) api.processPayment('customer', nc.id, bal.amount, { id: crypto.randomUUID(), customerId: nc.id, type: 'credit_sale', amount: bal.amount, date: new Date().toISOString(), description: 'تراز اول' }).then(() => fetchData(true)); else fetchData(true); });
    const deleteCustomer = (id: string) => {
        const customer = state.customers.find(c => c.id === id);
        api.deleteCustomer(id).then(() => { fetchData(true); logActivity('sale', `مشتری حذف شد: ${customer?.name || 'نامشخص'}`); });
    };
    const addEmployee = (e: any) => api.addEmployee(e).then(() => { fetchData(true); logActivity('payroll', `کارمند جدید اضافه شد: ${e.name}`); });
    const addExpense = (e: any) => api.addExpense(e).then(() => { fetchData(true); logActivity('payroll', `ثبت هزینه: ${e.description} - مبلغ ${formatCurrency(e.amount, state.storeSettings)}`); });
    
    const addEmployeeAdvance = (eid: string, amt: number, desc: string) => {
        const employee = state.employees.find(x => x.id === eid)!;
        const description = desc || 'مساعده';
        
        api.processPayment('employee', eid, employee.balance + amt, { 
            id: crypto.randomUUID(), 
            employeeId: eid, 
            type: 'advance' as const, 
            amount: amt, 
            date: new Date().toISOString(), 
            description: description 
        }).then(() => { 
            // Automatically add to expenses
            addExpense({
                category: 'salary',
                description: `حقوق/مساعده: ${employee.name} - ${description}`,
                amount: amt,
                date: new Date().toISOString()
            });
            fetchData(true); 
            logActivity('payroll', `ثبت مساعده برای ${employee.name} - مبلغ: ${formatCurrency(amt, state.storeSettings)}`); 
        });
    };
    
    const processAndPaySalaries = () => {
        let tot = 0; 
        const txs: any[] = [];
        state.employees.forEach(e => { 
            const net = e.monthlySalary - e.balance; 
            if (net > 0) { 
                txs.push({ 
                    id: crypto.randomUUID(), 
                    employeeId: e.id, 
                    type: 'salary_payment', 
                    amount: net, 
                    date: new Date().toISOString(), 
                    description: 'تسویه نهایی حقوق ماهانه' 
                }); 
                tot += net; 
            } 
        });
        
        if (tot === 0) return { success: false, message: 'موردی برای تسویه یافت نشد.' };
        
        api.processPayroll(
            state.employees.map(e => ({ id: e.id, balance: 0 as const })), 
            txs, 
            { 
                id: crypto.randomUUID(), 
                category: 'salary', 
                description: 'تسویه کلی حقوق و دستمزد ماهانه کارکنان', 
                amount: tot, 
                date: new Date().toISOString() 
            }
        ).then(() => { 
            fetchData(true); 
            logActivity('payroll', `تسویه حقوق و دستمزد ماهانه کارکنان - مجموع: ${formatCurrency(tot, state.storeSettings)}`); 
        });
        return { success: true, message: 'حقوق کارکنان با موفقیت تسویه و در لیست مخارج ثبت شد.' };
    };

    const addSupplierPayment = (sid: string, amt: number, desc: string, cur: any, rate: any) => {
        const supplier = state.suppliers.find(x => x.id === sid)!;
        const tx = { id: crypto.randomUUID(), supplierId: sid, type: 'payment' as const, amount: amt, date: new Date().toISOString(), description: desc, currency: cur };
        
        const isUSD = cur === 'USD';
        const updates = {
            newBalanceAFN: isUSD ? supplier.balanceAFN : (supplier.balanceAFN - amt),
            newBalanceUSD: isUSD ? (supplier.balanceUSD - amt) : supplier.balanceUSD
        };

        api.processPayment('supplier', sid, updates, tx).then(() => { fetchData(true); logActivity('purchase', `پرداخت به ${supplier.name} - مبلغ: ${amt} ${isUSD ? '$' : state.storeSettings.currencyName}`); });
        return tx;
    };
    const addCustomerPayment = (cid: string, amt: number, desc: string) => {
        const customer = state.customers.find(x => x.id === cid)!;
        const tx = { id: crypto.randomUUID(), customerId: cid, type: 'payment' as const, amount: amt, date: new Date().toISOString(), description: desc };
        api.processPayment('customer', cid, customer.balance - amt, tx).then(() => { fetchData(true); logActivity('sale', `دریافت وجه از ${customer.name} - مبلغ: ${formatCurrency(amt, state.storeSettings)}`); });
        return tx;
    };

    if (isLoading) return <div className="flex items-center justify-center h-screen text-xl font-bold text-blue-600">در حال دریافت اطلاعات...</div>;

    return <AppContext.Provider value={{
        ...state, showToast, isLoading, isLoggingOut, isShopActive, login, signup, logout, hasPermission, addUser, updateUser, deleteUser, addRole, updateRole, deleteRole, exportData, importData,
        cloudBackup, cloudRestore, autoBackupEnabled, setAutoBackupEnabled: handleSetAutoBackup,
        addProduct, updateProduct, deleteProduct, addToCart, updateCartItemQuantity, updateCartItemFinalPrice, removeFromCart, completeSale,
        beginEditSale, cancelEditSale, addSaleReturn, addPurchaseInvoice, beginEditPurchase, cancelEditPurchase, updatePurchaseInvoice, addPurchaseReturn,
        addInTransitInvoice, updateInTransitInvoice, deleteInTransitInvoice, confirmInTransitArrival,
        updateSettings, addService, deleteService, addSupplier, deleteSupplier, addSupplierPayment, addCustomer, deleteCustomer, addCustomerPayment,
        addEmployee, addEmployeeAdvance, processAndPaySalaries, addExpense, setInvoiceTransientCustomer
    }}>{children}</AppContext.Provider>;
};

export const useAppContext = (): AppContextType => {
    const context = useContext(AppContext);
    if (context === undefined) throw new Error('useAppContext must be used within AppProvider');
    return context;
};