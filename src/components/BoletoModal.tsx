import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, Printer, Share2, Receipt } from 'lucide-react';
import { Payment, Contract, Property, Client } from '../types';
import { formatCurrency, formatDate } from '../lib/utils';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface BoletoModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: Payment;
  contract?: Contract;
  property?: Property;
  tenant?: Client;
  owner?: Client;
}

export const BoletoModal: React.FC<BoletoModalProps> = ({
  isOpen,
  onClose,
  payment,
  contract,
  property,
  tenant,
  owner
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(40, 40, 40);
    doc.text('RECIBO DE ALUGUEL / FATURA', 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text(`Nº do Documento: ${payment.id.substring(0, 8).toUpperCase()}`, 105, 28, { align: 'center' });
    
    // Horizontal Line
    doc.setDrawColor(200, 200, 200);
    doc.line(10, 35, 200, 35);
    
    // Beneficiary (Owner)
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('BENEFICIÁRIO (LOCADOR)', 10, 45);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Nome: ${owner?.name || 'Não informado'}`, 10, 52);
    doc.text(`CPF/CNPJ: ${owner?.cpfCnpj || '-'}`, 10, 57);
    
    // Payer (Tenant)
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('PAGADOR (LOCATÁRIO)', 105, 45);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Nome: ${tenant?.name || 'Não informado'}`, 105, 52);
    doc.text(`CPF/CNPJ: ${tenant?.cpfCnpj || '-'}`, 105, 57);
    
    // Property Details
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('DADOS DO IMÓVEL', 10, 70);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Endereço: ${property?.address || '-'}`, 10, 77);
    
    // Payment Details Table
    (doc as any).autoTable({
      startY: 85,
      head: [['Descrição', 'Vencimento', 'Valor']],
      body: [
        [
          payment.type === 'aluguel' ? 'Aluguel Mensal' : (payment.description || 'Pagamento Extra'),
          formatDate(payment.dueDate),
          formatCurrency(payment.amount)
        ]
      ],
      theme: 'striped',
      headStyles: { fillColor: [30, 41, 59] }
    });
    
    const finalY = (doc as any).lastAutoTable.finalY || 100;
    
    // Total
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL A PAGAR: ${formatCurrency(payment.amount)}`, 200, finalY + 15, { align: 'right' });
    
    // Instructions
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Instruções:', 10, finalY + 25);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('1. Após o pagamento, anexe o comprovante no sistema.', 10, finalY + 32);
    doc.text('2. Pagamentos após o vencimento estão sujeitos a multa de 10% e juros.', 10, finalY + 37);
    
    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Gerado automaticamente pelo Sistema de Gestão Imobiliária', 105, 285, { align: 'center' });
    
    doc.save(`fatura_${payment.id.substring(0, 8)}.pdf`);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={onClose}
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            {/* Header Toolbar */}
            <div className="flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 rounded-xl">
                  <Receipt className="text-white" size={20} />
                </div>
                <h2 className="text-lg font-bold text-white">Fatura / Boleto</h2>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={generatePDF}
                  className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-xl transition-all"
                  title="Baixar PDF"
                >
                  <Download size={20} />
                </button>
                <button 
                  onClick={() => window.print()}
                  className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-xl transition-all"
                  title="Imprimir"
                >
                  <Printer size={20} />
                </button>
                <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-slate-400">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Content Area (Printable) */}
            <div ref={printRef} className="p-8 space-y-8 bg-white text-slate-900 overflow-y-auto max-h-[80vh]">
              {/* Logo & Header */}
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">RECIBO DE ALUGUEL</h1>
                  <p className="text-slate-500 font-medium">Nº {payment.id.substring(0, 8).toUpperCase()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">Vencimento</p>
                  <p className="text-xl font-black text-blue-600">{formatDate(payment.dueDate)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 py-6 border-y border-slate-100">
                <div>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Beneficiário (Locador)</h3>
                  <p className="font-bold text-slate-900">{owner?.name || 'Proprietário não informado'}</p>
                  <p className="text-sm text-slate-500">CPF/CNPJ: {owner?.cpfCnpj || '-'}</p>
                </div>
                <div>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Pagador (Locatário)</h3>
                  <p className="font-bold text-slate-900">{tenant?.name || 'Inquilino não informado'}</p>
                  <p className="text-sm text-slate-500">CPF/CNPJ: {tenant?.cpfCnpj || '-'}</p>
                </div>
              </div>

              <div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Imóvel</h3>
                <p className="font-medium text-slate-700">{property?.address}</p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-6">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-bold text-slate-500">Descrição</span>
                  <span className="text-sm font-bold text-slate-500">Valor</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-200">
                  <span className="text-slate-900 font-medium">
                    {payment.type === 'aluguel' ? 'Aluguel Mensal' : (payment.description || 'Pagamento Extra')}
                  </span>
                  <span className="text-slate-900 font-bold">{formatCurrency(payment.amount)}</span>
                </div>
                <div className="flex justify-between items-center pt-4">
                  <span className="text-lg font-black text-slate-900">Total a Pagar</span>
                  <span className="text-2xl font-black text-blue-600">{formatCurrency(payment.amount)}</span>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 text-center pt-4">
                Este documento é um recibo de cobrança gerado pelo sistema. 
                Após o pagamento, o comprovante deve ser anexado para baixa no sistema.
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
