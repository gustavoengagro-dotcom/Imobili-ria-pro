import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Printer, Download, Share2, FileText, Camera, Home, User } from 'lucide-react';
import { Payment, Property, Client, Contract } from '../types';
import { formatCurrency, formatDate, cn } from '../lib/utils';

interface TenantStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  property: Property;
  payments: Payment[];
  contracts: Contract[];
  clients: Client[];
}

export const TenantStatementModal: React.FC<TenantStatementModalProps> = ({
  isOpen,
  onClose,
  property,
  payments,
  contracts,
  clients
}) => {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const activeContract = useMemo(() => {
    return contracts.find(c => c.propertyId === property.id && c.status === 'ativo');
  }, [contracts, property.id]);

  const tenant = useMemo(() => {
    if (!activeContract) return null;
    return clients.find(c => c.id === activeContract.tenantId);
  }, [clients, activeContract]);

  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      const pDate = new Date(p.dueDate);
      const [year, month] = selectedMonth.split('-');
      return pDate.getFullYear() === parseInt(year) && (pDate.getMonth() + 1) === parseInt(month);
    });
  }, [payments, selectedMonth]);

  const totalAmount = useMemo(() => {
    return filteredPayments.reduce((acc, p) => acc + p.amount, 0);
  }, [filteredPayments]);

  const handlePrint = () => {
    // Small delay to ensure any UI updates are settled and focus is correct
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const monthName = useMemo(() => {
    const [year, month] = selectedMonth.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date);
  }, [selectedMonth]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 print:p-0">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm print:hidden"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-4xl bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-800 flex flex-col max-h-[90vh] print:max-h-none print:w-full print:h-full print:rounded-none print:border-none print:bg-white print:text-black"
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between print:hidden">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-900/20 text-blue-400 rounded-lg">
                  <FileText size={20} />
                </div>
                <h2 className="text-xl font-bold text-slate-100">Extrato Mensal do Inquilino</h2>
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="month" 
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-slate-100 px-3 py-1.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button 
                  onClick={handlePrint}
                  className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-900/20 rounded-lg transition-colors"
                  title="Imprimir / Salvar PDF"
                >
                  <Printer size={20} />
                </button>
                <button 
                  onClick={() => {
                    const summary = `*Extrato Mensal - ${monthName}*\n\n*Imóvel:* ${property.address}\n*Inquilino:* ${tenant?.name || '-'}\n\n*Lançamentos:*\n${filteredPayments.map(p => `- ${p.type === 'aluguel' ? 'Aluguel' : p.description}: ${formatCurrency(p.amount)}`).join('\n')}\n\n*Total a Pagar:* ${formatCurrency(totalAmount)}`;
                    navigator.clipboard.writeText(summary);
                    alert('Resumo copiado para a área de transferência!');
                  }}
                  className="p-2 text-slate-400 hover:text-green-400 hover:bg-green-900/20 rounded-lg transition-colors"
                  title="Copiar Resumo para WhatsApp"
                >
                  <Share2 size={20} />
                </button>
                <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-200 transition-colors">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8 print:p-0 print:overflow-visible bg-slate-950 print:bg-white">
              <div id="printable-statement" className="max-w-3xl mx-auto bg-white text-slate-900 p-8 rounded-xl shadow-lg print:shadow-none print:p-0 print:rounded-none">
                {/* Document Header */}
                <div className="flex justify-between items-start mb-8 border-b-2 border-slate-100 pb-8">
                  <div>
                    <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-1">Demonstrativo de Custos</h1>
                    <p className="text-slate-500 font-medium uppercase tracking-widest text-xs">Referente a {monthName}</p>
                  </div>
                  <div className="text-right">
                    {/* Branding removed as per user request */}
                  </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-8 mb-8 bg-slate-50 p-6 rounded-xl border border-slate-100">
                  <div>
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                      <Home size={12} /> Imóvel
                    </h3>
                    <p className="text-sm font-bold text-slate-800 leading-tight">{property.address}</p>
                    <p className="text-xs text-slate-500 mt-1">{property.neighborhood}, {property.city}</p>
                  </div>
                  <div>
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                      <User size={12} /> Inquilino
                    </h3>
                    <p className="text-sm font-bold text-slate-800 leading-tight">{tenant?.name || 'Não identificado'}</p>
                    <p className="text-xs text-slate-500 mt-1">{tenant?.phone || '-'}</p>
                  </div>
                </div>

                {/* Items Table */}
                <div className="mb-8">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-slate-100">
                        <th className="py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Descrição</th>
                        <th className="py-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vencimento</th>
                        <th className="py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredPayments.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-8 text-center text-slate-400 text-sm italic">
                            Nenhum lançamento encontrado para este período.
                          </td>
                        </tr>
                      ) : (
                        filteredPayments.map((payment) => (
                          <React.Fragment key={payment.id}>
                            <tr>
                              <td className="py-4">
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold text-slate-800">
                                    {payment.type === 'aluguel' ? 'Aluguel Mensal' : (payment.description || 'Pagamento Extra')}
                                  </span>
                                  {payment.type === 'extra' && payment.description?.toLowerCase().includes('energia') && (
                                    <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-2">
                                      <span>Leitura: {payment.previousReading} a {payment.currentReading}</span>
                                      <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                      <span>Consumo: {(payment.currentReading || 0) - (payment.previousReading || 0)} kWh</span>
                                      <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                      <span>Valor kWh: {formatCurrency(payment.valuePerKwh || 0)}</span>
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="py-4 text-center text-sm text-slate-600">
                                {formatDate(payment.dueDate)}
                              </td>
                              <td className="py-4 text-right text-sm font-bold text-slate-900">
                                {formatCurrency(payment.amount)}
                              </td>
                            </tr>
                            {/* Photo for energy if exists */}
                            {payment.photoUrl && payment.description?.toLowerCase().includes('energia') && (
                              <tr className="print:break-inside-avoid">
                                <td colSpan={3} className="pb-6">
                                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1">
                                      <Camera size={12} /> Comprovante de Leitura / Conta de Energia
                                    </p>
                                    <img 
                                      src={payment.photoUrl} 
                                      alt="Comprovante Energia" 
                                      className="max-h-64 rounded-lg shadow-sm mx-auto"
                                      referrerPolicy="no-referrer"
                                    />
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-900">
                        <td colSpan={2} className="py-6 text-right text-sm font-bold text-slate-900 uppercase tracking-widest">Total a Pagar</td>
                        <td className="py-6 text-right text-xl font-black text-blue-600">{formatCurrency(totalAmount)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Footer Note */}
                <div className="mt-12 pt-8 border-t border-slate-100 text-center">
                  <p className="text-xs text-slate-400 leading-relaxed italic">
                    Este documento é um demonstrativo de custos para fins informativos.<br />
                    Por favor, realize o pagamento até a data de vencimento para evitar multas.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="p-6 border-t border-slate-800 bg-slate-900 flex justify-end gap-3 print:hidden">
              <button 
                onClick={onClose}
                className="px-6 py-2.5 bg-slate-800 text-slate-300 font-bold rounded-xl hover:bg-slate-700 transition-colors"
              >
                Fechar
              </button>
              <button 
                onClick={handlePrint}
                className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-lg shadow-blue-900/20"
              >
                <Printer size={18} />
                Imprimir / PDF
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
