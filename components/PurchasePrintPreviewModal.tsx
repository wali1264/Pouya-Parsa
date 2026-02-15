import React from 'react';
import type { PurchaseInvoice, Supplier } from '../types';
import { XIcon } from './icons';
import { useAppContext } from '../AppContext';
import { formatCurrency } from '../utils/formatters';

interface PurchasePrintPreviewModalProps {
    invoice: PurchaseInvoice;
    supplier: Supplier | undefined;
    onClose: () => void;
}

const PurchasePrintPreviewModal: React.FC<PurchasePrintPreviewModalProps> = ({ invoice, supplier, onClose }) => {
     const { storeSettings } = useAppContext();

    const handlePrint = () => {
        window.print();
    };

    const currencySymbol = invoice.currency === 'USD' ? '$' : '';

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white p-8 rounded-lg shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
                <div id="print-modal-content" className="text-gray-900 flex-grow flex flex-col min-h-0">
                    <div className="text-center mb-8 border-b pb-6">
                        <h1 className="text-3xl font-extrabold text-blue-600">{storeSettings.storeName}</h1>
                        <p className="text-sm text-slate-500">{storeSettings.address}</p>
                        <p className="text-sm text-slate-500">تلفن: {storeSettings.phone}</p>
                        <p className="text-md text-slate-600 mt-2 font-bold">فاکتور خرید</p>
                    </div>
                    <div className="flex justify-between text-md mb-6">
                        <div>
                            <p><strong>شماره فاکتور:</strong> <span className="font-mono">{invoice.invoiceNumber || invoice.id}</span></p>
                            <p><strong>تأمین کننده:</strong> {supplier?.name || 'تأمین کننده حذف شده'}</p>
                        </div>
                        <div className="text-left">
                            <p><strong>تاریخ:</strong> {new Date(invoice.timestamp).toLocaleDateString('fa-IR')}</p>
                            <p><strong>ساعت:</strong> {new Date(invoice.timestamp).toLocaleTimeString('fa-IR')}</p>
                        </div>
                    </div>
                    <div className="flex-grow overflow-y-auto border-t border-b min-h-0">
                        <table className="min-w-full text-md">
                            <thead className="bg-slate-50 sticky top-0">
                                <tr>
                                    <th className="p-3 text-right font-bold">کالا</th>
                                    <th className="p-3 font-bold">تعداد</th>
                                    <th className="p-3 font-bold">قیمت خرید واحد</th>
                                    <th className="p-3 text-left font-bold">قیمت کل</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoice.items.map(item => (
                                    <tr key={item.productId + item.lotNumber} className="border-b">
                                        <td className="p-3 text-right font-semibold">{item.productName}</td>
                                        <td className="p-3 text-center">{item.quantity}</td>
                                        <td className="p-3 text-center" dir="ltr">{item.purchasePrice.toLocaleString('fa-IR', { maximumFractionDigits: 3 })} {currencySymbol}</td>
                                        <td className="p-3 text-left font-semibold" dir="ltr">{(item.quantity * item.purchasePrice).toLocaleString('fa-IR', { maximumFractionDigits: 3 })} {currencySymbol}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-8 pt-6 border-t text-left">
                         {invoice.currency === 'USD' && (
                             <p className="text-sm text-slate-500 mb-2">نرخ ارز: {invoice.exchangeRate} افغانی</p>
                         )}
                        <p className="text-2xl font-bold">
                            <span>مبلغ کل فاکتور: </span>
                            <span className="text-blue-600">{formatCurrency(invoice.totalAmount, storeSettings)}</span>
                        </p>
                    </div>
                </div>
                <div className="flex justify-end space-x-3 space-x-reverse mt-8 pt-6 border-t no-print">
                    <button onClick={onClose} className="px-6 py-3 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors font-semibold">بستن</button>
                    <button onClick={handlePrint} className="px-6 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-lg btn-primary font-semibold">چاپ نهایی رسید</button>
                </div>
            </div>
        </div>
    );
};

export default PurchasePrintPreviewModal;