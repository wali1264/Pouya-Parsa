
import React, { useState, useMemo } from 'react';
import { useAppContext } from '../AppContext';
import DateRangeFilter from '../components/DateRangeFilter';
import { formatCurrency } from '../utils/formatters';
import type { Product, SaleInvoice, User, Customer, Supplier, CustomerTransaction, SupplierTransaction } from '../types';
import TransactionHistoryModal from '../components/TransactionHistoryModal';
import { PrintIcon, WarningIcon, UserGroupIcon, InventoryIcon, AccountingIcon, POSIcon, ReportsIcon, DashboardIcon } from '../components/icons';
import ReportPrintPreviewModal from '../components/ReportPrintPreviewModal';

const Reports: React.FC = () => {
    const { 
        saleInvoices, products, expenses, users, activities, 
        customers, suppliers, customerTransactions, supplierTransactions, storeSettings, hasPermission
    } = useAppContext();

    const [activeTab, setActiveTab] = useState('sales');
    const [dateRange, setDateRange] = useState<{ start: Date, end: Date }>({ start: new Date(), end: new Date() });
    const [printModalContent, setPrintModalContent] = useState<{ title: string; content: React.ReactNode } | null>(null);

    // --- Calculations (Unified for both views) ---
    const salesData = useMemo(() => {
        const filteredInvoices = saleInvoices.filter(inv => {
            const invTime = new Date(inv.timestamp).getTime();
            return invTime >= dateRange.start.getTime() && invTime <= dateRange.end.getTime();
        });

        let grossRevenue = 0, returnsAmount = 0, totalDiscountsGiven = 0, totalCOGS = 0;

        filteredInvoices.forEach(inv => {
            if (inv.type === 'sale') {
                grossRevenue += inv.totalAmount;
                if (inv.totalDiscount > 0) totalDiscountsGiven += inv.totalDiscount;
                inv.items.forEach(item => { if (item.type === 'product') totalCOGS += (item.purchasePrice || 0) * item.quantity; });
            } else if (inv.type === 'return') {
                returnsAmount += inv.totalAmount;
                inv.items.forEach(item => { if (item.type === 'product') totalCOGS -= (item.purchasePrice || 0) * item.quantity; });
            }
        });

        const netSales = grossRevenue - returnsAmount;
        const totalExpenses = expenses.filter(exp => {
            const expTime = new Date(exp.date).getTime();
            return expTime >= dateRange.start.getTime() && expTime <= dateRange.end.getTime();
        }).reduce((sum, exp) => sum + exp.amount, 0);

        const grossProfit = netSales - totalCOGS;
        const netIncome = grossProfit - totalExpenses;

        const topProducts = filteredInvoices
            .flatMap(inv => inv.items)
            .filter(item => item.type === 'product')
            .reduce((acc, item) => {
                const existing = acc.find(p => p.id === item.id);
                const price = (item as any).finalPrice ?? (item as any).salePrice;
                if (existing) { existing.quantity += item.quantity; existing.totalValue += item.quantity * price; }
                else acc.push({ id: item.id, name: item.name, quantity: item.quantity, totalValue: item.quantity * price });
                return acc;
            }, [] as { id: string, name: string, quantity: number, totalValue: number }[])
            .sort((a, b) => b.totalValue - a.totalValue).slice(0, 10);

        return { netSales, totalDiscountsGiven, totalExpenses, netIncome, topProducts, returnsAmount, totalCOGS };
    }, [saleInvoices, expenses, dateRange]);

    const inventoryData = useMemo(() => {
        const totalValue = products.reduce((sum, p) => sum + p.batches.reduce((batchSum, b) => batchSum + (b.stock * b.purchasePrice), 0), 0);
        const totalItems = products.reduce((sum, p) => sum + p.batches.reduce((batchSum, b) => batchSum + b.stock, 0), 0);
        return { totalValue, totalItems };
    }, [products]);

    const financialPositionData = useMemo(() => {
        const invVal = products.reduce((sum, p) => sum + p.batches.reduce((bs, b) => bs + (b.stock * b.purchasePrice), 0), 0);
        const custRec = customers.reduce((sum, c) => sum + (c.balance > 0 ? c.balance : 0), 0);
        const suppPay = suppliers.reduce((sum, s) => sum + (s.balance > 0 ? s.balance : 0), 0);
        return { inventoryValue: invVal, customerReceivables: custRec, supplierPayables: suppPay, totalAssets: invVal + custRec, netCapital: (invVal + custRec) - suppPay };
    }, [products, customers, suppliers]);

    const collectionsData = useMemo(() => {
        const filtered = customerTransactions.filter(t => {
            const tTime = new Date(t.date).getTime();
            return t.type === 'payment' && tTime >= dateRange.start.getTime() && tTime <= dateRange.end.getTime();
        });
        return { 
            total: filtered.reduce((s, t) => s + t.amount, 0), 
            count: filtered.length,
            details: filtered.map(t => ({ ...t, customerName: customers.find(c => c.id === t.customerId)?.name || 'ناشناس' }))
        };
    }, [customerTransactions, dateRange, customers]);

    const tabs = [
        { id: 'sales', label: 'فروش و سود', icon: <POSIcon className="w-5 h-5"/> },
        { id: 'inventory', label: 'انبار', icon: <InventoryIcon className="w-5 h-5"/> },
        { id: 'financial_position', label: 'ترازنامه', icon: <AccountingIcon className="w-5 h-5"/> },
        { id: 'accounts', label: 'وصولی‌ها', icon: <UserGroupIcon className="w-5 h-5"/> },
        { id: 'employees', label: 'فعالیت‌ها', icon: <ReportsIcon className="w-5 h-5"/> },
    ];

    const SmartStatCard: React.FC<{ title: string, value: string, color: string, icon?: React.ReactNode }> = ({ title, value, color, icon }) => (
        <div className="bg-white/80 p-4 md:p-5 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col justify-center h-28 md:h-32 transition-all hover:shadow-md relative overflow-hidden group">
            {icon && <div className="absolute -left-2 -bottom-2 opacity-5 scale-150 transform group-hover:scale-[1.7] transition-transform duration-500 text-slate-900">{icon}</div>}
            <h4 className="text-xs md:text-md font-bold text-slate-500 mb-1 md:mb-2 truncate relative z-10">{title}</h4>
            <p className={`text-xl md:text-3xl font-black ${color} whitespace-nowrap overflow-hidden text-ellipsis relative z-10`} dir="ltr">{value}</p>
        </div>
    );

    const renderContent = () => {
        switch (activeTab) {
            case 'sales': 
                return (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <SmartStatCard title="فروش خالص" value={formatCurrency(salesData.netSales, storeSettings)} color="text-blue-600" icon={<POSIcon/>}/>
                            <SmartStatCard title="سود خالص" value={formatCurrency(salesData.netIncome, storeSettings)} color="text-green-600" icon={<DashboardIcon/>}/>
                            <SmartStatCard title="هزینه‌ها" value={formatCurrency(salesData.totalExpenses, storeSettings)} color="text-red-500" icon={<WarningIcon/>}/>
                            <SmartStatCard title="تخفیف‌ها" value={formatCurrency(salesData.totalDiscountsGiven, storeSettings)} color="text-amber-600" icon={<PrintIcon/>}/>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2"><div className="w-1 h-5 bg-blue-500 rounded-full"></div> پُرفروش‌ترین‌ها</h3>
                                <div className="space-y-3">
                                    {salesData.topProducts.map(p => (
                                        <div key={p.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl hover:bg-blue-50 transition-colors">
                                            <span className="font-bold text-slate-700 text-sm md:text-base">{p.name}</span>
                                            <div className="text-left">
                                                <p className="font-black text-blue-600 text-sm">{formatCurrency(p.totalValue, storeSettings)}</p>
                                                <p className="text-[10px] text-slate-400 font-bold">{p.quantity} عدد فروخته شده</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'inventory':
                return (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <SmartStatCard title="ارزش کل انبار" value={formatCurrency(inventoryData.totalValue, storeSettings)} color="text-indigo-600" icon={<InventoryIcon/>}/>
                            <SmartStatCard title="تعداد کل اقلام" value={`${inventoryData.totalItems} عدد`} color="text-slate-700" icon={<ReportsIcon/>}/>
                        </div>
                        {/* Desktop Table */}
                        <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden">
                            <table className="min-w-full text-center table-zebra">
                                <thead className="bg-slate-50 text-slate-600 font-bold">
                                    <tr><th className="p-4">نام محصول</th><th className="p-4">موجودی</th><th className="p-4">ارزش خرید</th></tr>
                                </thead>
                                <tbody>
                                    {products.map(p => (
                                        <tr key={p.id} className="border-t">
                                            <td className="p-4 font-bold text-slate-700">{p.name}</td>
                                            <td className="p-4">{p.batches.reduce((s,b)=>s+b.stock,0)}</td>
                                            <td className="p-4 font-mono">{formatCurrency(p.batches.reduce((s,b)=>s+(b.stock*b.purchasePrice),0), storeSettings)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {/* Mobile Cards */}
                        <div className="md:hidden space-y-3">
                            {products.map(p => {
                                const stock = p.batches.reduce((s,b)=>s+b.stock,0);
                                const val = p.batches.reduce((s,b)=>s+(b.stock*b.purchasePrice),0);
                                return (
                                    <div key={p.id} className="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center shadow-sm">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-800">{p.name}</span>
                                            <span className="text-[10px] text-slate-400 font-bold">موجودی: {stock} عدد</span>
                                        </div>
                                        <div className="text-left font-black text-indigo-600 text-sm" dir="ltr">{formatCurrency(val, storeSettings)}</div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                );
            case 'financial_position':
                return (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="space-y-4">
                                <h3 className="font-black text-green-700 flex items-center gap-2 px-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> دارایی‌های شما</h3>
                                <SmartStatCard title="ارزش کالاها" value={formatCurrency(financialPositionData.inventoryValue, storeSettings)} color="text-slate-800" />
                                <SmartStatCard title="طلب از مشتریان" value={formatCurrency(financialPositionData.customerReceivables, storeSettings)} color="text-slate-800" />
                            </div>
                            <div className="space-y-4">
                                <h3 className="font-black text-red-700 flex items-center gap-2 px-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> بدهی‌های شما</h3>
                                <SmartStatCard title="بدهی به تأمین‌کننده" value={formatCurrency(financialPositionData.supplierPayables, storeSettings)} color="text-red-600" />
                                <div className="h-28 md:h-32 bg-slate-50 border border-dashed border-slate-200 rounded-2xl flex items-center justify-center p-4 text-center">
                                    <p className="text-[10px] md:text-xs text-slate-400 font-bold leading-relaxed">سایر تعهدات مالی فروشگاه در این بخش محاسبه نشده است.</p>
                                </div>
                            </div>
                            <div className="flex flex-col justify-center">
                                <div className="bg-gradient-to-br from-blue-600 to-indigo-800 p-8 rounded-3xl shadow-xl text-white text-center transform transition-transform hover:scale-[1.02]">
                                    <h4 className="text-blue-100 font-bold mb-4 opacity-80 uppercase tracking-widest text-xs">سرمایه خالص واقعی</h4>
                                    <p className="text-3xl md:text-4xl font-black drop-shadow-md mb-2" dir="ltr">{formatCurrency(financialPositionData.netCapital, storeSettings)}</p>
                                    <div className="w-12 h-1 bg-white/30 mx-auto rounded-full mt-4 mb-2"></div>
                                    <p className="text-[10px] text-blue-200 font-medium">بر اساس قیمت خرید کالاها</p>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'accounts':
                return (
                    <div className="space-y-8">
                        <div>
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                                <h3 className="font-black text-slate-800 text-lg flex items-center gap-2"><div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div> مبالغ دریافتی از مشتریان (وصولی)</h3>
                                <div className="bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100">
                                    <span className="text-xs font-bold text-emerald-700">مجموع وصولی: {formatCurrency(collectionsData.total, storeSettings)}</span>
                                </div>
                            </div>
                            {/* Desktop Table */}
                            <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden">
                                <table className="min-w-full text-center table-zebra">
                                    <thead className="bg-slate-50 text-slate-600 font-bold">
                                        <tr><th className="p-4">مشتری</th><th className="p-4">مبلغ</th><th className="p-4">زمان</th><th className="p-4">توضیحات</th></tr>
                                    </thead>
                                    <tbody>
                                        {collectionsData.details.map(d => (
                                            <tr key={d.id} className="border-t">
                                                <td className="p-4 font-bold text-slate-800">{d.customerName}</td>
                                                <td className="p-4 text-emerald-600 font-black" dir="ltr">{formatCurrency(d.amount, storeSettings)}</td>
                                                <td className="p-4 text-sm text-slate-500">{new Date(d.date).toLocaleString('fa-IR')}</td>
                                                <td className="p-4 text-xs italic text-slate-400">{d.description}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {/* Mobile Cards */}
                            <div className="md:hidden space-y-3">
                                {collectionsData.details.map(d => (
                                    <div key={d.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-1 h-full bg-emerald-500"></div>
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-bold text-slate-800">{d.customerName}</span>
                                            <span className="text-[10px] text-slate-400 font-medium">{new Date(d.date).toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'})}</span>
                                        </div>
                                        <div className="flex justify-between items-end">
                                            <span className="text-[10px] text-slate-400 font-bold">{new Date(d.date).toLocaleDateString('fa-IR')}</span>
                                            <span className="font-black text-emerald-600 text-lg" dir="ltr">{formatCurrency(d.amount, storeSettings)}</span>
                                        </div>
                                        {d.description && <p className="mt-2 pt-2 border-t border-dashed text-[10px] text-slate-400 italic">{d.description}</p>}
                                    </div>
                                ))}
                                {collectionsData.count === 0 && <div className="text-center py-10 text-slate-400 font-bold">موردی یافت نشد.</div>}
                            </div>
                        </div>
                    </div>
                );
            case 'employees':
                return (
                    <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm max-h-[60vh] overflow-y-auto">
                        <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2"><ReportsIcon className="w-6 h-6 text-blue-500"/> تاریخچه فعالیت کارکنان</h3>
                        <div className="space-y-4">
                            {activities.filter(a => {
                                const t = new Date(a.timestamp).getTime();
                                return t >= dateRange.start.getTime() && t <= dateRange.end.getTime();
                            }).map(act => (
                                <div key={act.id} className="flex gap-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100 items-start hover:bg-white transition-all group">
                                    <div className="p-3 bg-white rounded-xl shadow-sm text-blue-600 group-hover:scale-110 transition-transform"><UserGroupIcon className="w-5 h-5"/></div>
                                    <div className="flex-grow">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-black text-blue-800 text-sm md:text-base">{act.user}</span>
                                            <span className="text-[10px] text-slate-400 font-bold">{new Date(act.timestamp).toLocaleString('fa-IR')}</span>
                                        </div>
                                        <p className="text-xs md:text-sm text-slate-600 font-medium leading-relaxed">{act.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            default: return null;
        }
    }

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
            {printModalContent && (
                <ReportPrintPreviewModal title={printModalContent.title} dateRange={dateRange} onClose={() => setPrintModalContent(null)}>
                    {printModalContent.content}
                </ReportPrintPreviewModal>
            )}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <h1 className="text-3xl md:text-4xl font-black text-slate-800">مرکز گزارشات</h1>
                <div className="flex items-center gap-2">
                     <button onClick={() => setPrintModalContent({ title: tabs.find(t=>t.id===activeTab)?.label || 'گزارش', content: renderContent() })} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:text-blue-600 shadow-sm transition-all active:scale-95"><PrintIcon/></button>
                     <div className="bg-white p-2 md:p-3 rounded-2xl shadow-sm border border-slate-200/60"><DateRangeFilter onFilterChange={(start, end) => setDateRange({ start, end })} /></div>
                </div>
            </div>

            <div className="bg-white/40 backdrop-blur-xl rounded-3xl shadow-xl border border-gray-200/60 overflow-hidden flex flex-col min-h-[65vh]">
                {/* Scrollable Tabs Bar */}
                <div className="flex border-b border-gray-200/60 p-3 bg-slate-50/50 sticky top-0 z-20 overflow-x-auto no-scrollbar snap-x">
                    <div className="flex gap-2 w-full min-w-max">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 py-3.5 px-6 font-black text-sm md:text-lg rounded-2xl transition-all duration-300 snap-start ${
                                    activeTab === tab.id
                                        ? 'bg-blue-600 shadow-xl shadow-blue-200 text-white translate-y-[-2px]'
                                        : 'text-slate-500 hover:bg-white hover:text-blue-600'
                                }`}
                            >
                                {tab.icon}
                                <span className="whitespace-nowrap">{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-4 md:p-8 flex-grow">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};

export default Reports;
