import React, { useState, useMemo } from 'react';
import type { InvoiceItem, CartItem, StoreSettings, SaleInvoice } from '../types';
import { EditIcon, TrashIcon, CheckIcon, XIcon, HistoryIcon } from './icons';
import PackageUnitInput from './PackageUnitInput';
import { toEnglishDigits } from '../utils/formatters';

interface PriceEditorProps {
    item: InvoiceItem;
    currency: 'AFN' | 'USD' | 'IRT';
    exchangeRate: string;
    storeSettings: StoreSettings;
    onSave: (afnPrice: number) => void;
    onCancel: () => void;
}

const CartItemPriceEditor: React.FC<PriceEditorProps> = ({ item, currency, exchangeRate, storeSettings, onSave, onCancel }) => {
    const config = storeSettings.currencyConfigs[currency];
    const rate = Number(exchangeRate) || 1;
    const currentPriceAFN = item.finalPrice !== undefined ? item.finalPrice : item.salePrice;
    
    // Initial value in transactional currency
    const initialDisplay = currency === storeSettings.baseCurrency ? currentPriceAFN : 
                          (config?.method === 'multiply' ? currentPriceAFN * rate : currentPriceAFN / rate);

    const [priceStr, setPriceStr] = useState(String(Math.round(initialDisplay * 1000) / 1000));
    
    const handleSave = () => {
        const entered = Number(priceStr);
        // Convert back to AFN for storage
        const afnPrice = currency === storeSettings.baseCurrency ? entered :
                         (config?.method === 'multiply' ? entered / rate : entered * rate);
        onSave(afnPrice);
    };
    
    return (
        <div className="bg-blue-50/70 p-2 rounded-lg mt-2 border border-blue-200">
            <div className="flex items-center gap-2">
                <div className="flex-grow">
                    <label className="text-[10px] font-semibold text-slate-600 block">قیمت نهایی ({currency})</label>
                    <input 
                        type="text" 
                        inputMode="decimal"
                        value={priceStr}
                        onChange={(e) => setPriceStr(toEnglishDigits(e.target.value).replace(/[^0-9.]/g, ''))}
                        className="w-full p-1 text-center font-bold border border-blue-300 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                    />
                </div>
                 <div className="flex flex-col gap-1">
                    <button onClick={handleSave} className="p-1 bg-green-500 text-white rounded hover:bg-green-600"><CheckIcon className="w-4 h-4"/></button>
                    <button onClick={onCancel} className="p-1 bg-red-500 text-white rounded hover:bg-red-600"><XIcon className="w-4 h-4"/></button>
                </div>
            </div>
        </div>
    );
};


interface POSCartItemProps {
    item: CartItem;
    isEditingPrice: boolean;
    storeSettings: StoreSettings;
    hasPermission: (permission: string) => boolean;
    onQuantityChange: (newQuantity: number) => void;
    onRemove: () => void;
    onStartPriceEdit: () => void;
    onSavePrice: (newPrice: number) => void;
    onCancelPriceEdit: () => void;
    currency: 'AFN' | 'USD' | 'IRT';
    exchangeRate: string;
    saleInvoices: SaleInvoice[];
    selectedCustomerId: string;
}

const POSCartItem: React.FC<POSCartItemProps> = ({
    item, isEditingPrice, storeSettings, hasPermission, onQuantityChange, onRemove, onStartPriceEdit, onSavePrice, onCancelPriceEdit,
    currency, exchangeRate, saleInvoices, selectedCustomerId
}) => {
    
    const config = storeSettings.currencyConfigs[currency];
    const rate = Number(exchangeRate) || 1;
    const priceAFN = (item.type === 'product' && item.finalPrice !== undefined) ? item.finalPrice : (item.type === 'product' ? item.salePrice : item.price);
    const originalPriceAFN = item.type === 'product' ? item.salePrice : item.price;

    // Convert prices for display
    const displayPrice = currency === storeSettings.baseCurrency ? priceAFN : 
                        (config?.method === 'multiply' ? priceAFN * rate : priceAFN / rate);
    
    const displayOriginalPrice = currency === storeSettings.baseCurrency ? originalPriceAFN : 
                                (config?.method === 'multiply' ? originalPriceAFN * rate : originalPriceAFN / rate);

    const currencySuffix = config?.name || currency;

    // Logic for finding the last sale price to this customer
    const lastSaleToCustomer = useMemo(() => {
        if (!selectedCustomerId || item.type !== 'product') return null;
        
        // Find the most recent sale invoice for this customer that contains this product
        const lastInvoice = saleInvoices
            .filter(inv => inv.customerId === selectedCustomerId && inv.type === 'sale')
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .find(inv => inv.items.some(it => it.id === item.id));

        if (!lastInvoice) return null;

        const lastItem = lastInvoice.items.find(it => it.id === item.id);
        if (!lastItem) return null;

        return {
            price: lastItem.finalPrice ?? lastItem.salePrice,
            date: lastInvoice.timestamp,
            currency: lastInvoice.currency
        };
    }, [selectedCustomerId, item.id, item.type, saleInvoices]);

    return (
        <div className={`mb-3 p-3 bg-white/90 rounded-xl shadow-sm border border-gray-200/60 transition-all duration-300 ${isEditingPrice ? 'ring-2 ring-blue-500 z-10 relative' : ''}`}>
            <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
                    <p className="font-bold text-slate-800 text-sm md:text-lg leading-tight mb-1 break-words line-clamp-2" title={item.name}>{item.name}</p>
                    
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                        {item.type === 'product' && item.finalPrice !== undefined && item.finalPrice !== item.salePrice ? (
                            <>
                                <span className="font-bold text-green-600">{displayPrice.toLocaleString()} {currencySuffix}</span>
                                <s className="text-xs text-red-400">{displayOriginalPrice.toLocaleString()} {currencySuffix}</s>
                            </>
                        ) : (
                            <span className="font-bold text-slate-600">{displayPrice.toLocaleString()} {currencySuffix}</span>
                        )}
                        
                        {item.type === 'product' && (
                            <div className="flex flex-col w-full">
                                <div className="flex flex-wrap items-center gap-2">
                                    {(() => {
                                        const deductions = (item as InvoiceItem).batchDeductions || [];
                                        const batches = (item as InvoiceItem).batches || [];
                                        
                                        const uniquePrices = Array.from(new Set(
                                            deductions.map(d => batches.find(b => b.id === d.batchId)?.purchasePrice)
                                                .filter(p => p !== undefined)
                                        ));

                                        if (uniquePrices.length === 0) return <span className="text-[10px] text-slate-400 font-medium">(خرید: -)</span>;

                                        return uniquePrices.map((pPrice, idx) => (
                                            <span key={idx} className="text-[10px] text-slate-400 font-medium leading-tight">
                                                (خرید: {pPrice?.toLocaleString()} {storeSettings.currencyConfigs[storeSettings.baseCurrency]?.symbol || storeSettings.baseCurrency})
                                            </span>
                                        ));
                                    })()}
                                </div>

                                {lastSaleToCustomer && (
                                    <div className="flex items-center gap-1 mt-1 text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-md w-fit border border-amber-100">
                                        <HistoryIcon className="w-3 h-3" />
                                        <span>آخرین فروش ({new Date(lastSaleToCustomer.date).toLocaleDateString('fa-IR')}):</span>
                                        <span>{lastSaleToCustomer.price.toLocaleString()} {storeSettings.currencyConfigs[lastSaleToCustomer.currency]?.name || lastSaleToCustomer.currency}</span>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {item.type === 'product' && !isEditingPrice && hasPermission('pos:apply_discount') && (
                            <button onClick={onStartPriceEdit} className="p-1 rounded-full hover:bg-slate-200/50 text-slate-400 hover:text-blue-600">
                                <EditIcon className="w-4 h-4"/>
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex items-start gap-2 flex-shrink-0">
                   <div className="scale-90 origin-top-left md:scale-100 md:origin-center">
                       {item.type === 'product' ? (
                            <PackageUnitInput 
                                totalUnits={item.quantity}
                                itemsPerPackage={(item as InvoiceItem).itemsPerPackage || 1}
                                onChange={onQuantityChange}
                            />
                       ) : (
                            <PackageUnitInput 
                                totalUnits={item.quantity}
                                itemsPerPackage={1}
                                onChange={onQuantityChange}
                            />
                       )}
                   </div>
                   
                   <div className="flex flex-col gap-2 items-center">
                        <button onClick={onRemove} className="text-red-500 hover:text-red-700 p-1.5 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                           <TrashIcon className="w-5 h-5" />
                        </button>
                   </div>
                </div>
            </div>
            
            {isEditingPrice && item.type === 'product' && (
                <CartItemPriceEditor
                    item={item as InvoiceItem}
                    currency={currency}
                    exchangeRate={exchangeRate}
                    storeSettings={storeSettings}
                    onSave={onSavePrice}
                    onCancel={onCancelPriceEdit}
                />
            )}
        </div>
    );
};

export default POSCartItem;