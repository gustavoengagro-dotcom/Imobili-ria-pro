import React, { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Property, PropertyType, PropertyStatus, Client } from '../types';
import { 
  Plus, 
  Search, 
  MapPin, 
  Home, 
  Trash2, 
  Edit2, 
  X, 
  Save,
  Image as ImageIcon
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../components/AuthGuard';
import { ConfirmModal } from '../components/ConfirmModal';

export const Properties: React.FC = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isOwnerModalOpen, setIsOwnerModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [propertyToDelete, setPropertyToDelete] = useState<string | null>(null);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const { isAdmin } = useAuth();

  const [formData, setFormData] = useState<Partial<Property>>({
    type: 'casa',
    zipCode: '',
    city: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    rentValue: 0,
    description: '',
    photos: [],
    status: 'disponivel',
    ownerId: ''
  });

  const [newOwnerData, setNewOwnerData] = useState<Partial<Client>>({
    name: '',
    cpfCnpj: '',
    rg: '',
    phone: '',
    email: '',
    type: 'proprietario'
  });

  useEffect(() => {
    const unsubProperties = onSnapshot(collection(db, 'properties'), (s) => {
      setProperties(s.docs.map(d => ({ id: d.id, ...d.data() } as Property)));
      setLoading(false);
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
      unsubProperties();
      unsubClients();
    };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    try {
      const { id, ...dataToSave } = formData as any;
      
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

      if (editingProperty) {
        await updateDoc(doc(db, 'properties', editingProperty.id), dataToSave);
      } else {
        await addDoc(collection(db, 'properties'), dataToSave);
      }
      setIsModalOpen(false);
      setEditingProperty(null);
      setFormData({ 
        type: 'casa', 
        zipCode: '',
        city: '',
        street: '',
        number: '',
        complement: '',
        neighborhood: '',
        rentValue: 0, 
        description: '', 
        photos: [], 
        status: 'disponivel', 
        ownerId: '' 
      });
    } catch (err) {
      handleFirestoreError(err, editingProperty ? OperationType.UPDATE : OperationType.CREATE, 'properties');
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    setPropertyToDelete(id);
    setIsConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!propertyToDelete) return;
    try {
      await deleteDoc(doc(db, 'properties', propertyToDelete));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `properties/${propertyToDelete}`);
    } finally {
      setPropertyToDelete(null);
    }
  };

  const handleQuickAddOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    try {
      const dataToSave = { ...newOwnerData };
      if (!dataToSave.email) delete dataToSave.email;

      const docRef = await addDoc(collection(db, 'clients'), dataToSave);
      setFormData({ ...formData, ownerId: docRef.id });
      setIsOwnerModalOpen(false);
      setNewOwnerData({ name: '', cpfCnpj: '', rg: '', phone: '', email: '', type: 'proprietario' });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'clients');
    }
  };

  const owners = useMemo(() => clients.filter(c => c.type === 'proprietario'), [clients]);
  const ownerMap = useMemo(() => {
    return clients.reduce((acc, client) => {
      acc[client.id] = client.name;
      return acc;
    }, {} as Record<string, string>);
  }, [clients]);

  const filteredProperties = properties.filter(p => {
    const matchesSearch = p.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesOwner = ownerFilter === 'all' || p.ownerId === ownerFilter;
    return matchesSearch && matchesOwner;
  });

  const getOwnerName = (id: string) => ownerMap[id] || 'Proprietário não encontrado';

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Imóveis</h1>
          <p className="text-slate-400">Gerencie seu catálogo de propriedades</p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => {
              setEditingProperty(null);
              setFormData({ 
                type: 'casa', 
                zipCode: '',
                city: '',
                street: '',
                number: '',
                complement: '',
                neighborhood: '',
                rentValue: 0, 
                description: '', 
                photos: [], 
                status: 'disponivel', 
                ownerId: '' 
              });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-900/20"
          >
            <Plus size={20} />
            Novo Imóvel
          </button>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por endereço ou tipo..." 
            className="w-full pl-12 pr-4 py-3 bg-slate-900 border border-slate-800 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800 min-w-[200px]">
          <span className="text-xs font-bold text-slate-500 px-2 uppercase">Proprietário:</span>
          <select 
            className="bg-transparent text-slate-300 text-sm outline-none pr-4 py-1 flex-1"
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
          >
            <option value="all">Todos</option>
            {owners.map(owner => (
              <option key={owner.id} value={owner.id}>{owner.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProperties.map((property) => (
          <motion.div 
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            key={property.id} 
            className="bg-slate-900 rounded-2xl overflow-hidden shadow-sm border border-slate-800 hover:shadow-md hover:border-slate-700 transition-all"
          >
            <div className="h-48 bg-slate-800 relative">
              {property.photos?.[0] ? (
                <img src={property.photos[0]} alt={property.address} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-600">
                  <ImageIcon size={48} />
                </div>
              )}
              <div className={cn(
                "absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                property.status === 'disponivel' ? "bg-green-900/30 text-green-400" : 
                property.status === 'alugado' ? "bg-blue-900/30 text-blue-400" : "bg-orange-900/30 text-orange-400"
              )}>
                {property.status}
              </div>
            </div>
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-blue-400">
                    <Home size={16} />
                    <span className="text-xs font-bold uppercase tracking-widest">{property.type}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Proprietário</span>
                    <span className="text-xs font-medium text-slate-300 truncate max-w-[120px]">
                      {getOwnerName(property.ownerId)}
                    </span>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-slate-100 mb-1 truncate">
                  {property.street ? (
                    `${property.street}${property.number ? `, ${property.number}` : ''}`
                  ) : (
                    property.address || 'Sem Endereço'
                  )}
                </h3>
                <div className="flex items-center gap-1 text-xs text-slate-500 mb-2 truncate">
                  <MapPin size={10} />
                  <span>
                    {property.neighborhood ? `${property.neighborhood}${property.city ? `, ${property.city}` : ''}` : (property.address ? 'Endereço Antigo' : 'Localização não informada')}
                  </span>
                </div>
              <p className="text-2xl font-black text-blue-500 mb-4">{formatCurrency(property.rentValue)}<span className="text-sm font-normal text-slate-500">/mês</span></p>
              
              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <MapPin size={14} />
                  <span>Localização</span>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        setEditingProperty(property);
                        setFormData(property);
                        setIsModalOpen(true);
                      }}
                      className="p-2 text-slate-500 hover:text-blue-400 hover:bg-blue-900/20 rounded-lg transition-colors"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={() => handleDelete(property.id)}
                      className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                )}
              </div>
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
                <h2 className="text-xl font-bold text-slate-100">{editingProperty ? 'Editar Imóvel' : 'Novo Imóvel'}</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400">
                  <X size={20} />
                </button>
              </div>

              <form id="property-form" onSubmit={handleSave} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-slate-400">Tipo de Imóvel</label>
                    <select 
                      className="w-full p-3 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as PropertyType })}
                      required
                    >
                      <option value="casa">Casa</option>
                      <option value="apartamento">Apartamento</option>
                      <option value="terreno">Terreno</option>
                      <option value="comercial">Comercial</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-slate-400">Valor do Aluguel (R$)</label>
                    <input 
                      type="number" 
                      className="w-full p-3 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.rentValue}
                      onChange={(e) => setFormData({ ...formData, rentValue: Number(e.target.value) })}
                      required
                    />
                  </div>
                </div>

                {editingProperty && editingProperty.address && !formData.street && (
                  <div className="p-4 bg-blue-900/20 border border-blue-800 rounded-xl space-y-2">
                    <p className="text-xs text-blue-400 font-semibold uppercase tracking-wider">Endereço Cadastrado (Antigo)</p>
                    <p className="text-sm text-slate-300">{editingProperty.address}</p>
                    <button 
                      type="button"
                      onClick={() => {
                        const parts = editingProperty.address?.split(',').map(p => p.trim()) || [];
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
                  <label className="text-sm font-semibold text-slate-400 flex justify-between">
                    <span>Proprietário</span>
                    <button 
                      type="button"
                      onClick={() => setIsOwnerModalOpen(true)}
                      className="text-xs text-blue-500 hover:text-blue-400 flex items-center gap-1"
                    >
                      <Plus size={12} />
                      Novo Proprietário
                    </button>
                  </label>
                  <select 
                    className="w-full p-3 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.ownerId}
                    onChange={(e) => setFormData({ ...formData, ownerId: e.target.value })}
                    required
                  >
                    <option value="">Selecione um proprietário</option>
                    {owners.map(owner => (
                      <option key={owner.id} value={owner.id}>{owner.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-400">Descrição</label>
                  <textarea 
                    className="w-full p-3 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none h-32 resize-none"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-400">Status</label>
                  <select 
                    className="w-full p-3 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as PropertyStatus })}
                    required
                  >
                    <option value="disponivel">Disponível</option>
                    <option value="alugado">Alugado</option>
                    <option value="manutencao">Manutenção</option>
                  </select>
                </div>
              </form>

              <div className="p-6 border-t border-slate-800 flex gap-3">
                {editingProperty && (
                  <button 
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      handleDelete(editingProperty.id);
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
                  form="property-form"
                  className="flex-1 py-3 px-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Save size={20} />
                  {editingProperty ? 'Salvar Edição' : 'Salvar'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quick Add Owner Modal */}
      <AnimatePresence>
        {isOwnerModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setIsOwnerModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-800"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-800">
                <h2 className="text-xl font-bold text-slate-100">Novo Proprietário</h2>
                <button onClick={() => setIsOwnerModalOpen(false)} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleQuickAddOwner} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-400">Nome Completo</label>
                  <input 
                    type="text" 
                    className="w-full p-3 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newOwnerData.name}
                    onChange={(e) => setNewOwnerData({ ...newOwnerData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-slate-400">CPF / CNPJ</label>
                    <input 
                      type="text" 
                      className="w-full p-3 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      value={newOwnerData.cpfCnpj}
                      onChange={(e) => setNewOwnerData({ ...newOwnerData, cpfCnpj: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-slate-400">RG</label>
                    <input 
                      type="text" 
                      className="w-full p-3 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      value={newOwnerData.rg}
                      onChange={(e) => setNewOwnerData({ ...newOwnerData, rg: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-400">Telefone</label>
                  <input 
                    type="text" 
                    className="w-full p-3 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newOwnerData.phone}
                    onChange={(e) => setNewOwnerData({ ...newOwnerData, phone: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-400">E-mail</label>
                  <input 
                    type="email" 
                    className="w-full p-3 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newOwnerData.email}
                    onChange={(e) => setNewOwnerData({ ...newOwnerData, email: e.target.value })}
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsOwnerModalOpen(false)}
                    className="flex-1 py-3 px-4 bg-slate-800 text-slate-300 font-semibold rounded-xl hover:bg-slate-700 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3 px-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
                  >
                    Adicionar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={confirmDelete}
        title="Excluir Imóvel"
        message="Tem certeza que deseja excluir este imóvel? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        type="danger"
      />
    </div>
  );
};
