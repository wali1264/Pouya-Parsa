

import React, { useState, useRef } from 'react';
import type { Product } from '../types';
import { identifyProductsFromImage } from '../services/geminiService';
import { XIcon, CameraIcon } from './icons';
import ImageSourceModal from './ImageSourceModal';
import Toast from './Toast';

type BulkProductData = { name: string; purchasePrice: string; salePrice: string; stock: string; lotNumber: string; };

interface BulkAddModalProps {
    onClose: () => void;
    onSave: (newProducts: Product[]) => void;
}

const BulkAddModal: React.FC<BulkAddModalProps> = ({ onClose, onSave }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [identifiedProducts, setIdentifiedProducts] = useState<BulkProductData[]>([]);
    const [isImageSourceModalOpen, setIsImageSourceModalOpen] = useState(false);
    const [toast, setToast] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const showToast = (message: string) => {
        setToast(message);
        setTimeout(() => setToast(''), 3000);
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setIsProcessing(true);
            setIdentifiedProducts([]);
            const reader = new FileReader();
            reader.onloadend = async () => {
                try {
                    const base64String = (reader.result as string).split(',')[1];
                    const results = await identifyProductsFromImage(base64String);
                    setIdentifiedProducts(results.map(r => ({ ...r, purchasePrice: '', salePrice: '', stock: '', lotNumber: '' })));
                } catch (error) {
                    console.error("Error processing image:", error);
                    showToast("خطا در شناسایی محصولات. لطفا دوباره تلاش کنید.");
                } finally {
                    setIsProcessing(false);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleBulkInputChange = (index: number, field: keyof BulkProductData, value: string) => {
        const updatedProducts = [...identifiedProducts];
        updatedProducts[index][field] = value;
        setIdentifiedProducts(updatedProducts);
    };

    const saveBulkProducts = () => {
        // FIX: The generated object now correctly matches the `Product` interface by nesting
        // batch-specific information inside a `batches` array.
        const newProducts: Product[] = identifiedProducts
            .filter(p => p.name && p.salePrice && p.purchasePrice && p.stock && p.lotNumber)
            .map(p => ({
                id: crypto.randomUUID(),
                name: p.name,
                salePrice: parseFloat(p.salePrice) || 0,
                batches: [{
                    id: crypto.randomUUID(),
                    lotNumber: p.lotNumber,
                    stock: parseInt(p.stock, 10) || 0,
                    purchasePrice: parseFloat(p.purchasePrice) || 0,
                    purchaseDate: new Date().toISOString()
                }],
            }));
        
        if (newProducts.length > 0) {
            onSave(newProducts);
        } else {
            alert('لطفا اطلاعات تمام محصولات شناسایی شده را تکمیل کنید.');
        }
    };

    const handleCameraSelect = () => {
        if (fileInputRef.current) {
            fileInputRef.current.setAttribute('capture', 'environment');
            fileInputRef.current.click();
        }
        setIsImageSourceModalOpen(false);
    };

    const handleUploadSelect = () => {
        if (fileInputRef.current) {
            fileInputRef.current.removeAttribute('capture');
            fileInputRef.current.click();
        }
        setIsImageSourceModalOpen(false);
    };


    return (
        <>
            {toast && <Toast message={toast} onClose={() => setToast('')} />}
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
                <style>{`
                    @keyframes fade-in {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }
                    .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
                `}</style>
                <div className="bg-white/70 backdrop-blur-xl p-8 rounded-2xl shadow-2xl border border-gray-200/80 w-full max-w-4xl">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-bold text-slate-800">ثبت گروهی با هوش مصنوعی</h2>
                        <button onClick={onClose} className="p-1 rounded-full text-slate-500 hover:bg-slate-200/50 transition-colors"><XIcon /></button>
                    </div>

                    <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />

                    {isProcessing ? (
                        <div className="text-center p-8 border-2 border-dashed border-gray-300 rounded-lg">
                            <p className="text-blue-600 animate-pulse font-semibold">در حال پردازش تصویر... لطفا صبر کنید.</p>
                        </div>
                    ) : identifiedProducts.length > 0 ? (
                        <div className="space-y-4">
                            <h3 className="font-semibold text-slate-700">محصولات شناسایی شده را تکمیل کنید:</h3>
                            <div className="max-h-[50vh] overflow-y-auto -mx-2 px-2">
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="text-slate-600">
                                            <th className="p-2 text-right">نام محصول</th>
                                            <th className="p-2">قیمت خرید</th>
                                            <th className="p-2">قیمت فروش</th>
                                            <th className="p-2">موجودی</th>
                                            <th className="p-2">شماره لات</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {identifiedProducts.map((p, i) => (
                                            <tr key={i} className="bg-white/50 rounded-md">
                                                <td className="p-2 font-semibold text-slate-800">{p.name}</td>
                                                <td><input type="number" placeholder="0" value={p.purchasePrice} onChange={e => handleBulkInputChange(i, 'purchasePrice', e.target.value)} className="w-full p-1.5 bg-transparent border-b-2 border-slate-200 focus:border-blue-500 outline-none text-center" /></td>
                                                <td><input type="number" placeholder="0" value={p.salePrice} onChange={e => handleBulkInputChange(i, 'salePrice', e.target.value)} className="w-full p-1.5 bg-transparent border-b-2 border-slate-200 focus:border-blue-500 outline-none text-center" /></td>
                                                <td><input type="number" placeholder="0" value={p.stock} onChange={e => handleBulkInputChange(i, 'stock', e.target.value)} className="w-full p-1.5 bg-transparent border-b-2 border-slate-200 focus:border-blue-500 outline-none text-center" /></td>
                                                <td><input type="text" value={p.lotNumber} onChange={e => handleBulkInputChange(i, 'lotNumber', e.target.value)} className="w-full p-1.5 bg-transparent border-b-2 border-slate-200 focus:border-blue-500 outline-none text-center" /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div onClick={() => setIsImageSourceModalOpen(true)} className="cursor-pointer text-center p-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50/50 transition-colors">
                            <CameraIcon className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                            <p className="font-semibold text-blue-600">برای شروع، عکس بگیرید یا بارگذاری کنید</p>
                            <p className="text-sm text-slate-500">از چند محصول به صورت همزمان عکس بگیرید</p>
                        </div>
                    )}

                    <div className="flex justify-end space-x-2 space-x-reverse mt-8">
                        <button onClick={onClose} className="px-5 py-2.5 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors">انصراف</button>
                        <button onClick={saveBulkProducts} disabled={identifiedProducts.length === 0 || isProcessing} className="px-5 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 shadow-lg disabled:shadow-none transition-all">ذخیره محصولات</button>
                    </div>
                </div>
            </div>
            {isImageSourceModalOpen && (
                <ImageSourceModal 
                    onClose={() => setIsImageSourceModalOpen(false)}
                    onCameraSelect={handleCameraSelect}
                    onUploadSelect={handleUploadSelect}
                />
            )}
        </>
    );
};

export default BulkAddModal;
