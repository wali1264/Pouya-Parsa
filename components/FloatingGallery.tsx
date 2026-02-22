
import React, { useState, useEffect, useRef } from 'react';
import type { SalesMemoImage } from '../types';
import { XIcon, TrashIcon, MinimizeIcon, ChevronDoubleLeftIcon, ChevronDoubleRightIcon } from './icons';

interface FloatingGalleryProps {
    images: SalesMemoImage[];
    onClose: () => void;
    onDelete: (id: number) => void;
}

const FloatingGallery: React.FC<FloatingGalleryProps> = ({ images, onClose, onDelete }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isMinimized, setIsMinimized] = useState(false);
    const [position, setPosition] = useState({ x: 20, y: 80 }); // Default desktop position
    const [isDragging, setIsDragging] = useState(false);
    const galleryRef = useRef<HTMLDivElement>(null);
    const dragStartPos = useRef({ x: 0, y: 0 });

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        // Only allow drag on desktop (md and up)
        if (window.innerWidth < 768) return;
        
        setIsDragging(true);
        dragStartPos.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y,
        };
        document.body.style.userSelect = 'none';
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging || !galleryRef.current) return;
        const newX = e.clientX - dragStartPos.current.x;
        const newY = e.clientY - dragStartPos.current.y;
        setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        document.body.style.userSelect = '';
    };

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);
    
    useEffect(() => {
        if (currentIndex >= images.length && images.length > 0) {
            setCurrentIndex(images.length - 1);
        } else if (images.length === 0) {
            onClose();
        }
    }, [images, currentIndex, onClose]);

    const nextImage = () => setCurrentIndex(prev => (prev + 1) % images.length);
    const prevImage = () => setCurrentIndex(prev => (prev - 1 + images.length) % images.length);

    const handleDelete = () => {
        if (images[currentIndex]) {
            if (window.confirm("آیا از حذف این یادداشت تصویری اطمینان دارید؟")) {
                 onDelete(images[currentIndex].id);
            }
        }
    };
    
    // Minimized View
    if (isMinimized) {
        return (
             <div 
                style={window.innerWidth >= 768 ? {
                    position: 'fixed',
                    left: `${position.x}px`,
                    top: `${position.y}px`,
                    cursor: 'move',
                } : {
                    position: 'fixed',
                    bottom: '140px', // Higher on mobile to avoid footer overlap
                    right: '20px'
                }}
                onMouseDown={handleMouseDown}
                className="bg-blue-600 text-white rounded-full md:rounded-xl shadow-2xl p-3 z-[100] flex items-center justify-center cursor-pointer animate-bounce md:animate-none"
                onClick={() => setIsMinimized(false)}
            >
                <span className="font-semibold hidden md:inline mr-2">گالری</span>
                <div className="relative">
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></div>
                    <MinimizeIcon className="w-6 h-6 transform rotate-180" />
                </div>
            </div>
        )
    }

    return (
        <>
            {/* Mobile Modal Overlay */}
            <div className="md:hidden fixed inset-0 bg-black/80 z-[90]" onClick={onClose}></div>

            <div
                ref={galleryRef}
                className={`
                    fixed flex flex-col bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/80 z-[100] overflow-hidden
                    md:w-80
                    w-[90%] left-[5%] top-[10%] h-fit max-h-[70vh]
                    md:h-auto md:inset-auto
                `}
                style={{
                    // Apply absolute positioning only on desktop
                    ...(window.innerWidth >= 768 ? { left: `${position.x}px`, top: `${position.y}px` } : {})
                }}
            >
                <div
                    className="bg-slate-100/80 p-3 flex justify-between items-center cursor-move border-b border-slate-200 touch-none"
                    onMouseDown={handleMouseDown}
                >
                    <h3 className="font-bold text-slate-700 text-sm md:text-base">گالری ({currentIndex + 1}/{images.length})</h3>
                    <div className="flex items-center space-x-1 space-x-reverse">
                        <button onClick={handleDelete} className="p-1.5 rounded-full text-red-500 hover:bg-red-100 transition-colors" title="حذف تصویر">
                            <TrashIcon className="w-5 h-5"/>
                        </button>
                        <div className="w-px h-4 bg-slate-300 mx-1"></div>
                        <button onClick={() => setIsMinimized(true)} className="p-1 rounded-full text-slate-600 hover:bg-slate-200"><MinimizeIcon className="w-5 h-5"/></button>
                        <button onClick={onClose} className="p-1 rounded-full text-slate-600 hover:bg-slate-200"><XIcon className="w-5 h-5"/></button>
                    </div>
                </div>

                <div className="flex-grow p-2 flex items-center justify-center bg-black/5 relative aspect-[3/4] md:aspect-square group">
                     {images.length > 0 && images[currentIndex] ? (
                        <img src={images[currentIndex].imageData} alt="Memo" className="max-w-full max-h-full object-contain rounded shadow-sm" />
                     ) : (
                        <p className="text-slate-500">تصویری وجود ندارد.</p>
                     )}
                     
                     {/* Navigation Arrows */}
                     <div className="absolute inset-y-0 left-0 w-1/4 flex items-center justify-start pl-2 cursor-pointer z-10" onClick={prevImage}>
                         <div className="bg-white/80 text-slate-800 p-2 rounded-full shadow-lg hover:bg-white transition-all transform active:scale-90">
                             <ChevronDoubleLeftIcon className="w-5 h-5" />
                        </div>
                     </div>
                     <div className="absolute inset-y-0 right-0 w-1/4 flex items-center justify-end pr-2 cursor-pointer z-10" onClick={nextImage}>
                         <div className="bg-white/80 text-slate-800 p-2 rounded-full shadow-lg hover:bg-white transition-all transform active:scale-90">
                            <ChevronDoubleRightIcon className="w-5 h-5" />
                        </div>
                     </div>
                     
                     {/* Mobile dots indicator (Overlay) */}
                     <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 md:hidden">
                        {images.slice(0, 5).map((_, idx) => (
                            <div key={idx} className={`w-1.5 h-1.5 rounded-full shadow-sm ${idx === (currentIndex % 5) ? 'bg-blue-600' : 'bg-white/80'}`}></div>
                        ))}
                     </div>
                </div>
            </div>
        </>
    );
};

export default FloatingGallery;
