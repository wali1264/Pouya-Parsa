import React from 'react';
import type { ActivityLog, SaleInvoice, PurchaseInvoice, Product } from '../types';
import { useAppContext } from '../AppContext';
import { XIcon, POSIcon, PurchaseIcon, InventoryIcon } from './icons';
import { formatCurrency, formatStockToPackagesAndUnits } from '../utils/formatters';

interface ActivityDetailModalProps {
    activity: ActivityLog;
    onClose: () => void;
}

const DetailRow: React.FC<{ label: string, value: React.ReactNode, className?: string }> = ({ label, value, className }) => (
    <div className={`flex justify-between items-center py-2 border-b ${className}`}>
        <span className="font-semibold text-slate-600">{label}:</span>
        <span className="font-bold text-slate-800 text-right">{value}</span>
    </div>
);

const SaleInvoiceDetails: React.FC<{ invoice: SaleInvoice }> = ({ invoice }) => {
    const { storeSettings } = useAppContext();
    return (
        <div className="space-y-4">
            <DetailRow label="شماره فاکتور" value={<span className="font-mono">{invoice.id}</span>} />
            <DetailRow label="تاریخ" value={new Date(invoice.timestamp).toLocaleString('fa-IR')} />
            <DetailRow label="صندوق‌دار" value={invoice.cashier} />
            
            <div className="pt-2">
                <h4 className="font-bold text-lg mb-2">اقلام فاکتور</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-2 bg-slate-50/50">
                    {invoice.items.map(item => (
                        <div key={`${item.id}-${item.type}`} className="flex justify-between items-center p-2">
                            <span className="font-semibold">{item.name} (x{item.quantity})</span>
                            <span>{formatCurrency(((item.type === 'product' ? item.salePrice : item.price) * item.quantity), storeSettings)}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="border-t pt-4 mt-4 space-y-2">
                <DetailRow label="جمع کل" value={formatCurrency(invoice.subtotal, storeSettings)} />
                <DetailRow label="تخفیف" value={formatCurrency(invoice.totalDiscount, storeSettings)} className="text-green-600"/>
                <DetailRow label="مبلغ نهایی" value={formatCurrency(invoice.totalAmount, storeSettings)} className="text-xl"/>
            </div>
        </div>
    );
};

const PurchaseInvoiceDetails: React.FC<{ invoice: PurchaseInvoice }> = ({ invoice }) => {
    const { storeSettings, suppliers } = useAppContext();
    const supplier = suppliers.find(s => s.id === invoice.supplierId);
    return (
        <div className="space-y-4">
            <DetailRow label="شماره فاکتور" value={<span className="font-mono">{invoice.invoiceNumber || invoice.id}</span>} />
            <DetailRow label="تأمین کننده" value={supplier?.name || 'ناشناس'} />
            <DetailRow label="تاریخ" value={new Date(invoice.timestamp).toLocaleDateString('fa-IR')} />
            
             <div className="pt-2">
                <h4 className="font-bold text-lg mb-2">اقلام فاکتور</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-2 bg-slate-50/50">
                    {invoice.items.map(item => (
                        <div key={item.productId + item.lotNumber} className="flex justify-between items-center p-2">
                            <span className="font-semibold">{item.productName} (x{item.quantity})</span>
                            <span>{formatCurrency(item.purchasePrice * item.quantity, storeSettings)}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="border-t pt-4 mt-4">
                <DetailRow label="مبلغ نهایی" value={formatCurrency(invoice.totalAmount, storeSettings)} className="text-xl"/>
            </div>
        </div>
    );
};

const ProductDetails: React.FC<{ product: Product }> = ({ product }) => {
    const { storeSettings } = useAppContext();
    const totalStock = product.batches.reduce((sum, b) => sum + b.stock, 0);
    return (
        <div className="space-y-4">
            <DetailRow label="نام محصول" value={product.name} />
            <DetailRow label="قیمت فروش" value={formatCurrency(product.salePrice, storeSettings)} />
            <DetailRow label="موجودی کل" value={formatStockToPackagesAndUnits(totalStock, storeSettings, product.itemsPerPackage)} />
            <DetailRow label="بارکد" value={<span className="font-mono">{product.barcode || '-'}</span>} />
        </div>
    );
};


const ActivityDetailModal: React.FC<ActivityDetailModalProps> = ({ activity, onClose }) => {
    const { products, saleInvoices, purchaseInvoices } = useAppContext();
    
    let content: React.ReactNode = null;
    let title = "جزئیات فعالیت";
    let icon: React.ReactNode = null;

    if (activity.refType === 'saleInvoice' && activity.refId) {
        const invoice = saleInvoices.find(i => i.id === activity.refId);
        if(invoice) {
            content = <SaleInvoiceDetails invoice={invoice} />;
            title = "جزئیات فاکتور فروش";
            icon = <POSIcon className="w-6 h-6 text-green-600" />;
        }
    } else if (activity.refType === 'purchaseInvoice' && activity.refId) {
        const invoice = purchaseInvoices.find(i => i.id === activity.refId);
        if (invoice) {
            content = <PurchaseInvoiceDetails invoice={invoice} />;
            title = "جزئیات فاکتور خرید";
            icon = <PurchaseIcon className="w-6 h-6 text-blue-600" />;
        }
    } else if (activity.refType === 'product' && activity.refId) {
        const product = products.find(p => p.id === activity.refId);
        if (product) {
            content = <ProductDetails product={product} />;
            title = "جزئیات محصول";
            icon = <InventoryIcon className="w-6 h-6 text-amber-600" />;
        }
    }
    
    if (!content) {
        content = <p className="text-center text-slate-500 p-8">جزئیات بیشتری برای این فعالیت موجود نیست.</p>;
    }


    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-animate">
            <div className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-2xl border border-gray-200/80 w-full max-w-lg">
                <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                        {icon}
                        <h2 className="text-xl font-bold text-slate-800">{title}</h2>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full text-slate-500 hover:bg-slate-200/50"><XIcon /></button>
                </div>
                <div className="mt-4 max-h-[60vh] overflow-y-auto pr-2">
                    {content}
                </div>
            </div>
        </div>
    );
};

export default ActivityDetailModal;