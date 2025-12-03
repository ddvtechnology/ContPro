import { useState, useEffect } from 'react';
import { User, LogOut, FileSpreadsheet, BookOpen } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import ProfileModal from '../Users/ProfileModal';
import ImportContractsModal from '../Contracts/ImportContractsModal';
import InteractiveTour from '../Tutorial/InteractiveTour';

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatDateTime = () => {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'America/Sao_Paulo',
      weekday: 'long',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    };
    
    const dateTime = new Intl.DateTimeFormat('pt-BR', options).formatToParts(currentTime);
    
    const weekday = dateTime.find(part => part.type === 'weekday')?.value || '';
    const month = dateTime.find(part => part.type === 'month')?.value || '';
    const hour = dateTime.find(part => part.type === 'hour')?.value || '';
    const minute = dateTime.find(part => part.type === 'minute')?.value || '';
    const second = dateTime.find(part => part.type === 'second')?.value || '';
    
    return {
      weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1),
      month: month.charAt(0).toUpperCase() + month.slice(1),
      time: `${hour}:${minute}:${second}`
    };
  };

  const { weekday, month, time } = formatDateTime();
  const userName = user?.name || 'Usuário';

  const handleLogout = async () => {
    await logout();
    setShowUserMenu(false);
  };

  return (
    <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2 sm:space-x-4">
          <div className="flex flex-col">
            <h1 className="text-base sm:text-lg font-semibold text-gray-900">
              <span className="hidden sm:inline">
                Bem-vindo, {userName}! {weekday}, {month} - {time}
              </span>
              <span className="sm:hidden">
                Olá, {userName}! {time}
              </span>
            </h1>
          </div>
        </div>

        <div className="w-full sm:w-auto flex items-center justify-end space-x-2 sm:space-x-4">
          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="user-menu-button flex items-center space-x-2 p-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {user?.avatar ? (
                <img 
                  key={user.avatar} 
                  src={user.avatar} 
                  alt="Avatar" 
                  className="h-8 w-8 rounded-full object-cover"
                  onError={(e) => {
                    // Se a imagem falhar, não fazer nada - o fallback será mostrado no próximo render
                    console.error('Erro ao carregar avatar no header');
                  }}
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-blue-700 font-medium text-sm">
                    {user?.name?.charAt(0) || 'U'}
                  </span>
                </div>
              )}
              <span className="text-sm font-medium hidden sm:inline whitespace-nowrap truncate max-w-[200px]">{user?.name}</span>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 sm:w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                <div className="p-3 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900 whitespace-nowrap truncate">{user?.name}</p>
                  <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                </div>
                
                <div className="py-1">
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      setShowProfile(true);
                    }}
                    className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <User className="mr-3 h-4 w-4" />
                    Perfil
                  </button>
                  
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      setShowImportModal(true);
                    }}
                    className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <FileSpreadsheet className="mr-3 h-4 w-4" />
                    Importar Contratos
                  </button>
                  
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      setShowTutorial(true);
                    }}
                    className="flex items-center w-full px-3 py-2 text-sm text-blue-600 hover:bg-blue-50"
                  >
                    <BookOpen className="mr-3 h-4 w-4" />
                    Tutorial do Sistema
                  </button>
                  
                  <hr className="my-1" />
                  
                  <button
                    onClick={handleLogout}
                    className="flex items-center w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="mr-3 h-4 w-4" />
                    Sair
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de perfil */}
      <ProfileModal isOpen={showProfile} onClose={() => setShowProfile(false)} />
      
      {/* Modal de importação */}
      <ImportContractsModal 
        isOpen={showImportModal} 
        onClose={() => setShowImportModal(false)}
        onImportComplete={() => {
          setShowImportModal(false);
          // Navegar para a página de contratos para ver os dados importados
          if (location.pathname !== '/contracts') {
            navigate('/contracts');
          } else {
            // Se já está na página de contratos, recarregar os dados
            navigate('/contracts', { replace: true });
            window.location.reload();
          }
        }}
      />
      
      {/* Tour interativo */}
      <InteractiveTour 
        isOpen={showTutorial} 
        onClose={() => setShowTutorial(false)} 
      />
    </header>
  );
}