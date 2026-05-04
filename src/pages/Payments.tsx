import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Payment, Contract, Property, Client, PaymentStatus, PaymentType } from '../types';
import { 
  Plus, 
  Search, 
  CreditCard, 
  Calendar, 
  DollarSign, 
  Trash2, 
  Edit2,
  CheckCircle2, 
  X, 
  Save,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Home,
  Receipt,
  Camera,
  ChevronDown,
  ChevronUp,
  FileText,
  Download,
  Zap,
  ExternalLink,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { formatCurrency, formatDate, parseDate, cn, toBase64 } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../components/AuthGuard';
import { ConfirmModal } from '../components/ConfirmModal';
import { TenantStatementModal } from '../components/TenantStatementModal';
import { BoletoModal } from '../components/BoletoModal';
import { asaasService } from '../services/asaasService';

export const Payments: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'todos'>('todos');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isClearPendingConfirmOpen, setIsClearPendingConfirmOpen] = useState(false);
  const [isClearPaidConfirmOpen, setIsClearPaidConfirmOpen] = useState(false);
  const [isDeleteAllPendingConfirmOpen, setIsDeleteAllPendingConfirmOpen] = useState(false);
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const [isBoletoModalOpen, setIsBoletoModalOpen] = useState(false);
  const [selectedPaymentForBoleto, setSelectedPaymentForBoleto] = useState<Payment | null>(null);
  const [selectedPropertyForStatement, setSelectedPropertyForStatement] = useState<Property | null>(null);
  const [syncingPaymentId, setSyncingPaymentId] = useState<string | null>(null);
  const [paymentToDelete, setPaymentToDelete] = useState<string | null>(null);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [expandedProperties, setExpandedProperties] = useState<Record<string, boolean>>({});
  const { isAdmin } = useAuth();

  const getSuggestedDueDate = (contract: Contract) => {
    const today = new Date();
    const startDate = parseDate(contract.startDate);
    const day = startDate.getDate();
    
    // Create a date for the current month/year with the same day
    // Handle cases where the day doesn't exist in the current month (e.g., 31st)
    const year = today.getFullYear();
    const month = today.getMonth();
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    const actualDay = Math.min(day, lastDayOfMonth);
    
    const suggested = new Date(year, month, actualDay);
    return suggested.toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState<Partial<Payment>>({
    contractId: '',
    propertyId: '',
    dueDate: '',
    paymentDate: '',
    amount: 0,
    status: 'pendente',
    type: 'aluguel',
    description: '',
    photoUrl: ''
  });

  useEffect(() => {
    if (formData.type === 'extra' && formData.description === 'Energia') {
      const prev = formData.previousReading || 0;
      const curr = formData.currentReading || 0;
      const val = formData.valuePerKwh || 0;
      const total = (curr - prev) * val;
      if (total > 0 && Math.abs(total - (formData.amount || 0)) > 0.01) {
        setFormData(prevData => ({ ...prevData, amount: Number(total.toFixed(2)) }));
      }
    }
  }, [formData.previousReading, formData.currentReading, formData.valuePerKwh, formData.type, formData.description]);

  // Auto-select contract if property is selected and has only one active contract
  useEffect(() => {
    if (formData.type === 'aluguel' && formData.propertyId && !formData.contractId && !editingPayment) {
      const propertyContracts = contracts.filter(c => c.propertyId === formData.propertyId && c.status === 'ativo');
      if (propertyContracts.length === 1) {
        const contract = propertyContracts[0];
        setFormData(prev => ({
          ...prev,
          contractId: contract.id,
          amount: contract.monthlyValue,
          dueDate: prev.dueDate || getSuggestedDueDate(contract)
        }));
      }
    }
  }, [formData.propertyId, formData.type, contracts, editingPayment]);

  useEffect(() => {
    const unsubPayments = onSnapshot(collection(db, 'payments'), (s) => {
      setPayments(s.docs.map(d => ({ id: d.id, ...d.data() } as Payment)));
      setLoading(false);
    }, (e) => {
      setLoading(false);
      handleFirestoreError(e, OperationType.LIST, 'payments');
    });

    const unsubContracts = onSnapshot(collection(db, 'contracts'), (s) => {
      setContracts(s.docs.map(d => ({ id: d.id, ...d.data() } as Contract)));
    }, (e) => {
      setLoading(false);
      handleFirestoreError(e, OperationType.LIST, 'contracts');
    });

    const unsubProperties = onSnapshot(collection(db, 'properties'), (s) => {
      setProperties(s.docs.map(d => ({ id: d.id, ...d.data() } as Property)));
    }, (e) => {
      setLoading(false);
      handleFirestoreError(e, OperationType.LIST, 'properties');
    });

    const unsubClients = onSnapshot(collection(db, 'clients'), (s) => {
      setClients(s.docs.map(d => ({ id: d.id, ...d.data() } as Client)));
    }, (e) => {
      setLoading(false);
      handleFirestoreError(e, OperationType.LIST, 'clients');
    });

    return () => {
      unsubPayments();
      unsubContracts();
      unsubProperties();
      unsubClients();
    };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setSaveError(null);

    try {
      const { id, ...data } = formData as any;
      
      // Clean up data before saving
      if (data.type === 'extra') {
        delete data.contractId;
      } else {
        delete data.description;
        delete data.previousReading;
        delete data.currentReading;
        delete data.valuePerKwh;
      }

      // Remove empty strings for optional fields
      if (!data.paymentDate) delete data.paymentDate;
      if (!data.photoUrl) delete data.photoUrl;
      if (!data.description && data.type === 'extra') delete data.description;

      if (editingPayment) {
        await updateDoc(doc(db, 'payments', editingPayment.id), data);
      } else {
        await addDoc(collection(db, 'payments'), data);
      }
      setIsModalOpen(false);
      setEditingPayment(null);
      resetForm();
    } catch (err: any) {
      console.error("Error saving payment:", err);
      setSaveError(err.message || "Erro ao salvar o lançamento. Verifique os campos.");
      // handleFirestoreError(err, editingPayment ? OperationType.UPDATE : OperationType.CREATE, 'payments');
    }
  };

  const resetForm = () => {
    setFormData({ 
      contractId: '', 
      propertyId: '',
      dueDate: '', 
      paymentDate: '', 
      amount: 0, 
      status: 'pendente',
      type: 'aluguel',
      description: 'Energia', // Default to Energia for extra types
      photoUrl: '',
      previousReading: 0,
      currentReading: 0,
      valuePerKwh: 0
    });
    setSaveError(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await toBase64(file);
        setFormData({ ...formData, photoUrl: base64 });
      } catch (err) {
        console.error("Error converting file to base64", err);
      }
    }
  };

  const handleMarkAsPaid = async (payment: Payment) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'payments', payment.id), { 
        status: 'pago', 
        paymentDate: new Date().toISOString().split('T')[0] 
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `payments/${payment.id}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    setPaymentToDelete(id);
    setIsConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!paymentToDelete) return;
    try {
      await deleteDoc(doc(db, 'payments', paymentToDelete));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `payments/${paymentToDelete}`);
    } finally {
      setPaymentToDelete(null);
    }
  };

  const handleClearAllPending = async () => {
    if (!isAdmin) return;
    try {
      const batch = writeBatch(db);
      const pendingPayments = payments.filter(p => p.status === 'pendente');
      
      pendingPayments.forEach(payment => {
        const paymentRef = doc(db, 'payments', payment.id);
        batch.update(paymentRef, { 
          status: 'pago',
          paymentDate: new Date().toISOString().split('T')[0]
        });
      });
      
      await batch.commit();
      setIsClearPendingConfirmOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'payments/batch');
    }
  };

  const handleDeleteAllPending = async () => {
    if (!isAdmin) return;
    try {
      const batch = writeBatch(db);
      const pendingPayments = payments.filter(p => p.status === 'pendente');
      
      pendingPayments.forEach(payment => {
        const paymentRef = doc(db, 'payments', payment.id);
        batch.delete(paymentRef);
      });
      
      await batch.commit();
      setIsDeleteAllPendingConfirmOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'payments/batch-delete');
    }
  };

  const handleClearAllPaid = async () => {
    if (!isAdmin) return;
    try {
      const batch = writeBatch(db);
      const paidPayments = payments.filter(p => p.status === 'pago');
      
      paidPayments.forEach(payment => {
        const paymentRef = doc(db, 'payments', payment.id);
        batch.delete(paymentRef);
      });
      
      await batch.commit();
      setIsClearPaidConfirmOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'payments/batch-clear-paid');
    }
  };

  const handleGenerateMonthlyPayments = async () => {
    if (!isAdmin) return;
    try {
      const batch = writeBatch(db);
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      
      let count = 0;
      
      contracts.filter(c => c.status === 'ativo').forEach(contract => {
        const alreadyExists = payments.some(p => 
          p.contractId === contract.id && 
          p.type === 'aluguel' &&
          parseDate(p.dueDate).getMonth() === currentMonth &&
          parseDate(p.dueDate).getFullYear() === currentYear
        );
        
        if (!alreadyExists) {
          const dueDate = getSuggestedDueDate(contract);
          const paymentRef = doc(collection(db, 'payments'));
          batch.set(paymentRef, {
            contractId: contract.id,
            propertyId: contract.propertyId,
            dueDate: dueDate,
            amount: contract.monthlyValue,
            status: 'pendente',
            type: 'aluguel',
            createdAt: new Date().toISOString()
          });
          count++;
        }
      });
      
      if (count > 0) {
        await batch.commit();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'payments/bulk');
    }
  };

  const handleGenerateAsaasPayment = async (payment: Payment) => {
    if (!isAdmin) return;
    
    const contract = contracts.find(c => c.id === payment.contractId);
    const tenantId = contract?.tenantId;
    const tenant = clients.find(c => c.id === tenantId);
    
    if (!tenant) {
      alert('Inquilino não encontrado para este contrato.');
      return;
    }
    
    if (!tenant.asaasCustomerId) {
      alert('O inquilino precisa estar vinculado ao Asaas primeiro. Vá na página de Clientes e clique em "Vincular Asaas".');
      return;
    }
    
    setSyncingPaymentId(payment.id);
    try {
      const asaasPayment = await asaasService.createPayment(payment, tenant.asaasCustomerId);
      if (asaasPayment && asaasPayment.id) {
        await updateDoc(doc(db, 'payments', payment.id), {
          asaasPaymentId: asaasPayment.id,
          asaasInvoiceUrl: asaasPayment.invoiceUrl,
          asaasBoletoUrl: asaasPayment.bankSlipUrl,
          asaasBarCode: asaasPayment.identificationField
        });
      }
    } catch (err: any) {
      console.error('Error creating Asaas payment:', err);
      alert('Erro ao gerar pagamento no Asaas: ' + (err.response?.data?.errors?.[0]?.description || err.message));
    } finally {
      setSyncingPaymentId(null);
    }
  };

  const toggleProperty = (propertyId: string) => {
    setExpandedProperties(prev => ({
      ...prev,
      [propertyId]: !prev[propertyId]
    }));
  };

  const filteredProperties = properties.filter(prop => 
    prop.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    prop.street?.toLowerCase().includes(searchTerm.toLowerCase())
  ).filter(prop => {
    if (statusFilter === 'todos') return true;
    return payments.some(p => p.propertyId === prop.id && p.status === statusFilter);
  });

  const pendingAmount = payments.filter(p => p.status === 'pendente').reduce((a, b) => a + b.amount, 0);

  const getPropertyPayments = (propertyId: string) => {
    return payments.filter(p => p.propertyId === propertyId && (statusFilter === 'todos' || p.status === statusFilter));
  };

  const orphanPayments = payments.filter(p => {
    const propertyExists = properties.some(prop => prop.id === p.propertyId);
    const matchesStatus = statusFilter === 'todos' || p.status === statusFilter;
    return !propertyExists && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Financeiro</h1>
          <p className="text-sm text-slate-400">Controle de pagamentos por imóvel</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {isAdmin && (
            <button 
              onClick={() => setIsClearPaidConfirmOpen(true)}
              className="flex items-center gap-2 bg-slate-800 text-red-400 border border-red-900/30 px-4 py-3 rounded-xl font-semibold hover:bg-slate-700 transition-colors"
              title="Limpar todos os registros de pagamentos já recebidos"
            >
              <Trash2 size={20} />
              Zerar Recebidos
            </button>
          )}
          {isAdmin && (
            <button 
              onClick={handleGenerateMonthlyPayments}
              className="flex items-center gap-2 bg-slate-800 text-blue-400 border border-blue-900/30 px-4 py-3 rounded-xl font-semibold hover:bg-slate-700 transition-colors"
              title="Gerar mensalidades de todos os contratos ativos para o mês atual"
            >
              <Zap size={20} />
              Gerar Mensalidades
            </button>
          )}
          {isAdmin && (
            <button 
              onClick={() => {
                setEditingPayment(null);
                resetForm();
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-900/20"
            >
              <Plus size={20} />
              Lançar Pagamento
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-400">Total Recebido</span>
            <div className="p-2 bg-green-900/20 text-green-400 rounded-lg">
              <ArrowUpRight size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-100">{formatCurrency(payments.filter(p => p.status === 'pago').reduce((a, b) => a + b.amount, 0))}</p>
        </div>
        <button 
          onClick={() => {
            setStatusFilter(statusFilter === 'pendente' ? 'todos' : 'pendente');
            if (statusFilter !== 'pendente') {
              // Expand all properties that have pending payments
              const pendingProps: Record<string, boolean> = {};
              payments.filter(p => p.status === 'pendente').forEach(p => {
                pendingProps[p.propertyId] = true;
              });
              setExpandedProperties(pendingProps);
            }
          }}
          className={cn(
            "bg-slate-900 p-6 rounded-2xl shadow-sm border transition-all text-left w-full",
            statusFilter === 'pendente' ? "border-orange-500 ring-1 ring-orange-500" : "border-slate-800 hover:border-slate-700"
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-400">Pendente</span>
            <div className="p-2 bg-orange-900/20 text-orange-400 rounded-lg">
              <Clock size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-100">{formatCurrency(pendingAmount)}</p>
          {statusFilter === 'pendente' && (
            <p className="text-xs text-orange-400 mt-2 font-medium">Filtrando apenas pendentes</p>
          )}
          {statusFilter === 'pendente' && isAdmin && pendingAmount > 0 && (
            <div className="flex flex-col gap-2 mt-3">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsClearPendingConfirmOpen(true);
                }}
                className="w-full py-2 bg-orange-600 text-white rounded-lg text-xs font-bold hover:bg-orange-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <CheckCircle2 size={14} />
                Marcar todos como Pago
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDeleteAllPendingConfirmOpen(true);
                }}
                className="w-full py-2 bg-red-600/20 text-red-400 rounded-lg text-xs font-bold hover:bg-red-600/30 transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 size={14} />
                Excluir todos os Pendentes
              </button>
            </div>
          )}
        </button>
        <div className="bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-400">Atrasado</span>
            <div className="p-2 bg-red-900/20 text-red-400 rounded-lg">
              <ArrowDownRight size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-100">{formatCurrency(payments.filter(p => p.status === 'atrasado').reduce((a, b) => a + b.amount, 0))}</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
        <input 
          type="text" 
          placeholder="Buscar por imóvel..." 
          className="w-full pl-12 pr-4 py-3 bg-slate-900 border border-slate-800 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="space-y-4">
        {filteredProperties.map((property) => {
          const propertyPayments = getPropertyPayments(property.id);
          const isExpanded = expandedProperties[property.id];
          const totalProperty = propertyPayments.filter(p => p.status === 'pago').reduce((a, b) => a + b.amount, 0);

          return (
            <div key={property.id} className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-sm">
              <div 
                onClick={() => toggleProperty(property.id)}
                className="p-6 flex items-center justify-between cursor-pointer hover:bg-slate-800/30 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-900/20 text-blue-400 rounded-xl">
                    <Home size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-100">{property.address}</h3>
                    <p className="text-sm text-slate-500">
                      {propertyPayments.length} lançamentos • Total pago: <span className="text-green-400 font-medium">{formatCurrency(totalProperty)}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {isAdmin && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPropertyForStatement(property);
                        setIsStatementModalOpen(true);
                      }}
                      className="hidden md:flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-green-400 hover:text-green-300 transition-colors"
                    >
                      <FileText size={14} />
                      Gerar Extrato
                    </button>
                  )}
                  {isAdmin && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingPayment(null);
                        resetForm();
                        setFormData(prev => ({ ...prev, propertyId: property.id }));
                        setIsModalOpen(true);
                      }}
                      className="hidden md:flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <Plus size={14} />
                      Novo Lançamento
                    </button>
                  )}
                  {isExpanded ? <ChevronUp className="text-slate-500" /> : <ChevronDown className="text-slate-500" />}
                </div>
              </div>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-slate-800"
                  >
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-slate-800/50">
                          <tr>
                            <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tipo / Descrição</th>
                            <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vencimento</th>
                            <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Valor</th>
                            <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                            <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {propertyPayments.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-6 py-8 text-center text-slate-500 text-sm italic">
                                Nenhum lançamento financeiro para este imóvel.
                              </td>
                            </tr>
                          ) : (
                            propertyPayments.sort((a, b) => parseDate(b.dueDate).getTime() - parseDate(a.dueDate).getTime()).map((payment) => (
                              <tr key={payment.id} className="hover:bg-slate-800/20 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className={cn(
                                      "p-2 rounded-lg",
                                      payment.type === 'aluguel' ? "bg-blue-900/20 text-blue-400" : "bg-purple-900/20 text-purple-400"
                                    )}>
                                      {payment.type === 'aluguel' ? <FileText size={16} /> : <Receipt size={16} />}
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-sm font-bold text-slate-100">
                                        {payment.type === 'aluguel' ? 'Aluguel Mensal' : (payment.description || 'Pagamento Extra')}
                                      </span>
                                      {payment.photoUrl && (
                                        <a 
                                          href={payment.photoUrl} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="text-[10px] text-blue-400 hover:underline flex items-center gap-1 mt-1"
                                        >
                                          <Camera size={10} />
                                          Ver Comprovante
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className="text-sm text-slate-400">{formatDate(payment.dueDate)}</span>
                                </td>
                                <td className="px-6 py-4">
                                  <span className="text-sm font-bold text-slate-100">{formatCurrency(payment.amount)}</span>
                                </td>
                                <td className="px-6 py-4">
                                  <span className={cn(
                                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                    payment.status === 'pago' ? "bg-green-900/30 text-green-400" : 
                                    payment.status === 'pendente' ? "bg-orange-900/30 text-orange-400" : "bg-red-900/30 text-red-400"
                                  )}>
                                    {payment.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    {payment.status !== 'pago' && (
                                      <button 
                                        onClick={() => {
                                          setSelectedPaymentForBoleto(payment);
                                          setIsBoletoModalOpen(true);
                                        }}
                                        className="p-1.5 text-blue-400 hover:bg-blue-900/20 rounded-lg transition-colors"
                                        title="Gerar Recibo / PIX"
                                      >
                                        <Download size={16} />
                                      </button>
                                    )}
                                    {payment.status !== 'pago' && isAdmin && !payment.asaasPaymentId && (
                                      <button 
                                        onClick={() => handleGenerateAsaasPayment(payment)}
                                        disabled={syncingPaymentId === payment.id}
                                        className="p-1.5 text-purple-400 hover:bg-purple-900/20 rounded-lg transition-colors"
                                        title="Gerar Cobrança no Asaas"
                                      >
                                        <RefreshCw size={16} className={cn(syncingPaymentId === payment.id && "animate-spin")} />
                                      </button>
                                    )}
                                    {payment.asaasInvoiceUrl && (
                                      <a 
                                        href={payment.asaasInvoiceUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="p-1.5 text-green-400 hover:bg-green-900/20 rounded-lg transition-colors"
                                        title="Ver Fatura Asaas"
                                      >
                                        <ExternalLink size={16} />
                                      </a>
                                    )}
                                    {payment.status !== 'pago' && isAdmin && (
                                      <button 
                                        onClick={() => handleMarkAsPaid(payment)}
                                        className="p-1.5 text-green-400 hover:bg-green-900/20 rounded-lg transition-colors"
                                        title="Marcar como Pago"
                                      >
                                        <CheckCircle2 size={16} />
                                      </button>
                                    )}
                                    {isAdmin && (
                                      <>
                                        <button 
                                          onClick={() => {
                                            setEditingPayment(payment);
                                            setFormData(payment);
                                            setIsModalOpen(true);
                                          }}
                                          className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-blue-900/20 rounded-lg transition-colors"
                                        >
                                          <Edit2 size={16} />
                                        </button>
                                        <button 
                                          onClick={() => handleDelete(payment.id)}
                                          className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
        
        {orphanPayments.length > 0 && (
          <div className="bg-red-900/10 rounded-2xl border border-red-900/30 overflow-hidden shadow-sm mt-8">
            <div className="p-6 flex items-center justify-between bg-red-900/20">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-500/20 text-red-400 rounded-xl">
                  <AlertCircle size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-red-400">Lançamentos sem Imóvel Vinculado</h3>
                  <p className="text-sm text-red-300/60">
                    Estes lançamentos não estão vinculados a nenhum imóvel cadastrado e podem estar causando divergências nos totais.
                  </p>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-red-900/10">
                  <tr>
                    <th className="px-6 py-3 text-[10px] font-bold text-red-400/80 uppercase tracking-widest">Descrição / ID</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-red-400/80 uppercase tracking-widest">Vencimento</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-red-400/80 uppercase tracking-widest">Valor</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-red-400/80 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-red-400/80 uppercase tracking-widest text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-900/20">
                  {orphanPayments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-red-900/10 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-red-200">
                            {payment.type === 'aluguel' ? 'Aluguel' : (payment.description || 'Pagamento Extra')}
                          </span>
                          <span className="text-[10px] text-red-400/60 font-mono">ID: {payment.id}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-red-300/80">{formatDate(payment.dueDate)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-red-200">{formatCurrency(payment.amount)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-900/40 text-red-400">
                          {payment.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isAdmin && (
                          <div className="flex items-center justify-end gap-1">
                            <button 
                              onClick={() => {
                                setEditingPayment(payment);
                                setFormData(payment);
                                setIsModalOpen(true);
                              }}
                              className="p-1.5 text-red-400/60 hover:text-red-400 hover:bg-red-900/30 rounded-lg transition-colors"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={() => handleDelete(payment.id)}
                              className="p-1.5 text-red-400/60 hover:text-red-400 hover:bg-red-900/30 rounded-lg transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-xl bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-800"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-800">
                <h2 className="text-xl font-bold text-slate-100">{editingPayment ? 'Editar Lançamento' : 'Novo Lançamento'}</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400">
                  <X size={20} />
                </button>
              </div>

              {saveError && (
                <div className="p-4 bg-red-900/20 border border-red-900/50 text-red-400 text-sm rounded-xl flex items-center gap-2">
                  <X size={16} className="shrink-0" />
                  <p>{saveError}</p>
                </div>
              )}

              <form id="payment-form" onSubmit={handleSave} className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-slate-400">Tipo de Lançamento</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, type: 'aluguel' })}
                        className={cn(
                          "flex-1 py-2 px-3 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all",
                          formData.type === 'aluguel' 
                            ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20" 
                            : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700"
                        )}
                      >
                        Aluguel
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, type: 'extra', contractId: '' })}
                        className={cn(
                          "flex-1 py-2 px-3 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all",
                          formData.type === 'extra' 
                            ? "bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/20" 
                            : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700"
                        )}
                      >
                        Extra
                      </button>
                    </div>
                  </div>
                  
                  {formData.type === 'aluguel' ? (
                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-slate-400">Contrato</label>
                      <select 
                        className="w-full p-3 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                        value={formData.contractId}
                        onChange={(e) => {
                          const contract = contracts.find(c => c.id === e.target.value);
                          if (contract) {
                            setFormData({ 
                              ...formData, 
                              contractId: e.target.value, 
                              amount: contract.monthlyValue,
                              propertyId: contract.propertyId,
                              dueDate: formData.dueDate || getSuggestedDueDate(contract)
                            });
                          } else {
                            setFormData({ ...formData, contractId: '' });
                          }
                        }}
                        required={formData.type === 'aluguel'}
                      >
                        <option value="">Selecione um contrato</option>
                        {contracts
                          .filter(c => {
                            if (editingPayment && c.id === editingPayment.contractId) return true;
                            if (formData.propertyId && c.propertyId !== formData.propertyId) return false;
                            return c.status === 'ativo';
                          })
                          .map(c => {
                            const tenant = clients.find(cl => cl.id === c.tenantId);
                            const property = properties.find(p => p.id === c.propertyId);
                            return (
                              <option key={c.id} value={c.id}>
                                {tenant?.name} - {property?.address} ({formatCurrency(c.monthlyValue)})
                              </option>
                            );
                          })}
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-slate-400">Imóvel</label>
                      <select 
                        className="w-full p-3 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                        value={formData.propertyId}
                        onChange={(e) => setFormData({ ...formData, propertyId: e.target.value })}
                        required
                      >
                        <option value="">Selecione um imóvel</option>
                        {properties.map(p => (
                          <option key={p.id} value={p.id}>{p.address}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {formData.type === 'aluguel' && formData.contractId && (
                  <div className="p-4 bg-blue-900/20 border border-blue-800 rounded-xl flex items-start gap-3">
                    <div className="p-2 bg-blue-900/40 text-blue-400 rounded-lg shrink-0">
                      <Home size={16} />
                    </div>
                    <div>
                      <p className="text-xs text-blue-400 font-bold uppercase tracking-wider mb-0.5">Imóvel Vinculado</p>
                      <p className="text-sm text-slate-100 font-medium">
                        {properties.find(p => p.id === formData.propertyId)?.address}
                      </p>
                      <div className="flex gap-4 mt-2">
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase font-bold">Inquilino</p>
                          <p className="text-xs text-slate-300">
                            {clients.find(cl => cl.id === contracts.find(c => c.id === formData.contractId)?.tenantId)?.name}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase font-bold">Valor Mensal</p>
                          <p className="text-xs text-slate-300">
                            {formatCurrency(contracts.find(c => c.id === formData.contractId)?.monthlyValue || 0)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {formData.type === 'extra' && (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-slate-400">Descrição do Gasto</label>
                      <div className="flex gap-2">
                        <select 
                          className="flex-1 p-3 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                          value={['Energia', 'Água', 'IPTU', 'Condomínio'].includes(formData.description || '') ? formData.description : 'Outro'}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData({ ...formData, description: val === 'Outro' ? '' : val });
                          }}
                        >
                          <option value="Energia">Energia</option>
                          <option value="Água">Água</option>
                          <option value="IPTU">IPTU</option>
                          <option value="Condomínio">Condomínio</option>
                          <option value="Outro">Outro...</option>
                        </select>
                        {!['Energia', 'Água', 'IPTU', 'Condomínio'].includes(formData.description || '') && (
                          <input 
                            type="text" 
                            placeholder="Descreva o gasto..."
                            className="flex-[2] p-3 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            required={formData.type === 'extra'}
                          />
                        )}
                      </div>
                    </div>

                    {formData.description === 'Energia' && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-800/50 rounded-2xl border border-slate-700">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">Leitura Anterior</label>
                          <input 
                            type="number" 
                            className="w-full p-2 bg-slate-900 border border-slate-700 text-slate-100 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
                            value={formData.previousReading || ''}
                            onChange={(e) => setFormData({ ...formData, previousReading: Number(e.target.value) })}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">Leitura Atual</label>
                          <input 
                            type="number" 
                            className="w-full p-2 bg-slate-900 border border-slate-700 text-slate-100 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
                            value={formData.currentReading || ''}
                            onChange={(e) => setFormData({ ...formData, currentReading: Number(e.target.value) })}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">Valor por kW/h</label>
                          <input 
                            type="number" 
                            step="0.01"
                            className="w-full p-2 bg-slate-900 border border-slate-700 text-slate-100 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
                            value={formData.valuePerKwh || ''}
                            onChange={(e) => setFormData({ ...formData, valuePerKwh: Number(e.target.value) })}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-slate-400">Data de Vencimento</label>
                    <input 
                      type="date" 
                      className="w-full p-3 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-slate-400">Valor (R$)</label>
                    <input 
                      type="number" 
                      className="w-full p-3 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-slate-400">Status</label>
                    <select 
                      className="w-full p-3 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as PaymentStatus })}
                      required
                    >
                      <option value="pendente">Pendente</option>
                      <option value="pago">Pago</option>
                      <option value="atrasado">Atrasado</option>
                    </select>
                  </div>
                  {formData.status === 'pago' && (
                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-slate-400">Data do Pagamento</label>
                      <input 
                        type="date" 
                        className="w-full p-3 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                        value={formData.paymentDate}
                        onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                        required
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-400">Comprovante / Foto</label>
                  <div className="flex items-center gap-4">
                    <label className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-700 rounded-2xl p-6 hover:border-blue-500 hover:bg-blue-900/10 transition-all cursor-pointer group">
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        onChange={handleFileChange}
                      />
                      <Camera className="text-slate-500 group-hover:text-blue-400 mb-2" size={32} />
                      <span className="text-sm text-slate-400 group-hover:text-slate-300">
                        {formData.photoUrl ? 'Trocar Foto' : 'Carregar Foto'}
                      </span>
                    </label>
                    {formData.photoUrl && (
                      <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-slate-700">
                        <img src={formData.photoUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <button 
                          type="button"
                          onClick={() => setFormData({ ...formData, photoUrl: '' })}
                          className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </form>

              <div className="p-6 border-t border-slate-800 flex gap-3">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 px-4 bg-slate-800 text-slate-300 font-semibold rounded-xl hover:bg-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  form="payment-form"
                  className="flex-1 py-3 px-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Save size={20} />
                  Salvar Lançamento
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={confirmDelete}
        title="Excluir Lançamento"
        message="Tem certeza que deseja excluir este lançamento financeiro? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        type="danger"
      />

      <ConfirmModal
        isOpen={isClearPaidConfirmOpen}
        onClose={() => setIsClearPaidConfirmOpen(false)}
        onConfirm={handleClearAllPaid}
        title="Zerar Total Recebido"
        message={`Tem certeza que deseja apagar todos os ${payments.filter(p => p.status === 'pago').length} lançamentos recebidos? Isso irá zerar o contador de "Total Recebido" e o histórico desses pagamentos será removido.`}
        confirmText="Zerar Recebidos"
        type="danger"
      />

      <ConfirmModal
        isOpen={isClearPendingConfirmOpen}
        onClose={() => setIsClearPendingConfirmOpen(false)}
        onConfirm={handleClearAllPending}
        title="Zerar Pendências"
        message={`Tem certeza que deseja marcar todos os ${payments.filter(p => p.status === 'pendente').length} lançamentos pendentes como pagos? Esta ação atualizará o saldo pendente para zero.`}
        confirmText="Zerar Pendências"
        type="info"
      />

      <ConfirmModal
        isOpen={isDeleteAllPendingConfirmOpen}
        onClose={() => setIsDeleteAllPendingConfirmOpen(false)}
        onConfirm={handleDeleteAllPending}
        title="Excluir Todas as Pendências"
        message={`Tem certeza que deseja EXCLUIR permanentemente todos os ${payments.filter(p => p.status === 'pendente').length} lançamentos pendentes? Esta ação não pode ser desfeita.`}
        confirmText="Excluir Tudo"
        type="danger"
      />

      {selectedPropertyForStatement && (
        <TenantStatementModal
          isOpen={isStatementModalOpen}
          onClose={() => {
            setIsStatementModalOpen(false);
            setSelectedPropertyForStatement(null);
          }}
          property={selectedPropertyForStatement}
          payments={payments.filter(p => p.propertyId === selectedPropertyForStatement.id)}
          contracts={contracts}
          clients={clients}
        />
      )}

      {selectedPaymentForBoleto && (
        <BoletoModal
          isOpen={isBoletoModalOpen}
          onClose={() => {
            setIsBoletoModalOpen(false);
            setSelectedPaymentForBoleto(null);
          }}
          payment={selectedPaymentForBoleto}
          contract={contracts.find(c => c.id === selectedPaymentForBoleto.contractId)}
          property={properties.find(p => p.id === selectedPaymentForBoleto.propertyId)}
          tenant={clients.find(cl => {
            if (selectedPaymentForBoleto.contractId) {
              return cl.id === contracts.find(c => c.id === selectedPaymentForBoleto.contractId)?.tenantId;
            }
            return cl.id === contracts.find(c => c.propertyId === selectedPaymentForBoleto.propertyId && c.status === 'ativo')?.tenantId;
          })}
          owner={clients.find(cl => {
            if (selectedPaymentForBoleto.contractId) {
              return cl.id === contracts.find(c => c.id === selectedPaymentForBoleto.contractId)?.ownerId;
            }
            return cl.id === properties.find(p => p.id === selectedPaymentForBoleto.propertyId)?.ownerId;
          })}
        />
      )}
    </div>
  );
};
