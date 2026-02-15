
import React, { useState } from 'react';
import type { InvoiceItem, CartItem, StoreSettings } from '../types';
import { EditIcon, TrashIcon, CheckIcon, XIcon } from './icons';
import PackageUnitInput from './PackageUnitInput';
import { formatCurrency } from '../utils/formatters';

const CartItemPriceEditor: React.FC<{ item: InvoiceItem, onSave: (price: number) => void, onCancel: () => void }> = ({ item, onSave, onCancel }) => {
    const [price, setPrice] = useState(String(item.finalPrice !== undefined ? item.finalPrice : item.salePrice));
    
    const discountPercent = item.salePrice > 0 
        ? (((item.salePrice - Number(price)) / item.salePrice) * 100)
        : 0;

    const handleSave = () => {
        onSave(Number(price));
    };
    
    return (
        <div className="bg-blue-50/70 p-2 rounded-lg mt-2 border border-blue-200">
            <div className="flex items-center gap-2">
                <div className="flex-grow">
                    <label className="text-[10px] font-semibold text-slate-600 block">قیمت نهایی</label>
                    <input 
                        type="text" 
                        inputMode="numeric"
                        value={price}
                        onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ''))} // Allow dot
                        className="w-full p-1 text-center font-bold border border-blue-300 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                    />
                </div>
                <div className="text-center min-w-[3rem]">
                    <span className="text-[10px] font-semibold text-slate-600 block">تخفیف</span>
                    <p className={`font-bold text-sm ${discountPercent > 0 ? 'text-green-600' : discountPercent < 0 ? 'text-red-600' : 'text-slate-700'}`} dir="ltr">
                       {Math.abs(discountPercent).toFixed(0)}%
                    </p>
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
}

const POSCartItem: React.FC<POSCartItemProps> = ({
    item, isEditingPrice, storeSettings, hasPermission, onQuantityChange, onRemove, onStartPriceEdit, onSavePrice, onCancelPriceEdit
}) => {
    
    const price = (item.type === 'product' && item.finalPrice !== undefined) ? item.finalPrice : (item.type === 'product' ? item.salePrice : item.price);

    return (
        <div className={`mb-3 p-3 bg-white/90 rounded-xl shadow-sm border border-gray-200/60 transition-all duration-300 ${isEditingPrice ? 'ring-2 ring-blue-500 z-10 relative' : ''}`}>
            <div className="flex justify-between items-start gap-2">
                {/* Left Side: Name and Price */}
                <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
                    <p className="font-bold text-slate-800 text-sm md:text-lg leading-tight mb-1 break-words line-clamp-2" title={item.name}>{item.name}</p>
                    
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                        {item.type === 'product' && item.finalPrice !== undefined && item.finalPrice !== item.salePrice ? (
                            <>
                                <span className="font-bold text-green-600">{formatCurrency(item.finalPrice, storeSettings)}</span>
                                <s className="text-xs text-red-400">{formatCurrency(item.salePrice, storeSettings)}</s>
                            </>
                        ) : (
                            <span className="font-bold text-slate-600">{formatCurrency(price, storeSettings)}</span>
                        )}
                        
                        {/* Desktop Edit Icon (Hidden on Mobile) */}
                        {item.type === 'product' && !isEditingPrice && hasPermission('pos:apply_discount') && (
                            <button onClick={onStartPriceEdit} className="hidden md:inline-flex p-1 rounded-full hover:bg-slate-200/50 text-slate-400 hover:text-blue-600">
                                <EditIcon className="w-4 h-4"/>
                            </button>
                        )}
                    </div>
                </div>

                {/* Right Side: Quantity, Delete, Edit (Mobile) */}
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
                        
                        {/* Mobile Edit Icon (Below Trash) */}
                        {item.type === 'product' && !isEditingPrice && hasPermission('pos:apply_discount') && (
                            <button onClick={onStartPriceEdit} className="md:hidden text-blue-500 hover:text-blue-700 p-1.5 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                                <EditIcon className="w-5 h-5"/>
                            </button>
                        )}
                   </div>
                </div>
            </div>
            
            {isEditingPrice && item.type === 'product' && (
                <CartItemPriceEditor
                    item={item as InvoiceItem}
                    onSave={onSavePrice}
                    onCancel={onCancelPriceEdit}
                />
            )}
        </div>
    );
};

export default POSCartItem;
