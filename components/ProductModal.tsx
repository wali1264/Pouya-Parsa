import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Product, ProductBatch, SpeechRecognition, SpeechRecognitionEvent, SpeechRecognitionErrorEvent } from '../types';
import { XIcon, ChevronDownIcon, MicIcon, WarningIcon } from './icons';
import { parseToPackageAndUnits, parseToTotalUnits, toEnglishDigits } from '../utils/formatters';
import { useAppContext } from '../AppContext';


type ProductFormData = Omit<Product, 'id' | 'batches'>;
type FirstBatchData = Omit<ProductBatch, 'id'>;

type FormState = {
    id?: string;
    name: string;
    salePrice: string;
    itemsPerPackage: string;
    barcode: string;
    manufacturer: string;
    purchasePrice: string;
    lotNumber: string;
    expiryDate: string;
    stock: number;
};


interface ProductModalProps {
    product: Product | null;
    onClose: () => void;
    onSave: (productData: ProductFormData, firstBatchData: FirstBatchData) => void;
}

const persianDigitsMap: { [key: string]: string } = { '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9' };
const wordToNumberMap: { [key: string]: number } = {
  'صفر': 0, 'یک': 1, 'دو': 2, 'سه': 3, 'چهار': 4, 'پنج': 5, 'شش': 6, 'هفت': 7, 'هشت': 8, 'نه': 9, 'ده': 10,
  'یازده': 11, 'دوازده': 12, 'سیزده': 13, 'چهارده': 14, 'پانزده': 15, 'شانزده': 16, 'هفده': 17, 'هجده': 18, 'نوزده': 19,
  'بیست': 20, 'سی': 30, 'چهل': 40, 'پنجاه': 50, 'شصت': 60, 'هفتاد': 70, 'هشتاد': 80, 'نود': 90,
  'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
  'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15, 'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19,
  'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90,
};

const parseSpokenNumber = (transcript: string): string => {
    let processedTranscript = transcript.replace(/[۰-۹]/g, d => persianDigitsMap[d]);
    const words = processedTranscript.toLowerCase().split(/\s+/);
    const numbers = words.map(word => wordToNumberMap[word] ?? parseInt(word.replace(/[^0-9]/g, ''), 10)).filter(num => !isNaN(num));
    if (numbers.length > 0) {
        return numbers.join('');
    }
    return transcript;
};

const parseSmartDate = (transcript: string): string => {
    const normalized = transcript.replace(/[۰-۹]/g, d => persianDigitsMap[d]);
    const numbers = normalized.split(/\s+/).map(word => {
        const num = parseInt(word, 10);
        if (!isNaN(num)) return num;
        return wordToNumberMap[word.toLowerCase()];
    }).filter(n => n !== undefined) as number[];

    if (numbers.length < 2) return ''; 

    let month, year;
    const n1 = numbers[0];
    const n2 = numbers[1];

    if (n1 > 12 && n2 >= 1 && n2 <= 12) { [year, month] = [n1, n2]; } 
    else if (n2 > 12 && n1 >= 1 && n1 <= 12) { [month, year] = [n1, n2]; } 
    else if (n1 <= 12 && n2 < 100) { month = n1; year = 2000 + n2; } 
    else if (n2 <= 12 && n1 < 100) { month = n2; year = 2000 + n1; } 
    else { return ''; }

    if (month >= 1 && month <= 12 && year > 2000) {
        const lastDay = new Date(year, month, 0).getDate();
        const monthStr = String(month).padStart(2, '0');
        const dayStr = String(lastDay).padStart(2, '0');
        return `${year}-${monthStr}-${dayStr}`;
    }
    return '';
};

const FormInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string; id: string; error?: string, inputRef?: React.Ref<HTMLInputElement> }> = ({ label, id, error, inputRef, ...props }) => (
    <div>
        <label htmlFor={id} className="block text-md font-semibold text-slate-700 mb-2">{label}</label>
        <input 
            id={id} 
            ref={inputRef}
            {...props} 
            className={`w-full p-3 bg-white/80 border ${error ? 'border-red-500 ring-2 ring-red-50' : 'border-slate-300/80'} rounded-lg shadow-sm focus:ring-0 transition-all placeholder:text-slate-400 form-input`}
        />
         {error && <p className="text-red-500 text-xs mt-1 font-bold">{error}</p>}
    </div>
);

const ProductModal: React.FC<ProductModalProps> = ({ product, onClose, onSave }) => {
    const { products, storeSettings } = useAppContext();
    const productToFormState = (p: Product | null): FormState => {
        const firstBatch = p?.batches[0];
        return {
            id: p?.id || undefined,
            name: p?.name || '',
            salePrice: p?.salePrice?.toString() || '',
            itemsPerPackage: p?.itemsPerPackage?.toString() || '1',
            barcode: p?.barcode || '',
            manufacturer: p?.manufacturer || '',
            purchasePrice: firstBatch?.purchasePrice?.toString() || '',
            lotNumber: firstBatch?.lotNumber || '',
            expiryDate: firstBatch?.expiryDate || '',
            stock: firstBatch?.stock || 0,
        };
    };

    const [formData, setFormData] = useState<FormState>(productToFormState(product));
    const [stockPackages, setStockPackages] = useState('');
    const [stockUnits, setStockUnits] = useState('');
    const [isDetailsOpen, setIsDetailsOpen] = useState(!!(product?.barcode || product?.manufacturer || product?.batches[0]?.expiryDate));
    const [errors, setErrors] = useState<{ [key: string]: string }>({});
    
    // Multi-currency purchase states
    const [purchaseCurrency, setPurchaseCurrency] = useState<'AFN' | 'USD' | 'IRT'>(storeSettings.baseCurrency || 'AFN');
    const [purchaseExchangeRate, setPurchaseExchangeRate] = useState('');

    const [isListening, setIsListening] = useState(false);
    const [micError, setMicError] = useState('');
    const [recognitionLang, setRecognitionLang] = useState<'fa-IR' | 'en-US'>('fa-IR');
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const activeFieldRef = useRef<HTMLInputElement | null>(null);

    const numericFields = ['purchasePrice', 'salePrice', 'itemsPerPackage', 'lotNumber', 'stockPackages', 'stockUnits', 'purchaseExchangeRate'];

    // Intelligence: Check for duplicate product name
    const isNameDuplicate = useMemo(() => {
        const currentName = formData.name.trim();
        if (!currentName) return false;
        return products.some(p => p.id !== product?.id && p.name.trim() === currentName);
    }, [formData.name, products, product]);

    
    useEffect(() => {
        const itemsPerPack = Number(formData.itemsPerPackage) || 1;
        const { packages, units } = parseToPackageAndUnits(formData.stock, itemsPerPack);
        setStockPackages(packages > 0 ? String(packages) : '');
        setStockUnits(units > 0 ? String(units) : '');
    }, [formData.stock, formData.itemsPerPackage]);

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
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
                    const field = activeFieldRef.current;
                    const fieldName = field.name;
                    let processedTranscript: string;

                    if (fieldName === 'expiryDate') {
                        processedTranscript = parseSmartDate(finalTranscript);
                    } else if (numericFields.includes(fieldName)) {
                        processedTranscript = parseSpokenNumber(finalTranscript);
                    } else {
                        processedTranscript = finalTranscript.trim();
                    }
                    
                    if (fieldName === 'purchaseExchangeRate') {
                        setPurchaseExchangeRate(processedTranscript);
                    } else {
                        field.value = processedTranscript;
                        field.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }
            };

            recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
                if (event.error === 'not-allowed') setMicError('دسترسی میکروفون مسدود است.');
                setIsListening(false);
            };
            recognition.onend = () => setIsListening(false);
            recognitionRef.current = recognition;
        }
    }, []);

    useEffect(() => {
        if (recognitionRef.current) {
            recognitionRef.current.lang = recognitionLang;
        }
    }, [recognitionLang]);

    const toggleListening = async () => {
        if (!recognitionRef.current) return;
        setMicError(''); 
        if (isListening) {
            recognitionRef.current.stop();
        } else {
            try {
                recognitionRef.current.start();
                setIsListening(true);
            } catch (e) { setMicError("خطا در دسترسی به میکروفون."); }
        }
    };


    const toggleLanguage = () => setRecognitionLang(prev => prev === 'fa-IR' ? 'en-US' : 'fa-IR');
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        let processedValue = toEnglishDigits(value);
        
        if (['itemsPerPackage', 'lotNumber'].includes(name)) {
            processedValue = processedValue.replace(/[^0-9]/g, '');
        } else if (['purchasePrice', 'salePrice', 'purchaseExchangeRate'].includes(name)) {
            processedValue = processedValue.replace(/[^0-9.]/g, '');
            if ((processedValue.match(/\./g) || []).length > 1) return;
        }

        if (name === 'purchaseExchangeRate') {
            setPurchaseExchangeRate(processedValue);
        } else {
            setFormData(prev => ({ ...prev, [name]: processedValue }));
        }

        if (errors[name]) {
            setErrors(prev => { const newErrors = { ...prev }; delete newErrors[name]; return newErrors; });
        }
    };

    const handleStockChange = (packagesStr: string, unitsStr: string) => {
        const packages = Number(packagesStr) || 0;
        const units = Number(unitsStr) || 0;
        const itemsPerPack = Number(formData.itemsPerPackage) || 1;
        setFormData(prev => ({ ...prev, stock: parseToTotalUnits(packages, units, itemsPerPack) }));
    };

    
    const validate = () => {
        const newErrors: { [key: string]: string } = {};
        if (!formData.name.trim()) newErrors.name = "نام محصول اجباری است";
        if (isNameDuplicate) newErrors.name = "محصولی با این نام قبلاً ثبت شده است";
        if (!formData.purchasePrice || Number(formData.purchasePrice) <= 0) newErrors.purchasePrice = "قیمت خرید نامعتبر است";
        if (purchaseCurrency !== storeSettings.baseCurrency && (!purchaseExchangeRate || Number(purchaseExchangeRate) <= 0)) newErrors.purchaseExchangeRate = "نرخ ارز الزامی است";
        if (!formData.salePrice || Number(formData.salePrice) <= 0) newErrors.salePrice = "قیمت فروش نامعتبر است";
        if (!formData.lotNumber.trim()) newErrors.lotNumber = "شماره لات اجباری است";
        
        if (formData.expiryDate) {
            const todayStr = new Date().toISOString().split('T')[0];
            if (formData.expiryDate < todayStr) newErrors.expiryDate = "تاریخ انقضا در گذشته است";
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (validate()) {
            const baseCurrency = storeSettings.baseCurrency || 'AFN';
            const config = storeSettings.currencyConfigs[purchaseCurrency];
            const exchangeRateValue = (purchaseCurrency === baseCurrency || product) ? 1 : Number(purchaseExchangeRate);
            
            const finalPurchasePriceBase = purchaseCurrency === baseCurrency 
                ? Number(formData.purchasePrice)
                : (config.method === 'multiply' ? Number(formData.purchasePrice) * exchangeRateValue : Number(formData.purchasePrice) / exchangeRateValue);

            const finalSalePriceBase = purchaseCurrency === baseCurrency
                ? Number(formData.salePrice)
                : (config.method === 'multiply' ? Number(formData.salePrice) * exchangeRateValue : Number(formData.salePrice) / exchangeRateValue);

            const productData: ProductFormData = {
                name: formData.name.trim(),
                salePrice: finalSalePriceBase, 
                itemsPerPackage: formData.itemsPerPackage ? Number(formData.itemsPerPackage) : 1,
                barcode: formData.barcode?.trim() || undefined,
                manufacturer: formData.manufacturer?.trim() || undefined,
            };
            const firstBatchData: FirstBatchData = {
                purchasePrice: finalPurchasePriceBase,
                stock: Number(formData.stock),
                lotNumber: formData.lotNumber.trim(),
                purchaseDate: new Date().toISOString(),
                expiryDate: formData.expiryDate || undefined,
            }
            if (product) {
                onSave({ ...product, ...productData }, firstBatchData);
            } else {
                 onSave(productData, firstBatchData);
            }
        }
    };

    const formRef = useRef<HTMLFormElement>(null);
    const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const focusable = Array.from(formRef.current?.querySelectorAll('input:not([disabled]), button[type="submit"]') || []) as HTMLElement[];
            const currentIndex = focusable.indexOf(e.target as HTMLElement);
            if (currentIndex > -1 && currentIndex < focusable.length - 1) focusable[currentIndex + 1].focus();
            else handleSubmit(e as any);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-animate">
            <div className="bg-white/80 backdrop-blur-xl p-6 md:p-8 rounded-2xl shadow-2xl border border-gray-200/80 w-full max-w-2xl">
                <div className="flex justify-between items-center pb-4 border-b border-slate-200">
                    <div className="flex items-center space-x-3 space-x-reverse">
                        <h2 className="text-xl md:text-2xl font-bold text-slate-800">{product ? 'ویرایش محصول' : 'افزودن محصول جدید'}</h2>
                        <button type="button" onClick={toggleListening} className={`p-2 rounded-full transition-colors ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>
                            <MicIcon className="w-5 h-5" />
                        </button>
                        <button type="button" onClick={toggleLanguage} className="px-2.5 py-1 text-xs font-bold rounded bg-slate-200 text-slate-600">
                            {recognitionLang === 'fa-IR' ? 'FA' : 'EN'}
                        </button>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full text-slate-500 hover:bg-slate-200/50"><XIcon /></button>
                </div>

                {micError && <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-center gap-2"><WarningIcon className="w-5 h-5" /> {micError}</div>}

                <form ref={formRef} onSubmit={handleSubmit} onFocusCapture={(e) => { activeFieldRef.current = e.target as any; }} className="space-y-5 mt-6 max-h-[70vh] overflow-y-auto pr-2">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <FormInput 
                            label="نام محصول" 
                            id="name" 
                            name="name" 
                            type="text" 
                            value={formData.name} 
                            onChange={handleInputChange} 
                            placeholder="مثال: خودکار آبی بیک" 
                            required 
                            error={errors.name} 
                            onKeyDown={handleKeyDown} 
                        />
                        <FormInput 
                            label="شماره لات اولیه" 
                            id="lotNumber" 
                            name="lotNumber" 
                            type="text" 
                            value={formData.lotNumber} 
                            onChange={handleInputChange} 
                            placeholder="مثال: 1" 
                            required 
                            error={errors.lotNumber} 
                            onKeyDown={handleKeyDown} 
                            disabled={!!product} 
                        />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                       <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-md font-semibold text-slate-700">قیمت خرید ({purchaseCurrency})</label>
                                <div className="flex gap-1.5 bg-slate-100 p-0.5 rounded-lg border">
                                    {(['AFN', 'USD', 'IRT'] as const).map(cur => (
                                        <button 
                                            key={cur}
                                            type="button"
                                            onClick={() => { 
                                                setPurchaseCurrency(cur); 
                                                if (cur === storeSettings.baseCurrency) setPurchaseExchangeRate(''); 
                                            }}
                                            className={`px-2 py-0.5 text-[10px] font-black rounded ${purchaseCurrency === cur ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                                            disabled={!!product}
                                        >
                                            {cur}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <input 
                                    id="purchasePrice" 
                                    name="purchasePrice" 
                                    type="text" 
                                    inputMode="decimal" 
                                    value={formData.purchasePrice} 
                                    onChange={handleInputChange} 
                                    required 
                                    className={`flex-grow p-3 bg-white/80 border ${errors.purchasePrice ? 'border-red-500 ring-2 ring-red-50' : 'border-slate-300/80'} rounded-lg shadow-sm focus:ring-0 transition-all placeholder:text-slate-400 font-bold text-center form-input`}
                                    disabled={!!product}
                                />
                                {purchaseCurrency !== storeSettings.baseCurrency && !product && (
                                    <div className="w-24">
                                        <input 
                                            name="purchaseExchangeRate" 
                                            type="text" 
                                            inputMode="decimal" 
                                            value={purchaseExchangeRate} 
                                            onChange={handleInputChange} 
                                            placeholder="نرخ" 
                                            title={`نرخ هر ${storeSettings.currencyConfigs[storeSettings.baseCurrency]?.name || storeSettings.baseCurrency} به ارز انتخابی`}
                                            className={`w-full h-full p-2 bg-blue-50 border-2 border-blue-200 rounded-lg text-center font-mono font-black focus:border-blue-500 outline-none ${errors.purchaseExchangeRate ? 'border-red-500' : ''}`}
                                        />
                                    </div>
                                )}
                            </div>
                            {errors.purchasePrice && <p className="text-red-500 text-[10px] mt-1 font-bold">{errors.purchasePrice}</p>}
                            {errors.purchaseExchangeRate && <p className="text-red-500 text-[10px] mt-1 font-bold">{errors.purchaseExchangeRate}</p>}
                            {purchaseCurrency !== 'AFN' && !product && purchaseExchangeRate && formData.purchasePrice && (
                                <p className="text-[10px] text-blue-500 font-bold mt-1">
                                    معادل خرید: {purchaseCurrency === 'IRT' 
                                        ? (Number(formData.purchasePrice) / Number(purchaseExchangeRate)).toLocaleString() 
                                        : (Number(formData.purchasePrice) * Number(purchaseExchangeRate)).toLocaleString()} افغانی
                                </p>
                            )}
                       </div>
                       
                       <div>
                            <FormInput 
                                label={`قیمت فروش (${purchaseCurrency === 'AFN' || !!product ? 'AFN' : purchaseCurrency})`} 
                                id="salePrice" 
                                name="salePrice" 
                                type="text" 
                                inputMode="decimal" 
                                value={formData.salePrice} 
                                onChange={handleInputChange} 
                                required 
                                error={errors.salePrice} 
                                onKeyDown={handleKeyDown} 
                            />
                            {purchaseCurrency !== 'AFN' && !product && purchaseExchangeRate && formData.salePrice && (
                                <p className="text-[10px] text-emerald-600 font-bold mt-1">
                                    معادل فروش: {purchaseCurrency === 'IRT' 
                                        ? (Number(formData.salePrice) / Number(purchaseExchangeRate)).toLocaleString() 
                                        : (Number(formData.salePrice) * Number(purchaseExchangeRate)).toLocaleString()} افغانی
                                </p>
                            )}
                       </div>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <FormInput label="تعداد در بسته" id="itemsPerPackage" name="itemsPerPackage" type="text" inputMode="numeric" value={formData.itemsPerPackage} onChange={handleInputChange} placeholder="مثال: 12" onKeyDown={handleKeyDown} />
                        <FormInput label={`موجودی (${storeSettings.packageLabel || 'بسته'})`} id="stockPackages" name="stockPackages" type="text" inputMode="numeric" value={stockPackages} onInput={(e: any) => { const v = toEnglishDigits(e.target.value).replace(/[^0-9]/g, ''); setStockPackages(v); handleStockChange(v, stockUnits); }} disabled={Number(formData.itemsPerPackage) <= 1 || !!product} onKeyDown={handleKeyDown} error={errors.stock} />
                        <FormInput label={`موجودی (${storeSettings.unitLabel || 'عدد'})`} id="stockUnits" name="stockUnits" type="text" inputMode="numeric" value={stockUnits} onInput={(e: any) => { const v = toEnglishDigits(e.target.value).replace(/[^0-9]/g, ''); setStockUnits(v); handleStockChange(stockPackages, v); }} disabled={!!product} onKeyDown={handleKeyDown} />
                    </div>

                    <div className="border-t border-slate-200 pt-4">
                        <button type="button" onClick={() => setIsDetailsOpen(!isDetailsOpen)} className="w-full flex justify-between items-center text-slate-700 font-semibold p-2 hover:bg-slate-100/50 rounded-lg transition-colors">
                            <span>افزودن جزئیات بیشتر (انقضا، بارکد)</span>
                            <ChevronDownIcon className={`w-5 h-5 transition-transform duration-300 ${isDetailsOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isDetailsOpen && (
                            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-5 animate-fade-in">
                                <FormInput label=" کد محصول (بارکد)" id="barcode" name="barcode" type="text" value={formData.barcode} onChange={handleInputChange} placeholder="اسکن بارکد" onKeyDown={handleKeyDown} />
                                <FormInput label="شرکت سازنده" id="manufacturer" name="manufacturer" type="text" value={formData.manufacturer} onChange={handleInputChange} onKeyDown={handleKeyDown} />
                                <FormInput label="تاریخ انقضا" id="expiryDate" name="expiryDate" type="date" value={formData.expiryDate} onChange={handleInputChange} onKeyDown={handleKeyDown} error={errors.expiryDate} disabled={!!product}/>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end space-x-3 space-x-reverse pt-5 border-t">
                        <button type="button" onClick={onClose} className="px-6 py-3 rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 font-semibold">انصراف</button>
                        <button 
                            type="submit" 
                            disabled={isNameDuplicate}
                            className={`px-8 py-3 rounded-lg text-white font-semibold transition-all ${isNameDuplicate ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 btn-primary'}`}
                        >
                            ذخیره
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProductModal;