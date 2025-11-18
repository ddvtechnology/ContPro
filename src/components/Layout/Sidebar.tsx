import { NavLink } from 'react-router-dom';
import { 
  Home, 
  FileText,
  FolderOpen, 
  BarChart3,
  LogOut,
  FilePlus
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Contratos', href: '/contracts', icon: FileText },
  { name: 'Termos Aditivos e Apostilamentos', href: '/addendums', icon: FilePlus },
  { name: 'Documentos', href: '/documents', icon: FolderOpen },
  { name: 'Relatórios', href: '/reports', icon: BarChart3 },
];

export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      <div className="flex items-center justify-center h-20 px-3 border-b border-gray-200">
        <img src="/ContPro.svg" alt="Logo" className="h-25 w-auto max-w-full object-contain" />
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              `flex items-start px-2 py-2 text-sm font-medium rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <item.icon className="mr-2 h-5 w-5 flex-shrink-0 mt-0.5" />
            <span className="break-words leading-tight">{item.name}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-gray-200">
        <div className="flex items-center space-x-2 mb-3">
          <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <span className="text-blue-700 font-medium text-sm">
              {user?.name?.charAt(0) || 'U'}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
        </div>
        
          <button 
            onClick={logout}
          className="flex items-center w-full px-2 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
          <LogOut className="mr-2 h-4 w-4" />
            Sair
          </button>
      </div>
    </div>
  );
}