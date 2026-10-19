import React from 'react';
import { X, Maximize2 } from 'lucide-react';

interface PopOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function PopOutModal({
  isOpen,
  onClose,
  title,
  children,
}: PopOutModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div 
        className="bg-white border border-[#003366] shadow-2xl rounded-sm w-[95vw] h-[92vh] flex flex-col font-sans text-xs select-none animate-in fade-in zoom-in-95 duration-100 overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Title Bar */}
        <div className="bg-[#003366] text-white px-4 py-2.5 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <Maximize2 size={15} className="text-[#A0C4FF]" />
            <span className="font-bold text-[13px] tracking-wide">{title} — Pop-Out View</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-[#002244] text-white/80 hover:text-white rounded transition-colors"
            title="Close Pop-Out (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-hidden min-h-0 bg-[#FAFAFA] flex flex-col">
          {children}
        </div>
      </div>
    </div>
  );
}
