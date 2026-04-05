import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Property, Client } from '../types';
import { 
  Database, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  Download, 
  Upload,
  Search,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useAuth } from '../components/AuthGuard';

export const Recovery: React.FC = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<{ success: boolean; message: string } | null>(null);
  const { isAdmin } = useAuth();

  useEffect(() => {
    const unsubProperties = onSnapshot(collection(db, 'properties'), (s) => {
      setProperties(s.docs.map(d => ({ id: d.id, ...d.data() } as Property)));
    }, (e) => {
      handleFirestoreError(e, OperationType.LIST, 'properties');
    });

    const unsubClients = onSnapshot(collection(db, 'clients'), (s) => {
      setClients(s.docs.map(d => ({ id: d.id, ...d.data() } as Client)));
      setLoading(false);
    }, (e) => {
      handleFirestoreError(e, OperationType.LIST, 'clients');
    });

    return () => {
      unsubProperties();
      unsubClients();
    };
  }, []);

  const legacyProperties = properties.filter(p => p.address && !p.street);
  const legacyClients = clients.filter(c => c.address && !c.street);
  const totalLegacy = legacyProperties.length + legacyClients.length;

  const parseAddress = (address: string) => {
    const parts = address.split(',').map(p => p.trim());
    return {
      street: parts[0] || '',
      number: parts[1] || '',
      neighborhood: parts[2] || '',
      city: parts[3] || '',
      zipCode: parts[4] || ''
    };
  };

  const handleMigrateAll = async () => {
    if (!isAdmin || migrating) return;
    setMigrating(true);
    setMigrationStatus(null);

    try {
      const batch = writeBatch(db);
      let count = 0;

      // Migrate Properties
      legacyProperties.forEach(p => {
        const updates = parseAddress(p.address);
        batch.update(doc(db, 'properties', p.id), updates);
        count++;
      });

      // Migrate Clients
      legacyClients.forEach(c => {
        const updates = parseAddress(c.address!);
        batch.update(doc(db, 'clients', c.id), updates);
        count++;
      });

      if (count > 0) {
        await batch.commit();
        setMigrationStatus({ 
          success: true, 
          message: `${count} registros foram migrados com sucesso para o novo formato de endereço.` 
        });
      } else {
        setMigrationStatus({ 
          success: true, 
          message: "Nenhum registro pendente de migração encontrado." 
        });
      }
    } catch (error) {
      console.error("Migration error:", error);
      setMigrationStatus({ 
        success: false, 
        message: "Ocorreu um erro durante a migração. Verifique o console para mais detalhes." 
      });
    } finally {
      setMigrating(false);
    }
  };

  const handleExportBackup = () => {
    const data = {
      properties,
      clients,
      timestamp: new Date().toISOString(),
      version: '1.1'
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_imobiliaria_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !isAdmin) return;

    setImporting(true);
    setMigrationStatus(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);

        if (!data.properties && !data.clients) {
          throw new Error("Formato de arquivo inválido. O arquivo deve conter 'properties' ou 'clients'.");
        }

        const batch = writeBatch(db);
        let count = 0;

        // Import Properties
        if (Array.isArray(data.properties)) {
          data.properties.forEach((p: any) => {
            const { id, ...rest } = p;
            const newDocRef = doc(collection(db, 'properties'));
            batch.set(newDocRef, rest);
            count++;
          });
        }

        // Import Clients
        if (Array.isArray(data.clients)) {
          data.clients.forEach((c: any) => {
            const { id, ...rest } = c;
            const newDocRef = doc(collection(db, 'clients'));
            batch.set(newDocRef, rest);
            count++;
          });
        }

        if (count > 0) {
          await batch.commit();
          setMigrationStatus({ 
            success: true, 
            message: `${count} registros foram importados com sucesso para o banco de dados.` 
          });
        } else {
          setMigrationStatus({ 
            success: true, 
            message: "Nenhum registro encontrado para importar." 
          });
        }
      } catch (error) {
        console.error("Import error:", error);
        setMigrationStatus({ 
          success: false, 
          message: error instanceof Error ? error.message : "Erro ao importar arquivo. Verifique o formato." 
        });
      } finally {
        setImporting(false);
        // Clear input
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Database className="text-blue-500" />
            Sistema de Recuperação e Manutenção
          </h1>
          <p className="text-slate-400">Gerencie a integridade dos dados e migrações de sistema</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Migration Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-sm space-y-6"
        >
          <div className="flex items-start justify-between">
            <div className="p-3 bg-blue-900/20 rounded-xl text-blue-400">
              <RefreshCw className={cn(migrating && "animate-spin")} size={24} />
            </div>
            {totalLegacy > 0 && (
              <span className="px-3 py-1 bg-amber-900/30 text-amber-400 rounded-full text-xs font-bold uppercase tracking-wider">
                {totalLegacy} Pendentes
              </span>
            )}
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-100">Migração de Endereços</h2>
            <p className="text-sm text-slate-400 mt-1">
              Converte endereços de texto simples para o novo formato estruturado (Rua, Número, Bairro, etc).
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Imóveis Legados</span>
              <span className="text-slate-300 font-medium">{legacyProperties.length}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Clientes Legados</span>
              <span className="text-slate-300 font-medium">{legacyClients.length}</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-500" 
                style={{ width: `${totalLegacy === 0 ? 100 : Math.max(0, 100 - (totalLegacy / (properties.length + clients.length || 1) * 100))}%` }}
              />
            </div>
          </div>

          <button
            onClick={handleMigrateAll}
            disabled={totalLegacy === 0 || migrating || !isAdmin}
            className={cn(
              "w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all",
              totalLegacy > 0 && !migrating && isAdmin
                ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20"
                : "bg-slate-800 text-slate-500 cursor-not-allowed"
            )}
          >
            {migrating ? "Processando..." : "Migrar Todos os Registros"}
            {!migrating && <ArrowRight size={18} />}
          </button>
        </motion.div>

        {/* Backup Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-sm space-y-6"
        >
          <div className="flex items-start justify-between">
            <div className="p-3 bg-emerald-900/20 rounded-xl text-emerald-400">
              <ShieldCheck size={24} />
            </div>
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-100">Backup de Segurança</h2>
            <p className="text-sm text-slate-400 mt-1">
              Exporte todos os dados do sistema para um arquivo JSON seguro. Recomendado antes de grandes alterações.
            </p>
          </div>

          <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-800">
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <CheckCircle2 className="text-emerald-500" size={16} />
              <span>Banco de dados conectado</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-300 mt-2">
              <CheckCircle2 className="text-emerald-500" size={16} />
              <span>{properties.length + clients.length} registros totais</span>
            </div>
          </div>

          <button
            onClick={handleExportBackup}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/20"
          >
            <Download size={18} />
            Exportar Backup (JSON)
          </button>

          <div className="relative">
            <input
              type="file"
              accept=".json"
              onChange={handleImportBackup}
              className="hidden"
              id="import-backup"
              disabled={importing || !isAdmin}
            />
            <label
              htmlFor="import-backup"
              className={cn(
                "w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all cursor-pointer border-2 border-dashed",
                importing || !isAdmin
                  ? "bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed"
                  : "bg-slate-900 border-slate-800 hover:border-blue-500 text-slate-300 hover:text-blue-400"
              )}
            >
              <Upload size={18} className={cn(importing && "animate-bounce")} />
              {importing ? "Importando..." : "Importar Backup (JSON)"}
            </label>
          </div>
        </motion.div>
      </div>

      {/* Status Messages */}
      <AnimatePresence>
        {migrationStatus && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={cn(
              "p-4 rounded-xl border flex items-center gap-3",
              migrationStatus.success 
                ? "bg-green-900/10 border-green-900/20 text-green-400" 
                : "bg-red-900/10 border-red-900/20 text-red-400"
            )}
          >
            {migrationStatus.success ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
            <p className="text-sm font-medium">{migrationStatus.message}</p>
            <button 
              onClick={() => setMigrationStatus(null)}
              className="ml-auto text-xs font-bold uppercase tracking-wider hover:underline"
            >
              Fechar
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Details List */}
      {totalLegacy > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden"
        >
          <div className="p-4 border-b border-slate-800 bg-slate-800/30">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Registros Pendentes de Migração</h3>
          </div>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-900 sticky top-0">
                <tr>
                  <th className="px-6 py-3">Tipo</th>
                  <th className="px-6 py-3">Nome/Endereço</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {legacyProperties.map(p => (
                  <tr key={p.id} className="text-sm">
                    <td className="px-6 py-4 text-blue-400 font-medium">Imóvel</td>
                    <td className="px-6 py-4 text-slate-300">{p.address}</td>
                    <td className="px-6 py-4">
                      <span className="text-amber-500 flex items-center gap-1">
                        <AlertTriangle size={14} />
                        Legado
                      </span>
                    </td>
                  </tr>
                ))}
                {legacyClients.map(c => (
                  <tr key={c.id} className="text-sm">
                    <td className="px-6 py-4 text-green-400 font-medium">Cliente</td>
                    <td className="px-6 py-4 text-slate-300">{c.name}</td>
                    <td className="px-6 py-4">
                      <span className="text-amber-500 flex items-center gap-1">
                        <AlertTriangle size={14} />
                        Legado
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
};
