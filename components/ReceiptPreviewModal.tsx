
import React from 'react';
import type { StoreSettings, Supplier, Customer, AnyTransaction } from '../types';
import { XIcon } from './icons';
import { useAppContext } from '../AppContext';
import { formatCurrency, numberToPersianWords } from '../utils/formatters';


interface ReceiptPreviewModalProps {
    person: Supplier | Customer;
    transaction: AnyTransaction;
    type: 'supplier' | 'customer';
    onClose: () => void;
}

const ReceiptPreviewModal: React.FC<ReceiptPreviewModalProps> = ({ person, transaction, type, onClose }) => {
    const { storeSettings } = useAppContext();

    const handlePrint = () => {
        window.print();
    };
    
    const title = type === 'supplier' ? 'رسید پرداخت وجه' : 'رسید دریافت وجه';
    const partyLabel = type === 'supplier' ? 'پرداخت شده به' : 'دریافت شده از';
    const personName = person ? person.name : 'حساب حذف شده';

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-[120] p-4 md:pt-20 overflow-y-auto">
            <div className="bg-white p-6 md:p-10 rounded-2xl shadow-2xl w-full max-w-2xl h-fit overflow-hidden my-auto md:my-0">
                <div className="printable-area text-gray-900 font-sans flex-grow">
                    <div className="text-center mb-6 border-b pb-4">
                        <h1 className="text-2xl font-black text-slate-800">{storeSettings.storeName}</h1>
                        <p className="text-xs text-slate-500 font-medium">{storeSettings.address}</p>
                        <p className="text-xs text-slate-500 font-medium">تلفن: {storeSettings.phone}</p>
                    </div>
                     <h2 className="text-xl text-center font-black mb-8 bg-slate-100 p-3 rounded-xl border border-slate-200">{title}</h2>
                    <div className="flex justify-between text-sm mb-6 px-2">
                        <p className="font-bold text-slate-600">شماره رسید: <span className="font-mono text-lg text-slate-900">{transaction.id.slice(0, 8)}</span></p>
                        <p className="font-bold text-slate-600">تاریخ: <span className="text-slate-900">{new Date(transaction.date).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' })}</span></p>
                    </div>
                    <div className="space-y-5 text-md border-y border-dashed border-slate-300 py-8 px-5 bg-slate-50/50 rounded-2xl">
                        <p className="font-medium"><strong>{partyLabel}:</strong> محترم <span className="font-black text-xl text-blue-900">{personName}</span></p>
                        <p className="font-medium"><strong>مبلغ به عدد:</strong> <span className="font-black font-mono text-2xl mx-2 text-emerald-600" dir="ltr">{formatCurrency(transaction.amount, storeSettings)}</span></p>
                        <p className="font-medium leading-relaxed"><strong>مبلغ به حروف:</strong> <span className="font-bold text-lg text-slate-700">{numberToPersianWords(transaction.amount)} {storeSettings.currencyName}</span></p>
                         <p className="font-medium italic text-slate-500"><strong>بابت:</strong> {transaction.description}</p>
                    </div>

                    <div className="mt-20 flex justify-around text-center text-sm">
                        <div className="w-48">
                            <p className="font-black text-slate-700 mb-14">تحویل دهنده وجه</p>
                            <div className="border-t-2 border-dashed border-gray-400 pt-3 text-slate-400 text-xs">امضا و تاریخ</div>
                        </div>
                        <div className="w-48">
                            <p className="font-black text-slate-700 mb-14">دریافت کننده وجه</p>
                             <div className="flex items-end justify-between gap-4">
                                <span className="border-t-2 border-dashed border-gray-400 pt-3 flex-grow text-slate-400 text-xs">امضا و مهر</span>
                                <span className="border-2 border-dashed border-gray-300 text-gray-300 w-16 h-18 flex items-center justify-center text-[10px] font-bold rounded-xl bg-slate-50">اثر انگشت</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex justify-end space-x-3 space-x-reverse mt-10 pt-6 border-t border-slate-100 no-print">
                    <button onClick={onClose} className="px-6 py-3 rounded-xl bg-slate-100 text-slate-700 font-bold">بستن</button>
                    <button onClick={handlePrint} className="px-8 py-3 rounded-xl bg-blue-600 text-white shadow-xl shadow-blue-100 btn-primary font-black active:scale-95 transition-all">چاپ نهایی رسید</button>
                </div>
            </div>
        </div>
    );
};

export default ReceiptPreviewModal;
