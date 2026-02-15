
import React from 'react';
import { XIcon, PrintIcon } from './icons';

interface ReportPrintPreviewModalProps {
    title: string;
    dateRange: { start: Date, end: Date };
    onClose: () => void;
    children: React.ReactNode;
}

const ReportPrintPreviewModal: React.FC<ReportPrintPreviewModalProps> = ({ title, dateRange, onClose, children }) => {

    const handlePrint = () => {
        window.print();
    };
    
    const formattedDateRange = `${new Date(dateRange.start).toLocaleDateString('fa-IR')} - ${new Date(dateRange.end).toLocaleDateString('fa-IR')}`;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
            <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="flex justify-between items-center mb-4 no-print">
                    <h2 className="text-lg font-bold text-slate-500">پیش‌نمایش چاپ گزارش</h2>
                    <button onClick={onClose} className="p-2 rounded-full bg-gray-100 hover:bg-red-100 hover:text-red-600 transition-colors"><XIcon className="w-5 h-5" /></button>
                </div>
                
                <div className="printable-area flex-grow flex flex-col min-h-0 overflow-y-auto bg-white p-2">
                    <div className="text-center mb-6 border-b pb-4">
                        <h1 className="text-2xl font-extrabold text-blue-800 mb-2">{title}</h1>
                        <p className="text-md text-slate-600 bg-slate-100 inline-block px-3 py-1 rounded-full">بازه زمانی: {formattedDateRange}</p>
                    </div>
                    <div className="flex-grow">
                        {children}
                    </div>
                </div>
                <div className="flex justify-end space-x-3 space-x-reverse mt-6 pt-4 border-t no-print">
                    <button onClick={onClose} className="px-6 py-3 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors font-semibold">بستن</button>
                    <button onClick={handlePrint} className="flex items-center gap-2 px-6 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-lg btn-primary font-semibold">
                        <PrintIcon />
                        چاپ گزارش
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReportPrintPreviewModal;
