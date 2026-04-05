import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  type = 'danger'
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-800 p-6"
          >
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl ${
                type === 'danger' ? 'bg-red-900/20 text-red-500' : 
                type === 'warning' ? 'bg-orange-900/20 text-orange-500' : 
                'bg-blue-900/20 text-blue-500'
              }`}>
                <AlertTriangle size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-slate-100 mb-2">{title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{message}</p>
              </div>
              <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="mt-8 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 px-4 bg-slate-800 text-slate-300 font-semibold rounded-xl hover:bg-slate-700 transition-colors"
              >
                {cancelText}
              </button>
              <button
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={`flex-1 py-3 px-4 text-white font-semibold rounded-xl transition-colors ${
                  type === 'danger' ? 'bg-red-600 hover:bg-red-700' : 
                  type === 'warning' ? 'bg-orange-600 hover:bg-orange-700' : 
                  'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
