
import React, { useState, useMemo } from 'react';
import { useAppContext } from '../AppContext';
import DateRangeFilter from '../components/DateRangeFilter';
import { formatCurrency, formatStockToPackagesAndUnits } from '../utils/formatters';
import type { Product, SaleInvoice, User, Customer, Supplier, CustomerTransaction, SupplierTransaction, InTransitInvoice, Expense, CartItem, InvoiceItem } from '../types';
import TransactionHistoryModal from '../components/TransactionHistoryModal';
import { PrintIcon, WarningIcon, UserGroupIcon, InventoryIcon, AccountingIcon, POSIcon, ReportsIcon, DashboardIcon, TruckIcon, SafeIcon, ChartBarIcon, SearchIcon } from '../components/icons';
import ReportPrintPreviewModal from '../components/ReportPrintPreviewModal';

const Reports: React.FC = () => {
    const { 
        saleInvoices, products, expenses, users, activities, inTransitInvoices,
        customers, suppliers, customerTransactions, supplierTransactions, storeSettings, hasPermission,
        depositHolders, depositTransactions, purchaseInvoices
    } = useAppContext();

    const [activeTab, setActiveTab] = useState('sales');
    const [dateRange, setDateRange] = useState<{ start: Date, end: Date }>({ start: new Date(), end: new Date() });
    const [printModalContent, setPrintModalContent] = useState<{ title: string; content: React.ReactNode } | null>(null);

    // Itemized Stats Local State
    const [statsType, setStatsType] = useState<'purchases' | 'sales'>('purchases');
    const [selectedEntityId, setSelectedEntityId] = useState<string>('');
    const [selectedProductId, setSelectedProductId] = useState<string>('');

    // --- Calculations (Unified for both views) ---
    const salesData = useMemo(() => {
        const filteredInvoices = saleInvoices.filter(inv => {
            const invTime = new Date(inv.timestamp).getTime();
            return invTime >= dateRange.start.getTime() && invTime <= dateRange.end.getTime();
        });

        let grossRevenueBase = 0, returnsAmountBase = 0, totalDiscountsGivenBase = 0, totalCOGS = 0;

        filteredInvoices.forEach(inv => {
            const rate = inv.exchangeRate || 1;
            const config = storeSettings.currencyConfigs[inv.currency];
            const amountBase = inv.totalAmountAFN ?? (config?.method === 'multiply' ? (inv.totalAmount / rate) : (inv.totalAmount * rate));
            
            if (inv.type === 'sale') {
                grossRevenueBase += amountBase;
                if (inv.totalDiscount > 0) {
                    const discountBase = config?.method === 'multiply' ? (inv.totalDiscount / rate) : (inv.totalDiscount * rate);
                    totalDiscountsGivenBase += discountBase;
                }
                inv.items.forEach(item => { 
                    if (item.type === 'product') {
                        totalCOGS += (item.purchasePrice || 0) * item.quantity; 
                    }
                });
            } else if (inv.type === 'return') {
                returnsAmountBase += amountBase;
                inv.items.forEach(item => { 
                    if (item.type === 'product') {
                        totalCOGS -= (item.purchasePrice || 0) * item.quantity; 
                    }
                });
            }
        });

        const netSales = grossRevenueBase - returnsAmountBase;
        const totalExpensesInRange = expenses.filter(exp => {
            const expTime = new Date(exp.date).getTime();
            return expTime >= dateRange.start.getTime() && expTime <= dateRange.end.getTime();
        }).reduce((sum, exp) => sum + (exp.amountBase || exp.amount), 0);

        const grossProfit = netSales - totalCOGS;
        const netIncome = grossProfit - totalExpensesInRange;

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

        return { netSales, totalDiscountsGiven: totalDiscountsGivenBase, totalExpenses: totalExpensesInRange, netIncome, topProducts, returnsAmount: returnsAmountBase, totalCOGS };
    }, [saleInvoices, expenses, dateRange]);

    const inventoryData = useMemo(() => {
        const totalBookValue = products.reduce((sum, p) => sum + p.batches.reduce((batchSum, b) => batchSum + (b.stock * b.purchasePrice), 0), 0);
        const totalSalesValue = products.reduce((sum, p) => {
            const totalStock = p.batches.reduce((s, b) => s + b.stock, 0);
            return sum + (totalStock * p.salePrice);
        }, 0);
        const totalItems = products.reduce((sum, p) => sum + p.batches.reduce((batchSum, b) => batchSum + b.stock, 0), 0);
        return { totalBookValue, totalSalesValue, totalItems, projectedProfit: totalSalesValue - totalBookValue };
    }, [products]);

    const supplyChainData = useMemo(() => {
        const baseCurrency = storeSettings.baseCurrency || 'AFN';
        let totalValueBase = 0;
        let totalPrepaymentsBase = 0;
        
        inTransitInvoices.forEach(inv => {
            const rate = inv.exchangeRate || 1;
            const config = storeSettings.currencyConfigs[inv.currency || baseCurrency];
            const itemsValBase = inv.items.reduce((s, it) => {
                const priceBase = (inv.currency || baseCurrency) === baseCurrency 
                    ? it.purchasePrice 
                    : (config?.method === 'multiply' ? it.purchasePrice / rate : it.purchasePrice * rate);
                return s + ((it.atFactoryQty + it.inTransitQty) * priceBase);
            }, 0);
            totalValueBase += itemsValBase;
            const prepaymentBase = config?.method === 'multiply' ? (inv.paidAmount || 0) / rate : (inv.paidAmount || 0) * rate;
            totalPrepaymentsBase += prepaymentBase;
        });

        return { totalValueBase, totalPrepaymentsBase, orderCount: inTransitInvoices.length };
    }, [inTransitInvoices, storeSettings]);

    const depositData = useMemo(() => {
        const baseCurrency = storeSettings.baseCurrency || 'AFN';
        const totalBase = depositHolders.reduce((s, h) => s + (h.balanceAFN || 0), 0);
        const totalUSD = depositHolders.reduce((s, h) => s + (h.balanceUSD || 0), 0);
        const totalIRT = depositHolders.reduce((s, h) => s + (h.balanceIRT || 0), 0);
        const transactionsInRange = depositTransactions.filter(t => {
            const tTime = new Date(t.date).getTime();
            return tTime >= dateRange.start.getTime() && tTime <= dateRange.end.getTime();
        });
        return { totalBase, totalUSD, totalIRT, txCount: transactionsInRange.length, holdersCount: depositHolders.length };
    }, [depositHolders, depositTransactions, dateRange, storeSettings]);

    // --- Virtual Cash Position (Liquidity) Calculation ---
    const cashPosition = useMemo(() => {
        const baseCurrency = storeSettings.baseCurrency || 'AFN';
        const cashInSales = saleInvoices.reduce((s, i) => {
            // Only add to cash if it's not a credit sale and NOT an intermediary sale
            if (i.type === 'sale' && !i.customerId && !i.supplierIntermediaryId) return s + i.totalAmountAFN;
            if (i.type === 'return' && !i.customerId && !i.supplierIntermediaryId) return s - i.totalAmountAFN;
            return s;
        }, 0);

        const cashInCollections = customerTransactions.filter(t => t.type === 'payment' && t.isCash !== false).reduce((s, t) => {
            const rate = (t as any).exchangeRate || 1;
            const currency = (t as any).currency || baseCurrency;
            const config = storeSettings.currencyConfigs[currency];
            const amountBase = config?.method === 'multiply' ? t.amount / rate : t.amount * rate;
            return s + amountBase;
        }, 0);

        const cashInDeposits = depositTransactions.filter(t => t.type === 'deposit' && t.isCash !== false).reduce((s, t) => {
            const rate = (t as any).exchangeRate || 1; 
            const config = storeSettings.currencyConfigs[t.currency || storeSettings.baseCurrency];
            const amountBase = config?.method === 'multiply' ? t.amount / rate : t.amount * rate;
            return s + amountBase;
        }, 0);

        const cashOutSuppliers = supplierTransactions.filter(t => t.type === 'payment' && t.isCash !== false).reduce((s, t) => {
            const rate = (t as any).exchangeRate || 1;
            const currency = (t as any).currency || baseCurrency;
            const config = storeSettings.currencyConfigs[currency];
            const amountBase = config?.method === 'multiply' ? t.amount / rate : t.amount * rate;
            return s + amountBase;
        }, 0);

        const cashOutExpenses = expenses.reduce((s, e) => s + (e.amountBase || e.amount), 0);

        const cashOutDeposits = depositTransactions.filter(t => t.type === 'withdrawal' && t.isCash !== false).reduce((s, t) => {
            const rate = (t as any).exchangeRate || 1;
            const config = storeSettings.currencyConfigs[t.currency || storeSettings.baseCurrency];
            const amountBase = config?.method === 'multiply' ? t.amount / rate : t.amount * rate;
            return s + amountBase;
        }, 0);

        return (cashInSales + cashInCollections + cashInDeposits) - (cashOutSuppliers + cashOutExpenses + cashOutDeposits);
    }, [saleInvoices, customerTransactions, depositTransactions, supplierTransactions, expenses, storeSettings]);

    const financialPositionData = useMemo(() => {
        const invVal = inventoryData.totalBookValue;
        const custRec = customers.reduce((sum, c) => sum + (c.balance > 0 ? c.balance : 0), 0);
        const suppPay = suppliers.reduce((sum, s) => sum + (s.balance > 0 ? s.balance : 0), 0);
        const deferredAssets = supplyChainData.totalValueBase;
        
        // Segregate deposits into assets (when they owe us - Besan-kari) and liabilities (when we owe them - Amanat)
        const depositAssets = depositHolders.reduce((s, h) => {
            const baseBalance = h.balance || h.balanceAFN; // Fallback for legacy data
            return s + (baseBalance < 0 ? Math.abs(baseBalance) : 0);
        }, 0);
        const depositLiabilities = depositHolders.reduce((s, h) => {
            const baseBalance = h.balance || h.balanceAFN;
            return s + (baseBalance > 0 ? baseBalance : 0);
        }, 0);
        
        const totalAssets = invVal + cashPosition + custRec + depositAssets + deferredAssets;
        const totalLiabilities = suppPay + depositLiabilities;
        const netWorthRaw = totalAssets - totalLiabilities;

        return { 
            inventoryValue: invVal, 
            cashInHand: cashPosition,
            customerReceivables: custRec, 
            supplierPayables: suppPay, 
            deferredAssets,
            totalAssets, 
            netCapital: netWorthRaw,
            netDepositAsset: depositAssets,
            netDepositLiability: depositLiabilities
        };
    }, [inventoryData, customers, suppliers, supplyChainData, cashPosition, depositHolders]);

    const collectionsData = useMemo(() => {
        const filtered = customerTransactions.filter(t => {
            const tTime = new Date(t.date).getTime();
            return t.type === 'payment' && tTime >= dateRange.start.getTime() && tTime <= dateRange.end.getTime();
        });
        return { 
            totalBase: filtered.reduce((s, t) => {
                const rate = (t as any).exchangeRate || 1;
                const config = storeSettings.currencyConfigs[(t as any).currency || storeSettings.baseCurrency];
                const amountBase = ((t as any).currency || storeSettings.baseCurrency) === storeSettings.baseCurrency ? t.amount : (config?.method === 'multiply' ? t.amount / rate : t.amount * rate);
                return s + amountBase;
            }, 0), 
            count: filtered.length,
            details: filtered.map(t => ({ ...t, customerName: customers.find(c => c.id === t.customerId)?.name || 'ناشناس' }))
        };
    }, [customerTransactions, dateRange, customers, storeSettings]);

    // --- Itemized Stats Summary (General View) ---
    const aggregatedItemStats = useMemo(() => {
        const results: Map<string, { id: string, name: string, quantity: number, totalValue: number, itemsPerPackage: number }> = new Map();

        if (statsType === 'purchases') {
            const filtered = purchaseInvoices.filter(inv => {
                const t = new Date(inv.timestamp).getTime();
                const inRange = t >= dateRange.start.getTime() && t <= dateRange.end.getTime();
                const matchEntity = !selectedEntityId || inv.supplierId === selectedEntityId;
                return inRange && matchEntity;
            });

            filtered.forEach(inv => {
                const rate = inv.exchangeRate || 1;
                const config = storeSettings.currencyConfigs[inv.currency || storeSettings.baseCurrency];
                inv.items.forEach(item => {
                    const priceBase = (inv.currency || storeSettings.baseCurrency) === storeSettings.baseCurrency ? item.purchasePrice : (config?.method === 'multiply' ? item.purchasePrice / rate : item.purchasePrice * rate);
                    const valueBase = priceBase * item.quantity;
                    const existing = results.get(item.productId);
                    if (existing) {
                        existing.quantity += item.quantity;
                        existing.totalValue += valueBase;
                    } else {
                        const product = products.find(p => p.id === item.productId);
                        results.set(item.productId, {
                            id: item.productId,
                            name: item.productName,
                            quantity: item.quantity,
                            totalValue: valueBase,
                            itemsPerPackage: product?.itemsPerPackage || 1
                        });
                    }
                });
            });
        } else {
            const filtered = saleInvoices.filter(inv => {
                const t = new Date(inv.timestamp).getTime();
                const inRange = t >= dateRange.start.getTime() && t <= dateRange.end.getTime();
                const matchEntity = !selectedEntityId || inv.customerId === selectedEntityId;
                return inRange && matchEntity && inv.type === 'sale';
            });

            filtered.forEach(inv => {
                const rate = inv.exchangeRate || 1;
                inv.items.forEach(item => {
                    if (item.type !== 'product') return;
                    const originalPriceBase = item.finalPrice ?? item.salePrice;
                    const valueBase = originalPriceBase * item.quantity;
                    const existing = results.get(item.id);
                    if (existing) {
                        existing.quantity += item.quantity;
                        existing.totalValue += valueBase;
                    } else {
                        results.set(item.id, {
                            id: item.id,
                            name: item.name,
                            quantity: item.quantity,
                            totalValue: valueBase,
                            itemsPerPackage: (item as any).itemsPerPackage || 1
                        });
                    }
                });
            });
        }

        return Array.from(results.values()).sort((a, b) => a.name.localeCompare(b.name, 'fa'));
    }, [statsType, selectedEntityId, purchaseInvoices, saleInvoices, dateRange, products]);

    // --- Detailed Product Tracker (Drill-down View) ---
    const detailedProductStats = useMemo(() => {
        if (!selectedProductId) return [];
        
        if (statsType === 'purchases') {
            return purchaseInvoices
                .filter(inv => {
                    const t = new Date(inv.timestamp).getTime();
                    const inRange = t >= dateRange.start.getTime() && t <= dateRange.end.getTime();
                    const matchEntity = !selectedEntityId || inv.supplierId === selectedEntityId;
                    const hasProduct = inv.items.some(it => it.productId === selectedProductId);
                    return inRange && matchEntity && hasProduct;
                })
                .flatMap(inv => {
                    const supplier = suppliers.find(s => s.id === inv.supplierId);
                    return inv.items
                        .filter(it => it.productId === selectedProductId)
                        .map(it => {
                            const rate = inv.exchangeRate || 1;
                            const config = storeSettings.currencyConfigs[inv.currency || storeSettings.baseCurrency];
                            const priceBase = (inv.currency || storeSettings.baseCurrency) === storeSettings.baseCurrency ? it.purchasePrice : (config?.method === 'multiply' ? it.purchasePrice / rate : it.purchasePrice * rate);
                            return {
                                id: inv.id + it.lotNumber,
                                date: inv.timestamp,
                                entityName: supplier?.name || 'ناشناس',
                                price: it.purchasePrice,
                                currency: inv.currency || storeSettings.baseCurrency,
                                rate: rate,
                                quantity: it.quantity,
                                lot: it.lotNumber,
                                totalBase: priceBase * it.quantity
                            };
                        });
                }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        } else {
            return saleInvoices
                .filter(inv => {
                    const t = new Date(inv.timestamp).getTime();
                    const inRange = t >= dateRange.start.getTime() && t <= dateRange.end.getTime();
                    const matchEntity = !selectedEntityId || inv.customerId === selectedEntityId;
                    const hasProduct = inv.items.some(it => it.id === selectedProductId && it.type === 'product');
                    return inRange && matchEntity && hasProduct && inv.type === 'sale';
                })
                .flatMap(inv => {
                    const customer = customers.find(c => c.id === inv.customerId);
                    return inv.items
                        .filter(it => it.id === selectedProductId && it.type === 'product')
                        .map(it => {
                            const originalItem = it as InvoiceItem;
                            const salePriceBase = originalItem.finalPrice ?? originalItem.salePrice;
                            const totalSaleBase = salePriceBase * it.quantity;
                            const totalCostBase = (originalItem.purchasePrice || 0) * it.quantity;
                            return {
                                id: inv.id,
                                date: inv.timestamp,
                                entityName: customer?.name || 'مشتری گذری',
                                priceBase: salePriceBase,
                                purchasePriceBase: originalItem.purchasePrice,
                                quantity: it.quantity,
                                totalSaleBase: totalSaleBase,
                                profitBase: totalSaleBase - totalCostBase
                            };
                        });
                }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }
    }, [statsType, selectedProductId, selectedEntityId, purchaseInvoices, saleInvoices, dateRange, suppliers, customers]);


    const tabs = [
        { id: 'sales', label: 'فروش و سود', icon: <POSIcon className="w-5 h-5"/> },
        { id: 'inventory', label: 'انبار', icon: <InventoryIcon className="w-5 h-5"/> },
        { id: 'supply_chain', label: 'لجستیک', icon: <TruckIcon className="w-5 h-5"/> },
        { id: 'deposits', label: 'امانات', icon: <SafeIcon className="w-5 h-5"/> },
        { id: 'financial_position', label: 'ترازنامه', icon: <AccountingIcon className="w-5 h-5"/> },
        { id: 'accounts', label: 'وصولی‌ها', icon: <UserGroupIcon className="w-5 h-5"/> },
        { id: 'item_stats', label: 'آمار کالاها', icon: <ChartBarIcon className="w-5 h-5"/> },
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <SmartStatCard title="فروش خالص (AFN)" value={formatCurrency(salesData.netSales, storeSettings)} color="text-blue-600" icon={<POSIcon/>}/>
                            <SmartStatCard title="سود خالص (AFN)" value={formatCurrency(salesData.netIncome, storeSettings)} color="text-green-600" icon={<DashboardIcon/>}/>
                            <SmartStatCard title="هزینه‌ها" value={formatCurrency(salesData.totalExpenses, storeSettings)} color="text-red-500" icon={<WarningIcon/>}/>
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
                                        <th className="p-4">ارزش دفتری ({storeSettings.currencyConfigs[storeSettings.baseCurrency]?.name || storeSettings.baseCurrency})</th>
                                        <th className="p-4">ارزش روز ({storeSettings.currencyConfigs[storeSettings.baseCurrency]?.name || storeSettings.baseCurrency})</th>
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
                                                <td className="p-4 font-mono">{bookVal.toLocaleString(undefined, {maximumFractionDigits: 3})}</td>
                                                <td className="p-4 font-mono text-blue-600 font-bold">{saleVal.toLocaleString(undefined, {maximumFractionDigits: 3})}</td>
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
                            <SmartStatCard title={`سرمایه در جاده (${storeSettings.currencyConfigs[storeSettings.baseCurrency]?.name || storeSettings.baseCurrency})`} value={formatCurrency(supplyChainData.totalValueBase, storeSettings)} color="text-blue-700" icon={<TruckIcon/>}/>
                            <SmartStatCard title="مجموع پیش‌پرداخت‌ها" value={formatCurrency(supplyChainData.totalPrepaymentsBase, storeSettings)} color="text-emerald-600" icon={<AccountingIcon/>}/>
                            <SmartStatCard title="سفارشات معوق" value={`${supplyChainData.orderCount} مورد`} color="text-slate-500" />
                        </div>
                        <div className="p-6 bg-amber-50 rounded-3xl border border-amber-200">
                             <h4 className="font-black text-amber-800 flex items-center gap-2 mb-2"><WarningIcon className="w-5 h-5"/> تحلیل ریسک زنجیره تأمین</h4>
                             <p className="text-sm text-amber-700 leading-relaxed font-medium">
                                شما در حال حاضر معادل <strong>{formatCurrency(supplyChainData.totalValueBase, storeSettings)}</strong> کالا در خارج از انبار دارید. 
                                مبلغ <strong>{formatCurrency(supplyChainData.totalPrepaymentsBase, storeSettings)}</strong> نیز به عنوان پیش‌پرداخت نزد تأمین‌کنندگان امانت است.
                             </p>
                        </div>
                    </div>
                );
            case 'deposits':
                return (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <SmartStatCard title={`کل امانات (${storeSettings.currencyConfigs['AFN']?.name || 'AFN'})`} value={depositHolders.reduce((s,h)=>s+h.balanceAFN, 0).toLocaleString(undefined, {maximumFractionDigits: 3})} color="text-indigo-600" icon={<SafeIcon/>}/>
                            <SmartStatCard title={`کل امانات (${storeSettings.currencyConfigs['USD']?.name || 'USD'})`} value={depositHolders.reduce((s,h)=>s+h.balanceUSD, 0).toLocaleString(undefined, {maximumFractionDigits: 3})} color="text-emerald-600" icon={<SafeIcon/>}/>
                            <SmartStatCard title={`کل امانات (${storeSettings.currencyConfigs['IRT']?.name || 'IRT'})`} value={depositHolders.reduce((s,h)=>s+h.balanceIRT, 0).toLocaleString(undefined, {maximumFractionDigits: 3})} color="text-orange-600" icon={<SafeIcon/>}/>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <SmartStatCard title="مجموع طلب از امانت‌گذاران (بسان‌کاری)" value={formatCurrency(financialPositionData.netDepositAsset, storeSettings)} color="text-blue-600" icon={<ReportsIcon/>}/>
                            <SmartStatCard title="مجموع بدهی به امانت‌گذاران (امانات)" value={formatCurrency(financialPositionData.netDepositLiability, storeSettings)} color="text-indigo-600" icon={<SafeIcon/>}/>
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
                                <SmartStatCard title={`موجودی انبار (${storeSettings.currencyConfigs[storeSettings.baseCurrency]?.name || storeSettings.baseCurrency})`} value={formatCurrency(financialPositionData.inventoryValue, storeSettings)} color="text-slate-800" />
                                <SmartStatCard title="موجودی نقد (تخمینی)" value={formatCurrency(financialPositionData.cashInHand, storeSettings)} color="text-blue-700" icon={<SafeIcon />} />
                                <SmartStatCard title={`طلب از مشتریان (${storeSettings.currencyConfigs[storeSettings.baseCurrency]?.name || storeSettings.baseCurrency})`} value={formatCurrency(financialPositionData.customerReceivables, storeSettings)} color="text-slate-800" />
                                <SmartStatCard title="بسان‌کاری (طلب از امانات)" value={formatCurrency(financialPositionData.netDepositAsset, storeSettings)} color="text-blue-600" />
                                <SmartStatCard title="کالای نرسیده (Deferred)" value={formatCurrency(financialPositionData.deferredAssets, storeSettings)} color="text-blue-600" />
                            </div>
                            <div className="space-y-4">
                                <h3 className="font-black text-red-700 flex items-center gap-2 px-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> بدهی‌ها</h3>
                                <SmartStatCard title={`بدهی به تأمین‌کننده (${storeSettings.currencyConfigs[storeSettings.baseCurrency]?.name || storeSettings.baseCurrency})`} value={formatCurrency(financialPositionData.supplierPayables, storeSettings)} color="text-red-600" />
                                {financialPositionData.netDepositLiability > 0 && (
                                    <SmartStatCard title="موجودی امانی (بدهی جاری)" value={formatCurrency(financialPositionData.netDepositLiability, storeSettings)} color="text-indigo-600" />
                                )}
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">کل هزینه‌های انجام شده (از ابتدای کار)</p>
                                    <p className="font-black text-slate-700 text-lg" dir="ltr">{formatCurrency(expenses.reduce((s,e)=>s+(e.amountBase || e.amount), 0), storeSettings)}</p>
                                </div>
                            </div>
                            <div className="flex flex-col justify-center">
                                <div className="bg-gradient-to-br from-blue-600 to-indigo-800 p-8 rounded-3xl shadow-xl text-white text-center transform transition-transform hover:scale-[1.02]">
                                    <h4 className="text-blue-100 font-bold mb-4 opacity-80 uppercase tracking-widest text-xs">سرمایه خالص (Net Worth)</h4>
                                    <p className="text-3xl md:text-4xl font-black drop-shadow-md mb-2" dir="ltr">{formatCurrency(financialPositionData.netCapital, storeSettings)}</p>
                                    <div className="w-12 h-1 bg-white/30 mx-auto rounded-full mt-4 mb-2"></div>
                                    <p className="text-[10px] text-blue-200 font-medium">ارزش واقعی کسب‌و‌کار با احتساب تمام تعهدات</p>
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
                                    <span className="text-xs font-bold text-emerald-700">مجموع وصولی ({storeSettings.baseCurrency}): {formatCurrency(collectionsData.totalBase, storeSettings)}</span>
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
            case 'item_stats':
                return (
                    <div className="space-y-6">
                        {/* Sub-Tabs & Filtering Controls */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/80 p-4 rounded-3xl border border-slate-100 shadow-sm">
                            <div className="flex gap-2 p-1 bg-white rounded-xl shadow-sm border">
                                <button 
                                    onClick={() => { setStatsType('purchases'); setSelectedEntityId(''); setSelectedProductId(''); }} 
                                    className={`px-6 py-2.5 rounded-lg text-sm font-black transition-all ${statsType === 'purchases' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-blue-600'}`}
                                >
                                    ورودی (خرید)
                                </button>
                                <button 
                                    onClick={() => { setStatsType('sales'); setSelectedEntityId(''); setSelectedProductId(''); }} 
                                    className={`px-6 py-2.5 rounded-lg text-sm font-black transition-all ${statsType === 'sales' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-blue-600'}`}
                                >
                                    خروجی (فروش)
                                </button>
                            </div>
                            
                            <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                                <div className="relative w-full md:w-64">
                                    <select 
                                        value={selectedEntityId}
                                        onChange={(e) => setSelectedEntityId(e.target.value)}
                                        className="w-full p-3 pr-10 bg-white rounded-xl border border-slate-200 text-sm font-bold shadow-sm focus:ring-4 focus:ring-blue-50 outline-none appearance-none"
                                    >
                                        <option value="">همه {statsType === 'purchases' ? 'تامین‌کنندگان' : 'مشتریان'}</option>
                                        {(statsType === 'purchases' ? suppliers : customers).map(entity => (
                                            <option key={entity.id} value={entity.id}>{entity.name}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"><SearchIcon className="w-4 h-4" /></div>
                                </div>

                                <div className="relative w-full md:w-64">
                                    <select 
                                        value={selectedProductId}
                                        onChange={(e) => setSelectedProductId(e.target.value)}
                                        className="w-full p-3 pr-10 bg-white rounded-xl border border-blue-200 text-sm font-bold shadow-sm focus:ring-4 focus:ring-blue-100 outline-none appearance-none text-blue-800"
                                    >
                                        <option value="">-- رهگیری کالا خاص --</option>
                                        {products.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400 pointer-events-none"><InventoryIcon className="w-4 h-4" /></div>
                                </div>
                            </div>
                        </div>

                        {/* List View - Conditional (Summary vs Drill-down) */}
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
                            {!selectedProductId ? (
                                <div className="hidden md:block">
                                    <table className="min-w-full text-center table-zebra">
                                        <thead className="bg-slate-50 border-b border-slate-200">
                                            <tr>
                                                <th className="p-5 font-black text-slate-500 text-sm text-right pr-10">نام محصول (الفبا)</th>
                                                <th className="p-5 font-black text-slate-500 text-sm">میانگین فی واحد ({storeSettings.baseCurrency})</th>
                                                <th className="p-5 font-black text-slate-500 text-sm">مقدار کل</th>
                                                <th className="p-5 font-black text-slate-500 text-sm">ارزش کل ({storeSettings.baseCurrency})</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {aggregatedItemStats.map(item => (
                                                <tr key={item.id} className="border-b last:border-0 hover:bg-blue-50 transition-colors group">
                                                    <td className="p-5 text-right pr-10 font-bold text-slate-800 text-lg group-hover:text-blue-700">{item.name}</td>
                                                    <td className="p-5 font-mono text-slate-600" dir="ltr">{(item.totalValue / item.quantity).toLocaleString(undefined, {maximumFractionDigits: 3})}</td>
                                                    <td className="p-5 font-black text-slate-700">{formatStockToPackagesAndUnits(item.quantity, storeSettings, item.itemsPerPackage)}</td>
                                                    <td className="p-5 font-black text-blue-600 text-lg" dir="ltr">{item.totalValue.toLocaleString(undefined, {maximumFractionDigits: 3})}</td>
                                                </tr>
                                            ))}
                                            {aggregatedItemStats.length === 0 && (
                                                <tr><td colSpan={4} className="p-20 text-slate-400 font-bold">در این بازه و برای این شخص موردی ثبت نشده است.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-center">
                                        <thead className="bg-blue-50 text-blue-900 border-b border-blue-100">
                                            <tr>
                                                <th className="p-4 text-xs font-black">تاریخ</th>
                                                <th className="p-4 text-xs font-black">{statsType === 'purchases' ? 'تأمین‌کننده' : 'مشتری'}</th>
                                                <th className="p-4 text-xs font-black">قیمت معامله ({storeSettings.currencyConfigs[storeSettings.baseCurrency]?.name || storeSettings.baseCurrency})</th>
                                                <th className="p-4 text-xs font-black">تعداد</th>
                                                {statsType === 'sales' && <th className="p-4 text-xs font-black">سود این ردیف ({storeSettings.currencyConfigs[storeSettings.baseCurrency]?.name || storeSettings.baseCurrency})</th>}
                                                <th className="p-4 text-xs font-black">ارزش کل ({storeSettings.currencyConfigs[storeSettings.baseCurrency]?.name || storeSettings.baseCurrency})</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {detailedProductStats.map((tx: any) => (
                                                <tr key={tx.id} className="border-b hover:bg-slate-50 transition-colors">
                                                    <td className="p-4 text-[10px] font-bold text-slate-400">{new Date(tx.date).toLocaleDateString('fa-IR')}</td>
                                                    <td className="p-4 font-bold text-slate-800">{tx.entityName}</td>
                                                    <td className="p-4 font-mono font-black" dir="ltr">{(() => {
                                                        if (tx.priceBase !== undefined) return tx.priceBase.toLocaleString();
                                                        const rate = tx.rate || 1;
                                                        const config = storeSettings.currencyConfigs[tx.currency || storeSettings.baseCurrency];
                                                        const priceBase = (tx.currency || storeSettings.baseCurrency) === storeSettings.baseCurrency ? tx.price : (config?.method === 'multiply' ? tx.price / rate : tx.price * rate);
                                                        return priceBase.toLocaleString();
                                                    })()}</td>
                                                    <td className="p-4 font-bold text-slate-600">{formatStockToPackagesAndUnits(tx.quantity, storeSettings, (products.find(p=>p.id===selectedProductId)?.itemsPerPackage || 1))}</td>
                                                    {statsType === 'sales' && <td className="p-4 font-black text-emerald-600" dir="ltr">{tx.profitBase.toLocaleString(undefined, {maximumFractionDigits: 3})}</td>}
                                                    <td className="p-4 font-black text-blue-600" dir="ltr">{(tx.totalBase ?? tx.totalSaleBase).toLocaleString(undefined, {maximumFractionDigits: 3})}</td>
                                                </tr>
                                            ))}
                                            {detailedProductStats.length === 0 && (
                                                <tr><td colSpan={6} className="p-20 text-slate-300 font-bold">هیچ تراکنشی یافت نشد.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Mobile Summary List (Only if no product selected) */}
                        {!selectedProductId && (
                            <div className="md:hidden space-y-4">
                                {aggregatedItemStats.map(item => (
                                    <div key={item.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-md">
                                        <h4 className="font-black text-slate-800 text-lg mb-3 pb-2 border-b border-dashed">{item.name}</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">میانگین فی</p>
                                                <p className="font-bold text-slate-600 text-sm" dir="ltr">{(item.totalValue / item.quantity).toLocaleString(undefined, {maximumFractionDigits: 3})} {storeSettings.baseCurrency}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">ارزش کل</p>
                                                <p className="font-black text-blue-600" dir="ltr">{item.totalValue.toLocaleString(undefined, {maximumFractionDigits: 3})} {storeSettings.baseCurrency}</p>
                                            </div>
                                            <div className="col-span-2 bg-slate-50 p-2 rounded-xl border border-slate-100 mt-2">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">مقدار کل معامله شده</p>
                                                <p className="font-black text-slate-800 text-base">{formatStockToPackagesAndUnits(item.quantity, storeSettings, item.itemsPerPackage)}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            case 'employees':
                return (
                    <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm max-h-[60vh] overflow-y-auto">
                        <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2"><ReportsIcon className="w-6 h-6 text-blue-50"/> تاریخچه فعالیت کارکنان</h3>
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
                                        : 'text-slate-500 hover:bg-white/80 hover:text-blue-600'
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
