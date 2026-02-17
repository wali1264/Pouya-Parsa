import React, { useState, useMemo } from 'react';
import { useAppContext } from '../AppContext';
import DateRangeFilter from '../components/DateRangeFilter';
import { formatCurrency } from '../utils/formatters';
import type { Product, SaleInvoice, User, Customer, Supplier, CustomerTransaction, SupplierTransaction, InTransitInvoice } from '../types';
import TransactionHistoryModal from '../components/TransactionHistoryModal';
import { PrintIcon, WarningIcon, UserGroupIcon, InventoryIcon, AccountingIcon, POSIcon, ReportsIcon, DashboardIcon, TruckIcon, SafeIcon } from '../components/icons';
import ReportPrintPreviewModal from '../components/ReportPrintPreviewModal';

const Reports: React.FC = () => {
    const { 
        saleInvoices, products, expenses, users, activities, inTransitInvoices,
        customers, suppliers, customerTransactions, supplierTransactions, storeSettings, hasPermission,
        depositHolders, depositTransactions
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

        let grossRevenueAFN = 0, returnsAmountAFN = 0, totalDiscountsGivenAFN = 0, totalCOGS = 0;

        filteredInvoices.forEach(inv => {
            const rate = inv.exchangeRate || 1;
            const amountAFN = inv.totalAmountAFN ?? (inv.currency === 'IRT' ? (inv.totalAmount / rate) : (inv.totalAmount * rate));
            
            if (inv.type === 'sale') {
                grossRevenueAFN += amountAFN;
                if (inv.totalDiscount > 0) totalDiscountsGivenAFN += (inv.totalDiscount * rate);
                inv.items.forEach(item => { 
                    if (item.type === 'product') {
                        totalCOGS += (item.purchasePrice || 0) * item.quantity; 
                    }
                });
            } else if (inv.type === 'return') {
                returnsAmountAFN += amountAFN;
                inv.items.forEach(item => { 
                    if (item.type === 'product') {
                        totalCOGS -= (item.purchasePrice || 0) * item.quantity; 
                    }
                });
            }
        });

        const netSales = grossRevenueAFN - returnsAmountAFN;
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

        return { netSales, totalDiscountsGiven: totalDiscountsGivenAFN, totalExpenses, netIncome, topProducts, returnsAmount: returnsAmountAFN, totalCOGS };
    }, [saleInvoices, expenses, dateRange]);

    const inventoryData = useMemo(() => {
        const totalBookValue = products.reduce((sum, p) => sum + p.batches.reduce((batchSum, b) => batchSum + (b.stock * b.purchasePrice), 0), 0);
        const totalSalesValue = products.reduce((sum, p) => {
            const totalStock = p.batches.reduce((s, b) => s + b.stock, 0);
            return sum + (totalStock * p.salePrice);
        }, 0);
        const totalItems = products.reduce((sum, p) => sum + p.batches.reduce((batchSum, b) => batchSum + (b.stock * b.purchasePrice), 0), 0);
        return { totalBookValue, totalSalesValue, totalItems, projectedProfit: totalSalesValue - totalBookValue };
    }, [products]);

    const supplyChainData = useMemo(() => {
        let totalValueAFN = 0;
        let totalPrepaymentsAFN = 0;
        
        inTransitInvoices.forEach(inv => {
            const rate = inv.exchangeRate || 1;
            const itemsValAFN = inv.items.reduce((s, it) => {
                const priceAFN = inv.currency === 'IRT' ? it.purchasePrice / rate : it.purchasePrice * rate;
                return s + ((it.atFactoryQty + it.inTransitQty) * priceAFN);
            }, 0);
            totalValueAFN += itemsValAFN;
            totalPrepaymentsAFN += (inv.paidAmount || 0) * rate;
        });

        return { totalValueAFN, totalPrepaymentsAFN, orderCount: inTransitInvoices.length };
    }, [inTransitInvoices]);

    const depositData = useMemo(() => {
        const totalAFN = depositHolders.reduce((s, h) => s + h.balanceAFN, 0);
        const totalUSD = depositHolders.reduce((s, h) => s + h.balanceUSD, 0);
        const totalIRT = depositHolders.reduce((s, h) => s + h.balanceIRT, 0);
        const transactionsInRange = depositTransactions.filter(t => {
            const tTime = new Date(t.date).getTime();
            return tTime >= dateRange.start.getTime() && tTime <= dateRange.end.getTime();
        });
        return { totalAFN, totalUSD, totalIRT, txCount: transactionsInRange.length, holdersCount: depositHolders.length };
    }, [depositHolders, depositTransactions, dateRange]);

    const financialPositionData = useMemo(() => {
        const invVal = inventoryData.totalBookValue;
        const custRec = customers.reduce((sum, c) => sum + (c.balance > 0 ? c.balance : 0), 0);
        const suppPay = suppliers.reduce((sum, s) => sum + (s.balance > 0 ? s.balance : 0), 0);
        const deferredAssets = supplyChainData.totalValueAFN;
        return { 
            inventoryValue: invVal, 
            customerReceivables: custRec, 
            supplierPayables: suppPay, 
            deferredAssets,
            totalAssets: invVal + custRec + deferredAssets, 
            netCapital: (invVal + custRec + deferredAssets) - suppPay 
        };
    }, [inventoryData, customers, suppliers, supplyChainData]);

    const collectionsData = useMemo(() => {
        const filtered = customerTransactions.filter(t => {
            const tTime = new Date(t.date).getTime();
            return t.type === 'payment' && tTime >= dateRange.start.getTime() && tTime <= dateRange.end.getTime();
        });
        return { 
            totalAFN: filtered.reduce((s, t) => {
                const rate = (t as any).exchangeRate || 1;
                return s + (t.amount * rate);
            }, 0), 
            count: filtered.length,
            details: filtered.map(t => ({ ...t, customerName: customers.find(c => c.id === t.customerId)?.name || 'ناشناس' }))
        };
    }, [customerTransactions, dateRange, customers]);

    const tabs = [
        { id: 'sales', label: 'فروش و سود', icon: <POSIcon className="w-5 h-5"/> },
        { id: 'inventory', label: 'انبار', icon: <InventoryIcon className="w-5 h-5"/> },
        { id: 'supply_chain', label: 'لجستیک', icon: <TruckIcon className="w-5 h-5"/> },
        { id: 'deposits', label: 'امانات', icon: <SafeIcon className="w-5 h-5"/> },
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
                            <SmartStatCard title="فروش خالص (AFN)" value={formatCurrency(salesData.netSales, storeSettings)} color="text-blue-600" icon={<POSIcon/>}/>
                            <SmartStatCard title="سود خالص (AFN)" value={formatCurrency(salesData.netIncome, storeSettings)} color="text-green-600" icon={<DashboardIcon/>}/>
                            <SmartStatCard title="هزینه‌ها" value={formatCurrency(salesData.totalExpenses, storeSettings)} color="text-red-500" icon={<WarningIcon/>}/>
                            <SmartStatCard title="تخفیف‌ها (AFN)" value={formatCurrency(salesData.totalDiscountsGiven, storeSettings)} color="text-amber-600" icon={<PrintIcon/>}/>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2"><div className="w-1 h-5 bg-blue-500 rounded-full"></div> پُرفروش‌ترین‌ها</h3>
                                <div className="space-y-3">
                                    {salesData.topProducts.map(p => (
                                        <div key={p.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl hover:bg-blue-50 transition-colors">
                                            <span className="font-bold text-slate-700 text-sm md:text-base">{p.name}</span>
                                            <div className="text-left">
                                                <p className="font-black text-blue-600 text-sm">{p.totalValue.toLocaleString()} {storeSettings.currencySymbol}</p>
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <SmartStatCard title="ارزش دفتری انبار (خرید)" value={formatCurrency(inventoryData.totalBookValue, storeSettings)} color="text-slate-600" icon={<InventoryIcon/>}/>
                            <SmartStatCard title="ارزش روز انبار (فروش)" value={formatCurrency(inventoryData.totalSalesValue, storeSettings)} color="text-blue-600" icon={<ReportsIcon/>}/>
                            <SmartStatCard title="سود موجود در انبار" value={formatCurrency(inventoryData.projectedProfit, storeSettings)} color="text-emerald-600" icon={<DashboardIcon/>}/>
                        </div>
                        
                        <div className="p-4 bg-blue-50 border-r-4 border-blue-600 rounded-l-xl flex flex-col gap-1">
                             <h4 className="font-black text-blue-800 text-sm">تجدید ارزیابی دارایی‌ها</h4>
                             <p className="text-xs text-blue-700 font-medium leading-relaxed">
                                ارزش روز انبار بر اساس قیمت‌های فروش فعلی شما محاسبه شده است. مابه‌التفاوت ارزش دفتری (خرید) و ارزش روز، نشان‌دهنده سودی است که پس از فروش تمام اجناس فعلی عاید شما خواهد شد.
                             </p>
                        </div>

                        <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden">
                            <table className="min-w-full text-center table-zebra">
                                <thead className="bg-slate-50 text-slate-600 font-bold">
                                    <tr>
                                        <th className="p-4 text-right pr-8">نام محصول</th>
                                        <th className="p-4">موجودی</th>
                                        <th className="p-4">ارزش دفتری (AFN)</th>
                                        <th className="p-4">ارزش روز (AFN)</th>
                                        <th className="p-4">سود ناخالص واحد</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {products.map(p => {
                                        const stock = p.batches.reduce((s,b)=>s+b.stock,0);
                                        const bookVal = p.batches.reduce((s,b)=>s+(b.stock*b.purchasePrice),0);
                                        const saleVal = stock * p.salePrice;
                                        const avgPurc = stock > 0 ? (bookVal / stock) : 0;
                                        return (
                                            <tr key={p.id} className="border-t">
                                                <td className="p-4 font-bold text-slate-700 text-right pr-8">{p.name}</td>
                                                <td className="p-4 font-mono font-bold">{stock}</td>
                                                <td className="p-4 font-mono">{Math.round(bookVal).toLocaleString()}</td>
                                                <td className="p-4 font-mono text-blue-600 font-bold">{Math.round(saleVal).toLocaleString()}</td>
                                                <td className="p-4 text-emerald-600 font-black" dir="ltr">{(p.salePrice - avgPurc).toLocaleString(undefined, {maximumFractionDigits:1})}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            case 'supply_chain':
                return (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <SmartStatCard title="سرمایه در جاده (AFN)" value={formatCurrency(supplyChainData.totalValueAFN, storeSettings)} color="text-blue-700" icon={<TruckIcon/>}/>
                            <SmartStatCard title="مجموع پیش‌پرداخت‌ها" value={formatCurrency(supplyChainData.totalPrepaymentsAFN, storeSettings)} color="text-emerald-600" icon={<AccountingIcon/>}/>
                            <SmartStatCard title="سفارشات معوق" value={`${supplyChainData.orderCount} مورد`} color="text-slate-500" />
                        </div>
                        <div className="p-6 bg-amber-50 rounded-3xl border border-amber-200">
                             <h4 className="font-black text-amber-800 flex items-center gap-2 mb-2"><WarningIcon className="w-5 h-5"/> تحلیل ریسک زنجیره تأمین</h4>
                             <p className="text-sm text-amber-700 leading-relaxed font-medium">
                                شما در حال حاضر معادل <strong>{formatCurrency(supplyChainData.totalValueAFN, storeSettings)}</strong> کالا در خارج از انبار دارید. 
                                مبلغ <strong>{formatCurrency(supplyChainData.totalPrepaymentsAFN, storeSettings)}</strong> نیز به عنوان پیش‌پرداخت نزد تأمین‌کنندگان امانت است.
                             </p>
                        </div>
                    </div>
                );
            case 'deposits':
                return (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <SmartStatCard title="کل امانات (افغانی)" value={Math.round(depositData.totalAFN).toLocaleString()} color="text-indigo-600" icon={<SafeIcon/>}/>
                            <SmartStatCard title="کل امانات (دلار)" value={depositData.totalUSD.toLocaleString()} color="text-emerald-600" icon={<SafeIcon/>}/>
                            <SmartStatCard title="کل امانات (تومان)" value={depositData.totalIRT.toLocaleString()} color="text-orange-600" icon={<SafeIcon/>}/>
                        </div>
                        <div className="p-6 bg-indigo-50 rounded-3xl border border-indigo-200">
                             <h4 className="font-black text-indigo-800 mb-2">تراز صندوق امانات</h4>
                             <p className="text-sm text-indigo-700 font-medium">
                                در بازه زمانی انتخابی، تعداد <strong>{depositData.txCount}</strong> تراکنش امانی ثبت شده است. 
                                مجموعاً وجوه متعلق به <strong>{depositData.holdersCount}</strong> نفر نزد شما بصورت امانت نگهداری می‌شود.
                             </p>
                        </div>
                    </div>
                );
            case 'financial_position':
                return (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="space-y-4">
                                <h3 className="font-black text-green-700 flex items-center gap-2 px-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> دارایی‌ها</h3>
                                <SmartStatCard title="موجودی انبار (AFN)" value={formatCurrency(financialPositionData.inventoryValue, storeSettings)} color="text-slate-800" />
                                <SmartStatCard title="طلب از مشتریان (AFN)" value={formatCurrency(financialPositionData.customerReceivables, storeSettings)} color="text-slate-800" />
                                <SmartStatCard title="کالای نرسیده (Deferred)" value={formatCurrency(financialPositionData.deferredAssets, storeSettings)} color="text-blue-600" />
                            </div>
                            <div className="space-y-4">
                                <h3 className="font-black text-red-700 flex items-center gap-2 px-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> بدهی‌ها</h3>
                                <SmartStatCard title="بدهی به تأمین‌کننده (AFN)" value={formatCurrency(financialPositionData.supplierPayables, storeSettings)} color="text-red-600" />
                                <SmartStatCard title="موجودی امانی (بدهی جاری)" value={formatCurrency(depositData.totalAFN, storeSettings)} color="text-indigo-600" />
                            </div>
                            <div className="flex flex-col justify-center">
                                <div className="bg-gradient-to-br from-blue-600 to-indigo-800 p-8 rounded-3xl shadow-xl text-white text-center transform transition-transform hover:scale-[1.02]">
                                    <h4 className="text-blue-100 font-bold mb-4 opacity-80 uppercase tracking-widest text-xs">سرمایه خالص (Net Worth)</h4>
                                    <p className="text-3xl md:text-4xl font-black drop-shadow-md mb-2" dir="ltr">{formatCurrency(financialPositionData.netCapital - depositData.totalAFN, storeSettings)}</p>
                                    <div className="w-12 h-1 bg-white/30 mx-auto rounded-full mt-4 mb-2"></div>
                                    <p className="text-[10px] text-blue-200 font-medium">دارایی‌های واقعی فروشگاه (بدون مبالغ امانی)</p>
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
                                    <span className="text-xs font-bold text-emerald-700">مجموع وصولی (AFN): {formatCurrency(collectionsData.totalAFN, storeSettings)}</span>
                                </div>
                            </div>
                            <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden">
                                <table className="min-w-full text-center table-zebra">
                                    <thead className="bg-slate-50 text-slate-600 font-bold">
                                        <tr><th className="p-4">مشتری</th><th className="p-4">مبلغ</th><th className="p-4">ارز</th><th className="p-4">زمان</th><th className="p-4">توضیحات</th></tr>
                                    </thead>
                                    <tbody>
                                        {collectionsData.details.map(d => (
                                            <tr key={d.id} className="border-t">
                                                <td className="p-4 font-bold text-slate-800">{d.customerName}</td>
                                                <td className="p-4 text-emerald-600 font-black" dir="ltr">{d.amount.toLocaleString()}</td>
                                                <td className="p-4 font-bold text-slate-500">{d.currency}</td>
                                                <td className="p-4 text-sm text-slate-500">{new Date(d.date).toLocaleString('fa-IR')}</td>
                                                <td className="p-4 text-xs italic text-slate-400">{d.description}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
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