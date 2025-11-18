import React from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, DollarSign, FileText, User, Building, Tag, Download, Eye } from 'lucide-react';
import { Contract } from '../../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import DocumentViewer from '../Documents/DocumentViewer';
import { parseDateFromDB, formatDateForDisplay, formatDateForInput } from '../../utils/dateUtils';

interface ContractDetailsProps {
  isOpen: boolean;
  onClose: () => void;
  contract: Contract | null;
}

export default function ContractDetails({ isOpen, onClose, contract }: ContractDetailsProps) {
  const [documents, setDocuments] = React.useState<any[]>([]);
  const [addendums, setAddendums] = React.useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = React.useState(false);
  const [loadingAddendums, setLoadingAddendums] = React.useState(false);
  const [viewerOpen, setViewerOpen] = React.useState(false);
  const [selectedDoc, setSelectedDoc] = React.useState<any>(null);
  const { user } = useAuth();
  const userName = user?.name || 'Usuário';

  React.useEffect(() => {
    const fetchData = async () => {
      if (isOpen && contract) {
        setLoadingDocs(true);
        setLoadingAddendums(true);
        
        // Buscar documentos
        const { data: docsData } = await supabase
          .from('documents')
          .select('*')
          .eq('contract_id', contract.id)
          .order('upload_date', { ascending: false });
        setDocuments(docsData || []);
        setLoadingDocs(false);

        // Buscar aditivos
        const { data: addendumsData } = await supabase
          .from('addendums')
          .select(`
            *,
            documents:documents(id, name, type, upload_date, url)
          `)
          .eq('contract_id', contract.id)
          .order('date', { ascending: false });
        setAddendums(addendumsData || []);
        setLoadingAddendums(false);
      } else {
        setDocuments([]);
        setAddendums([]);
      }
    };
    fetchData();
  }, [isOpen, contract]);

  if (!isOpen || !contract) return null;

  if (typeof window === 'undefined' || !window.document?.body) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

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

  const handleDownload = (url: string, name: string) => {
    const link = window.document.createElement('a');
    link.href = url;
    link.download = name;
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
  };
  

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-lg sm:rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
          <div className="flex items-center justify-between p-4 sm:p-6">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                  Detalhes do Contrato
                </h2>
                <p className="text-xs sm:text-sm text-gray-500">{contract.number}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Seção: Informações Principais */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900">{contract.number}</h3>
                  <span className={`inline-flex px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium rounded-lg border ${getStatusColor(contract.status)}`}>
                    {contract.status.charAt(0).toUpperCase() + contract.status.slice(1)}
                  </span>
                </div>
                <p className="text-sm sm:text-base text-gray-600 mb-1">{contract.category}</p>
                <p className="text-sm text-gray-700">{contract.object}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <Building className="h-4 w-4 text-gray-400" />
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Contratado</p>
                </div>
                <p className="text-sm sm:text-base text-gray-900 font-medium">{contract.contractor}</p>
              </div>
              
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <DollarSign className="h-4 w-4 text-gray-400" />
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Valor</p>
                </div>
                <p className="text-sm sm:text-base text-gray-900 font-medium">{formatCurrency(contract.value)}</p>
              </div>
              
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Início</p>
                </div>
                <p className="text-sm sm:text-base text-gray-900 font-medium">{formatDateForDisplay(contract.startDate)}</p>
              </div>
              
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Término</p>
                </div>
                <p className="text-sm sm:text-base text-gray-900 font-medium">{formatDateForDisplay(contract.endDate)}</p>
                {/* Mostrar novo prazo se houver aditivo de prazo ou apostilamento de vigência */}
                {addendums.some(a => (a.type === 'prazo' || a.type === 'vigencia') && a.new_end_date) && (
                  <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-xs font-medium text-blue-800 mb-1">⏰ Prazo Prorrogado</p>
                    {addendums
                      .filter(a => (a.type === 'prazo' || a.type === 'vigencia') && a.new_end_date)
                      .slice(0, 1)
                      .map((addendum, index) => (
                        <p key={index} className="text-xs text-blue-700 font-medium">
                          Até: {formatDateForDisplay(addendum.new_end_date)}
                        </p>
                      ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-gray-400" />
                <p className="text-xs sm:text-sm font-medium text-gray-600">Responsável:</p>
                <p className="text-sm sm:text-base text-gray-900">{userName}</p>
              </div>
            </div>
          </div>

          {/* Seção: Documentos vinculados */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
            <div className="flex items-center space-x-2 mb-4">
              <div className="bg-blue-100 p-2 rounded-lg">
                <FileText className="h-4 w-4 text-blue-600" />
              </div>
              <h4 className="text-base sm:text-lg font-semibold text-gray-900">Documentos Vinculados</h4>
              {documents.length > 0 && (
                <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-1 rounded-full">
                  {documents.length}
                </span>
              )}
            </div>
            {loadingDocs ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <p className="text-gray-500 text-sm mt-2">Carregando documentos...</p>
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">Nenhum documento vinculado a este contrato.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm sm:text-base text-gray-900 truncate">{doc.name}</p>
                        <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-200">{doc.type}</span>
                      </div>
                      <p className="text-xs text-gray-500">{doc.upload_date && formatDateForDisplay(doc.upload_date)}</p>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        type="button"
                        onClick={() => { setSelectedDoc(doc); setViewerOpen(true); }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Visualizar"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Baixar"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Seção: Termos Aditivos */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
            <div className="flex items-center space-x-2 mb-4">
              <div className="bg-purple-100 p-2 rounded-lg">
                <FileText className="h-4 w-4 text-purple-600" />
              </div>
              <h4 className="text-base sm:text-lg font-semibold text-gray-900">Termos Aditivos e Apostilamentos</h4>
              {addendums.length > 0 && (
                <span className="bg-purple-100 text-purple-700 text-xs font-medium px-2 py-1 rounded-full">
                  {addendums.length}
                </span>
              )}
            </div>
            {loadingAddendums ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                <p className="text-gray-500 text-sm mt-2">Carregando termos aditivos...</p>
              </div>
            ) : addendums.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">Nenhum termo aditivo vinculado a este contrato.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {addendums.map(addendum => (
                  <div key={addendum.id} className="bg-gray-50 rounded-lg border border-gray-200 p-4 hover:bg-gray-100 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm sm:text-base text-gray-900">{addendum.number}</span>
                        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-lg border ${
                          addendum.type === 'valor' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                          addendum.type === 'prazo' ? 'bg-green-100 text-green-800 border-green-200' :
                          addendum.type === 'vigencia' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                          'bg-purple-100 text-purple-800 border-purple-200'
                        }`}>
                          {addendum.type === 'valor' ? 'Valor' :
                           addendum.type === 'prazo' ? 'Prazo (Exec.)' :
                           addendum.type === 'vigencia' ? 'Vigência' : 'Apostilamento'}
                        </span>
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-700 mb-3">{addendum.description}</p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3 text-xs sm:text-sm">
                      <div>
                        <span className="text-gray-600">Data:</span>
                        <p className="text-gray-900 font-medium">{formatDateForDisplay(addendum.date)}</p>
                      </div>
                      {addendum.type === 'valor' && addendum.value && (
                        <div>
                          <span className="text-gray-600">Valor:</span>
                          <p className="text-gray-900 font-medium">{formatCurrency(addendum.value)}</p>
                        </div>
                      )}
                      {(addendum.type === 'prazo' || addendum.type === 'vigencia') && addendum.new_end_date && (
                        <div className="sm:col-span-2">
                          <span className="text-gray-600">Novo {addendum.type === 'prazo' ? 'prazo de execução' : 'prazo de vigência'}:</span>
                          <p className="text-blue-700 font-medium">⏰ {formatDateForDisplay(addendum.new_end_date)}</p>
                        </div>
                      )}
                    </div>

                    {addendum.documents && addendum.documents.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {addendum.documents.length} arquivo(s) anexado(s)
                        </p>
                        <div className="space-y-2">
                          {addendum.documents.slice(0, 3).map((doc: any) => (
                            <div key={doc.id} className="flex items-center justify-between p-2 bg-white rounded border border-gray-200">
                              <span className="text-xs text-gray-700 truncate flex-1" title={doc.name}>
                                {doc.name}
                              </span>
                              <div className="flex items-center space-x-1 ml-2">
                                <button
                                  onClick={() => window.open(doc.url, '_blank')}
                                  className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="Visualizar"
                                >
                                  <Eye className="h-3 w-3" />
                                </button>
                                <a
                                  href={doc.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                                  title="Baixar"
                                >
                                  <Download className="h-3 w-3" />
                                </a>
                              </div>
                            </div>
                          ))}
                          {addendum.documents.length > 3 && (
                            <p className="text-xs text-gray-500 text-center">
                              +{addendum.documents.length - 3} mais arquivo(s)
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Seção: Informações do Sistema */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
            <h4 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Informações do Sistema</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="text-xs text-gray-600 mb-1">Criado em</p>
                <p className="text-sm font-medium text-gray-900">{format(new Date(contract.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="text-xs text-gray-600 mb-1">Última atualização</p>
                <p className="text-sm font-medium text-gray-900">{format(new Date(contract.updatedAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 sm:p-6">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 sm:px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm sm:text-base font-medium"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>

      {/* Modal de visualização de documento */}
      <DocumentViewer
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        document={selectedDoc}
      />
    </div>,
    window.document.body
  );
}