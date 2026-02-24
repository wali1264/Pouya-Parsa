import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { InvoiceItem, Product, SaleInvoice, SpeechRecognition, SpeechRecognitionEvent, SpeechRecognitionErrorEvent, Customer, SalesMemoImage, Service, CartItem } from '../types';
import { useAppContext } from '../AppContext';
import { MicIcon, EditIcon, PrintIcon, TrashIcon, CameraIcon, GalleryIcon, XIcon, CheckIcon, BarcodeIcon, PlusIcon, UserGroupIcon, ChevronDownIcon, WarningIcon } from '../components/icons';
import Toast from '../components/Toast';
import PrintPreviewModal from '../components/PrintPreviewModal';
import FloatingGallery from '../components/FloatingGallery';
import * as db from '../utils/db';
import { formatCurrency, toEnglishDigits } from '../utils/formatters';
import DateRangeFilter from '../components/DateRangeFilter';
import POSCartItem from '../components/POSCartItem';
import PackageUnitInput from '../components/PackageUnitInput';


// Extracted ProductSide Component
const ProductSide: React.FC<{
    searchContainerRef: React.RefObject<HTMLDivElement>, 
    memoFileInputRef: React.RefObject<HTMLInputElement>, 
    searchInputRef: React.RefObject<HTMLInputElement>, 
    searchTerm: string, 
    setSearchTerm: (term: string) => void,
    setIsSearchFocused: (isFocused: boolean) => void, 
    handleTakePhotoClick: () => void, 
    handlePhotoTaken: (event: React.ChangeEvent<HTMLInputElement>) => void, 
    isBarcodeModeActive: boolean,
    setIsBarcodeModeActive: (isActive: boolean) => void, 
    isListening: boolean, 
    toggleListening: () => void, 
    recognitionLang: string, 
    toggleLanguage: () => void,
    isSearchFocused: boolean, 
    dropdownProducts: Product[], 
    handleDropdownItemClick: (product: Product) => void, 
    addToCart: (item: Product | Service, type: 'product' | 'service') => void, 
    storeSettings: any,
    // Props for MiniCart
    cart: CartItem[],
    editingPriceItemId: string | null,
    setEditingPriceItemId: (id: string | null) => void,
    updateCartItemQuantity: (itemId: string, itemType: 'product' | 'service', newQuantity: number) => { success: boolean, message: string },
    removeFromCart: (itemId: string, itemType: 'product' | 'service') => void,
    updateCartItemFinalPrice: (itemId: string, itemType: 'product' | 'service', finalPrice: number) => void,
    hasPermission: (permission: string) => boolean,
    currency: 'AFN' | 'USD' | 'IRT',
    exchangeRate: string,
    onMobileCheckout: () => void
}> = ({
    searchContainerRef, memoFileInputRef, searchInputRef, searchTerm, setSearchTerm,
    setIsSearchFocused, handleTakePhotoClick, handlePhotoTaken, isBarcodeModeActive,
    setIsBarcodeModeActive, isListening, toggleListening, recognitionLang, toggleLanguage,
    isSearchFocused, dropdownProducts, handleDropdownItemClick,
    addToCart, storeSettings, cart, editingPriceItemId, setEditingPriceItemId,
    updateCartItemQuantity, removeFromCart, updateCartItemFinalPrice, hasPermission,
    currency, exchangeRate, onMobileCheckout
}) => {
    
    const baseCurrency = storeSettings.baseCurrency || 'AFN';
    const baseCurrencyName = storeSettings.currencyConfigs?.[baseCurrency]?.name || 'AFN';

    const cartTotalBase = cart.reduce((total, item) => {
        const price = (item.type === 'product' && item.finalPrice !== undefined) ? item.finalPrice : (item.type === 'product' ? item.salePrice : item.price);
        return total + (price * item.quantity);
    }, 0);

    return (
    <>
        <div ref={searchContainerRef} className="relative mb-4 flex-shrink-0">
             <input
                type="file"
                accept="image/*"
                capture="environment"
                ref={memoFileInputRef}
                onChange={handlePhotoTaken}
                className="hidden"
            />
            <input
                ref={searchInputRef}
                type="text"
                placeholder="جستجو یا اسکن..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                className="w-full p-3 md:p-4 pl-32 md:pl-48 rounded-xl bg-white/80 border-2 border-transparent shadow-sm form-input text-sm md:text-base"
            />
            <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center h-full">
                <div className="flex items-center gap-0.5 md:gap-1">
                    <button 
                        onClick={() => setIsBarcodeModeActive(!isBarcodeModeActive)} 
                        className={`hidden md:block p-1.5 md:p-2 rounded-lg transition-all duration-200 ${isBarcodeModeActive ? 'bg-green-100 text-green-700' : 'text-slate-500 hover:bg-slate-200/60'}`}
                    >
                        <BarcodeIcon className="w-5 h-5 md:w-6 md:h-6"/>
                    </button>
                    <button onClick={toggleListening} className={`p-1.5 md:p-2 rounded-lg transition-all duration-200 ${isListening ? 'bg-red-100 text-red-700 animate-pulse' : 'text-slate-500 hover:bg-slate-200/60'}`}>
                        <MicIcon className="w-5 h-5 md:w-6 md:h-6"/>
                    </button>
                    <button onClick={handleTakePhotoClick} className="p-1.5 md:p-2 rounded-lg text-slate-500 hover:bg-slate-200/60 transition-all duration-200">
                        <CameraIcon className="w-5 h-5 md:w-6 md:h-6"/>
                    </button>
                </div>
                <div className="w-px h-5 bg-slate-300 mx-1"></div>
                <button type="button" onClick={toggleLanguage} className="px-2 py-1 text-xs font-bold rounded bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors">
                    {recognitionLang === 'fa-IR' ? 'FA' : 'EN'}
                </button>
            </div>
            {isSearchFocused && dropdownProducts.length > 0 && (
                <div className="absolute top-full mt-2 w-full bg-white/95 backdrop-blur-xl rounded-xl shadow-lg border border-gray-200/60 z-20 max-h-60 md:max-h-80 overflow-y-auto">
                    <ul>
                        {dropdownProducts.map((product: Product) => (
                            <li 
                                key={product.id}
                                onClick={() => handleDropdownItemClick(product)}
                                className="p-3 md:p-4 flex justify-between items-center hover:bg-blue-100/50 cursor-pointer border-b border-gray-200/60 last:border-b-0"
                            >
                                <span className="font-semibold text-slate-800 text-sm md:text-lg">{product.name}</span>
                                <span className="text-blue-600 font-bold text-sm md:text-base">{formatCurrency(product.salePrice, storeSettings)}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
        
        {/* Mobile Mini Cart Preview (only visible in Product View) */}
        <div className="md:hidden mt-2 pt-2 border-t border-gray-200/60 flex-grow flex flex-col min-h-0 pb-28">
             {cart.length > 0 ? (
                 <div className="space-y-2 overflow-y-auto px-1">
                     {cart.map((item: CartItem) => (
                       <POSCartItem
                           key={`mini-${item.id}-${item.type}`}
                           item={item}
                           isEditingPrice={editingPriceItemId === `${item.id}-${item.type}`}
                           storeSettings={storeSettings}
                           hasPermission={hasPermission}
                           onQuantityChange={(total) => updateCartItemQuantity(item.id, item.type, total)}
                           onRemove={() => removeFromCart(item.id, item.type)}
                           onStartPriceEdit={() => setEditingPriceItemId(`${item.id}-${item.type}`)}
                           onSavePrice={(newPrice) => {
                               updateCartItemFinalPrice(item.id, item.type, newPrice);
                               setEditingPriceItemId(null);
                           }}
                           onCancelPriceEdit={() => setEditingPriceItemId(null)}
                           currency={currency}
                           exchangeRate={exchangeRate}
                       />
                    ))}
                 </div>
             ) : (
                <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                    <p>سبد خرید خالی است</p>
                </div>
             )}
        </div>

        {/* Mobile Sticky Total Bar (Visible in Product View when Cart not empty) */}
        {cart.length > 0 && (
            <div className="md:hidden fixed bottom-[50px] left-0 right-0 z-[90] bg-gradient-to-r from-blue-700 to-indigo-800 p-3 shadow-2xl flex justify-between items-center animate-slide-up-mobile">
                <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-lg">
                         <div className="relative">
                            <PlusIcon className="w-5 h-5 text-white" />
                            <span className="absolute -top-1 -right-1 bg-white text-blue-800 text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-sm">{cart.length}</span>
                         </div>
                    </div>
                    <div>
                        <p className="text-[10px] text-blue-100 font-bold">مجموع فعلی سبد:</p>
                        <p className="text-white font-black">{Math.round(cartTotalBase).toLocaleString()} {baseCurrencyName}</p>
                    </div>
                </div>
                <button 
                    onClick={onMobileCheckout}
                    className="bg-white text-blue-700 px-4 py-2 rounded-xl font-black text-sm flex items-center gap-2 active:scale-95 transition-transform shadow-md"
                >
                    <CheckIcon className="w-4 h-4" />
                    تکمیل و ثبت
                </button>
            </div>
        )}
    </>
    );
};

// Extracted CartSide Component
const CartSide: React.FC<any> = ({
    activeTab, setActiveTab, cart, filteredInvoices, services, setIsGalleryOpen, memoImages,
    editingSaleInvoiceId, handleCancelEdit, updateQuantity, removeFromCart, editingPriceItemId,
    setEditingPriceItemId, updateCartItemFinalPrice, hasPermission, selectedCustomerId,
    setSelectedCustomerId, customers, totalAmount, completeSale, setInvoiceDateRange,
    handlePrintInvoice, handleEditInvoice, storeSettings, setMobileView, addToCart, handleOpenReturnModal,
    isProcessing, currency, setCurrency, exchangeRate, setExchangeRate
}) => {
    
    const rateNum = Number(exchangeRate) || 1;
    const baseCurrency = storeSettings.baseCurrency || 'AFN';
    const baseCurrencyName = storeSettings.currencyConfigs[baseCurrency]?.name || 'AFN';
    const config = storeSettings.currencyConfigs[currency];
    
    const convertedTotal = currency === baseCurrency ? totalAmount : 
                          (config.method === 'multiply' ? Math.round(totalAmount * rateNum) : totalAmount / rateNum);

    const selectedCustomer = customers.find((c: Customer) => c.id === selectedCustomerId);
    const isOverLimit = selectedCustomer && selectedCustomer.creditLimit > 0 && (selectedCustomer.balance + totalAmount) > selectedCustomer.creditLimit;

    return (
     <>
        <div className="flex justify-between items-center mb-2 md:mb-4">
            <div className="flex border-b border-gray-200/60 w-full overflow-x-auto no-scrollbar">
                <button onClick={() => setActiveTab('cart')} className={`py-2 px-3 md:px-6 font-bold text-sm md:text-lg whitespace-nowrap transition-colors relative ${activeTab === 'cart' ? 'text-blue-600' : 'text-slate-500 hover:text-blue-600'}`}>
                    سبد خرید ({cart.length})
                    {activeTab === 'cart' && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-t-full"></div>}
                </button>
                 <button onClick={() => setActiveTab('invoices')} className={`py-2 px-3 md:px-6 font-bold text-sm md:text-lg whitespace-nowrap transition-colors relative ${activeTab === 'invoices' ? 'text-blue-600' : 'text-slate-500 hover:text-blue-600'}`}>
                    فاکتورها
                    {activeTab === 'invoices' && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-t-full"></div>}
                </button>
                 <button onClick={() => setActiveTab('services')} className={`py-2 px-3 md:px-6 font-bold text-sm md:text-lg whitespace-nowrap transition-colors relative ${activeTab === 'services' ? 'text-blue-600' : 'text-slate-500 hover:text-blue-600'}`}>
                    خدمات
                    {activeTab === 'services' && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-t-full"></div>}
                </button>
            </div>
             <button onClick={() => setIsGalleryOpen(true)} className="flex-shrink-0 ml-1 p-2 rounded-full text-gray-500 hover:text-blue-600 hover:bg-gray-100 transition-colors" title="گالری">
                <GalleryIcon className="w-6 h-6" />
                {memoImages.length > 0 && (
                    <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                        {memoImages.length}
                    </span>
                )}
            </button>
        </div>
        
        {activeTab === 'cart' && (
        <>
            {editingSaleInvoiceId && (
                <div className="p-2 mb-2 text-xs md:text-sm bg-amber-100/80 border-r-4 border-amber-500 text-amber-900 rounded-l-md flex justify-between items-center">
                   <p className="font-bold">ویرایش: <span className="font-mono">{editingSaleInvoiceId}</span></p>
                   <button onClick={handleCancelEdit} className="flex items-center font-semibold text-amber-800 hover:text-red-700">
                        <XIcon className="w-4 h-4 ml-1" />
                        لغو
                   </button>
                </div>
            )}
            
            {/* Cart Items List */}
            <div className="flex-grow overflow-y-auto -mx-4 px-4 pb-40 md:pb-4">
                {cart.length === 0 ? (
                    <div className="flex items-center justify-center h-40 md:h-full">
                        <p className="text-slate-500">سبد خرید خالی است.</p>
                    </div>
                ) : (
                    cart.map((item: CartItem) => (
                       <POSCartItem
                           key={`${item.id}-${item.type}`}
                           item={item}
                           isEditingPrice={editingPriceItemId === `${item.id}-${item.type}`}
                           storeSettings={storeSettings}
                           hasPermission={hasPermission}
                           onQuantityChange={(total) => updateQuantity(item.id, item.type, total)}
                           onRemove={() => removeFromCart(item.id, item.type)}
                           onStartPriceEdit={() => setEditingPriceItemId(`${item.id}-${item.type}`)}
                           onSavePrice={(newPrice) => {
                               updateCartItemFinalPrice(item.id, item.type, newPrice);
                               setEditingPriceItemId(null);
                           }}
                           onCancelPriceEdit={() => setEditingPriceItemId(null)}
                           currency={currency}
                           exchangeRate={exchangeRate}
                       />
                    ))
                )}
            </div>
            
            {/* Standard Footer for Desktop */}
            <div className="hidden md:block mt-auto pt-4 border-t-2 border-gray-200/60">
                 {/* Multi-Currency Selection Bar */}
                <div className="flex items-center justify-between mb-4 bg-slate-50 p-2 rounded-xl border border-slate-200">
                    <div className="flex gap-2">
                        {(['AFN', 'USD', 'IRT'] as const).map(c => (
                            <button 
                                key={c}
                                onClick={() => setCurrency(c)} 
                                className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${currency === c ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200'}`}
                            >
                                {c}
                            </button>
                        ))}
                    </div>
                    {currency !== baseCurrency && (
                        <div className="flex items-center gap-2">
                             <span className="text-[10px] font-black text-slate-400">نرخ تبدیل ({baseCurrency} به {currency}):</span>
                             <input 
                                type="text" 
                                inputMode="decimal"
                                value={exchangeRate} 
                                onChange={e => setExchangeRate(toEnglishDigits(e.target.value).replace(/[^0-9.]/g, ''))} 
                                className="w-20 p-1.5 border border-slate-300 rounded-lg text-center font-mono text-xs focus:ring-1 focus:ring-blue-500 outline-none" 
                                placeholder="نرخ"
                             />
                        </div>
                    )}
                </div>

                <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                        <label htmlFor="customer-select" className="text-md font-semibold text-slate-700">مشتری (برای فروش نسیه)</label>
                        {selectedCustomer && (
                            <span className={`text-xs font-bold ${isOverLimit ? 'text-orange-600 animate-pulse' : 'text-slate-400'}`}>
                                {isOverLimit ? '⚠️ سقف اعتبار رد شده' : `تراز: ${Math.round(selectedCustomer.balance).toLocaleString()} ${baseCurrencyName}`}
                            </span>
                        )}
                    </div>
                    <select id="customer-select" value={selectedCustomerId} onChange={e => setSelectedCustomerId(e.target.value)} className={`w-full p-3 bg-white/80 border-2 rounded-lg focus:ring-blue-500 focus:border-blue-500 form-input font-bold ${isOverLimit ? 'border-orange-500 text-orange-700 bg-orange-50' : 'border-gray-300'}`} disabled={!hasPermission('pos:create_credit_sale')}>
                        <option value="">فروش نقدی</option>
                        {customers.map((c: Customer) => (
                            <option key={c.id} value={c.id} className={c.balance > (c.creditLimit || Infinity) ? 'text-orange-600' : ''}>
                                {c.name} {c.balance > 0 ? `(${Math.round(c.balance).toLocaleString()})` : ''}
                            </option>
                        ))}
                    </select>
                </div>
                
                <div className="flex items-center justify-between gap-3">
                     <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-slate-500">مبلغ کل:</span>
                        <div className="flex flex-col items-end">
                            <span className="text-2xl font-extrabold text-blue-700">
                                {convertedTotal.toLocaleString()} {currency === 'USD' ? '$' : (currency === 'IRT' ? 'تومان' : storeSettings.currencyConfigs[currency]?.name || currency)}
                            </span>
                            {currency !== baseCurrency && (
                                <span className="text-[10px] font-bold text-slate-400">
                                    معادل: {totalAmount.toLocaleString()} {baseCurrencyName}
                                </span>
                            )}
                        </div>
                    </div>
                    <button 
                        onClick={completeSale} 
                        className="w-full p-4 bg-blue-600 text-white font-bold text-lg rounded-xl shadow-lg hover:shadow-xl hover:bg-blue-700 transition-all duration-300 transform btn-primary disabled:bg-gray-400 disabled:shadow-none disabled:cursor-wait" 
                        disabled={cart.length === 0 || !hasPermission('pos:create_invoice') || isProcessing}
                    >
                         {isProcessing ? 'در حال ثبت...' : (editingSaleInvoiceId ? 'بروزرسانی' : 'ثبت فاکتور')}
                    </button>
                </div>
            </div>
        </>
        )}

        {activeTab === 'invoices' && (
            <div className="flex flex-col h-full pb-28 md:pb-4">
                 <div className="mb-2 p-2 bg-slate-100/50 rounded-lg overflow-x-auto">
                    <DateRangeFilter onFilterChange={(start: Date, end: Date) => setInvoiceDateRange({ start, end })} />
                </div>
                <div className="flex-grow overflow-y-auto -mx-2 md:-mx-6 px-2 md:px-6">
                     {filteredInvoices.length === 0 ? (
                        <div className="flex items-center justify-center h-40 text-slate-500">
                            <p>فاکتوری یافت نشد.</p>
                        </div>
                     ) : (
                        filteredInvoices.map((invoice: SaleInvoice) => (
                            <div key={invoice.id} className="flex items-center justify-between mb-3 p-3 bg-white/80 rounded-xl shadow-sm border border-gray-200/50">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-mono font-bold text-slate-800 text-sm md:text-lg">{invoice.id.slice(0,8)}..</p>
                                        {invoice.type === 'return' && <span className="text-[10px] font-bold bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded-full">مرجوعی</span>}
                                        {invoice.currency !== 'AFN' && <span className="text-[10px] font-black bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full uppercase">{invoice.currency}</span>}
                                    </div>
                                    <div className="text-sm md:text-md text-blue-600 font-bold">
                                        {invoice.totalAmount.toLocaleString()} {invoice.currency === 'USD' ? '$' : (invoice.currency === 'IRT' ? 'ت' : 'افغانی')}
                                    </div>
                                    <p className="text-xs text-slate-400">{new Date(invoice.timestamp).toLocaleTimeString('fa-IR', {hour: '2-digit', minute:'2-digit'})}</p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => handlePrintInvoice(invoice.id)} className="p-1.5 rounded-full text-gray-500 hover:text-green-600 bg-gray-50 hover:bg-green-100"><PrintIcon className="w-5 h-5"/></button>
                                    {hasPermission('pos:edit_invoice') && invoice.type === 'sale' && <button onClick={() => handleEditInvoice(invoice.id)} className="p-1.5 rounded-full text-gray-500 hover:text-blue-600 bg-gray-50 hover:bg-blue-100"><EditIcon className="w-5 h-5"/></button>}
                                    {invoice.type === 'sale' && <button onClick={() => handleOpenReturnModal(invoice)} className="p-1.5 rounded-full text-gray-500 hover:text-orange-600 bg-gray-50 hover:bg-orange-100"><PlusIcon className="w-5 h-5 transform rotate-45" /></button>}
                                </div>
                            </div>
                        ))
                     )}
                </div>
            </div>
        )}
        {activeTab === 'services' && (
             <div className="flex-grow overflow-y-auto -mx-6 px-6 pb-28 md:pb-4">
                 {services.length === 0 ? (
                    <div className="flex items-center justify-center h-40 text-slate-500 flex-col">
                        <p>خدمتی تعریف نشده.</p>
                    </div>
                 ) : (
                    services.map((service: Service) => (
                        <div key={service.id} onClick={() => {addToCart(service, 'service'); setActiveTab('cart'); setMobileView('cart');}} className="flex items-center justify-between mb-3 p-3 bg-white/80 rounded-xl shadow-sm border border-gray-200/50 cursor-pointer hover:bg-blue-50 transition-colors">
                            <p className="font-bold text-slate-800 text-sm md:text-lg">{service.name}</p>
                            <div className="text-sm md:text-lg font-bold text-green-600">
                                {formatCurrency(service.price, storeSettings)}
                            </div>
                        </div>
                    ))
                 )}
            </div>
        )}
    </>
    );
};

const ReturnModal: React.FC<{ invoice: SaleInvoice, onClose: () => void, onSubmit: (returnItems: { id: string, type: 'product' | 'service', quantity: number }[]) => void }> = ({ invoice, onClose, onSubmit }) => {
    const [returnQuantities, setReturnQuantities] = useState<{[key: string]: number}>({});

    const handleQuantityChange = (item: CartItem, quantity: number) => {
        const key = `${item.id}-${item.type}`;
        const newQuantity = Math.max(0, Math.min(quantity, item.quantity));
        setReturnQuantities(prev => ({...prev, [key]: newQuantity}));
    };
    
    const handleSubmit = () => {
        const returnItems = Object.entries(returnQuantities)
            .filter(([, qty]) => Number(qty) > 0)
            .map(([key, qty]) => {
                const lastDashIndex = key.lastIndexOf('-');
                const id = key.substring(0, lastDashIndex);
                const type = key.substring(lastDashIndex + 1);
                return { id, type: type as 'product' | 'service', quantity: Number(qty) };
            });
        onSubmit(returnItems);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-animate">
            <div className="bg-white/95 backdrop-blur-xl p-4 md:p-6 rounded-2xl shadow-2xl border border-gray-200/80 w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="flex-shrink-0 flex justify-between items-center pb-3 border-b">
                    <h2 className="text-lg md:text-xl font-bold">ثبت مرجوعی <span className="font-mono text-sm">{invoice.id.slice(0,8)}</span></h2>
                    <button onClick={onClose} className="p-1 rounded-full text-slate-500 hover:bg-slate-200/50"><XIcon /></button>
                </div>
                <div className="flex-grow overflow-y-auto pt-4 -mx-2 px-2">
                    <div className="space-y-3">
                        {invoice.items.map(item => {
                            const key = `${item.id}-${item.type}`;
                            return (
                                <div key={key} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                                    <div>
                                        <p className="font-semibold text-sm">{item.name}</p>
                                        <p className="text-xs text-slate-500">خریداری شده: {item.quantity}</p>
                                    </div>
                                    <PackageUnitInput
                                        totalUnits={returnQuantities[key] || 0}
                                        itemsPerPackage={item.type === 'product' ? (item as InvoiceItem).itemsPerPackage || 1 : 1}
                                        onChange={(total) => handleQuantityChange(item, total)}
                                    />
                                </div>
                            )
                        })}
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


const POS: React.FC = () => {
    const context = useAppContext();
    const { 
        products, 
        saleInvoices, 
        customers, 
        services,
        cart,
        addToCart: contextAddToCart,
        updateCartItemQuantity: contextUpdateQuantity,
        removeFromCart: contextRemoveFromCart,
        updateCartItemFinalPrice: contextUpdateCartItemFinalPrice,
        addSaleReturn,
        storeSettings,
        currentUser
    } = context;
    
    const [searchTerm, setSearchTerm] = useState('');
    const [toast, setToast] = useState('');
    const [activeTab, setActiveTab] = useState<'cart' | 'invoices' | 'services'>('cart');
    const [mobileView, setMobileView] = useState<'products' | 'cart'>('products');
    const [invoiceToPrint, setInvoiceToPrint] = useState<SaleInvoice | null>(null);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
    const [memoImages, setMemoImages] = useState<SalesMemoImage[]>([]);
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);
    const memoFileInputRef = useRef<HTMLInputElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const searchContainerRef = useRef<HTMLDivElement>(null);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [recognitionLang, setRecognitionLang] = useState<'fa-IR' | 'en-US'>('fa-IR');
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const [editingPriceItemId, setEditingPriceItemId] = useState<string | null>(null);
    const [invoiceDateRange, setInvoiceDateRange] = useState<{ start: Date, end: Date }>({ start: new Date(), end: new Date() });
    const [isBarcodeModeActive, setIsBarcodeModeActive] = useState(false);
    const barcodeBuffer = useRef('');
    const barcodeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [returnModalInvoice, setReturnModalInvoice] = useState<SaleInvoice | null>(null);
    const shouldRestartRecognition = useRef(false);
    const [isMobileCustomerMenuOpen, setIsMobileCustomerMenuOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // Multi-currency POS State
    const [currency, setCurrency] = useState<'AFN' | 'USD' | 'IRT'>(storeSettings.baseCurrency || 'AFN');
    const [exchangeRate, setExchangeRate] = useState<string>('');

    const baseCurrency = storeSettings.baseCurrency || 'AFN';
    const baseCurrencyName = storeSettings.currencyConfigs?.[baseCurrency]?.name || 'AFN';

    useEffect(() => { loadMemoImages(); }, []);
    
    const loadMemoImages = async () => {
        const images = await db.getAllMemoImages();
        setMemoImages(images);
    };
    
    const showToast = (message: string) => {
        setToast(message);
        setTimeout(() => setToast(''), 4000);
    };

    const processBarcode = useCallback((scannedCode: string) => {
        const product = products.find(p => p.barcode === scannedCode);
        if (product) {
            const result = contextAddToCart(product, 'product');
            if(result.success) {
                showToast(`"${product.name}" اضافه شد.`);
            } else if (result.message) {
                showToast(result.message);
            }
        } else {
            showToast(`محصولی با بارکد "${scannedCode}" یافت نشد.`);
        }
    }, [products, contextAddToCart]);


    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isBarcodeModeActive) return;

            const isModalOpen = document.querySelector('.modal-animate');
            if (isModalOpen) return;

            if (e.key === 'Enter') {
                if (barcodeBuffer.current.length > 2) {
                    processBarcode(barcodeBuffer.current);
                }
                barcodeBuffer.current = '';
                e.preventDefault();
            } else if (e.key.length === 1) { 
                barcodeBuffer.current += e.key;
                e.preventDefault();
            }

            if (barcodeTimeout.current) clearTimeout(barcodeTimeout.current);
            barcodeTimeout.current = setTimeout(() => {
                if (barcodeBuffer.current.length > 2) {
                    processBarcode(barcodeBuffer.current);
                }
                barcodeBuffer.current = '';
            }, 100);
        };
        
        if (isBarcodeModeActive) {
            document.addEventListener('keydown', handleKeyDown);
            showToast("حالت فروش با اسکنر فعال شد.");
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            if (barcodeTimeout.current) clearTimeout(barcodeTimeout.current);
        };
    }, [isBarcodeModeActive, processBarcode]);


    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn('Speech Recognition is not supported by this browser.');
            return;
        }

        if (!recognitionRef.current) {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = true;

            recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
                const transcript = Array.from(event.results)
                    .map(result => result[0])
                    .map(result => result.transcript)
                    .join('');
                setSearchTerm(transcript.trim());
            };
            
            recognitionRef.current.onend = () => {
                if (shouldRestartRecognition.current) {
                    recognitionRef.current?.start();
                }
            };

            recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
                console.error('Speech recognition error:', event.error);
                if (event.error !== 'not-allowed' && event.error !== 'aborted') {
                    showToast(`خطای گفتار: ${event.error}`);
                }
                setIsListening(false);
                shouldRestartRecognition.current = false;
            };
        }
        
        recognitionRef.current.lang = recognitionLang;

    }, [recognitionLang]);
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
                setIsSearchFocused(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => { document.removeEventListener('mousedown', handleClickOutside); };
    }, []);

    const toggleListening = () => {
        if (!recognitionRef.current) {
            showToast("تشخیص گفتار در این مرورگر پشتیبانی نمی‌شود.");
            return;
        }
        
        if (isListening) {
            shouldRestartRecognition.current = false;
            recognitionRef.current.stop();
            setIsListening(false);
        } else {
            setSearchTerm('');
            shouldRestartRecognition.current = true;
            recognitionRef.current.start();
            setIsListening(true);
        }
    };
    
    const toggleLanguage = () => {
        setRecognitionLang(prev => prev === 'fa-IR' ? 'en-US' : 'fa-IR');
    };

    const addToCart = (itemToAdd: Product | Service, type: 'product' | 'service') => {
      const result = contextAddToCart(itemToAdd, type);
      if(result.message) showToast(result.message);
      if(result.success) setSearchTerm('');
    };

    const handleDropdownItemClick = (product: Product) => {
        addToCart(product, 'product');
        setSearchTerm('');
        searchInputRef.current?.focus();
    };
    
    const dropdownProducts = useMemo(() => {
        if (searchTerm.trim() === '') return [];
        return products
            .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .slice(0, 7);
    }, [products, searchTerm]);

    // Total amount in AFN for the whole cart
    const totalAmountAFN = cart.reduce((total, item) => {
        const price = (item.type === 'product' && item.finalPrice !== undefined) ? item.finalPrice : (item.type === 'product' ? item.salePrice : item.price);
        return total + price * item.quantity;
    }, 0);

    const completeSale = async () => {
        if (isProcessing) return; 
        if (!currentUser) { showToast("خطا: کاربر فعلی مشخص نیست."); return; }
        
        if (currency !== baseCurrency && (!exchangeRate || Number(exchangeRate) <= 0)) {
            showToast("لطفاً نرخ تبدیل ارز را وارد کنید.");
            return;
        }

        setIsProcessing(true);
        try {
            const result = await context.completeSale(
                currentUser.username, 
                selectedCustomerId || undefined, 
                currency, 
                currency === baseCurrency ? 1 : Number(exchangeRate)
            );
            
            showToast(result.message);

            if (result.success && result.invoice) {
                if (!context.editingSaleInvoiceId) { setInvoiceToPrint(result.invoice); }
                setSelectedCustomerId('');
                setMobileView('products');
                setActiveTab('cart');
                setCurrency(baseCurrency);
                setExchangeRate('');
            }
        } catch (e) {
            console.error(e);
            showToast("خطای غیرمنتظره در ثبت فاکتور.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleEditInvoice = (invoiceId: string) => {
        const inv = saleInvoices.find(i => i.id === invoiceId);
        const result = context.beginEditSale(invoiceId);
        showToast(result.message);
        if (result.success) {
            setSelectedCustomerId(result.customerId || '');
            if(inv) {
                setCurrency(inv.currency);
                setExchangeRate(inv.exchangeRate === 1 ? '' : String(inv.exchangeRate));
            }
            setActiveTab('cart');
            setMobileView('cart');
        }
    };

    const handlePrintInvoice = (invoiceId: string) => {
        const invoice = saleInvoices.find(inv => inv.id === invoiceId);
        if (invoice) {
            setInvoiceToPrint(invoice);
        }
    };

    const handleTakePhotoClick = () => {
        memoFileInputRef.current?.click();
    };

    const handlePhotoTaken = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const imageData = reader.result as string;
                await db.addMemoImage(imageData);
                if (!navigator.onLine) {
                    showToast("ذخیره در حافظه آفلاین (اینترنت قطع است)");
                } else {
                    showToast("یادداشت تصویری با موفقیت ذخیره شد.");
                }
                await loadMemoImages();
            };
            reader.readAsDataURL(file);
        }
        event.target.value = '';
    };
    
    const handleDeleteMemoImage = async (id: number) => {
        await db.deleteMemoImage(id);
        showToast("یادداشت تصویری حذف شد.");
        await loadMemoImages();
    };

    const filteredInvoices = useMemo(() => {
        if (!invoiceDateRange.start || !invoiceDateRange.end) return [];
        const startTime = invoiceDateRange.start.getTime();
        const endTime = invoiceDateRange.end.getTime();

        return saleInvoices
            .filter(inv => {
                const invTime = new Date(inv.timestamp).getTime();
                return invTime >= startTime && invTime <= endTime;
            })
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [saleInvoices, invoiceDateRange]);
    
    const handleOpenReturnModal = (invoice: SaleInvoice) => {
        setReturnModalInvoice(invoice);
    };

    // FIX: addSaleReturn returns a Promise, so this handler must be async and await the result.
    const handleReturnSubmit = async (returnItems: { id: string; type: 'product' | 'service'; quantity: number }[]) => {
        if (returnModalInvoice && currentUser) {
            const result = await addSaleReturn(returnModalInvoice.id, returnItems, currentUser.username);
            showToast(result.message);
            if (result.success) {
                setReturnModalInvoice(null);
            }
        }
    };

    return (
        <div className="h-full">
            {toast && <Toast message={toast} onClose={() => setToast('')} />}
            {invoiceToPrint && <PrintPreviewModal invoice={invoiceToPrint} onClose={() => setInvoiceToPrint(null)} />}
            {isGalleryOpen && (
                <FloatingGallery 
                    images={memoImages}
                    onClose={() => setIsGalleryOpen(false)}
                    onDelete={handleDeleteMemoImage}
                />
            )}
            {returnModalInvoice && (
                <ReturnModal invoice={returnModalInvoice} onClose={() => setReturnModalInvoice(null)} onSubmit={handleReturnSubmit} />
            )}
            
            <div className="md:flex h-full bg-transparent">
                {/* Product View */}
                <div className={`w-full md:w-1/2 p-2 md:p-6 flex-col ${mobileView === 'products' ? 'flex' : 'hidden'} md:flex h-full`}>
                    <ProductSide 
                      {...{
                        searchContainerRef, memoFileInputRef, searchInputRef, searchTerm, setSearchTerm,
                        setIsSearchFocused, handleTakePhotoClick, handlePhotoTaken, isBarcodeModeActive,
                        setIsBarcodeModeActive, isListening, toggleListening, recognitionLang, toggleLanguage,
                        isSearchFocused, dropdownProducts, handleDropdownItemClick,
                        addToCart, storeSettings,
                        // MiniCart props
                        cart, editingPriceItemId, setEditingPriceItemId, 
                        updateCartItemQuantity: contextUpdateQuantity, removeFromCart: contextRemoveFromCart, 
                        updateCartItemFinalPrice: contextUpdateCartItemFinalPrice, hasPermission: context.hasPermission,
                        currency, exchangeRate,
                        onMobileCheckout: () => setMobileView('cart')
                      }}
                    />
                </div>

                {/* Cart View */}
                <div className={`w-full md:w-1/2 bg-white/60 backdrop-blur-xl p-3 md:p-6 flex-col h-full border-r border-gray-200/60 md:shadow-2xl ${mobileView === 'cart' ? 'flex' : 'hidden'} md:flex`}>
                    <CartSide 
                       {...{
                         activeTab, setActiveTab, cart, filteredInvoices, services, setIsGalleryOpen, memoImages,
                         editingSaleInvoiceId: context.editingSaleInvoiceId, handleCancelEdit: context.cancelEditSale, updateQuantity: contextUpdateQuantity, 
                         removeFromCart: contextRemoveFromCart, editingPriceItemId,
                         setEditingPriceItemId, updateCartItemFinalPrice: contextUpdateCartItemFinalPrice, hasPermission: context.hasPermission, 
                         selectedCustomerId, setSelectedCustomerId, customers, totalAmount: totalAmountAFN, completeSale, setInvoiceDateRange,
                         handlePrintInvoice, handleEditInvoice, storeSettings, setMobileView, addToCart, handleOpenReturnModal,
                         isProcessing, currency, setCurrency, exchangeRate, setExchangeRate
                       }}
                    />
                </div>
            </div>
            
             {/* Unified Mobile Fixed Footer */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-[100] bg-white shadow-[0_-5px_15px_rgba(0,0,0,0.1)] flex flex-col">
                 {/* Layer 0: Currency Toggle on Mobile */}
                 {mobileView === 'cart' && activeTab === 'cart' && (
                     <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100/80 border-b">
                        <div className="flex gap-1.5">
                            {['AFN', 'USD', 'IRT'].map(c => (
                                <button key={c} onClick={() => setCurrency(c as any)} className={`px-3 py-1 rounded-lg text-[10px] font-black ${currency === c ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-500 border'}`}>{c}</button>
                            ))}
                        </div>
                        {currency !== 'AFN' && (
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-slate-400">نرخ:</span>
                                <input 
                                    type="text" 
                                    inputMode="decimal"
                                    value={exchangeRate} 
                                    onChange={e => setExchangeRate(toEnglishDigits(e.target.value).replace(/[^0-9.]/g, ''))} 
                                    className="w-16 p-1 border rounded font-mono text-[10px] text-center" 
                                    placeholder="نرخ"
                                />
                            </div>
                        )}
                     </div>
                 )}

                 {/* Layer 1: Checkout Bar */}
                 {mobileView === 'cart' && activeTab === 'cart' && (
                     <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-blue-50/50 h-16">
                        <div className="flex flex-col justify-center w-2/5">
                            <span className="text-[10px] text-slate-500 font-bold">مبلغ کل ({currency})</span>
                            <span className="text-lg font-extrabold text-blue-700 truncate">
                                {(currency === 'AFN' ? totalAmountAFN : (currency === 'IRT' ? Math.round(totalAmountAFN * (Number(exchangeRate)||1)) : totalAmountAFN / (Number(exchangeRate)||1))).toLocaleString()}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 w-3/5 justify-end">
                            <div className="relative">
                                <button 
                                    onClick={() => setIsMobileCustomerMenuOpen(true)} 
                                    className={`p-2 rounded-lg border transition-colors ${selectedCustomerId ? (customers.find(c => c.id === selectedCustomerId)?.balance > (customers.find(c => c.id === selectedCustomerId)?.creditLimit || Infinity) ? 'bg-orange-100 border-orange-300 text-orange-700 animate-pulse' : 'bg-blue-100 border-blue-300 text-blue-700') : 'bg-white border-gray-300 text-gray-600'}`}
                                >
                                    <UserGroupIcon className="w-6 h-6" />
                                    {selectedCustomerId && customers.find(c => c.id === selectedCustomerId)?.balance > (customers.find(c => c.id === selectedCustomerId)?.creditLimit || Infinity) && (
                                        <div className="absolute -top-1 -right-1 bg-orange-500 text-white rounded-full p-0.5"><WarningIcon className="w-2 h-2"/></div>
                                    )}
                                </button>
                            </div>
                            <button 
                                onClick={completeSale} 
                                className="flex-grow h-10 bg-blue-600 text-white rounded-lg shadow-md active:scale-95 transition-transform flex items-center justify-center gap-1 px-2 disabled:bg-gray-400 disabled:cursor-wait"
                                disabled={cart.length === 0 || !context.hasPermission('pos:create_invoice') || isProcessing}
                            >
                                <CheckIcon className="w-5 h-5" />
                                <span className="font-bold text-sm">{isProcessing ? '...' : (context.editingSaleInvoiceId ? 'ویرایش' : 'ثبت')}</span>
                            </button>
                        </div>
                     </div>
                 )}

                 {/* Layer 2: Navigation Tabs */}
                 <div className="flex justify-around items-center h-[50px] bg-white">
                     <button onClick={() => setMobileView('products')} className={`flex flex-col items-center justify-center w-1/2 h-full transition-colors ${mobileView === 'products' ? 'text-blue-600 bg-blue-50/30' : 'text-slate-400'}`}>
                         <PlusIcon className="w-6 h-6 mb-0.5" />
                         <span className="text-xs font-bold">فروشگاه</span>
                    </button>
                     <button onClick={() => setMobileView('cart')} className={`flex flex-col items-center justify-center w-1/2 h-full transition-colors relative ${mobileView === 'cart' ? 'text-blue-600 bg-blue-50/30' : 'text-slate-400'}`}>
                        <div className="relative">
                            <div className={`w-6 h-6 border-2 ${mobileView === 'cart' ? 'border-blue-600' : 'border-slate-400'} rounded-md flex items-center justify-center text-[10px] font-bold mb-0.5`}>
                               {cart.length > 0 ? cart.length : ''}
                            </div>
                        </div>
                        <span className="text-xs font-bold">سبد خرید</span>
                    </button>
                 </div>
            </div>
            
            {/* Mobile Customer Selection Modal */}
            {isMobileCustomerMenuOpen && (
                <div className="fixed inset-0 z-[150] md:hidden flex items-end justify-center">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setIsMobileCustomerMenuOpen(false)}></div>
                    <div className="bg-white w-full rounded-t-2xl shadow-2xl z-10 max-h-[75vh] flex flex-col animate-slide-up-mobile overflow-hidden">
                        <style>{`
                            @keyframes slide-up-mobile {
                                from { transform: translateY(100%); }
                                to { transform: translateY(0); }
                            }
                            .animate-slide-up-mobile { animation: slide-up-mobile 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
                        `}</style>
                        <div className="flex justify-between items-center p-4 border-b bg-slate-50">
                            <h3 className="font-bold text-lg text-slate-800">انتخاب مشتری</h3>
                            <button onClick={() => setIsMobileCustomerMenuOpen(false)} className="p-2 bg-slate-200 rounded-full text-slate-600">
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-grow overflow-y-auto p-4 space-y-3 pb-10">
                             <div 
                                onClick={() => { setSelectedCustomerId(''); setIsMobileCustomerMenuOpen(false); }}
                                className={`p-4 rounded-xl flex items-center justify-between cursor-pointer border-2 transition-all ${selectedCustomerId === '' ? 'bg-blue-50 border-blue-500 shadow-md' : 'bg-white border-slate-100 hover:bg-slate-50'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedCustomerId === '' ? 'border-blue-600 bg-blue-600' : 'border-slate-400'}`}>
                                        {selectedCustomerId === '' && <div className="w-2 h-2 bg-white rounded-full"></div>}
                                    </div>
                                    <span className={`font-bold ${selectedCustomerId === '' ? 'text-blue-700' : 'text-slate-700'}`}>فروش نقدی (پیش‌فرض)</span>
                                </div>
                            </div>
                            {customers.map((c: Customer) => {
                                const isExceeded = c.balance > (c.creditLimit || Infinity);
                                return (
                                <div 
                                    key={c.id}
                                    onClick={() => { setSelectedCustomerId(c.id); setIsMobileCustomerMenuOpen(false); }}
                                    className={`p-4 rounded-xl flex flex-col cursor-pointer border-2 transition-all ${selectedCustomerId === c.id ? (isExceeded ? 'bg-orange-50 border-orange-500' : 'bg-blue-50 border-blue-500 shadow-md') : 'bg-white border-slate-100'}`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedCustomerId === c.id ? (isExceeded ? 'border-orange-600 bg-orange-600' : 'border-blue-600 bg-blue-600') : 'border-slate-400'}`}>
                                                {selectedCustomerId === c.id && <div className="w-2 h-2 bg-white rounded-full"></div>}
                                            </div>
                                            <span className={`font-bold ${selectedCustomerId === c.id ? (isExceeded ? 'text-orange-700' : 'text-blue-700') : 'text-slate-700'}`}>{c.name}</span>
                                        </div>
                                        {isExceeded && <WarningIcon className="w-5 h-5 text-orange-500 animate-bounce" />}
                                    </div>
                                    <div className="flex justify-between items-center mt-2 pr-7">
                                        <span className="text-[10px] font-bold text-slate-400">تراز کل: {Math.round(c.balance).toLocaleString()} {baseCurrencyName}</span>
                                        {isExceeded && <span className="text-[10px] font-black text-orange-600 uppercase tracking-tighter">بیش از سقف اعتبار</span>}
                                    </div>
                                </div>
                            )})}
                             {customers.length === 0 && (
                                <p className="text-center text-slate-400 py-8">مشتری تعریف نشده است.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default POS;