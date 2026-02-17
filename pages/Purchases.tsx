import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { PurchaseInvoice, PurchaseInvoiceItem, Supplier, Product, SpeechRecognition, SpeechRecognitionEvent, SpeechRecognitionErrorEvent } from '../types';
import { useAppContext } from '../AppContext';
import { PlusIcon, EditIcon, TrashIcon, PrintIcon, WarningIcon, MicIcon, SearchIcon, XIcon, TruckIcon } from '../components/icons';
import Toast from '../components/Toast';
import DateRangeFilter from '../components/DateRangeFilter';
import PurchasePrintPreviewModal from '../components/PurchasePrintPreviewModal';
import PackageUnitInput from '../components/PackageUnitInput';
import ConfirmModal from '../components/ConfirmModal';
import { formatCurrency, parseSpokenNumber } from '../utils/formatters';

// Local Interface for Draft Items
interface PurchaseItemDraft {
    productId: string;
    quantity: number | string;
    purchasePrice: number | string;
    lotNumber: string;
    expiryDate: string;
    showExpiry: boolean;
}

// Return Modal Component
const ReturnModal: React.FC<{ invoice: PurchaseInvoice, onClose: () => void, onSubmit: (returnItems: { productId: string, lotNumber: string, quantity: number }[]) => void }> = ({ invoice, onClose, onSubmit }) => {
    const [returnQuantities, setReturnQuantities] = useState<{[key: string]: number}>({});

    const handleQuantityChange = (productId: string, lotNumber: string, quantity: number) => {
        const key = `${productId}|${lotNumber}`;
        setReturnQuantities(prev => ({...prev, [key]: quantity}));
    };
    
    const handleSubmit = () => {
        const returnItems = Object.entries(returnQuantities)
            .filter(([, qty]) => Number(qty) > 0)
            .map(([key, qty]) => {
                const [productId, lotNumber] = key.split('|');
                return { productId, lotNumber, quantity: Number(qty) };
            });
        onSubmit(returnItems);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-animate">
            <div className="bg-white/95 backdrop-blur-xl p-4 md:p-6 rounded-2xl shadow-2xl border border-gray-200/80 w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="flex-shrink-0 flex justify-between items-center pb-3 border-b">
                    <h2 className="text-lg md:text-xl font-bold">ثبت مرجوعی خرید <span className="font-mono text-sm">{invoice.invoiceNumber || invoice.id}</span></h2>
                    <button onClick={onClose} className="p-1 rounded-full text-slate-500 hover:bg-slate-200/50"><XIcon /></button>
                </div>
                <div className="flex-grow overflow-y-auto pt-4 -mx-2 px-2">
                    <div className="space-y-3">
                        {invoice.items.map((item, idx) => (
                            <div key={`${item.productId}-${item.lotNumber}-${idx}`} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                                <div>
                                    <p className="font-semibold text-sm">{item.productName}</p>
                                    <div className="flex gap-2 items-center">
                                        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 rounded font-mono">Lot: {item.lotNumber}</span>
                                        <span className="text-xs text-slate-500">خریداری شده: {item.quantity}</span>
                                    </div>
                                </div>
                                <input 
                                    type="number" 
                                    min="0" 
                                    max={item.quantity} 
                                    className="w-20 p-2 border rounded-lg text-center"
                                    placeholder="0"
                                    onChange={(e) => handleQuantityChange(item.productId, item.lotNumber, Number(e.target.value))}
                                />
                            </div>
                        ))}
                    </div>
                </div>
                 <div className="flex-shrink-0 flex justify-end gap-3 mt-4 pt-3 border-t">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-200 font-semibold text-sm">لغو</button>
                    <button onClick={handleSubmit} className="px-6 py-2 rounded-lg bg-blue-600 text-white shadow-lg btn-primary font-semibold text-sm">ثبت مرجوعی</button>
                </div>
            </div>
        </div>
    );
};

const Purchases: React.FC = () => {
    const { 
        purchaseInvoices, suppliers, products, 
        addPurchaseInvoice, updatePurchaseInvoice, 
        editingPurchaseInvoiceId, beginEditPurchase, cancelEditPurchase,
        addPurchaseReturn, hasPermission, storeSettings
    } = useAppContext();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [toast, setToast] = useState('');
    const [invoiceToPrint, setInvoiceToPrint] = useState<PurchaseInvoice | null>(null);
    const [returnModalInvoice, setReturnModalInvoice] = useState<PurchaseInvoice | null>(null);
    const [dateRange, setDateRange] = useState<{ start: Date, end: Date }>({ start: new Date(), end: new Date() });

    // Confirm Modal State
    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        type: 'danger' | 'success' | 'warning';
    }>({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'warning' });

    const [supplierId, setSupplierId] = useState('');
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
    const [items, setItems] = useState<PurchaseItemDraft[]>([]);
    const [productSearch, setProductSearch] = useState('');
    const [currency, setCurrency] = useState<'AFN' | 'USD' | 'IRT'>('AFN');
    const [exchangeRate, setExchangeRate] = useState<string>('');

    const [isListening, setIsListening] = useState(false);
    const [recognitionLang, setRecognitionLang] = useState<'fa-IR' | 'en-US'>('fa-IR');
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const activeFieldRef = useRef<{name: string, index?: number} | null>(null);
    const numericFields = ['purchasePrice', 'lotNumber', 'exchangeRate'];

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        
        recognition.onresult = (event: SpeechRecognitionEvent) => {
             let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                }
            }
            if (finalTranscript && activeFieldRef.current) {
                const { name, index } = activeFieldRef.current;
                 if(name === 'productSearch') {
                    setProductSearch(finalTranscript.trim());
                 } else if (index !== undefined || name === 'exchangeRate') {
                    const processedTranscript = numericFields.includes(name)
                        ? parseSpokenNumber(finalTranscript)
                        : finalTranscript.trim();
                    
                    if (name === 'exchangeRate') {
                        setExchangeRate(processedTranscript);
                    } else if (index !== undefined) {
                        handleItemChange(index, name as keyof PurchaseItemDraft, processedTranscript);
                    }
                 }
            }
        };

        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);
        recognitionRef.current = recognition;

    }, []);

    useEffect(() => {
        if(recognitionRef.current) recognitionRef.current.lang = recognitionLang;
    }, [recognitionLang]);

    const toggleListening = async () => {
        if (!recognitionRef.current) return;
        if (isListening) {
            recognitionRef.current.stop();
        } else {
             try {
                recognitionRef.current.start();
                setIsListening(true);
            } catch (e) {
                console.error("Mic error:", e);
            }
        }
    };
    const toggleLanguage = () => setRecognitionLang(p => p === 'fa-IR' ? 'en-US' : 'fa-IR');

    const showToast = (message: string) => {
        setToast(message);
        setTimeout(() => setToast(''), 3000);
    };

    const resetModalState = () => {
        setSupplierId('');
        setInvoiceNumber('');
        setInvoiceDate(new Date().toISOString().split('T')[0]);
        setItems([]);
        setProductSearch('');
        setCurrency('AFN');
        setExchangeRate('');
        if (editingPurchaseInvoiceId) {
            cancelEditPurchase();
        }
    }
    
    const handleOpenModal = () => {
        resetModalState();
        setIsModalOpen(true);
    }
    
    const handleCloseModal = () => {
        resetModalState();
        setIsModalOpen(false);
    }

    const handleEditClick = (invoice: PurchaseInvoice) => {
        const result = beginEditPurchase(invoice.id);
        if (!result.success) {
            showToast(result.message);
            return;
        }
        setSupplierId(invoice.supplierId);
        setInvoiceNumber(invoice.invoiceNumber);
        setInvoiceDate(new Date(invoice.timestamp).toISOString().split('T')[0]);
        setItems(invoice.items.map(i => ({
            productId: i.productId,
            quantity: i.quantity,
            purchasePrice: i.purchasePrice,
            lotNumber: i.lotNumber,
            expiryDate: i.expiryDate || '',
            showExpiry: !!i.expiryDate
        })));
        setCurrency(invoice.currency || 'AFN');
        setExchangeRate(invoice.exchangeRate ? String(invoice.exchangeRate) : '');
        setIsModalOpen(true);
    };

    const handleReturnClick = (invoice: PurchaseInvoice) => {
        setReturnModalInvoice(invoice);
    };

    const handleReturnSubmit = (returnItems: { productId: string; lotNumber: string, quantity: number }[]) => {
        if (returnModalInvoice) {
            const result = addPurchaseReturn(returnModalInvoice.id, returnItems);
            showToast(result.message);
            if (result.success) {
                setReturnModalInvoice(null);
            }
        }
    };

    const handlePrintClick = (invoice: PurchaseInvoice) => {
        setInvoiceToPrint(invoice);
    };

    const handleAddItem = (product: Product) => {
        const newItem: PurchaseItemDraft = {
            productId: product.id,
            quantity: '',
            purchasePrice: '',
            lotNumber: '',
            expiryDate: '',
            showExpiry: false,
        };
        setItems(prev => [...prev, newItem]);
        setProductSearch('');
    };

    const handleItemChange = (index: number, field: keyof PurchaseItemDraft, value: string | number | boolean) => {
        const updatedItems = [...items];
        let processedValue = value;
        if (field === 'purchasePrice') {
             processedValue = String(value).replace(/[^0-9.]/g, ''); 
        }
        (updatedItems[index] as any)[field] = processedValue;
        setItems(updatedItems);
    }
    
    const handleRemoveItem = (index: number) => {
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    const totalAmount = useMemo(() => {
        // Fix: Total should just be the sum of (Price * Qty) in the currentTransactional currency
        return Math.round(items.reduce((total, item) => total + (Number(item.purchasePrice || 0) * Number(item.quantity || 0)), 0));
    }, [items]);

    const filteredProducts = useMemo(() => {
        if (!productSearch) return [];
        return products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()));
    }, [productSearch, products]);

    const filteredInvoices = useMemo(() => {
        if (!dateRange.start || !dateRange.end) return [];
        const startTime = dateRange.start.getTime();
        const endTime = dateRange.end.getTime();

        return purchaseInvoices.filter(inv => {
            const invTime = new Date(inv.timestamp).getTime();
            return invTime >= startTime && invTime <= endTime;
        });
    }, [purchaseInvoices, dateRange]);

    // Validation logic for Serial (Lot) Numbers
    const lotValidations = useMemo(() => {
        return items.map((item, idx) => {
            const lot = item.lotNumber.trim();
            if (!lot) return { isDuplicate: false, isEmpty: true };
            
            // 1. Check current items in this same invoice draft
            const internalDuplicate = items.some((other, oIdx) => oIdx !== idx && other.lotNumber.trim() === lot);
            
            // 2. Check for duplicates in the existing products database
            const externalDuplicate = products.some(p => 
                p.batches.some(b => {
                    if (b.lotNumber !== lot) return false;
                    if (!editingPurchaseInvoiceId) return true;
                    const originalInvoice = purchaseInvoices.find(inv => inv.id === editingPurchaseInvoiceId);
                    const isFromCurrentInvoiceInDB = originalInvoice?.items.some(oi => oi.lotNumber === lot && oi.productId === p.id);
                    return !isFromCurrentInvoiceInDB;
                })
            );

            return { isDuplicate: internalDuplicate || externalDuplicate, isEmpty: false };
        });
    }, [items, products, editingPurchaseInvoiceId, purchaseInvoices]);

    const hasAnyValidationError = lotValidations.some(v => v.isDuplicate || v.isEmpty);

    const handleSaveInvoice = () => {
        if (items.length === 0) {
            showToast("لطفاً حداقل یک کالا به فاکتور اضافه کنید.");
            return;
        }

        if (hasAnyValidationError) {
            showToast("خطا: برخی شماره‌های لات نامعتبر یا تکراری هستند.");
            return;
        }

        if (currency !== 'AFN' && (!exchangeRate || Number(exchangeRate) <= 0)) {
            showToast("لطفاً نرخ ارز را وارد کنید.");
            return;
        }

        const finalItems = items.map(draft => ({
            productId: draft.productId,
            quantity: Number(draft.quantity || 0),
            purchasePrice: Number(draft.purchasePrice || 0),
            lotNumber: draft.lotNumber.trim(),
            expiryDate: draft.expiryDate || undefined,
        }));
        
        // Improve accuracy by adding current time to the selected date
        const finalTimestamp = invoiceDate + 'T' + new Date().toISOString().split('T')[1];
        
        const invoiceData = {
            supplierId,
            invoiceNumber,
            items: finalItems,
            timestamp: finalTimestamp,
            currency,
            exchangeRate: currency !== 'AFN' ? Number(exchangeRate) : 1
        };

        const result = editingPurchaseInvoiceId
            ? updatePurchaseInvoice(invoiceData)
            : addPurchaseInvoice(invoiceData);

        const processResult = (res: any) => {
            if (!res.success) {
                showToast(res.message);
            } else {
                showToast("عملیات با موفقیت انجام شد.");
                handleCloseModal();
            }
        };

        if (result instanceof Promise) {
            result.then(processResult);
        } else {
            processResult(result);
        }
    };

    const getInvoiceCurrencyName = (inv: PurchaseInvoice) => {
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
            {invoiceToPrint && (
                 <PurchasePrintPreviewModal 
                    invoice={invoiceToPrint} 
                    supplier={suppliers.find(s => s.id === invoiceToPrint.supplierId)}
                    onClose={() => setInvoiceToPrint(null)} 
                />
            )}
            {returnModalInvoice && (
                <ReturnModal invoice={returnModalInvoice} onClose={() => setReturnModalInvoice(null)} onSubmit={handleReturnSubmit} />
            )}
            <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                <h1 className="text-2xl md:text-4xl text-slate-800">مدیریت خرید</h1>
                {hasPermission('purchase:create_invoice') && (
                    <button onClick={handleOpenModal} className="w-full md:w-auto flex items-center justify-center bg-blue-600 text-white px-5 py-3 rounded-lg shadow-lg hover:bg-blue-700 btn-primary">
                        <PlusIcon className="w-6 h-6 ml-2"/>
                        <span className="font-semibold">ثبت فاکتور خرید</span>
                    </button>
                )}
            </div>
            
            <div className="mb-6 p-4 bg-white/60 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/60">
                <DateRangeFilter onFilterChange={(start, end) => setDateRange({ start, end })} />
            </div>

            <div className="bg-white/60 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/60 overflow-hidden hidden md:block">
                <table className="min-w-full text-center table-zebra">
                    <thead className="bg-white/50">
                        <tr>
                            <th className="p-5 text-md font-bold text-slate-700 tracking-wider">شماره فاکتور</th>
                            <th className="p-5 text-md font-bold text-slate-700 tracking-wider">تأمین کننده</th>
                            <th className="p-5 text-md font-bold text-slate-700 tracking-wider">مبلغ کل</th>
                            <th className="p-5 text-md font-bold text-slate-700 tracking-wider">تاریخ</th>
                            <th className="p-5 text-md font-bold text-slate-700 tracking-wider">عملیات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredInvoices.map((invoice) => (
                            <tr key={invoice.id} className="border-t border-gray-200/60">
                                <td className="p-4 font-semibold text-slate-800 font-mono text-lg">
                                    <div className="flex flex-col items-center gap-1">
                                        <div className="flex items-center gap-2">
                                            <span>{invoice.invoiceNumber || invoice.id}</span>
                                            {invoice.type === 'return' && <span className="text-xs font-bold bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full">مرجوعی</span>}
                                            {invoice.currency === 'USD' && <span className="text-xs font-bold bg-orange-100 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full" title="خرید ارزی (دلار)">$</span>}
                                            {invoice.currency === 'IRT' && <span className="text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full" title="خرید ارزی (تومان)">T</span>}
                                        </div>
                                        {invoice.sourceInTransitId && (
                                            <div className="flex items-center gap-1 text-[10px] text-blue-500 font-black bg-blue-50 px-2 py-0.5 rounded-full">
                                                <TruckIcon className="w-3 h-3"/>
                                                <span>محموله {invoice.sourceInTransitId.slice(0,8)}</span>
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="p-4 text-slate-700 text-lg">{suppliers.find(s => s.id === invoice.supplierId)?.name || 'ناشناس'}</td>
                                <td className="p-4 text-slate-700 text-lg">{formatCurrency(invoice.totalAmount, storeSettings, getInvoiceCurrencyName(invoice))}</td>
                                <td className="p-4 text-slate-500 text-lg">{new Date(invoice.timestamp).toLocaleDateString('fa-IR')}</td>
                                <td className="p-4">
                                    <div className="flex justify-center items-center space-x-1 space-x-reverse">
                                        <button onClick={() => handlePrintClick(invoice)} className="p-2 rounded-full text-green-600 hover:text-green-800 hover:bg-green-100/50 transition-colors"><PrintIcon className="w-6 h-6"/></button>
                                        {hasPermission('purchase:edit_invoice') && invoice.type === 'purchase' && <button onClick={() => handleEditClick(invoice)} className="p-2 rounded-full text-blue-600 hover:text-blue-800 hover:bg-blue-100/50 transition-colors"><EditIcon className="w-6 h-6"/></button>}
                                        {invoice.type === 'purchase' && <button onClick={() => handleReturnClick(invoice)} className="p-2 rounded-full text-orange-600 hover:text-orange-800 hover:bg-orange-100/50 transition-colors" title="مرجوعی"><PlusIcon className="w-6 h-6 transform rotate-45" /></button>}
                                    </div>
                                </td>
                            </tr>
                        ))}
                         {filteredInvoices.length === 0 && (
                            <tr>
                                <td colSpan={5} className="text-center p-16">
                                    <p className="text-slate-500 text-lg">در این بازه زمانی فاکتوری ثبت نشده است.</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

             {/* Mobile View */}
            <div className="md:hidden space-y-4">
                {filteredInvoices.map((invoice) => (
                     <div key={invoice.id} className="bg-white/70 p-4 rounded-xl shadow-md border">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <h3 className="font-mono font-bold text-lg text-slate-800">{invoice.invoiceNumber || invoice.id}</h3>
                                    {invoice.currency === 'USD' && <span className="text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded-full">$</span>}
                                    {invoice.currency === 'IRT' && <span className="text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full">T</span>}
                                </div>
                                {invoice.type === 'return' && <span className="text-xs font-bold bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full">مرجوعی</span>}
                                {invoice.sourceInTransitId && <span className="text-[9px] font-black text-blue-500 block mb-1">📦 از محموله {invoice.sourceInTransitId.slice(0,8)}</span>}
                           </div>
                           <div className="flex items-center">
                             <button onClick={() => handlePrintClick(invoice)} className="p-2 text-green-600"><PrintIcon className="w-5 h-5"/></button>
                             {hasPermission('purchase:edit_invoice') && invoice.type === 'purchase' && <button onClick={() => handleEditClick(invoice)} className="p-2 text-blue-600"><EditIcon className="w-5 h-5"/></button>}
                             {invoice.type === 'purchase' && <button onClick={() => handleReturnClick(invoice)} className="p-2 text-orange-600" title="مرجوعی"><PlusIcon className="w-5 h-5 transform rotate-45" /></button>}
                           </div>
                        </div>
                         <div className="space-y-2 text-md">
                            <div className="flex justify-between"><span className="text-slate-500">تأمین کننده:</span> <span className="font-semibold">{suppliers.find(s => s.id === invoice.supplierId)?.name || 'ناشناس'}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">تاریخ:</span> <span className="font-semibold">{new Date(invoice.timestamp).toLocaleDateString('fa-IR')}</span></div>
                         </div>
                        <div className="mt-3 pt-3 border-t">
                             <div className="flex justify-between text-lg"><span className="text-slate-500">مبلغ کل:</span> <span className="font-bold text-blue-600">{formatCurrency(invoice.totalAmount, storeSettings, getInvoiceCurrencyName(invoice))}</span></div>
                        </div>
                    </div>
                ))}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-0 md:p-4 modal-animate">
                    <div className="bg-white/80 backdrop-blur-xl p-4 md:p-6 rounded-none md:rounded-2xl shadow-2xl border border-gray-200/80 w-full h-full md:max-w-5xl md:h-[95vh] flex flex-col" onFocusCapture={(e) => {
                        const target = e.target as HTMLElement;
                        const name = target.getAttribute('name');
                        const index = target.getAttribute('data-index');
                        if (name) {
                            activeFieldRef.current = index ? { name, index: parseInt(index, 10) } : { name };
                        }
                    }}>
                        <div className="flex-shrink-0 flex justify-between items-center pb-4 border-b border-slate-200">
                            <h2 className="text-xl md:text-2xl font-bold text-slate-800">{editingPurchaseInvoiceId ? 'ویرایش فاکتور خرید' : 'ثبت فاکتور خرید جدید'}</h2>
                            <button onClick={handleCloseModal} className="p-1 rounded-full text-slate-500 hover:bg-slate-200/50 transition-colors"><XIcon /></button>
                        </div>
                        
                        <div className="flex-grow overflow-y-auto pt-4 -mx-2 px-2">
                           <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className="w-full h-12 p-3 bg-white/80 border border-gray-300 rounded-lg form-input outline-none focus:ring-4 focus:ring-blue-100" required>
                                    <option value="">-- انتخاب تأمین کننده --</option>
                                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                                <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} type="text" className="w-full h-12 p-3 bg-white/80 border border-gray-300 rounded-lg form-input outline-none focus:ring-4 focus:ring-blue-100" placeholder="شماره فاکتور (اختیاری)" />
                                <input value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} type="date" className="w-full h-12 p-3 bg-white/80 border border-gray-300 rounded-lg form-input outline-none focus:ring-4 focus:ring-blue-100" required />
                           </div>

                           <div className="flex items-center gap-4 mb-6 bg-blue-50 p-3 rounded-lg border border-blue-100">
                                <span className="font-bold text-slate-700">ارز فاکتور:</span>
                                <div className="flex items-center gap-3">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input 
                                            type="radio" 
                                            name="currency" 
                                            value="AFN" 
                                            checked={currency === 'AFN'} 
                                            onChange={() => { setCurrency('AFN'); setExchangeRate(''); }} 
                                            className="form-radio text-blue-600" 
                                        />
                                        <span>افغانی</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input 
                                            type="radio" 
                                            name="currency" 
                                            value="USD" 
                                            checked={currency === 'USD'} 
                                            onChange={() => setCurrency('USD')} 
                                            className="form-radio text-green-600" 
                                        />
                                        <span>دلار</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input 
                                            type="radio" 
                                            name="currency" 
                                            value="IRT" 
                                            checked={currency === 'IRT'} 
                                            onChange={() => setCurrency('IRT')} 
                                            className="form-radio text-orange-600" 
                                        />
                                        <span>تومان</span>
                                    </label>
                                </div>
                                {currency !== 'AFN' && (
                                    <div className="flex items-center gap-2 mr-auto">
                                        <span className="text-sm font-semibold">نرخ {currency === 'USD' ? 'هر دلار به افغانی' : 'هر افغانی به تومان'}:</span>
                                        <input 
                                            name="exchangeRate"
                                            type="text" 
                                            inputMode="numeric"
                                            value={exchangeRate} 
                                            onChange={e => setExchangeRate(e.target.value.replace(/[^0-9.]/g, ''))} 
                                            placeholder="نرخ" 
                                            className="w-24 h-9 p-2 border rounded-md text-center font-mono outline-none focus:ring-2 focus:ring-blue-400" 
                                        />
                                    </div>
                                )}
                           </div>
                           
                           <div className="relative mb-2">
                                <input 
                                    type="text"
                                    value={productSearch}
                                    name="productSearch"
                                    onChange={e => setProductSearch(e.target.value)}
                                    placeholder="جستجوی کالا برای افزودن به فاکتور..."
                                    className="w-full h-12 p-3 pr-32 bg-white/80 border border-gray-300 rounded-lg form-input outline-none focus:ring-4 focus:ring-blue-100"
                                />
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                    <button type="button" onClick={toggleLanguage} className="px-3 py-1.5 text-xs font-semibold rounded-md bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors">{recognitionLang === 'fa-IR' ? 'FA' : 'EN'}</button>
                                    <button onClick={toggleListening} className={`p-2 rounded-full transition-colors ${isListening ? 'bg-red-500 text-white animate-pulse' : 'text-gray-500 hover:text-blue-600 hover:bg-gray-100'}`}><MicIcon className="w-5 h-5"/></button>
                                    <SearchIcon className="text-slate-400 w-5 h-5" />
                                </div>
                                {filteredProducts.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg max-h-52 overflow-y-auto border">
                                        {filteredProducts.map(p => (
                                            <div key={p.id} onClick={() => handleAddItem(p)} className="p-3 hover:bg-blue-100/50 cursor-pointer">{p.name}</div>
                                        ))}
                                    </div>
                                )}
                           </div>

                           <div className="space-y-3 mt-4">
                                {items.map((item, index) => {
                                    const product = products.find(p => p.id === item.productId);
                                    if (!product) return null;
                                    const validation = lotValidations[index];
                                    return (
                                        <div key={index} className={`p-4 rounded-xl border transition-colors ${validation.isDuplicate ? 'bg-red-50 border-red-300' : 'bg-white/50 border-slate-200'}`}>
                                            <div className="flex justify-between items-center mb-4">
                                                <h4 className="font-semibold text-slate-800 truncate text-md">{product.name}</h4>
                                                <button onClick={() => handleRemoveItem(index)} className="text-red-500 hover:bg-red-100 p-1.5 rounded-lg transition-colors"><TrashIcon className="w-5 h-5"/></button>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                 <div className="col-span-2 md:col-span-1">
                                                    <label className="text-xs font-bold text-slate-500 mb-2 block">تعداد</label>
                                                    <PackageUnitInput
                                                        totalUnits={Number(item.quantity || 0)}
                                                        itemsPerPackage={product.itemsPerPackage || 1}
                                                        onChange={(total) => handleItemChange(index, 'quantity', total)}
                                                    />
                                                </div>
                                                <div className="col-span-1">
                                                    <label className="text-xs font-bold text-slate-500 mb-2 block">
                                                        قیمت خرید ({currency})
                                                    </label>
                                                    <input type="text" name="purchasePrice" data-index={index} value={item.purchasePrice} onChange={e => handleItemChange(index, 'purchasePrice', e.target.value)} placeholder="0" className="w-full h-12 p-3 bg-white/80 border border-gray-300 rounded-lg form-input outline-none focus:ring-4 focus:ring-blue-100 font-bold text-center" />
                                                </div>
                                                <div className="col-span-1">
                                                    <label className={`text-xs font-bold mb-2 block ${validation.isDuplicate ? 'text-red-600' : 'text-slate-500'} flex justify-between`}>
                                                        <span>شماره لات (سریال)</span>
                                                        <span className="text-red-500 font-bold">*</span>
                                                    </label>
                                                    <input 
                                                        type="text" 
                                                        name="lotNumber" 
                                                        data-index={index} 
                                                        value={item.lotNumber} 
                                                        onChange={e => handleItemChange(index, 'lotNumber', e.target.value)} 
                                                        placeholder="اجباری" 
                                                        className={`w-full h-12 p-3 bg-white/80 border-2 ${validation.isDuplicate ? 'border-red-500 ring-2 ring-red-100' : 'border-gray-300'} rounded-lg form-input font-mono outline-none focus:ring-4 focus:ring-blue-100 text-center`} 
                                                    />
                                                    {validation.isDuplicate && <p className="text-[10px] text-red-600 mt-1 font-bold">این شماره تکراری است!</p>}
                                                </div>
                                                <div className="col-span-2 md:col-span-1">
                                                   <label className="text-xs font-bold text-slate-500 mb-2 block">تاریخ انقضا</label>
                                                   {item.showExpiry ? (
                                                    <input type="date" value={item.expiryDate} onChange={e => handleItemChange(index, 'expiryDate', e.target.value)} className="w-full h-12 p-3 bg-white/80 border border-gray-300 rounded-lg text-sm form-input outline-none focus:ring-4 focus:ring-blue-100 font-bold"/>
                                                   ) : (
                                                    <button onClick={() => handleItemChange(index, 'showExpiry', true)} className="w-full h-12 text-sm text-blue-600 font-bold bg-white/80 rounded-lg border-2 border-dashed border-blue-200 hover:bg-blue-50 transition-colors">افزودن انقضا</button>
                                                   )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                           </div>
                        </div>

                        <div className="flex-shrink-0 flex flex-col md:flex-row justify-between items-center mt-6 pt-4 border-t border-slate-200">
                           <div className="text-xl md:text-2xl font-bold text-slate-700 w-full md:w-auto text-center md:text-right mb-4 md:mb-0">
                                <span>مجموع کل ({currency === 'USD' ? 'دلار' : (currency === 'IRT' ? 'تومان' : 'افغانی')}): </span>
                                <span className="text-blue-600">{totalAmount.toLocaleString()} {currency === 'USD' ? '$' : (currency === 'IRT' ? 'تومان' : 'AFN')}</span>
                           </div>
                           <div className="flex w-full md:w-auto space-x-3 space-x-reverse">
                               <button type="button" onClick={handleCloseModal} className="flex-1 px-6 py-3 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors font-semibold">لغو</button>
                               <button 
                                    type="button" 
                                    onClick={handleSaveInvoice} 
                                    disabled={hasAnyValidationError}
                                    className={`flex-1 px-8 py-3 rounded-lg text-white font-semibold transition-all ${hasAnyValidationError ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 btn-primary'}`}
                                >
                                    {editingPurchaseInvoiceId ? 'بروزرسانی' : 'ذخیره نهایی'}
                                </button>
                           </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Purchases;