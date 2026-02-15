import React from 'react';
import { XIcon, WarningIcon, CheckIcon } from './icons';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'success' | 'warning';
    onConfirm: () => void;
    onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen, title, message, confirmText = 'تأیید', cancelText = 'لغو', type = 'warning', onConfirm, onCancel
}) => {
    if (!isOpen) return null;

    const getColorClass = () => {
        switch (type) {
            case 'danger': return 'bg-red-600 hover:bg-red-700 shadow-red-100';
            case 'success': return 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100';
            default: return 'bg-blue-600 hover:bg-blue-700 shadow-blue-100';
        }
    };

    const getIcon = () => {
        switch (type) {
            case 'danger': return <WarningIcon className="w-12 h-12 text-red-500" />;
            case 'success': return <CheckIcon className="w-12 h-12 text-emerald-500" />;
            default: return <WarningIcon className="w-12 h-12 text-blue-500" />;
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4 modal-animate">
            <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden">
                <div className="p-8 text-center">
                    <div className="flex justify-center mb-4">
                        <div className={`p-4 rounded-full ${type === 'danger' ? 'bg-red-50' : type === 'success' ? 'bg-emerald-50' : 'bg-blue-50'}`}>
                            {getIcon()}
                        </div>
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 mb-3">{title}</h3>
                    <p className="text-slate-500 font-medium leading-relaxed mb-8">{message}</p>
                    
                    <div className="flex gap-3">
                        <button 
                            onClick={onCancel} 
                            className="flex-1 py-3.5 rounded-xl bg-slate-100 text-slate-600 font-black hover:bg-slate-200 transition-all active:scale-95"
                        >
                            {cancelText}
                        </button>
                        <button 
                            onClick={onConfirm} 
                            className={`flex-1 py-3.5 rounded-xl text-white font-black shadow-lg transition-all active:scale-95 ${getColorClass()}`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;