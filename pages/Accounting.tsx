import React, { useState, useMemo } from 'react';
import { useAppContext } from '../AppContext';
import type { Supplier, Employee, Customer, Expense, AnyTransaction, CustomerTransaction, SupplierTransaction, PayrollTransaction } from '../types';
import { PlusIcon, XIcon, EyeIcon, TrashIcon, UserGroupIcon, AccountingIcon } from '../components/icons';
import Toast from '../components/Toast';
import { formatCurrency } from '../utils/formatters';
import TransactionHistoryModal from '../components/TransactionHistoryModal';
import ReceiptPreviewModal from '../components/ReceiptPreviewModal';

const Modal: React.FC<{ title: string, onClose: () => void, children: React.ReactNode }> = ({ title, onClose, children }) => (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-[100] p-4 pt-12 md:pt-20 overflow-y-auto modal-animate">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-lg overflow-hidden my-0">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50 sticky top-0 z-10">
                <h2 className="text-xl font-bold text-slate-800">{title}</h2>
                <button onClick={onClose} className="p-1 rounded-full text-slate-500 hover:bg-red-100 hover:text-red-600 transition-colors"><XIcon className="w-6 h-6" /></button>
            </div>
            <div className="p-6 bg-white">{children}</div>
        </div>
    </div>
);


const SuppliersTab = () => {
    const { suppliers, addSupplier, deleteSupplier, addSupplierPayment, supplierTransactions, storeSettings } = useAppContext();
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isPayModalOpen, setIsPayModalOpen] = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [toast, setToast] = useState('');
    const [historyModalData, setHistoryModalData] = useState<{ person: Supplier, transactions: SupplierTransaction[] } | null>(null);
    const [receiptModalData, setReceiptModalData] = useState<{ person: Supplier, transaction: SupplierTransaction } | null>(null);
    
    // Add Supplier State
    const [addSupplierCurrency, setAddSupplierCurrency] = useState<'AFN' | 'USD' | 'IRT'>('AFN');
    const [addSupplierRate, setAddSupplierRate] = useState('');
    const [addSupplierAmount, setAddSupplierAmount] = useState('');

    // Payment State
    const [paymentCurrency, setPaymentCurrency] = useState<'AFN' | 'USD' | 'IRT'>('AFN');
    const [exchangeRate, setExchangeRate] = useState('');
    const [paymentAmount, setPaymentAmount] = useState('');

    const showToast = (message: string) => { setToast(message); setTimeout(() => setToast(''), 3000); };

    const handleAddSupplierForm = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const initialAmount = Number(addSupplierAmount);
        const initialType = formData.get('balanceType') as 'creditor' | 'debtor';
        
        if (addSupplierCurrency !== 'AFN' && initialAmount > 0 && (!addSupplierRate || Number(addSupplierRate) <= 0)) {
            showToast("لطفا نرخ ارز را وارد کنید.");
            return;
        }

        addSupplier({
            name: formData.get('name') as string,
            contactPerson: formData.get('contactPerson') as string,
            phone: formData.get('phone') as string,
        }, initialAmount > 0 ? { 
            amount: initialAmount, 
            type: initialType, 
            currency: addSupplierCurrency,
            exchangeRate: addSupplierCurrency === 'AFN' ? 1 : Number(addSupplierRate) 
        } : undefined);
        
        setAddSupplierCurrency('AFN');
        setAddSupplierRate('');
        setAddSupplierAmount('');
        setIsAddModalOpen(false);
    };
    
    const handleDelete = (supplier: Supplier) => {
        if (Math.abs(supplier.balanceAFN) > 0 || Math.abs(supplier.balanceUSD) > 0 || Math.abs(supplier.balanceIRT) > 0) {
            showToast("حذف فقط برای حساب‌های با موجودی صفر امکان‌پذیر است.");
            return;
        }
        if (window.confirm(`آیا از حذف تأمین‌کننده "${supplier.name}" اطمینان دارید؟`)) {
            deleteSupplier(supplier.id);
        }
    };

    const handleOpenPayModal = (supplier: Supplier) => {
        setSelectedSupplier(supplier);
        setPaymentCurrency('AFN');
        setExchangeRate('');
        setPaymentAmount('');
        setIsPayModalOpen(true);
    };

    const handleAddPaymentForm = (e: React.FormEvent<HTMLDivElement> | React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!selectedSupplier) return;
        
        const formData = new FormData(e.currentTarget as HTMLFormElement);
        const amount = Number(paymentAmount);
        const description = formData.get('description') as string || 'پرداخت وجه';

        if (!amount || amount <= 0) {
            showToast("مبلغ باید بزرگتر از صفر باشد.");
            return;
        }
        
        if (paymentCurrency !== 'AFN' && (!exchangeRate || Number(exchangeRate) <= 0)) {
            showToast("لطفاً نرخ ارز را وارد کنید.");
            return;
        }

        const newTransaction = addSupplierPayment(
            selectedSupplier.id, 
            amount, 
            description, 
            paymentCurrency, 
            paymentCurrency === 'AFN' ? 1 : Number(exchangeRate)
        );
        
        if (newTransaction) {
            setIsPayModalOpen(false);
            setReceiptModalData({ person: selectedSupplier, transaction: newTransaction });
            setSelectedSupplier(null);
        }
    };
    
    const handleViewHistory = (supplier: Supplier) => {
        const transactions = supplierTransactions.filter(t => t.supplierId === supplier.id);
        setHistoryModalData({ person: supplier, transactions });
    };

    const handleReprint = (transactionId: string) => {
        const transaction = supplierTransactions.find(t => t.id === transactionId);
        const supplier = suppliers.find(s => s.id === transaction?.supplierId);
        if (transaction && supplier) {
            setHistoryModalData(null); 
            setReceiptModalData({ person: supplier, transaction });
        }
    };

    const convertedInitialBalance = useMemo(() => {
        if (!addSupplierAmount || !addSupplierRate || Number(addSupplierRate) <= 0) return 0;
        return addSupplierCurrency === 'IRT' 
            ? Number(addSupplierAmount) / Number(addSupplierRate)
            : Number(addSupplierAmount) * Number(addSupplierRate);
    }, [addSupplierAmount, addSupplierRate, addSupplierCurrency]);

    const convertedPayment = useMemo(() => {
        if (!paymentAmount || !exchangeRate || Number(exchangeRate) <= 0) return 0;
        return paymentCurrency === 'IRT'
            ? Number(paymentAmount) / Number(exchangeRate)
            : Number(paymentAmount) * Number(exchangeRate);
    }, [paymentAmount, exchangeRate, paymentCurrency]);


    return (
        <div>
            {toast && <Toast message={toast} onClose={() => setToast('')} />}
            <button onClick={() => setIsAddModalOpen(true)} className="flex items-center bg-blue-600 text-white px-5 py-3 rounded-xl shadow-lg mb-8 btn-primary">
                <PlusIcon className="w-5 h-5 ml-2" /> <span className="font-bold">افزودن تأمین‌کننده</span>
            </button>
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
                                        <span className="text-red-600">{Math.round(s.balanceAFN || 0).toLocaleString()} {storeSettings.currencyName}</span>
                                        <span className="text-blue-600 border-t border-slate-100 pt-0.5">{(s.balanceUSD || 0).toLocaleString()} $</span>
                                        <span className="text-orange-600 border-t border-slate-100 pt-0.5">{(s.balanceIRT || 0).toLocaleString()} تومان</span>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="flex justify-center items-center gap-2">
                                        <button onClick={() => handleViewHistory(s)} className="p-2.5 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-100 transition-all" title="مشاهده صورت حساب"><EyeIcon className="w-6 h-6"/></button>
                                        <button 
                                            onClick={() => handleDelete(s)} 
                                            className={`p-2.5 rounded-xl transition-all ${(Math.abs(s.balanceAFN || 0) === 0 && Math.abs(s.balanceUSD || 0) === 0 && Math.abs(s.balanceIRT || 0) === 0) ? 'text-red-500 hover:bg-red-50 cursor-pointer' : 'text-slate-300 cursor-not-allowed'}`} 
                                            title={(Math.abs(s.balanceAFN || 0) === 0 && Math.abs(s.balanceUSD || 0) === 0 && Math.abs(s.balanceIRT || 0) === 0) ? "حذف تأمین‌کننده" : "برای حذف باید موجودی تمام ارزها صفر باشد"}
                                            disabled={Math.abs(s.balanceAFN || 0) > 0 || Math.abs(s.balanceUSD || 0) > 0 || Math.abs(s.balanceIRT || 0) > 0}
                                        >
                                            <TrashIcon className="w-6 h-6" />
                                        </button>
                                        <button onClick={() => handleOpenPayModal(s)} className="bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-md hover:shadow-emerald-200 transition-all active:scale-95">ثبت پرداخت</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
             {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
                {suppliers.map(s => (
                    <div key={s.id} className="bg-white/80 backdrop-blur-xl p-5 rounded-2xl shadow-md border border-gray-200/60 relative overflow-hidden group active:scale-[0.98] transition-all">
                        <div className="flex justify-between items-start mb-1">
                           <div className="flex flex-col">
                                <h3 className="font-black text-xl text-slate-800">{s.name}</h3>
                                <p className="text-xs text-slate-400 font-medium">{s.phone || 'بدون شماره'}</p>
                           </div>
                           <div className="flex gap-2">
                               <button onClick={() => handleViewHistory(s)} className="p-2.5 bg-slate-100 rounded-xl text-slate-600 active:bg-blue-100 active:text-blue-600 transition-colors"><EyeIcon className="w-5 h-5" /></button>
                               <button 
                                    onClick={() => handleDelete(s)} 
                                    className={`p-2.5 bg-slate-100 rounded-xl transition-colors ${(Math.abs(s.balanceAFN || 0) === 0 && Math.abs(s.balanceUSD || 0) === 0 && Math.abs(s.balanceIRT || 0) === 0) ? 'text-red-500 active:bg-red-100' : 'text-slate-300'}`}
                                    disabled={Math.abs(s.balanceAFN || 0) > 0 || Math.abs(s.balanceUSD || 0) > 0 || Math.abs(s.balanceIRT || 0) > 0}
                                ><TrashIcon className="w-5 h-5" /></button>
                           </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-dashed border-slate-200 flex justify-between items-center">
                            <div className="text-right">
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">بدهی ما</p>
                                <div className="flex flex-col items-start font-black text-sm" dir="ltr">
                                    <p className="text-red-600 text-base">{Math.round(s.balanceAFN || 0).toLocaleString()} AFN</p>
                                    <p className="text-blue-600">{(s.balanceUSD || 0).toLocaleString()} $</p>
                                    <p className="text-orange-600">{(s.balanceIRT || 0).toLocaleString()} IRT</p>
                                </div>
                            </div>
                            <button onClick={() => handleOpenPayModal(s)} className="bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-sm font-black shadow-lg shadow-emerald-100 active:shadow-none active:translate-y-0.5 transition-all">ثبت پرداخت</button>
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
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input type="radio" checked={addSupplierCurrency === 'AFN'} onChange={() => {setAddSupplierCurrency('AFN'); setAddSupplierRate('');}} className="w-4 h-4 text-blue-600" />
                                    <span className="text-sm font-semibold text-slate-700 group-hover:text-blue-600">افغانی</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input type="radio" checked={addSupplierCurrency === 'USD'} onChange={() => setAddSupplierCurrency('USD')} className="w-4 h-4 text-green-600" />
                                    <span className="text-sm font-semibold text-slate-700 group-hover:text-green-600">دلار</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input type="radio" checked={addSupplierCurrency === 'IRT'} onChange={() => setAddSupplierCurrency('IRT')} className="w-4 h-4 text-orange-600" />
                                    <span className="text-sm font-semibold text-slate-700 group-hover:text-orange-600">تومان</span>
                                </label>
                            </div>

                            {addSupplierCurrency !== 'AFN' && (
                                <div className="flex items-center gap-3">
                                    <span className="text-xs whitespace-nowrap font-bold text-slate-500">نرخ {addSupplierCurrency === 'USD' ? 'دلار به افغانی' : 'افغانی به تومان'}:</span>
                                    <input 
                                        type="number" 
                                        step="any"
                                        value={addSupplierRate} 
                                        onChange={e => setAddSupplierRate(e.target.value)} 
                                        placeholder="نرخ" 
                                        className="w-full p-2.5 border border-slate-200 rounded-xl font-mono text-center focus:ring-4 focus:ring-blue-50 outline-none transition-all" 
                                    />
                                </div>
                            )}

                            <div className="flex gap-2">
                                <input name="initialBalance" type="number" value={addSupplierAmount} onChange={e => setAddSupplierAmount(e.target.value)} placeholder={`مبلغ (${addSupplierCurrency})`} className="w-2/3 p-2.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-50 outline-none transition-all" />
                                <select name="balanceType" className="w-1/3 p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-bold focus:ring-4 focus:ring-blue-50 outline-none transition-all">
                                    <option value="creditor">ما بدهکاریم</option>
                                    <option value="debtor">او بدهکار است</option>
                                </select>
                            </div>
                            
                            {addSupplierCurrency !== 'AFN' && convertedInitialBalance > 0 && (
                                <p className="text-[10px] font-black text-blue-600 text-left">معادل تقریبی: {Math.round(convertedInitialBalance).toLocaleString()} AFN</p>
                            )}
                        </div>

                        <button type="submit" className="w-full bg-blue-600 text-white p-4 rounded-xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all font-black text-lg active:scale-[0.98]">ذخیره نهایی</button>
                    </form>
                </Modal>
            )}
            {isPayModalOpen && selectedSupplier && (
                 <Modal title={`ثبت پرداخت: ${selectedSupplier.name}`} onClose={() => setIsPayModalOpen(false)}>
                    <form onSubmit={handleAddPaymentForm} className="space-y-4">
                        <div className="flex gap-4 p-3 bg-blue-50 rounded-xl">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" checked={paymentCurrency === 'AFN'} onChange={() => {setPaymentCurrency('AFN'); setExchangeRate('');}} className="text-blue-600" />
                                <span className="text-xs font-bold">افغانی</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" checked={paymentCurrency === 'USD'} onChange={() => setPaymentCurrency('USD')} className="text-green-600" />
                                <span className="text-xs font-bold">دلار</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" checked={paymentCurrency === 'IRT'} onChange={() => setPaymentCurrency('IRT')} className="text-orange-600" />
                                <span className="text-xs font-bold">تومان</span>
                            </label>
                        </div>
                        {paymentCurrency !== 'AFN' && (
                             <div className="flex items-center gap-3">
                                <span className="text-xs whitespace-nowrap font-bold text-slate-400">نرخ {paymentCurrency === 'USD' ? 'دلار به افغانی' : 'افغانی به تومان'}:</span>
                                <input 
                                    type="number" 
                                    step="any"
                                    value={exchangeRate} 
                                    onChange={e => setExchangeRate(e.target.value)} 
                                    placeholder="نرخ" 
                                    className="w-full p-2.5 border border-slate-200 rounded-xl font-mono text-center" 
                                />
                            </div>
                        )}
                        <input name="amount" type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder={`مبلغ پرداخت (${paymentCurrency})`} className="w-full p-4 border border-slate-200 rounded-xl focus:ring-4 focus:ring-emerald-50 outline-none font-bold" required />
                        
                        {paymentCurrency !== 'AFN' && convertedPayment > 0 && (
                            <p className="text-[10px] font-black text-emerald-600 text-left">معادل از حساب کل: {Math.round(convertedPayment).toLocaleString()} AFN</p>
                        )}
                        
                        <input name="description" placeholder="بابت... (مثلاً فاکتور فلان)" className="w-full p-4 border border-slate-200 rounded-xl focus:ring-4 focus:ring-emerald-50 outline-none" />
                        <button type="submit" className="w-full bg-emerald-600 text-white p-4 rounded-xl shadow-xl shadow-emerald-100 font-black text-lg active:scale-[0.98]">ثبت و چاپ رسید</button>
                    </form>
                </Modal>
            )}
            {historyModalData && (
                <TransactionHistoryModal 
                    person={historyModalData.person}
                    transactions={historyModalData.transactions}
                    type="supplier"
                    onClose={() => setHistoryModalData(null)}
                    onReprint={handleReprint}
                />
            )}
            {receiptModalData && (
                <ReceiptPreviewModal
                    person={receiptModalData.person}
                    transaction={receiptModalData.transaction}
                    type="supplier"
                    onClose={() => setReceiptModalData(null)}
                />
            )}
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
        addEmployee({
            name: formData.get('name') as string,
            position: formData.get('position') as string,
            monthlySalary: Number(formData.get('salary')),
        });
        setIsModalOpen(false);
    };
    
    const handleAddAdvanceForm = (ev: React.FormEvent<HTMLFormElement>, employeeId: string) => {
        ev.preventDefault();
        const formData = new FormData(ev.currentTarget);
        const amount = Number(formData.get('amount'));
        const description = formData.get('description') as string || 'مساعده';
        
        if (!amount || amount <= 0) return;
        addEmployeeAdvance(employeeId, amount, description);
        (ev.target as HTMLFormElement).reset();
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

            {/* Desktop Table */}
            <div className="hidden md:block overflow-hidden rounded-2xl border border-gray-200 shadow-lg bg-white/40">
                <table className="min-w-full text-center table-zebra">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="p-4 font-bold text-slate-700"></th>
                            <th className="p-4 font-bold text-slate-700">نام کارمند</th>
                            <th className="p-4 font-bold text-slate-700">حقوق ماهانه</th>
                            <th className="p-4 font-bold text-slate-700">پیش‌پرداخت‌ها</th>
                             <th className="p-4 font-bold text-slate-700">مانده حقوق</th>
                            <th className="p-4 font-bold text-slate-700">ثبت مساعده / پاداش</th>
                        </tr>
                    </thead>
                    <tbody>
                        {employees.map(e => (
                            <tr key={e.id} className="border-t border-gray-200 hover:bg-blue-50/30 transition-colors">
                                <td className="p-4">
                                    <button onClick={() => handleViewHistory(e)} className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-100 transition-all"><EyeIcon className="w-6 h-6"/></button>
                                </td>
                                <td className="p-4 text-lg font-bold text-slate-800">{e.name}</td>
                                <td className="p-4 text-md text-slate-600">{formatCurrency(e.monthlySalary, storeSettings)}</td>
                                <td className="p-4 text-md font-bold text-red-500">{formatCurrency(e.balance, storeSettings)}</td>
                                <td className="p-4 text-lg font-black text-emerald-600">{formatCurrency(e.monthlySalary - e.balance, storeSettings)}</td>
                                <td className="p-4">
                                    <form onSubmit={(ev) => handleAddAdvanceForm(ev, e.id)} className="flex justify-center items-center gap-2 w-full max-w-sm">
                                        <input type="number" name="amount" className="w-24 p-2 border border-slate-200 rounded-xl text-center font-bold focus:ring-2 focus:ring-amber-500 outline-none" placeholder="مبلغ" required />
                                        <input type="text" name="description" className="flex-grow p-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 outline-none" placeholder="توضیحات (اختیاری)" />
                                        <button type="submit" className="bg-amber-500 text-white px-4 py-2 rounded-xl text-xs font-black shadow-md hover:shadow-amber-100 transition-all active:scale-95">ثبت</button>
                                    </form>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View */}
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
                                    <input type="number" name="amount" className="w-1/3 p-2.5 border border-slate-200 rounded-xl text-center text-sm font-bold" placeholder="مبلغ" required />
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
                        <input name="salary" type="number" placeholder={`حقوق ماهانه (${storeSettings.currencyName})`} className="w-full p-4 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-50 font-bold" required />
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
    const { customers, addCustomer, deleteCustomer, addCustomerPayment, customerTransactions, storeSettings } = useAppContext();
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isPayModalOpen, setIsPayModalOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [toast, setToast] = useState('');
    const [historyModalData, setHistoryModalData] = useState<{ person: Customer, transactions: CustomerTransaction[] } | null>(null);
    const [receiptModalData, setReceiptModalData] = useState<{ person: Customer, transaction: CustomerTransaction } | null>(null);

    // Add Customer State
    const [addCustomerCurrency, setAddCustomerCurrency] = useState<'AFN' | 'USD' | 'IRT'>('AFN');
    const [addCustomerRate, setAddCustomerRate] = useState('');
    const [addCustomerAmount, setAddCustomerAmount] = useState('');

    // Payment State
    const [paymentCurrency, setPaymentCurrency] = useState<'AFN' | 'USD' | 'IRT'>('AFN');
    const [exchangeRate, setExchangeRate] = useState('');
    const [paymentAmount, setPaymentAmount] = useState('');

    const showToast = (message: string) => { setToast(message); setTimeout(() => setToast(''), 3000); };

    const handleAddCustomerForm = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const initialAmount = Number(addCustomerAmount);
        const initialType = formData.get('balanceType') as 'creditor' | 'debtor';

        if (addCustomerCurrency !== 'AFN' && initialAmount > 0 && (!addCustomerRate || Number(addCustomerRate) <= 0)) {
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
            exchangeRate: addCustomerCurrency === 'AFN' ? 1 : Number(addCustomerRate)
        } : undefined);
        
        setAddCustomerCurrency('AFN');
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
        setPaymentCurrency('AFN');
        setExchangeRate('');
        setPaymentAmount('');
        setIsPayModalOpen(true);
    };

    const handleAddPaymentForm = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!selectedCustomer) return;
        
        const amount = Number(paymentAmount);
        const formData = new FormData(e.currentTarget);
        const description = formData.get('description') as string || 'دریافت نقدی';
        
        if (!amount || amount <= 0) {
            showToast("مبلغ باید بزرگتر از صفر باشد.");
            return;
        }

        if (paymentCurrency !== 'AFN' && (!exchangeRate || Number(exchangeRate) <= 0)) {
            showToast("لطفاً نرخ ارز را وارد کنید.");
            return;
        }

        const newTransaction = addCustomerPayment(
            selectedCustomer.id, 
            amount, 
            description, 
            paymentCurrency, 
            paymentCurrency === 'AFN' ? 1 : Number(exchangeRate)
        );
        
        if (newTransaction) {
            setIsPayModalOpen(false);
            setReceiptModalData({ person: selectedCustomer, transaction: newTransaction });
            setSelectedCustomer(null);
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
        return addCustomerCurrency === 'IRT' 
            ? Number(addCustomerAmount) / Number(addCustomerRate)
            : Number(addCustomerAmount) * Number(addCustomerRate);
    }, [addCustomerAmount, addCustomerRate, addCustomerCurrency]);

    const convertedPayment = useMemo(() => {
        if (!paymentAmount || !exchangeRate || Number(exchangeRate) <= 0) return 0;
        return paymentCurrency === 'IRT'
            ? Number(paymentAmount) / Number(exchangeRate)
            : Number(paymentAmount) * Number(exchangeRate);
    }, [paymentAmount, exchangeRate, paymentCurrency]);


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
                                        <span className="text-emerald-600">{Math.round(c.balanceAFN || 0).toLocaleString()} {storeSettings.currencyName}</span>
                                        <span className="text-blue-600 border-t border-slate-100 pt-0.5">{(c.balanceUSD || 0).toLocaleString()} $</span>
                                        <span className="text-orange-600 border-t border-slate-100 pt-0.5">{(c.balanceIRT || 0).toLocaleString()} تومان</span>
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

             {/* Mobile Card View */}
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
                                    <p className="text-emerald-600 text-base">{Math.round(c.balanceAFN || 0).toLocaleString()} AFN</p>
                                    <p className="text-blue-600">{(c.balanceUSD || 0).toLocaleString()} $</p>
                                    <p className="text-orange-600">{(c.balanceIRT || 0).toLocaleString()} IRT</p>
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
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input type="radio" checked={addCustomerCurrency === 'AFN'} onChange={() => {setAddCustomerCurrency('AFN'); setAddCustomerRate('');}} className="text-blue-600" />
                                    <span className="text-sm font-bold text-slate-700">افغانی</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input type="radio" checked={addCustomerCurrency === 'USD'} onChange={() => setAddCustomerCurrency('USD')} className="text-green-600" />
                                    <span className="text-sm font-bold text-slate-700">دلار</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input type="radio" checked={addCustomerCurrency === 'IRT'} onChange={() => setAddCustomerCurrency('IRT')} className="text-orange-600" />
                                    <span className="text-sm font-bold text-slate-700">تومان</span>
                                </label>
                            </div>

                            {addCustomerCurrency !== 'AFN' && (
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-bold text-slate-400">نرخ {addCustomerCurrency === 'USD' ? 'دلار به افغانی' : 'افغانی به تومان'}:</span>
                                    <input 
                                        type="number" 
                                        step="any"
                                        value={addCustomerRate} 
                                        onChange={e => setAddCustomerRate(e.target.value)} 
                                        placeholder="نرخ" 
                                        className="w-full p-2.5 border border-slate-200 rounded-xl font-mono text-center" 
                                    />
                                </div>
                            )}

                            <div className="flex gap-2">
                                <input name="initialBalance" type="number" value={addCustomerAmount} onChange={e => setAddCustomerAmount(e.target.value)} placeholder={`مبلغ (${addCustomerCurrency})`} className="w-2/3 p-2.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-50 font-bold" />
                                <select name="balanceType" className="w-1/3 p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-black">
                                    <option value="debtor">بدهکار است</option>
                                    <option value="creditor">بستانکار است</option>
                                </select>
                            </div>

                            {addCustomerCurrency !== 'AFN' && convertedInitialBalance > 0 && (
                                <p className="text-[10px] font-black text-blue-600 text-left">معادل تقریبی: {Math.round(convertedInitialBalance).toLocaleString()} AFN</p>
                            )}
                        </div>

                        <button type="submit" className="w-full bg-blue-600 text-white p-4 rounded-xl shadow-xl shadow-blue-100 font-black text-lg">ذخیره مشتری</button>
                    </form>
                </Modal>
            )}
             {isPayModalOpen && selectedCustomer && (
                 <Modal title={`دریافت وجه از: ${selectedCustomer.name}`} onClose={() => setIsPayModalOpen(false)}>
                    <form onSubmit={handleAddPaymentForm} className="space-y-4">
                        <div className="flex gap-4 p-3 bg-blue-50 rounded-xl">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" checked={paymentCurrency === 'AFN'} onChange={() => {setPaymentCurrency('AFN'); setExchangeRate('');}} className="text-blue-600" />
                                <span className="text-xs font-bold">افغانی</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" checked={paymentCurrency === 'USD'} onChange={() => setPaymentCurrency('USD')} className="text-green-600" />
                                <span className="text-xs font-bold">دلار</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" checked={paymentCurrency === 'IRT'} onChange={() => setPaymentCurrency('IRT')} className="text-orange-600" />
                                <span className="text-xs font-bold">تومان</span>
                            </label>
                        </div>
                        {paymentCurrency !== 'AFN' && (
                             <div className="flex items-center gap-3">
                                <span className="text-xs whitespace-nowrap font-bold text-slate-400">نرخ {paymentCurrency === 'USD' ? 'دلار به افغانی' : 'افغانی به تومان'}:</span>
                                <input 
                                    type="number" 
                                    step="any"
                                    value={exchangeRate} 
                                    onChange={e => setExchangeRate(e.target.value)} 
                                    placeholder="نرخ" 
                                    className="w-full p-2.5 border border-slate-200 rounded-xl font-mono text-center" 
                                />
                            </div>
                        )}
                        <input name="amount" type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder={`مبلغ دریافتی (${paymentCurrency})`} className="w-full p-4 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-emerald-50 font-black text-xl text-center" required />
                        
                        {paymentCurrency !== 'AFN' && convertedPayment > 0 && (
                            <p className="text-[10px] font-black text-emerald-600 text-left">معادل دریافتی: {Math.round(convertedPayment).toLocaleString()} AFN</p>
                        )}
                        
                        <input name="description" placeholder="بابت... (اختیاری)" className="w-full p-4 border border-slate-200 rounded-xl" />
                        <button type="submit" className="w-full bg-emerald-600 text-white p-4 rounded-xl shadow-xl shadow-emerald-100 font-black text-lg active:scale-[0.98]">ثبت نهایی و چاپ رسید</button>
                    </form>
                </Modal>
            )}
            {historyModalData && (
                <TransactionHistoryModal 
                    person={historyModalData.person}
                    transactions={historyModalData.transactions}
                    type="customer"
                    onClose={() => setHistoryModalData(null)}
                    onReprint={handleReprint}
                />
            )}
            {receiptModalData && (
                <ReceiptPreviewModal
                    person={receiptModalData.person}
                    transaction={receiptModalData.transaction}
                    type="customer"
                    onClose={() => setReceiptModalData(null)}
                />
            )}
        </div>
    );
};

const ExpensesTab = () => {
    const { expenses, addExpense, storeSettings } = useAppContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    const handleAddExpenseForm = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        addExpense({
            date: new Date(formData.get('date') as string).toISOString(),
            description: formData.get('description') as string,
            amount: Number(formData.get('amount')),
            category: formData.get('category') as any,
        });
        setIsModalOpen(false);
    };

    return (
        <div>
            <button onClick={() => setIsModalOpen(true)} className="flex items-center bg-blue-600 text-white px-5 py-3 rounded-xl shadow-lg mb-8 btn-primary">
                <PlusIcon className="w-5 h-5 ml-2" /> <span className="font-bold">ثبت هزینه جدید</span>
            </button>
             <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-lg hidden md:block bg-white/40">
                <table className="min-w-full text-center bg-white/60 responsive-table">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="p-4 font-bold text-slate-700">تاریخ</th>
                            <th className="p-4 font-bold text-slate-700">شرح هزینه</th>
                            <th className="p-4 font-bold text-slate-700">دسته‌بندی</th>
                            <th className="p-4 font-bold text-slate-700">مبلغ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {expenses.map(e => (
                            <tr key={e.id} className="border-t border-gray-200 transition-colors hover:bg-blue-50/30">
                                <td className="p-4 text-md text-slate-500 font-medium">{new Date(e.date).toLocaleDateString('fa-IR')}</td>
                                <td className="p-4 text-lg font-bold text-slate-800">{e.description}</td>
                                <td className="p-4">
                                    <span className="px-3 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-500">{e.category}</span>
                                </td>
                                <td className="p-4 text-lg font-black text-red-600">{formatCurrency(e.amount, storeSettings)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
                {expenses.map(e => (
                    <div key={e.id} className="bg-white/80 p-5 rounded-2xl shadow-md border border-slate-100 flex justify-between items-center">
                        <div className="text-right">
                            <h3 className="font-black text-lg text-slate-800 leading-tight">{e.description}</h3>
                            <div className="flex gap-2 items-center mt-1.5">
                                <span className="text-[10px] font-black bg-slate-100 px-2 py-0.5 rounded-full text-slate-500 uppercase">{e.category}</span>
                                <span className="text-[10px] text-slate-400 font-medium">{new Date(e.date).toLocaleDateString('fa-IR')}</span>
                            </div>
                        </div>
                        <div className="text-left">
                            <p className="font-black text-red-600 text-lg" dir="ltr">{formatCurrency(e.amount, storeSettings)}</p>
                        </div>
                    </div>
                ))}
            </div>

            {isModalOpen && (
                <Modal title="ثبت هزینه جدید" onClose={() => setIsModalOpen(false)}>
                    <form onSubmit={handleAddExpenseForm} className="space-y-4">
                        <input name="date" type="date" className="w-full p-4 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-50" defaultValue={new Date().toISOString().split('T')[0]} required />
                        <input name="description" placeholder="شرح هزینه (مثلاً خرید کاغذ)" className="w-full p-4 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-50" required />
                        <input name="amount" type="number" placeholder={`مبلغ هزینه (${storeSettings.currencyName})`} className="w-full p-4 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-50 font-bold" required />
                        <select name="category" className="w-full p-4 border border-slate-200 rounded-xl bg-white font-bold outline-none focus:ring-4 focus:ring-blue-50">
                            <option value="utilities"> قبوض (برق، آب...)</option>
                            <option value="rent">کرایه</option>
                            <option value="supplies">ملزومات</option>
                            <option value="salary">حقوق و دستمزد</option>
                            <option value="other">سایر هزینه‌ها</option>
                        </select>
                        <button type="submit" className="w-full bg-blue-600 text-white p-4 rounded-xl shadow-xl shadow-blue-100 font-black text-lg active:scale-[0.98] transition-all">ثبت هزینه</button>
                    </form>
                </Modal>
            )}
        </div>
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
    
    // Set active tab to the first accessible one if current is not accessible
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