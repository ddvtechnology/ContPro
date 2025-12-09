import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Search, Eye, Edit2, Trash2, FileText, Calendar, DollarSign, Download, X, Clock, CheckSquare, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatDateForDisplay, parseDateFromDB } from '../../utils/dateUtils';
import AddendumForm from './AddendumForm';
import DeleteConfirmModal from '../Common/DeleteConfirmModal';
import ContractSearchSelect from '../Common/ContractSearchSelect';
import { useLocation, useNavigate } from 'react-router-dom';

interface Addendum {
  id: string;
  contract_id: string | null;
  number: string;
  type: 'valor' | 'prazo' | 'vigencia' | 'apostilamento';
  description: string;
  value: number | null;
  new_end_date: string | null;
  date: string;
  contract?: {
    number: string;
    contractor: string;
  };
  documents?: {
    id: string;
    name: string;
    type: string;
    upload_date: string;
    url: string; // Added url for direct download
  }[];
}

export default function AddendumsPage() {
  const [addendums, setAddendums] = useState<Addendum[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [contractFilter, setContractFilter] = useState<string>('');
  const [expiringFilter, setExpiringFilter] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isFilesModalOpen, setIsFilesModalOpen] = useState(false);
  const [selectedAddendum, setSelectedAddendum] = useState<Addendum | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [error, setError] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    fetchAddendums();
  }, []);

  useEffect(() => {
    fetchContracts();
  }, []);

  useEffect(() => {
    // Verificar se há filtros na URL
    const urlParams = new URLSearchParams(location.search);
    const contractId = urlParams.get('contract');
    const filter = urlParams.get('filter');
    
    if (contractId) {
      setContractFilter(contractId);
    }
    
    if (filter === 'expiring') {
      setExpiringFilter(true);
    } else {
      setExpiringFilter(false);
    }
  }, [location.search]);

  // Limpar seleção quando filtros mudarem
  useEffect(() => {
    setSelectedIds(new Set());
  }, [searchTerm, typeFilter, contractFilter, expiringFilter]);

  const fetchContracts = async () => {
    try {
      const { data, error } = await supabase
        .from('contracts')
        .select('id, number, contractor, status')
        .order('number');

      if (error) throw error;
      setContracts(data || []);
    } catch (error) {
      console.error('Erro ao buscar contratos:', error);
    }
  };

  const fetchAddendums = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      const { data, error } = await supabase
        .from('addendums')
        .select(`
          *,
          contract:contracts(number, contractor),
          documents:documents(id, name, type, upload_date, url)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAddendums(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar aditivos:', error);
      setError('Erro ao carregar aditivos');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedAddendum) return;

    try {
      const { error } = await supabase
        .from('addendums')
        .delete()
        .eq('id', selectedAddendum.id);

      if (error) throw error;

      await fetchAddendums();
      setIsDeleteModalOpen(false);
      setSelectedAddendum(null);
    } catch (error: any) {
      console.error('Erro ao deletar aditivo:', error);
      setError('Erro ao deletar aditivo');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    try {
      const idsArray = Array.from(selectedIds);
      const { error } = await supabase
        .from('addendums')
        .delete()
        .in('id', idsArray);

      if (error) throw error;

      await fetchAddendums();
      setIsBulkDeleteModalOpen(false);
      setSelectedIds(new Set());
    } catch (error: any) {
      console.error('Erro ao deletar aditivos:', error);
      setError('Erro ao deletar aditivos');
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredAddendums.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAddendums.map(a => a.id)));
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

  const filteredAddendums = addendums.filter(addendum => {
    const matchesSearch = 
      addendum.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      addendum.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (addendum.contract?.number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (addendum.contract?.contractor.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesType = typeFilter === 'all' || addendum.type === typeFilter;
    const matchesContract = !contractFilter || addendum.contract_id === contractFilter;
    
    // Filtro de aditivos vencendo em 30 dias (apenas para tipos 'prazo' e 'vigencia')
    let matchesExpiring = true;
    if (expiringFilter) {
      // Apenas aditivos de prazo e vigência podem vencer
      if ((addendum.type === 'prazo' || addendum.type === 'vigencia') && addendum.new_end_date) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(today.getDate() + 30);
        thirtyDaysFromNow.setHours(23, 59, 59, 999);
        
        const endDate = parseDateFromDB(addendum.new_end_date);
        endDate.setHours(0, 0, 0, 0);
        
        // Verifica se vence ENTRE hoje e 30 dias
        matchesExpiring = endDate >= today && endDate <= thirtyDaysFromNow;
      } else {
        // Se não for prazo/vigência ou não tiver data, não corresponde ao filtro
        matchesExpiring = false;
      }
    }
    
    return matchesSearch && matchesType && matchesContract && matchesExpiring;
  });

  const getTypeColor = (type: Addendum['type']) => {
    switch (type) {
      case 'valor':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'prazo':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'vigencia':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'apostilamento':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeIcon = (type: Addendum['type']) => {
    switch (type) {
      case 'valor':
        return <DollarSign className="h-4 w-4" />;
      case 'prazo':
        return <Calendar className="h-4 w-4" />;
      case 'vigencia':
        return <Clock className="h-4 w-4" />;
      case 'apostilamento':
        return <FileText className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: Addendum['type']) => {
    switch (type) {
      case 'valor':
        return 'Aditivo de Valor';
      case 'prazo':
        return 'Aditivo de Prazo';
      case 'vigencia':
        return 'Apostilamento de Vigência';
      case 'apostilamento':
        return 'Apostilamento';
      default:
        return type;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const totalValueAddendums = addendums.filter(a => a.type === 'valor').reduce((sum, a) => sum + (a.value || 0), 0);
  const totalExecutionExtensions = addendums.filter(a => a.type === 'prazo').length;
  const totalValidityExtensions = addendums.filter(a => a.type === 'vigencia').length;
  const totalEndorsements = addendums.filter(a => a.type === 'apostilamento').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Termos Aditivos e Apostilamentos</h1>
        <div className="w-full sm:w-auto flex">
          <button 
            onClick={() => {
              setSelectedAddendum(null);
              setIsFormOpen(true);
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Documento
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Metrics Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 lg:p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0 pr-2">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Total Geral</p>
              <p className="text-sm sm:text-lg lg:text-xl font-bold text-gray-900 truncate">{addendums.length}</p>
            </div>
            <div className="bg-gray-100 p-2 sm:p-3 rounded-lg flex-shrink-0">
              <FileText className="h-4 sm:h-5 w-4 sm:w-5 text-gray-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 lg:p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0 pr-2">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Aditivos de Valor</p>
              <p className="text-sm sm:text-lg lg:text-xl font-bold text-blue-600 truncate">{addendums.filter(a => a.type === 'valor').length}</p>
              <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 truncate">{formatCurrency(totalValueAddendums)}</p>
            </div>
            <div className="bg-blue-100 p-2 sm:p-3 rounded-lg flex-shrink-0">
              <DollarSign className="h-4 sm:h-5 w-4 sm:w-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 lg:p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0 pr-2">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Aditivos de Prazo</p>
              <p className="text-sm sm:text-lg lg:text-xl font-bold text-green-600 truncate">{totalExecutionExtensions}</p>
              <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">Prorrog. execução</p>
            </div>
            <div className="bg-green-100 p-2 sm:p-3 rounded-lg flex-shrink-0">
              <Calendar className="h-4 sm:h-5 w-4 sm:w-5 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 lg:p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0 pr-2">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Apost. de Vigência</p>
              <p className="text-sm sm:text-lg lg:text-xl font-bold text-amber-600 truncate">{totalValidityExtensions}</p>
              <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">Prorrog. vigência</p>
            </div>
            <div className="bg-amber-100 p-2 sm:p-3 rounded-lg flex-shrink-0">
              <Clock className="h-4 sm:h-5 w-4 sm:w-5 text-amber-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 lg:p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0 pr-2">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Apostilamentos</p>
              <p className="text-sm sm:text-lg lg:text-xl font-bold text-purple-600 truncate">{totalEndorsements}</p>
              <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">Registros alt.</p>
            </div>
            <div className="bg-purple-100 p-2 sm:p-3 rounded-lg flex-shrink-0">
              <FileText className="h-4 sm:h-5 w-4 sm:w-5 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 lg:p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Número, descrição ou contrato..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos os tipos</option>
              <option value="valor">💰 Aditivo de Valor</option>
              <option value="prazo">📅 Aditivo de Prazo</option>
              <option value="vigencia">⏰ Apostilamento de Vigência</option>
              <option value="apostilamento">📝 Apostilamento</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Contrato</label>
            <ContractSearchSelect
              contracts={contracts}
              value={contractFilter}
              onChange={(contractId) => setContractFilter(contractId)}
              placeholder="Todos os contratos"
            />
          </div>
        </div>
        
        {/* Filtros rápidos */}
        <div className="mt-3 sm:mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => {
              const newExpiringFilter = !expiringFilter;
              setExpiringFilter(newExpiringFilter);
              
              const urlParams = new URLSearchParams(location.search);
              if (newExpiringFilter) {
                urlParams.set('filter', 'expiring');
              } else {
                urlParams.delete('filter');
              }
              
              if (contractFilter) {
                urlParams.set('contract', contractFilter);
              } else {
                urlParams.delete('contract');
              }
              
              const newSearch = urlParams.toString();
              navigate(`/addendums${newSearch ? `?${newSearch}` : ''}`, { replace: true });
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
          
          {(typeFilter !== 'all' || contractFilter || expiringFilter) && (
            <button
              onClick={() => {
                setTypeFilter('all');
                setContractFilter('');
                setExpiringFilter(false);
                navigate('/addendums', { replace: true });
              }}
              className="inline-flex items-center justify-center px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <X className="h-3.5 sm:h-4 w-3.5 sm:w-4 mr-1 sm:mr-2" />
              Limpar Filtros
            </button>
          )}
        </div>
        
        {/* Indicador de filtro ativo */}
        {(typeFilter !== 'all' || contractFilter || expiringFilter) && (
          <div className="mt-3 sm:mt-4 bg-blue-50 border border-blue-200 rounded-lg p-2 sm:p-3 flex items-center flex-wrap gap-2">
            <span className="text-xs sm:text-sm font-medium text-blue-900">Filtros ativos:</span>
            {expiringFilter && (
              <span className="inline-flex items-center px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs">
                <AlertTriangle className="h-2.5 sm:h-3 w-2.5 sm:w-3 mr-0.5 sm:mr-1" />
                Vencendo em 30 dias
              </span>
            )}
            {typeFilter !== 'all' && (
              <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                Tipo: {typeFilter === 'valor' ? 'Aditivo de Valor' : typeFilter === 'prazo' ? 'Aditivo de Prazo' : typeFilter === 'vigencia' ? 'Apostilamento de Vigência' : 'Apostilamento'}
              </span>
            )}
            {contractFilter && (
              <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                Contrato: {contracts.find(c => c.id === contractFilter)?.number || 'Selecionado'}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg sm:rounded-xl p-3 sm:p-4 flex items-center justify-between">
          <span className="text-sm font-medium text-blue-900">
            {selectedIds.size} {selectedIds.size === 1 ? 'aditivo selecionado' : 'aditivos selecionados'}
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

      {/* Addendums Table/Cards */}
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
                    title={selectedIds.size === filteredAddendums.length ? 'Desmarcar todos' : 'Selecionar todos'}
                  >
                    {selectedIds.size === filteredAddendums.length && filteredAddendums.length > 0 ? (
                      <CheckSquare className="h-4 w-4 text-blue-600" />
                    ) : (
                      <div className="w-4 h-4 border-2 border-gray-400 rounded"></div>
                    )}
                  </button>
                </th>
                <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">Número</th>
                <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase hidden xl:table-cell">Contrato</th>
                <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">Tipo</th>
                <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">Descrição</th>
                <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase hidden 2xl:table-cell">Detalhes</th>
                <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">Data</th>
                <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase hidden xl:table-cell">Arq.</th>
                <th className="px-2 py-1.5 text-right text-[10px] font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAddendums.map((addendum) => (
                <tr key={addendum.id} className={`hover:bg-gray-50 transition-colors ${selectedIds.has(addendum.id) ? 'bg-blue-50' : ''}`}>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <button
                      onClick={() => toggleSelect(addendum.id)}
                      className="flex items-center justify-center w-5 h-5 border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                    >
                      {selectedIds.has(addendum.id) ? (
                        <CheckSquare className="h-4 w-4 text-blue-600" />
                      ) : (
                        <div className="w-4 h-4 border-2 border-gray-400 rounded"></div>
                      )}
                    </button>
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <div className="text-xs font-medium text-gray-900">{addendum.number}</div>
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap hidden xl:table-cell">
                    <div className="text-xs text-gray-900">{addendum.contract?.number || '-'}</div>
                    <div className="text-[10px] text-gray-500 truncate max-w-[100px]" title={addendum.contract?.contractor}>
                      {addendum.contract?.contractor || '-'}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${getTypeColor(addendum.type)}`}>
                      {getTypeIcon(addendum.type)}
                    </span>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="text-xs text-gray-900 max-w-[150px] truncate" title={addendum.description}>
                      {addendum.description}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-900 hidden 2xl:table-cell">
                    {addendum.type === 'valor' && addendum.value && (
                      <span className="inline-flex items-center gap-0.5 font-medium text-blue-700 text-[10px]">
                        <DollarSign className="h-3 w-3" />
                        {formatCurrency(addendum.value)}
                      </span>
                    )}
                    {addendum.type === 'prazo' && addendum.new_end_date && (
                      <span className="inline-flex items-center gap-0.5 text-green-700 font-medium text-[10px]">
                        <Calendar className="h-3 w-3" />
                        {formatDateForDisplay(addendum.new_end_date)}
                      </span>
                    )}
                    {addendum.type === 'vigencia' && addendum.new_end_date && (
                      <span className="inline-flex items-center gap-0.5 text-yellow-700 font-medium text-[10px]">
                        <Clock className="h-3 w-3" />
                        {formatDateForDisplay(addendum.new_end_date)}
                      </span>
                    )}
                    {addendum.type === 'apostilamento' && (
                      <span className="inline-flex items-center gap-0.5 text-purple-700 font-medium text-[10px]">
                        <FileText className="h-3 w-3" />
                        Alteração
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-900">
                    {formatDateForDisplay(addendum.date)}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap hidden xl:table-cell">
                    {addendum.documents && addendum.documents.length > 0 ? (
                      <div className="flex items-center space-x-0.5">
                        <FileText className="h-3 w-3 text-blue-600" />
                        <span className="text-xs text-gray-600 font-medium">{addendum.documents.length}</span>
                    </div>
                    ) : (
                      <span className="text-[10px] text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end space-x-0.5">
                      {addendum.documents && addendum.documents.length > 0 && (
                        <button onClick={() => { setSelectedAddendum(addendum); setIsFilesModalOpen(true); }} className="text-blue-600 hover:text-blue-900 p-0.5 hover:bg-blue-50 rounded" title="Ver">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      )}
                      <button onClick={() => { setSelectedAddendum(addendum); setIsFormOpen(true); }} className="text-gray-600 hover:text-gray-900 p-0.5 hover:bg-gray-50 rounded" title="Editar">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => { setSelectedAddendum(addendum); setIsDeleteModalOpen(true); }} className="text-red-600 hover:text-red-900 p-0.5 hover:bg-red-50 rounded" title="Excluir">
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
          {filteredAddendums.map((addendum) => (
            <div key={addendum.id} className={`p-4 hover:bg-gray-50 transition-colors ${selectedIds.has(addendum.id) ? 'bg-blue-50' : ''}`}>
              <div className="flex justify-between items-start mb-2">
                <button
                  onClick={() => toggleSelect(addendum.id)}
                  className="flex items-center justify-center w-5 h-5 border border-gray-300 rounded hover:bg-gray-100 transition-colors mr-2 flex-shrink-0"
                >
                  {selectedIds.has(addendum.id) ? (
                    <CheckSquare className="h-4 w-4 text-blue-600" />
                  ) : (
                    <div className="w-4 h-4 border-2 border-gray-400 rounded"></div>
                  )}
                </button>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{addendum.number}</div>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getTypeColor(addendum.type)}`}>
                  {getTypeIcon(addendum.type)}
                  {getTypeLabel(addendum.type)}
                </span>
              </div>
              <div className="text-xs text-gray-600 mb-2">
                <span className="font-medium">Contrato:</span> {addendum.contract?.number} - {addendum.contract?.contractor}
              </div>
              <div className="text-sm text-gray-700 mb-2">{addendum.description}</div>
              {(addendum.type === 'valor' && addendum.value) && (
                <div className="text-sm font-medium text-blue-700 mb-2">💰 {formatCurrency(addendum.value)}</div>
              )}
              {((addendum.type === 'prazo' || addendum.type === 'vigencia') && addendum.new_end_date) && (
                <div className="text-sm text-green-700 mb-2">📅 Novo prazo: {formatDateForDisplay(addendum.new_end_date)}</div>
              )}
              <div className="flex items-center justify-between text-xs text-gray-600 mb-3">
                <span><span className="font-medium">Data:</span> {formatDateForDisplay(addendum.date)}</span>
                {addendum.documents && addendum.documents.length > 0 && (
                  <span>📎 {addendum.documents.length} arquivo(s)</span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                {addendum.documents && addendum.documents.length > 0 && (
                  <button onClick={() => { setSelectedAddendum(addendum); setIsFilesModalOpen(true); }} className="flex-1 text-blue-600 hover:text-blue-900 px-3 py-2 border border-blue-600 hover:bg-blue-50 rounded text-sm">
                    <Eye className="h-4 w-4 inline mr-1" /> Arquivos
                  </button>
                )}
                <button onClick={() => { setSelectedAddendum(addendum); setIsFormOpen(true); }} className="flex-1 text-gray-600 hover:text-gray-900 px-3 py-2 border border-gray-300 hover:bg-gray-50 rounded text-sm">
                  <Edit2 className="h-4 w-4 inline mr-1" /> Editar
                </button>
                <button onClick={() => { setSelectedAddendum(addendum); setIsDeleteModalOpen(true); }} className="text-red-600 hover:text-red-900 px-3 py-2 border border-red-600 hover:bg-red-50 rounded text-sm">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
        
        {filteredAddendums.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {addendums.length === 0 
                ? 'Nenhum documento cadastrado. Clique em "Novo Documento" para começar.'
                : 'Nenhum documento encontrado com os filtros aplicados'
              }
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      <AddendumForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={fetchAddendums}
        addendum={selectedAddendum}
      />

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Excluir Aditivo"
        message={`Tem certeza que deseja excluir o aditivo ${selectedAddendum?.number}? Esta ação não pode ser desfeita.`}
      />

      <DeleteConfirmModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        onConfirm={handleBulkDelete}
        title="Excluir Aditivos Selecionados"
        message={`Tem certeza que deseja excluir ${selectedIds.size} ${selectedIds.size === 1 ? 'aditivo' : 'aditivos'}? Esta ação não pode ser desfeita.`}
      />

      {/* Modal de Arquivos Anexados */}
      {isFilesModalOpen && selectedAddendum && typeof window !== 'undefined' && window.document?.body && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                Arquivos Anexados - Documento {selectedAddendum.number}
              </h2>
              <button
                onClick={() => {
                  setIsFilesModalOpen(false);
                  setSelectedAddendum(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {selectedAddendum.description}
                </h3>
                 <p className="text-sm text-gray-600">
                   Tipo: <span className="font-medium">{selectedAddendum.type}</span> | 
                   Data: <span className="font-medium">{formatDateForDisplay(selectedAddendum.date)}</span>
                 </p>
              </div>

              {selectedAddendum.documents && selectedAddendum.documents.length > 0 ? (
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900">Arquivos ({selectedAddendum.documents.length})</h4>
                  <ul className="divide-y divide-gray-200">
                    {selectedAddendum.documents.map((doc) => (
                      <li key={doc.id} className="py-3 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <FileText className="h-5 w-5 text-blue-600" />
                           <div>
                             <p className="font-medium text-gray-900">{doc.name}</p>
                             <p className="text-sm text-gray-500">
                               {doc.type} • {formatDateForDisplay(doc.upload_date)}
                             </p>
                           </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => window.open(doc.url, '_blank')}
                            className="text-blue-600 hover:text-blue-900 p-2 hover:bg-blue-50 rounded transition-colors"
                            title="Visualizar"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-green-600 hover:text-green-900 p-2 hover:bg-green-50 rounded transition-colors"
                            title="Baixar"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2 text-gray-500">Nenhum arquivo anexado a este documento.</p>
                </div>
              )}
            </div>

            <div className="flex justify-end p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setIsFilesModalOpen(false);
                  setSelectedAddendum(null);
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>,
        window.document.body
      )}
    </div>
  );
}