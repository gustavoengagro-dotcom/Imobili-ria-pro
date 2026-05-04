import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Property, Client, Contract, Payment } from '../types';
import { 
  Building2, 
  Users, 
  FileText, 
  TrendingUp, 
  AlertCircle,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { motion } from 'motion/react';

const StatCard: React.FC<{ icon: React.ElementType, label: string, value: string | number, color: string }> = ({ icon: Icon, label, value, color }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-800 flex items-center gap-4"
  >
    <div className={cn("p-3 rounded-xl", color)}>
      <Icon size={24} />
    </div>
    <div>
      <p className="text-sm text-slate-400 font-medium">{label}</p>
      <p className="text-2xl font-bold text-slate-100">{value}</p>
    </div>
  </motion.div>
);

export const Dashboard: React.FC = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

    const unsubContracts = onSnapshot(collection(db, 'contracts'), (s) => {
      setContracts(s.docs.map(d => ({ id: d.id, ...d.data() } as Contract)));
    }, (e) => {
      setLoading(false);
      handleFirestoreError(e, OperationType.LIST, 'contracts');
    });

    const unsubPayments = onSnapshot(collection(db, 'payments'), (s) => {
      setPayments(s.docs.map(d => ({ id: d.id, ...d.data() } as Payment)));
      setLoading(false);
    }, (e) => {
      setLoading(false);
      handleFirestoreError(e, OperationType.LIST, 'payments');
    });

    return () => {
      unsubProperties();
      unsubClients();
      unsubContracts();
      unsubPayments();
    };
  }, []);

  const totalRevenue = payments
    .filter(p => p.status === 'pago')
    .reduce((acc, p) => acc + p.amount, 0);

  const propertyStats = [
    { name: 'Alugados', value: properties.filter(p => p.status === 'alugado').length, color: '#3b82f6' },
    { name: 'Disponíveis', value: properties.filter(p => p.status === 'disponivel').length, color: '#10b981' },
    { name: 'Manutenção', value: properties.filter(p => p.status === 'manutencao').length, color: '#f59e0b' },
  ];

  const monthlyData = [
    { month: 'Jan', revenue: 4500 },
    { month: 'Fev', revenue: 5200 },
    { month: 'Mar', revenue: 4800 },
    { month: 'Abr', revenue: 6100 },
    { month: 'Mai', revenue: 5900 },
    { month: 'Jun', revenue: 7200 },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
          <p className="text-slate-400">Visão geral da sua imobiliária</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400 bg-slate-900 px-4 py-2 rounded-lg border border-slate-800 shadow-sm">
          <Clock size={16} />
          <span>Última atualização: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard 
          icon={Building2} 
          label="Total de Imóveis" 
          value={properties.length} 
          color="bg-blue-900/20 text-blue-400" 
        />
        <StatCard 
          icon={Users} 
          label="Inquilinos" 
          value={clients.filter(c => c.type === 'inquilino').length} 
          color="bg-green-900/20 text-green-400" 
        />
        <StatCard 
          icon={Users} 
          label="Proprietários" 
          value={clients.filter(c => c.type === 'proprietario').length} 
          color="bg-emerald-900/20 text-emerald-400" 
        />
        <StatCard 
          icon={FileText} 
          label="Contratos Ativos" 
          value={contracts.filter(c => c.status === 'ativo').length} 
          color="bg-purple-900/20 text-purple-400" 
        />
        <StatCard 
          icon={TrendingUp} 
          label="Receita Mensal" 
          value={formatCurrency(totalRevenue)} 
          color="bg-orange-900/20 text-orange-400" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Revenue Chart */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-800"
        >
          <h2 className="text-lg font-bold text-slate-100 mb-6">Receita Mensal (R$)</h2>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip 
                  cursor={{ fill: '#1e293b' }}
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#f1f5f9' }}
                />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Property Status Chart */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-800"
        >
          <h2 className="text-lg font-bold text-slate-100 mb-6">Status dos Imóveis</h2>
          <div className="h-80 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={propertyStats}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {propertyStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#f1f5f9' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-2 ml-4">
              {propertyStats.map((stat) => (
                <div key={stat.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stat.color }} />
                  <span className="text-sm text-slate-400">{stat.name}: {stat.value}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Recent Alerts */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-800"
      >
        <h2 className="text-lg font-bold text-slate-100 mb-6">Alertas e Notificações</h2>
        <div className="space-y-4">
          {payments.filter(p => p.status === 'atrasado').length > 0 ? (
            payments.filter(p => p.status === 'atrasado').map((payment) => (
              <div key={payment.id} className="flex items-center gap-4 p-4 bg-red-900/10 rounded-xl border border-red-900/20">
                <AlertCircle className="text-red-500" size={24} />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-400">Pagamento Atrasado</p>
                  <p className="text-xs text-red-300/70">Contrato #{payment.contractId.slice(0, 8)} - Vencimento: {formatDate(payment.dueDate)}</p>
                </div>
                <p className="text-sm font-bold text-red-400">{formatCurrency(payment.amount)}</p>
              </div>
            ))
          ) : (
            <div className="flex items-center gap-4 p-4 bg-green-900/10 rounded-xl border border-green-900/20">
              <CheckCircle2 className="text-green-500" size={24} />
              <div className="flex-1">
                <p className="text-sm font-semibold text-green-400">Tudo em dia!</p>
                <p className="text-xs text-green-300/70">Não há pagamentos atrasados no momento.</p>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
