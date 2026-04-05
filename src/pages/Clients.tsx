import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Client, ClientType } from '../types';
import { 
  Plus, 
  Search, 
  User, 
  Phone, 
  Mail, 
  Trash2, 
  Edit2, 
  X, 
  Save,
  UserCheck,
  UserPlus,
  ArrowRight,
  MapPin
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../components/AuthGuard';
import { ConfirmModal } from '../components/ConfirmModal';

export const Clients: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<ClientType | 'all'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const { isAdmin } = useAuth();

  const [formData, setFormData] = useState<Partial<Client>>({
    name: '',
    cpfCnpj: '',
    rg: '',
    phone: '',
    email: '',
    zipCode: '',
    city: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    type: 'inquilino'
  });

  useEffect(() => {
    const unsubClients = onSnapshot(collection(db, 'clients'), (s) => {
      setClients(s.docs.map(d => ({ id: d.id, ...d.data() } as Client)));
      setLoading(false);
    }, (e) => {
      setLoading(false);
      handleFirestoreError(e, OperationType.LIST, 'clients');
    });

    return () => unsubClients();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    try {
      const { id, ...dataToSave } = formData as any;
      if (!dataToSave.email) delete dataToSave.email;
      
      // Construct full address for display/backward compatibility
      const fragmentedAddress = [
        dataToSave.street,
        dataToSave.number,
        dataToSave.complement,
        dataToSave.neighborhood,
        dataToSave.city,
        dataToSave.zipCode
      ].filter(Boolean).join(', ');
      
      // If we have fragmented data, use it. Otherwise preserve existing address.
      if (fragmentedAddress) {
        dataToSave.address = fragmentedAddress;
      }

      if (editingClient) {
        await updateDoc(doc(db, 'clients', editingClient.id), dataToSave);
      } else {
        await addDoc(collection(db, 'clients'), dataToSave);
      }
      setIsModalOpen(false);
      setEditingClient(null);
      setFormData({ 
        name: '', 
        cpfCnpj: '', 
        rg: '',
        phone: '', 
        email: '', 
        zipCode: '',
        city: '',
        street: '',
        number: '',
        complement: '',
        neighborhood: '',
        type: 'inquilino' 
      });
    } catch (err) {
      handleFirestoreError(err, editingClient ? OperationType.UPDATE : OperationType.CREATE, 'clients');
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    setClientToDelete(id);
    setIsConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!clientToDelete) return;
    try {
      await deleteDoc(doc(db, 'clients', clientToDelete));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `clients/${clientToDelete}`);
    } finally {
      setClientToDelete(null);
    }
  };

  const filteredClients = clients.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         c.cpfCnpj.includes(searchTerm);
    const matchesFilter = filterType === 'all' || c.type === filterType;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Clientes</h1>
          <p className="text-slate-400">Gerencie inquilinos e proprietários</p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => {
              setEditingClient(null);
              setFormData({ 
                name: '', 
                cpfCnpj: '', 
                rg: '',
                phone: '', 
                email: '', 
                zipCode: '',
                city: '',
                street: '',
                number: '',
                complement: '',
                neighborhood: '',
                type: 'inquilino' 
              });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-900/20"
          >
            <Plus size={20} />
            Novo Cliente
          </button>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por nome ou CPF/CNPJ..." 
            className="w-full pl-12 pr-4 py-3 bg-slate-900 border border-slate-800 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button 
            onClick={() => setFilterType('all')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-semibold transition-all",
              filterType === 'all' ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"
            )}
          >
            Todos
          </button>
          <button 
            onClick={() => setFilterType('inquilino')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-semibold transition-all",
              filterType === 'inquilino' ? "bg-blue-900/40 text-blue-400 shadow-sm" : "text-slate-500 hover:text-slate-300"
            )}
          >
            Inquilinos
          </button>
          <button 
            onClick={() => setFilterType('proprietario')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-semibold transition-all",
              filterType === 'proprietario' ? "bg-green-900/40 text-green-400 shadow-sm" : "text-slate-500 hover:text-slate-300"
            )}
          >
            Proprietários
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClients.map((client) => (
          <motion.div 
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            key={client.id} 
            className="bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-800 hover:shadow-md hover:border-slate-700 transition-all relative overflow-hidden"
          >
            <div className={cn(
              "absolute top-0 right-0 w-2 h-full",
              client.type === 'inquilino' ? "bg-blue-500" : "bg-green-500"
            )} />
            
            <div className="flex items-start justify-between mb-4">
              <div className={cn(
                "p-3 rounded-xl",
                client.type === 'inquilino' ? "bg-blue-900/20 text-blue-400" : "bg-green-900/20 text-green-400"
              )}>
                {client.type === 'inquilino' ? <UserPlus size={24} /> : <UserCheck size={24} />}
              </div>
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      setEditingClient(client);
                      setFormData(client);
                      setIsModalOpen(true);
                    }}
                    className="p-2 text-slate-500 hover:text-blue-400 hover:bg-blue-900/20 rounded-lg transition-colors"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button 
                    onClick={() => handleDelete(client.id)}
                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              )}
            </div>

            <h3 className="text-lg font-bold text-slate-100 mb-1 truncate">{client.name}</h3>
            <p className="text-sm text-slate-500 mb-2">{client.cpfCnpj}</p>
            
            <div className="mb-4">
              <div className="flex items-start gap-2 text-sm text-slate-400">
                <MapPin size={14} className="text-slate-500 mt-1 shrink-0" />
                <span className="line-clamp-2">
                  {client.street ? (
                    `${client.street}${client.number ? `, ${client.number}` : ''}${client.neighborhood ? ` - ${client.neighborhood}` : ''}${client.city ? ` (${client.city})` : ''}`
                  ) : (
                    client.address || 'Endereço não informado'
                  )}
                </span>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Phone size={14} className="text-slate-500" />
                <span>{client.phone}</span>
              </div>
              {client.email && (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Mail size={14} className="text-slate-500" />
                  <span className="truncate">{client.email}</span>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
              <span className={cn(
                "text-xs font-bold uppercase tracking-widest",
                client.type === 'inquilino' ? "text-blue-400" : "text-green-400"
              )}>
                {client.type}
              </span>
              <button className="text-blue-500 hover:text-blue-400 text-sm font-semibold flex items-center gap-1">
                Ver Detalhes
                <ArrowRight size={14} />
              </button>
            </div>
          </motion.div>
        ))}
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
              className="relative w-full max-w-2xl bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-800"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-800">
                <h2 className="text-xl font-bold text-slate-100">{editingClient ? 'Editar Cliente' : 'Novo Cliente'}</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400">
                  <X size={20} />
                </button>
              </div>

              <form id="client-form" onSubmit={handleSave} className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-slate-400">Nome Completo</label>
                    <input 
                      type="text" 
                      className="w-full p-3 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-slate-400">CPF / CNPJ</label>
                      <input 
                        type="text" 
                        className="w-full p-3 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                        value={formData.cpfCnpj}
                        onChange={(e) => setFormData({ ...formData, cpfCnpj: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-slate-400">RG</label>
                      <input 
                        type="text" 
                        className="w-full p-3 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                        value={formData.rg}
                        onChange={(e) => setFormData({ ...formData, rg: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {editingClient && editingClient.address && !formData.street && (
                  <div className="p-4 bg-blue-900/20 border border-blue-800 rounded-xl space-y-2">
                    <p className="text-xs text-blue-400 font-semibold uppercase tracking-wider">Endereço Cadastrado (Antigo)</p>
                    <p className="text-sm text-slate-300">{editingClient.address}</p>
                    <button 
                      type="button"
                      onClick={() => {
                        const parts = editingClient.address?.split(',').map(p => p.trim()) || [];
                        setFormData({
                          ...formData,
                          street: parts[0] || '',
                          number: parts[1] || '',
                          neighborhood: parts[2] || '',
                          city: parts[3] || '',
                          zipCode: parts[4] || ''
                        });
                      }}
                      className="text-xs text-blue-400 hover:underline font-medium"
                    >
                      Tentar preencher campos automaticamente
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-slate-400">Telefone</label>
                    <input 
                      type="text" 
                      className="w-full p-3 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-slate-400">E-mail</label>
                    <input 
                      type="email" 
                      className="w-full p-3 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-slate-400">CEP</label>
                    <input 
                      type="text" 
                      className="w-full p-3 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.zipCode}
                      onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-sm font-semibold text-slate-400">Cidade</label>
                    <input 
                      type="text" 
                      className="w-full p-3 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-3 space-y-1">
                    <label className="text-sm font-semibold text-slate-400">Rua</label>
                    <input 
                      type="text" 
                      className="w-full p-3 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.street}
                      onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-slate-400">Número</label>
                    <input 
                      type="text" 
                      className="w-full p-3 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.number}
                      onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-slate-400">Bairro</label>
                    <input 
                      type="text" 
                      className="w-full p-3 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.neighborhood}
                      onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-slate-400">Complemento</label>
                    <input 
                      type="text" 
                      className="w-full p-3 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.complement}
                      onChange={(e) => setFormData({ ...formData, complement: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-400">Tipo de Cliente</label>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: 'inquilino' })}
                      className={cn(
                        "flex-1 py-3 rounded-xl font-semibold border-2 transition-all",
                        formData.type === 'inquilino' 
                          ? "bg-blue-900/20 border-blue-600 text-blue-400" 
                          : "bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-600"
                      )}
                    >
                      Inquilino
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: 'proprietario' })}
                      className={cn(
                        "flex-1 py-3 rounded-xl font-semibold border-2 transition-all",
                        formData.type === 'proprietario' 
                          ? "bg-green-900/20 border-green-600 text-green-400" 
                          : "bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-600"
                      )}
                    >
                      Proprietário
                    </button>
                  </div>
                </div>
              </form>

              <div className="p-6 border-t border-slate-800 flex gap-3">
                {editingClient && (
                  <button 
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      handleDelete(editingClient.id);
                    }}
                    className="py-3 px-4 bg-red-900/20 text-red-400 font-semibold rounded-xl hover:bg-red-900/40 transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 size={20} />
                    Excluir
                  </button>
                )}
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 px-4 bg-slate-800 text-slate-300 font-semibold rounded-xl hover:bg-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  form="client-form"
                  className="flex-1 py-3 px-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Save size={20} />
                  {editingClient ? 'Salvar Edição' : 'Salvar'}
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
        title="Excluir Cliente"
        message="Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        type="danger"
      />
    </div>
  );
};
