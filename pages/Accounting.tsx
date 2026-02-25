
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAppContext } from '../AppContext';
import type { Supplier, Employee, Customer, Expense, AnyTransaction, CustomerTransaction, SupplierTransaction, PayrollTransaction, DepositHolder } from '../types';
import { PlusIcon, XIcon, EyeIcon, TrashIcon, UserGroupIcon, AccountingIcon, TruckIcon, ChevronDownIcon, CheckIcon, EditIcon, FilterIcon, SettingsIcon } from '../components/icons';
import Toast from '../components/Toast';
import { formatCurrency, toEnglishDigits } from '../utils/formatters';
import TransactionHistoryModal from '../components/TransactionHistoryModal';
import ReceiptPreviewModal from '../components/ReceiptPreviewModal';

const Modal: React.FC<{ title: string, onClose: () => void, children: React.ReactNode, headerAction?: React.ReactNode }> = ({ title, onClose, children, headerAction }) => (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-[100] p-4 pt-12 md:pt-20 overflow-y-auto modal-animate">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-lg overflow-hidden my-0">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50 sticky top-0 z-10">
                <h2 className="text-xl font-bold text-slate-800">{title}</h2>
                <div className="flex items-center gap-2">
                    {headerAction}
                    <button onClick={onClose} className="p-1 rounded-full text-slate-500 hover:bg-red-100 hover:text-red-600 transition-colors"><XIcon className="w-6 h-6" /></button>
                </div>
            </div>
            <div className="p-6 bg-white">{children}</div>
        </div>
    </div>
);

const SuppliersTab = () => {
    const { suppliers, addSupplier, deleteSupplier, addSupplierPayment, supplierTransactions, storeSettings, inTransitInvoices } = useAppContext();
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isPayModalOpen, setIsPayModalOpen] = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [toast, setToast] = useState('');
    const [historyModalData, setHistoryModalData] = useState<{ person: Supplier, transactions: SupplierTransaction[] } | null>(null);
    const [receiptModalData, setReceiptModalData] = useState<{ person: Supplier, transaction: SupplierTransaction } | null>(null);
    
    const baseCurrency = storeSettings.baseCurrency || 'AFN';
    const baseCurrencyName = storeSettings.currencyConfigs[baseCurrency]?.name || 'AFN';

    const [addSupplierCurrency, setAddSupplierCurrency] = useState<'AFN' | 'USD' | 'IRT'>(baseCurrency);
    const [addSupplierRate, setAddSupplierRate] = useState('');
    const [addSupplierAmount, setAddSupplierAmount] = useState('');

    const [paymentCurrency, setPaymentCurrency] = useState<'AFN' | 'USD' | 'IRT'>(baseCurrency);
    const [exchangeRate, setExchangeRate] = useState('');
    const [paymentAmount, setPaymentAmount] = useState('');

    const showToast = (message: string) => { setToast(message); setTimeout(() => setToast(''), 3000); };

    const logisticsCapital = useMemo(() => {
        return inTransitInvoices.filter(inv => inv.status !== 'closed').reduce((sum, inv) => {
            const rate = inv.exchangeRate || 1;
            const paidBase = (inv.paidAmount || 0) * rate;
            return sum + paidBase;
        }, 0);
    }, [inTransitInvoices]);

    const handleAddSupplierForm = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const initialAmount = Number(addSupplierAmount);
        const initialType = formData.get('balanceType') as 'creditor' | 'debtor';
        if (addSupplierCurrency !== baseCurrency && initialAmount > 0 && (!addSupplierRate || Number(addSupplierRate) <= 0)) { showToast("لطفا نرخ ارز را وارد کنید."); return; }
        addSupplier({ name: formData.get('name') as string, contactPerson: formData.get('contactPerson') as string, phone: formData.get('phone') as string, }, initialAmount > 0 ? { amount: initialAmount, type: initialType, currency: addSupplierCurrency, exchangeRate: addSupplierCurrency === baseCurrency ? 1 : Number(addSupplierRate) } : undefined);
        setAddSupplierCurrency(baseCurrency); setAddSupplierRate(''); setAddSupplierAmount(''); setIsAddModalOpen(false);
    };
    
    const handleDelete = (supplier: Supplier) => {
        if (Math.abs(supplier.balanceAFN) > 0 || Math.abs(supplier.balanceUSD) > 0 || Math.abs(supplier.balanceIRT) > 0) { showToast("حذف فقط برای حساب‌های با موجودی صفر امکان‌پذیر است."); return; }
        if (window.confirm(`آیا از حذف تأمین‌کننده "${supplier.name}" اطمینان دارید؟`)) deleteSupplier(supplier.id);
    };

    const handleOpenPayModal = (supplier: Supplier) => { 
        setSelectedSupplier(supplier); 
        setPaymentCurrency(storeSettings.baseCurrency || 'AFN'); 
        setExchangeRate(''); 
        setPaymentAmount(''); 
        setIsPayModalOpen(true); 
    };

    const handleAddPaymentForm = async (e: React.FormEvent<HTMLDivElement> | React.FormEvent<HTMLFormElement>) => {
        e.preventDefault(); if (!selectedSupplier) return;
        const amount = Number(paymentAmount);
        const description = (new FormData(e.currentTarget as HTMLFormElement)).get('description') as string || 'پرداخت وجه';
        if (!amount || amount <= 0) { showToast("مبلغ باید بزرگتر از صفر باشد."); return; }
        if (paymentCurrency !== baseCurrency && (!exchangeRate || Number(exchangeRate) <= 0)) { showToast("لطفاً نرخ ارز را وارد کنید."); return; }
        
        const newTransaction = await addSupplierPayment(selectedSupplier.id, amount, description, paymentCurrency, paymentCurrency === baseCurrency ? 1 : Number(exchangeRate));
        
        if (newTransaction) { 
            setIsPayModalOpen(false); 
            setReceiptModalData({ person: selectedSupplier, transaction: newTransaction }); 
            setSelectedSupplier(null); 
        }
    };
    
    const handleViewHistory = (supplier: Supplier) => { const transactions = supplierTransactions.filter(t => t.supplierId === supplier.id); setHistoryModalData({ person: supplier, transactions }); };

    const convertedInitialBalance = useMemo(() => { 
        if (!addSupplierAmount || !addSupplierRate || Number(addSupplierRate) <= 0) return 0; 
        const config = storeSettings.currencyConfigs[addSupplierCurrency];
        return config.method === 'multiply' ? Number(addSupplierAmount) * Number(addSupplierRate) : Number(addSupplierAmount) / Number(addSupplierRate); 
    }, [addSupplierAmount, addSupplierRate, addSupplierCurrency, storeSettings.currencyConfigs]);

    const convertedPayment = useMemo(() => { 
        if (!paymentAmount || !exchangeRate || Number(exchangeRate) <= 0) return 0; 
        const config = storeSettings.currencyConfigs[paymentCurrency];
        return config.method === 'multiply' ? Number(paymentAmount) * Number(exchangeRate) : Number(paymentAmount) / Number(exchangeRate); 
    }, [paymentAmount, exchangeRate, paymentCurrency, storeSettings.currencyConfigs]);

    return (
        <div>
            {toast && <Toast message={toast} onClose={() => setToast('')} />}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 rounded-3xl text-white shadow-xl flex items-center justify-between">
                    <div>
                        <p className="text-xs font-black text-blue-100 uppercase tracking-widest mb-1 opacity-80">سرمایه در گردش لجستیک ({baseCurrency})</p>
                        <h4 className="text-2xl font-black drop-shadow-sm">{logisticsCapital.toLocaleString()}</h4>
                        <p className="text-[10px] text-blue-200 mt-1 font-bold">مجموع مبالغ پیش‌پرداخت کالاهای در راه</p>
                    </div>
                    <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-md"><TruckIcon className="w-8 h-8" /></div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-black text-slate-400 uppercase mb-1">تعداد تأمین‌کنندگان فعال</p>
                        <h4 className="text-2xl font-black text-slate-800">{suppliers.length} مجموعه</h4>
                    </div>
                    <button onClick={() => setIsAddModalOpen(true)} className="bg-blue-600 text-white p-4 rounded-2xl hover:bg-blue-700 transition-all shadow-lg active:scale-95"><PlusIcon className="w-6 h-6"/></button>
                </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-200/60 shadow-lg hidden md:block bg-white/40">
                 <table className="min-w-full text-center table-zebra">
                    <thead className="bg-slate-50/80 backdrop-blur-md sticky top-0 z-10">
                        <tr>
                            <th className="p-4 font-bold text-slate-700">نام</th>
                            <th className="p-4 font-bold text-slate-700">تلفن</th>
                            <th className="p-4 font-bold text-slate-700">موجودی حساب (بدهی ما)</th>
                            <th className="p-4 font-bold text-slate-700">عملیات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {suppliers.map(s => (
                            <tr key={s.id} className="border-t border-gray-200/60 transition-colors hover:bg-blue-50/30">
                                <td className="p-4 text-lg font-semibold text-slate-800">{s.name}</td>
                                <td className="p-4 text-lg text-slate-600">{s.phone}</td>
                                <td className="p-4 text-md font-black" dir="ltr">
                                    <div className="flex flex-col gap-1 items-center">
                                        <span className="text-red-600">{Math.round(s.balanceAFN || 0).toLocaleString()} {storeSettings.currencyConfigs['AFN']?.name || 'افغانی'}</span>
                                        <span className="text-blue-600 border-t border-slate-100 pt-0.5">{(s.balanceUSD || 0).toLocaleString()} {storeSettings.currencyConfigs['USD']?.symbol || '$'}</span>
                                        <span className="text-orange-600 border-t border-slate-100 pt-0.5">{(s.balanceIRT || 0).toLocaleString()} {storeSettings.currencyConfigs['IRT']?.name || 'تومان'}</span>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="flex justify-center items-center gap-2">
                                        <button onClick={() => handleViewHistory(s)} className="p-2.5 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-100 transition-all" title="مشاهده صورت حساب"><EyeIcon className="w-6 h-6"/></button>
                                        <button onClick={() => handleDelete(s)} className={`p-2.5 rounded-xl transition-all ${(Math.abs(s.balanceAFN || 0) === 0 && Math.abs(s.balanceUSD || 0) === 0 && Math.abs(s.balanceIRT || 0) === 0) ? 'text-red-500 hover:bg-red-50 cursor-pointer' : 'text-slate-300 cursor-not-allowed'}`} disabled={Math.abs(s.balanceAFN || 0) > 0 || Math.abs(s.balanceUSD || 0) > 0 || Math.abs(s.balanceIRT || 0) > 0}><TrashIcon className="w-6 h-6" /></button>
                                        <button onClick={() => handleOpenPayModal(s)} className="bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-md hover:shadow-emerald-200 transition-all active:scale-95">ثبت پرداخت</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="md:hidden space-y-4">
                {suppliers.map(s => (
                    <div key={s.id} className="bg-white/80 backdrop-blur-xl p-5 rounded-2xl shadow-md border border-gray-200/60 active:scale-[0.98] transition-all">
                        <div className="flex justify-between items-start mb-1">
                           <div className="flex flex-col"><h3 className="font-black text-xl text-slate-800">{s.name}</h3><p className="text-xs text-slate-400 font-medium">{s.phone || 'بدون شماره'}</p></div>
                           <div className="flex gap-2"><button onClick={() => handleViewHistory(s)} className="p-2.5 bg-slate-100 rounded-xl text-slate-600 active:bg-blue-100"><EyeIcon className="w-5 h-5" /></button><button onClick={() => handleDelete(s)} className={`p-2.5 bg-slate-100 rounded-xl transition-colors ${(Math.abs(s.balanceAFN || 0) === 0 && Math.abs(s.balanceUSD || 0) === 0 && Math.abs(s.balanceIRT || 0) === 0) ? 'text-red-500' : 'text-slate-300'}`} disabled={Math.abs(s.balanceAFN || 0) > 0 || Math.abs(s.balanceUSD || 0) > 0 || Math.abs(s.balanceIRT || 0) > 0}><TrashIcon className="w-5 h-5" /></button></div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-dashed border-slate-200 flex justify-between items-center">
                            <div className="text-right">
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">بدهی ما</p>
                                <div className="flex flex-col items-start font-black text-sm" dir="ltr">
                                    <p className="text-red-600 text-base">{Math.round(s.balanceAFN || 0).toLocaleString()} {storeSettings.currencyConfigs['AFN']?.name || 'افغانی'}</p>
                                    <p className="text-blue-600">{(s.balanceUSD || 0).toLocaleString()} {storeSettings.currencyConfigs['USD']?.symbol || '$'}</p>
                                    <p className="text-orange-600">{(s.balanceIRT || 0).toLocaleString()} {storeSettings.currencyConfigs['IRT']?.name || 'تومان'}</p>
                                </div>
                            </div>
                            <button onClick={() => handleOpenPayModal(s)} className="bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-sm font-black shadow-lg active:shadow-none transition-all">ثبت پرداخت</button>
                        </div>
                    </div>
                ))}
            </div>

            {isAddModalOpen && (
                <Modal title="افزودن تأمین‌کننده جدید" onClose={() => setIsAddModalOpen(false)}>
                    <form onSubmit={handleAddSupplierForm} className="space-y-4">
                        <input name="name" placeholder="نام تأمین‌کننده" className="w-full p-3.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-50 outline-none transition-all" required/>
                        <input name="contactPerson" placeholder="فرد مسئول" className="w-full p-3.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-50 outline-none transition-all" />
                        <input name="phone" placeholder="شماره تلفن" className="w-full p-3.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-50 outline-none transition-all" dir="ltr" />
                        <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 space-y-4">
                            <p className="text-sm font-black text-blue-800">تراز اول دوره (اختیاری)</p>
                            <div className="flex gap-4">
                                {['AFN', 'USD', 'IRT'].map(cur => (
                                    <label key={cur} className="flex items-center gap-2 cursor-pointer group">
                                        <input type="radio" checked={addSupplierCurrency === cur} onChange={() => {setAddSupplierCurrency(cur as any); setAddSupplierRate('');}} className="w-4 h-4 text-blue-600" /><span className="text-sm font-semibold text-slate-700">{cur}</span>
                                    </label>
                                ))}
                            </div>
                            {addSupplierCurrency !== baseCurrency && (
                                <div className="flex items-center gap-3">
                                    <span className="text-xs whitespace-nowrap font-bold text-slate-500">نرخ تبدیل ({baseCurrencyName} به {addSupplierCurrency}):</span>
                                    <input type="text" inputMode="decimal" value={addSupplierRate} onChange={e => setAddSupplierRate(toEnglishDigits(e.target.value).replace(/[^0-9.]/g, ''))} placeholder="نرخ" className="w-full p-2.5 border border-slate-200 rounded-xl font-mono text-center outline-none" />
                                </div>
                            )}
                            <div className="flex gap-2"><input name="initialBalance" type="text" inputMode="decimal" value={addSupplierAmount} onChange={e => setAddSupplierAmount(toEnglishDigits(e.target.value).replace(/[^0-9.]/g, ''))} placeholder="مبلغ" className="w-2/3 p-2.5 border border-slate-200 rounded-xl outline-none" /><select name="balanceType" className="w-1/3 p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-bold"><option value="creditor">ما بدهکاریم</option><option value="debtor">او بدهکار است</option></select></div>
                            {addSupplierCurrency !== baseCurrency && convertedInitialBalance > 0 && <p className="text-[10px] font-black text-blue-600 text-left">معادل تقریبی: {Math.round(convertedInitialBalance).toLocaleString()} {baseCurrencyName}</p>}
                        </div>
                        <button type="submit" className="w-full bg-blue-600 text-white p-4 rounded-xl shadow-xl hover:bg-blue-700 transition-all font-black text-lg">ذخیره نهایی</button>
                    </form>
                </Modal>
            )}

            {isPayModalOpen && selectedSupplier && (
                 <Modal title={`ثبت پرداخت: ${selectedSupplier.name}`} onClose={() => setIsPayModalOpen(false)}>
                    <form onSubmit={handleAddPaymentForm} className="space-y-4">
                        <div className="flex gap-4 p-3 bg-blue-50 rounded-xl">
                            {['AFN', 'USD', 'IRT'].map(c => (
                                <label key={c} className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" checked={paymentCurrency === c} onChange={() => {setPaymentCurrency(c as any); setExchangeRate('');}} className="text-blue-600" /><span className="text-xs font-bold">{c}</span>
                                </label>
                            ))}
                        </div>
                        {paymentCurrency !== baseCurrency && (
                            <div className="flex items-center gap-3">
                                <span className="text-xs whitespace-nowrap font-bold text-slate-400">نرخ تبدیل ({baseCurrencyName} به {paymentCurrency}):</span>
                                <input type="text" inputMode="decimal" value={exchangeRate} onChange={e => setExchangeRate(toEnglishDigits(e.target.value).replace(/[^0-9.]/g, ''))} placeholder="نرخ" className="w-full p-2.5 border border-slate-200 rounded-xl font-mono text-center" />
                            </div>
                        )}
                        <input name="amount" type="text" inputMode="decimal" value={paymentAmount} onChange={e => setPaymentAmount(toEnglishDigits(e.target.value).replace(/[^0-9.]/g, ''))} placeholder={`مبلغ (${paymentCurrency})`} className="w-full p-4 border border-slate-200 rounded-xl font-bold text-center text-xl" required />
                        {paymentCurrency !== baseCurrency && convertedPayment > 0 && <p className="text-[10px] font-black text-emerald-600 text-left">معادل از حساب کل: {Math.round(convertedPayment).toLocaleString()} {baseCurrencyName}</p>}
                        <input name="description" placeholder="توضیحات (اختیاری)" className="w-full p-4 border border-slate-200 rounded-xl" />
                        <button type="submit" className="w-full bg-emerald-600 text-white p-4 rounded-xl shadow-xl font-black text-lg active:scale-[0.98]">ثبت و چاپ رسید</button>
                    </form>
                </Modal>
            )}
            {historyModalData && <TransactionHistoryModal person={historyModalData.person} transactions={historyModalData.transactions} type="supplier" onClose={() => setHistoryModalData(null)} onReprint={(tid) => { const tx = supplierTransactions.find(t=>t.id===tid); if(tx) { setHistoryModalData(null); setReceiptModalData({person: historyModalData.person, transaction: tx}); } }} />}
            {receiptModalData && <ReceiptPreviewModal person={receiptModalData.person} transaction={receiptModalData.transaction} type="supplier" onClose={() => setReceiptModalData(null)} />}
        </div>
    );
};

const PayrollTab = () => {
    const { employees, addEmployee, addEmployeeAdvance, payrollTransactions, processAndPaySalaries, storeSettings } = useAppContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [toast, setToast] = useState('');
    const [historyModalData, setHistoryModalData] = useState<{ person: Employee, transactions: PayrollTransaction[] } | null>(null);

    const showToast = (message: string) => { setToast(message); setTimeout(() => setToast(''), 3000); };
    
    const handleAddEmployeeForm = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const basic = Number(toEnglishDigits(formData.get('basicSalary') as string).replace(/[^0-9.]/g, ''));
        const benefits = Number(toEnglishDigits(formData.get('otherBenefits') as string).replace(/[^0-9.]/g, ''));
        
        addEmployee({
            name: formData.get('name') as string,
            position: formData.get('position') as string,
            basicSalary: basic,
            otherBenefits: benefits,
            monthlySalary: basic + benefits,
        });
        setIsModalOpen(false);
    };
    
    const [advanceCurrency, setAdvanceCurrency] = useState<'AFN' | 'USD' | 'IRT'>(storeSettings.baseCurrency);
    const [advanceRate, setAdvanceRate] = useState('');

    const handleAddAdvanceForm = (ev: React.FormEvent<HTMLFormElement>, employeeId: string) => {
        ev.preventDefault();
        const formData = new FormData(ev.currentTarget);
        const amount = Number(toEnglishDigits(formData.get('amount') as string).replace(/[^0-9.]/g, ''));
        const description = formData.get('description') as string || 'مساعده';
        
        if (!amount || amount <= 0) return;
        
        if (advanceCurrency !== storeSettings.baseCurrency && (!advanceRate || Number(advanceRate) <= 0)) {
            showToast("لطفا نرخ ارز را وارد کنید.");
            return;
        }

        addEmployeeAdvance(employeeId, amount, description, advanceCurrency, advanceCurrency === storeSettings.baseCurrency ? 1 : Number(advanceRate));
        (ev.target as HTMLFormElement).reset();
        setAdvanceRate('');
        showToast("تراکنش با موفقیت ثبت شد.");
    };

    const handleProcessSalaries = () => {
        if (window.confirm("آیا از پردازش و پرداخت حقوق تمام کارمندان اطمینان دارید؟ این عمل مابه‌التفاوت حقوق را محاسبه کرده، تمام پیش‌پرداخت‌ها را صفر و پرداخت نهایی را به عنوان هزینه ثبت می‌کند.")) {
            const result = processAndPaySalaries();
            showToast(result.message);
        }
    };
    
    const handleViewHistory = (employee: Employee) => {
        const transactions = payrollTransactions.filter(t => t.employeeId === employee.id);
        setHistoryModalData({ person: employee, transactions });
    };

    return (
         <div>
            {toast && <Toast message={toast} onClose={() => setToast('')} />}
            <div className="flex flex-wrap gap-4 mb-8">
                <button onClick={() => setIsModalOpen(true)} className="flex items-center bg-blue-600 text-white px-5 py-3 rounded-xl shadow-lg btn-primary">
                    <PlusIcon className="w-5 h-5 ml-2" /> <span className="font-bold">افزودن کارمند</span>
                </button>
                 <button onClick={handleProcessSalaries} className="flex items-center bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg btn-primary hover:!shadow-emerald-200 transition-all">
                    <span className="font-bold">پردازش و تسویه حقوق ماهانه</span>
                </button>
            </div>

            <div className="hidden md:block overflow-hidden rounded-2xl border border-gray-200 shadow-lg bg-white/40">
                <table className="min-w-full text-center table-zebra">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="p-4 font-bold text-slate-700"></th>
                            <th className="p-4 font-bold text-slate-700 text-right">نام کارمند</th>
                            <th className="p-4 font-bold text-slate-700">حقوق ماهانه</th>
                            <th className="p-4 font-bold text-slate-700">مانده ({storeSettings.currencyConfigs['AFN']?.name || 'افغانی'})</th>
                            <th className="p-4 font-bold text-slate-700">مانده ({storeSettings.currencyConfigs['USD']?.name || 'دلار'})</th>
                            <th className="p-4 font-bold text-slate-700">مانده ({storeSettings.currencyConfigs['IRT']?.name || 'تومان'})</th>
                            <th className="p-4 font-bold text-slate-700">ثبت مساعده / پاداش</th>
                        </tr>
                    </thead>
                    <tbody>
                        {employees.map(e => (
                            <tr key={e.id} className="border-t border-gray-200 hover:bg-blue-50/30 transition-colors">
                                <td className="p-4">
                                    <button onClick={() => handleViewHistory(e)} className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-100 transition-all"><EyeIcon className="w-6 h-6"/></button>
                                </td>
                                <td className="p-4 text-lg font-bold text-slate-800 text-right">{e.name}</td>
                                <td className="p-4 text-md text-slate-600 font-bold">{formatCurrency(e.monthlySalary, storeSettings)}</td>
                                <td className="p-4 text-md font-bold text-red-500">{e.balanceAFN.toLocaleString()}</td>
                                <td className="p-4 text-md font-bold text-blue-500">{e.balanceUSD.toLocaleString()}</td>
                                <td className="p-4 text-md font-bold text-orange-500">{e.balanceIRT.toLocaleString()}</td>
                                <td className="p-4">
                                    <form onSubmit={(ev) => handleAddAdvanceForm(ev, e.id)} className="flex flex-col gap-2 w-full max-w-sm mx-auto">
                                        <div className="flex gap-2">
                                            <select value={advanceCurrency} onChange={(e) => setAdvanceCurrency(e.target.value as any)} className="p-2 border border-slate-200 rounded-xl text-xs font-bold bg-white">
                                                {['AFN', 'USD', 'IRT'].map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                            <input type="text" inputMode="decimal" name="amount" onInput={(e:any) => e.target.value = toEnglishDigits(e.target.value).replace(/[^0-9.]/g, '')} className="flex-grow p-2 border border-slate-200 rounded-xl text-center font-bold focus:ring-2 focus:ring-amber-500 outline-none" placeholder="مبلغ" required />
                                        </div>
                                        {advanceCurrency !== storeSettings.baseCurrency && (
                                            <input type="text" inputMode="decimal" value={advanceRate} onChange={e => setAdvanceRate(toEnglishDigits(e.target.value).replace(/[^0-9.]/g, ''))} className="w-full p-2 border border-slate-200 rounded-xl text-center text-xs font-mono" placeholder={`نرخ تبدیل (${storeSettings.currencyConfigs[storeSettings.baseCurrency].name} به ${advanceCurrency})`} required />
                                        )}
                                        <div className="flex gap-2">
                                            <input type="text" name="description" className="flex-grow p-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 outline-none" placeholder="توضیحات (اختیاری)" />
                                            <button type="submit" className="bg-amber-500 text-white px-4 py-2 rounded-xl text-xs font-black shadow-md hover:shadow-amber-100 transition-all active:scale-95">ثبت</button>
                                        </div>
                                    </form>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="md:hidden space-y-4">
                {employees.map(e => (
                    <div key={e.id} className="bg-white/80 p-5 rounded-2xl shadow-md border border-slate-100">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="font-black text-xl text-slate-800">{e.name}</h3>
                                <p className="text-xs text-slate-400">{e.position || 'کارمند فروشگاه'}</p>
                            </div>
                            <button onClick={() => handleViewHistory(e)} className="p-2.5 bg-slate-100 rounded-xl text-slate-600 active:bg-blue-100 active:text-blue-600"><EyeIcon className="w-5 h-5"/></button>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-4 text-right bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                            <div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">حقوق ماهانه</p>
                                <p className="font-bold text-slate-700">{formatCurrency(e.monthlySalary, storeSettings)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">پیش‌پرداخت</p>
                                <p className="font-bold text-red-500">{formatCurrency(e.balance, storeSettings)}</p>
                            </div>
                        </div>
                        <div className="pt-3 border-t border-dashed border-slate-200">
                             <div className="flex justify-between items-center mb-3">
                                <p className="text-[10px] text-emerald-600 font-bold uppercase">مانده تسویه</p>
                                <p className="font-black text-emerald-600 text-lg">{formatCurrency(e.monthlySalary - e.balance, storeSettings)}</p>
                            </div>
                            <form onSubmit={(ev) => handleAddAdvanceForm(ev, e.id)} className="flex flex-col gap-2 p-3 bg-slate-100/50 rounded-xl border border-slate-200">
                                <div className="flex gap-2">
                                    <input type="text" inputMode="decimal" name="amount" onInput={(e:any) => e.target.value = toEnglishDigits(e.target.value).replace(/[^0-9.]/g, '')} className="w-1/3 p-2.5 border border-slate-200 rounded-xl text-center text-sm font-bold" placeholder="مبلغ" required />
                                    <input type="text" name="description" className="w-2/3 p-2.5 border border-slate-200 rounded-xl text-xs" placeholder="توضیحات (اختیاری)" />
                                </div>
                                <button type="submit" className="w-full bg-amber-500 text-white py-2.5 rounded-xl text-sm font-black shadow-md active:translate-y-0.5 transition-all">ثبت تراکنش مالی</button>
                            </form>
                        </div>
                    </div>
                ))}
            </div>

            {isModalOpen && (
                <Modal title="افزودن کارمند جدید" onClose={() => setIsModalOpen(false)}>
                    <form onSubmit={handleAddEmployeeForm} className="space-y-4">
                        <input name="name" placeholder="نام کامل" className="w-full p-4 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-50" required />
                        <input name="position" placeholder="موقعیت شغلی (مثلاً فروشنده)" className="w-full p-4 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-50" />
                        <div className="grid grid-cols-2 gap-4">
                            <input name="basicSalary" type="text" inputMode="decimal" onInput={(e:any) => e.target.value = toEnglishDigits(e.target.value).replace(/[^0-9.]/g, '')} placeholder="حقوق پایه" className="w-full p-4 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-50 font-bold" required />
                            <input name="otherBenefits" type="text" inputMode="decimal" onInput={(e:any) => e.target.value = toEnglishDigits(e.target.value).replace(/[^0-9.]/g, '')} placeholder="سایر مزایا" className="w-full p-4 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-50 font-bold" defaultValue="0" />
                        </div>
                        <button type="submit" className="w-full bg-blue-600 text-white p-4 rounded-xl shadow-xl shadow-blue-100 font-black text-lg">ذخیره کارمند</button>
                    </form>
                </Modal>
            )}
            {historyModalData && (
                 <TransactionHistoryModal 
                    person={historyModalData.person}
                    transactions={historyModalData.transactions}
                    type="employee"
                    onClose={() => setHistoryModalData(null)}
                    onReprint={() => {}} 
                />
            )}
        </div>
    );
};

const CustomersTab = () => {
    const { customers, depositHolders, addCustomer, deleteCustomer, addCustomerPayment, customerTransactions, storeSettings } = useAppContext();
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isPayModalOpen, setIsPayModalOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [toast, setToast] = useState('');
    const [historyModalData, setHistoryModalData] = useState<{ person: Customer, transactions: CustomerTransaction[] } | null>(null);
    const [receiptModalData, setReceiptModalData] = useState<{ person: Customer, transaction: CustomerTransaction } | null>(null);

    const baseCurrency = storeSettings.baseCurrency || 'AFN';
    const baseCurrencyName = storeSettings.currencyConfigs[baseCurrency]?.name || 'AFN';

    // Add Customer State
    const [addCustomerCurrency, setAddCustomerCurrency] = useState<'AFN' | 'USD' | 'IRT'>(baseCurrency);
    const [addCustomerRate, setAddCustomerRate] = useState('');
    const [addCustomerAmount, setAddCustomerAmount] = useState('');

    // Payment State
    const [paymentCurrency, setPaymentCurrency] = useState<'AFN' | 'USD' | 'IRT'>(baseCurrency);
    const [exchangeRate, setExchangeRate] = useState('');
    const [paymentAmount, setPaymentAmount] = useState('');
    const [selectedTrusteeId, setSelectedTrusteeId] = useState<string>('');
    const [isTrusteeMenuOpen, setIsTrusteeMenuOpen] = useState(false);
    const trusteeMenuRef = useRef<HTMLDivElement>(null);

    const showToast = (message: string) => { setToast(message); setTimeout(() => setToast(''), 3000); };

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (trusteeMenuRef.current && !trusteeMenuRef.current.contains(e.target as Node)) {
                setIsTrusteeMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleAddCustomerForm = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const initialAmount = Number(addCustomerAmount);
        const initialType = formData.get('balanceType') as 'creditor' | 'debtor';

        if (addCustomerCurrency !== baseCurrency && initialAmount > 0 && (!addCustomerRate || Number(addCustomerRate) <= 0)) {
            showToast("لطفا نرخ ارز را وارد کنید.");
            return;
        }

        addCustomer({
            name: formData.get('name') as string,
            phone: formData.get('phone') as string,
        }, initialAmount > 0 ? { 
            amount: initialAmount, 
            type: initialType,
            currency: addCustomerCurrency,
            exchangeRate: addCustomerCurrency === baseCurrency ? 1 : Number(addCustomerRate)
        } : undefined);
        
        setAddCustomerCurrency(baseCurrency);
        setAddCustomerRate('');
        setAddCustomerAmount('');
        setIsAddModalOpen(false);
    };

    const handleDelete = (customer: Customer) => {
        if (Math.abs(customer.balanceAFN) > 0 || Math.abs(customer.balanceUSD) > 0 || Math.abs(customer.balanceIRT) > 0) {
            showToast("حذف فقط برای حساب‌های با موجودی صفر امکان‌پذیر است.");
            return;
        }
        if (window.confirm(`آیا از حذف مشتری "${customer.name}" اطمینان دارید؟`)) {
            deleteCustomer(customer.id);
        }
    };

    const handleOpenPayModal = (customer: Customer) => {
        setSelectedCustomer(customer);
        setPaymentCurrency(storeSettings.baseCurrency || 'AFN');
        setExchangeRate('');
        setPaymentAmount('');
        setSelectedTrusteeId('');
        setIsPayModalOpen(true);
    };

    const handleAddPaymentForm = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!selectedCustomer) return;
        
        const amount = Number(paymentAmount);
        const formData = new FormData(e.currentTarget);
        const description = formData.get('description') as string || 'دریافت نقدی';
        
        if (!amount || amount <= 0) {
            showToast("مبلغ باید بزرگتر از صفر باشد.");
            return;
        }

        if (paymentCurrency !== baseCurrency && (!exchangeRate || Number(exchangeRate) <= 0)) {
            showToast("لطفاً نرخ ارز را وارد کنید.");
            return;
        }

        const newTransaction = await addCustomerPayment(
            selectedCustomer.id, 
            amount, 
            description, 
            paymentCurrency, 
            paymentCurrency === baseCurrency ? 1 : Number(exchangeRate),
            selectedTrusteeId || undefined
        );
        
        if (newTransaction) {
            setIsPayModalOpen(false);
            setReceiptModalData({ person: selectedCustomer, transaction: newTransaction });
            setSelectedCustomer(null);
            setSelectedTrusteeId('');
        }
    };

    const handleViewHistory = (customer: Customer) => {
        const transactions = customerTransactions.filter(t => t.customerId === customer.id);
        setHistoryModalData({ person: customer, transactions });
    };

    const handleReprint = (transactionId: string) => {
        const transaction = customerTransactions.find(t => t.id === transactionId);
        const customer = customers.find(c => c.id === transaction?.customerId);
        if (transaction && customer) {
            setHistoryModalData(null);
            setReceiptModalData({ person: customer, transaction });
        }
    };

    const convertedInitialBalance = useMemo(() => {
        if (!addCustomerAmount || !addCustomerRate || Number(addCustomerRate) <= 0) return 0;
        const config = storeSettings.currencyConfigs[addCustomerCurrency];
        return config.method === 'multiply' 
            ? Number(addCustomerAmount) * Number(addCustomerRate)
            : Number(addCustomerAmount) / Number(addCustomerRate);
    }, [addCustomerAmount, addCustomerRate, addCustomerCurrency, storeSettings.currencyConfigs]);

    const convertedPayment = useMemo(() => {
        if (!paymentAmount || !exchangeRate || Number(exchangeRate) <= 0) return 0;
        const config = storeSettings.currencyConfigs[paymentCurrency];
        return config.method === 'multiply'
            ? Number(paymentAmount) * Number(exchangeRate)
            : Number(paymentAmount) / Number(exchangeRate);
    }, [paymentAmount, exchangeRate, paymentCurrency, storeSettings.currencyConfigs]);

    const selectedTrustee = useMemo(() => depositHolders.find(h => h.id === selectedTrusteeId), [depositHolders, selectedTrusteeId]);

    return (
        <div>
             {toast && <Toast message={toast} onClose={() => setToast('')} />}
            <button onClick={() => setIsAddModalOpen(true)} className="flex items-center bg-blue-600 text-white px-5 py-3 rounded-xl shadow-lg mb-8 btn-primary">
                <PlusIcon className="w-5 h-5 ml-2" /> <span className="font-bold">افزودن مشتری</span>
            </button>
            <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-lg hidden md:block bg-white/40">
                <table className="min-w-full text-center table-zebra">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="p-4 font-bold text-slate-700">نام مشتری</th>
                            <th className="p-4 font-bold text-slate-700">تلفن</th>
                            <th className="p-4 font-bold text-slate-700">موجودی حساب (طلب ما)</th>
                            <th className="p-4 font-bold text-slate-700">عملیات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {customers.map(c => (
                            <tr key={c.id} className="border-t border-gray-200 hover:bg-blue-50/30 transition-colors">
                                <td className="p-4 text-lg font-bold text-slate-800">{c.name}</td>
                                <td className="p-4 text-md text-slate-600">{c.phone}</td>
                                <td className="p-4 text-md font-black" dir="ltr">
                                    <div className="flex flex-col gap-1 items-center">
                                        <span className="text-emerald-600">{Math.round(c.balanceAFN || 0).toLocaleString()} {storeSettings.currencyConfigs['AFN']?.name || 'افغانی'}</span>
                                        <span className="text-blue-600 border-t border-slate-100 pt-0.5">{(c.balanceUSD || 0).toLocaleString()} {storeSettings.currencyConfigs['USD']?.symbol || '$'}</span>
                                        <span className="text-orange-600 border-t border-slate-100 pt-0.5">{(c.balanceIRT || 0).toLocaleString()} {storeSettings.currencyConfigs['IRT']?.name || 'تومان'}</span>
                                    </div>
                                </td>
                                <td className="p-4">
                                     <div className="flex justify-center items-center gap-2">
                                        <button onClick={() => handleViewHistory(c)} className="p-2.5 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-100 transition-all" title="مشاهده صورت حساب"><EyeIcon className="w-6 h-6"/></button>
                                        <button 
                                            onClick={() => handleDelete(c)} 
                                            className={`p-2.5 rounded-xl transition-all ${(Math.abs(c.balanceAFN || 0) === 0 && Math.abs(c.balanceUSD || 0) === 0 && Math.abs(c.balanceIRT || 0) === 0) ? 'text-red-500 hover:bg-red-50 cursor-pointer' : 'text-slate-300 cursor-not-allowed'}`} 
                                            title={(Math.abs(c.balanceAFN || 0) === 0 && Math.abs(c.balanceUSD || 0) === 0 && Math.abs(c.balanceIRT || 0) === 0) ? "حذف مشتری" : "برای حذف باید موجودی صفر باشد"}
                                            disabled={Math.abs(c.balanceAFN || 0) > 0 || Math.abs(c.balanceUSD || 0) > 0 || Math.abs(c.balanceIRT || 0) > 0}
                                        >
                                            <TrashIcon className="w-6 h-6" />
                                        </button>
                                        <button onClick={() => handleOpenPayModal(c)} className="bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-md hover:shadow-emerald-200 transition-all active:scale-95">ثبت دریافت</button>
                                     </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="md:hidden space-y-4">
                {customers.map(c => (
                     <div key={c.id} className="bg-white/80 backdrop-blur-xl p-5 rounded-2xl shadow-md border border-slate-100 active:scale-[0.98] transition-all">
                        <div className="flex justify-between items-start mb-1">
                           <div className="flex flex-col">
                                <h3 className="font-black text-xl text-slate-800">{c.name}</h3>
                                <p className="text-xs text-slate-400 font-medium">{c.phone || 'بدون شماره'}</p>
                           </div>
                           <div className="flex gap-2">
                               <button onClick={() => handleViewHistory(c)} className="p-2.5 bg-slate-100 rounded-xl text-slate-600 active:bg-blue-100"><EyeIcon className="w-5 h-5" /></button>
                               <button 
                                    onClick={() => handleDelete(c)} 
                                    className={`p-2.5 bg-slate-100 rounded-xl transition-colors ${(Math.abs(c.balanceAFN || 0) === 0 && Math.abs(c.balanceUSD || 0) === 0 && Math.abs(c.balanceIRT || 0) === 0) ? 'text-red-500' : 'text-slate-300'}`}
                                    disabled={Math.abs(c.balanceAFN || 0) > 0 || Math.abs(c.balanceUSD || 0) > 0 || Math.abs(c.balanceIRT || 0) > 0}
                                ><TrashIcon className="w-5 h-5" /></button>
                           </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-dashed border-slate-200 flex justify-between items-center">
                            <div className="text-right">
                                <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-tighter">طلب ما</p>
                                <div className="flex flex-col items-start font-black text-sm" dir="ltr">
                                    <p className="text-emerald-600 text-base">{Math.round(c.balanceAFN || 0).toLocaleString()} {storeSettings.currencyConfigs['AFN']?.name || 'افغانی'}</p>
                                    <p className="text-blue-600">{(c.balanceUSD || 0).toLocaleString()} {storeSettings.currencyConfigs['USD']?.symbol || '$'}</p>
                                    <p className="text-orange-600">{(c.balanceIRT || 0).toLocaleString()} {storeSettings.currencyConfigs['IRT']?.name || 'تومان'}</p>
                                </div>
                            </div>
                            <button onClick={() => handleOpenPayModal(c)} className="bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-sm font-black shadow-lg shadow-emerald-100 active:shadow-none transition-all">ثبت دریافت</button>
                        </div>
                    </div>
                ))}
            </div>

            {isAddModalOpen && (
                <Modal title="افزودن مشتری جدید" onClose={() => setIsAddModalOpen(false)}>
                    <form onSubmit={handleAddCustomerForm} className="space-y-4">
                        <input name="name" placeholder="نام مشتری" className="w-full p-4 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-50" required/>
                        <input name="phone" placeholder="شماره تلفن" className="w-full p-4 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-50" />
                        <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 space-y-4">
                            <p className="text-sm font-black text-blue-800">تراز اول دوره (اختیاری)</p>
                            <div className="flex gap-4">
                                {['AFN', 'USD', 'IRT'].map(cur => {
                                    const isBase = cur === baseCurrency;
                                    const label = storeSettings.currencyConfigs[cur as 'AFN'|'USD'|'IRT'].name;
                                    const color = cur === 'USD' ? 'text-green-600' : (cur === 'IRT' ? 'text-orange-600' : 'text-blue-600');
                                    
                                    return (
                                        <label key={cur} className="flex items-center gap-2 cursor-pointer group">
                                            <input 
                                                type="radio" 
                                                checked={addCustomerCurrency === cur} 
                                                onChange={() => {setAddCustomerCurrency(cur as any); setAddCustomerRate('');}} 
                                                className={color} 
                                            />
                                            <span className={`text-sm font-bold ${color}`}>{label}</span>
                                        </label>
                                    );
                                })}
                            </div>
                            {addCustomerCurrency !== baseCurrency && (
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-bold text-slate-400">نرخ تبدیل:</span>
                                    <input type="text" inputMode="decimal" value={addCustomerRate} onChange={e => setAddCustomerRate(toEnglishDigits(e.target.value).replace(/[^0-9.]/g, ''))} placeholder="نرخ" className="w-full p-2.5 border border-slate-200 rounded-xl font-mono text-center" />
                                </div>
                            )}
                            <div className="flex gap-2">
                                <input name="initialBalance" type="text" inputMode="decimal" value={addCustomerAmount} onChange={e => setAddCustomerAmount(toEnglishDigits(e.target.value).replace(/[^0-9.]/g, ''))} placeholder={`مبلغ (${addCustomerCurrency})`} className="w-2/3 p-2.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-50 font-bold" />
                                <select name="balanceType" className="w-1/3 p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-black">
                                    <option value="debtor">بدهکار است</option>
                                    <option value="creditor">بستانکار است</option>
                                </select>
                            </div>
                            {addCustomerCurrency !== baseCurrency && convertedInitialBalance > 0 && (
                                <p className="text-[10px] font-black text-blue-600 text-left">معادل تقریبی: {Math.round(convertedInitialBalance).toLocaleString()} {baseCurrencyName}</p>
                            )}
                        </div>
                        <button type="submit" className="w-full bg-blue-600 text-white p-4 rounded-xl shadow-xl shadow-blue-100 font-black text-lg">ذخیره مشتری</button>
                    </form>
                </Modal>
            )}

            {isPayModalOpen && selectedCustomer && (
                 <Modal 
                    title={`دریافت وجه از: ${selectedCustomer.name}`} 
                    onClose={() => setIsPayModalOpen(false)}
                    headerAction={
                        <div className="relative" ref={trusteeMenuRef}>
                            <button 
                                onClick={() => setIsTrusteeMenuOpen(!isTrusteeMenuOpen)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 transition-all ${selectedTrusteeId ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'}`}
                                title="انتخاب واسط (امانت‌گذار)"
                            >
                                <UserGroupIcon className="w-5 h-5" />
                                <span className="text-[10px] font-black hidden sm:inline">{selectedTrustee ? selectedTrustee.name : 'انتخاب واسط'}</span>
                                <ChevronDownIcon className={`w-4 h-4 transition-transform ${isTrusteeMenuOpen ? 'rotate-180' : ''}`} />
                            </button>
                            
                            {isTrusteeMenuOpen && (
                                <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-gray-200 p-2 z-[110] modal-animate overflow-hidden">
                                    <div className="text-[10px] font-black text-slate-400 p-2 border-b mb-1 uppercase tracking-widest">امانت‌گذاران (واسط)</div>
                                    <div className="max-h-60 overflow-y-auto no-scrollbar">
                                        <button 
                                            onClick={() => { setSelectedTrusteeId(''); setIsTrusteeMenuOpen(false); }}
                                            className={`w-full text-right p-3 rounded-xl flex justify-between items-center mb-1 transition-colors ${selectedTrusteeId === '' ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-600'}`}
                                        >
                                            <span className="text-xs font-bold">بدون واسط (نقدی مستقیم)</span>
                                            {selectedTrusteeId === '' && <CheckIcon className="w-4 h-4" />}
                                        </button>
                                        {depositHolders.map(holder => (
                                            <button 
                                                key={holder.id}
                                                onClick={() => { setSelectedTrusteeId(holder.id); setIsTrusteeMenuOpen(false); }}
                                                className={`w-full text-right p-3 rounded-xl flex justify-between items-center mb-1 transition-colors ${selectedTrusteeId === holder.id ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-600'}`}
                                            >
                                                <div>
                                                    <p className="text-xs font-black">{holder.name}</p>
                                                    <p className="text-[9px] opacity-60">تراز: {Math.round(holder.balanceAFN).toLocaleString()} AFN</p>
                                                </div>
                                                {selectedTrusteeId === holder.id && <CheckIcon className="w-4 h-4" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    }
                >
                    <form onSubmit={handleAddPaymentForm} className="space-y-4">
                        {selectedTrustee && (
                            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center gap-3 animate-fade-in">
                                <div className="p-2 bg-indigo-600 text-white rounded-lg"><CheckIcon className="w-4 h-4"/></div>
                                <div>
                                    <p className="text-[10px] font-black text-indigo-800">تحویل به واسط: <span className="text-sm">{selectedTrustee.name}</span></p>
                                    <p className="text-[9px] text-indigo-400 font-bold">مبلغ به حساب امانی این شخص منتقل می‌شود.</p>
                                </div>
                            </div>
                        )}
                        <div className="flex gap-4 p-3 bg-blue-50 rounded-xl">
                            {['AFN', 'USD', 'IRT'].map(c => {
                                const label = storeSettings.currencyConfigs[c as 'AFN'|'USD'|'IRT'].name;
                                const color = c === 'USD' ? 'text-green-600' : (c === 'IRT' ? 'text-orange-600' : 'text-blue-600');
                                return (
                                    <label key={c} className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" checked={paymentCurrency === c} onChange={() => {setPaymentCurrency(c as any); setExchangeRate('');}} className={color} />
                                        <span className={`text-xs font-bold ${color}`}>{label}</span>
                                    </label>
                                );
                            })}
                        </div>
                        {paymentCurrency !== baseCurrency && (
                             <div className="flex items-center gap-3">
                                <span className="text-xs whitespace-nowrap font-bold text-slate-400">نرخ تبدیل ({baseCurrencyName} به {paymentCurrency}):</span>
                                <input type="text" inputMode="decimal" value={exchangeRate} onChange={e => setExchangeRate(toEnglishDigits(e.target.value).replace(/[^0-9.]/g, ''))} placeholder="نرخ" className="w-full p-2.5 border border-slate-200 rounded-xl font-mono text-center" />
                            </div>
                        )}
                        <input name="amount" type="text" inputMode="decimal" value={paymentAmount} onChange={e => setPaymentAmount(toEnglishDigits(e.target.value).replace(/[^0-9.]/g, ''))} placeholder={`مبلغ دریافتی (${paymentCurrency})`} className="w-full p-4 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-emerald-50 font-black text-xl text-center" required />
                        {paymentCurrency !== baseCurrency && convertedPayment > 0 && (
                            <p className="text-[10px] font-black text-emerald-600 text-left">معادل دریافتی: {Math.round(convertedPayment).toLocaleString()} {baseCurrencyName}</p>
                        )}
                        <input name="description" placeholder="بابت... (اختیاری)" className="w-full p-4 border border-slate-200 rounded-xl" />
                        <button type="submit" className="w-full bg-emerald-600 text-white p-4 rounded-xl shadow-xl shadow-emerald-100 font-black text-lg active:scale-[0.98]">ثبت نهایی و چاپ رسید</button>
                    </form>
                </Modal>
            )}
            {historyModalData && (
                <TransactionHistoryModal person={historyModalData.person} transactions={historyModalData.transactions} type="customer" onClose={() => setHistoryModalData(null)} onReprint={handleReprint} />
            )}
            {receiptModalData && (
                <ReceiptPreviewModal person={receiptModalData.person} transaction={receiptModalData.transaction} type="customer" onClose={() => setReceiptModalData(null)} />
            )}
        </div>
    );
};

const ExpensesTab = () => {
    const { expenses, addExpense, updateExpense, deleteExpense, storeSettings, updateSettings } = useAppContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
    const [expenseCurrency, setExpenseCurrency] = useState<'AFN' | 'USD' | 'IRT'>(storeSettings.baseCurrency);
    const [expenseRate, setExpenseRate] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    const baseCurrency = storeSettings.baseCurrency;
    const baseCurrencyName = storeSettings.currencyConfigs[baseCurrency].name;
    const categories = storeSettings.expenseCategories || ['rent', 'utilities', 'supplies', 'salary', 'other'];

    const filteredExpenses = useMemo(() => {
        if (filterCategory === 'all') return expenses;
        return expenses.filter(e => e.category === filterCategory);
    }, [expenses, filterCategory]);

    const handleAddExpenseForm = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const amount = Number(toEnglishDigits(formData.get('amount') as string).replace(/[^0-9.]/g, ''));
        
        if (expenseCurrency !== baseCurrency && (!expenseRate || Number(expenseRate) <= 0)) {
            alert("لطفا نرخ ارز را وارد کنید.");
            return;
        }

        const expenseData = {
            date: new Date(formData.get('date') as string).toISOString(),
            description: formData.get('description') as string,
            amount: amount,
            currency: expenseCurrency,
            exchangeRate: expenseCurrency === baseCurrency ? 1 : Number(expenseRate),
            category: formData.get('category') as string,
        };

        if (editingExpense) {
            updateExpense({ ...editingExpense, ...expenseData });
        } else {
            addExpense(expenseData);
        }
        
        closeModal();
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingExpense(null);
        setExpenseRate('');
        setExpenseCurrency(storeSettings.baseCurrency);
    };

    const handleEditExpense = (expense: Expense) => {
        setEditingExpense(expense);
        setExpenseCurrency(expense.currency);
        setExpenseRate(expense.exchangeRate.toString());
        setIsModalOpen(true);
    };

    const handleManageCategories = (newCategories: string[]) => {
        updateSettings({ ...storeSettings, expenseCategories: newCategories });
    };

    const getCategoryLabel = (cat: string) => {
        const labels: { [key: string]: string } = {
            rent: 'کرایه',
            utilities: 'قبوض',
            supplies: 'ملزومات',
            salary: 'حقوق و دستمزد',
            other: 'سایر'
        };
        return labels[cat] || cat;
    };

    return (
        <div>
            <div className="flex flex-wrap gap-3 mb-8">
                <button onClick={() => setIsModalOpen(true)} className="flex items-center bg-blue-600 text-white px-5 py-3 rounded-xl shadow-lg btn-primary">
                    <PlusIcon className="w-5 h-5 ml-2" /> <span className="font-bold">ثبت هزینه جدید</span>
                </button>
                
                <div className="relative">
                    <button 
                        onClick={() => setIsFilterOpen(!isFilterOpen)} 
                        className={`flex items-center px-5 py-3 rounded-xl border transition-all ${filterCategory !== 'all' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-700'}`}
                    >
                        <FilterIcon className="w-5 h-5 ml-2" />
                        <span className="font-bold">{filterCategory === 'all' ? 'فیلتر دسته‌بندی' : getCategoryLabel(filterCategory)}</span>
                        <ChevronDownIcon className={`w-4 h-4 mr-2 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {isFilterOpen && (
                        <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 py-2 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                            <button 
                                onClick={() => { setFilterCategory('all'); setIsFilterOpen(false); }}
                                className={`w-full text-right px-4 py-3 text-sm font-bold hover:bg-slate-50 transition-colors ${filterCategory === 'all' ? 'text-blue-600 bg-blue-50/50' : 'text-slate-600'}`}
                            >
                                همه دسته‌ها
                            </button>
                            {categories.map(cat => (
                                <button 
                                    key={cat}
                                    onClick={() => { setFilterCategory(cat); setIsFilterOpen(false); }}
                                    className={`w-full text-right px-4 py-3 text-sm font-bold hover:bg-slate-50 transition-colors ${filterCategory === cat ? 'text-blue-600 bg-blue-50/50' : 'text-slate-600'}`}
                                >
                                    {getCategoryLabel(cat)}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <button onClick={() => setIsCategoryModalOpen(true)} className="flex items-center bg-slate-100 text-slate-600 px-5 py-3 rounded-xl hover:bg-slate-200 transition-colors">
                    <SettingsIcon className="w-5 h-5 ml-2" /> <span className="font-bold">مدیریت دسته‌ها</span>
                </button>
            </div>

             <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-lg hidden md:block bg-white/40">
                <table className="min-w-full text-center bg-white/60 responsive-table">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="p-4 font-bold text-slate-700">تاریخ</th>
                            <th className="p-4 font-bold text-slate-700 text-right">شرح هزینه</th>
                            <th className="p-4 font-bold text-slate-700">دسته‌بندی</th>
                            <th className="p-4 font-bold text-slate-700">مبلغ ارزی</th>
                            <th className="p-4 font-bold text-slate-700">معادل ({baseCurrencyName})</th>
                            <th className="p-4 font-bold text-slate-700 w-20">عملیات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredExpenses.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-12 text-slate-400 font-bold">هیچ هزینه‌ای یافت نشد.</td>
                            </tr>
                        ) : filteredExpenses.map(e => (
                            <tr key={e.id} className="border-t border-gray-200 transition-colors hover:bg-blue-50/30">
                                <td className="p-4 text-md text-slate-500 font-medium">{new Date(e.date).toLocaleDateString('fa-IR')}</td>
                                <td className="p-4 text-lg font-bold text-slate-800 text-right">{e.description}</td>
                                <td className="p-4">
                                    <span className="px-3 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-500">{getCategoryLabel(e.category)}</span>
                                </td>
                                <td className="p-4 text-lg font-black text-red-600" dir="ltr">
                                    {e.amount.toLocaleString()} {e.currency || baseCurrency}
                                </td>
                                <td className="p-4 text-lg font-black text-slate-800" dir="ltr">
                                    {formatCurrency(e.amountBase || e.amount, storeSettings)}
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center justify-center gap-2">
                                        <button onClick={() => handleEditExpense(e)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="ویرایش">
                                            <EditIcon className="w-5 h-5" />
                                        </button>
                                        <button onClick={() => { if(confirm('آیا از حذف این هزینه اطمینان دارید؟')) deleteExpense(e.id); }} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="حذف">
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="md:hidden space-y-4">
                {filteredExpenses.map(e => (
                    <div key={e.id} className="bg-white/80 p-5 rounded-2xl shadow-md border border-slate-100">
                        <div className="flex justify-between items-start mb-4">
                            <div className="text-right">
                                <h3 className="font-black text-lg text-slate-800 leading-tight">{e.description}</h3>
                                <div className="flex gap-2 items-center mt-1.5">
                                    <span className="text-[10px] font-black bg-slate-100 px-2 py-0.5 rounded-full text-slate-500 uppercase">{getCategoryLabel(e.category)}</span>
                                    <span className="text-[10px] text-slate-400 font-medium">{new Date(e.date).toLocaleDateString('fa-IR')}</span>
                                </div>
                            </div>
                            <div className="text-left">
                                <p className="font-black text-red-600 text-lg" dir="ltr">{e.amount.toLocaleString()} {e.currency || baseCurrency}</p>
                                <p className="text-[10px] text-slate-400 font-bold">{formatCurrency(e.amountBase || e.amount, storeSettings)}</p>
                            </div>
                        </div>
                        <div className="flex gap-2 border-t border-slate-50 pt-3">
                            <button onClick={() => handleEditExpense(e)} className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold text-sm">
                                <EditIcon className="w-4 h-4" /> ویرایش
                            </button>
                            <button onClick={() => { if(confirm('آیا از حذف این هزینه اطمینان دارید؟')) deleteExpense(e.id); }} className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-50 text-red-600 rounded-xl font-bold text-sm">
                                <TrashIcon className="w-4 h-4" /> حذف
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {isModalOpen && (
                <Modal title={editingExpense ? "ویرایش هزینه" : "ثبت هزینه جدید"} onClose={closeModal}>
                    <form onSubmit={handleAddExpenseForm} className="space-y-4">
                        <input name="date" type="date" className="w-full p-4 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-50" defaultValue={editingExpense ? new Date(editingExpense.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]} required />
                        <input name="description" placeholder="شرح هزینه (مثلاً خرید کاغذ)" className="w-full p-4 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-50" defaultValue={editingExpense?.description} required />
                        
                        <div className="flex gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                            {['AFN', 'USD', 'IRT'].map(c => {
                                const label = storeSettings.currencyConfigs[c as 'AFN'|'USD'|'IRT'].name;
                                const color = c === 'USD' ? 'text-green-600' : (c === 'IRT' ? 'text-orange-600' : 'text-blue-600');
                                return (
                                    <label key={c} className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" checked={expenseCurrency === c} onChange={() => {setExpenseCurrency(c as any); setExpenseRate('');}} className={color} />
                                        <span className={`text-xs font-bold ${color}`}>{label}</span>
                                    </label>
                                );
                            })}
                        </div>

                        {expenseCurrency !== baseCurrency && (
                             <div className="flex items-center gap-3">
                                <span className="text-xs whitespace-nowrap font-bold text-slate-400">نرخ تبدیل ({baseCurrencyName} به {expenseCurrency}):</span>
                                <input type="text" inputMode="decimal" value={expenseRate} onChange={e => setExpenseRate(toEnglishDigits(e.target.value).replace(/[^0-9.]/g, ''))} placeholder="نرخ" className="w-full p-2.5 border border-slate-200 rounded-xl font-mono text-center" required />
                            </div>
                        )}

                        <input name="amount" type="text" inputMode="decimal" onInput={(e:any) => e.target.value = toEnglishDigits(e.target.value).replace(/[^0-9.]/g, '')} placeholder={`مبلغ هزینه (${expenseCurrency})`} className="w-full p-4 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-50 font-bold text-center text-xl" defaultValue={editingExpense?.amount} required />
                        
                        <select name="category" className="w-full p-4 border border-slate-200 rounded-xl bg-white font-bold outline-none focus:ring-4 focus:ring-blue-50" defaultValue={editingExpense?.category}>
                            {categories.map(cat => (
                                <option key={cat} value={cat}>{getCategoryLabel(cat)}</option>
                            ))}
                        </select>
                        <button type="submit" className="w-full bg-blue-600 text-white p-4 rounded-xl shadow-xl shadow-blue-100 font-black text-lg active:scale-[0.98] transition-all">
                            {editingExpense ? "بروزرسانی هزینه" : "ثبت هزینه"}
                        </button>
                    </form>
                </Modal>
            )}

            {isCategoryModalOpen && (
                <CategoryManagerModal 
                    categories={categories} 
                    onClose={() => setIsCategoryModalOpen(false)} 
                    onSave={handleManageCategories} 
                />
            )}
        </div>
    );
};

const CategoryManagerModal: React.FC<{ categories: string[], onClose: () => void, onSave: (cats: string[]) => void }> = ({ categories, onClose, onSave }) => {
    const [localCats, setLocalCats] = useState<string[]>(categories);
    const [newCat, setNewCat] = useState('');

    const addCat = () => {
        if (newCat.trim() && !localCats.includes(newCat.trim())) {
            setLocalCats([...localCats, newCat.trim()]);
            setNewCat('');
        }
    };

    const removeCat = (cat: string) => {
        setLocalCats(localCats.filter(c => c !== cat));
    };

    const handleSave = () => {
        onSave(localCats);
        onClose();
    };

    return (
        <Modal title="مدیریت دسته‌بندی هزینه‌ها" onClose={onClose}>
            <div className="space-y-6">
                <div className="flex gap-2">
                    <input 
                        value={newCat} 
                        onChange={e => setNewCat(e.target.value)} 
                        placeholder="نام دسته‌بندی جدید" 
                        className="flex-grow p-4 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-50"
                        onKeyPress={e => e.key === 'Enter' && addCat()}
                    />
                    <button onClick={addCat} className="bg-blue-600 text-white px-6 rounded-xl font-bold">افزودن</button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {localCats.map(cat => (
                        <div key={cat} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="font-bold text-slate-700">{cat}</span>
                            <button onClick={() => removeCat(cat)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors">
                                <TrashIcon className="w-5 h-5" />
                            </button>
                        </div>
                    ))}
                </div>

                <button onClick={handleSave} className="w-full bg-blue-600 text-white p-4 rounded-xl shadow-xl shadow-blue-100 font-black text-lg">ذخیره تغییرات</button>
            </div>
        </Modal>
    );
};


const Accounting: React.FC = () => {
    const { hasPermission } = useAppContext();
    const [activeTab, setActiveTab] = useState('suppliers');

    const tabs = [
        { id: 'suppliers', label: 'تأمین‌کنندگان', icon: <AccountingIcon className="w-5 h-5"/>, permission: 'accounting:manage_suppliers' },
        { id: 'payroll', label: 'حقوق و دستمزد', icon: <UserGroupIcon className="w-5 h-5"/>, permission: 'accounting:manage_payroll' },
        { id: 'customers', label: 'مشتریان', icon: <UserGroupIcon className="w-5 h-5"/>, permission: 'accounting:manage_customers' },
        { id: 'expenses', label: 'مصارف', icon: <TrashIcon className="w-5 h-5"/>, permission: 'accounting:manage_expenses' },
    ];
    
    const accessibleTabs = tabs.filter(tab => hasPermission(tab.permission));
    
    if (!accessibleTabs.find(t => t.id === activeTab)) {
        if(accessibleTabs.length > 0) {
            setActiveTab(accessibleTabs[0].id);
        } else {
            return <div className="p-8"><p>شما به این بخش دسترسی ندارید.</p></div>;
        }
    }

    const renderContent = () => {
        switch (activeTab) {
            case 'suppliers': return <SuppliersTab />;
            case 'payroll': return <PayrollTab />;
            case 'customers': return <CustomersTab />;
            case 'expenses': return <ExpensesTab />;
            default: return null;
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <h1 className="text-3xl md:text-4xl font-black text-slate-800 mb-8">مرکز مالی و حسابداری</h1>

            <div className="bg-white rounded-3xl shadow-xl border border-gray-200/60 min-h-[60vh] flex flex-col">
                <div className="flex border-b border-gray-200/60 p-3 bg-slate-50/50 sticky top-0 z-20 overflow-x-auto no-scrollbar snap-x rounded-t-3xl">
                    <div className="flex gap-2 w-full min-w-max">
                        {accessibleTabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 py-3.5 px-6 font-black text-base md:text-lg rounded-2xl transition-all duration-300 snap-start ${
                                    activeTab === tab.id
                                        ? 'bg-blue-600 shadow-xl shadow-blue-200 text-white translate-y-[-2px]'
                                        : 'text-slate-500 hover:bg-white/80 hover:text-blue-600'
                                }`}
                            >
                                <span className={`${activeTab === tab.id ? 'text-white' : 'text-slate-400'}`}>{tab.icon}</span>
                                <span className="whitespace-nowrap">{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
                <div className="p-5 md:p-8 flex-grow">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};

export default Accounting;
