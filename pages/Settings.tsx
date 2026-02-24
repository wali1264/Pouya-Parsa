import React, { useState, useRef } from 'react';
import { useAppContext } from '../AppContext';
import type { StoreSettings, Service, Role, User, Permission } from '../types';
import { PlusIcon, TrashIcon, DownloadIcon, UploadIcon, UserGroupIcon, KeyIcon, WarningIcon, CheckIcon, SettingsIcon } from '../components/icons';
import Toast from '../components/Toast';
import { formatCurrency, toEnglishDigits } from '../utils/formatters';
import { ALL_PERMISSIONS, groupPermissions } from '../utils/permissions';

interface TabProps {
    showToast: (message: string) => void;
}

const StoreDetailsTab: React.FC<TabProps> = ({ showToast }) => {
    const { storeSettings, updateSettings } = useAppContext();
    const [formData, setFormData] = useState(storeSettings);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value;
        if (e.target.name === 'phone') {
            value = toEnglishDigits(value);
        }
        setFormData({ ...formData, [e.target.name]: value });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        updateSettings(formData);
        showToast("مشخصات فروشگاه با موفقیت بروزرسانی شد.");
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto">
            <h3 className="text-xl font-bold text-slate-800 border-b pb-3 mb-4 hidden md:block">مشخصات فروشگاه</h3>
            <div className="space-y-4">
                <div>
                    <label htmlFor="storeName" className="block text-sm md:text-md font-bold text-slate-700 mb-2">نام فروشگاه</label>
                    <input id="storeName" name="storeName" value={formData.storeName} onChange={handleChange} className="w-full p-3.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-50 outline-none transition-all" />
                </div>
                <div>
                    <label htmlFor="address" className="block text-sm md:text-md font-bold text-slate-700 mb-2">آدرس</label>
                    <input id="address" name="address" value={formData.address} onChange={handleChange} className="w-full p-3.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-50 outline-none transition-all" />
                </div>
                <div>
                    <label htmlFor="phone" className="block text-sm md:text-md font-bold text-slate-700 mb-2">شماره تماس</label>
                    <input id="phone" name="phone" value={formData.phone} onChange={handleChange} className="w-full p-3.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-50 outline-none transition-all" dir="ltr" />
                </div>
                <div>
                    <label htmlFor="currencyName" className="block text-sm md:text-md font-bold text-slate-700 mb-2">نام واحد پولی</label>
                    <input id="currencyName" name="currencyName" value={formData.currencyName} onChange={handleChange} className="w-full p-3.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-50 outline-none transition-all" placeholder="مثال: افغانی" />
                </div>
            </div>
            <div className="flex justify-end pt-4">
                <button type="submit" className="w-full md:w-auto px-8 py-4 rounded-xl bg-blue-600 text-white font-black text-lg shadow-xl shadow-blue-100 btn-primary active:scale-[0.98]">ذخیره تغییرات</button>
            </div>
        </form>
    );
};

const AlertsTab: React.FC<TabProps> = ({ showToast }) => {
    const { storeSettings, updateSettings } = useAppContext();
    const [formData, setFormData] = useState({
        lowStockThreshold: String(storeSettings.lowStockThreshold),
        expiryThresholdMonths: String(storeSettings.expiryThresholdMonths)
    });

     const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const englishValue = toEnglishDigits(value).replace(/[^0-9]/g, '');
        setFormData(prev => ({ ...prev, [name]: englishValue }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        updateSettings({ 
            ...storeSettings, 
            lowStockThreshold: Number(formData.lowStockThreshold) || 0,
            expiryThresholdMonths: Number(formData.expiryThresholdMonths) || 0
        });
        showToast("تنظیمات هشدارها با موفقیت بروزرسانی شد.");
    };

    return (
         <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto">
            <h3 className="text-xl font-bold text-slate-800 border-b pb-3 mb-4 hidden md:block">مدیریت هشدارها</h3>
             <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                <p className="text-blue-800 text-sm font-medium leading-relaxed">این تنظیمات به شما کمک می‌کنند تا قبل از اتمام موجودی یا تاریخ انقضای محصولات، از طریق داشبورد مطلع شوید.</p>
            </div>
            <div className="space-y-6">
                <div>
                    <label htmlFor="lowStockThreshold" className="block text-sm md:text-md font-bold text-slate-700 mb-2">آستانه کمبود موجودی</label>
                    <input id="lowStockThreshold" name="lowStockThreshold" type="text" inputMode="numeric" value={formData.lowStockThreshold} onChange={handleChange} className="w-full p-3.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-50 outline-none transition-all font-bold" />
                    <p className="text-xs text-slate-400 mt-2 font-medium">زمانی که موجودی یک کالا به این عدد یا کمتر برسد، هشدار داده خواهد شد.</p>
                </div>
                <div>
                    <label htmlFor="expiryThresholdMonths" className="block text-sm md:text-md font-bold text-slate-700 mb-2">بازه زمانی هشدار انقضا (به ماه)</label>
                    <input id="expiryThresholdMonths" name="expiryThresholdMonths" type="text" inputMode="numeric" value={formData.expiryThresholdMonths} onChange={handleChange} className="w-full p-3.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-50 outline-none transition-all font-bold" />
                    <p className="text-xs text-slate-400 mt-2 font-medium">محصولاتی که تاریخ انقضای آن‌ها کمتر از این تعداد ماه آینده باشد، در داشبورد نمایش داده خواهند شد.</p>
                </div>
            </div>
            <div className="flex justify-end pt-4">
                <button type="submit" className="w-full md:w-auto px-8 py-4 rounded-xl bg-blue-600 text-white font-black text-lg shadow-xl shadow-blue-100 btn-primary active:scale-[0.98]">ذخیره تغییرات</button>
            </div>
        </form>
    );
};

const CustomizationTab: React.FC<TabProps> = ({ showToast }) => {
    const { storeSettings, updateSettings, products, saleInvoices, purchaseInvoices } = useAppContext();
    const [formData, setFormData] = useState({
        packageLabel: storeSettings.packageLabel || 'بسته',
        unitLabel: storeSettings.unitLabel || 'عدد',
        baseCurrency: storeSettings.baseCurrency || 'AFN',
        currencyConfigs: storeSettings.currencyConfigs
    });

    const isSystemEmpty = products.length === 0 && saleInvoices.length === 0 && purchaseInvoices.length === 0;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleConfigChange = (code: 'AFN' | 'USD' | 'IRT', field: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            currencyConfigs: {
                ...prev.currencyConfigs,
                [code]: {
                    ...prev.currencyConfigs[code],
                    [field]: value
                }
            }
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        updateSettings({ ...storeSettings, ...formData });
        showToast("تنظیمات شخصی‌سازی با موفقیت ذخیره شد.");
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl mx-auto pb-10">
            <div className="border-b pb-4">
                <h3 className="text-xl font-black text-slate-800 mb-2">شخصی‌سازی واحدها و ارز پایه</h3>
                <p className="text-sm text-slate-500 font-medium">تنظیمات مربوط به واحد کالاها و ارز اصلی سیستم را در این بخش مدیریت کنید.</p>
            </div>

            {/* Units Section */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <h4 className="text-md font-black text-slate-700 mb-4 flex items-center gap-2">
                    <SettingsIcon className="w-5 h-5 text-blue-500" /> عناوین واحدها
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label htmlFor="packageLabel" className="block text-sm font-bold text-slate-700 mb-2">نام واحد بزرگ (بسته/کارتن)</label>
                        <input id="packageLabel" name="packageLabel" value={formData.packageLabel} onChange={handleChange} className="w-full p-3.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-50 outline-none transition-all font-bold" />
                    </div>
                    <div>
                        <label htmlFor="unitLabel" className="block text-sm font-bold text-slate-700 mb-2">نام واحد کوچک (عدد/پک)</label>
                        <input id="unitLabel" name="unitLabel" value={formData.unitLabel} onChange={handleChange} className="w-full p-3.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-50 outline-none transition-all font-bold" />
                    </div>
                </div>
            </div>

            {/* Currency Section */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <h4 className="text-md font-black text-slate-700 mb-4 flex items-center gap-2">
                    <KeyIcon className="w-5 h-5 text-indigo-500" /> تنظیمات ارز پایه و نرخ‌ها
                </h4>
                
                <div className="mb-6">
                    <label className="block text-sm font-bold text-slate-700 mb-2">انتخاب ارز پایه سیستم</label>
                    <div className="flex flex-col md:flex-row items-center gap-4">
                        <select 
                            name="baseCurrency" 
                            value={formData.baseCurrency} 
                            onChange={handleChange} 
                            disabled={!isSystemEmpty}
                            className={`w-full md:w-64 p-3.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-50 outline-none font-black ${!isSystemEmpty ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : 'bg-white text-slate-800'}`}
                        >
                            <option value="AFN">افغانی (AFN)</option>
                            <option value="USD">دلار (USD)</option>
                            <option value="IRT">تومان (IRT)</option>
                        </select>
                        {!isSystemEmpty && (
                            <div className="flex items-center gap-2 text-red-500 bg-red-50 px-4 py-2 rounded-xl border border-red-100">
                                <WarningIcon className="w-4 h-4" />
                                <span className="text-xs font-bold">ارز پایه به دلیل وجود تراکنش در سیستم قابل تغییر نیست.</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-4">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-wider">تنظیمات روش محاسبه ارزهای فرعی:</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(['AFN', 'USD', 'IRT'] as const).filter(c => c !== formData.baseCurrency).map(code => (
                            <div key={code} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="font-black text-slate-700">{code === 'AFN' ? 'افغانی' : code === 'USD' ? 'دلار' : 'تومان'}</span>
                                    <span className="text-[10px] font-bold text-slate-400">کد: {code}</span>
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 mb-1">نام نمایشی</label>
                                        <input 
                                            value={formData.currencyConfigs[code].name} 
                                            onChange={e => handleConfigChange(code, 'name', e.target.value)}
                                            className="w-full p-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-50 outline-none font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 mb-1">روش محاسبه نسبت به ارز پایه</label>
                                        <select 
                                            value={formData.currencyConfigs[code].method}
                                            onChange={e => handleConfigChange(code, 'method', e.target.value)}
                                            className="w-full p-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-50 outline-none font-bold"
                                        >
                                            <option value="multiply">ارز پایه × نرخ = {code} (ارز ضعیف‌تر)</option>
                                            <option value="divide">ارز پایه ÷ نرخ = {code} (ارز قوی‌تر)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex justify-end pt-4">
                <button type="submit" className="w-full md:w-auto px-10 py-4 rounded-2xl bg-blue-600 text-white font-black text-lg shadow-xl shadow-blue-100 btn-primary active:scale-[0.98]">
                    ذخیره تمام تنظیمات شخصی‌سازی
                </button>
            </div>
        </form>
    );
};


const ServicesTab: React.FC<TabProps> = ({ showToast }) => {
    const { services, addService, deleteService, storeSettings } = useAppContext();
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');

    const handleAddService = () => {
        if (!name.trim() || !price || Number(price) <= 0) {
            showToast("لطفاً نام و قیمت معتبر برای خدمت وارد کنید.");
            return;
        }
        addService({ name: name.trim(), price: Number(price) });
        setName('');
        setPrice('');
        showToast("خدمت جدید با موفقیت اضافه شد.");
    };

    return (
        <div className="max-w-4xl mx-auto">
            <h3 className="text-xl font-bold text-slate-800 border-b pb-3 mb-6 hidden md:block">تعریف خدمات</h3>
            
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 mb-8">
                <p className="text-xs font-black text-slate-500 mb-4 uppercase tracking-wider">افزودن خدمت جدید</p>
                <div className="flex flex-col md:flex-row gap-3">
                    <input value={name} onChange={e => setName(e.target.value)} placeholder="نام خدمت (مثال: فتوکپی)" className="flex-grow p-3.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-50 outline-none transition-all" />
                    <input value={price} onChange={e => setPrice(toEnglishDigits(e.target.value).replace(/[^0-9]/g, ''))} type="text" inputMode="numeric" placeholder={`قیمت (${storeSettings.currencyName})`} className="md:w-48 p-3.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-50 outline-none transition-all font-bold" />
                    <button onClick={handleAddService} className="flex items-center justify-center bg-blue-600 text-white px-6 py-3.5 rounded-xl shadow-lg shadow-blue-100 btn-primary active:scale-[0.98]">
                        <PlusIcon className="w-5 h-5 ml-2" /> <span className="font-bold">افزودن</span>
                    </button>
                </div>
            </div>

            <div className="space-y-3">
                {services.map(service => (
                    <div key={service.id} className="flex justify-between items-center p-4 bg-white rounded-2xl shadow-sm border border-slate-100 hover:border-blue-200 transition-all">
                        <div>
                            <p className="font-black text-slate-800 text-lg">{service.name}</p>
                            <p className="text-sm text-blue-600 font-bold">{formatCurrency(service.price, storeSettings)}</p>
                        </div>
                        <button onClick={() => deleteService(service.id)} className="p-3 rounded-xl text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors">
                           <TrashIcon className="w-6 h-6" />
                        </button>
                    </div>
                ))}
                {services.length === 0 && (
                    <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-3xl">
                        <p className="text-slate-400 font-bold">هنوز خدمتی تعریف نکرده‌اید.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const BackupRestoreTab: React.FC<TabProps> = ({ showToast }) => {
    const { 
        exportData, importData, cloudBackup, cloudRestore, 
        autoBackupEnabled, setAutoBackupEnabled 
    } = useAppContext();
    
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            importData(file);
        }
        event.target.value = '';
    };

    const handleCloudBackup = async () => {
        setIsProcessing(true);
        await cloudBackup();
        setIsProcessing(false);
    };

    const handleCloudRestore = async () => {
        setIsProcessing(true);
        await cloudRestore();
        setIsProcessing(false);
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-10">
            {/* Local Section */}
            <div className="bg-white p-5 md:p-8 rounded-3xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><DownloadIcon className="w-6 h-6" /></div>
                    <h3 className="text-xl font-black text-slate-800">پشتیبان‌گیری محلی</h3>
                </div>
                <p className="text-sm text-slate-500 mb-6 leading-relaxed font-medium">این گزینه یک فایل حاوی تمام اطلاعات فروشگاه شما را دانلود می‌کند. آن را در جای امنی نگه دارید.</p>
                
                <div className="flex flex-col md:flex-row gap-3">
                    <button onClick={exportData} className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-blue-600 text-white font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 active:scale-[0.98]">
                        <DownloadIcon className="w-5 h-5"/>
                        دانلود فایل نسخه پشتیبان
                    </button>
                    <button onClick={handleImportClick} className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-slate-100 text-slate-700 font-black hover:bg-slate-200 transition-all active:scale-[0.98]">
                        <UploadIcon className="w-5 h-5"/>
                        بازیابی از فایل قبلی
                    </button>
                    <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                </div>
            </div>

            {/* Cloud Section */}
            <div className="bg-gradient-to-br from-indigo-50 to-white p-5 md:p-8 rounded-3xl shadow-sm border border-indigo-100">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                         <div className="p-3 bg-indigo-100 text-indigo-700 rounded-2xl"><UploadIcon className="w-6 h-6" /></div>
                         <h3 className="text-xl font-black text-indigo-900">پشتیبان‌گیری ابری</h3>
                    </div>
                     <span className={`text-[10px] px-2 py-1 rounded-full font-black ${navigator.onLine ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {navigator.onLine ? 'متصل' : 'آفلاین'}
                    </span>
                </div>
                <p className="text-sm text-slate-500 mb-6 leading-relaxed font-medium">اطلاعات شما را در سرور مرکزی کاسب‌یار ذخیره می‌کند تا از هر دستگاهی به آن دسترسی داشته باشید.</p>
                
                <div className="flex flex-col md:flex-row gap-3">
                    <button 
                        onClick={handleCloudBackup} 
                        disabled={isProcessing || !navigator.onLine}
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-indigo-600 text-white font-black shadow-lg shadow-indigo-100 active:scale-[0.98] disabled:bg-slate-400"
                    >
                        {isProcessing ? 'درحال انجام...' : 'ذخیره فوری در ابر'}
                    </button>
                    <button 
                        onClick={handleCloudRestore}
                        disabled={isProcessing || !navigator.onLine}
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-white border-2 border-indigo-200 text-indigo-600 font-black hover:bg-indigo-50 active:scale-[0.98] disabled:opacity-50"
                    >
                        بازیابی آخرین نسخه ابری
                    </button>
                </div>

                <div className="mt-8 pt-6 border-t border-indigo-100 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                         <div className={`w-14 h-8 rounded-full p-1 cursor-pointer transition-all duration-300 ${autoBackupEnabled ? 'bg-green-500' : 'bg-slate-300'}`} onClick={() => setAutoBackupEnabled(!autoBackupEnabled)}>
                            <div className={`bg-white w-6 h-6 rounded-full shadow-md transition-all duration-300 ${autoBackupEnabled ? 'mr-6' : 'mr-0'}`}></div>
                        </div>
                        <div>
                            <p className="font-black text-slate-800 text-sm">پشتیبان‌گیری هوشمند ۲۴ ساعته</p>
                            <p className="text-[10px] text-slate-500 font-bold">ذخیره خودکار در ابر و حافظه دستگاه هر روز</p>
                        </div>
                    </div>
                </div>
            </div>

             <div className="p-4 bg-red-50 border-r-4 border-red-500 rounded-l-2xl flex gap-3">
                <WarningIcon className="w-6 h-6 text-red-600 shrink-0" />
                <p className="text-xs font-bold text-red-800 leading-relaxed">هشدار: عملیات بازیابی (Restore) تمام اطلاعات فعلی برنامه را پاک کرده و نسخه پشتیبان را جایگزین می‌کند. لطفاً قبل از انجام آن دقت کنید.</p>
            </div>
        </div>
    );
};

const UsersAndRolesTab: React.FC<TabProps> = ({ showToast }) => {
    const { users, roles, addUser, updateUser, deleteUser, addRole, updateRole, deleteRole, currentUser } = useAppContext();
    const [activeSubTab, setActiveSubTab] = useState<'users' | 'roles'>('users');
    
    // Role state
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [roleName, setRoleName] = useState('');
    const [rolePermissions, setRolePermissions] = useState<Permission[]>([]);

    // User state
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [userRoleId, setUserRoleId] = useState('');
    
    const groupedPermissions = groupPermissions(ALL_PERMISSIONS);
    
    const handleEditRole = (role: Role) => {
        // Prevent editing the core Admin system role for security
        if (role.id === 'admin-role') {
            showToast("⚠️ نقش مدیریت کل سیستم غیرقابل تغییر است.");
            return;
        }
        setEditingRole(role);
        setRoleName(role.name);
        setRolePermissions(role.permissions || []);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSaveRole = async () => {
        if (!roleName) { showToast("نام نقش نمی‌تواند خالی باشد."); return; }
        const result = await (editingRole 
            ? updateRole({ ...editingRole, name: roleName, permissions: rolePermissions })
            : addRole({ name: roleName, permissions: rolePermissions }));
        
        showToast(result.message);
        if(result.success) {
            setEditingRole(null);
            setRoleName('');
            setRolePermissions([]);
        }
    };
    
    const handlePermissionChange = (permissionId: string, checked: boolean) => {
        setRolePermissions(prev => checked ? [...prev, permissionId] : prev.filter(p => p !== permissionId));
    };

    const handleEditUser = (user: User) => {
        setEditingUser(user);
        setUsername(user.username);
        setUserRoleId(user.roleId);
        setPassword('');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    
    const handleSaveUser = async () => {
        if(!username || !userRoleId || (!editingUser && !password)) {
            showToast("لطفا تمام فیلدها را پر کنید.");
            return;
        }
        const result = await (editingUser
            ? updateUser({ id: editingUser.id, username, roleId: userRoleId, password: password || undefined })
            : addUser({ username, password, roleId: userRoleId }));

        showToast(result.message);
        if(result.success) {
            setEditingUser(null);
            setUsername('');
            setPassword('');
            setUserRoleId('');
        }
    };
    

    return (
        <div className="max-w-5xl mx-auto pb-10">
            <div className="flex p-1.5 bg-slate-100 rounded-2xl mb-8">
                <button 
                    onClick={() => setActiveSubTab('users')} 
                    className={`flex-1 py-3.5 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 ${activeSubTab === 'users' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500'}`}
                >
                    <UserGroupIcon className="w-5 h-5"/> مدیریت کاربران
                </button>
                <button 
                    onClick={() => setActiveSubTab('roles')} 
                    className={`flex-1 py-3.5 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 ${activeSubTab === 'roles' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500'}`}
                >
                    <KeyIcon className="w-5 h-5"/> مدیریت نقش‌ها
                </button>
            </div>

            {activeSubTab === 'users' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="bg-white p-5 md:p-6 rounded-3xl border border-slate-200">
                        <h4 className="text-lg font-black text-slate-800 mb-6">{editingUser ? 'ویرایش کاربر' : 'افزودن کاربر جدید'}</h4>
                        <div className="space-y-4">
                            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="نام کاربری" className="w-full p-3.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-50 outline-none font-bold" />
                            <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder={editingUser ? 'رمز عبور جدید (اختیاری)' : 'رمز عبور'} className="w-full p-3.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-50 outline-none" />
                            <select value={userRoleId} onChange={e => setUserRoleId(e.target.value)} className="w-full p-3.5 border border-slate-200 rounded-xl bg-white focus:ring-4 focus:ring-blue-50 outline-none font-bold">
                                <option value="">-- انتخاب نقش --</option>
                                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                            <div className="flex gap-2 pt-2">
                                <button onClick={handleSaveUser} className="flex-grow py-4 rounded-xl bg-blue-600 text-white font-black text-lg shadow-xl shadow-blue-100 btn-primary active:scale-[0.98]">{editingUser ? 'بروزرسانی' : 'افزودن کاربر'}</button>
                                {editingUser && <button onClick={() => setEditingUser(null)} className="px-6 rounded-xl bg-slate-100 text-slate-500 font-bold">لغو</button>}
                            </div>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <h4 className="text-lg font-black text-slate-400 mb-2 px-2 uppercase tracking-tighter">لیست کاربران سیستم</h4>
                        {users.map(user => (
                            <div key={user.id} className="flex justify-between items-center p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                <div>
                                    <p className="font-black text-slate-800">{user.username}</p>
                                    <p className="text-[10px] text-blue-500 font-bold bg-blue-50 px-2 py-0.5 rounded-full inline-block mt-1">{roles.find(r => r.id === user.roleId)?.name}</p>
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => handleEditUser(user)} className="p-2.5 rounded-xl bg-slate-50 text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                                        <KeyIcon className="w-5 h-5" />
                                    </button>
                                    {user.username !== 'admin' && user.id !== currentUser?.id && (
                                        <button onClick={() => deleteUser(user.id)} className="p-2.5 rounded-xl bg-slate-50 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeSubTab === 'roles' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-5 md:p-6 rounded-3xl border border-slate-200">
                        <h4 className="text-lg font-black text-slate-800 mb-6">{editingRole ? 'ویرایش نقش و دسترسی' : 'تعریف نقش جدید'}</h4>
                        <div className="space-y-4">
                            <input 
                                value={roleName} 
                                onChange={e => setRoleName(e.target.value)} 
                                placeholder="نام نقش (مثلاً: فروشنده)" 
                                className="w-full p-3.5 border border-slate-200 rounded-xl mb-2 focus:ring-4 focus:ring-blue-50 outline-none font-black" 
                                disabled={editingRole?.id === 'admin-role'}
                            />
                            
                            <p className="text-xs font-black text-slate-400 mb-4 px-1">انتخاب مجوزهای دسترسی:</p>
                            <div className="space-y-4 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                                {Object.entries(groupedPermissions).map(([group, permissions]) => (
                                    <div key={group} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                        <h5 className="font-black text-slate-700 border-b border-slate-200 pb-2 mb-3 text-sm">{group}</h5>
                                        <div className="space-y-2">
                                            {permissions.map(p => (
                                                <label key={p.id} className={`flex items-center gap-3 p-2 rounded-xl transition-colors group ${editingRole?.id === 'admin-role' ? 'opacity-60 cursor-not-allowed' : 'hover:bg-white cursor-pointer'}`}>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={editingRole?.id === 'admin-role' ? true : rolePermissions.includes(p.id)} 
                                                        onChange={e => handlePermissionChange(p.id, e.target.checked)} 
                                                        className="w-5 h-5 rounded-lg text-blue-600 border-slate-300 focus:ring-blue-500"
                                                        disabled={editingRole?.id === 'admin-role'}
                                                    />
                                                    <span className="text-sm font-bold text-slate-600 group-hover:text-slate-900">{p.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                             <div className="flex gap-2 mt-6">
                                <button 
                                    onClick={handleSaveRole} 
                                    className={`flex-grow py-4 rounded-xl font-black text-lg shadow-xl shadow-blue-100 transition-all active:scale-[0.98] ${editingRole?.id === 'admin-role' ? 'bg-slate-300 cursor-not-allowed' : 'bg-blue-600 text-white btn-primary'}`}
                                    disabled={editingRole?.id === 'admin-role'}
                                >
                                    {editingRole ? 'بروزرسانی نهایی' : 'ذخیره نقش'}
                                </button>
                                {editingRole && <button onClick={() => {setEditingRole(null); setRoleName(''); setRolePermissions([]);}} className="px-6 rounded-xl bg-slate-100 text-slate-500 font-bold">لغو</button>}
                            </div>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <h4 className="text-lg font-black text-slate-400 mb-2 px-2 uppercase tracking-tighter">لیست نقش‌های تعریف شده</h4>
                        {roles.map(role => (
                            <div key={role.id} className="flex justify-between items-center p-4 bg-white rounded-2xl border border-slate-100 shadow-sm group">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${role.id === 'admin-role' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500'}`}>
                                        <KeyIcon className="w-5 h-5"/>
                                    </div>
                                    <p className="font-black text-slate-800">{role.name}</p>
                                </div>
                                <div className="flex gap-1">
                                    {role.id !== 'admin-role' ? (
                                        <>
                                            <button onClick={() => handleEditRole(role)} className="p-2.5 rounded-xl bg-slate-50 text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-colors text-sm font-bold">
                                                مدیریت دسترسی
                                            </button>
                                            <button onClick={() => deleteRole(role.id)} className="p-2.5 rounded-xl bg-slate-50 text-red-400 hover:bg-red-50 transition-colors">
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        </>
                                    ) : (
                                        <span className="text-[10px] font-black text-blue-500 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">نقش سیستمی</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};


const Settings: React.FC = () => {
    const { hasPermission } = useAppContext();
    const [activeTab, setActiveTab] = useState('storeDetails');
    const [toast, setToast] = useState('');

    const showToast = (message: string) => {
        setToast(message);
        setTimeout(() => setToast(''), 3000);
    };

    const tabs = [
        { id: 'storeDetails', label: 'فروشگاه', permission: 'settings:manage_store', icon: <UserGroupIcon className="w-5 h-5"/> },
        { id: 'alerts', label: 'هشدارها', permission: 'settings:manage_alerts', icon: <WarningIcon className="w-5 h-5"/> },
        { id: 'customization', label: 'شخصی‌سازی', permission: 'settings:manage_store', icon: <SettingsIcon className="w-5 h-5"/> },
        { id: 'services', label: 'خدمات', permission: 'settings:manage_services', icon: <PlusIcon className="w-5 h-5"/> },
        { id: 'usersAndRoles', label: 'کاربران', permission: 'settings:manage_users', icon: <UserGroupIcon className="w-5 h-5"/> },
        { id: 'backup', label: 'پشتیبان‌گیری', permission: 'settings:manage_backup', icon: <UploadIcon className="w-5 h-5"/> },
    ];
    
    const accessibleTabs = tabs.filter(tab => hasPermission(tab.permission));

    const renderContent = () => {
        switch (activeTab) {
            case 'storeDetails': return <StoreDetailsTab showToast={showToast} />;
            case 'alerts': return <AlertsTab showToast={showToast} />;
            case 'customization': return <CustomizationTab showToast={showToast} />;
            case 'services': return <ServicesTab showToast={showToast} />;
            case 'backup': return <BackupRestoreTab showToast={showToast} />;
            case 'usersAndRoles': return <UsersAndRolesTab showToast={showToast} />;
            default: return <StoreDetailsTab showToast={showToast} />;
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
            {toast && <Toast message={toast} onClose={() => setToast('')} />}
            <h1 className="text-3xl md:text-4xl font-black text-slate-800 mb-8">مرکز فرماندهی</h1>

            <div className="bg-white rounded-3xl shadow-xl border border-gray-200/60 overflow-hidden flex flex-col min-h-[65vh]">
                <div className="flex border-b border-gray-200/60 p-3 bg-slate-50/50 sticky top-0 z-20 overflow-x-auto no-scrollbar snap-x rounded-t-3xl">
                    <div className="flex gap-2 w-full min-w-max">
                        {accessibleTabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 py-3 px-6 font-black text-sm md:text-lg rounded-2xl transition-all duration-300 snap-start ${
                                    activeTab === tab.id
                                        ? 'bg-blue-600 shadow-xl shadow-blue-200 text-white translate-y-[-2px]'
                                        : 'text-slate-500 hover:bg-white/80 hover:text-blue-600'
                                }`}
                            >
                                <span className={`${activeTab === tab.id ? 'text-white' : 'text-slate-400'}`}>{tab.icon}</span>
                                <span className="whitespace-nowrap">{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-5 md:p-10 flex-grow bg-white">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};

export default Settings;