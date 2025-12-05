import { useState, useEffect } from 'react';
import { Plus, Search, Filter, Eye, Edit2, Trash2, AlertTriangle, AlertOctagon, FileText, X, CheckSquare } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Contract } from '../../types';
import { formatDateForDisplay, parseDateFromDB } from '../../utils/dateUtils';
import ContractForm from './ContractForm';
import ContractDetails from './ContractDetails';
import DeleteConfirmModal from '../Common/DeleteConfirmModal';
import { useLocation, useNavigate } from 'react-router-dom';

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [contractAddendums, setContractAddendums] = useState<{[key: string]: number}>({});
  const [contractExtensions, setContractExtensions] = useState<{[key: string]: any}>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ativo' | 'suspenso' | 'encerrado'>('all');
  const [expiringFilter, setExpiringFilter] = useState(false);
  const [overdueFilter, setOverdueFilter] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [error, setError] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    fetchContracts();
    
    // Aplicar filtros da URL
    const urlParams = new URLSearchParams(location.search);
    const status = urlParams.get('status');
    const filter = urlParams.get('filter');
    
    if (status === 'ativo' || status === 'suspenso' || status === 'encerrado') {
      setStatusFilter(status);
    }
    
    if (filter === 'expiring') {
      setExpiringFilter(true);
      setOverdueFilter(false);
    } else if (filter === 'overdue') {
      setOverdueFilter(true);
      setExpiringFilter(false);
    } else {
      setExpiringFilter(false);
      setOverdueFilter(false);
    }
  }, [location.search]);

  // Limpar seleção quando filtros mudarem
  useEffect(() => {
    setSelectedIds(new Set());
  }, [searchTerm, statusFilter, expiringFilter, overdueFilter]);

  useEffect(() => {
    if (location.state && location.state.contractId && contracts.length > 0) {
      const contract = contracts.find(c => c.id === location.state.contractId);
      if (contract) {
        setSelectedContract(contract);
        setIsDetailsOpen(true);
      }
    }
    // eslint-disable-next-line
  }, [location.state, contracts]);

  const fetchContracts = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      const [contractsResult, addendumsResult] = await Promise.all([
        supabase.from('contracts').select('*').order('created_at', { ascending: false }),
        supabase.from('addendums').select('contract_id, type, new_end_date, date')
      ]);

      if (contractsResult.error) throw contractsResult.error;

      const formattedContracts: Contract[] = (contractsResult.data || []).map(contract => ({
        id: contract.id,
        number: contract.number,
        object: contract.object,
        contractor: contract.contractor,
        value: contract.value,
        startDate: contract.start_date,
        endDate: contract.end_date,
        status: contract.status,
        category: contract.category,
        responsibleUser: contract.created_by || contract.user_id || '', // Usar o campo correto do banco
        createdAt: contract.created_at,
        updatedAt: contract.updated_at
      }));

      // Contar aditivos por contrato
      const addendumsCount: {[key: string]: number} = {};
      const extensionsData: {[key: string]: any} = {};
      
      (addendumsResult.data || []).forEach(addendum => {
        if (addendum.contract_id) {
          addendumsCount[addendum.contract_id] = (addendumsCount[addendum.contract_id] || 0) + 1;
          
          // Armazenar informações de aditivos de prazo
          if (addendum.type === 'prazo' && addendum.new_end_date) {
            extensionsData[addendum.contract_id] = {
              newEndDate: addendum.new_end_date,
              addendumDate: addendum.date
            };
          }
        }
      });

      setContracts(formattedContracts);
      setContractAddendums(addendumsCount);
      setContractExtensions(extensionsData);
    } catch (error: any) {
      console.error('Erro ao buscar contratos:', error);
      setError('Erro ao carregar contratos');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedContract) return;

    try {
      const { error } = await supabase
        .from('contracts')
        .delete()
        .eq('id', selectedContract.id);

      if (error) throw error;

      await fetchContracts();
      setIsDeleteModalOpen(false);
      setSelectedContract(null);
    } catch (error: any) {
      console.error('Erro ao deletar contrato:', error);
      setError('Erro ao deletar contrato');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    try {
      const idsArray = Array.from(selectedIds);
      const { error } = await supabase
        .from('contracts')
        .delete()
        .in('id', idsArray);

      if (error) throw error;

      await fetchContracts();
      setIsBulkDeleteModalOpen(false);
      setSelectedIds(new Set());
    } catch (error: any) {
      console.error('Erro ao deletar contratos:', error);
      setError('Erro ao deletar contratos');
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredContracts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredContracts.map(c => c.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const filteredContracts = contracts.filter(contract => {
    const matchesSearch = 
      contract.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contract.object.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contract.contractor.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || contract.status === statusFilter;
    
    // Filtro de contratos vencendo em 30 dias
    let matchesDateFilter = true;
    if (expiringFilter || overdueFilter) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(today.getDate() + 30);
      thirtyDaysFromNow.setHours(23, 59, 59, 999);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(today.getDate() - 30);
      thirtyDaysAgo.setHours(0, 0, 0, 0);
      
      // Usar o novo prazo se houver aditivo de prazo/vigência
      const endDateStr = contractExtensions[contract.id]?.newEndDate || contract.endDate;
      if (!endDateStr) {
        return false;
      }
      const endDate = parseDateFromDB(endDateStr);
      endDate.setHours(0, 0, 0, 0);
      
      const daysDiff = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (expiringFilter) {
        const isUpcoming = endDate >= today && endDate <= thirtyDaysFromNow;
        const isRecentlyExpired = endDate < today && endDate >= thirtyDaysAgo;
        matchesDateFilter = contract.status === 'ativo' && (isUpcoming || isRecentlyExpired);
      } else if (overdueFilter) {
        matchesDateFilter = contract.status === 'ativo' && daysDiff < -30;
      }
    }
    
    return matchesSearch && matchesStatus && matchesDateFilter;
  });

  const getStatusColor = (status: Contract['status']) => {
    switch (status) {
      case 'ativo':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'suspenso':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'encerrado':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Gestão de Contratos</h1>
        <button 
          onClick={() => {
            setSelectedContract(null);
            setIsFormOpen(true);
          }}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg flex items-center justify-center space-x-1.5 sm:space-x-2 transition-colors"
        >
          <Plus className="h-3.5 sm:h-4 w-3.5 sm:w-4" />
          <span>Novo Contrato</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg flex items-center space-x-2">
          <AlertTriangle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary Cards */}
      {contracts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0 pr-2">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Total</p>
                <p className="text-sm sm:text-lg lg:text-xl font-bold text-blue-600 truncate">{contracts.length}</p>
              </div>
              <div className="bg-blue-100 p-2 sm:p-3 rounded-lg flex-shrink-0">
                <span className="text-blue-600 text-xs sm:text-sm font-medium">Contratos</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0 pr-2">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Ativos</p>
                <p className="text-sm sm:text-lg lg:text-xl font-bold text-green-600 truncate">
                  {contracts.filter(c => c.status === 'ativo').length}
                </p>
              </div>
              <div className="bg-green-100 p-2 sm:p-3 rounded-lg flex-shrink-0">
                <span className="text-green-600 text-xs sm:text-sm font-medium">
                  {Math.round((contracts.filter(c => c.status === 'ativo').length / contracts.length) * 100)}%
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0 pr-2">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Valor Total</p>
                <p className="text-sm sm:text-lg lg:text-xl font-bold text-purple-600 truncate">
                  {formatCurrency(contracts.reduce((sum, c) => sum + c.value, 0))}
                </p>
              </div>
              <div className="bg-purple-100 p-2 sm:p-3 rounded-lg flex-shrink-0">
                <span className="text-purple-600 text-xs sm:text-sm font-medium">Total</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0 pr-2">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Suspensos</p>
                <p className="text-sm sm:text-lg lg:text-xl font-bold text-amber-600 truncate">
                  {contracts.filter(c => c.status === 'suspenso').length}
                </p>
              </div>
              <div className="bg-amber-100 p-2 sm:p-3 rounded-lg flex-shrink-0">
                <span className="text-amber-600 text-xs sm:text-sm font-medium">Atenção</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 lg:p-6">
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:space-y-0 sm:space-x-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 h-3.5 sm:h-4 w-3.5 sm:w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por número, objeto ou contratado..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-1 sm:space-x-2">
            <Filter className="h-3.5 sm:h-4 w-3.5 sm:w-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => {
                const newStatus = e.target.value as any;
                setStatusFilter(newStatus);
                
                // Atualizar URL com o parâmetro de status
                const urlParams = new URLSearchParams(location.search);
                if (newStatus !== 'all') {
                  urlParams.set('status', newStatus);
                } else {
                  urlParams.delete('status');
                }
                
                // Manter filtros de vencimento se estiverem ativos
                if (expiringFilter) {
                  urlParams.set('filter', 'expiring');
                } else if (overdueFilter) {
                  urlParams.set('filter', 'overdue');
                } else {
                  urlParams.delete('filter');
                }
                
                const newSearch = urlParams.toString();
                navigate(`/contracts${newSearch ? `?${newSearch}` : ''}`, { replace: true });
              }}
              className="border border-gray-300 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos os status</option>
              <option value="ativo">Ativo</option>
              <option value="suspenso">Suspenso</option>
              <option value="encerrado">Encerrado</option>
            </select>
          </div>
          
            <button
              onClick={() => {
                const newExpiringFilter = !expiringFilter;
                setExpiringFilter(newExpiringFilter);
                if (newExpiringFilter) {
                  setOverdueFilter(false);
                }
                
                // Atualizar URL com o parâmetro de filtro
                const urlParams = new URLSearchParams(location.search);
                if (newExpiringFilter) {
                  urlParams.set('filter', 'expiring');
                } else {
                  urlParams.delete('filter');
                }
                
                // Manter o status filter se existir
                if (statusFilter !== 'all') {
                  urlParams.set('status', statusFilter);
                } else {
                  urlParams.delete('status');
                }
                
                const newSearch = urlParams.toString();
                navigate(`/contracts${newSearch ? `?${newSearch}` : ''}`, { replace: true });
              }}
              className={`inline-flex items-center justify-center px-2 sm:px-3 py-1.5 sm:py-2 border rounded-lg text-xs sm:text-sm transition-colors ${
                expiringFilter 
                  ? 'border-amber-500 bg-amber-50 text-amber-700 hover:bg-amber-100' 
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <AlertTriangle className="h-3.5 sm:h-4 w-3.5 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Vencendo em 30 dias</span>
              <span className="sm:hidden">30 dias</span>
            </button>

            <button
              onClick={() => {
                const newOverdueFilter = !overdueFilter;
                setOverdueFilter(newOverdueFilter);
                if (newOverdueFilter) {
                  setExpiringFilter(false);
                }

                const urlParams = new URLSearchParams(location.search);
                if (newOverdueFilter) {
                  urlParams.set('filter', 'overdue');
                } else {
                  urlParams.delete('filter');
                }

                if (statusFilter !== 'all') {
                  urlParams.set('status', statusFilter);
                } else {
                  urlParams.delete('status');
                }

                const newSearch = urlParams.toString();
                navigate(`/contracts${newSearch ? `?${newSearch}` : ''}`, { replace: true });
              }}
              className={`inline-flex items-center justify-center px-2 sm:px-3 py-1.5 sm:py-2 border rounded-lg text-xs sm:text-sm transition-colors ${
                overdueFilter
                  ? 'border-red-500 bg-red-50 text-red-700 hover:bg-red-100'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <AlertOctagon className="h-3.5 sm:h-4 w-3.5 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Vencidos +30 dias</span>
              <span className="sm:hidden">+30 dias</span>
            </button>
            
            {(statusFilter !== 'all' || expiringFilter || overdueFilter) && (
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setExpiringFilter(false);
                  setOverdueFilter(false);
                  navigate('/contracts', { replace: true });
                }}
                className="inline-flex items-center justify-center px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <X className="h-3.5 sm:h-4 w-3.5 sm:w-4 mr-0.5 sm:mr-1" />
                Limpar
              </button>
            )}
          </div>
        </div>
        
        {/* Indicadores de filtros ativos */}
        {(statusFilter !== 'all' || expiringFilter || overdueFilter) && (
          <div className="mt-2 sm:mt-3 flex flex-wrap gap-1.5 sm:gap-2">
            {statusFilter !== 'all' && (
              <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium bg-blue-100 text-blue-800">
                Status: {statusFilter}
              </span>
            )}
            {expiringFilter && (
              <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium bg-amber-100 text-amber-800">
                <AlertTriangle className="h-2.5 sm:h-3 w-2.5 sm:w-3 mr-0.5 sm:mr-1" />
                Vencendo em 30 dias
              </span>
            )}
            {overdueFilter && (
              <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium bg-red-100 text-red-800">
                <AlertOctagon className="h-2.5 sm:h-3 w-2.5 sm:w-3 mr-0.5 sm:mr-1" />
                Vencidos +30 dias
              </span>
            )}
          </div>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg sm:rounded-xl p-3 sm:p-4 flex items-center justify-between">
          <span className="text-sm font-medium text-blue-900">
            {selectedIds.size} {selectedIds.size === 1 ? 'contrato selecionado' : 'contratos selecionados'}
          </span>
          <button
            onClick={() => setIsBulkDeleteModalOpen(true)}
            className="bg-red-600 hover:bg-red-700 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg flex items-center space-x-2 text-sm transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            <span>Excluir Selecionados</span>
          </button>
        </div>
      )}

      {/* Contracts Table/Cards */}
      <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase w-10">
                  <button
                    onClick={toggleSelectAll}
                    className="flex items-center justify-center w-5 h-5 border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                    title={selectedIds.size === filteredContracts.length ? 'Desmarcar todos' : 'Selecionar todos'}
                  >
                    {selectedIds.size === filteredContracts.length && filteredContracts.length > 0 ? (
                      <CheckSquare className="h-4 w-4 text-blue-600" />
                    ) : (
                      <div className="w-4 h-4 border-2 border-gray-400 rounded"></div>
                    )}
                  </button>
                </th>
                <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">Contrato</th>
                <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">Objeto</th>
                <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase hidden xl:table-cell">Contratado</th>
                <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">Valor</th>
                <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase hidden 2xl:table-cell">Vigência</th>
                <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">Status</th>
                <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase hidden xl:table-cell">Adit.</th>
                <th className="px-2 py-1.5 text-right text-[10px] font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredContracts.map((contract) => (
                <tr key={contract.id} className={`hover:bg-gray-50 transition-colors ${selectedIds.has(contract.id) ? 'bg-blue-50' : ''}`}>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <button
                      onClick={() => toggleSelect(contract.id)}
                      className="flex items-center justify-center w-5 h-5 border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                    >
                      {selectedIds.has(contract.id) ? (
                        <CheckSquare className="h-4 w-4 text-blue-600" />
                      ) : (
                        <div className="w-4 h-4 border-2 border-gray-400 rounded"></div>
                      )}
                    </button>
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <div className="text-xs font-medium text-gray-900">{contract.number}</div>
                    <div className="text-[10px] text-gray-500">{contract.category}</div>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="text-xs text-gray-900 max-w-[150px] truncate" title={contract.object}>{contract.object}</div>
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-900 hidden xl:table-cell max-w-[120px] truncate">{contract.contractor}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs font-medium text-gray-900">{formatCurrency(contract.value)}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap hidden 2xl:table-cell">
                    <div className="text-[10px] text-gray-900">{formatDateForDisplay(contract.startDate)}</div>
                    <div className="text-[10px] text-gray-900">{formatDateForDisplay(contract.endDate)}</div>
                    {contractExtensions[contract.id] && (
                      <div className="text-[9px] text-blue-600">⏰ {formatDateForDisplay(contractExtensions[contract.id].newEndDate)}</div>
                    )}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded-full border ${getStatusColor(contract.status)}`}>
                      {contract.status.charAt(0).toUpperCase() + contract.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap hidden xl:table-cell">
                    <div className="flex items-center space-x-0.5">
                      <span className="text-xs text-gray-900">{contractAddendums[contract.id] || 0}</span>
                      {contractAddendums[contract.id] > 0 && (
                        <button onClick={() => navigate(`/addendums?contract=${contract.id}`)} className="text-blue-600 hover:text-blue-900 p-0.5 hover:bg-blue-50 rounded" title="Ver termos">
                          <FileText className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end space-x-0.5">
                      <button onClick={() => { setSelectedContract(contract); setIsDetailsOpen(true); }} className="text-blue-600 hover:text-blue-900 p-0.5 hover:bg-blue-50 rounded" title="Ver">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => { setSelectedContract(contract); setIsFormOpen(true); }} className="text-gray-600 hover:text-gray-900 p-0.5 hover:bg-gray-50 rounded" title="Editar">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => { setSelectedContract(contract); setIsDeleteModalOpen(true); }} className="text-red-600 hover:text-red-900 p-0.5 hover:bg-red-50 rounded" title="Excluir">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="lg:hidden divide-y divide-gray-200">
          {filteredContracts.map((contract) => (
            <div key={contract.id} className={`p-4 hover:bg-gray-50 transition-colors ${selectedIds.has(contract.id) ? 'bg-blue-50' : ''}`}>
              <div className="flex justify-between items-start mb-2">
                <button
                  onClick={() => toggleSelect(contract.id)}
                  className="flex items-center justify-center w-5 h-5 border border-gray-300 rounded hover:bg-gray-100 transition-colors mr-2 flex-shrink-0"
                >
                  {selectedIds.has(contract.id) ? (
                    <CheckSquare className="h-4 w-4 text-blue-600" />
                  ) : (
                    <div className="w-4 h-4 border-2 border-gray-400 rounded"></div>
                  )}
                </button>
                <div className="flex-1">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{contract.number}</div>
                    <div className="text-xs text-gray-500">{contract.category}</div>
                  </div>
                </div>
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(contract.status)}`}>
                  {contract.status.charAt(0).toUpperCase() + contract.status.slice(1)}
                </span>
              </div>
              <div className="text-sm text-gray-700 mb-2">{contract.object}</div>
              <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                <div>
                  <div className="text-xs text-gray-500">Contratado</div>
                  <div className="text-gray-900">{contract.contractor}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Valor</div>
                  <div className="font-medium text-gray-900">{formatCurrency(contract.value)}</div>
                </div>
              </div>
              <div className="text-xs text-gray-600 mb-2">
                <span className="font-medium">Vigência:</span> {formatDateForDisplay(contract.startDate)} - {formatDateForDisplay(contract.endDate)}
                {contractExtensions[contract.id] && (
                  <div className="text-blue-600 mt-1">⏰ Prorrogado: {formatDateForDisplay(contractExtensions[contract.id].newEndDate)}</div>
                )}
              </div>
              {contractAddendums[contract.id] > 0 && (
                <div className="text-xs text-gray-600 mb-3">
                  <span className="font-medium">Aditivos:</span> {contractAddendums[contract.id]}
                </div>
              )}
              <div className="flex items-center space-x-2">
                <button onClick={() => { setSelectedContract(contract); setIsDetailsOpen(true); }} className="flex-1 text-blue-600 hover:text-blue-900 px-3 py-2 border border-blue-600 hover:bg-blue-50 rounded text-sm transition-colors">
                  <Eye className="h-4 w-4 inline mr-1" /> Ver
                </button>
                <button onClick={() => { setSelectedContract(contract); setIsFormOpen(true); }} className="flex-1 text-gray-600 hover:text-gray-900 px-3 py-2 border border-gray-300 hover:bg-gray-50 rounded text-sm transition-colors">
                  <Edit2 className="h-4 w-4 inline mr-1" /> Editar
                </button>
                <button onClick={() => { setSelectedContract(contract); setIsDeleteModalOpen(true); }} className="text-red-600 hover:text-red-900 px-3 py-2 border border-red-600 hover:bg-red-50 rounded text-sm transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
        
        {filteredContracts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {contracts.length === 0 
                ? 'Nenhum contrato cadastrado. Clique em "Novo Contrato" para começar.'
                : 'Nenhum contrato encontrado com os filtros aplicados'
              }
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      <ContractForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={fetchContracts}
        contract={selectedContract}
      />

      <ContractDetails
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        contract={selectedContract}
      />

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Excluir Contrato"
        message={`Tem certeza que deseja excluir o contrato ${selectedContract?.number}? Esta ação não pode ser desfeita.`}
      />

      <DeleteConfirmModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        onConfirm={handleBulkDelete}
        title="Excluir Contratos Selecionados"
        message={`Tem certeza que deseja excluir ${selectedIds.size} ${selectedIds.size === 1 ? 'contrato' : 'contratos'}? Esta ação não pode ser desfeita.`}
      />
    </div>
  );
}
