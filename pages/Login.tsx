import React, { useState, useEffect } from 'react';
import { useAppContext } from '../AppContext';
import { KeyIcon, UserGroupIcon, WarningIcon, CheckIcon } from '../components/icons';

const Login: React.FC = () => {
    const { login, signup, isShopActive } = useAppContext();
    const [loginType, setLoginType] = useState<'admin' | 'staff'>('admin');
    const [isLoginMode, setIsLoginMode] = useState(true);
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [isPending, setIsPending] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // If shop becomes active while in staff tab, clear errors
    useEffect(() => {
        if (isShopActive && loginType === 'staff') setError('');
    }, [isShopActive, loginType]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;
        
        setError('');
        setMessage('');
        setIsSubmitting(true);
        
        try {
            if (isLoginMode) {
                // Admin pre-validation
                if (loginType === 'admin' && !identifier.includes('@')) {
                    setError('⚠️ برای ورود مدیر کل ایمیل لازم است. اگر کارمند هستید از تب کارکنان وارد شوید.');
                    setIsSubmitting(false);
                    return;
                }

                // Staff pre-validation
                if (loginType === 'staff' && !isShopActive) {
                    setError('❌ فروشگاه توسط مدیر قفل شده است. ابتدا مدیر باید وارد شود.');
                    setIsSubmitting(false);
                    return;
                }

                const result = await login(identifier, password, loginType);
                if (!result.success) {
                    if (result.pending) setIsPending(true);
                    else if (result.locked) setIsLocked(true);
                    setError(result.message);
                }
            } else {
                const result = await signup(identifier, password);
                if (result.success) {
                    setMessage(result.message);
                    setIdentifier('');
                    setPassword('');
                } else {
                    setError(result.message.includes('security purposes') ? 'درخواست‌های مکرر مسدود شد. لطفاً یک دقیقه صبر کنید.' : result.message);
                }
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isPending) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-50 p-4 text-center">
                <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-2xl shadow-2xl border border-gray-200">
                    <div className="text-amber-600 bg-amber-50 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                        <KeyIcon className="w-12 h-12" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800">در انتظار تایید مدیریت</h2>
                    <p className="text-slate-600 leading-relaxed font-medium">حساب شما با موفقیت ساخته شد. پس از تایید ایمیل، منتظر بمانید تا مدیر کل دسترسی شما را فعال کند.</p>
                    <button onClick={() => { setIsPending(false); setIsLoginMode(true); }} className="text-blue-600 font-bold hover:underline mt-4">بازگشت به صفحه ورود</button>
                </div>
            </div>
        );
    }

    if (isLocked) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-50 p-4 text-center">
                <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-2xl shadow-2xl border border-gray-200">
                    <div className="text-red-600 bg-red-50 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                        <WarningIcon className="w-12 h-12" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800">حساب در دستگاه دیگری فعال است</h2>
                    <p className="text-slate-600 leading-relaxed">شما نمی‌توانید به طور همزمان در دو دستگاه وارد شوید. لطفاً ابتدا در دستگاه دیگر دکمه «خروج کامل» را بزنید.</p>
                    <button onClick={() => setIsLocked(false)} className="text-blue-600 font-bold hover:underline mt-4">متوجه شدم</button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-100 p-4">
            <div className="w-full max-w-md bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white overflow-hidden modal-animate">
                {/* Header Section */}
                <div className="pt-10 pb-6 px-8 text-center bg-gradient-to-b from-blue-50/50 to-transparent">
                    <h1 className="text-4xl font-black text-blue-600 mb-1">پویا پارسا</h1>
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <div className={`w-2 h-2 rounded-full ${isShopActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${isShopActive ? 'text-green-600' : 'text-red-600'}`}>
                            وضعیت فروشگاه: {isShopActive ? 'فعال و آماده کار' : 'غیرفعال (نیاز به ورود مدیر)'}
                        </span>
                    </div>
                </div>

                {/* Login Tabs */}
                <div className="flex p-2 bg-slate-100 mx-8 rounded-2xl mb-8">
                    <button 
                        onClick={() => { setLoginType('admin'); setError(''); setIsLoginMode(true); }}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all duration-300 ${loginType === 'admin' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <KeyIcon className="w-5 h-5" />
                        مدیریت
                    </button>
                    <button 
                        onClick={() => { setLoginType('staff'); setError(''); setIsLoginMode(true); }}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all duration-300 ${loginType === 'staff' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <UserGroupIcon className="w-5 h-5" />
                        کارکنان
                    </button>
                </div>

                <div className="px-8 pb-10">
                    {/* Staff Lock Message */}
                    {loginType === 'staff' && !isShopActive ? (
                        <div className="py-10 text-center space-y-4">
                            <div className="bg-red-50 text-red-500 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto">
                                <WarningIcon className="w-8 h-8" />
                            </div>
                            <h3 className="font-bold text-slate-800">فروشگاه قفل است</h3>
                            <p className="text-sm text-slate-500 leading-relaxed px-4">
                                به دلیل مسائل امنیتی، برای شروع شیفت کاری ابتدا مدیر کل باید با حساب ایمیل خود وارد شود.
                            </p>
                            <button 
                                onClick={() => setLoginType('admin')}
                                className="text-blue-600 text-sm font-bold hover:underline"
                            >
                                بازگشت به ورود مدیریت
                            </button>
                        </div>
                    ) : (
                        <form className="space-y-5" onSubmit={handleSubmit}>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2 mr-1">
                                        {loginType === 'admin' ? 'ایمیل مدیر' : 'نام کاربری کارمند'}
                                    </label>
                                    <input
                                        type={loginType === 'admin' ? 'email' : 'text'}
                                        required
                                        value={identifier}
                                        onChange={(e) => setIdentifier(e.target.value)}
                                        className="w-full px-4 py-3.5 bg-slate-100 border-transparent rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none text-slate-800 font-medium"
                                        placeholder={loginType === 'admin' ? 'example@mail.com' : 'نام کاربری'}
                                        disabled={isSubmitting}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2 mr-1">رمز عبور</label>
                                    <input
                                        type="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full px-4 py-3.5 bg-slate-100 border-transparent rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none text-slate-800 font-medium"
                                        placeholder="••••••••"
                                        disabled={isSubmitting}
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="bg-red-50 border-r-4 border-red-500 p-4 rounded-xl">
                                    <p className="text-xs text-red-700 font-bold leading-relaxed">{error}</p>
                                </div>
                            )}
                            
                            {message && (
                                <div className="bg-green-50 border-r-4 border-green-500 p-4 rounded-xl">
                                    <p className="text-sm text-green-700 font-bold">{message}</p>
                                </div>
                            )}

                            <button 
                                type="submit" 
                                disabled={isSubmitting}
                                className={`w-full py-4 px-6 rounded-2xl text-white font-black text-lg shadow-xl shadow-blue-200 transition-all active:scale-95 flex items-center justify-center gap-3 ${isSubmitting ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}
                            >
                                {isSubmitting ? (
                                    <svg className="animate-spin h-6 w-6 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                ) : (
                                    isLoginMode ? (loginType === 'admin' ? 'ورود و بازگشایی' : 'ورود به سیستم') : 'ثبت‌نام مدیر جدید'
                                )}
                            </button>
                        </form>
                    )}

                    {loginType === 'admin' && (
                        <div className="mt-8 text-center">
                            <button 
                                onClick={() => { setIsLoginMode(!isLoginMode); setError(''); setMessage(''); }} 
                                className="text-blue-600 font-bold hover:underline"
                                disabled={isSubmitting}
                            >
                                {isLoginMode ? 'ثبت‌نام مدیر جدید (نیاز به تایید)' : 'بازگشت به فرم ورود'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Login;