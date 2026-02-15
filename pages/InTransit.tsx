import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { InTransitInvoice, PurchaseInvoiceItem, Supplier, Product, SpeechRecognition, SpeechRecognitionEvent, SpeechRecognitionErrorEvent } from '../types';
import { useAppContext } from '../AppContext';
import { PlusIcon, EditIcon, TrashIcon, CheckIcon, WarningIcon, MicIcon, SearchIcon, XIcon, TruckIcon } from '../components/icons';
import Toast from '../components/Toast';
import DateRangeFilter from '../components/DateRangeFilter';
import PackageUnitInput from '../components/PackageUnitInput';
import ConfirmModal from '../components/ConfirmModal';
import { formatCurrency, parseSpokenNumber } from '../utils/formatters';

interface InTransitItemDraft {
    productId: string;
    quantity: number | string;
    purchasePrice: number | string;
    lotNumber: string;
    expiryDate: string;
    showExpiry: boolean;
}

const InTransit: React.FC = () => {
    const { 
        inTransitInvoices, suppliers, products, 
        addInTransitInvoice, updateInTransitInvoice, deleteInTransitInvoice, confirmInTransitArrival,
        hasPermission, storeSettings 
    } = useAppContext();

    const [isModalOpen, setIsModalOpen] = useState(false);
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
    const [currency, setCurrency] = useState<'AFN' | 'USD'>('AFN');
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

    const handleConfirmArrival = (id: string) => {
        setConfirmConfig({
            isOpen: true,
            title: 'تأیید ورود محموله',
            message: 'آیا محموله به انبار رسیده است؟ با تأیید وصول، موجودی انبار افزایش یافته و بدهی تأمین‌کننده در بخش حسابداری ثبت می‌شود.',
            type: 'success',
            onConfirm: () => {
                const result = confirmInTransitArrival(id);
                showToast(result.message);
                setConfirmConfig(p => ({ ...p, isOpen: false }));
            }
        });
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

    const totalAmount = useMemo(() => {
        const raw = items.reduce((t, i) => t + (Number(i.purchasePrice || 0) * Number(i.quantity || 0)), 0);
        return currency === 'USD' ? Math.round(raw * (Number(exchangeRate) || 1)) : Math.round(raw);
    }, [items, currency, exchangeRate]);

    const filteredProducts = useMemo(() => productSearch ? products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase())) : [], [productSearch, products]);

    const filteredInvoices = useMemo(() => {
        if (!dateRange.start || !dateRange.end) return [];
        return inTransitInvoices.filter(inv => {
            const t = new Date(inv.timestamp).getTime();
            return t >= dateRange.start.getTime() && t <= dateRange.end.getTime();
        }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [inTransitInvoices, dateRange]);

    const totalFilteredValue = useMemo(() => {
        return filteredInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
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
        if (currency === 'USD' && (!exchangeRate || Number(exchangeRate) <= 0)) return showToast("لطفاً نرخ ارز را وارد کنید.");

        const finalItems = items.map(d => ({
            productId: d.productId, quantity: Number(d.quantity || 0),
            purchasePrice: Number(d.purchasePrice || 0), lotNumber: d.lotNumber.trim(),
            expiryDate: d.expiryDate || undefined,
        }));
        
        const finalTimestamp = invoiceDate + 'T' + new Date().toISOString().split('T')[1];
        
        const data = { id: editingInvoiceId || '', supplierId, invoiceNumber, items: finalItems, timestamp: finalTimestamp, currency, exchangeRate: currency === 'USD' ? Number(exchangeRate) : 1, expectedArrivalDate };
        const result = editingInvoiceId ? updateInTransitInvoice(data) : addInTransitInvoice(data);
        if (result.success) handleCloseModal();
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

            <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                <h1 className="text-2xl md:text-4xl text-slate-800 flex items-center gap-3">
                    <TruckIcon className="w-8 h-8 md:w-10 md:h-10 text-blue-600" />
                    اجناس در راه (لیست انتظار)
                </h1>
                <button onClick={handleOpenModal} className="w-full md:w-auto flex items-center justify-center bg-blue-600 text-white px-5 py-3 rounded-lg shadow-lg hover:bg-blue-700 btn-primary transition-all">
                    <PlusIcon className="w-6 h-6 ml-2"/>
                    <span className="font-semibold">ثبت محموله جدید</span>
                </button>
            </div>
            
            <div className="mb-6 p-4 bg-white/60 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/60 flex flex-col md:flex-row justify-between items-center gap-4">
                <DateRangeFilter onFilterChange={(start, end) => setDateRange({ start, end })} />
                
                <div className="flex items-center gap-3 bg-blue-50/80 px-5 py-2.5 rounded-2xl border border-blue-100 shadow-sm transition-all hover:shadow-md group">
                    <div className="text-right">
                        <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-0.5">ارزش کل محموله‌های این بازه</p>
                        <p className="text-xl font-black text-blue-700" dir="ltr">
                            {formatCurrency(totalFilteredValue, storeSettings)}
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
                            <th className="p-5 text-md font-bold text-slate-700 tracking-wider">شماره فاکتور</th>
                            <th className="p-5 text-md font-bold text-slate-700 tracking-wider">تأمین کننده</th>
                            <th className="p-5 text-md font-bold text-slate-700 tracking-wider">ارزش کل</th>
                            <th className="p-5 text-md font-bold text-slate-700 tracking-wider">تاریخ احتمالی وصول</th>
                            <th className="p-5 text-md font-bold text-slate-700 tracking-wider">عملیات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredInvoices.map((invoice) => (
                            <tr key={invoice.id} className="border-t border-gray-200/60 hover:bg-blue-50/30 transition-colors">
                                <td className="p-4 font-semibold font-mono text-lg">
                                    <div className="flex items-center justify-center gap-2">
                                        <span>{invoice.invoiceNumber || invoice.id}</span>
                                        {invoice.currency === 'USD' && <span className="text-xs font-bold bg-orange-100 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full" title="محموله ارزی (دلار)">$</span>}
                                    </div>
                                </td>
                                <td className="p-4 font-bold">{suppliers.find(s => s.id === invoice.supplierId)?.name || 'ناشناس'}</td>
                                <td className="p-4 font-bold text-blue-600">{formatCurrency(invoice.totalAmount, storeSettings)}</td>
                                <td className="p-4">
                                     <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-bold border border-blue-100">
                                        {invoice.expectedArrivalDate ? new Date(invoice.expectedArrivalDate).toLocaleDateString('fa-IR') : 'نامعلوم'}
                                    </span>
                                </td>
                                <td className="p-4">
                                    <div className="flex justify-center items-center space-x-1 space-x-reverse">
                                        {hasPermission('in_transit:confirm_receipt') && (
                                            <button onClick={() => handleConfirmArrival(invoice.id)} className="p-2 rounded-xl bg-green-50 text-green-600 hover:bg-green-600 hover:text-white transition-all shadow-sm" title="تأیید ورود به انبار">
                                                <CheckIcon className="w-6 h-6"/>
                                            </button>
                                        )}
                                        <button onClick={() => handleEditClick(invoice)} className="p-2 rounded-xl text-blue-600 hover:bg-blue-50 transition-all"><EditIcon className="w-6 h-6"/></button>
                                        <button onClick={() => handleDeleteClick(invoice.id)} className="p-2 rounded-xl text-red-500 hover:bg-red-50 transition-all"><TrashIcon className="w-6 h-6"/></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                         {filteredInvoices.length === 0 && (
                            <tr><td colSpan={5} className="p-16 text-slate-400 font-bold">هیچ محموله‌ای در این بازه یافت نشد.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="md:hidden space-y-4">
                {filteredInvoices.map((invoice) => (
                     <div key={invoice.id} className="bg-white/70 p-5 rounded-2xl shadow-md border border-slate-200">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-mono font-bold text-lg text-slate-800">{invoice.invoiceNumber || invoice.id}</h3>
                                    {invoice.currency === 'USD' && <span className="text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded-full">$</span>}
                                </div>
                                <p className="text-sm font-bold text-slate-500">{suppliers.find(s => s.id === invoice.supplierId)?.name || 'ناشناس'}</p>
                           </div>
                           <div className="flex gap-2">
                                {hasPermission('in_transit:confirm_receipt') && <button onClick={() => handleConfirmArrival(invoice.id)} className="p-2.5 bg-green-100 text-green-700 rounded-xl active:bg-green-600 active:text-white"><CheckIcon className="w-5 h-5"/></button>}
                                <button onClick={() => handleEditClick(invoice)} className="p-2.5 bg-blue-100 text-blue-700 rounded-xl"><EditIcon className="w-5 h-5"/></button>
                                <button onClick={() => handleDeleteClick(invoice.id)} className="p-2.5 bg-red-100 text-red-700 rounded-xl"><TrashIcon className="w-5 h-5"/></button>
                           </div>
                        </div>
                        <div className="flex justify-between items-center text-sm border-t border-dashed pt-3 mt-2">
                             <div className="text-right">
                                <p className="text-[10px] text-slate-400 font-bold uppercase">مبلغ کل فاکتور</p>
                                <p className="font-black text-blue-600 text-lg" dir="ltr">{formatCurrency(invoice.totalAmount, storeSettings)}</p>
                             </div>
                             <div className="text-left">
                                <p className="text-[10px] text-slate-400 font-bold uppercase">وصول احتمالی</p>
                                <p className="font-bold text-slate-700">{invoice.expectedArrivalDate ? new Date(invoice.expectedArrivalDate).toLocaleDateString('fa-IR') : 'نامشخص'}</p>
                             </div>
                        </div>
                    </div>
                ))}
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
                            <h2 className="text-xl md:text-2xl font-black text-slate-800">{editingInvoiceId ? 'ویرایش محموله در انتظار' : 'ثبت محموله جدید در راه'}</h2>
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
                                        <span className="text-sm font-bold text-slate-700 group-hover:text-green-600 transition-colors">دلار آمریکا</span>
                                    </label>
                                </div>
                                {currency === 'USD' && (
                                    <div className="flex items-center gap-3 mr-auto animate-modal-zoom-in">
                                        <span className="text-xs font-black text-slate-400">نرخ تبدیل ارز:</span>
                                        <input name="exchangeRate" type="text" value={exchangeRate} onChange={e => setExchangeRate(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="مثلا 68" className="w-24 h-11 p-2 bg-white border-2 border-blue-200 rounded-xl text-center font-mono font-black focus:border-blue-500 outline-none shadow-sm" />
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
                                                    <label className="text-[10px] font-black text-slate-400 mb-2 block">قیمت خرید واحد ({currency === 'USD' ? '$' : 'افغانی'})</label>
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
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">ارزش کل تخمینی (افغانی)</p>
                                <p className="text-4xl font-black text-blue-700" dir="ltr">{totalAmount.toLocaleString()}</p>
                            </div>
                            <div className="flex gap-4 w-full md:w-auto">
                                <button onClick={handleCloseModal} className="flex-1 md:flex-none px-10 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black hover:bg-slate-200 transition-all">لغو و خروج</button>
                                <button 
                                    onClick={handleSave} 
                                    disabled={hasValidationErrors}
                                    className={`flex-1 md:flex-none px-14 py-4 rounded-2xl font-black text-lg shadow-2xl transition-all active:scale-95 ${hasValidationErrors ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-blue-600 text-white shadow-blue-100 hover:bg-blue-700'}`}
                                >
                                    {editingInvoiceId ? 'بروزرسانی نهایی' : 'ذخیره در لیست انتظار'}
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