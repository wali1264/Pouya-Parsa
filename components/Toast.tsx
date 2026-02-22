
import React, { useEffect } from 'react';
import { CheckIcon } from './icons';

interface ToastProps {
  message: string;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000); // Auto-dismiss after 3 seconds

    return () => {
      clearTimeout(timer);
    };
  }, [onClose]);

  return (
    <div className="fixed z-[110] animate-toast-in
        /* Desktop Styles: Centered, Blue, Larger (Original) */
        md:bottom-5 md:left-1/2 md:right-auto md:top-auto
        md:bg-blue-600 md:rounded-full md:py-3 md:px-6 
        md:flex-none md:w-auto md:shadow-2xl
        
        /* Mobile Styles: Bottom-Left corner, Green, Compact, With Icon */
        bottom-24 left-4 right-auto 
        bg-emerald-600 rounded-xl py-2 px-3 
        shadow-lg flex items-center gap-2 max-w-[85%]
    ">
       <style>{`
        /* Mobile Animation: Slide up from bottom corner */
        @keyframes toast-in-mobile {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        /* Desktop Animation: Slide up and keep centered X */
        @keyframes toast-in-desktop {
            from { transform: translate(-50%, 100%); opacity: 0; }
            to { transform: translate(-50%, 0); opacity: 1; }
        }
        
        .animate-toast-in { animation: toast-in-mobile 0.4s cubic-bezier(0.25, 1, 0.5, 1) forwards; }
        
        @media (min-width: 768px) {
            .animate-toast-in { animation: toast-in-desktop 0.4s cubic-bezier(0.25, 1, 0.5, 1) forwards; }
        }
       `}</style>
       
       {/* Mobile-only Check Icon */}
       <div className="md:hidden bg-white/20 p-1 rounded-full flex-shrink-0 text-white">
         <CheckIcon className="w-4 h-4" />
       </div>
       
      <p className="text-white text-sm md:text-base font-medium leading-tight">{message}</p>
    </div>
  );
};

export default Toast;
