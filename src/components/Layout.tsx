import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Home, 
  Users, 
  FileText, 
  CreditCard, 
  Database,
  LogOut, 
  Menu, 
  X,
  Building2,
  UserCircle
} from 'lucide-react';
import { useAuth } from './AuthGuard';
import { logout } from '../firebase';
import { cn } from '../lib/utils';

interface NavItemProps {
  to: string;
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon: Icon, label, active, onClick }) => (
  <Link
    to={to}
    onClick={onClick}
    className={cn(
      "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
      active 
        ? "bg-blue-600 text-white shadow-md shadow-blue-900/20" 
        : "text-slate-400 hover:bg-slate-800 hover:text-blue-400"
    )}
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
  </Link>
);

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, isAdmin } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/properties', icon: Home, label: 'Imóveis' },
    { to: '/clients', icon: Users, label: 'Clientes' },
    { to: '/contracts', icon: FileText, label: 'Contratos' },
    { to: '/payments', icon: CreditCard, label: 'Financeiro' },
    ...(isAdmin ? [{ to: '/recovery', icon: Database, label: 'Recuperação' }] : []),
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-slate-900 border-r border-slate-800 p-4 sticky top-0 h-screen">
        <div className="flex items-center gap-2 px-4 py-6 mb-4">
          <Building2 className="text-blue-500" size={32} />
          <h1 className="text-xl font-bold text-slate-100">Imobiliária Pro</h1>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => (
            <NavItem 
              key={item.to} 
              {...item} 
              active={location.pathname === item.to} 
            />
          ))}
        </nav>

        <div className="mt-auto pt-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-4 py-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-blue-400">
              <UserCircle size={24} />
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-slate-100 truncate">{profile?.displayName || user?.displayName || 'Usuário'}</p>
              <p className="text-xs text-slate-400 truncate">{isAdmin ? 'Administrador' : 'Usuário'}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full text-left text-slate-400 hover:bg-red-900/20 hover:text-red-400 rounded-lg transition-colors"
          >
            <LogOut size={20} />
            <span className="font-medium">Sair</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between z-50">
        <div className="flex items-center gap-2">
          <Building2 className="text-blue-500" size={24} />
          <h1 className="text-lg font-bold text-slate-100">Imobiliária Pro</h1>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 text-slate-400 hover:bg-slate-800 rounded-lg"
        >
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/70 z-40"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside className={cn(
        "lg:hidden fixed top-0 bottom-0 left-0 w-64 bg-slate-900 z-50 transition-transform duration-300 ease-in-out p-4",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center gap-2 px-4 py-6 mb-4">
          <Building2 className="text-blue-500" size={32} />
          <h1 className="text-xl font-bold text-slate-100">Imobiliária Pro</h1>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => (
            <NavItem 
              key={item.to} 
              {...item} 
              active={location.pathname === item.to} 
              onClick={() => setIsSidebarOpen(false)}
            />
          ))}
        </nav>

        <div className="mt-auto pt-4 border-t border-slate-800 absolute bottom-4 left-4 right-4">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full text-left text-slate-400 hover:bg-red-900/20 hover:text-red-400 rounded-lg transition-colors"
          >
            <LogOut size={20} />
            <span className="font-medium">Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 lg:p-8 mt-16 lg:mt-0 overflow-auto">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
