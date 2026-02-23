
import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { InTransitInvoice, PurchaseInvoiceItem, Supplier, Product, SpeechRecognition, SpeechRecognitionEvent, SpeechRecognitionErrorEvent, SupplierTransaction, PurchaseInvoice } from '../types';
import { useAppContext } from '../AppContext';
import { PlusIcon, EditIcon, TrashIcon, CheckIcon, WarningIcon, MicIcon, SearchIcon, XIcon, TruckIcon, ChevronDownIcon, AccountingIcon, EyeIcon } from '../components/icons';
import Toast from '../components/Toast';
import DateRangeFilter from '../components/DateRangeFilter';
import PackageUnitInput from '../components/PackageUnitInput';
import ConfirmModal from '../components/ConfirmModal';
import ReceiptPreviewModal from '../components/ReceiptPreviewModal';
import { formatCurrency, parseSpokenNumber, toEnglishDigits } from '../utils/formatters';

interface InTransitItemDraft {
    productId: string;
    quantity: number | string;
    purchasePrice: number | string;
    lotNumber: string;
    expiryDate: string;
    showExpiry: boolean;
}

const InTransitPaymentModal: React.FC<{ 
    invoice: InTransitInvoice, 
    onClose: () => void, 
    onConfirm: (amount: number, currency: 'AFN' | 'USD' | 'IRT', rate: number, description: string) => void 
}> = ({ invoice, onClose, onConfirm }) => {
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState<'AFN' | 'USD' | 'IRT'>(invoice.currency || 'AFN');
    const [exchangeRate, setExchangeRate] = useState(invoice.exchangeRate ? String(invoice.exchangeRate) : '');
    const [description, setDescription] = useState(`پیش‌پرداخت بابت فاکتور ${invoice.invoiceNumber || invoice.id.slice(0, 8)}`);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const a = Number(toEnglishDigits(amount).replace(/[^0-9.]/g, ''));
        const r = currency === 'AFN' ? 1 : Number(toEnglishDigits(exchangeRate).replace(/[^0-9.]/g, ''));
        if (a > 0 && (currency === 'AFN' || r > 0)) {
            onConfirm(a, currency, r, description);
        }
    };

    const convertedAmount = useMemo(() => {
        const a = Number(toEnglishDigits(amount).replace(/[^0-9.]/g, ''));
        const r = Number(toEnglishDigits(exchangeRate).replace(/[^0-9.]/g, '')) || 1;
        return currency === 'IRT' ? a / r : a * r;
    }, [amount, exchangeRate, currency]);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4 modal-animate">
            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-2xl w-full max-w-lg">
                <div className="flex justify-between items-center pb-4 border-b mb-6">
                    <h2 className="text-xl font-black text-slate-800">ثبت پیش‌پرداخت (لجستیک)</h2>
                    <button onClick={onClose} className="p-2 rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all"><XIcon /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex gap-3 p-2 bg-slate-100 rounded-xl mb-4">
                        {['AFN', 'USD', 'IRT'].map(c => (
                            <button key={c} type="button" onClick={() => setCurrency(c as any)} className={`flex-1 py-2 rounded-lg font-black text-xs transition-all ${currency === c ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>{c}</button>
                        ))}
                    </div>
                    {currency !== 'AFN' && (
                        <div>
                            <label className="block text-xs font-black text-slate-400 mb-2 mr-1">نرخ تبدیل ارز به افغانی</label>
                            <input type="text" inputMode="decimal" value={exchangeRate} onChange={e => setExchangeRate(toEnglishDigits(e.target.value))} className="w-full p-4 border-2 border-slate-100 rounded-2xl text-center font-mono font-black focus:border-blue-500 outline-none" placeholder="نرخ تبدیل..." required />
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-black text-slate-400 mb-2 mr-1">مبلغ پرداختی ({currency})</label>
                        <input type="text" inputMode="decimal" value={amount} onChange={e => setAmount(toEnglishDigits(e.target.value))} className="w-full p-4 border-2 border-slate-100 rounded-2xl text-center text-2xl font-black text-blue-600 focus:border-blue-500 outline-none" placeholder="0" required />
                        {currency !== 'AFN' && Number(amount) > 0 && (
                            <p className="text-[10px] font-black text-emerald-600 mt-2">معادل تقریبی: {Math.round(convertedAmount).toLocaleString()} AFN</p>
                        )}
                    </div>
                    <div>
                        <label className="block text-xs font-black text-slate-400 mb-2 mr-1">توضیحات تراکنش</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full p-4 border-2 border-slate-100 rounded-2xl text-sm focus:border-blue-500 outline-none h-24" />
                    </div>
                    <button type="submit" className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-emerald-100 active:scale-95 transition-all">ثبت نهایی و چاپ رسید</button>
                </form>
            </div>
        </div>
    );
};

const InTransitMovementModal: React.FC<{ 
    invoice: InTransitInvoice, 
    onClose: () => void, 
    onConfirm: (movements: { [pid: string]: { toTransit: number, toReceived: number, lotNumber: string, expiryDate?: string } }, additionalCost?: number, costDescription?: string) => void 
}> = ({ invoice, onClose, onConfirm }) => {
    const { products, inTransitInvoices } = useAppContext();
    const [movements, setMovements] = useState<{ [pid: string]: { toTransit: number, toReceived: number, lotNumber: string, expiryDate: string } }>({});
    const [additionalCost, setAdditionalCost] = useState<string>('');
    const [costDescription, setCostDescription] = useState<string>('');

    useEffect(() => {
        const initialMovements: any = {};
        invoice.items.forEach(it => {
            initialMovements[it.productId] = { toTransit: 0, toReceived: 0, lotNumber: it.lotNumber, expiryDate: it.expiryDate || '' };
        });
        setMovements(initialMovements);
    }, [invoice]);

    const handleMovementChange = (pid: string, field: 'toTransit' | 'toReceived' | 'lotNumber' | 'expiryDate', value: any) => {
        setMovements(prev => {
            const current = prev[pid] || { toTransit: 0, toReceived: 0, lotNumber: '', expiryDate: '' };
            const item = invoice.items.find(i => i.productId === pid);
            if (!item) return prev;

            let newValue = value;
            
            // Logic constraints
            if (field === 'toTransit') {
                newValue = Math.min(value, item.atFactoryQty);
            } else if (field === 'toReceived') {
                const maxAllowedInWarehouse = item.inTransitQty + current.toTransit;
                newValue = Math.min(value, maxAllowedInWarehouse);
            }

            return {
                ...prev,
                [pid]: { ...current, [field]: newValue }
            };
        });
    };

    const lotValidations = useMemo(() => {
        const validations: { [pid: string]: { isDuplicate: boolean, isMissing: boolean } } = {};
        invoice.items.forEach(item => {
            const pid = item.productId;
            const m = movements[pid];
            if (!m) {
                validations[pid] = { isDuplicate: false, isMissing: false };
                return;
            }

            const isBeingReceived = m.toReceived > 0;
            const lot = (m.lotNumber || '').trim();

            if (!isBeingReceived) {
                validations[pid] = { isDuplicate: false, isMissing: false };
                return;
            }

            // Requirement: Lot must exist if moving to warehouse
            const isMissing = !lot;

            // Requirement: Scoped Duplicate Check (only this product)
            const targetProduct = products.find(p => p.id === pid);
            const warehouseDuplicate = targetProduct?.batches.some(b => b.lotNumber === lot) || false;
            
            // Check other transit invoices for the SAME product with the SAME lot
            const otherTransitDuplicate = inTransitInvoices.some(inv => 
                inv.id !== invoice.id && 
                inv.items.some(it => it.productId === pid && it.lotNumber === lot)
            );

            validations[pid] = { isDuplicate: warehouseDuplicate || otherTransitDuplicate, isMissing };
        });
        return validations;
    }, [movements, products, inTransitInvoices, invoice.id, invoice.items]);

    const hasErrors = useMemo(() => {
        return (Object.values(lotValidations) as any[]).some(v => v.isDuplicate || v.isMissing);
    }, [lotValidations]);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[150] p-0 md:p-4 modal-animate">
            <div className="bg-white p-4 md:p-8 rounded-none md:rounded-3xl shadow-2xl w-full h-full md:max-w-5xl md:h-[90vh] flex flex-col overflow-hidden">
                <div className="flex-shrink-0 flex justify-between items-center pb-4 border-b">
                    <h2 className="text-xl md:text-2xl font-black text-slate-800">مدیریت زنجیره تأمین #{invoice.invoiceNumber || invoice.id.slice(0,8)}</h2>
                    <button onClick={onClose} className="p-2 rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all"><XIcon /></button>
                </div>
                <div className="flex-grow overflow-y-auto pt-6 -mx-4 px-4 custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-10">
                        {invoice.items.map(item => {
                            const product = products.find(p => p.id === item.productId);
                            const m = movements[item.productId] || { toTransit: 0, toReceived: 0, lotNumber: '', expiryDate: '' };
                            const availableInRoad = item.inTransitQty + m.toTransit;
                            const validation = lotValidations[item.productId];

                            return (
                                <div key={item.productId} className={`bg-slate-50/50 border-2 rounded-3xl p-6 flex flex-col gap-6 shadow-sm transition-all ${validation?.isDuplicate || validation?.isMissing ? 'border-red-100 bg-red-50/10' : 'border-transparent hover:border-slate-200'}`}>
                                    <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                                        <div>
                                            <h4 className="font-black text-slate-800 text-lg">{product?.name}</h4>
                                            <div className="flex gap-2 mt-2">
                                                <span className="text-[10px] font-black bg-white border border-slate-200 px-2 py-0.5 rounded-full text-slate-500">سفارش کل: {item.quantity}</span>
                                                <span className="text-[10px] font-black bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full text-emerald-600">رسیده: {item.receivedQty}</span>
                                            </div>
                                        </div>
                                        <div className="text-left">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">ارزش واحد</p>
                                            <p className="font-black text-blue-600 text-sm" dir="ltr">{item.purchasePrice.toLocaleString()} {invoice.currency}</p>
                                        </div>
                                    </div>

                                    {/* Stage 1: Factory to Road */}
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center px-1">
                                            <label className="text-[11px] font-black text-slate-600 flex items-center gap-2">
                                                <div className="w-1.5 h-4 bg-blue-500 rounded-full"></div>
                                                خروج از کارخانه (بارگیری)
                                            </label>
                                            <span className="text-[10px] font-bold text-slate-400">موجود در کارخانه: {item.atFactoryQty}</span>
                                        </div>
                                        <div className="bg-white p-4 rounded-2xl border border-slate-200 flex justify-center">
                                            <PackageUnitInput 
                                                totalUnits={m.toTransit}
                                                itemsPerPackage={product?.itemsPerPackage || 1}
                                                onChange={(val) => handleMovementChange(item.productId, 'toTransit', val)}
                                            />
                                        </div>
                                    </div>

                                    {/* Stage 2: Road to Warehouse */}
                                    {availableInRoad > 0 && (
                                        <div className="space-y-3 animate-modal-zoom-in">
                                            <div className="flex justify-between items-center px-1">
                                                <label className="text-[11px] font-black text-emerald-600 flex items-center gap-2">
                                                    <div className="w-1.5 h-4 bg-emerald-500 rounded-full"></div>
                                                    تخلیه در انبار (وصول نهایی)
                                                </label>
                                                <span className="text-[10px] font-bold text-slate-400">موجود در جاده: {availableInRoad}</span>
                                            </div>
                                            <div className="bg-emerald-50/30 p-4 rounded-2xl border-2 border-dashed border-emerald-200 flex justify-center">
                                                <PackageUnitInput 
                                                    totalUnits={m.toReceived}
                                                    itemsPerPackage={product?.itemsPerPackage || 1}
                                                    onChange={(val) => handleMovementChange(item.productId, 'toReceived', val)}
                                                />
                                            </div>
                                            
                                            {m.toReceived > 0 && (
                                                <div className="space-y-4 pt-2 animate-fade-in">
                                                    <div className="grid grid-cols-1 gap-4">
                                                        <div>
                                                            <label className={`block text-[10px] font-black mb-1 ${validation?.isDuplicate ? 'text-red-600' : (validation?.isMissing ? 'text-amber-600' : 'text-slate-400')}`}>
                                                                شماره لات / سریال پارت وصولی
                                                                <span className="text-red-500 mr-1">*</span>
                                                            </label>
                                                            <input 
                                                                type="text" 
                                                                value={m.lotNumber} 
                                                                onChange={e => handleMovementChange(item.productId, 'lotNumber', e.target.value)} 
                                                                className={`w-full p-3 bg-white border-2 rounded-xl text-center font-mono font-black focus:outline-none transition-all ${validation?.isDuplicate ? 'border-red-300 ring-2 ring-red-50 text-red-700' : (validation?.isMissing ? 'border-amber-300 ring-2 ring-amber-50 text-amber-700' : 'border-slate-100 focus:border-emerald-500')}`} 
                                                                placeholder="الزامی برای انبارداری" 
                                                            />
                                                            {validation?.isDuplicate && <p className="text-[9px] text-red-600 font-bold mt-1">⚠️ شماره سریال برای این کالا تکراری است!</p>}
                                                            {validation?.isMissing && <p className="text-[9px] text-amber-600 font-bold mt-1">⚠️ ورود شماره سریال الزامی است.</p>}
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-black text-slate-400 mb-1">تاریخ انقضا (در صورت وجود)</label>
                                                            <input 
                                                                type="date" 
                                                                value={m.expiryDate} 
                                                                onChange={e => handleMovementChange(item.productId, 'expiryDate', e.target.value)} 
                                                                className="w-full p-3 bg-white border-2 border-slate-100 rounded-xl text-sm font-bold focus:outline-none focus:border-emerald-500" 
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Additional Cost Section */}
                <div className="mt-4 mb-6 grid grid-cols-12 gap-4 bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                    <div className="col-span-8">
                        <label className="block text-[10px] font-black text-blue-800 mb-1 mr-1">توضیحات هزینه (اختیاری)</label>
                        <input 
                            type="text" 
                            className="w-full bg-white border-2 border-blue-100 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-blue-500 transition-all"
                            placeholder="مثلاً: هزینه باربری، گمرک و غیره"
                            value={costDescription}
                            onChange={e => setCostDescription(e.target.value)}
                        />
                    </div>
                    <div className="col-span-4">
                        <label className="block text-[10px] font-black text-blue-800 mb-1 mr-1">مبلغ هزینه اضافه ({invoice?.currency})</label>
                        <input 
                            type="text" 
                            inputMode="decimal"
                            className="w-full bg-white border-2 border-blue-100 rounded-xl px-4 py-3 text-lg font-black text-blue-600 text-center focus:outline-none focus:border-blue-500 transition-all"
                            placeholder="0"
                            value={additionalCost}
                            onChange={e => setAdditionalCost(toEnglishDigits(e.target.value))}
                        />
                    </div>
                </div>

                <div className="mt-auto pt-6 border-t flex flex-col md:flex-row gap-4">
                    <button onClick={onClose} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black active:scale-95 transition-transform">لغو و بازگشت</button>
                    <button 
                        onClick={() => !hasErrors && onConfirm(movements, Number(additionalCost) || 0, costDescription)} 
                        disabled={hasErrors} 
                        className={`flex-[2] py-4 rounded-2xl font-black shadow-lg transition-all active:scale-[0.98] ${hasErrors ? 'bg-slate-300 cursor-not-allowed opacity-50' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                    >
                        ثبت نهایی جابجایی و بروزرسانی تراز مالی
                    </button>
                </div>
            </div>
        </div>
    );
};

const InTransit: React.FC = () => {
    const { 
        inTransitInvoices, suppliers, products, purchaseInvoices,
        addInTransitInvoice, updateInTransitInvoice, deleteInTransitInvoice, archiveInTransitInvoice, moveInTransitItems, addInTransitPayment,
        hasPermission, storeSettings 
    } = useAppContext();

    const [activeTab, setActiveTab] = useState<'active' | 'archive'>('active');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [movementInvoice, setMovementInvoice] = useState<InTransitInvoice | null>(null);
    const [paymentInvoice, setPaymentInvoice] = useState<InTransitInvoice | null>(null);
    const [viewInvoice, setViewInvoice] = useState<InTransitInvoice | null>(null);
    const [receiptModalData, setReceiptModalData] = useState<{ person: Supplier, transaction: SupplierTransaction } | null>(null);
    const [toast, setToast] = useState('');
    const [dateRange, setDateRange] = useState<{ start: Date, end: Date }>({ start: new Date(), end: new Date() });

    const [confirmConfig, setConfirmConfig] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; type: 'danger' | 'success' | 'warning'; }>({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'warning' });

    // Modal Form States
    const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
    const [supplierId, setSupplierId] = useState('');
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
    const [expectedArrivalDate, setExpectedArrivalDate] = useState('');
    const [items, setItems] = useState<InTransitItemDraft[]>([]);
    const [productSearch, setProductSearch] = useState('');
    const [currency, setCurrency] = useState<'AFN' | 'USD' | 'IRT'>('AFN');
    const [exchangeRate, setExchangeRate] = useState<string>('');

    const activeFieldRef = useRef<{ name: string; index?: number } | null>(null);

    const showToast = (message: string) => { setToast(message); setTimeout(() => setToast(''), 3000); };

    const resetModal = () => { setSupplierId(''); setInvoiceNumber(''); setInvoiceDate(new Date().toISOString().split('T')[0]); setExpectedArrivalDate(''); setItems([]); setProductSearch(''); setCurrency('AFN'); setExchangeRate(''); setEditingInvoiceId(null); };
    const handleCloseModal = () => { resetModal(); setIsModalOpen(false); };

    const handleEditClick = (invoice: InTransitInvoice) => { setEditingInvoiceId(invoice.id); setSupplierId(invoice.supplierId); setInvoiceNumber(invoice.invoiceNumber); setInvoiceDate(new Date(invoice.timestamp).toISOString().split('T')[0]); setExpectedArrivalDate(invoice.expectedArrivalDate || ''); setItems(invoice.items.map(i => ({ productId: i.productId, quantity: i.quantity, purchasePrice: i.purchasePrice, lotNumber: i.lotNumber, expiryDate: i.expiryDate || '', showExpiry: !!i.expiryDate }))); setCurrency(invoice.currency || 'AFN'); setExchangeRate(invoice.exchangeRate ? String(invoice.exchangeRate) : ''); setIsModalOpen(true); };

    const handleMovementConfirm = async (movements: any, cost?: number, desc?: string) => { 
        if (!movementInvoice) return; 
        const res = await moveInTransitItems(movementInvoice.id, movements, cost, desc); 
        showToast(res.message); 
        setMovementInvoice(null); 
    };

    const handleForceClose = (id: string) => {
        setConfirmConfig({
            isOpen: true, title: 'تصفیه نهایی و آرشیو محموله', message: 'آیا از بستن این پرونده اطمینان دارید؟ اگر کالایی هنوز نرسیده باشد، سفارش آن لغو شده و محموله به بخش آرشیو منتقل می‌شود.', type: 'warning',
            onConfirm: async () => { await archiveInTransitInvoice(id); showToast("پرونده با موفقیت تصفیه و آرشیو شد."); setConfirmConfig(p => ({ ...p, isOpen: false })); }
        });
    };

    const handleDeleteClick = (id: string) => { setConfirmConfig({ isOpen: true, title: 'حذف کامل اطلاعات', message: 'آیا از حذف دائمی این رکورد اطمینان دارید؟', type: 'danger', onConfirm: () => { deleteInTransitInvoice(id); showToast("رکورد حذف شد."); setConfirmConfig(p => ({ ...p, isOpen: false })); } }); };

    const handleAddItem = (product: Product) => { setItems(prev => [...prev, { productId: product.id, quantity: '', purchasePrice: '', lotNumber: '', expiryDate: '', showExpiry: false }]); setProductSearch(''); };

    const totalInCurrency = useMemo(() => Math.round(items.reduce((t, i) => t + (Number(i.purchasePrice || 0) * Number(i.quantity || 0)), 0)), [items]);

    const filteredInvoices = useMemo(() => {
        return inTransitInvoices.filter(inv => {
            const t = new Date(inv.timestamp).getTime();
            const isInRange = t >= dateRange.start.getTime() && t <= dateRange.end.getTime();
            const statusMatch = (activeTab === 'active') ? (inv.status !== 'closed') : (inv.status === 'closed');
            return isInRange && statusMatch;
        }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [inTransitInvoices, dateRange, activeTab]);

    const totalFilteredValueAFN = useMemo(() => {
        return filteredInvoices.reduce((sum, inv) => {
            const rate = inv.exchangeRate || 1;
            const amountAFN = inv.currency === 'IRT' ? (inv.totalAmount / rate) : (inv.totalAmount * (inv.currency === 'USD' ? rate : 1));
            return sum + Math.round(amountAFN);
        }, 0);
    }, [filteredInvoices]);

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
            {toast && <Toast message={toast} onClose={() => setToast('')} />}
            <ConfirmModal isOpen={confirmConfig.isOpen} title={confirmConfig.title} message={confirmConfig.message} type={confirmConfig.type} onConfirm={confirmConfig.onConfirm} onCancel={() => setConfirmConfig(p => ({ ...p, isOpen: false }))} />
            {movementInvoice && <InTransitMovementModal invoice={movementInvoice} onClose={() => setMovementInvoice(null)} onConfirm={handleMovementConfirm} />}
            {paymentInvoice && <InTransitPaymentModal invoice={paymentInvoice} onClose={() => setPaymentInvoice(null)} onConfirm={async (a, c, r, d) => { const tx = await addInTransitPayment(paymentInvoice.id, a, d, c, r); if (tx) { showToast("پیش‌پرداخت ثبت شد."); const s = suppliers.find(x => x.id === paymentInvoice.supplierId); if (s) setReceiptModalData({ person: s, transaction: tx }); } setPaymentInvoice(null); }} />}
            {receiptModalData && <ReceiptPreviewModal person={receiptModalData.person} transaction={receiptModalData.transaction} type="customer" onClose={() => setReceiptModalData(null)} />}

            {viewInvoice && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[140] p-4 modal-animate">
                    <div className="bg-white p-6 md:p-8 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                        <div className="flex justify-between items-center pb-4 border-b">
                            <h2 className="text-xl font-black text-slate-800">جزئیات محموله {viewInvoice.invoiceNumber || viewInvoice.id.slice(0,8)}</h2>
                            <button onClick={() => setViewInvoice(null)} className="p-1 rounded-full bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"><XIcon/></button>
                        </div>
                        <div className="flex-grow overflow-y-auto pt-6 space-y-6">
                            <div>
                                <h4 className="text-xs font-black text-slate-400 uppercase mb-3">فاکتورهای خرید صادر شده (وصولی‌ها):</h4>
                                <div className="space-y-2">
                                    {purchaseInvoices.filter(p => p.sourceInTransitId === viewInvoice.id).map(p => (
                                        <div key={p.id} className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex justify-between items-center">
                                            <span className="font-mono text-sm font-bold text-blue-700">{p.invoiceNumber}</span>
                                            <span className="font-black text-blue-800" dir="ltr">{p.totalAmount.toLocaleString()} {p.currency}</span>
                                            <span className="text-[10px] font-bold text-slate-400">{new Date(p.timestamp).toLocaleDateString('fa-IR')}</span>
                                        </div>
                                    ))}
                                    {purchaseInvoices.filter(p => p.sourceInTransitId === viewInvoice.id).length === 0 && <p className="text-center py-4 text-slate-400 text-sm">هنوز هیچ بخشی از این محموله وصول نشده است.</p>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
                <div>
                    <h1 className="text-3xl md:text-4xl font-black text-slate-800 flex items-center gap-4 mb-2">
                        <TruckIcon className="w-12 h-12 text-blue-600" /> لجستیک و زنجیره تأمین
                    </h1>
                    <div className="flex p-1 bg-slate-100 rounded-xl w-fit">
                        <button onClick={() => setActiveTab('active')} className={`px-6 py-2 rounded-lg font-black text-sm transition-all ${activeTab === 'active' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500'}`}>جاری ({inTransitInvoices.filter(i=>i.status!=='closed').length})</button>
                        <button onClick={() => setActiveTab('archive')} className={`px-6 py-2 rounded-lg font-black text-sm transition-all ${activeTab === 'archive' ? 'bg-white text-slate-700 shadow-md' : 'text-slate-500'}`}>آرشیو ({inTransitInvoices.filter(i=>i.status==='closed').length})</button>
                    </div>
                </div>
                <button onClick={() => {resetModal(); setIsModalOpen(true);}} className="w-full md:w-auto bg-blue-600 text-white px-8 py-4 rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all font-black text-lg active:scale-95 flex items-center justify-center gap-2"><PlusIcon className="w-6 h-6"/> ثبت محموله جدید</button>
            </div>
            
            <div className="mb-8 p-5 bg-white/60 backdrop-blur-xl rounded-3xl shadow-lg border border-gray-200/60 flex flex-col md:flex-row justify-between items-center gap-6">
                <DateRangeFilter onFilterChange={(start, end) => setDateRange({ start, end })} />
                <div className="flex items-center gap-4 bg-white/80 px-6 py-3 rounded-2xl border border-blue-100 shadow-sm">
                    <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">ارزش تخمینی این لیست (AFN)</p>
                        <p className="text-2xl font-black text-blue-700" dir="ltr">{totalFilteredValueAFN.toLocaleString()}</p>
                    </div>
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><TruckIcon className="w-6 h-6" /></div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredInvoices.map((invoice) => {
                    const totalQty = invoice.items.reduce((s,i) => s + (i.atFactoryQty + i.inTransitQty + i.receivedQty), 0) || 1;
                    const receivedRatio = (invoice.items.reduce((s,i) => s + i.receivedQty, 0) / totalQty) * 100;
                    const isDelayed = activeTab === 'active' && invoice.expectedArrivalDate && new Date(invoice.expectedArrivalDate) < new Date();
                    
                    const isLockedForDeletion = invoice.items.some(it => it.receivedQty > 0) || 
                                                 purchaseInvoices.some(p => p.sourceInTransitId === invoice.id);

                    return (
                        <div key={invoice.id} className={`bg-white/80 backdrop-blur-xl p-6 rounded-3xl border-2 transition-all duration-300 relative group overflow-hidden ${isDelayed ? 'border-red-200 shadow-red-50' : 'border-transparent hover:border-blue-200 shadow-md hover:shadow-xl'}`}>
                            {isDelayed && <div className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-black px-4 py-1.5 rounded-bl-2xl uppercase tracking-tighter animate-pulse shadow-md z-10">⚠️ تأخیر در وصول</div>}
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <h3 className="font-mono font-black text-xl text-slate-800">#{invoice.invoiceNumber || invoice.id.slice(0,8)}</h3>
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${invoice.currency === 'USD' ? 'bg-orange-100 text-orange-700' : (invoice.currency === 'IRT' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500')}`}>{invoice.currency}</span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-500">{suppliers.find(s => s.id === invoice.supplierId)?.name || 'تأمین‌کننده ناشناس'}</p>
                                </div>
                                <div className="flex gap-1.5">
                                    <button onClick={() => setViewInvoice(invoice)} className="p-2 bg-slate-50 text-slate-400 hover:text-blue-600 rounded-xl transition-colors"><EyeIcon className="w-5 h-5"/></button>
                                    <button onClick={() => handleEditClick(invoice)} className="p-2 bg-slate-50 text-slate-400 hover:text-blue-600 rounded-xl transition-colors"><EditIcon className="w-5 h-5"/></button>
                                </div>
                            </div>

                            <div className="mb-6 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                                <div className="flex justify-between text-[10px] font-black mb-2 uppercase">
                                    <span className="text-slate-400">پیشرفت کل سفارش</span>
                                    <span className="text-blue-600">{Math.round(receivedRatio)}% وصول شده</span>
                                </div>
                                <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden flex">
                                    <div style={{ width: `${receivedRatio}%` }} className="h-full bg-emerald-500 transition-all duration-1000 shadow-[0_0_10px_rgba(16,185,129,0.3)]"></div>
                                </div>
                                <div className="flex justify-between mt-3 text-[9px] font-bold text-slate-400">
                                    <span>{invoice.items.length} ردیف کالا</span>
                                    <span>وصول شده: {invoice.items.reduce((s,i)=>s+i.receivedQty,0)} واحد</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-xs mb-6 border-y border-dashed border-slate-200 py-4">
                                <div><p className="text-[10px] text-slate-400 font-bold uppercase mb-1">ارزش نهایی</p><p className="font-black text-slate-800 text-base" dir="ltr">{formatCurrency(invoice.totalAmount, storeSettings, invoice.currency==='USD'?'دلار':(invoice.currency==='IRT'?'تومان':'افغانی'))}</p></div>
                                <div className="text-left"><p className="text-[10px] text-slate-400 font-bold uppercase mb-1">پیش‌پرداخت</p><p className="font-black text-emerald-600 text-base" dir="ltr">{(invoice.paidAmount || 0).toLocaleString()} {invoice.currency}</p></div>
                            </div>

                            <div className="flex gap-2">
                                {activeTab === 'active' ? (
                                    <button onClick={() => setMovementInvoice(invoice)} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black text-sm shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2">
                                        <TruckIcon className="w-4 h-4"/> مدیریت وصول
                                    </button>
                                ) : (
                                    <div className="flex-1 py-2 text-center text-[10px] font-black text-slate-400 bg-slate-100 rounded-xl uppercase tracking-widest border border-slate-200">این پرونده مختومه شده است</div>
                                )}
                                <button onClick={() => setPaymentInvoice(invoice)} className="p-3 bg-slate-100 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all" title="ثبت پرداختی"><PlusIcon className="w-5 h-5"/></button>
                                <button 
                                    onClick={() => handleDeleteClick(invoice.id)} 
                                    disabled={isLockedForDeletion}
                                    className={`p-3 rounded-xl transition-all ${
                                        isLockedForDeletion 
                                            ? 'bg-slate-50 text-slate-200 cursor-not-allowed' 
                                            : 'bg-slate-100 text-slate-400 hover:text-red-600 hover:bg-red-50'
                                    }`}
                                    title={isLockedForDeletion ? "به دلیل وصول بخشی از کالاها، حذف این محموله جهت حفظ یکپارچگی حسابداری امکان‌پذیر نیست" : "حذف محموله"}
                                >
                                    <TrashIcon className="w-5 h-5"/>
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
            {filteredInvoices.length === 0 && <div className="text-center py-20 bg-white/40 rounded-3xl border-2 border-dashed border-slate-200"><TruckIcon className="w-16 h-16 mx-auto text-slate-200 mb-4"/><p className="text-slate-400 font-bold text-lg">در این بخش محموله‌ای یافت نشد.</p></div>}

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-0 md:p-4 modal-animate">
                    <div className="bg-white p-4 md:p-8 rounded-none md:rounded-3xl shadow-2xl w-full h-full md:max-w-5xl md:h-[95vh] flex flex-col overflow-hidden" onFocusCapture={(e) => { const target = e.target as HTMLElement; const name = target.getAttribute('name'); const index = target.getAttribute('data-index'); if (name) activeFieldRef.current = index ? { name, index: parseInt(index, 10) } as any : { name } as any; }}>
                        <div className="flex-shrink-0 flex justify-between items-center pb-4 border-b border-slate-100"><h2 className="text-xl md:text-2xl font-black text-slate-800">{editingInvoiceId ? 'ویرایش سفارش' : 'ثبت سفارش جدید'}</h2><button onClick={handleCloseModal} className="p-2 rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all"><XIcon /></button></div>
                        <div className="flex-grow overflow-y-auto pt-6 -mx-2 px-2 custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                <div><label className="block text-xs font-black text-slate-500 mb-2 mr-1">تأمین کننده</label><select value={supplierId} onChange={e => setSupplierId(e.target.value)} className="w-full h-12 p-3 bg-slate-50 border-2 border-transparent rounded-xl focus:bg-white focus:border-blue-500 transition-all font-bold outline-none"><option value="">-- انتخاب کنید --</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                                <div><label className="block text-xs font-black text-slate-500 mb-2 mr-1">شماره فاکتور خرید</label><input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} type="text" className="w-full h-12 p-3 bg-slate-50 border-2 border-transparent rounded-xl focus:bg-white focus:border-blue-500 transition-all font-bold outline-none" placeholder="شماره بارنامه یا فاکتور" /></div>
                                <div><label className="block text-xs font-black text-slate-500 mb-2 mr-1">زمان احتمالی ورود به انبار</label><input type="date" value={expectedArrivalDate} onChange={e => setExpectedArrivalDate(e.target.value)} className="w-full h-12 p-3 bg-slate-50 border-2 border-transparent rounded-xl focus:bg-white focus:border-blue-500 transition-all outline-none font-bold" /></div>
                            </div>
                            <div className="flex items-center gap-6 mb-8 bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                                <span className="font-black text-blue-900 text-sm">ارز معامله:</span>
                                <div className="flex items-center gap-6">
                                    {['AFN', 'USD', 'IRT'].map(c => (
                                        <label key={c} className="flex items-center gap-2 cursor-pointer group">
                                            <input type="radio" checked={currency === c} onChange={() => {setCurrency(c as any); if(c==='AFN') setExchangeRate('');}} className="w-5 h-5 text-blue-600" />
                                            <span className="text-sm font-bold text-slate-700 group-hover:text-blue-600 transition-colors">{c==='AFN'?'افغانی':(c==='USD'?'دلار':'تومان')}</span>
                                        </label>
                                    ))}
                                </div>
                                {currency !== 'AFN' && (
                                    <div className="flex items-center gap-3 mr-auto animate-modal-zoom-in"><span className="text-xs font-black text-slate-400">نرخ هر {currency === 'USD' ? 'دلار به افغانی' : 'افغانی به تومان'}:</span><input name="exchangeRate" type="text" inputMode="decimal" value={exchangeRate} onChange={e => setExchangeRate(toEnglishDigits(e.target.value).replace(/[^0-9.]/g, ''))} placeholder="نرخ" className="w-24 h-11 p-2 bg-white border-2 border-blue-200 rounded-xl text-center font-mono font-black focus:border-blue-500 outline-none shadow-sm" /></div>
                                )}
                            </div>
                            <div className="relative mb-6">
                                <input type="text" name="productSearch" value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="جستجوی نام کالا..." className="w-full p-4 pr-32 bg-white border-2 border-slate-200 rounded-2xl focus:border-blue-500 transition-all outline-none shadow-sm font-bold" />
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2"><SearchIcon className="text-slate-300 w-6 h-6 ml-1" /></div>
                                {productSearch && (
                                    <div className="absolute z-20 w-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 max-h-60 overflow-y-auto">
                                        {products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase())).map(p => <div key={p.id} onClick={() => handleAddItem(p)} className="p-4 hover:bg-blue-50 cursor-pointer font-bold border-b border-slate-50 last:border-0">{p.name}</div>)}
                                    </div>
                                )}
                            </div>
                            <div className="space-y-4 mb-8">
                                {items.map((item, idx) => {
                                    const product = products.find(p => p.id === item.productId);
                                    if (!product) return null;
                                    return (
                                        <div key={idx} className="p-4 rounded-2xl border-2 bg-slate-50/50 border-slate-100">
                                            <div className="flex justify-between items-center mb-4"><h4 className="font-black text-slate-800 text-lg">{product.name}</h4><button onClick={() => setItems(items.filter((_,i)=>i!==idx))} className="p-2 text-red-400 hover:text-red-600"><TrashIcon className="w-5 h-5"/></button></div>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                <div className="col-span-2 md:col-span-1"><label className="text-[10px] font-black text-slate-400 mb-2 block">تعداد کل سفارش</label><PackageUnitInput totalUnits={Number(item.quantity || 0)} itemsPerPackage={product.itemsPerPackage || 1} onChange={q => { const u = [...items]; u[idx].quantity = q; setItems(u); }} /></div>
                                                <div><label className="text-[10px] font-black text-slate-400 mb-2 block">قیمت خرید واحد ({currency})</label><input type="text" inputMode="decimal" value={item.purchasePrice} onChange={e => { const u = [...items]; u[idx].purchasePrice = toEnglishDigits(e.target.value).replace(/[^0-9.]/g, ''); setItems(u); }} placeholder="0" className="w-full h-12 p-3 bg-white border border-slate-200 rounded-xl text-center font-bold outline-none" /></div>
                                                <div><label className="text-[10px] font-black text-slate-400 mb-2 block">شماره لات</label><input type="text" value={item.lotNumber} onChange={e => { const u = [...items]; u[idx].lotNumber = toEnglishDigits(e.target.value); setItems(u); }} placeholder="اختیاری در فاکتور" className="w-full h-12 p-3 bg-white border-2 border-slate-200 rounded-xl text-center font-mono font-black" /></div>
                                                <div><label className="text-[10px] font-black text-slate-400 mb-2 block">انقضا</label><input type="date" value={item.expiryDate} onChange={e => { const u = [...items]; u[idx].expiryDate = e.target.value; setItems(u); }} className="w-full h-12 p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold" /></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="mt-auto pt-6 border-t flex flex-col md:flex-row justify-between items-center gap-6">
                            <div className="text-right">
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">ارزش کل سفارش</p>
                                <p className="text-2xl font-black text-blue-600" dir="ltr">{totalInCurrency.toLocaleString()} {currency}</p>
                            </div>
                            <div className="flex gap-4 w-full md:w-auto"><button onClick={handleCloseModal} className="flex-1 md:flex-none px-10 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black">لغو</button><button onClick={() => { const finalItems = items.map(d => ({ productId: d.productId, quantity: Number(d.quantity || 0), purchasePrice: Number(d.purchasePrice || 0), lotNumber: d.lotNumber.trim(), expiryDate: d.expiryDate || undefined })); const data = { id: editingInvoiceId || '', supplierId, invoiceNumber, items: finalItems, timestamp: invoiceDate + 'T' + new Date().toISOString().split('T')[1], currency, exchangeRate: currency !== 'AFN' ? Number(exchangeRate) : 1, expectedArrivalDate, status: 'active' as const }; const result = editingInvoiceId ? updateInTransitInvoice(data) : addInTransitInvoice(data); if (result.success) handleCloseModal(); }} className="flex-[2] md:flex-none px-14 py-4 rounded-2xl font-black text-lg bg-blue-600 text-white shadow-2xl">ثبت نهایی</button></div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InTransit;
