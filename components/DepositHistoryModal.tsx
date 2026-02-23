import React from 'react';
import type { DepositHolder, DepositTransaction } from '../types';
import { XIcon, PrintIcon } from './icons';

interface DepositHistoryModalProps {
    holder: DepositHolder;
    transactions: DepositTransaction[];
    onClose: () => void;
}

const DepositHistoryModal: React.FC<DepositHistoryModalProps> = ({ holder, transactions, onClose }) => {
    
    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[150] p-0 md:p-4 modal-animate">
            <div className="bg-white w-full h-full md:max-w-4xl md:h-[85vh] md:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex-shrink-0 p-6 bg-indigo-600 text-white flex justify-between items-center">
                    <div>
                        <h2 className="text-xl md:text-2xl font-black">صورت‌حساب امانی: {holder.name}</h2>
                        <p className="text-[10px] md:text-xs opacity-80 font-bold mt-1 uppercase tracking-widest">Security Deposit Ledger</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handlePrint} className="p-2.5 bg-white/20 rounded-xl hover:bg-white/30 transition-colors no-print" title="چاپ صورت‌حساب">
                            <PrintIcon className="w-6 h-6" />
                        </button>
                        <button onClick={onClose} className="p-2.5 bg-white/20 rounded-xl hover:bg-red-500 transition-colors no-print">
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Wallets Summary */}
                <div className="flex-shrink-0 grid grid-cols-3 gap-2 md:gap-4 p-4 bg-indigo-50 border-b border-indigo-100">
                    <div className="bg-white p-3 rounded-2xl border border-indigo-200 text-center shadow-sm">
                        <p className="text-[10px] font-black text-slate-400 mb-1">موجودی افغانی</p>
                        <p className="font-black text-indigo-700 md:text-xl" dir="ltr">{Math.round(holder.balanceAFN).toLocaleString()} AFN</p>
                    </div>
                    <div className="bg-white p-3 rounded-2xl border border-indigo-200 text-center shadow-sm">
                        <p className="text-[10px] font-black text-slate-400 mb-1">موجودی دلار</p>
                        <p className="font-black text-indigo-700 md:text-xl" dir="ltr">{holder.balanceUSD.toLocaleString()} $</p>
                    </div>
                    <div className="bg-white p-3 rounded-2xl border border-indigo-200 text-center shadow-sm">
                        <p className="text-[10px] font-black text-slate-400 mb-1">موجودی تومان</p>
                        <p className="font-black text-indigo-700 md:text-xl" dir="ltr">{holder.balanceIRT.toLocaleString()} IRT</p>
                    </div>
                </div>

                {/* Ledger Content */}
                <div className="flex-grow overflow-y-auto p-4 md:p-6 bg-white printable-area">
                    <div className="hidden print:block text-center mb-8 border-b pb-4">
                        <h1 className="text-3xl font-black text-indigo-600 mb-2">گزارش امانات</h1>
                        <p className="text-lg font-bold text-slate-700">مشتری: {holder.name}</p>
                        <p className="text-sm text-slate-400 mt-1">تاریخ گزارش: {new Date().toLocaleDateString('fa-IR')}</p>
                    </div>
                    
                    <table className="min-w-full text-center border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-y border-slate-200">
                                <th className="p-3 font-black text-slate-500 text-sm">تاریخ</th>
                                <th className="p-3 font-black text-slate-500 text-sm">شرح تراکنش</th>
                                <th className="p-3 font-black text-slate-500 text-sm">واریز (+)</th>
                                <th className="p-3 font-black text-slate-500 text-sm">برداشت (-)</th>
                                <th className="p-3 font-black text-slate-500 text-sm">ارز</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(t => (
                                <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                    <td className="p-3 text-xs font-bold text-slate-400">{new Date(t.date).toLocaleDateString('fa-IR')}</td>
                                    <td className="p-3 text-sm font-semibold text-slate-700 text-right">{t.description || (t.type === 'deposit' ? 'واریز وجه امانی' : 'برداشت از امانت')}</td>
                                    <td className="p-3 font-black text-emerald-600" dir="ltr">{t.type === 'deposit' ? t.amount.toLocaleString() : '-'}</td>
                                    <td className="p-3 font-black text-orange-600" dir="ltr">{t.type === 'withdrawal' ? t.amount.toLocaleString() : '-'}</td>
                                    <td className="p-3 font-black text-indigo-800 text-xs">{t.currency}</td>
                                </tr>
                            ))}
                            {transactions.length === 0 && (
                                <tr><td colSpan={5} className="p-10 text-slate-300 font-bold">هیچ تراکنشی ثبت نشده است.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Print Footer */}
                <div className="hidden print:block p-6 border-t mt-auto text-xs text-slate-400 italic">
                    این گزارش صرفاً جهت اطلاع از وضعیت امانات صادر شده و فاقد ارزش معاملاتی دیگر است.
                </div>
            </div>
        </div>
    );
};

export default DepositHistoryModal;