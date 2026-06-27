import React, { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Property, Client, WaitingListEntry, WaitingListStatus, PropertyType, Contract } from '../types';
import { 
  Plus, 
  Search, 
  Phone, 
  Mail, 
  Trash2, 
  Edit2, 
  X, 
  Save,
  MapPin,
  Home,
  Check,
  Clock,
  AlertCircle,
  Sparkles,
  ClipboardList,
  ChevronRight,
  User,
  Filter,
  Calendar,
  ExternalLink,
  HelpCircle
} from 'lucide-react';
import { formatCurrency, cn, formatDate } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../components/AuthGuard';
import { ConfirmModal } from '../components/ConfirmModal';

export const WaitingList: React.FC = () => {
  const [entries, setEntries] = useState<WaitingListEntry[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search and Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<WaitingListStatus | 'todos'>('aguardando');
  const [typeFilter, setTypeFilter] = useState<PropertyType | 'qualquer' | 'todos'>('todos');
  const [reasonFilter, setReasonFilter] = useState<'todos' | 'busca' | 'desocupacao'>('todos');

  // Modals and Actions
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [entryIdToDelete, setEntryIdToDelete] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<WaitingListEntry | null>(null);
  
  // Matching property drawer/view state
  const [selectedEntryForMatches, setSelectedEntryForMatches] = useState<WaitingListEntry | null>(null);

  const { isAdmin } = useAuth();

  // Form State
  const [selectedClientId, setSelectedClientId] = useState<string>('manual');
  const [formData, setFormData] = useState<Partial<WaitingListEntry>>({
    clientName: '',
    phone: '',
    email: '',
    propertyType: 'qualquer',
    minPrice: undefined,
    maxPrice: undefined,
    neighborhoods: [],
    observations: '',
    status: 'aguardando',
    waitingReason: 'busca',
    targetPropertyId: ''
  });

  const [neighborhoodInput, setNeighborhoodInput] = useState('');

  // Real-time synchronization
  useEffect(() => {
    const unsubWaitingList = onSnapshot(collection(db, 'waiting_list'), (snapshot) => {
      setEntries(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as WaitingListEntry)));
      setLoading(false);
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.LIST, 'waiting_list');
    });

    const unsubProperties = onSnapshot(collection(db, 'properties'), (snapshot) => {
      setProperties(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Property)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'properties');
    });

    const unsubClients = onSnapshot(collection(db, 'clients'), (snapshot) => {
      // Filter for tenants since waiting list usually consists of tenants/buyers
      setClients(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Client)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'clients');
    });

    const unsubContracts = onSnapshot(collection(db, 'contracts'), (snapshot) => {
      setContracts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Contract)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'contracts');
    });

    return () => {
      unsubWaitingList();
      unsubProperties();
      unsubClients();
      unsubContracts();
    };
  }, []);

  // Sync manual client fields when an existing client is chosen
  useEffect(() => {
    if (selectedClientId && selectedClientId !== 'manual') {
      const selectedClient = clients.find(c => c.id === selectedClientId);
      if (selectedClient) {
        setFormData(prev => ({
          ...prev,
          clientId: selectedClient.id,
          clientName: selectedClient.name,
          phone: selectedClient.phone,
          email: selectedClient.email || ''
        }));
      }
    } else if (selectedClientId === 'manual' && !editingEntry) {
      setFormData(prev => ({
        ...prev,
        clientId: undefined,
        clientName: '',
        phone: '',
        email: ''
      }));
    }
  }, [selectedClientId, clients]);

  // Handle open modal for create
  const handleOpenCreate = () => {
    setEditingEntry(null);
    setSelectedClientId('manual');
    setNeighborhoodInput('');
    setFormData({
      clientName: '',
      phone: '',
      email: '',
      propertyType: 'qualquer',
      minPrice: undefined,
      maxPrice: undefined,
      neighborhoods: [],
      observations: '',
      status: 'aguardando',
      waitingReason: 'busca',
      targetPropertyId: '',
      visitDate: '',
      visitTime: '',
      visitPropertyId: '',
      visitStatus: undefined
    });
    setIsModalOpen(true);
  };

  // Handle open modal for edit
  const handleOpenEdit = (entry: WaitingListEntry) => {
    setEditingEntry(entry);
    setSelectedClientId(entry.clientId || 'manual');
    setNeighborhoodInput(entry.neighborhoods?.join(', ') || '');
    setFormData({
      waitingReason: 'busca',
      targetPropertyId: '',
      ...entry
    });
    setIsModalOpen(true);
  };

  // Add neighborhood on comma or enter
  const parseNeighborhoods = (input: string) => {
    return input
      .split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    try {
      const parsedNeighborhoods = parseNeighborhoods(neighborhoodInput);
      const dataToSave = {
        ...formData,
        neighborhoods: parsedNeighborhoods,
        minPrice: formData.minPrice ? Number(formData.minPrice) : null,
        maxPrice: formData.maxPrice ? Number(formData.maxPrice) : null,
        waitingReason: formData.waitingReason || 'busca',
        targetPropertyId: formData.waitingReason === 'desocupacao' ? (formData.targetPropertyId || '') : '',
        createdAt: editingEntry ? editingEntry.createdAt : new Date().toISOString()
      };

      // Clean up fields
      if (selectedClientId === 'manual') {
        delete dataToSave.clientId;
      }

      // Remove undefined fields to prevent Firestore SDK errors
      Object.keys(dataToSave).forEach(key => {
        if ((dataToSave as any)[key] === undefined) {
          delete (dataToSave as any)[key];
        }
      });

      if (editingEntry) {
        const entryRef = doc(db, 'waiting_list', editingEntry.id);
        const { id, ...cleanData } = dataToSave as any;
        await updateDoc(entryRef, cleanData);
      } else {
        await addDoc(collection(db, 'waiting_list'), dataToSave);
      }

      setIsModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, editingEntry ? OperationType.UPDATE : OperationType.CREATE, 'waiting_list');
    }
  };

  const handleDeleteClick = (id: string) => {
    setEntryIdToDelete(id);
    setIsConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!entryIdToDelete || !isAdmin) return;
    try {
      await deleteDoc(doc(db, 'waiting_list', entryIdToDelete));
      setIsConfirmOpen(false);
      setEntryIdToDelete(null);
      if (selectedEntryForMatches?.id === entryIdToDelete) {
        setSelectedEntryForMatches(null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'waiting_list');
    }
  };

  const handleQuickStatusChange = async (entry: WaitingListEntry, newStatus: WaitingListStatus) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'waiting_list', entry.id), { status: newStatus });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'waiting_list');
    }
  };

  const getTargetPropertyDetails = (targetPropertyId?: string) => {
    if (!targetPropertyId) return null;
    const property = properties.find(p => p.id === targetPropertyId);
    if (!property) return null;
    
    // Find active contract for this property
    const activeContract = contracts.find(c => c.propertyId === targetPropertyId && c.status === 'ativo');
    
    return {
      property,
      contract: activeContract,
    };
  };

  // Matching properties calculation
  const getMatchingPropertiesForEntry = (entry: WaitingListEntry) => {
    return properties.filter(prop => {
      // Must be available
      if (prop.status !== 'disponivel') return false;

      // Property type match
      if (entry.propertyType !== 'qualquer' && prop.type !== entry.propertyType) return false;

      // Price range match
      if (entry.minPrice && prop.rentValue < entry.minPrice) return false;
      if (entry.maxPrice && prop.rentValue > entry.maxPrice) return false;

      // Neighborhood match (case-insensitive checks)
      if (entry.neighborhoods && entry.neighborhoods.length > 0) {
        const propNeigh = (prop.neighborhood || '').toLowerCase().trim();
        const hasNeighMatch = entry.neighborhoods.some(neigh => 
          propNeigh.includes(neigh.toLowerCase().trim()) || 
          neigh.toLowerCase().trim().includes(propNeigh)
        );
        if (!hasNeighMatch) return false;
      }

      return true;
    });
  };

  // Filtered entries list
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      // Filter status
      if (statusFilter !== 'todos' && entry.status !== statusFilter) return false;

      // Filter property type
      if (typeFilter !== 'todos' && entry.propertyType !== typeFilter) return false;

      // Filter by waiting reason
      if (reasonFilter !== 'todos') {
        const reason = entry.waitingReason || 'busca';
        if (reason !== reasonFilter) return false;
      }

      // Search term (client name, phone, neighborhoods)
      if (searchTerm) {
        const lowerSearch = searchTerm.toLowerCase();
        const nameMatch = entry.clientName.toLowerCase().includes(lowerSearch);
        const phoneMatch = entry.phone.toLowerCase().includes(lowerSearch);
        const emailMatch = entry.email?.toLowerCase().includes(lowerSearch);
        const obsMatch = entry.observations?.toLowerCase().includes(lowerSearch);
        const neighMatch = entry.neighborhoods?.some(n => n.toLowerCase().includes(lowerSearch));

        // If waiting for a specific property, match the address
        let targetPropMatch = false;
        if (entry.targetPropertyId) {
          const targetProp = properties.find(p => p.id === entry.targetPropertyId);
          if (targetProp) {
            targetPropMatch = targetProp.address.toLowerCase().includes(lowerSearch) || 
                              (targetProp.neighborhood || '').toLowerCase().includes(lowerSearch);
          }
        }

        return nameMatch || phoneMatch || emailMatch || obsMatch || neighMatch || targetPropMatch;
      }

      return true;
    });
  }, [entries, statusFilter, typeFilter, reasonFilter, searchTerm, properties]);

  // Metrics calculation
  const metrics = useMemo(() => {
    const totalAguardando = entries.filter(e => e.status === 'aguardando').length;
    const totalAtendido = entries.filter(e => e.status === 'atendido').length;
    
    // Count how many are waiting for property vacate specifically
    const totalDesocupacao = entries.filter(e => e.status === 'aguardando' && e.waitingReason === 'desocupacao').length;

    // Count matches for active entries
    const activeEntriesWithMatches = entries
      .filter(e => e.status === 'aguardando')
      .map(e => ({ entry: e, matches: getMatchingPropertiesForEntry(e) }))
      .filter(item => item.matches.length > 0).length;

    // Count of scheduled visits
    const totalVisitasAgendadas = entries.filter(e => e.status === 'aguardando' && e.visitDate && e.visitStatus === 'agendado').length;

    return {
      totalAguardando,
      totalAtendido,
      totalDesocupacao,
      activeEntriesWithMatches,
      totalVisitasAgendadas
    };
  }, [entries, properties]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <ClipboardList className="text-blue-500" size={28} />
            Lista de Espera
          </h1>
          <p className="text-sm text-slate-400">Gerencie clientes em busca de imóveis e encontre oportunidades ideais</p>
        </div>
        {isAdmin && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-semibold transition-colors shadow-lg shadow-blue-900/20"
          >
            <Plus size={20} />
            Adicionar à Lista
          </button>
        )}
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex items-center gap-4">
          <div className="p-3 bg-yellow-500/10 text-yellow-500 rounded-xl">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-400 font-medium">Aguardando Atendimento</p>
            <p className="text-2xl font-bold text-slate-100 mt-0.5">{metrics.totalAguardando}</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
            <Calendar size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-400 font-medium font-bold text-indigo-400">Visitas Agendadas</p>
            <p className="text-2xl font-bold text-slate-100 mt-0.5">{metrics.totalVisitasAgendadas}</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex items-center gap-4">
          <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl">
            <Calendar size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-400 font-medium">Aguardando Desocupação</p>
            <p className="text-2xl font-bold text-indigo-400 mt-0.5">{metrics.totalDesocupacao}</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex items-center gap-4">
          <div className="p-3 bg-green-500/10 text-green-500 rounded-xl">
            <Check size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-400 font-medium">Atendidos Recentemente</p>
            <p className="text-2xl font-bold text-slate-100 mt-0.5">{metrics.totalAtendido}</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex items-center gap-4 col-span-1 sm:col-span-2 lg:col-span-4 xl:col-span-1">
          <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
            <Sparkles size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-400 font-medium font-bold text-blue-400">Cruzamentos Compatíveis</p>
            <p className="text-2xl font-bold text-blue-400 mt-0.5">
              {metrics.activeEntriesWithMatches} clientes
            </p>
          </div>
        </div>
      </div>

      {/* Main Section Grid (List + Matches sidebar if selected) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Waiting List Column */}
        <div className={cn(
          "space-y-4",
          selectedEntryForMatches ? "lg:col-span-8" : "lg:col-span-12"
        )}>
          {/* Filters & Search controls */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                type="text"
                placeholder="Buscar por nome, telefone, bairro ou imóvel alvo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-100 pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-blue-500 placeholder-slate-500"
              />
            </div>

            <div className="flex flex-wrap gap-2.5">
              {/* Status Filter buttons */}
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                {(['aguardando', 'atendido', 'todos'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all",
                      statusFilter === status 
                        ? "bg-slate-800 text-blue-400 border border-slate-700/50 shadow-sm" 
                        : "text-slate-400 hover:text-slate-200"
                    )}
                  >
                    {status === 'todos' ? 'Todos' : status}
                  </button>
                ))}
              </div>

              {/* Waiting Reason Filter */}
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300">
                <HelpCircle size={14} className="text-slate-500" />
                <select
                  value={reasonFilter}
                  onChange={(e) => setReasonFilter(e.target.value as any)}
                  className="bg-transparent border-none text-slate-300 focus:outline-none focus:ring-0 cursor-pointer"
                >
                  <option value="todos" className="bg-slate-900">Motivo: Todos</option>
                  <option value="busca" className="bg-slate-900">Motivo: Busca Geral</option>
                  <option value="desocupacao" className="bg-slate-900">Motivo: Esperando Desocupar</option>
                </select>
              </div>

              {/* Property Type Filter select */}
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300">
                <Filter size={14} className="text-slate-500" />
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as any)}
                  className="bg-transparent border-none text-slate-300 focus:outline-none focus:ring-0 cursor-pointer"
                >
                  <option value="todos" className="bg-slate-900">Tipo: Todos</option>
                  <option value="qualquer" className="bg-slate-900">Tipo: Qualquer</option>
                  <option value="casa" className="bg-slate-900">Tipo: Casa</option>
                  <option value="apartamento" className="bg-slate-900">Tipo: Apartamento</option>
                  <option value="terreno" className="bg-slate-900">Tipo: Terreno</option>
                  <option value="comercial" className="bg-slate-900">Tipo: Comercial</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table / List */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-500">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm">Carregando lista...</p>
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-2">
                <AlertCircle size={40} className="text-slate-600" />
                <p className="font-semibold text-slate-400">Nenhum registro encontrado</p>
                <p className="text-xs text-slate-500">Tente ajustar seus filtros ou adicione um novo registro de espera.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/50">
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Cliente</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Preferência Imóvel</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Faixa de Preço</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Bairros de Interesse</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredEntries.map((entry) => {
                      const matches = getMatchingPropertiesForEntry(entry);
                      const isSelected = selectedEntryForMatches?.id === entry.id;

                      return (
                        <tr 
                          key={entry.id} 
                          className={cn(
                            "group transition-all hover:bg-slate-800/10 cursor-pointer",
                            isSelected && "bg-blue-900/10 hover:bg-blue-900/20"
                          )}
                          onClick={() => setSelectedEntryForMatches(isSelected ? null : entry)}
                        >
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
                                <User size={14} className="text-slate-500" />
                                {entry.clientName}
                              </span>
                              <span className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                <Phone size={12} className="text-slate-500" />
                                {entry.phone}
                              </span>
                              {entry.email && (
                                <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                  <Mail size={12} className="text-slate-500" />
                                  {entry.email}
                                </span>
                              )}
                              
                              {entry.waitingReason === 'desocupacao' && entry.targetPropertyId ? (() => {
                                const details = getTargetPropertyDetails(entry.targetPropertyId);
                                if (!details) return null;
                                const isVacant = details.property.status === 'disponivel';
                                return (
                                  <div className="mt-2 p-2.5 bg-indigo-950/40 border border-indigo-900/50 rounded-xl text-xs space-y-1 max-w-xs">
                                    <div className="flex items-center gap-1 text-indigo-400 font-bold">
                                      <Calendar size={12} />
                                      <span>Aguardando Desocupação</span>
                                      {isVacant ? (
                                        <span className="ml-1.5 px-1.5 py-0.5 bg-green-500 text-white font-black text-[9px] rounded-full uppercase tracking-wider animate-pulse">
                                          Liberado!
                                        </span>
                                      ) : (
                                        <span className="ml-1.5 px-1.5 py-0.5 bg-slate-800 text-slate-400 text-[9px] rounded-full font-medium">
                                          Ocupado
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-slate-300 font-medium truncate flex items-center gap-1">
                                      <MapPin size={10} className="text-indigo-400/80 flex-shrink-0" />
                                      {details.property.address}
                                    </div>
                                    {details.contract && (
                                      <div className="text-[10px] text-slate-400">
                                        Vigência até <span className="text-indigo-300 font-semibold">{formatDate(details.contract.endDate)}</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })() : (
                                <div className="mt-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                  <Search size={10} className="text-slate-600" />
                                  <span>Busca Geral</span>
                                </div>
                              )}

                              {entry.visitPropertyId && entry.visitDate && (() => {
                                const visitedProp = properties.find(p => p.id === entry.visitPropertyId);
                                const statusLabel = entry.visitStatus === 'realizado' ? 'Visita Realizada' : entry.visitStatus === 'cancelado' ? 'Visita Cancelada' : 'Visita Agendada';
                                const statusColors = entry.visitStatus === 'realizado' 
                                  ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                                  : entry.visitStatus === 'cancelado' 
                                    ? 'bg-red-500/10 text-red-400 border-red-500/20' 
                                    : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20 animate-pulse';

                                return (
                                  <div className="mt-2.5 p-2.5 bg-slate-950/60 border border-slate-850/80 rounded-xl text-xs space-y-1 max-w-xs">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1 font-bold text-slate-300">
                                        <Calendar size={11} className="text-indigo-400" />
                                        <span>Visita</span>
                                      </div>
                                      <span className={cn("px-1.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase border", statusColors)}>
                                        {statusLabel}
                                      </span>
                                    </div>
                                    <div className="text-slate-400 font-medium">
                                      Dia <span className="text-slate-200 font-bold">{formatDate(entry.visitDate)}</span> às <span className="text-slate-200 font-bold">{entry.visitTime || '--:--'}</span>
                                    </div>
                                    {visitedProp && (
                                      <div className="text-[10px] text-slate-400 truncate flex items-center gap-0.5">
                                        <MapPin size={10} className="text-slate-500" />
                                        {visitedProp.address}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium capitalize bg-slate-800 text-slate-300 border border-slate-700/50">
                              {entry.propertyType === 'qualquer' ? 'Qualquer Tipo' : entry.propertyType}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-slate-300 font-medium">
                              {entry.minPrice || entry.maxPrice ? (
                                <>
                                  {entry.minPrice ? formatCurrency(entry.minPrice) : 'R$ 0'} 
                                  <span className="text-slate-500 mx-1">à</span> 
                                  {entry.maxPrice ? formatCurrency(entry.maxPrice) : 'Qualquer'}
                                </>
                              ) : (
                                <span className="text-slate-500">Qualquer valor</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1 max-w-[180px]">
                              {entry.neighborhoods && entry.neighborhoods.length > 0 ? (
                                entry.neighborhoods.map((neigh, idx) => (
                                  <span 
                                    key={idx} 
                                    className="px-1.5 py-0.5 rounded text-[10px] bg-slate-950 text-slate-400 border border-slate-800"
                                  >
                                    {neigh}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-slate-500">Qualquer bairro</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                entry.status === 'aguardando' && "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20",
                                entry.status === 'atendido' && "bg-green-500/10 text-green-500 border border-green-500/20",
                                entry.status === 'cancelado' && "bg-red-500/10 text-red-500 border border-red-500/20"
                              )}>
                                {entry.status}
                              </span>
                              
                              {/* Quick Match Badge */}
                              {entry.status === 'aguardando' && matches.length > 0 && (
                                <span className="bg-blue-500/10 text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-500/20 flex items-center gap-0.5 animate-pulse">
                                  <Sparkles size={10} />
                                  {matches.length} matches
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              {entry.status === 'aguardando' && isAdmin && (
                                <button
                                  onClick={() => handleQuickStatusChange(entry, 'atendido')}
                                  title="Marcar como Atendido"
                                  className="p-1.5 text-slate-400 hover:text-green-400 hover:bg-slate-800 rounded-lg transition-colors"
                                >
                                  <Check size={16} />
                                </button>
                              )}
                              
                              <button
                                onClick={() => setSelectedEntryForMatches(isSelected ? null : entry)}
                                title="Ver cruzamentos de imóveis"
                                className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-colors"
                              >
                                <ChevronRight size={16} />
                              </button>

                              {isAdmin && (
                                <>
                                  <button
                                    onClick={() => handleOpenEdit(entry)}
                                    title="Editar"
                                    className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-colors"
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteClick(entry.id)}
                                    title="Excluir"
                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-800 rounded-lg transition-colors"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Matches Finder Panel */}
        <AnimatePresence>
          {selectedEntryForMatches && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 h-fit space-y-6"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-md font-bold text-slate-100 flex items-center gap-1.5">
                    <Sparkles className="text-blue-400" size={18} />
                    Cruzamento Inteligente
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">Cruzamento de imóveis para {selectedEntryForMatches.clientName}</p>
                </div>
                <button 
                  onClick={() => setSelectedEntryForMatches(null)}
                  className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Preferences Summary */}
              <div className="bg-slate-950 p-4 rounded-xl space-y-3 border border-slate-800/80">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Preferências</h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block">Tipo Desejado</span>
                    <span className="font-medium text-slate-300 capitalize">{selectedEntryForMatches.propertyType}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Faixa de Preço</span>
                    <span className="font-medium text-slate-300">
                      {selectedEntryForMatches.minPrice || selectedEntryForMatches.maxPrice ? (
                        <>
                          {selectedEntryForMatches.minPrice ? formatCurrency(selectedEntryForMatches.minPrice) : 'R$0'} - 
                          {selectedEntryForMatches.maxPrice ? formatCurrency(selectedEntryForMatches.maxPrice) : '∞'}
                        </>
                      ) : 'Qualquer valor'}
                    </span>
                  </div>
                  {selectedEntryForMatches.neighborhoods && selectedEntryForMatches.neighborhoods.length > 0 && (
                    <div className="col-span-2">
                      <span className="text-slate-500 block">Bairros</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedEntryForMatches.neighborhoods.map((n, i) => (
                          <span key={i} className="bg-slate-900 px-1.5 py-0.5 rounded text-[10px] text-slate-400 border border-slate-800">{n}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedEntryForMatches.observations && (
                    <div className="col-span-2">
                      <span className="text-slate-500 block">Observações</span>
                      <p className="text-slate-400 italic font-normal mt-1 leading-relaxed">{selectedEntryForMatches.observations}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Target Property section if waiting for desocupacao */}
              {selectedEntryForMatches.waitingReason === 'desocupacao' && selectedEntryForMatches.targetPropertyId && (() => {
                const details = getTargetPropertyDetails(selectedEntryForMatches.targetPropertyId);
                if (!details) return null;
                const isVacant = details.property.status === 'disponivel';
                
                return (
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5 border-b border-slate-800 pb-2">
                      <Calendar className="text-indigo-400" size={16} />
                      <span>Imóvel Alvo Aguardado</span>
                    </h3>
                    
                    <div className={cn(
                      "p-4 rounded-xl border transition-all space-y-3",
                      isVacant 
                        ? "bg-green-500/10 border-green-500/30 text-slate-100" 
                        : "bg-slate-950 border-slate-800 text-slate-100"
                    )}>
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-900 text-slate-300">
                          {details.property.type}
                        </span>
                        <span className={cn(
                          "text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full",
                          isVacant ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-500 animate-pulse"
                        )}>
                          {isVacant ? 'Desocupado!' : 'Ainda Ocupado'}
                        </span>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="font-bold text-sm text-slate-100">{details.property.address}</div>
                        {details.property.neighborhood && (
                          <div className="text-xs text-slate-400">Bairro: {details.property.neighborhood}</div>
                        )}
                        <div className="text-xs font-semibold text-blue-400">{formatCurrency(details.property.rentValue)}/mês</div>
                      </div>

                      {/* Success banner if vacant */}
                      {isVacant && (
                        <div className="p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-xs text-green-400 font-medium">
                          🎉 <strong>Excelente oportunidade!</strong> O imóvel procurado foi liberado. Entre em contato com o cliente para iniciar a contratação.
                        </div>
                      )}

                      {/* Contract Info if occupied */}
                      {!isVacant && details.contract && (
                        <div className="text-xs bg-slate-900 p-3 rounded-lg border border-slate-850 space-y-1">
                          <span className="text-slate-500 block text-[10px] font-bold uppercase">Previsão contratual</span>
                          <p className="text-slate-300">
                            Fim da vigência: <strong className="text-indigo-400">{formatDate(details.contract.endDate)}</strong>
                          </p>
                          {details.contract.tenantId && (
                            <p className="text-slate-400 text-[10px]">
                              Inquilino atual cadastrado no sistema.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Visita Agendada Card in Sidebar */}
              {(() => {
                if (!selectedEntryForMatches.visitDate) return null;
                const visitProp = properties.find(p => p.id === selectedEntryForMatches.visitPropertyId);
                const isScheduled = selectedEntryForMatches.visitStatus === 'agendado';
                const isDone = selectedEntryForMatches.visitStatus === 'realizado';
                const isCancelled = selectedEntryForMatches.visitStatus === 'cancelado';

                return (
                  <div className="space-y-3 bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
                    <h3 className="text-sm font-bold text-indigo-400 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Calendar size={16} />
                        Visita Agendada
                      </span>
                      <span className={cn(
                        "text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border",
                        isScheduled && "bg-yellow-500/10 text-yellow-500 border-yellow-500/20 animate-pulse",
                        isDone && "bg-green-500/10 text-green-400 border-green-500/20",
                        isCancelled && "bg-red-500/10 text-red-400 border-red-500/20"
                      )}>
                        {selectedEntryForMatches.visitStatus || 'Agendada'}
                      </span>
                    </h3>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between text-slate-300">
                        <span>Data da Visita:</span>
                        <strong className="text-slate-100">{formatDate(selectedEntryForMatches.visitDate)}</strong>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span>Horário:</span>
                        <strong className="text-slate-100">{selectedEntryForMatches.visitTime || '--:--'}</strong>
                      </div>
                      {visitProp && (
                        <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-850 space-y-1 mt-1">
                          <span className="text-[9px] text-slate-500 font-bold uppercase">Imóvel da Visita</span>
                          <p className="text-slate-200 font-semibold truncate">{visitProp.address}</p>
                          <p className="text-[10px] text-slate-400">Bairro: {visitProp.neighborhood || 'Bairro'}</p>
                        </div>
                      )}
                    </div>

                    {/* Quick WhatsApp message for visit */}
                    {isScheduled && (
                      <a
                        href={`https://wa.me/55${selectedEntryForMatches.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${selectedEntryForMatches.clientName}, passamos para confirmar sua visita agendada para o dia ${formatDate(selectedEntryForMatches.visitDate)} às ${selectedEntryForMatches.visitTime || ''} no imóvel da ${visitProp?.address || ''}! Confirmado?`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors text-[11px]"
                      >
                        <Phone size={12} />
                        Confirmar Visita no WhatsApp
                      </a>
                    )}
                  </div>
                );
              })()}

              {/* Compatible Real Estate Matches (Alternativos se desocupação, ou principal se busca geral) */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-200 flex items-center justify-between">
                  <span>
                    {selectedEntryForMatches.waitingReason === 'desocupacao' 
                      ? 'Outras Alternativas Disponíveis' 
                      : 'Imóveis Compatíveis'}
                  </span>
                  <span className="text-xs bg-blue-600/10 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/10">
                    {getMatchingPropertiesForEntry(selectedEntryForMatches).length} encontrados
                  </span>
                </h3>

                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {getMatchingPropertiesForEntry(selectedEntryForMatches).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 bg-slate-950/40 border border-dashed border-slate-800 rounded-xl text-slate-500 text-center p-4">
                      <AlertCircle size={24} className="text-slate-600 mb-2" />
                      <p className="text-xs font-semibold">Nenhum imóvel alternativo disponível</p>
                      <p className="text-[10px] text-slate-500/80 mt-1">Não há outros imóveis disponíveis com as mesmas preferências de tipo, bairros e faixa de preço.</p>
                    </div>
                  ) : (
                    getMatchingPropertiesForEntry(selectedEntryForMatches).map(prop => (
                      <div 
                        key={prop.id} 
                        className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden p-4 hover:border-slate-700 transition-all flex flex-col gap-3"
                      >
                        <div className="flex gap-3">
                          {prop.photos && prop.photos.length > 0 ? (
                            <img 
                              src={prop.photos[0]} 
                              alt={prop.type} 
                              referrerPolicy="no-referrer"
                              className="w-16 h-16 rounded-lg object-cover bg-slate-900 flex-shrink-0" 
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-lg bg-slate-900 flex items-center justify-center text-slate-600 flex-shrink-0 border border-slate-800">
                              <Home size={20} />
                            </div>
                          )}
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-blue-400 uppercase tracking-wide capitalize">{prop.type}</span>
                              <span className="text-xs font-extrabold text-slate-100">{formatCurrency(prop.rentValue)}/mês</span>
                            </div>
                            
                            <p className="text-xs text-slate-300 truncate flex items-center gap-1">
                              <MapPin size={12} className="text-slate-500 flex-shrink-0" />
                              {prop.address}
                            </p>
                            
                            {prop.neighborhood && (
                              <p className="text-[10px] text-slate-400">
                                Bairro: <span className="text-slate-300">{prop.neighborhood}</span>
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Quick action to schedule a visit for this matching property */}
                        {isAdmin && (
                          <button
                            onClick={() => {
                              setEditingEntry(selectedEntryForMatches);
                              setSelectedClientId(selectedEntryForMatches.clientId || 'manual');
                              setNeighborhoodInput(selectedEntryForMatches.neighborhoods?.join(', ') || '');
                              setFormData({
                                ...selectedEntryForMatches,
                                visitPropertyId: prop.id,
                                visitStatus: 'agendado'
                              });
                              setIsModalOpen(true);
                            }}
                            className="w-full py-1.5 px-3 bg-indigo-950/40 hover:bg-indigo-900/30 text-indigo-400 border border-indigo-900/25 rounded-lg flex items-center justify-center gap-1.5 transition-colors text-[11px] font-bold"
                          >
                            <Calendar size={12} />
                            Agendar Visita para Este Imóvel
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Action Contact */}
              {selectedEntryForMatches.status === 'aguardando' && (() => {
                let text = `Olá ${selectedEntryForMatches.clientName}, temos imóveis disponíveis que correspondem às suas preferências!`;
                if (selectedEntryForMatches.waitingReason === 'desocupacao' && selectedEntryForMatches.targetPropertyId) {
                  const details = getTargetPropertyDetails(selectedEntryForMatches.targetPropertyId);
                  if (details) {
                    const isVacant = details.property.status === 'disponivel';
                    if (isVacant) {
                      text = `Olá ${selectedEntryForMatches.clientName}, o imóvel que você estava aguardando desocupar (${details.property.address}) já está liberado e pronto para você! Vamos agendar sua assinatura de contrato?`;
                    } else {
                      text = `Olá ${selectedEntryForMatches.clientName}, passamos para informar que continuamos acompanhando a desocupação do imóvel na ${details.property.address} para você!`;
                    }
                  }
                }
                
                return (
                  <div className="pt-2">
                    <a 
                      href={`https://wa.me/55${selectedEntryForMatches.phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors text-sm shadow-md"
                    >
                      <Phone size={16} />
                      Contatar Cliente via WhatsApp
                    </a>
                  </div>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Creation / Editing Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden z-10"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <ClipboardList className="text-blue-500" size={20} />
                  {editingEntry ? 'Editar Interesse' : 'Adicionar Interessado'}
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                {/* Client Link selection (only on create to avoid confusing references) */}
                {!editingEntry && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Associar Cliente Cadastrado?</label>
                    <select
                      value={selectedClientId}
                      onChange={(e) => setSelectedClientId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="manual">Não associar (Inserir dados manualmente)</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.type === 'inquilino' ? 'Inquilino' : 'Proprietário'}) - {c.phone}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Name */}
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nome Completo *</label>
                    <input
                      type="text"
                      required
                      disabled={selectedClientId !== 'manual' && !editingEntry}
                      value={formData.clientName || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, clientName: e.target.value }))}
                      placeholder="Ex: Maria Oliveira"
                      className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
                    />
                  </div>

                  {/* Phone */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Telefone de Contato *</label>
                    <input
                      type="text"
                      required
                      disabled={selectedClientId !== 'manual' && !editingEntry}
                      value={formData.phone || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="Ex: (64) 99999-9999"
                      className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5 col-span-2 md:col-span-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">E-mail (Opcional)</label>
                    <input
                      type="email"
                      disabled={selectedClientId !== 'manual' && !editingEntry}
                      value={formData.email || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="Ex: maria@provedor.com"
                      className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
                    />
                  </div>

                  {/* Motivo do Interesse */}
                  <div className="space-y-1.5 col-span-2 bg-slate-950/40 p-4 border border-slate-800/80 rounded-2xl">
                    <label className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                      <HelpCircle size={14} />
                      Motivo do Interesse *
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1.5">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, waitingReason: 'busca', targetPropertyId: '' }))}
                        className={cn(
                          "p-3 rounded-xl text-xs font-semibold border text-left transition-all",
                          (formData.waitingReason || 'busca') === 'busca'
                            ? "bg-blue-600/10 border-blue-500/50 text-blue-400 shadow-sm"
                            : "bg-slate-900 border-slate-850 text-slate-400 hover:text-slate-200"
                        )}
                      >
                        <div className="font-bold flex items-center gap-1 mb-1">
                          <Search size={14} />
                          Busca Geral
                        </div>
                        <p className="text-[10px] text-slate-500 font-normal leading-relaxed">Procura de imóveis vagos com cruzamento por preferências gerais.</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, waitingReason: 'desocupacao' }))}
                        className={cn(
                          "p-3 rounded-xl text-xs font-semibold border text-left transition-all",
                          formData.waitingReason === 'desocupacao'
                            ? "bg-indigo-600/10 border-indigo-500/50 text-indigo-400 shadow-sm"
                            : "bg-slate-900 border-slate-850 text-slate-400 hover:text-slate-200"
                        )}
                      >
                        <div className="font-bold flex items-center gap-1 mb-1">
                          <Calendar size={14} />
                          Esperando Desocupar
                        </div>
                        <p className="text-[10px] text-slate-500 font-normal leading-relaxed">Interesse em um imóvel específico que está ocupado atualmente.</p>
                      </button>
                    </div>

                    {/* Target Property Dropdown if waitingReason is desocupacao */}
                    {formData.waitingReason === 'desocupacao' && (
                      <div className="mt-4 space-y-1.5 animate-fadeIn">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          <Home size={12} />
                          Selecione o Imóvel Ocupado *
                        </label>
                        <select
                          required
                          value={formData.targetPropertyId || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, targetPropertyId: e.target.value }))}
                          className="w-full bg-slate-900 border border-slate-800 text-slate-100 px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                        >
                          <option value="">-- Selecione o imóvel --</option>
                          {properties.map(p => {
                            const isRented = p.status === 'alugado';
                            return (
                              <option key={p.id} value={p.id} className="bg-slate-900">
                                {isRented ? '⚠️ [OCUPADO]' : '🟢 [DISPONÍVEL]'} - {p.address} ({p.neighborhood || 'Sem bairro'})
                              </option>
                            );
                          })}
                        </select>

                        {/* Real-time Target Property Details Preview */}
                        {formData.targetPropertyId && (() => {
                          const details = getTargetPropertyDetails(formData.targetPropertyId);
                          if (!details) return null;
                          const isVacant = details.property.status === 'disponivel';
                          return (
                            <div className="mt-3 p-3 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1.5">
                              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                                <span className="text-slate-500">Detalhes do Imóvel Selecionado</span>
                                <span className={isVacant ? 'text-green-400' : 'text-yellow-500'}>
                                  {isVacant ? 'Desocupado' : 'Ocupado'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-300 font-semibold">{details.property.address}</p>
                              {details.contract ? (
                                <p className="text-[10px] text-indigo-400">
                                  Contrato com inquilino ativo com vigência até <strong>{formatDate(details.contract.endDate)}</strong>.
                                </p>
                              ) : (
                                <p className="text-[10px] text-slate-500 italic">
                                  Sem contrato ativo registrado para este imóvel no momento.
                                </p>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Desired Property Type */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tipo de Imóvel Buscado *</label>
                    <select
                      value={formData.propertyType || 'qualquer'}
                      onChange={(e) => setFormData(prev => ({ ...prev, propertyType: e.target.value as any }))}
                      className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="qualquer">Qualquer Tipo</option>
                      <option value="casa">Casa</option>
                      <option value="apartamento">Apartamento</option>
                      <option value="terreno">Terreno</option>
                      <option value="comercial">Comercial</option>
                    </select>
                  </div>

                  {/* Status */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status do Atendimento</label>
                    <select
                      value={formData.status || 'aguardando'}
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                      className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="aguardando">Aguardando</option>
                      <option value="atendido">Atendido</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </div>

                  {/* Min Price */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Valor Mínimo (Aluguel)</label>
                    <input
                      type="number"
                      value={formData.minPrice === undefined ? '' : formData.minPrice}
                      onChange={(e) => setFormData(prev => ({ ...prev, minPrice: e.target.value === '' ? undefined : Number(e.target.value) }))}
                      placeholder="Ex: 800"
                      className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Max Price */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Valor Máximo (Aluguel)</label>
                    <input
                      type="number"
                      value={formData.maxPrice === undefined ? '' : formData.maxPrice}
                      onChange={(e) => setFormData(prev => ({ ...prev, maxPrice: e.target.value === '' ? undefined : Number(e.target.value) }))}
                      placeholder="Ex: 2500"
                      className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Neighborhoods of interest */}
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bairros Desejados (Separados por vírgula)</label>
                    <input
                      type="text"
                      value={neighborhoodInput}
                      onChange={(e) => setNeighborhoodInput(e.target.value)}
                      placeholder="Ex: Centro, Jardim Planalto, Vila Rica"
                      className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-[10px] text-slate-500">Isso será utilizado para encontrar correspondência com os bairros dos imóveis cadastrados.</span>
                  </div>

                  {/* Observations */}
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Observações / Requisitos Adicionais</label>
                    <textarea
                      value={formData.observations || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, observations: e.target.value }))}
                      placeholder="Ex: Prefere imóveis com garagem coberta, quintal para cão pequeno, etc."
                      rows={3}
                      className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-blue-500 resize-none"
                    />
                  </div>

                  {/* Agendamento de Visita */}
                  <div className="space-y-1.5 col-span-2 bg-slate-950/40 p-4 border border-slate-800/80 rounded-2xl mt-2 animate-fadeIn">
                    <label className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar size={14} />
                      Agendamento de Visita (Opcional)
                    </label>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                      {/* Property to Visit */}
                      <div className="space-y-1 md:col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Imóvel da Visita</label>
                        <select
                          value={formData.visitPropertyId || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData(prev => ({
                              ...prev,
                              visitPropertyId: val,
                              visitStatus: val ? (prev.visitStatus || 'agendado') : undefined
                            }));
                          }}
                          className="w-full bg-slate-905 border border-slate-800 text-slate-100 px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                        >
                          <option value="" className="bg-slate-900">-- Sem visita agendada --</option>
                          {properties.map(p => (
                            <option key={p.id} value={p.id} className="bg-slate-900">
                              {p.address} ({p.neighborhood || 'Bairro'}) - {formatCurrency(p.rentValue)}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Visit Date */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Data da Visita</label>
                        <input
                          type="date"
                           value={formData.visitDate || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, visitDate: e.target.value }))}
                          className="w-full bg-slate-905 border border-slate-800 text-slate-100 px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      {/* Visit Time */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Horário da Visita</label>
                        <input
                          type="time"
                          value={formData.visitTime || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, visitTime: e.target.value }))}
                          className="w-full bg-slate-905 border border-slate-800 text-slate-100 px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    {/* Visit Status Selection (only if a property or a date is selected) */}
                    {(formData.visitPropertyId || formData.visitDate) && (
                      <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-indigo-950/20 border border-indigo-900/30 rounded-xl">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Status do Agendamento:</span>
                        <div className="flex gap-2">
                          {(['agendado', 'realizado', 'cancelado'] as const).map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, visitStatus: s }))}
                              className={cn(
                                "px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wide border transition-all",
                                formData.visitStatus === s
                                  ? s === 'agendado'
                                    ? "bg-yellow-500/15 border-yellow-500/30 text-yellow-500"
                                    : s === 'realizado'
                                      ? "bg-green-500/15 border-green-500/30 text-green-500"
                                      : "bg-red-500/15 border-red-500/30 text-red-500"
                                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300"
                              )}
                            >
                              {s === 'agendado' ? 'Agendada' : s === 'realizado' ? 'Realizada' : 'Cancelada'}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit button */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-800 px-5 py-2.5 rounded-xl font-semibold transition-colors text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-semibold transition-colors text-sm shadow-md"
                  >
                    Salvar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm Deletion Modal */}
      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Remover Interessado"
        message="Tem certeza que deseja excluir este interessado da lista de espera? Esta ação não pode ser desfeita."
        confirmText="Confirmar Exclusão"
        type="danger"
      />
    </div>
  );
};
