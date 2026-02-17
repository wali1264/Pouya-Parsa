import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { InTransitInvoice, PurchaseInvoiceItem, Supplier, Product, SpeechRecognition, SpeechRecognitionEvent, SpeechRecognitionErrorEvent, SupplierTransaction } from '../types';
import { useAppContext } from '../AppContext';
import { PlusIcon, EditIcon, TrashIcon, CheckIcon, WarningIcon, MicIcon, SearchIcon, XIcon, TruckIcon, ChevronDownIcon, AccountingIcon } from '../components/icons';
import Toast from '../components/Toast';
import DateRangeFilter from '../components/DateRangeFilter';
import PackageUnitInput from '../components/PackageUnitInput';
import ConfirmModal from '../components/ConfirmModal';
import ReceiptPreviewModal from '../components/ReceiptPreviewModal';
import { formatCurrency, parseSpokenNumber } from '../utils/formatters';

interface InTransitItemDraft {
    productId: string;
    quantity: number | string;
    purchasePrice: number | string;
    lotNumber: string;
    expiryDate: string;
    showExpiry: boolean;
}

const InTransitMovementModal: React.FC<{ 
    invoice: InTransitInvoice, 
    onClose: () => void, 
    onConfirm: (movements: { [pid: string]: { toTransit: number, toReceived: number } }) => void 
}> = ({ invoice, onClose, onConfirm }) => {
    const { products, storeSettings } = useAppContext();
    const [movements, setMovements] = useState<{ [pid: string]: { toTransit: number, toReceived: number } }>({});

    const handleMovementChange = (pid: string, field: 'toTransit' | 'toReceived', value: number) => {
        setMovements(prev => ({
            ...prev,
            [pid]: {
                toTransit: field === 'toTransit' ? value : (prev[pid]?.toTransit || 0),
                toReceived: field === 'toReceived' ? value : (prev[pid]?.toReceived || 0)
            }
        }));
    };

    const handleConfirmAll = () => {
        const fullMovements: any = {};
        invoice.items.forEach(it => {
            fullMovements[it.productId] = { toTransit: it.atFactoryQty, toReceived: it.atFactoryQty + it.inTransitQty };
        });
        onConfirm(fullMovements);
    };

    const handleConfirmSelection = () => {
        onConfirm(movements);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[150] p-0 md:p-4 modal-animate">
            <div className="bg-white p-4 md:p-8 rounded-none md:rounded-3xl shadow-2xl w-full h-full md:max-w-4xl md:h-[90vh] flex flex-col overflow-hidden">
                <div className="flex-shrink-0 flex justify-between items-center pb-4 border-b">
                    <h2 className="text-xl md:text-2xl font-black text-slate-800">مدیریت وضعیت محموله #{invoice.invoiceNumber || invoice.id.slice(0,8)}</h2>
                    <button onClick={onClose} className="p-2 rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all"><XIcon /></button>
                </div>

                <div className="flex-grow overflow-y-auto pt-6 -mx-2 px-2 custom-scrollbar">
                    <div className="mb-6 flex gap-4">
                        <button onClick={handleConfirmAll} className="flex-1 p-4 bg-green-600 text-white rounded-2xl font-black shadow-lg hover:bg-green-700 transition-all flex items-center justify-center gap-2">
                             <CheckIcon className="w-6 h-6" /> وصول تمام اقلام باقیمانده
                        </button>
                    </div>

                    <div className="space-y-4">
                        {invoice.items.map(item => {
                            const product = products.find(p => p.id === item.productId);
                            const m = movements[item.productId] || { toTransit: 0, toReceived: 0 };
                            const maxToTransit = item.atFactoryQty;
                            const maxToReceived = item.inTransitQty + m.toTransit;

                            return (
                                <div key={item.productId} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h4 className="font-black text-slate-800">{product?.name}</h4>
                                            <p className="text-[10px] font-bold text-slate-400">کل سفارش: {item.quantity} | قبلاً رسیده: {item.receivedQty}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <span className="px-2 py-1 bg-slate-200 text-slate-600 rounded-lg text-[10px] font-black">کارخانه: {item.atFactoryQty}</span>
                                            <span className="px-2 py-1 bg-blue-100 text-blue-600 rounded-lg text-[10px] font-black">در راه: {item.inTransitQty}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-white p-3 rounded-xl border border-slate-200">
                                            <label className="block text-[10px] font-black text-slate-400 mb-2">خروج از کارخانه (انتقال به جاده)</label>
                                            <div className="flex items-center gap-3">
                                                <input 
                                                    type="number" 
                                                    min="0" 
                                                    max={maxToTransit} 
                                                    value={m.toTransit || ''} 
                                                    onChange={e => handleMovementChange(item.productId, 'toTransit', Math.min(maxToTransit, Number(e.target.value)))}
                                                    className="w-full p-2 border-2 border-slate-100 rounded-lg text-center font-bold outline-none focus:border-blue-500"
                                                    placeholder="تعداد..."
                                                />
                                                <span className="text-xs font-bold text-slate-400">از {maxToTransit}</span>
                                            </div>
                                        </div>
                                        <div className="bg-white p-3 rounded-xl border border-blue-200">
                                            <label className="block text-[10px] font-black text-blue-500 mb-2">ورود به انبار (پایان انتظار)</label>
                                            <div className="flex items-center gap-3">
                                                <input 
                                                    type="number" 
                                                    min="0" 
                                                    max={maxToReceived} 
                                                    value={m.toReceived || ''} 
                                                    onChange={e => handleMovementChange(item.productId, 'toReceived', Math.min(maxToReceived, Number(e.target.value)))}
                                                    className="w-full p-2 border-2 border-blue-100 rounded-lg text-center font-bold outline-none focus:border-green-500"
                                                    placeholder="تعداد..."
                                                />
                                                <span className="text-xs font-bold text-slate-400">از {maxToReceived}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="mt-auto pt-6 border-t flex gap-4">
                    <button onClick={onClose} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black">لغو</button>
                    <button onClick={handleConfirmSelection} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg">تأیید جابجایی‌های انتخاب شده</button>
                </div>
            </div>
        </div>
    );
};

const InTransitPaymentModal: React.FC<{
    invoice: InTransitInvoice,
    onClose: () => void,
    onConfirm: (amount: number, currency: 'AFN'|'USD'|'IRT', rate: number, description: string) => void
}> = ({ invoice, onClose, onConfirm }) => {
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState<'AFN'|'USD'|'IRT'>(invoice.currency || 'AFN');
    const [rate, setRate] = useState(String(invoice.exchangeRate || ''));
    const [desc, setDesc] = useState(`پیش‌پرداخت بابت سفارش ${invoice.invoiceNumber || invoice.id.slice(0,8)}`);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4 modal-animate">
            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-2xl w-full max-w-lg">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-black text-slate-800">ثبت پیش‌پرداخت مالی</h2>
                    <button onClick={onClose} className="p-2 text-slate-400"><XIcon/></button>
                </div>
                <div className="space-y-4">
                    <div className="flex gap-4 p-3 bg-blue-50 rounded-xl">
                        {['AFN', 'USD', 'IRT'].map(c => (
                            <label key={c} className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" checked={currency === c} onChange={() => setCurrency(c as any)} className="text-blue-600" />
                                <span className="text-xs font-bold">{c}</span>
                            </label>
                        ))}
                    </div>
                    {currency !== 'AFN' && (
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 mb-1">نرخ ارز</label>
                            <input type="number" value={rate} onChange={e => setRate(e.target.value)} className="w-full p-3 border rounded-xl font-mono text-center" placeholder="1.0" />
                        </div>
                    )}
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 mb-1">مبلغ پرداختی</label>
                        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full p-4 border-2 border-slate-100 rounded-xl font-black text-xl text-center focus:border-blue-500 outline-none" placeholder="0" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 mb-1">توضیحات</label>
                        <input type="text" value={desc} onChange={e => setDesc(e.target.value)} className="w-full p-3 border rounded-xl text-sm" />
                    </div>
                </div>
                <div className="flex gap-3 mt-8">
                    <button onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold">لغو</button>
                    <button onClick={() => onConfirm(Number(amount), currency, Number(rate) || 1, desc)} className="flex-[2] py-3 bg-emerald-600 text-white rounded-xl font-black shadow-lg">ثبت و کسر از تراز</button>
                </div>
            </div>
        </div>
    );
};

const InTransit: React.FC = () => {
    const { 
        inTransitInvoices, suppliers, products, 
        addInTransitInvoice, updateInTransitInvoice, deleteInTransitInvoice, moveInTransitItems, addInTransitPayment,
        hasPermission, storeSettings 
    } = useAppContext();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [movementInvoice, setMovementInvoice] = useState<InTransitInvoice | null>(null);
    const [paymentInvoice, setPaymentInvoice] = useState<InTransitInvoice | null>(null);
    const [receiptModalData, setReceiptModalData] = useState<{ person: Supplier, transaction: SupplierTransaction } | null>(null);
    const [toast, setToast] = useState('');
    const [dateRange, setDateRange] = useState<{ start: Date, end: Date }>({ start: new Date(), end: new Date() });

    // Confirm Modal State
    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        type: 'danger' | 'success' | 'warning';
    }>({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'warning' });

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

    // Voice Input Support
    const [isListening, setIsListening] = useState(false);
    const [recognitionLang, setRecognitionLang] = useState<'fa-IR' | 'en-US'>('fa-IR');
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const activeFieldRef = useRef<{name: string, index?: number} | null>(null);

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (event: SpeechRecognitionEvent) => {
             let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
            }
            if (finalTranscript && activeFieldRef.current) {
                const { name, index } = activeFieldRef.current;
                 if(name === 'productSearch') setProductSearch(finalTranscript.trim());
                 else if (index !== undefined || name === 'exchangeRate') {
                    const processed = ['purchasePrice', 'lotNumber', 'exchangeRate'].includes(name) ? parseSpokenNumber(finalTranscript) : finalTranscript.trim();
                    if (name === 'exchangeRate') setExchangeRate(processed);
                    else if (index !== undefined) {
                        const updated = [...items];
                        (updated[index] as any)[name] = processed;
                        setItems(updated);
                    }
                 }
            }
        };
        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);
        recognitionRef.current = recognition;
    }, [items]);

    useEffect(() => { if(recognitionRef.current) recognitionRef.current.lang = recognitionLang; }, [recognitionLang]);

    const toggleListening = () => {
        if (!recognitionRef.current) return;
        if (isListening) recognitionRef.current.stop();
        else { recognitionRef.current.start(); setIsListening(true); }
    };

    const showToast = (message: string) => { setToast(message); setTimeout(() => setToast(''), 3000); };

    const resetModal = () => {
        setSupplierId(''); setInvoiceNumber(''); setInvoiceDate(new Date().toISOString().split('T')[0]);
        setExpectedArrivalDate(''); setItems([]); setProductSearch(''); setCurrency('AFN'); setExchangeRate('');
        setEditingInvoiceId(null);
    };

    const handleOpenModal = () => { resetModal(); setIsModalOpen(true); };
    const handleCloseModal = () => { resetModal(); setIsModalOpen(false); };

    const handleEditClick = (invoice: InTransitInvoice) => {
        setEditingInvoiceId(invoice.id);
        setSupplierId(invoice.supplierId);
        setInvoiceNumber(invoice.invoiceNumber);
        setInvoiceDate(new Date(invoice.timestamp).toISOString().split('T')[0]);
        setExpectedArrivalDate(invoice.expectedArrivalDate || '');
        setItems(invoice.items.map(i => ({
            productId: i.productId, quantity: i.quantity, purchasePrice: i.purchasePrice,
            lotNumber: i.lotNumber, expiryDate: i.expiryDate || '', showExpiry: !!i.expiryDate
        })));
        setCurrency(invoice.currency || 'AFN');
        setExchangeRate(invoice.exchangeRate ? String(invoice.exchangeRate) : '');
        setIsModalOpen(true);
    };

    const handleMovementConfirm = async (movements: { [pid: string]: { toTransit: number, toReceived: number } }) => {
        if (!movementInvoice) return;
        const res = await moveInTransitItems(movementInvoice.id, movements);
        showToast(res.message);
        setMovementInvoice(null);
    };

    const handlePaymentConfirm = async (amount: number, currency: any, rate: number, desc: string) => {
        if (!paymentInvoice) return;
        const tx = await addInTransitPayment(paymentInvoice.id, amount, desc, currency, rate);
        if (tx) {
            showToast("پیش‌پرداخت با موفقیت ثبت شد.");
            const supplier = suppliers.find(s => s.id === paymentInvoice.supplierId);
            if (supplier) setReceiptModalData({ person: supplier, transaction: tx });
        }
        setPaymentInvoice(null);
    };

    const handleDeleteClick = (id: string) => {
        setConfirmConfig({
            isOpen: true,
            title: 'حذف محموله',
            message: 'آیا از حذف این محموله از لیست انتظار اطمینان دارید؟ این عمل قابل بازگشت نیست.',
            type: 'danger',
            onConfirm: () => {
                deleteInTransitInvoice(id);
                showToast("محموله با موفقیت حذف شد.");
                setConfirmConfig(p => ({ ...p, isOpen: false }));
            }
        });
    };

    const handleAddItem = (product: Product) => {
        setItems(prev => [...prev, { productId: product.id, quantity: '', purchasePrice: '', lotNumber: '', expiryDate: '', showExpiry: false }]);
        setProductSearch('');
    };

    const handleRemoveItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

    const totalInCurrency = useMemo(() => {
        return Math.round(items.reduce((t, i) => t + (Number(i.purchasePrice || 0) * Number(i.quantity || 0)), 0));
    }, [items]);

    const estimatedTotalAFN = useMemo(() => {
        const rate = Number(exchangeRate) || 1;
        if (currency === 'IRT') return Math.round(totalInCurrency / rate);
        if (currency === 'USD') return Math.round(totalInCurrency * rate);
        return totalInCurrency;
    }, [totalInCurrency, currency, exchangeRate]);

    const filteredProducts = useMemo(() => productSearch ? products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase())) : [], [productSearch, products]);

    const filteredInvoices = useMemo(() => {
        if (!dateRange.start || !dateRange.end) return [];
        return inTransitInvoices.filter(inv => {
            const t = new Date(inv.timestamp).getTime();
            return t >= dateRange.start.getTime() && t <= dateRange.end.getTime();
        }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [inTransitInvoices, dateRange]);

    const totalFilteredValueAFN = useMemo(() => {
        return filteredInvoices.reduce((sum, inv) => {
            const rate = inv.exchangeRate || 1;
            const amountAFN = inv.currency === 'IRT' 
                ? (inv.totalAmount / rate) 
                : (inv.totalAmount * (inv.currency === 'USD' ? rate : 1));
            return sum + Math.round(amountAFN);
        }, 0);
    }, [filteredInvoices]);

    const lotValidations = useMemo(() => {
        return items.map((item, idx) => {
            const lot = item.lotNumber.trim();
            if (!lot) return { isDuplicate: false, isEmpty: true };
            const internalDuplicate = items.some((other, oIdx) => oIdx !== idx && other.lotNumber.trim() === lot);
            const warehouseDuplicate = products.some(p => p.batches.some(b => b.lotNumber === lot));
            const otherTransitDuplicate = inTransitInvoices.some(inv => 
                inv.id !== editingInvoiceId && 
                inv.items.some(it => it.lotNumber === lot)
            );
            return { isDuplicate: internalDuplicate || warehouseDuplicate || otherTransitDuplicate, isEmpty: false };
        });
    }, [items, products, inTransitInvoices, editingInvoiceId]);

    const hasValidationErrors = lotValidations.some(v => v.isDuplicate || v.isEmpty);

    const handleSave = () => {
        if (items.length === 0) return showToast("محموله نمی‌تواند خالی باشد.");
        if (hasValidationErrors) return showToast("برخی شماره‌های لات نامعتبر یا تکراری هستند.");
        if (currency !== 'AFN' && (!exchangeRate || Number(exchangeRate) <= 0)) return showToast("لطفاً نرخ ارز را وارد کنید.");

        const finalItems = items.map(d => ({
            productId: d.productId, quantity: Number(d.quantity || 0),
            purchasePrice: Number(d.purchasePrice || 0), lotNumber: d.lotNumber.trim(),
            expiryDate: d.expiryDate || undefined,
        }));
        
        const finalTimestamp = invoiceDate + 'T' + new Date().toISOString().split('T')[1];
        
        const data = { id: editingInvoiceId || '', supplierId, invoiceNumber, items: finalItems, timestamp: finalTimestamp, currency, exchangeRate: currency !== 'AFN' ? Number(exchangeRate) : 1, expectedArrivalDate };
        const result = editingInvoiceId ? updateInTransitInvoice(data) : addInTransitInvoice(data);
        if (result.success) handleCloseModal();
    };

    const getInvoiceCurrencyName = (inv: InTransitInvoice) => {
        if (inv.currency === 'USD') return 'دلار';
        if (inv.currency === 'IRT') return 'تومان';
        return 'افغانی';
    };

    return (
        <div className="p-4 md:p-8">
            {toast && <Toast message={toast} onClose={() => setToast('')} />}
            <ConfirmModal 
                isOpen={confirmConfig.isOpen}
                title={confirmConfig.title}
                message={confirmConfig.message}
                type={confirmConfig.type}
                onConfirm={confirmConfig.onConfirm}
                onCancel={() => setConfirmConfig(p => ({ ...p, isOpen: false }))}
            />
            {movementInvoice && (
                <InTransitMovementModal 
                    invoice={movementInvoice} 
                    onClose={() => setMovementInvoice(null)} 
                    onConfirm={handleMovementConfirm} 
                />
            )}
            {paymentInvoice && (
                <InTransitPaymentModal
                    invoice={paymentInvoice}
                    onClose={() => setPaymentInvoice(null)}
                    onConfirm={handlePaymentConfirm}
                />
            )}
            {receiptModalData && (
                <ReceiptPreviewModal
                    person={receiptModalData.person}
                    transaction={receiptModalData.transaction}
                    type="supplier"
                    onClose={() => setReceiptModalData(null)}
                />
            )}

            <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                <h1 className="text-2xl md:text-4xl text-slate-800 flex items-center gap-3">
                    <TruckIcon className="w-8 h-8 md:w-10 md:h-10 text-blue-600" />
                    لجستیک و سفارشات در راه
                </h1>
                <button onClick={handleOpenModal} className="w-full md:w-auto flex items-center justify-center bg-blue-600 text-white px-5 py-3 rounded-lg shadow-lg hover:bg-blue-700 btn-primary transition-all">
                    <PlusIcon className="w-6 h-6 ml-2"/>
                    <span className="font-semibold">ثبت سفارش جدید</span>
                </button>
            </div>
            
            <div className="mb-6 p-4 bg-white/60 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/60 flex flex-col md:flex-row justify-between items-center gap-4">
                <DateRangeFilter onFilterChange={(start, end) => setDateRange({ start, end })} />
                
                <div className="flex items-center gap-3 bg-blue-50/80 px-5 py-2.5 rounded-2xl border border-blue-100 shadow-sm transition-all hover:shadow-md group">
                    <div className="text-right">
                        <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-0.5">ارزش کل سفارشات (AFN)</p>
                        <p className="text-xl font-black text-blue-700" dir="ltr">
                            {formatCurrency(totalFilteredValueAFN, storeSettings, 'افغانی')}
                        </p>
                    </div>
                    <div className="p-2 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform duration-300">
                        <TruckIcon className="w-6 h-6 text-blue-600" />
                    </div>
                </div>
            </div>

            <div className="bg-white/60 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/60 overflow-hidden hidden md:block">
                <table className="min-w-full text-center table-zebra">
                    <thead className="bg-slate-50/50">
                        <tr>
                            <th className="p-5 text-md font-bold text-slate-700 tracking-wider text-right pr-12">سفارش و وضعیت</th>
                            <th className="p-5 text-md font-bold text-slate-700 tracking-wider">تأمین کننده</th>
                            <th className="p-5 text-md font-bold text-slate-700 tracking-wider">ارزش باقیمانده</th>
                            <th className="p-5 text-md font-bold text-slate-700 tracking-wider">وضیعت مالی</th>
                            <th className="p-5 text-md font-bold text-slate-700 tracking-wider">وصول احتمالی</th>
                            <th className="p-5 text-md font-bold text-slate-700 tracking-wider">عملیات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredInvoices.map((invoice) => {
                            const totalQty = invoice.items.reduce((s,i) => s + (i.atFactoryQty + i.inTransitQty + i.receivedQty), 0);
                            const factoryRatio = (invoice.items.reduce((s,i) => s + i.atFactoryQty, 0) / totalQty) * 100;
                            const transitRatio = (invoice.items.reduce((s,i) => s + i.inTransitQty, 0) / totalQty) * 100;
                            const receivedRatio = (invoice.items.reduce((s,i) => s + i.receivedQty, 0) / totalQty) * 100;
                            const cur = invoice.currency || 'AFN';
                            const curName = cur === 'USD' ? 'دلار' : (cur === 'IRT' ? 'تومان' : 'افغانی');

                            return (
                            <tr key={invoice.id} className="border-t border-gray-200/60 hover:bg-blue-50/30 transition-colors">
                                <td className="p-4 text-right pr-12">
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono font-bold text-lg">{invoice.invoiceNumber || invoice.id.slice(0,8)}</span>
                                            {invoice.currency === 'USD' && <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">$</span>}
                                            {invoice.currency === 'IRT' && <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">T</span>}
                                        </div>
                                        <div className="w-48 h-2 bg-gray-200 rounded-full overflow-hidden flex">
                                            <div style={{ width: `${receivedRatio}%` }} className="h-full bg-green-500" title="وصول شده"></div>
                                            <div style={{ width: `${transitRatio}%` }} className="h-full bg-blue-500" title="در راه"></div>
                                            <div style={{ width: `${factoryRatio}%` }} className="h-full bg-gray-400" title="در کارخانه"></div>
                                        </div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                                            {Math.round(receivedRatio)}% رسیده | {Math.round(transitRatio)}% در راه
                                        </p>
                                    </div>
                                </td>
                                <td className="p-4 font-bold">{suppliers.find(s => s.id === invoice.supplierId)?.name || 'ناشناس'}</td>
                                <td className="p-4">
                                     <p className="font-bold text-blue-600">{formatCurrency(invoice.totalAmount, storeSettings, getInvoiceCurrencyName(invoice))}</p>
                                </td>
                                <td className="p-4">
                                    <div className="flex flex-col items-center">
                                        <p className="text-xs font-bold text-emerald-600">پرداخت شده: {invoice.paidAmount?.toLocaleString() || 0} {cur === 'USD' ? '$' : (cur === 'IRT' ? 'ت' : 'AFN')}</p>
                                        <button onClick={() => setPaymentInvoice(invoice)} className="text-[10px] font-black text-blue-600 hover:underline mt-1">ثبت پرداختی جدید</button>
                                    </div>
                                </td>
                                <td className="p-4">
                                     <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-bold border border-blue-100">
                                        {invoice.expectedArrivalDate ? new Date(invoice.expectedArrivalDate).toLocaleDateString('fa-IR') : 'نامعلوم'}
                                    </span>
                                </td>
                                <td className="p-4">
                                    <div className="flex justify-center items-center space-x-1 space-x-reverse">
                                        {hasPermission('in_transit:confirm_receipt') && (
                                            <button onClick={() => setMovementInvoice(invoice)} className="p-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-sm flex items-center gap-1 px-3" title="مدیریت وضعیت اقلام">
                                                <TruckIcon className="w-5 h-5"/>
                                                <span className="text-xs font-bold">مدیریت وصول</span>
                                            </button>
                                        )}
                                        <button onClick={() => handleEditClick(invoice)} className="p-2 rounded-xl text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-all"><EditIcon className="w-6 h-6"/></button>
                                        <button onClick={() => handleDeleteClick(invoice.id)} className="p-2 rounded-xl text-red-300 hover:bg-red-50 hover:text-red-500 transition-all"><TrashIcon className="w-6 h-6"/></button>
                                    </div>
                                </td>
                            </tr>
                        )})}
                         {filteredInvoices.length === 0 && (
                            <tr><td colSpan={6} className="p-16 text-slate-400 font-bold">هیچ سفارشی در این بازه یافت نشد.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="md:hidden space-y-4">
                {filteredInvoices.map((invoice) => {
                    const totalQty = invoice.items.reduce((s,i) => s + (i.atFactoryQty + i.inTransitQty + i.receivedQty), 0);
                    const receivedRatio = (invoice.items.reduce((s,i) => s + i.receivedQty, 0) / totalQty) * 100;

                    return (
                     <div key={invoice.id} className="bg-white/70 p-5 rounded-2xl shadow-md border border-slate-200">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-mono font-bold text-lg text-slate-800">{invoice.invoiceNumber || invoice.id.slice(0,8)}</h3>
                                    {invoice.currency === 'USD' && <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">$</span>}
                                    {invoice.currency === 'IRT' && <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">T</span>}
                                </div>
                                <p className="text-sm font-bold text-slate-500">{suppliers.find(s => s.id === invoice.supplierId)?.name || 'ناشناس'}</p>
                           </div>
                           <div className="flex gap-2">
                                <button onClick={() => setPaymentInvoice(invoice)} className="p-2.5 bg-emerald-600 text-white rounded-xl active:scale-95"><AccountingIcon className="w-5 h-5"/></button>
                                <button onClick={() => setMovementInvoice(invoice)} className="p-2.5 bg-blue-600 text-white rounded-xl active:scale-95"><TruckIcon className="w-5 h-5"/></button>
                                <button onClick={() => handleEditClick(invoice)} className="p-2.5 bg-slate-100 text-slate-500 rounded-xl"><EditIcon className="w-5 h-5"/></button>
                                <button onClick={() => handleDeleteClick(invoice.id)} className="p-2.5 bg-red-50 text-red-400 rounded-xl"><TrashIcon className="w-5 h-5"/></button>
                           </div>
                        </div>
                        <div className="mb-4">
                            <div className="flex justify-between text-[10px] font-black mb-1.5 uppercase">
                                <span className="text-slate-400">پیشرفت سفارش</span>
                                <span className="text-blue-600">{Math.round(receivedRatio)}% تکمیل شده</span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div style={{ width: `${receivedRatio}%` }} className="h-full bg-blue-500 transition-all duration-1000"></div>
                            </div>
                        </div>
                        <div className="flex justify-between items-center text-sm border-t border-dashed pt-3 mt-2">
                             <div className="text-right">
                                <p className="text-[10px] text-slate-400 font-bold uppercase">ارزش کل</p>
                                <p className="font-black text-blue-600 text-lg" dir="ltr">{formatCurrency(invoice.totalAmount, storeSettings, getInvoiceCurrencyName(invoice))}</p>
                                <p className="text-[9px] font-bold text-emerald-600 mt-0.5">پرداختی: {invoice.paidAmount || 0}</p>
                             </div>
                             <div className="text-left">
                                <p className="text-[10px] text-slate-400 font-bold uppercase">وصول احتمالی</p>
                                <p className="font-bold text-slate-700">{invoice.expectedArrivalDate ? new Date(invoice.expectedArrivalDate).toLocaleDateString('fa-IR') : 'نامشخص'}</p>
                             </div>
                        </div>
                    </div>
                )})}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-0 md:p-4 modal-animate">
                    <div className="bg-white p-4 md:p-8 rounded-none md:rounded-3xl shadow-2xl w-full h-full md:max-w-5xl md:h-[95vh] flex flex-col overflow-hidden" onFocusCapture={(e) => {
                        const target = e.target as HTMLElement;
                        const name = target.getAttribute('name');
                        const index = target.getAttribute('data-index');
                        if (name) activeFieldRef.current = index ? { name, index: parseInt(index, 10) } : { name };
                    }}>
                        <div className="flex-shrink-0 flex justify-between items-center pb-4 border-b border-slate-100">
                            <h2 className="text-xl md:text-2xl font-black text-slate-800">{editingInvoiceId ? 'ویرایش سفارش در انتظار' : 'ثبت سفارش جدید (در انتظار)'}</h2>
                            <button onClick={handleCloseModal} className="p-2 rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all"><XIcon /></button>
                        </div>
                        
                        <div className="flex-grow overflow-y-auto pt-6 -mx-2 px-2 custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                <div>
                                    <label className="block text-xs font-black text-slate-500 mb-2 mr-1">تأمین کننده</label>
                                    <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className="w-full h-12 p-3 bg-slate-50 border-2 border-transparent rounded-xl focus:bg-white focus:border-blue-500 transition-all font-bold outline-none">
                                        <option value="">-- انتخاب کنید --</option>
                                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-slate-500 mb-2 mr-1">شماره فاکتور خرید</label>
                                    <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} type="text" className="w-full h-12 p-3 bg-slate-50 border-2 border-transparent rounded-xl focus:bg-white focus:border-blue-500 transition-all font-bold outline-none" placeholder="شماره بارنامه یا فاکتور" />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-slate-500 mb-2 mr-1">زمان احتمالی ورود به انبار</label>
                                    <input type="date" value={expectedArrivalDate} onChange={e => setExpectedArrivalDate(e.target.value)} className="w-full h-12 p-3 bg-slate-50 border-2 border-transparent rounded-xl focus:bg-white focus:border-blue-500 transition-all outline-none font-bold" />
                                </div>
                            </div>

                            <div className="flex items-center gap-6 mb-8 bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                                <span className="font-black text-blue-900 text-sm">ارز معامله:</span>
                                <div className="flex items-center gap-6">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input type="radio" checked={currency === 'AFN'} onChange={() => {setCurrency('AFN'); setExchangeRate('');}} className="w-5 h-5 text-blue-600" />
                                        <span className="text-sm font-bold text-slate-700 group-hover:text-blue-600 transition-colors">افغانی (نقد)</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input type="radio" checked={currency === 'USD'} onChange={() => setCurrency('USD')} className="w-5 h-5 text-green-600" />
                                        <span className="text-sm font-bold text-slate-700 group-hover:text-blue-600 transition-colors">دلار آمریکا</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input type="radio" checked={currency === 'IRT'} onChange={() => setCurrency('IRT')} className="w-5 h-5 text-orange-600" />
                                        <span className="text-sm font-bold text-slate-700 group-hover:text-orange-600 transition-colors">تومان</span>
                                    </label>
                                </div>
                                {currency !== 'AFN' && (
                                    <div className="flex items-center gap-3 mr-auto animate-modal-zoom-in">
                                        <span className="text-xs font-black text-slate-400">نرخ هر {currency === 'USD' ? 'دلار به افغانی' : 'افغانی به تومان'}:</span>
                                        <input name="exchangeRate" type="text" value={exchangeRate} onChange={e => setExchangeRate(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="نرخ" className="w-24 h-11 p-2 bg-white border-2 border-blue-200 rounded-xl text-center font-mono font-black focus:border-blue-500 outline-none shadow-sm" />
                                    </div>
                                )}
                            </div>

                            <div className="relative mb-6">
                                <input type="text" name="productSearch" value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="جستجوی نام کالا برای افزودن به لیست انتظار..." className="w-full p-4 pr-32 bg-white border-2 border-slate-200 rounded-2xl focus:border-blue-500 transition-all outline-none shadow-sm font-bold" />
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                    <button type="button" onClick={() => setRecognitionLang(p => p === 'fa-IR' ? 'en-US' : 'fa-IR')} className="px-3 py-1.5 text-[10px] font-black rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors uppercase">{recognitionLang === 'fa-IR' ? 'FA' : 'EN'}</button>
                                    <button onClick={toggleListening} className={`p-2.5 rounded-full transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'text-slate-400 hover:text-blue-600'}`}><MicIcon className="w-6 h-6"/></button>
                                    <SearchIcon className="text-slate-300 w-6 h-6 ml-1" />
                                </div>
                                {filteredProducts.length > 0 && (
                                    <div className="absolute z-20 w-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 max-h-60 overflow-y-auto">
                                        {filteredProducts.map(p => <div key={p.id} onClick={() => handleAddItem(p)} className="p-4 hover:bg-blue-50 cursor-pointer font-bold border-b border-slate-50 last:border-0">{p.name}</div>)}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4 mb-8">
                                {items.map((item, idx) => {
                                    const product = products.find(p => p.id === item.productId);
                                    if (!product) return null;
                                    const validation = lotValidations[idx];
                                    return (
                                        <div key={idx} className={`p-4 rounded-2xl border-2 transition-all ${validation.isDuplicate ? 'bg-red-50 border-red-300' : 'bg-slate-50/50 border-slate-100 hover:border-blue-100'}`}>
                                            <div className="flex justify-between items-center mb-4">
                                                <h4 className="font-black text-slate-800 text-lg">{product.name}</h4>
                                                <button onClick={() => handleRemoveItem(idx)} className="p-2 text-red-400 hover:text-red-600 hover:bg-white rounded-xl transition-all shadow-sm"><TrashIcon className="w-5 h-5"/></button>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                <div className="col-span-2 md:col-span-1">
                                                    <label className="text-[10px] font-black text-slate-400 mb-2 block">تعداد (بسته و عدد)</label>
                                                    <PackageUnitInput totalUnits={Number(item.quantity || 0)} itemsPerPackage={product.itemsPerPackage || 1} onChange={q => { const u = [...items]; u[idx].quantity = q; setItems(u); }} />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black text-slate-400 mb-2 block">قیمت خرید واحد ({currency === 'USD' ? '$' : (currency === 'IRT' ? 'T' : 'افغانی')})</label>
                                                    <input type="text" name="purchasePrice" data-index={idx} value={item.purchasePrice} onChange={e => { const u = [...items]; u[idx].purchasePrice = e.target.value.replace(/[^0-9.]/g, ''); setItems(u); }} placeholder="0" className="w-full h-12 p-3 bg-white border border-slate-200 rounded-xl text-center font-bold focus:ring-4 focus:ring-blue-100 outline-none transition-all shadow-sm" />
                                                </div>
                                                <div>
                                                    <label className={`text-[10px] font-black mb-2 block ${validation.isDuplicate ? 'text-red-600' : 'text-slate-400'}`}>شماره لات (سریال) محصول</label>
                                                    <input type="text" name="lotNumber" data-index={idx} value={item.lotNumber} onChange={e => { const u = [...items]; u[idx].lotNumber = e.target.value; setItems(u); }} placeholder="اجباری و غیرتکراری" className={`w-full h-12 p-3 bg-white border-2 ${validation.isDuplicate ? 'border-red-500 animate-shake' : 'border-slate-200'} rounded-xl text-center font-mono font-black focus:ring-4 focus:ring-blue-100 outline-none transition-all shadow-sm`} />
                                                </div>
                                                <div className="col-span-2 md:col-span-1">
                                                   <label className="text-[10px] font-black text-slate-400 mb-2 block">تاریخ انقضای احتمالی</label>
                                                   {item.showExpiry ? (
                                                        <input type="date" value={item.expiryDate} onChange={e => { const u = [...items]; u[idx].expiryDate = e.target.value; setItems(u); }} className="w-full h-12 p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none shadow-sm" />
                                                   ) : (
                                                        <button onClick={() => { const u = [...items]; u[idx].showExpiry = true; setItems(u); }} className="w-full h-12 text-sm text-blue-600 font-bold bg-white rounded-xl border-2 border-dashed border-blue-200 hover:bg-blue-50 transition-colors">افزودن تاریخ انقضا</button>
                                                   )}
                                                </div>
                                            </div>
                                            {validation.isDuplicate && <p className="text-[10px] text-red-600 mt-2 font-black">⚠️ این شماره لات قبلاً در انبار یا محموله‌های دیگر ثبت شده است!</p>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="mt-auto pt-6 border-t flex flex-col md:flex-row justify-between items-center gap-6">
                            <div className="text-right">
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">ارزش کل سفارش</p>
                                <div className="flex flex-col items-end">
                                    <p className="text-2xl font-black text-blue-600" dir="ltr">
                                        {formatCurrency(totalInCurrency, storeSettings, currency === 'USD' ? 'دلار' : (currency === 'IRT' ? 'تومان' : 'افغانی'))}
                                    </p>
                                    {currency !== 'AFN' && (
                                        <p className="text-sm font-bold text-slate-400 mt-1">
                                            (معادل: {estimatedTotalAFN.toLocaleString()} AFN)
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-4 w-full md:w-auto">
                                <button onClick={handleCloseModal} className="flex-1 md:flex-none px-10 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black hover:bg-slate-200 transition-all">لغو و خروج</button>
                                <button 
                                    onClick={handleSave} 
                                    disabled={hasValidationErrors}
                                    className={`flex-1 md:flex-none px-14 py-4 rounded-2xl font-black text-lg shadow-2xl transition-all active:scale-95 ${hasValidationErrors ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-blue-600 text-white shadow-blue-100 hover:bg-blue-700'}`}
                                >
                                    {editingInvoiceId ? 'بروزرسانی نهایی' : 'ثبت در لیست انتظار'}
                                </button>
                            </div>
                        </div>
                    </div>
                    <style>{`
                        @keyframes shake {
                            0%, 100% { transform: translateX(0); }
                            25% { transform: translateX(-4px); }
                            75% { transform: translateX(4px); }
                        }
                        .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
                    `}</style>
                </div>
            )}
        </div>
    );
};

export default InTransit;