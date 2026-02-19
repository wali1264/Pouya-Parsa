import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Product, ActivityLog, InvoiceItem, StoreSettings } from '../types';
import { useAppContext } from '../AppContext';
import { POSIcon, InventoryIcon, PurchaseIcon, WarningIcon, BellIcon, UserGroupIcon, EyeIcon, XIcon, ChevronDownIcon, CheckIcon } from '../components/icons';
import { formatCurrency, formatStockToPackagesAndUnits } from '../utils/formatters';
import DateRangeFilter from '../components/DateRangeFilter';
import ActivityDetailModal from '../components/ActivityDetailModal';

// Enhanced StatCard with Glassmorphism for Mobile/Desktop
const StatCard: React.FC<{ title: string; value: string; description: string; color: string, icon: React.ReactNode, onDetailClick?: () => void }> = ({ title, value, description, color, icon, onDetailClick }) => (
    <div className="bg-white/60 backdrop-blur-xl p-6 rounded-2xl shadow-lg border border-gray-200/60 flex flex-col justify-between transform transition-all duration-300 md:hover:-translate-y-2 h-full relative group snap-center min-w-[85vw] md:min-w-0">
        <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-semibold text-slate-700">{title}</h3>
            <div className={`p-2 rounded-full bg-opacity-20 ${color.replace('text-', 'bg-')}`}>{icon}</div>
        </div>
        <div className="mb-4">
            <p className={`text-4xl lg:text-5xl font-extrabold my-2 ${color}`}>{value}</p>
            <p className="text-md text-slate-500">{description}</p>
        </div>
        
        {onDetailClick && (
            <button 
                onClick={(e) => { 
                    e.stopPropagation(); 
                    onDetailClick(); 
                }} 
                className="absolute bottom-4 left-4 z-20 p-2 bg-white hover:bg-blue-50 text-slate-500 hover:text-blue-600 rounded-lg shadow-sm border border-slate-200 transition-all duration-200 flex items-center justify-center active:scale-90" 
                title="مشاهده جزئیات"
            >
                <EyeIcon className="w-5 h-5" />
            </button>
        )}
    </div>
);

// Mobile Bottom Sheet for Alerts
const MobileAlertDrawer: React.FC<{ 
    isOpen: boolean, 
    onClose: () => void, 
    lowStock: any[], 
    expiring: any[],
    settings: StoreSettings
}> = ({ isOpen, onClose, lowStock, expiring, settings }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] md:hidden flex items-end justify-center">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
            <div className="bg-white w-full rounded-t-3xl shadow-2xl z-10 max-h-[85vh] flex flex-col animate-slide-up-mobile overflow-hidden">
                <style>{`
                    @keyframes slide-up-mobile {
                        from { transform: translateY(100%); }
                        to { transform: translateY(0); }
                    }
                    .animate-slide-up-mobile { animation: slide-up-mobile 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
                `}</style>
                <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mt-3 mb-2"></div>
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="font-bold text-xl text-slate-800">وضعیت انبار و انقضا</h3>
                    <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-500"><XIcon className="w-5 h-5" /></button>
                </div>
                <div className="flex-grow overflow-y-auto p-4 space-y-6 pb-10">
                    {lowStock.length > 0 && (
                        <div>
                            <h4 className="flex items-center gap-2 font-bold text-amber-700 mb-3 text-lg">
                                <WarningIcon className="w-5 h-5" /> کالاهای رو به اتمام
                            </h4>
                            <div className="space-y-2">
                                {lowStock.map(p => (
                                    <div key={p.id} className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex justify-between">
                                        <span className="font-semibold text-slate-700">{p.name}</span>
                                        <span className="font-bold text-amber-800">{formatStockToPackagesAndUnits(p.totalStock, settings, p.itemsPerPackage)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {expiring.length > 0 && (
                        <div>
                            <h4 className="flex items-center gap-2 font-bold text-red-700 mb-3 text-lg">
                                <WarningIcon className="w-5 h-5" /> تاریخ انقضا نزدیک
                            </h4>
                            <div className="space-y-2">
                                {expiring.map(p => (
                                    <div key={p.id + p.lotNumber} className="p-3 bg-red-50 rounded-xl border border-red-100 flex justify-between">
                                        <div>
                                            <p className="font-semibold text-slate-700">{p.name}</p>
                                            <p className="text-[10px] text-slate-400 font-mono">Lot: {p.lotNumber}</p>
                                        </div>
                                        <span className="font-bold text-red-800 text-sm">{new Date(p.expiryDate!).toLocaleDateString('fa-IR')}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {lowStock.length === 0 && expiring.length === 0 && (
                        <div className="text-center py-10">
                            <CheckIcon className="w-12 h-12 text-green-500 mx-auto mb-3" />
                            <p className="font-bold text-slate-600">تمام کالاها در وضعیت مطلوب هستند.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const AlertCard: React.FC<{ title: string, items: { id: string, name: string, stock: number, expiryDate?: string, itemsPerPackage?: number }[], color: string, type: 'stock' | 'expiry', settings: StoreSettings }> = ({ title, items, color, type, settings }) => (
    <div className={`p-4 rounded-xl bg-${color}-100/70 border-r-4 border-${color}-500`}>
        <div className="flex items-center">
            <WarningIcon className={`w-6 h-6 text-${color}-600 mr-3`} />
            <h3 className={`text-lg font-bold text-${color}-800`}>{title} ({items.length})</h3>
        </div>
        {items.length > 0 && (
            <ul className="mt-2 list-disc list-inside text-sm text-${color}-700 pr-4 max-h-24 overflow-y-auto">
                {items.slice(0, 5).map(p => (
                    <li key={p.id + (p as any).lotNumber}>
                        {p.name} 
                        {type === 'stock' ? ` (موجودی: ${formatStockToPackagesAndUnits(p.stock, settings, p.itemsPerPackage)})` : ` (انقضا: ${new Date(p.expiryDate!).toLocaleDateString('fa-IR')})`}
                    </li>
                ))}
                {items.length > 5 && <li>و {items.length - 5} مورد دیگر...</li>}
            </ul>
        )}
    </div>
);

const Dashboard: React.FC = () => {
    const { saleInvoices, purchaseInvoices, activities, products, storeSettings, currentUser, customers } = useAppContext();
    const [dateRange, setDateRange] = useState<{ start: Date, end: Date }>({ start: new Date(), end: new Date() });
    const [isAlertsOpen, setIsAlertsOpen] = useState(false);
    const [isMobileAlertsOpen, setIsMobileAlertsOpen] = useState(false);
    const alertsRef = useRef<HTMLDivElement>(null);
    const [viewingActivity, setViewingActivity] = useState<ActivityLog | null>(null);
    const [isCreditDetailsOpen, setIsCreditDetailsOpen] = useState(false);
    const [expandedInvoiceIds, setExpandedInvoiceIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (alertsRef.current && !alertsRef.current.contains(event.target as Node)) {
                setIsAlertsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const { totalSalesToday, totalCreditSalesToday, todayCreditInvoices } = useMemo(() => {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

        const todayInvoices = saleInvoices.filter(inv => {
            const invTime = new Date(inv.timestamp).getTime();
            return invTime >= startOfDay && invTime <= endOfDay;
        });

        const sales = todayInvoices.filter(inv => inv.type === 'sale').reduce((sum, inv) => sum + inv.totalAmount, 0);
        const returns = todayInvoices.filter(inv => inv.type === 'return').reduce((sum, inv) => sum + inv.totalAmount, 0);
        const creditInvoices = todayInvoices.filter(inv => inv.customerId && inv.type === 'sale');
        const creditSales = creditInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
            
        return { 
            totalSalesToday: sales - returns, 
            totalCreditSalesToday: creditSales,
            todayCreditInvoices: creditInvoices.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        };
    }, [saleInvoices]);

    const productsWithTotalStock = products.map(p => ({
        ...p,
        totalStock: p.batches.reduce((sum, b) => sum + b.stock, 0)
    }));

    const lowStockProducts = productsWithTotalStock.filter(p => p.totalStock > 0 && p.totalStock <= storeSettings.lowStockThreshold);
    const expiringSoonProducts = products.flatMap(p => 
        p.batches
         .filter(b => {
            if (!b.expiryDate) return false;
            const expiry = new Date(b.expiryDate);
            const thresholdDate = new Date();
            thresholdDate.setMonth(thresholdDate.getMonth() + storeSettings.expiryThresholdMonths);
            return expiry <= thresholdDate && expiry > new Date();
         })
         .map(b => ({ ...p, lotNumber: b.lotNumber, stock: b.stock, expiryDate: b.expiryDate }))
    );

    const totalAlerts = lowStockProducts.length + expiringSoonProducts.length;

    const filteredActivities = useMemo(() => {
        if (!dateRange.start || !dateRange.end) return [];
        const startTime = dateRange.start.getTime();
        const endTime = dateRange.end.getTime();

        return activities.filter(activity => {
            const activityTime = new Date(activity.timestamp).getTime();
            return activityTime >= startTime && activityTime <= endTime;
        });
    }, [activities, dateRange]);

    const toggleInvoiceDetails = (id: string) => {
        const newSet = new Set(expandedInvoiceIds);
        if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
        setExpandedInvoiceIds(newSet);
    };

  return (
    <div className="p-4 md:p-8 max-7xl mx-auto">
      {viewingActivity && <ActivityDetailModal activity={viewingActivity} onClose={() => setViewingActivity(null)} />}
      <MobileAlertDrawer 
        isOpen={isMobileAlertsOpen} 
        onClose={() => setIsMobileAlertsOpen(false)} 
        lowStock={lowStockProducts} 
        expiring={expiringSoonProducts} 
        settings={storeSettings}
      />
      
      {isCreditDetailsOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 modal-animate">
            <div className="bg-white/95 backdrop-blur-xl p-0 rounded-2xl shadow-2xl border border-gray-200/80 w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
                <div className="flex justify-between items-center p-4 border-b bg-slate-50">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <UserGroupIcon className="w-5 h-5 text-orange-600" />
                        جزئیات فروش نسیه امروز
                    </h3>
                    <button onClick={() => setIsCreditDetailsOpen(false)} className="p-1.5 rounded-full bg-white text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors border"><XIcon className="w-5 h-5" /></button>
                </div>
                <div className="flex-grow overflow-y-auto p-4 space-y-3">
                    {todayCreditInvoices.length > 0 ? todayCreditInvoices.map(inv => {
                        const customer = customers.find(c => c.id === inv.customerId);
                        const isExpanded = expandedInvoiceIds.has(inv.id);
                        return (
                            <div key={inv.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-200 hover:border-blue-300">
                                <div 
                                    onClick={() => toggleInvoiceDetails(inv.id)}
                                    className="p-3 cursor-pointer hover:bg-slate-50 flex flex-col gap-2"
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-2">
                                            <ChevronDownIcon className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                                            <p className="font-bold text-slate-800 text-lg">{customer?.name || 'مشتری نامشخص'}</p>
                                        </div>
                                        <span className="font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-lg border border-orange-100">{formatCurrency(inv.totalAmount, storeSettings)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs text-slate-500 border-t border-dashed border-slate-200 pt-2 mt-1">
                                        <span>ثبت کننده: <span className="font-semibold text-slate-700">{inv.cashier}</span></span>
                                        <span>{new Date(inv.timestamp).toLocaleTimeString('fa-IR', {hour: '2-digit', minute:'2-digit'})}</span>
                                    </div>
                                </div>
                                {isExpanded && (
                                    <div className="bg-slate-50 border-t border-slate-100 p-3 text-sm animate-fade-in">
                                        <style>{`@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } } .animate-fade-in { animation: fade-in 0.2s ease-out forwards; }`}</style>
                                        <p className="text-xs font-bold text-slate-500 mb-2">اقلام فاکتور:</p>
                                        <ul className="space-y-2">
                                            {inv.items.map((item, idx) => {
                                                const price = item.type === 'product' ? (item.finalPrice ?? item.salePrice) : item.price;
                                                const total = price * item.quantity;
                                                const qtyDisplay = item.type === 'product' ? formatStockToPackagesAndUnits(item.quantity, storeSettings, (item as InvoiceItem).itemsPerPackage || 1) : `${item.quantity} عدد`;
                                                return (
                                                    <li key={idx} className="flex justify-between items-center border-b border-slate-200 last:border-0 pb-2 last:pb-0">
                                                        <span className="text-slate-700 font-medium">{item.name}</span>
                                                        <div className="flex items-center gap-3 text-xs">
                                                            <span className="text-slate-500 bg-white px-2 py-0.5 rounded border shadow-sm">{qtyDisplay}</span>
                                                            <span className="font-bold text-slate-800 w-20 text-left" dir="ltr">{formatCurrency(total, storeSettings)}</span>
                                                        </div>
                                                    </li>
                                                )
                                            })}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )
                    }) : (
                        <div className="text-center py-10 flex flex-col items-center text-slate-400">
                            <UserGroupIcon className="w-12 h-12 mb-2 opacity-50" />
                            <p>هیچ فروش نسیه‌ای برای امروز ثبت نشده است.</p>
                        </div>
                    )}
                </div>
                <div className="p-4 bg-slate-50 border-t flex justify-between items-center">
                    <span className="font-semibold text-slate-600">مجموع کل:</span>
                    <span className="font-bold text-xl text-slate-800">{formatCurrency(totalCreditSalesToday, storeSettings)}</span>
                </div>
            </div>
        </div>
      )}

      {/* Header with Welcome and Desktop Alerts */}
      <div className="flex justify-between items-start mb-6 md:mb-10">
        <div>
            <h1 className="text-2xl md:text-4xl mb-2 font-black text-slate-800">داشبورد مدیریتی</h1>
            <p className="text-md md:text-lg text-slate-500 font-medium">خوش آمدید، {currentUser?.username}!</p>
        </div>
        <div className="relative hidden md:block" ref={alertsRef}>
            <button onClick={() => setIsAlertsOpen(prev => !prev)} className="p-3 rounded-full hover:bg-slate-200/50 transition-colors relative group">
                <BellIcon className="w-8 h-8 text-slate-600 group-hover:text-blue-600 transition-colors"/>
                {totalAlerts > 0 && (
                    <span className="absolute top-1 right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse border-2 border-white">
                        {totalAlerts}
                    </span>
                )}
            </button>
            {isAlertsOpen && (
                <div className="absolute left-0 mt-2 w-80 bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/60 z-20 p-4 max-h-96 overflow-y-auto">
                    <h3 className="font-bold text-slate-800 text-lg mb-3 pb-2 border-b">مرکز هشدارها</h3>
                    {totalAlerts === 0 ? <p className="text-center text-slate-500 py-4">هیچ هشدار فعالی وجود ندارد.</p> : (
                        <div className="space-y-4">
                            {lowStockProducts.length > 0 && (
                                <div>
                                    <h4 className="font-semibold text-amber-700 mb-2">کالاهای رو به اتمام</h4>
                                    <ul className="space-y-1 text-sm">
                                        {lowStockProducts.map(p => (
                                            <li key={p.id} className="flex justify-between p-1.5 bg-amber-50/70 rounded">
                                                <span>{p.name}</span>
                                                <span className="font-bold">{formatStockToPackagesAndUnits(p.totalStock, storeSettings, p.itemsPerPackage)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {expiringSoonProducts.length > 0 && (
                                <div>
                                    <h4 className="font-semibold text-red-700 mb-2">کالاهای با انقضای نزدیک</h4>
                                     <ul className="space-y-1 text-sm">
                                        {expiringSoonProducts.map(p => (
                                            <li key={p.id + p.lotNumber} className="flex justify-between p-1.5 bg-red-50/70 rounded">
                                                <span>{p.name}</span>
                                                <span className="font-bold">{new Date(p.expiryDate!).toLocaleDateString('fa-IR')}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
      </div>

       {/* Mobile Health Bar */}
       <button 
           onClick={() => setIsMobileAlertsOpen(true)}
           className={`md:hidden w-full p-4 mb-8 rounded-2xl flex items-center justify-between shadow-lg border-2 transition-all active:scale-95 ${
               totalAlerts > 0 ? 'bg-orange-50 border-orange-200 text-orange-800' : 'bg-green-50 border-green-200 text-green-800'
           }`}
       >
           <div className="flex items-center gap-3">
               <div className={`p-2.5 rounded-xl ${totalAlerts > 0 ? 'bg-orange-100' : 'bg-green-100'}`}>
                   {totalAlerts > 0 ? <WarningIcon className="w-6 h-6 text-orange-600" /> : <CheckIcon className="w-6 h-6 text-green-600" />}
               </div>
               <div className="text-right">
                   <p className="text-base font-black">{totalAlerts > 0 ? `${totalAlerts} هشدار انبار` : 'وضعیت انبار عالی است'}</p>
                   <p className="text-[11px] opacity-70 font-semibold">{totalAlerts > 0 ? 'نیاز به بررسی موجودی و انقضا' : 'موجودی و انقضا تحت کنترل است'}</p>
               </div>
           </div>
           <div className="bg-white/50 p-1 rounded-lg">
                <ChevronDownIcon className="w-5 h-5 opacity-40 rotate-180" />
           </div>
       </button>

       {/* Desktop Alert Cards */}
       <div className="hidden md:grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
          {lowStockProducts.length > 0 && <AlertCard title="کالاهای رو به اتمام" items={lowStockProducts.map(p => ({...p, stock: p.totalStock}))} color="amber" type="stock" settings={storeSettings} />}
          {expiringSoonProducts.length > 0 && <AlertCard title="کالاهای با انقضای نزدیک" items={expiringSoonProducts} color="red" type="expiry" settings={storeSettings} />}
       </div>
      
      {/* Vital Stats - Horizontal Carousel on Mobile, Grid on Desktop */}
      <div className="flex md:grid md:grid-cols-2 gap-4 md:gap-6 mb-10 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-4 -mx-4 px-4 md:mx-0 md:px-0">
        <StatCard 
            title="مجموع فروش امروز (خالص)" 
            value={totalSalesToday.toLocaleString('fa-IR', { maximumFractionDigits: 3 })} 
            description={storeSettings.currencyName} 
            color="text-blue-600" 
            icon={<POSIcon className="w-7 h-7 text-blue-600" />}
        />
        <StatCard 
            title="فروش نسیه امروز" 
            value={totalCreditSalesToday.toLocaleString('fa-IR', { maximumFractionDigits: 3 })} 
            description={storeSettings.currencyName} 
            color="text-orange-600" 
            icon={<UserGroupIcon className="w-7 h-7 text-orange-600" />}
            onDetailClick={() => setIsCreditDetailsOpen(true)}
        />
      </div>

      {/* Recent Activity Redesign */}
      <div className="bg-white/60 backdrop-blur-xl p-5 md:p-8 rounded-3xl shadow-xl border border-gray-200/60 mb-10">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <h3 className="font-black text-slate-800 text-xl md:text-2xl">آخرین فعالیت‌های فروشگاه</h3>
              <DateRangeFilter onFilterChange={(start, end) => setDateRange({ start, end })} />
          </div>
          
          <div className="space-y-4 max-h-[500px] overflow-y-auto no-scrollbar">
              {filteredActivities.length > 0 ? (
                  filteredActivities.map(activity => {
                      const isSale = activity.type === 'sale';
                      const isPurchase = activity.type === 'purchase';
                      const isInventory = activity.type === 'inventory';
                      
                      return (
                          <div 
                              key={activity.id} 
                              onClick={() => setViewingActivity(activity)} 
                              className="group flex items-center justify-between p-4 bg-white/70 hover:bg-white rounded-2xl border border-transparent hover:border-blue-200 hover:shadow-md cursor-pointer transition-all active:scale-[0.99]"
                          >
                              <div className="flex items-center gap-4">
                                  <div className={`p-3 rounded-xl transition-colors ${
                                      isSale ? 'bg-green-100 text-green-600' : 
                                      isPurchase ? 'bg-blue-100 text-blue-600' : 
                                      isInventory ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-600'
                                  }`}>
                                      {isSale ? <POSIcon className="w-6 h-6" /> : isPurchase ? <PurchaseIcon className="w-6 h-6" /> : <InventoryIcon className="w-6 h-6" />}
                                  </div>
                                  <div className="text-right">
                                      <p className="font-bold text-slate-700 md:text-lg group-hover:text-blue-700 transition-colors">{activity.description}</p>
                                      <div className="flex items-center gap-3 mt-1.5">
                                          <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{activity.user}</span>
                                          <span className="text-[11px] text-slate-400 font-medium">{new Date(activity.timestamp).toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'})}</span>
                                      </div>
                                  </div>
                              </div>
                              <div className="bg-slate-50 p-2 rounded-lg group-hover:bg-blue-50 transition-colors">
                                  <EyeIcon className="w-5 h-5 text-slate-300 group-hover:text-blue-500" />
                              </div>
                          </div>
                      );
                  })
              ) : (
                  <div className="text-center py-20 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
                      <div className="bg-slate-100 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                          <CheckIcon className="w-8 h-8 text-slate-300" />
                      </div>
                      <p className="text-slate-500 font-bold">در این بازه زمانی فعالیتی یافت نشد.</p>
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};

export default Dashboard;