
import React from 'react';
import { XIcon, CameraIcon, UploadIcon } from './icons';

interface ImageSourceModalProps {
    onClose: () => void;
    onCameraSelect: () => void;
    onUploadSelect: () => void;
}

const ImageSourceModal: React.FC<ImageSourceModalProps> = ({ onClose, onCameraSelect, onUploadSelect }) => {
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-animate">
            <div className="bg-white/80 backdrop-blur-xl p-8 rounded-2xl shadow-2xl border border-gray-200/80 w-full max-w-md relative">
                <button onClick={onClose} className="absolute top-4 right-4 p-1 rounded-full text-slate-500 hover:bg-slate-200/50 transition-colors"><XIcon /></button>
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-slate-800 mb-6">انتخاب منبع تصویر</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <button 
                            onClick={onCameraSelect}
                            className="flex flex-col items-center justify-center p-8 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl border-2 border-blue-200 hover:border-blue-400 transition-all duration-300 transform hover:scale-105"
                        >
                            <CameraIcon className="w-16 h-16 mb-3" />
                            <span className="text-lg font-semibold">گرفتن عکس با دوربین</span>
                        </button>
                        <button 
                            onClick={onUploadSelect}
                            className="flex flex-col items-center justify-center p-8 bg-green-50 hover:bg-green-100 text-green-700 rounded-xl border-2 border-green-200 hover:border-green-400 transition-all duration-300 transform hover:scale-105"
                        >
                            <UploadIcon className="w-16 h-16 mb-3" />
                            <span className="text-lg font-semibold">بارگذاری از گالری</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImageSourceModal;
