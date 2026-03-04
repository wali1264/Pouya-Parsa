import React, { useState, useMemo } from 'react';
import { useAppContext } from '../AppContext';
import { PlusIcon, SearchIcon, EditIcon, TrashIcon, BellAlertIcon, CheckCircleIcon, HistoryIcon, XIcon, UserGroupIcon, ClipboardDocumentListIcon, WarningIcon } from '../components/icons';
import type { Order, OrderStatus, Customer } from '../types';
import { formatCurrency, toEnglishDigits } from '../utils/formatters';
import ConfirmModal from '../components/ConfirmModal';

const Orders: React.FC = () => {
    const { 
        orders, customers, storeSettings, hasPermission, 
        addOrder, updateOrderStatus, updateOrder, deleteOrder, addOrderPayment, showToast 
    } = useAppContext();

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
    const [visibleCount, setVisibleCount] = useState(20);
    const [showNotifications, setShowNotifications] = useState(false);
    const [isDebtStatsModalOpen, setIsDebtStatsModalOpen] = useState(false);
    const [debtStatsCustomerId, setDebtStatsCustomerId] = useState('');

    // Modal States
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    // Form States
    const [newOrder, setNewOrder] = useState({
        customerId: '',
        title: '',
        description: '',
        totalAmount: '',
        currency: storeSettings.baseCurrency
    });
    const [paymentAmount, setPaymentAmount] = useState('');

    // --- Derived Data ---
    const filteredOrders = useMemo(() => {
        let filtered = [...orders];
        if (statusFilter !== 'all') {
            filtered = filtered.filter(o => o.status === statusFilter);
        }
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            filtered = filtered.filter(o => {
                const customer = customers.find(c => c.id === o.customerId);
                return o.title.toLowerCase().includes(lowerTerm) || 
                       (customer && customer.name.toLowerCase().includes(lowerTerm));
            });
        }
        return filtered;
    }, [orders, statusFilter, searchTerm, customers]);

    const visibleOrders = filteredOrders.slice(0, visibleCount);

    const delayedOrders = useMemo(() => {
        const tenDaysAgo = new Date();
        tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
        return orders.filter(o => {
            const orderDate = new Date(o.createdAt);
            return (o.status === 'pending' || o.status === 'ready') && orderDate < tenDaysAgo;
        });
    }, [orders]);

    // --- Handlers ---
    const handleCreateOrder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newOrder.customerId || !newOrder.title || !newOrder.totalAmount) {
            showToast('لطفاً فیلدهای ضروری را پر کنید.');
            return;
        }

        const amount = parseFloat(toEnglishDigits(newOrder.totalAmount));
        if (isNaN(amount) || amount <= 0) {
            showToast('مبلغ نامعتبر است.');
            return;
        }

        if (isEditMode && selectedOrder) {
            const res = await updateOrder({
                ...selectedOrder,
                customerId: newOrder.customerId,
                title: newOrder.title,
                description: newOrder.description,
                totalAmount: amount,
                currency: newOrder.currency as any
            });
            if (res.success) {
                setIsCreateModalOpen(false);
                setIsEditMode(false);
                setSelectedOrder(null);
                setNewOrder({ customerId: '', title: '', description: '', totalAmount: '', currency: storeSettings.baseCurrency });
            } else {
                showToast(res.message);
            }
        } else {
            const res = await addOrder({
                customerId: newOrder.customerId,
                title: newOrder.title,
                description: newOrder.description,
                totalAmount: amount,
                currency: newOrder.currency as any,
                status: 'pending'
            });

            if (res.success) {
                setIsCreateModalOpen(false);
                setNewOrder({ customerId: '', title: '', description: '', totalAmount: '', currency: storeSettings.baseCurrency });
            } else {
                showToast(res.message);
            }
        }
    };

    const handleEditClick = (order: Order) => {
        setSelectedOrder(order);
        setNewOrder({
            customerId: order.customerId,
            title: order.title,
            description: order.description || '',
            totalAmount: order.totalAmount.toString(),
            currency: order.currency
        });
        setIsEditMode(true);
        setIsCreateModalOpen(true);
    };

    const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
        const res = await updateOrderStatus(orderId, newStatus);
        if (!res.success) showToast(res.message);
        else if (selectedOrder?.id === orderId) setSelectedOrder({ ...selectedOrder, status: newStatus });
    };

    const handleDelete = async () => {
        if (!deleteConfirmId) return;
        const res = await deleteOrder(deleteConfirmId);
        if (res.success) {
            setDeleteConfirmId(null);
            setIsDetailModalOpen(false);
        } else {
            showToast(res.message);
        }
    };

    const handleAddPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedOrder || !paymentAmount) return;

        const amount = parseFloat(toEnglishDigits(paymentAmount));
        if (isNaN(amount) || amount <= 0) {
            showToast('مبلغ نامعتبر است.');
            return;
        }

        const res = await addOrderPayment(selectedOrder.id, amount);
        if (res.success) {
            setIsPaymentModalOpen(false);
            setPaymentAmount('');
            // Update local selected order state to reflect new payment
            const updatedOrder = orders.find(o => o.id === selectedOrder.id);
            if (updatedOrder) setSelectedOrder(updatedOrder);
        } else {
            showToast(res.message);
        }
    };

    const getStatusColor = (status: OrderStatus) => {
        switch (status) {
            case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'ready': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'delivered': return 'bg-green-100 text-green-800 border-green-200';
            case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const getStatusLabel = (status: OrderStatus) => {
        switch (status) {
            case 'pending': return 'در انتظار';
            case 'ready': return 'آماده تحویل';
            case 'delivered': return 'تحویل داده شده';
            case 'cancelled': return 'لغو شده';
            default: return 'نامشخص';
        }
    };

    const selectedCustomer = customers.find(c => c.id === newOrder.customerId);

    // Calculate isolated balance for selected customer
    const customerIsolatedBalance = useMemo(() => {
        if (!newOrder.customerId) return null;
        const customerOrders = orders.filter(o => o.customerId === newOrder.customerId);
        const balances: Record<string, number> = {};
        Object.keys(storeSettings.currencyConfigs).forEach(curr => balances[curr] = 0);
        
        customerOrders.forEach(o => {
            const totalPaid = o.payments.reduce((sum, p) => sum + p.amount, 0);
            const debt = o.totalAmount - totalPaid;
            if (debt > 0) {
                balances[o.currency] = (balances[o.currency] || 0) + debt;
            }
        });
        return balances;
    }, [newOrder.customerId, orders, storeSettings.currencyConfigs]);

    const totalDebts = useMemo(() => {
        const balances: Record<string, number> = {};
        Object.keys(storeSettings.currencyConfigs).forEach(curr => balances[curr] = 0);

        const targetOrders = debtStatsCustomerId 
            ? orders.filter(o => o.customerId === debtStatsCustomerId)
            : orders;

        targetOrders.forEach(o => {
            const totalPaid = o.payments.reduce((sum, p) => sum + p.amount, 0);
            const debt = o.totalAmount - totalPaid;
            if (debt > 0) {
                balances[o.currency] = (balances[o.currency] || 0) + debt;
            }
        });
        return balances;
    }, [orders, debtStatsCustomerId, storeSettings.currencyConfigs]);

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <div>
                    <h1 className="text-2xl font-black text-slate-800">سفارشات مشتریان</h1>
                    <p className="text-sm text-slate-500 mt-1">مدیریت ایزوله سفارشات سفارشی و بیعانه‌ها</p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button 
                        onClick={() => setShowNotifications(!showNotifications)}
                        className="relative p-3 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
                        title="اعلان‌ها"
                    >
                        <BellAlertIcon />
                        {delayedOrders.length > 0 && (
                            <span className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                        )}
                    </button>
                    <button 
                        onClick={() => setIsDebtStatsModalOpen(true)}
                        className="p-3 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
                        title="آمار بدهی"
                    >
                        <UserGroupIcon className="w-6 h-6" />
                    </button>
                    {hasPermission('orders:create') && (
                        <button 
                            onClick={() => { setIsEditMode(false); setNewOrder({ customerId: '', title: '', description: '', totalAmount: '', currency: storeSettings.baseCurrency }); setIsCreateModalOpen(true); }}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
                        >
                            <PlusIcon />
                            <span>ثبت سفارش جدید</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Notifications Panel */}
            {showNotifications && delayedOrders.length > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-2xl p-4 animate-fade-in">
                    <h3 className="font-bold text-red-800 mb-3 flex items-center gap-2">
                        <WarningIcon className="w-5 h-5" />
                        سفارشات تاخیردار (بیش از ۱۰ روز)
                    </h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                        {delayedOrders.map(o => {
                            const customer = customers.find(c => c.id === o.customerId);
                            return (
                                <div key={o.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-red-100">
                                    <div>
                                        <p className="font-bold text-slate-800">{o.title}</p>
                                        <p className="text-xs text-slate-500">{customer?.name} - {customer?.phone || 'بدون شماره'}</p>
                                    </div>
                                    <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${getStatusColor(o.status)}`}>
                                        {getStatusLabel(o.status)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <SearchIcon className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input 
                        type="text" 
                        placeholder="جستجو در عنوان سفارش یا نام مشتری..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-4 pr-12 py-3.5 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-50 outline-none transition-all font-medium"
                    />
                </div>
                <select 
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value as any)}
                    className="p-3.5 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-50 outline-none font-bold text-slate-700 min-w-[150px]"
                >
                    <option value="all">همه وضعیت‌ها</option>
                    <option value="pending">در انتظار</option>
                    <option value="ready">آماده تحویل</option>
                    <option value="delivered">تحویل داده شده</option>
                    <option value="cancelled">لغو شده</option>
                </select>
            </div>

            {/* Orders Grid */}
            {visibleOrders.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border border-slate-100">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ClipboardDocumentListIcon className="w-10 h-10 text-slate-400" />
                    </div>
                    <p className="text-slate-500 font-medium">هیچ سفارشی یافت نشد.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {visibleOrders.map(order => {
                        const customer = customers.find(c => c.id === order.customerId);
                        const totalPaid = order.payments.reduce((sum, p) => sum + p.amount, 0);
                        const progress = Math.min(100, Math.round((totalPaid / order.totalAmount) * 100));

                        return (
                            <div 
                                key={order.id} 
                                className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group flex flex-col relative overflow-hidden"
                            >
                                {/* Main clickable area for details */}
                                <div className="flex-1" onClick={() => { setSelectedOrder(order); setIsDetailModalOpen(true); }}>
                                    <div className="flex justify-between items-start mb-3">
                                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${getStatusColor(order.status)}`}>
                                            {getStatusLabel(order.status)}
                                        </span>
                                        <span className="text-xs text-slate-400 font-medium">
                                            {new Date(order.createdAt).toLocaleDateString('fa-IR')}
                                        </span>
                                    </div>
                                    
                                    <h3 className="font-black text-lg text-slate-800 mb-1 line-clamp-1 group-hover:text-blue-600 transition-colors">{order.title}</h3>
                                    <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
                                        <UserGroupIcon className="w-4 h-4" />
                                        <span className="truncate">{customer?.name || 'مشتری نامشخص'}</span>
                                    </div>

                                    <div className="mt-auto pt-4 border-t border-slate-100 space-y-3">
                                        <div className="flex justify-between items-end">
                                            <span className="text-xs font-bold text-slate-400">مبلغ کل:</span>
                                            <div className="text-left">
                                                <span className="font-black text-lg text-slate-800">{formatCurrency(order.totalAmount, storeSettings)}</span>
                                                <span className="text-xs text-slate-500 mr-1">{order.currency}</span>
                                            </div>
                                        </div>
                                        
                                        {/* Payment Progress */}
                                        <div>
                                            <div className="flex justify-between text-[10px] font-bold mb-1">
                                                <span className="text-slate-500">پرداخت شده: {progress}%</span>
                                                <span className={progress === 100 ? 'text-green-600' : 'text-orange-500'}>
                                                    {progress === 100 ? 'تسويه' : 'بدهکار'}
                                                </span>
                                            </div>
                                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                                <div 
                                                    className={`h-full rounded-full transition-all duration-500 ${progress === 100 ? 'bg-green-500' : 'bg-orange-500'}`} 
                                                    style={{ width: `${progress}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Quick Actions Overlay or Bottom Bar */}
                                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                                    <div className="flex gap-2">
                                        {hasPermission('orders:add_payment') && progress < 100 && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); setIsPaymentModalOpen(true); }}
                                                className="p-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition-colors"
                                                title="ثبت پرداخت سریع"
                                            >
                                                <PlusIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                        {hasPermission('orders:edit') && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleEditClick(order); }}
                                                className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
                                                title="ویرایش سفارش"
                                            >
                                                <EditIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                    {hasPermission('orders:delete') && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(order.id); }}
                                            className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"
                                            title="حذف سفارش"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Pagination */}
            {filteredOrders.length > visibleCount && (
                <div className="flex justify-center pt-4">
                    <button 
                        onClick={() => setVisibleCount(prev => prev + 20)}
                        className="bg-white border border-slate-200 text-slate-700 font-bold py-3 px-8 rounded-xl hover:bg-slate-50 hover:shadow-md transition-all"
                    >
                        نمایش ۲۰ سفارش قدیمی‌تر
                    </button>
                </div>
            )}

            {/* Create/Edit Order Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden modal-animate flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h2 className="text-xl font-black text-slate-800">{isEditMode ? 'ویرایش سفارش' : 'ثبت سفارش جدید'}</h2>
                            <button onClick={() => { setIsCreateModalOpen(false); setIsEditMode(false); }} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                                <XIcon />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto custom-scrollbar">
                            <form id="createOrderForm" onSubmit={handleCreateOrder} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">انتخاب مشتری *</label>
                                    <select 
                                        value={newOrder.customerId}
                                        onChange={e => setNewOrder({...newOrder, customerId: e.target.value})}
                                        className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-blue-300 outline-none font-medium"
                                        required
                                    >
                                        <option value="">-- انتخاب کنید --</option>
                                        {customers.map(c => (
                                            <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Isolated Balance Display */}
                                {selectedCustomer && customerIsolatedBalance && (
                                    <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 animate-fade-in">
                                        <p className="text-xs font-bold text-orange-800 mb-2">بدهی قبلی این مشتری (فقط در بخش سفارشات):</p>
                                        <div className="flex flex-wrap gap-3">
                                            {Object.entries(customerIsolatedBalance).map(([curr, amount]) => (amount as number) > 0 && (
                                                <div key={curr} className="bg-white px-3 py-1.5 rounded-lg border border-orange-200 text-sm font-black text-orange-700">
                                                    {formatCurrency(amount as number, storeSettings)} <span className="text-xs font-medium">{curr}</span>
                                                </div>
                                            ))}
                                            {Object.values(customerIsolatedBalance).every(v => v === 0) && (
                                                <span className="text-sm font-bold text-green-600">تسویه کامل</span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">عنوان سفارش *</label>
                                    <input 
                                        type="text" 
                                        value={newOrder.title}
                                        onChange={e => setNewOrder({...newOrder, title: e.target.value})}
                                        className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-blue-300 outline-none font-medium"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">توضیحات و جزئیات</label>
                                    <textarea 
                                        value={newOrder.description}
                                        onChange={e => setNewOrder({...newOrder, description: e.target.value})}
                                        placeholder="جزئیات کامل سفارش را اینجا بنویسید..."
                                        className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-blue-300 outline-none font-medium resize-none h-24"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">مبلغ کل سفارش *</label>
                                        <input 
                                            type="text" 
                                            value={newOrder.totalAmount}
                                            onChange={e => setNewOrder({...newOrder, totalAmount: e.target.value})}
                                            placeholder="0"
                                            className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-blue-300 outline-none font-black text-left"
                                            dir="ltr"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">ارز</label>
                                        <select 
                                            value={newOrder.currency}
                                            onChange={e => setNewOrder({...newOrder, currency: e.target.value})}
                                            className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-blue-300 outline-none font-bold"
                                        >
                                            {Object.values(storeSettings.currencyConfigs).map(c => (
                                                <option key={c.code} value={c.code}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </form>
                        </div>
                        
                        <div className="p-6 border-t border-slate-100 bg-slate-50 mt-auto">
                            <button 
                                type="submit" 
                                form="createOrderForm"
                                className="w-full bg-blue-600 text-white py-4 rounded-xl font-black text-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
                            >
                                {isEditMode ? 'ذخیره تغییرات' : 'ثبت نهایی سفارش'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Order Detail Modal */}
            {isDetailModalOpen && selectedOrder && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden modal-animate flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <h2 className="text-2xl font-black text-slate-800">{selectedOrder.title}</h2>
                                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${getStatusColor(selectedOrder.status)}`}>
                                        {getStatusLabel(selectedOrder.status)}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-500 font-medium">
                                    ثبت شده در: {new Date(selectedOrder.createdAt).toLocaleString('fa-IR')}
                                </p>
                            </div>
                            <button onClick={() => setIsDetailModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                                <XIcon />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto custom-scrollbar space-y-8">
                            {/* Customer Info */}
                            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center gap-4">
                                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                                    <UserGroupIcon className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-400 mb-1">مشتری</p>
                                    <p className="font-black text-slate-800 text-lg">
                                        {customers.find(c => c.id === selectedOrder.customerId)?.name || 'نامشخص'}
                                    </p>
                                    <p className="text-sm text-slate-500 font-medium mt-0.5">
                                        {customers.find(c => c.id === selectedOrder.customerId)?.phone || 'بدون شماره تماس'}
                                    </p>
                                </div>
                            </div>

                            {/* Description */}
                            {selectedOrder.description && (
                                <div>
                                    <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                                        <ClipboardDocumentListIcon className="w-5 h-5 text-slate-400" />
                                        جزئیات سفارش
                                    </h3>
                                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                                        {selectedOrder.description}
                                    </div>
                                </div>
                            )}

                            {/* Financials & Payments */}
                            <div>
                                <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                                    <HistoryIcon className="w-5 h-5 text-slate-400" />
                                    وضعیت مالی و پرداخت‌ها
                                </h3>
                                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                                    <div className="grid grid-cols-2 divide-x divide-x-reverse border-b border-slate-100">
                                        <div className="p-4 text-center bg-slate-50">
                                            <p className="text-xs font-bold text-slate-500 mb-1">مبلغ کل سفارش</p>
                                            <p className="font-black text-xl text-slate-800">{formatCurrency(selectedOrder.totalAmount, storeSettings)} <span className="text-xs">{selectedOrder.currency}</span></p>
                                        </div>
                                        <div className="p-4 text-center bg-slate-50">
                                            <p className="text-xs font-bold text-slate-500 mb-1">باقی‌مانده (بدهی)</p>
                                            <p className="font-black text-xl text-orange-600">
                                                {formatCurrency(selectedOrder.totalAmount - selectedOrder.payments.reduce((sum, p) => sum + p.amount, 0), storeSettings)} <span className="text-xs">{selectedOrder.currency}</span>
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="p-4">
                                        <div className="flex justify-between items-center mb-4">
                                            <p className="font-bold text-slate-700 text-sm">تاریخچه پرداخت‌ها (بیعانه)</p>
                                            {hasPermission('orders:add_payment') && selectedOrder.totalAmount > selectedOrder.payments.reduce((sum, p) => sum + p.amount, 0) && (
                                                <button 
                                                    onClick={() => setIsPaymentModalOpen(true)}
                                                    className="text-xs font-bold bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                                                >
                                                    + ثبت پرداخت جدید
                                                </button>
                                            )}
                                        </div>
                                        
                                        {selectedOrder.payments.length === 0 ? (
                                            <p className="text-sm text-slate-400 text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">هیچ پرداختی ثبت نشده است.</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {selectedOrder.payments.map(p => (
                                                    <div key={p.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                        <span className="text-sm font-medium text-slate-500">{new Date(p.date).toLocaleString('fa-IR')}</span>
                                                        <span className="font-black text-green-600">{formatCurrency(p.amount, storeSettings)} <span className="text-xs">{selectedOrder.currency}</span></span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {/* Actions Footer */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-wrap gap-2">
                            {hasPermission('orders:edit') && (
                                <>
                                    {selectedOrder.status === 'pending' && (
                                        <button onClick={() => handleStatusChange(selectedOrder.id, 'ready')} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors">
                                            تغییر به: آماده تحویل
                                        </button>
                                    )}
                                    {selectedOrder.status === 'ready' && (
                                        <button onClick={() => handleStatusChange(selectedOrder.id, 'delivered')} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition-colors">
                                            تغییر به: تحویل داده شده
                                        </button>
                                    )}
                                    {selectedOrder.status !== 'cancelled' && (
                                        <button onClick={() => handleStatusChange(selectedOrder.id, 'cancelled')} className="px-4 bg-slate-200 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-300 transition-colors">
                                            لغو سفارش
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Add Payment Modal */}
            {isPaymentModalOpen && selectedOrder && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden modal-animate">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h2 className="text-lg font-black text-slate-800">ثبت پرداخت جدید</h2>
                            <button onClick={() => setIsPaymentModalOpen(false)} className="p-1.5 hover:bg-slate-200 rounded-full transition-colors">
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-5">
                            <form id="paymentForm" onSubmit={handleAddPayment}>
                                <label className="block text-sm font-bold text-slate-700 mb-2">مبلغ پرداختی ({selectedOrder.currency})</label>
                                <input 
                                    type="text" 
                                    value={paymentAmount}
                                    onChange={e => setPaymentAmount(e.target.value)}
                                    placeholder="0"
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-blue-300 outline-none font-black text-center text-2xl"
                                    dir="ltr"
                                    required
                                    autoFocus
                                />
                                <p className="text-xs text-slate-500 mt-2 text-center">
                                    حداکثر مبلغ مجاز: {formatCurrency(selectedOrder.totalAmount - selectedOrder.payments.reduce((sum, p) => sum + p.amount, 0), storeSettings)}
                                </p>
                            </form>
                        </div>
                        <div className="p-5 border-t border-slate-100 bg-slate-50">
                            <button 
                                type="submit" 
                                form="paymentForm"
                                className="w-full bg-green-600 text-white py-3.5 rounded-xl font-black hover:bg-green-700 transition-colors shadow-lg shadow-green-600/20"
                            >
                                ثبت پرداخت
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Debt Statistics Modal */}
            {isDebtStatsModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden modal-animate">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h2 className="text-xl font-black text-slate-800">آمار بدهی مشتریان</h2>
                            <button onClick={() => { setIsDebtStatsModalOpen(false); setDebtStatsCustomerId(''); }} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                                <XIcon />
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">جستجوی مشتری</label>
                                <select 
                                    value={debtStatsCustomerId}
                                    onChange={e => setDebtStatsCustomerId(e.target.value)}
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-50 outline-none font-bold text-slate-700"
                                >
                                    <option value="">-- نمایش بدهی کل تمام مشتریان --</option>
                                    {customers.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-3">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                    {debtStatsCustomerId ? 'مانده بدهی این مشتری:' : 'مجموع کل بدهی‌های بازار به شما:'}
                                </p>
                                <div className="grid grid-cols-1 gap-3">
                                    {Object.entries(totalDebts).map(([curr, amount]) => (
                                        <div key={curr} className="flex justify-between items-center p-5 bg-white border border-slate-100 rounded-2xl shadow-sm">
                                            <span className="font-bold text-slate-500">{storeSettings.currencyConfigs[curr]?.name || curr}</span>
                                            <div className="text-left">
                                                <span className={`font-black text-2xl ${(amount as number) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                    {formatCurrency(amount as number, storeSettings)}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                    {Object.values(totalDebts).every(v => (v as number) === 0) && (
                                        <div className="text-center py-8 bg-green-50 rounded-2xl border border-green-100">
                                            <CheckCircleIcon className="w-10 h-10 text-green-500 mx-auto mb-2" />
                                            <p className="font-bold text-green-700">هیچ بدهی ثبت نشده است.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        <div className="p-6 bg-slate-50 border-t border-slate-100">
                            <button 
                                onClick={() => { setIsDebtStatsModalOpen(false); setDebtStatsCustomerId(''); }}
                                className="w-full bg-slate-800 text-white py-4 rounded-xl font-bold hover:bg-slate-900 transition-colors"
                            >
                                بستن گزارش
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation */}
            <ConfirmModal 
                isOpen={!!deleteConfirmId}
                title="حذف سفارش"
                message="آیا از حذف این سفارش اطمینان دارید؟ این عمل غیرقابل بازگشت است و تمام سوابق پرداخت آن نیز حذف خواهد شد."
                onConfirm={handleDelete}
                onCancel={() => setDeleteConfirmId(null)}
            />
        </div>
    );
};

export default Orders;
