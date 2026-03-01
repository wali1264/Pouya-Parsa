import React, { useState, useMemo } from 'react';
import type { Supplier, Customer, Employee, AnyTransaction, PayrollTransaction } from '../types';
import { XIcon, PrintIcon } from './icons';
import { useAppContext } from '../AppContext';
import { formatCurrency, formatBalance } from '../utils/formatters';
import DateRangeFilter from './DateRangeFilter';
import ReportPrintPreviewModal from './ReportPrintPreviewModal';

interface TransactionHistoryModalProps {
    person: Supplier | Customer | Employee;
    transactions: AnyTransaction[];
    type: 'supplier' | 'customer' | 'employee';
    onClose: () => void;
    onReprint: (transactionId: string) => void;
}

const TransactionHistoryModal: React.FC<TransactionHistoryModalProps> = ({ person, transactions, type, onClose, onReprint }) => {
    const { storeSettings } = useAppContext();
    const [dateRange, setDateRange] = useState<{ start: Date, end: Date }>({ start: new Date(), end: new Date() });
    const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);

    // Safety check
    if (!person) return null;

    const filteredTransactions = useMemo(() => {
        if (!dateRange.start || !dateRange.end) return [];
        const startTime = dateRange.start.getTime();
        const endTime = dateRange.end.getTime();

        return transactions
            .filter(t => {
                const tTime = new Date(t.date).getTime();
                return tTime >= startTime && tTime <= endTime;
            })
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [transactions, dateRange]);

    // Calculate separated balances for Suppliers and Customers
    const balances = useMemo(() => {
        if (type === 'employee') return null;
        
        let debtAFN = 0, paidAFN = 0;
        let debtUSD = 0, paidUSD = 0;
        let debtIRT = 0, paidIRT = 0;

        filteredTransactions.forEach(t => {
            const currency = (t as any).currency || 'AFN';
            if (type === 'supplier') {
                if (t.type === 'purchase') {
                    if (currency === 'USD') debtUSD += t.amount; 
                    else if (currency === 'IRT') debtIRT += t.amount;
                    else debtAFN += t.amount;
                } else if (t.type === 'payment' || t.type === 'purchase_return') {
                    if (currency === 'USD') paidUSD += t.amount; 
                    else if (currency === 'IRT') paidIRT += t.amount;
                    else paidAFN += t.amount;
                }
            } else if (type === 'customer') {
                if (t.type === 'credit_sale') {
                    if (currency === 'USD') debtUSD += t.amount; 
                    else if (currency === 'IRT') debtIRT += t.amount;
                    else debtAFN += t.amount;
                } else if (t.type === 'payment' || t.type === 'sale_return') {
                    if (currency === 'USD') paidUSD += t.amount; 
                    else if (currency === 'IRT') paidIRT += t.amount;
                    else paidAFN += t.amount;
                }
            }
        });

        return {
            afn: debtAFN - paidAFN,
            usd: debtUSD - paidUSD,
            irt: debtIRT - paidIRT
        };
    }, [filteredTransactions, type]);


    const transactionTable = (
        <table className="min-w-full text-center responsive-table border-collapse">
            <thead className="bg-slate-100 sticky top-0 z-10 shadow-sm">
                <tr>
                    <th className="p-3 font-bold text-slate-700 border-b">تاریخ</th>
                    <th className="p-3 font-bold text-slate-700 border-b">شرح</th>
                    <th className="p-3 font-bold text-slate-700 border-b">بدهکار</th>
                    <th className="p-3 font-bold text-slate-700 border-b">بستانکار</th>
                    <th className="p-3 font-bold text-slate-700 border-b"></th>
                </tr>
            </thead>
            <tbody className="bg-white">
                {filteredTransactions.map(t => {
                    let debit = 0;
                    let credit = 0;
                    const currency = (t as any).currency || 'AFN';
                    const curSuffix = currency === 'USD' ? '$' : (currency === 'IRT' ? 'ت' : '');
                    
                    if (type === 'supplier') {
                        if (t.type === 'purchase') debit = t.amount;
                        else if (t.type === 'payment' || t.type === 'purchase_return') credit = t.amount;
                    } else if (type === 'customer') {
                        if (t.type === 'credit_sale') debit = t.amount;
                        else if (t.type === 'payment' || t.type === 'sale_return') credit = t.amount;
                    } else if (type === 'employee') {
                        const payrollTx = t as PayrollTransaction;
                        if (payrollTx.type === 'advance' || payrollTx.type === 'salary_payment') debit = payrollTx.amount;
                    }

                    return (
                        <tr key={t.id} className="hover:bg-blue-50 transition-colors border-b last:border-0">
                            <td data-label="تاریخ" className="p-3 text-slate-600">{new Date(t.date).toLocaleDateString('fa-IR')}</td>
                            <td data-label="شرح" className="p-3 text-slate-800 font-semibold">{t.description}</td>
                            <td data-label="بدهکار" className="p-3 text-red-600 font-mono" dir="ltr">{debit > 0 ? `${debit.toLocaleString('fa-IR')} ${curSuffix}` : '-'}</td>
                            <td data-label="بستانکار" className="p-3 text-green-600 font-mono" dir="ltr">{credit > 0 ? `${credit.toLocaleString('fa-IR')} ${curSuffix}` : '-'}</td>
                            <td className="p-3 actions-cell">
                                {t.type === 'payment' && (
                                    <button onClick={() => onReprint(t.id)} className="p-2 rounded-full text-gray-500 hover:text-green-600 hover:bg-green-100 transition-colors" title="چاپ مجدد رسید">
                                        <PrintIcon className="w-5 h-5" />
                                    </button>
                                )}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );


    return (
        <>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-[110] p-0 md:p-4 md:pt-16 overflow-y-auto modal-animate">
                <div className="bg-white md:rounded-2xl shadow-2xl border border-gray-200 w-full h-full md:max-w-5xl md:h-[85vh] flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="flex flex-shrink-0 justify-between items-center p-5 border-b border-gray-200 bg-slate-50 sticky top-0 z-20">
                        <div className="flex flex-col gap-1">
                            <h2 className="text-xl md:text-2xl font-bold text-slate-800">صورت حساب: {person.name}</h2>
                            {type !== 'employee' && balances ? (
                                <div className="flex gap-2 md:gap-3 mt-1 flex-wrap">
                                    <div className="bg-white border px-3 py-1 rounded-xl shadow-sm">
                                        <span className="text-[10px] font-black text-slate-400 block uppercase">افغانی</span>
                                        <span dir="ltr" className={`font-black ${balances.afn > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatBalance(balances.afn)}</span>
                                    </div>
                                    <div className="bg-white border px-3 py-1 rounded-xl shadow-sm">
                                        <span className="text-[10px] font-black text-slate-400 block uppercase">دلار</span>
                                        <span dir="ltr" className={`font-black ${balances.usd > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatBalance(balances.usd)}</span>
                                    </div>
                                    <div className="bg-white border px-3 py-1 rounded-xl shadow-sm">
                                        <span className="text-[10px] font-black text-slate-400 block uppercase">تومان</span>
                                        <span dir="ltr" className={`font-black ${balances.irt > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatBalance(balances.irt)}</span>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm md:text-md text-slate-600 mt-1">
                                    موجودی نهایی: <span dir="ltr" className={`font-black text-base md:text-lg ${person.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatCurrency(Math.abs(person.balance), storeSettings)}</span>
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setIsPrintPreviewOpen(true)} className="p-2.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-xl hover:bg-blue-100 transition-colors" title="چاپ گزارش">
                                <PrintIcon className="w-6 h-6" /> 
                            </button>
                            <button onClick={onClose} className="p-2.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors">
                                <XIcon className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                    
                    {/* Filters */}
                    <div className="flex-shrink-0 p-4 bg-white border-b border-gray-100">
                        <DateRangeFilter onFilterChange={(start, end) => setDateRange({ start, end })} />
                    </div>

                    {/* Table Content */}
                    <div className="flex-grow overflow-y-auto p-0 bg-slate-50">
                        <div className="bg-white shadow-sm min-h-full">
                            {transactionTable}
                            {filteredTransactions.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                    <p className="text-lg font-bold">تراکنشی یافت نشد.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            
            {isPrintPreviewOpen && (
                <ReportPrintPreviewModal
                    title={`صورت حساب ${person.name}`}
                    dateRange={dateRange}
                    onClose={() => setIsPrintPreviewOpen(false)}
                >
                    {transactionTable}
                     <div className="mt-6 pt-4 border-t text-left font-bold text-xl">
                        {type !== 'employee' && balances ? (
                            <div className="flex flex-col gap-2">
                                <div>مانده افغانی: <span dir="ltr">{formatBalance(balances.afn)} AFN</span></div>
                                <div>مانده دلار: <span dir="ltr">{formatBalance(balances.usd)} $</span></div>
                                <div>مانده تومان: <span dir="ltr">{formatBalance(balances.irt)} IRT</span></div>
                            </div>
                        ) : (
                            <>موجودی نهایی: {formatCurrency(person.balance, storeSettings)}</>
                        )}
                    </div>
                </ReportPrintPreviewModal>
            )}
        </>
    );
};

export default TransactionHistoryModal;