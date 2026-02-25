import React, { useState, useEffect, useMemo } from 'react';
import type { Product, ProductBatch } from '../types';
import { useAppContext } from '../AppContext';
import { PlusIcon, EditIcon, TrashIcon, SearchIcon, ChevronDownIcon } from '../components/icons';
import Toast from '../components/Toast';
import ProductModal from '../components/ProductModal';
import { formatStockToPackagesAndUnits, formatCurrency } from '../utils/formatters';


const Inventory: React.FC = () => {
    const { 
        products, addProduct, updateProduct, deleteProduct, storeSettings, hasPermission,
        saleInvoices, purchaseInvoices, inTransitInvoices
    } = useAppContext();
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [toast, setToast] = useState<string>('');
    const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});
    
    useEffect(() => {
         document.body.style.overflow = isProductModalOpen ? 'hidden' : 'auto';
    }, [isProductModalOpen]);

    const showToast = (message: string) => {
        setToast(message);
        setTimeout(() => setToast(''), 3000);
    };

    const handleAddProductClick = () => {
        setEditingProduct(null);
        setIsProductModalOpen(true);
    };

    const handleEditProductClick = (product: Product) => {
        setEditingProduct(product);
        setIsProductModalOpen(true);
    };

    const handleDeleteProduct = (productId: string) => {
        if (window.confirm('آیا از حذف این محصول اطمینان دارید؟')) {
            deleteProduct(productId);
        }
    };

    const handleSaveProduct = (
        productData: Omit<Product, 'id' | 'batches'>,
        firstBatchData: Omit<ProductBatch, 'id'>
    ) => {
        const result = editingProduct
            ? updateProduct({ ...editingProduct, ...productData })
            : addProduct(productData, firstBatchData);

        showToast(result.message);
        if (result.success) {
            setIsProductModalOpen(false);
            setEditingProduct(null);
        }
    };
    
    // Check if product is referenced in any invoice
    const isProductUsed = (productId: string) => {
        const hasSale = saleInvoices.some(inv => inv.items.some(item => item.id === productId));
        const hasPurchase = purchaseInvoices.some(inv => inv.items.some(item => item.productId === productId));
        const hasInTransit = inTransitInvoices.some(inv => inv.items.some(item => item.productId === productId));
        return hasSale || hasPurchase || hasInTransit;
    };

    const filteredProducts = products.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.batches.some(b => b.lotNumber.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const toggleExpand = (productId: string) => {
        setExpandedProducts(prev => ({ ...prev, [productId]: !prev[productId] }));
    };

    return (
        <div className="p-4 md:p-8">
            {toast && <Toast message={toast} onClose={() => setToast('')} />}
            
            <div className="flex justify-between items-center mb-10 gap-4 flex-wrap">
                <h1 className="text-2xl md:text-4xl text-slate-800">مدیریت انبار</h1>
                <div className="relative w-full md:w-auto md:flex-grow max-w-lg">
                    <input
                        type="text"
                        placeholder="جستجوی نام یا شماره لات..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full p-3 pr-12 rounded-xl bg-white/80 border-2 border-transparent focus:border-blue-500 focus:ring-0 transition-colors shadow-sm form-input"
                    />
                     <SearchIcon className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-6 h-6" />
                </div>
                <div className="flex w-full md:w-auto space-x-3 space-x-reverse">
                    {hasPermission('inventory:add_product') && (
                        <button onClick={handleAddProductClick} className="flex-grow flex items-center justify-center bg-blue-600 text-white px-5 py-3 rounded-lg shadow-lg hover:bg-blue-700 btn-primary">
                            <PlusIcon className="w-6 h-6 ml-2"/>
                            <span className="font-semibold">افزودن محصول</span>
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white/60 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/60 overflow-hidden md:block hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-center">
                        <thead className="bg-white/50">
                            <tr>
                                <th className="p-5 text-md font-bold text-slate-700 tracking-wider"></th>
                                <th className="p-5 text-md font-bold text-slate-700 tracking-wider">نام محصول</th>
                                <th className="p-5 text-md font-bold text-slate-700 tracking-wider">قیمت خرید</th>
                                <th className="p-5 text-md font-bold text-slate-700 tracking-wider">قیمت فروش</th>
                                <th className="p-5 text-md font-bold text-slate-700 tracking-wider">موجودی کل</th>
                                <th className="p-5 text-md font-bold text-slate-700 tracking-wider">عملیات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProducts.length > 0 ? filteredProducts.map((product) => {
                                const totalStock = product.batches.reduce((sum, b) => sum + b.stock, 0);
                                const isExpanded = !!expandedProducts[product.id];
                                const isUsed = isProductUsed(product.id);
                                
                                return (
                                <React.Fragment key={product.id}>
                                    <tr className={`border-t border-gray-200/60 transition-colors duration-200 ${isExpanded ? 'bg-blue-50/50' : ''}`}>
                                        <td className="p-2">
                                            <button onClick={() => toggleExpand(product.id)} className="p-2 rounded-full hover:bg-slate-200/50">
                                                <ChevronDownIcon className={`w-5 h-5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                                            </button>
                                        </td>
                                        <td className="p-4 font-semibold text-slate-800 text-lg">{product.name}</td>
                                        <td className="p-4 text-slate-600 text-lg">
                                            {(() => {
                                                const latestBatch = [...product.batches].sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime())[0];
                                                return latestBatch ? formatCurrency(latestBatch.purchasePrice, storeSettings) : '-';
                                            })()}
                                        </td>
                                        <td className="p-4 text-slate-700 text-lg">{formatCurrency(product.salePrice, storeSettings)}</td>
                                        <td className="p-4 text-slate-700 text-lg font-bold">{formatStockToPackagesAndUnits(totalStock, storeSettings, product.itemsPerPackage)}</td>
                                        <td className="p-4">
                                            <div className="flex justify-center items-center space-x-2 space-x-reverse">
                                                {hasPermission('inventory:edit_product') && <button onClick={() => handleEditProductClick(product)} className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-100/50 transition-colors" title="ویرایش محصول"><EditIcon className="w-6 h-6" /></button>}
                                                {hasPermission('inventory:delete_product') && (
                                                    <button 
                                                        disabled={isUsed}
                                                        onClick={() => handleDeleteProduct(product.id)} 
                                                        className={`p-2 rounded-full transition-colors ${isUsed ? 'text-slate-300 cursor-not-allowed opacity-50' : 'text-red-500 hover:text-red-700 hover:bg-red-100/50'}`}
                                                        title={isUsed ? "این کالا دارای سوابق تراکنش است و قابل حذف نیست" : "حذف محصول"}
                                                    >
                                                        <TrashIcon className="w-6 h-6" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                    {isExpanded && (
                                        <tr className="bg-slate-50/70">
                                            <td colSpan={5} className="p-4">
                                                <div className="p-4 bg-white/80 rounded-lg border">
                                                    <h4 className="text-lg font-bold text-right mb-3 text-slate-700">دسته‌های موجود</h4>
                                                    <table className="min-w-full text-center text-sm">
                                                        <thead>
                                                            <tr className="border-b">
                                                                <th className="p-2 font-semibold">شماره لات</th>
                                                                <th className="p-2 font-semibold">موجودی</th>
                                                                <th className="p-2 font-semibold">قیمت خرید</th>
                                                                <th className="p-2 font-semibold">تاریخ انقضا</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {product.batches.map(batch => (
                                                                <tr key={batch.id}>
                                                                    <td className="p-2 font-mono">{batch.lotNumber}</td>
                                                                    <td className="p-2">{batch.stock}</td>
                                                                    <td className="p-2">{formatCurrency(batch.purchasePrice, storeSettings)}</td>
                                                                    <td className="p-2">{batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString('fa-IR') : '-'}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            )}) : (
                                <tr>
                                    <td colSpan={5} className="text-center p-16">
                                        <h3 className="text-2xl font-bold text-slate-700">انباری خالی از محصول!</h3>
                                        <p className="text-slate-500 mt-3 text-lg">برای شروع، اولین محصول خود را با استفاده از دکمه‌های بالا اضافه کنید.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile View */}
            <div className="md:hidden space-y-4">
                 {filteredProducts.length > 0 ? filteredProducts.map((product) => {
                    const totalStock = product.batches.reduce((sum, b) => sum + b.stock, 0);
                    const isUsed = isProductUsed(product.id);
                    return (
                        <div key={product.id} className="bg-white/70 p-4 rounded-xl shadow-md border border-gray-200/60">
                            <div className="flex justify-between items-start">
                                <h3 className="font-bold text-lg text-slate-800 mb-2">{product.name}</h3>
                                 <div className="flex items-center space-x-1 space-x-reverse">
                                    {hasPermission('inventory:edit_product') && <button onClick={() => handleEditProductClick(product)} className="text-blue-600 p-2"><EditIcon className="w-5 h-5" /></button>}
                                    {hasPermission('inventory:delete_product') && (
                                        <button 
                                            disabled={isUsed}
                                            onClick={() => handleDeleteProduct(product.id)} 
                                            className={`p-2 ${isUsed ? 'text-slate-300 opacity-50' : 'text-red-500'}`}
                                            title={isUsed ? "غیرقابل حذف" : "حذف"}
                                        >
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-2 text-md">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">قیمت خرید:</span> 
                                    <span className="font-semibold text-slate-600">
                                        {(() => {
                                            const latestBatch = [...product.batches].sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime())[0];
                                            return latestBatch ? formatCurrency(latestBatch.purchasePrice, storeSettings) : '-';
                                        })()}
                                    </span>
                                </div>
                                <div className="flex justify-between"><span className="text-slate-500">قیمت فروش:</span> <span className="font-semibold">{formatCurrency(product.salePrice, storeSettings)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-500">موجودی کل:</span> <span className="font-bold">{formatStockToPackagesAndUnits(totalStock, storeSettings, product.itemsPerPackage)}</span></div>
                            </div>
                        </div>
                    )
                 }) : (
                     <div className="text-center p-16">
                        <h3 className="text-xl font-bold text-slate-700">محصولی یافت نشد.</h3>
                    </div>
                 )}
            </div>

            {isProductModalOpen && <ProductModal product={editingProduct} onClose={() => setIsProductModalOpen(false)} onSave={handleSaveProduct} />}

        </div>
    );
};

export default Inventory;