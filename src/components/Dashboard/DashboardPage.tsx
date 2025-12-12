import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  FileText, 
  DollarSign, 
  AlertTriangle, 
  AlertOctagon,
  CheckCircle, 
  Clock, 
  FolderOpen,
  TrendingUp,
  Plus,
  Bell,
  X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MetricCard from './MetricCard';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseDateFromDB, formatDateForDisplay, compareDates } from '../../utils/dateUtils';

interface Metrics {
  totalContracts: number;
  activeContracts: number;
  expiringContracts: number;
  overdueContracts: number;
  totalValue: number;
  documentsCount: number;
  totalAddendums: number;
  expiringAddendums: number;
}

interface Contract {
  id: string;
  number: string;
  contractor: string;
  end_date: string;
  status: string;
  value: number;
}

interface Notification {
  id: string;
  type: 'warning' | 'info' | 'success' | 'error';
  title: string;
  message: string;
  date: Date;
  read: boolean;
  link?: string; // Added link for navigation
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<Metrics>({
    totalContracts: 0,
    activeContracts: 0,
    expiringContracts: 0,
    overdueContracts: 0,
    totalValue: 0,
    documentsCount: 0,
    totalAddendums: 0,
    expiringAddendums: 0,
  });
  const [expiringContracts, setExpiringContracts] = useState<Contract[]>([]);
  const [overdueContracts, setOverdueContracts] = useState<Contract[]>([]);
  const [contractNewEndDates, setContractNewEndDates] = useState<{[key: string]: string}>({});
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const notificationButtonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; right: number } | null>(null);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);

      // Buscar dados em paralelo para melhor performance
      const [contractsResult, documentsResult, addendumsResult] = await Promise.all([
        supabase.from('contracts').select('id, number, contractor, status, value, end_date'),
        supabase.from('documents').select('id'),
        supabase.from('addendums').select(`
          id, 
          type, 
          new_end_date, 
          date, 
          contract_id,
          value,
          contract:contracts(status)
        `).not('contract_id', 'is', null),
      ]);

      const contracts = contractsResult.data || [];
      const documents = documentsResult.data || [];
      const addendums = addendumsResult.data || [];

      // Calcular contratos vencendo em 30 dias
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Zerar horas para comparação precisa
      
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(today.getDate() + 30);
      thirtyDaysFromNow.setHours(23, 59, 59, 999); // Fim do dia
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(today.getDate() - 30);
      thirtyDaysAgo.setHours(0, 0, 0, 0);

      // Criar mapa de novos prazos dos contratos (sempre pegar o MAIS RECENTE)
      const contractNewEndDatesMap: {[key: string]: string} = {};
      addendums.forEach(addendum => {
        // Considera tanto aditivos de prazo quanto apostilamentos de vigência
        if ((addendum.type === 'prazo' || addendum.type === 'vigencia') && addendum.new_end_date && addendum.contract_id) {
          // Se já existe uma data para este contrato, verificar qual é mais recente
          if (!contractNewEndDatesMap[addendum.contract_id] || 
              compareDates(addendum.new_end_date, contractNewEndDatesMap[addendum.contract_id]) > 0) {
            contractNewEndDatesMap[addendum.contract_id] = addendum.new_end_date;
          }
        }
      });
      
      // Armazenar o mapa para uso na renderização
      setContractNewEndDates(contractNewEndDatesMap);

      const expiring = contracts.filter(contract => {
        if (contract.status !== 'ativo') return false;
        
        // Usar o novo prazo se houver aditivo de prazo, senão usar o prazo original
        const endDate = contractNewEndDatesMap[contract.id] || contract.end_date;
        if (!endDate) return false;
        
        // Parse da data no formato correto (YYYY-MM-DD do banco)
        const contractEndDate = parseDateFromDB(endDate);
        contractEndDate.setHours(0, 0, 0, 0); // Zerar horas para comparação precisa
        
        // Verifica se vence ENTRE hoje e 30 dias
        const isUpcoming = contractEndDate >= today && contractEndDate <= thirtyDaysFromNow;
        // Também sinaliza contratos ATIVOS que expiraram nos últimos 30 dias (atrasados)
        const isRecentlyExpired = contractEndDate < today && contractEndDate >= thirtyDaysAgo;
        return isUpcoming || isRecentlyExpired;
      }).sort((a, b) => {
        // Ordenar por data de vencimento: mais próximos primeiro
        const dateA = parseDateFromDB(contractNewEndDatesMap[a.id] || a.end_date);
        const dateB = parseDateFromDB(contractNewEndDatesMap[b.id] || b.end_date);
        return dateA.getTime() - dateB.getTime();
      });

      const overdue = contracts.filter(contract => {
        if (contract.status !== 'ativo') return false;

        const endDate = contractNewEndDatesMap[contract.id] || contract.end_date;
        if (!endDate) return false;

        const contractEndDate = parseDateFromDB(endDate);
        contractEndDate.setHours(0, 0, 0, 0);

        return contractEndDate < thirtyDaysAgo;
      });

      // Calcular métricas
      const totalContracts = contracts.length;
      const activeContracts = contracts.filter(c => c.status === 'ativo').length;
      
      // Valor total: soma dos valores dos contratos ativos + aditivos de valor de contratos ativos
      const contractsValue = contracts
        .filter(c => c.status === 'ativo')
        .reduce((sum, c) => sum + (c.value || 0), 0);
      
      const addendumsValue = addendums
        .filter((a: any) => {
          if (a.type !== 'valor' || !a.value) return false;
          // contract é um objeto único, não array
          const contractStatus = a.contract && typeof a.contract === 'object' && !Array.isArray(a.contract) 
            ? (a.contract as any).status 
            : null;
          return contractStatus === 'ativo';
        })
        .reduce((sum, a: any) => sum + (a.value || 0), 0);
      
      const totalValue = contractsValue + addendumsValue;
      const totalAddendums = addendums.length;
      
      // Calcular aditivos vencendo (aditivos de prazo e apostilamentos de vigência que vençam nos próximos 30 dias)
      // Apenas de contratos ativos
      const expiringAddendumsCount = addendums.filter((addendum: any) => {
        // Desconsiderar se o contrato não está ativo
        const contractStatus = addendum.contract && typeof addendum.contract === 'object' && !Array.isArray(addendum.contract)
          ? (addendum.contract as any).status
          : null;
        if (contractStatus !== 'ativo') return false;
        
        if ((addendum.type !== 'prazo' && addendum.type !== 'vigencia') || !addendum.new_end_date) return false;
        
        const endDate = parseDateFromDB(addendum.new_end_date);
        
        // Verifica se vence ENTRE hoje e 30 dias
        return endDate >= today && endDate <= thirtyDaysFromNow;
      }).length;

      setMetrics({
        totalContracts,
        activeContracts,
        expiringContracts: expiring.length,
        overdueContracts: overdue.length,
        totalValue,
        documentsCount: documents.length,
        totalAddendums,
        expiringAddendums: expiringAddendumsCount,
      });

      setExpiringContracts(expiring);
      setOverdueContracts(overdue);

      // Gerar notificações baseadas nos dados
      generateNotifications(expiring.length, overdue.length, activeContracts, expiringAddendumsCount);
    } catch (error) {
      console.error('Erro ao buscar dados do dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateNotifications = (expiring: number, overdue: number, activeContracts: number, expiringAddendums: number) => {
    const notifications: Notification[] = [];

    if (expiring > 0) {
      notifications.push({
        id: 'expiring-contracts',
        title: 'Contratos Expirando',
        message: `${expiring} contrato(s) expira(m) em 30 dias`,
        type: 'warning',
        date: new Date(),
        read: false,
        link: '/contracts?filter=expiring'
      });
    }

    if (overdue > 0) {
      notifications.push({
        id: 'overdue-contracts',
        title: 'Contratos Vencidos +30 dias',
        message: `${overdue} contrato(s) estão vencidos há mais de 30 dias`,
        type: 'error',
        date: new Date(),
        read: false,
        link: '/contracts?filter=overdue'
      });
    }

    if (expiringAddendums > 0) {
      notifications.push({
        id: 'expiring-addendums',
        title: 'Termos Aditivos e Apostilamentos Vencendo',
        message: `${expiringAddendums} termo(s) aditivo(s)/apostilamento(s) vence(m) em 30 dias`,
        type: 'warning',
        date: new Date(),
        read: false,
        link: '/addendums?filter=expiring'
      });
    }

    if (activeContracts === 0) {
      notifications.push({
        id: 'no-active-contracts',
        title: 'Nenhum Contrato Ativo',
        message: 'Não há contratos ativos no sistema',
        type: 'info',
        date: new Date(),
        read: false,
        link: '/contracts'
      });
    }

    setNotifications(notifications);
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const formatCurrency = useMemo(() => {
    return (value: number) => {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(value);
    };
  }, []);

  const unreadNotifications = notifications.filter(n => !n.read).length;

  const markNotificationAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const handleNotificationToggle = () => {
    if (!showNotifications && notificationButtonRef.current) {
      const rect = notificationButtonRef.current.getBoundingClientRect();
      const dropdownWidth = 384; // w-96 = 384px
      const spaceFromRight = window.innerWidth - rect.right;
      
      // Se não houver espaço suficiente à direita, posiciona à esquerda do botão
      const right = spaceFromRight >= dropdownWidth 
        ? window.innerWidth - rect.right 
        : window.innerWidth - rect.left;
      
      setDropdownPosition({
        top: Math.min(rect.bottom + 8, window.innerHeight - 200), // Evita sair da tela
        right: right,
      });
    }
    setShowNotifications(!showNotifications);
  };

  // Fechar notificações ao clicar fora
  useEffect(() => {
    if (!showNotifications) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (notificationButtonRef.current && !notificationButtonRef.current.contains(event.target as Node)) {
        const dropdown = document.getElementById('notifications-dropdown');
        if (dropdown && !dropdown.contains(event.target as Node)) {
          setShowNotifications(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'info':
        return <Clock className="h-5 w-5 text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertOctagon className="h-5 w-5 text-red-500" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:space-x-4">
          <div className="text-xs sm:text-sm text-gray-500">
            Última atualização: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </div>
          
          {/* Notifications Bell */}
          <div className="relative pr-2 pt-1">
            <button
              ref={notificationButtonRef}
              onClick={handleNotificationToggle}
              className="notification-button relative p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all bg-white rounded-lg border border-gray-300 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label="Notificações"
              aria-expanded={showNotifications}
            >
              <Bell className="h-5 w-5" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-md animate-pulse">
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </span>
              )}
            </button>

            {/* Notifications Dropdown - usando Portal para evitar corte */}
            {showNotifications && dropdownPosition && createPortal(
              <>
                {/* Overlay para fechar ao clicar fora */}
                <div
                  className="fixed inset-0 z-40 bg-black/5"
                  onClick={() => setShowNotifications(false)}
                ></div>
                <div
                  id="notifications-dropdown"
                  className="fixed w-80 sm:w-96 bg-white rounded-lg shadow-2xl border border-gray-200 z-50 max-h-[calc(100vh-8rem)] flex flex-col"
                  style={{
                    top: `${dropdownPosition.top}px`,
                    right: `${dropdownPosition.right}px`,
                  }}
                >
                  {/* Header */}
                  <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-gray-50 to-gray-100 rounded-t-lg">
                    <div className="flex items-center space-x-2">
                      <Bell className="h-5 w-5 text-blue-600" />
                      <h3 className="text-lg font-semibold text-gray-900">Notificações</h3>
                      {unreadNotifications > 0 && (
                        <span className="px-2 py-0.5 bg-blue-500 text-white text-xs font-bold rounded-full">
                          {unreadNotifications}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setShowNotifications(false)}
                      className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition-colors"
                      aria-label="Fechar notificações"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  
                  {/* Notifications List */}
                  <div className="overflow-y-auto flex-1 min-h-0">
                    {notifications.length > 0 ? (
                      notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={`p-4 border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors ${
                            !notification.read ? 'bg-blue-50/50' : 'bg-white'
                          }`}
                          onClick={() => {
                            markNotificationAsRead(notification.id);
                            if (notification.link) {
                              setShowNotifications(false);
                              navigate(notification.link);
                            }
                          }}
                        >
                          <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0 mt-0.5">
                              {getNotificationIcon(notification.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <h4 className="text-sm font-semibold text-gray-900">
                                  {notification.title}
                                </h4>
                                {!notification.read && (
                                  <div className="h-2 w-2 bg-blue-500 rounded-full flex-shrink-0 mt-1 animate-pulse"></div>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 mt-1 break-words">
                                {notification.message}
                              </p>
                              <p className="text-xs text-gray-400 mt-2">
                                {format(notification.date, 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center">
                        <Bell className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">Nenhuma notificação</p>
                        <p className="text-sm text-gray-400 mt-1">Você está em dia!</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Footer */}
                  {notifications.length > 0 && (
                    <div className="p-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
                      <button
                        onClick={() => {
                          setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                        }}
                        className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium py-2 hover:bg-blue-50 rounded transition-colors"
                      >
                        Marcar todas como lidas
                      </button>
                    </div>
                  )}
                </div>
              </>,
              document.body
            )}
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        <div className="metric-card-total">
          <MetricCard
            title="Total de Contratos"
            value={metrics.totalContracts}
            icon={FileText}
            color="blue"
            onClick={() => navigate('/contracts')}
          />
        </div>
        <MetricCard
          title="Contratos Ativos"
          value={metrics.activeContracts}
          icon={CheckCircle}
          color="green"
          onClick={() => navigate('/contracts?status=ativo')}
        />
        <MetricCard
          title="Valor Total"
          value={formatCurrency(metrics.totalValue)}
          icon={DollarSign}
          color="purple"
          onClick={() => navigate('/contracts')}
        />
        <MetricCard
          title="Vencendo em 30 dias"
          value={metrics.expiringContracts}
          icon={AlertTriangle}
          color="yellow"
          onClick={() => navigate('/contracts?filter=expiring')}
        />
        <MetricCard
          title="Vencidos +30 dias"
          value={metrics.overdueContracts}
          icon={AlertOctagon}
          color="red"
          onClick={() => navigate('/contracts?filter=overdue')}
        />
        {/* Removido: Empenhos Pendentes */}
        <MetricCard
          title="Documentos"
          value={metrics.documentsCount}
          icon={FolderOpen}
          color="blue"
          onClick={() => navigate('/documents')}
        />
        <MetricCard
          title="Termos Aditivos e Apostilamentos"
          value={metrics.totalAddendums}
          icon={FileText}
          color="purple"
          onClick={() => navigate('/addendums')}
        />
        {metrics.expiringAddendums > 0 && (
          <MetricCard
            title="Aditivos/Apostilamentos Vencendo"
            value={metrics.expiringAddendums}
            icon={AlertTriangle}
            color="red"
            onClick={() => navigate('/addendums?filter=expiring')}
          />
        )}
      </div>

      {/* Alerts and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
        {/* Expiring Contracts Alert */}
        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5 lg:p-6">
          <div className="flex items-center space-x-1.5 sm:space-x-2 mb-3 sm:mb-4">
            <AlertTriangle className="h-4 sm:h-5 w-4 sm:w-5 text-amber-500" />
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Contratos Vencendo</h3>
          </div>
          
          {expiringContracts.length > 0 ? (
            <div className="space-y-2 sm:space-y-3 max-h-64 overflow-y-auto">
              {expiringContracts.map((contract) => {
                // Usar o novo prazo se houver aditivo de prazo, senão usar o prazo original
                const endDateStr = contractNewEndDates[contract.id] || contract.end_date;
                const endDate = parseDateFromDB(endDateStr);
                endDate.setHours(0, 0, 0, 0);
                
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                const daysLeft = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                
                return (
                  <div key={contract.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 sm:gap-2 p-2 sm:p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm sm:text-base font-medium text-gray-900 truncate">{contract.number}</p>
                      <p className="text-xs sm:text-sm text-gray-600 truncate">{contract.contractor}</p>
                    </div>
                    <div className="text-left sm:text-right flex-shrink-0">
                      <p className="text-xs sm:text-sm font-medium text-amber-700">
                        {daysLeft > 0 ? `${daysLeft} dias restantes` : daysLeft === 0 ? 'Vence hoje' : `${Math.abs(daysLeft)} dias atrasado`}
                      </p>
                      <p className="text-[10px] sm:text-xs text-gray-500">
                        {formatDateForDisplay(endDateStr)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Nenhum contrato vencendo nos próximos 30 dias</p>
          )}
        </div>

        {overdueContracts.length > 0 && (
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5 lg:p-6">
            <div className="flex items-center space-x-1.5 sm:space-x-2 mb-3 sm:mb-4">
              <AlertOctagon className="h-4 sm:h-5 w-4 sm:w-5 text-red-500" />
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">Contratos Vencidos +30 dias</h3>
            </div>

            <div className="space-y-2 sm:space-y-3 max-h-64 overflow-y-auto">
              {overdueContracts.map((contract) => {
                const endDateStr = contractNewEndDates[contract.id] || contract.end_date;
                const endDate = parseDateFromDB(endDateStr);
                endDate.setHours(0, 0, 0, 0);

                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const daysOverdue = Math.ceil((today.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));

                return (
                  <div key={contract.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 sm:gap-2 p-2 sm:p-3 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm sm:text-base font-medium text-gray-900 truncate">{contract.number}</p>
                      <p className="text-xs sm:text-sm text-gray-600 truncate">{contract.contractor}</p>
                    </div>
                    <div className="text-left sm:text-right flex-shrink-0">
                      <p className="text-xs sm:text-sm font-medium text-red-700">
                        {daysOverdue} dia(s) vencido(s)
                      </p>
                      <p className="text-[10px] sm:text-xs text-gray-500">
                        Prazo encerrado em {formatDateForDisplay(endDateStr)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-xs sm:text-sm text-red-600 mt-3">
              Revise e altere o status para suspenso quando necessário.
            </p>
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5 lg:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Ações Rápidas</h3>
          <div className="space-y-2 sm:space-y-3">
            <button 
              onClick={() => navigate('/contracts')}
              className="w-full flex items-center space-x-2 sm:space-x-3 p-2 sm:p-3 text-left hover:bg-blue-50 rounded-lg transition-colors border border-gray-200 hover:border-blue-300"
            >
              <div className="bg-blue-100 p-1.5 sm:p-2 rounded-lg">
                <FileText className="h-3.5 sm:h-4 w-3.5 sm:w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm sm:text-base font-medium text-gray-900">Novo Contrato</p>
                <p className="text-xs sm:text-sm text-gray-500">Cadastrar um novo contrato</p>
              </div>
            </button>
            
            {/* Removido: Registro de Empenho */}
            
            <button 
              onClick={() => navigate('/addendums')}
              className="w-full flex items-center space-x-3 p-3 text-left hover:bg-purple-50 rounded-lg transition-colors border border-gray-200 hover:border-purple-300"
            >
              <div className="bg-purple-100 p-2 rounded-lg">
                <Plus className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Criar Aditivo</p>
                <p className="text-sm text-gray-500">Aditivos e apostilamentos</p>
              </div>
            </button>

            <button 
              onClick={() => navigate('/documents')}
              className="w-full flex items-center space-x-3 p-3 text-left hover:bg-indigo-50 rounded-lg transition-colors border border-gray-200 hover:border-indigo-300"
            >
              <div className="bg-indigo-100 p-2 rounded-lg">
                <FolderOpen className="h-4 w-4 text-indigo-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Upload Documento</p>
                <p className="text-sm text-gray-500">Gerenciar documentos</p>
              </div>
            </button>
            
            <button 
              onClick={() => navigate('/reports')}
              className="w-full flex items-center space-x-3 p-3 text-left hover:bg-orange-50 rounded-lg transition-colors border border-gray-200 hover:border-orange-300"
            >
              <div className="bg-orange-100 p-2 rounded-lg">
                <TrendingUp className="h-4 w-4 text-orange-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Gerar Relatório</p>
                <p className="text-sm text-gray-500">Relatórios de contratos</p>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5 lg:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Atividade Recente</h3>
          <button 
            onClick={() => fetchDashboardData()}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Atualizar
          </button>
        </div>
        
        {metrics.totalContracts === 0 ? (
          <div className="text-center py-8">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-gray-500">Nenhuma atividade ainda</p>
            <p className="text-sm text-gray-400">Comece cadastrando seu primeiro contrato</p>
            <button
              onClick={() => navigate('/contracts')}
              className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Criar Primeiro Contrato
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="bg-blue-100 p-2 rounded-full">
                <FileText className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Sistema inicializado com sucesso</p>
                <p className="text-xs text-gray-500">
                  {metrics.totalContracts} contratos, {metrics.activeContracts} contratos ativos
                </p>
                <p className="text-xs text-gray-500">Agora</p>
              </div>
            </div>

            {expiringContracts.length > 0 && (
              <div className="flex items-start space-x-3">
                <div className="bg-yellow-100 p-2 rounded-full">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Contratos próximos do vencimento detectados</p>
                  <p className="text-xs text-gray-500">
                    {expiringContracts.length} contrato(s) vencem nos próximos 30 dias
                  </p>
                  <p className="text-xs text-gray-500">Há poucos minutos</p>
                </div>
              </div>
            )}

            {overdueContracts.length > 0 && (
              <div className="flex items-start space-x-3">
                <div className="bg-red-100 p-2 rounded-full">
                  <AlertOctagon className="h-4 w-4 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Contratos vencidos há mais de 30 dias identificados</p>
                  <p className="text-xs text-gray-500">
                    {overdueContracts.length} contrato(s) requer(em) atualização de status
                  </p>
                  <p className="text-xs text-gray-500">Analise e ajuste para suspenso quando aplicável</p>
                </div>
              </div>
            )}

            <div className="flex items-start space-x-3">
              <div className="bg-green-100 p-2 rounded-full">
                <CheckCircle className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Dashboard atualizado</p>
                <p className="text-xs text-gray-500">Dados sincronizados com o banco</p>
                <p className="text-xs text-gray-500">
                  {format(new Date(), 'HH:mm', { locale: ptBR })}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}