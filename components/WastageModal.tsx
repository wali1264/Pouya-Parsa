import React, { useState } from 'react';
import type { Product } from '../types';
import { useAppContext } from '../AppContext';

interface WastageModalProps {
    product: Product;
    onClose: () => void;
}

const WastageModal: React.FC<WastageModalProps> = ({ product, onClose }) => {
    const { registerWastage, storeSettings } = useAppContext();
    const [quantity, setQuantity] = useState<number | ''>('');
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');

    const totalStock = product.batches.reduce((sum, b) => sum + b.stock, 0);

    const handleSave = () => {
        if (!quantity || quantity <= 0) {
            setError('لطفاً مقدار معتبری وارد کنید.');
            return;
        }
        if (quantity > totalStock) {
            setError(`مقدار ضایعات نمی‌تواند بیشتر از موجودی کل (${totalStock}) باشد.`);
            return;
        }
        if (!reason.trim()) {
            setError('لطفاً علت ضایعات را وارد کنید.');
            return;
        }

        const result = registerWastage(product.id, Number(quantity), reason);
        if (result.success) {
            onClose();
        } else {
            setError(result.message);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden modal-animate flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-gray-100 bg-slate-50/50 flex justify-between items-center sticky top-0 z-10">
                    <h2 className="text-2xl font-bold text-slate-800">ثبت ضایعات</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-2 rounded-full hover:bg-slate-200/50">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100">{error}</div>}
                    
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">محصول</label>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 font-medium">
                            {product.name}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">موجودی فعلی</label>
                        <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-blue-800 font-bold">
                            {totalStock} {storeSettings.unitLabel}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">تعداد ضایعات ({storeSettings.unitLabel}) *</label>
                        <input
                            type="number"
                            value={quantity}
                            onChange={(e) => {
                                setQuantity(e.target.value === '' ? '' : Number(e.target.value));
                                setError('');
                            }}
                            className="w-full p-3 rounded-xl bg-white border-2 border-slate-200 focus:border-blue-500 focus:ring-0 transition-colors form-input"
                            min="1"
                            max={totalStock}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">علت ضایعات *</label>
                        <textarea
                            value={reason}
                            onChange={(e) => {
                                setReason(e.target.value);
                                setError('');
                            }}
                            className="w-full p-3 rounded-xl bg-white border-2 border-slate-200 focus:border-blue-500 focus:ring-0 transition-colors form-input"
                            rows={3}
                            placeholder="توضیح دهید که چرا این محصول ضایعات شده است..."
                        />
                    </div>
                </div>

                <div className="p-6 border-t border-gray-100 bg-slate-50 flex justify-end gap-3 sticky bottom-0 z-10">
                    <button onClick={onClose} className="px-6 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold hover:bg-slate-100 transition-colors">
                        انصراف
                    </button>
                    <button onClick={handleSave} className="px-6 py-2.5 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/30">
                        ثبت ضایعات
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WastageModal;
