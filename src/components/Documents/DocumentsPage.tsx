import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Eye, Download, Trash2, Upload, FolderOpen, FileText, Image, File, ExternalLink, RefreshCw, CheckSquare } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatDateForDisplay } from '../../utils/dateUtils';
import DocumentForm from './DocumentForm';
import DocumentViewer from './DocumentViewer';
import DeleteConfirmModal from '../Common/DeleteConfirmModal';

interface Document {
  id: string;
  contract_id: string | null;
  addendum_id: string | null;
  name: string;
  type: string;
  category: string;
  upload_date: string;
  size: number;
  url: string;
  contract?: {
    number: string;
    contractor: string;
  };
  addendum?: {
    number: string;
    type: string;
    description: string;
  };
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  // Limpar seleção quando filtros mudarem
  useEffect(() => {
    setSelectedIds(new Set());
  }, [searchTerm, categoryFilter, typeFilter]);

  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      const { data, error } = await supabase
        .from('documents')
        .select(`
          *,
          contract:contracts(number, contractor),
          addendum:addendums(number, type, description)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar documentos:', error);
      setError('Erro ao carregar documentos');
    } finally {
      setIsLoading(false);
    }
  };

  const handleView = (document: Document) => {
    setSelectedDocument(document);
    setIsViewerOpen(true);
  };

  const handleDownload = async (document: Document) => {
    try {
      setDownloadingId(document.id);
      
      // Tentar download real
      if (document.url.startsWith('http')) {
        // Para URLs externas, abrir em nova aba
        window.open(document.url, '_blank');
      } else {
        // Para arquivos locais, tentar download
        const link = window.document.createElement('a');
        link.href = document.url;
        link.download = document.name;
        link.target = '_blank';
        window.document.body.appendChild(link);
        link.click();
        window.document.body.removeChild(link);
      }
      
      // Feedback visual
      setTimeout(() => {
        setDownloadingId(null);
      }, 1000);
      
    } catch (error: any) {
      console.error('Erro ao baixar documento:', error);
      setError('Erro ao baixar documento');
      setDownloadingId(null);
      
      // Fallback: tentar abrir em nova aba
      try {
        window.open(document.url, '_blank');
      } catch (fallbackError) {
        console.error('Fallback também falhou:', fallbackError);
      }
    }
  };

  const handleDelete = async () => {
    if (!selectedDocument) return;

    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', selectedDocument.id);

      if (error) throw error;

      await fetchDocuments();
      setIsDeleteModalOpen(false);
      setSelectedDocument(null);
    } catch (error: any) {
      console.error('Erro ao deletar documento:', error);
      setError('Erro ao deletar documento');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    try {
      const idsArray = Array.from(selectedIds);
      const { error } = await supabase
        .from('documents')
        .delete()
        .in('id', idsArray);

      if (error) throw error;

      await fetchDocuments();
      setIsBulkDeleteModalOpen(false);
      setSelectedIds(new Set());
    } catch (error: any) {
      console.error('Erro ao deletar documentos:', error);
      setError('Erro ao deletar documentos');
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredDocuments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredDocuments.map(d => d.id)));
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

  const filteredDocuments = documents.filter(document => {
    const matchesSearch = 
      document.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      document.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (document.contract?.number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (document.addendum?.number.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = categoryFilter === 'all' || document.category === categoryFilter;
    const matchesType = typeFilter === 'all' || document.type.toLowerCase() === typeFilter.toLowerCase();
    
    return matchesSearch && matchesCategory && matchesType;
  });

  const getFileIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pdf':
        return <FileText className="h-5 w-5 text-red-500" />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return <Image className="h-5 w-5 text-blue-500" />;
      case 'doc':
      case 'docx':
        return <FileText className="h-5 w-5 text-blue-600" />;
      case 'xls':
      case 'xlsx':
        return <FileText className="h-5 w-5 text-green-600" />;
      default:
        return <File className="h-5 w-5 text-gray-500" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const canPreview = (type: string) => {
    const previewableTypes = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'txt'];
    return previewableTypes.includes(type.toLowerCase());
  };

  // Categorias fixas de documentos
  const categories = [
    'Contrato',
    'Locação de Imóvel',
    'Aditivo',
    'Apostilamento',
    'Habilitação',
    'Proposta',
    'Nota Fiscal',
    'Recibo',
    'Certidão',
    'Atestado',
    'Projeto',
    'Planilha',
    'ART/RRT',
    'Relatório',
    'Ata',
    'Parecer',
    'Outros'
  ];
  
  const totalDocuments = documents.length;
  const totalSize = documents.reduce((sum, doc) => sum + doc.size, 0);
  
  // Contar quantas categorias únicas existem nos documentos
  const uniqueCategories = new Set(documents.map(d => d.category)).size;

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
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Gestão de Documentos</h1>
        <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-2 sm:space-x-2">
          <button 
            onClick={fetchDocuments}
            className="w-full sm:w-auto bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg flex items-center justify-center space-x-2 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Atualizar</span>
          </button>
          <button 
            onClick={() => {
              setSelectedDocument(null);
              setIsFormOpen(true);
            }}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center space-x-2 transition-colors"
          >
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Upload Documento</span>
            <span className="sm:hidden">Upload</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 lg:p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0 pr-2">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Total de Documentos</p>
              <p className="text-sm sm:text-lg lg:text-xl font-bold text-blue-600 truncate">{totalDocuments}</p>
              <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">Arquivos gerenciados</p>
            </div>
            <div className="bg-blue-100 p-2 sm:p-3 rounded-lg flex-shrink-0">
              <FolderOpen className="h-4 sm:h-5 w-4 sm:w-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 lg:p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0 pr-2">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Espaço Utilizado</p>
              <p className="text-sm sm:text-lg lg:text-xl font-bold text-green-600 truncate">{formatFileSize(totalSize)}</p>
              <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">Capacidade total</p>
            </div>
            <div className="bg-green-100 p-2 sm:p-3 rounded-lg flex-shrink-0">
              <div className="h-4 sm:h-5 w-4 sm:w-5 bg-green-600 rounded"></div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 lg:p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0 pr-2">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Categorias</p>
              <p className="text-sm sm:text-lg lg:text-xl font-bold text-purple-600 truncate">{uniqueCategories}</p>
              <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">Tipos em uso</p>
            </div>
            <div className="bg-purple-100 p-2 sm:p-3 rounded-lg flex-shrink-0">
              <FileText className="h-4 sm:h-5 w-4 sm:w-5 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 lg:p-6">
        <div className="flex flex-col gap-2 sm:gap-3 lg:gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nome, categoria ou contrato..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todas as categorias</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center space-x-2">
            <FileText className="h-4 w-4 text-gray-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos os tipos</option>
              <option value="pdf">PDF</option>
              <option value="doc">DOC/DOCX</option>
              <option value="xls">XLS/XLSX</option>
              <option value="ppt">PPT/PPTX</option>
              <option value="png">PNG</option>
              <option value="jpg">JPG/JPEG</option>
              <option value="gif">GIF</option>
              <option value="txt">TXT</option>
              <option value="csv">CSV</option>
            </select>
          </div>
        </div>
      </div>

      {/* Upload Area */}
      <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5 lg:p-6">
        <div 
          onClick={() => {
            setSelectedDocument(null);
            setIsFormOpen(true);
          }}
          className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors cursor-pointer"
        >
          <Upload className="mx-auto h-12 w-12 text-gray-400" />
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-900">
              Arraste arquivos aqui ou clique para fazer upload
            </p>
            <p className="text-sm text-gray-500 mt-1">
              PDF, DOC, XLS, PNG, JPG, GIF, TXT até 10MB
            </p>
          </div>
          <button className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            Selecionar Arquivos
          </button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg sm:rounded-xl p-3 sm:p-4 flex items-center justify-between">
          <span className="text-sm font-medium text-blue-900">
            {selectedIds.size} {selectedIds.size === 1 ? 'documento selecionado' : 'documentos selecionados'}
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

      {/* Documents Table/Cards */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase w-10">
                  <button
                    onClick={toggleSelectAll}
                    className="flex items-center justify-center w-5 h-5 border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                    title={selectedIds.size === filteredDocuments.length ? 'Desmarcar todos' : 'Selecionar todos'}
                  >
                    {selectedIds.size === filteredDocuments.length && filteredDocuments.length > 0 ? (
                      <CheckSquare className="h-4 w-4 text-blue-600" />
                    ) : (
                      <div className="w-4 h-4 border-2 border-gray-400 rounded"></div>
                    )}
                  </button>
                </th>
                <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">Documento</th>
                <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase hidden xl:table-cell">Vinculado</th>
                <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">Categoria</th>
                <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase hidden 2xl:table-cell">Tamanho</th>
                <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">Data</th>
                <th className="px-2 py-1.5 text-right text-[10px] font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredDocuments.map((document) => (
                <tr key={document.id} className={`hover:bg-gray-50 transition-colors ${selectedIds.has(document.id) ? 'bg-blue-50' : ''}`}>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <button
                      onClick={() => toggleSelect(document.id)}
                      className="flex items-center justify-center w-5 h-5 border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                    >
                      {selectedIds.has(document.id) ? (
                        <CheckSquare className="h-4 w-4 text-blue-600" />
                      ) : (
                        <div className="w-4 h-4 border-2 border-gray-400 rounded"></div>
                      )}
                    </button>
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <div className="flex items-center space-x-1">
                      {getFileIcon(document.type)}
                      <div>
                        <div className="text-xs font-medium text-gray-900 max-w-[150px] truncate" title={document.name}>{document.name}</div>
                        <div className="text-[10px] text-gray-500 uppercase">{document.type}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap hidden xl:table-cell">
                    <div className="text-xs text-gray-900">
                      {document.contract ? (
                        <div>
                          <span className="font-medium text-[10px]">C: {document.contract.number}</span>
                          <div className="text-[10px] text-gray-500 truncate max-w-[100px]">{document.contract.contractor}</div>
                        </div>
                      ) : document.addendum ? (
                        <div>
                          <span className="font-medium text-purple-600 text-[10px]">A: {document.addendum.number}</span>
                          <div className="text-[10px] text-gray-500 truncate max-w-[100px]">{document.addendum.description}</div>
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-400">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-800 rounded-full">{document.category}</span>
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-900 hidden 2xl:table-cell">{formatFileSize(document.size)}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-900">
                    {formatDateForDisplay(document.upload_date)}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end space-x-0.5">
                      {canPreview(document.type) ? (
                        <button onClick={() => handleView(document)}
                          className="text-blue-600 hover:text-blue-900 p-0.5 hover:bg-blue-50 rounded transition-colors"
                          title="Ver"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <button onClick={() => handleDownload(document)} className="text-blue-600 hover:text-blue-900 p-0.5 hover:bg-blue-50 rounded" title="Abrir">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button onClick={() => handleDownload(document)} disabled={downloadingId === document.id} className="text-green-600 hover:text-green-900 p-0.5 hover:bg-green-50 rounded disabled:opacity-50" title="Download">
                        {downloadingId === document.id ? (
                          <div className="animate-spin h-3.5 w-3.5 border-2 border-green-600 border-t-transparent rounded-full"></div>
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button onClick={() => { setSelectedDocument(document); setIsDeleteModalOpen(true); }} className="text-red-600 hover:text-red-900 p-0.5 hover:bg-red-50 rounded" title="Excluir">
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
          {filteredDocuments.map((document) => (
            <div key={document.id} className={`p-4 hover:bg-gray-50 transition-colors ${selectedIds.has(document.id) ? 'bg-blue-50' : ''}`}>
              <div className="flex items-start space-x-3 mb-2">
                <button
                  onClick={() => toggleSelect(document.id)}
                  className="flex items-center justify-center w-5 h-5 border border-gray-300 rounded hover:bg-gray-100 transition-colors flex-shrink-0 mt-1"
                >
                  {selectedIds.has(document.id) ? (
                    <CheckSquare className="h-4 w-4 text-blue-600" />
                  ) : (
                    <div className="w-4 h-4 border-2 border-gray-400 rounded"></div>
                  )}
                </button>
                {getFileIcon(document.type)}
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{document.name}</div>
                  <div className="text-xs text-gray-500 uppercase">{document.type} • {formatFileSize(document.size)}</div>
                </div>
                <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">{document.category}</span>
              </div>
              {(document.contract || document.addendum) && (
                <div className="text-xs text-gray-600 mb-2">
                  {document.contract ? (
                    <span><span className="font-medium">Contrato:</span> {document.contract.number} - {document.contract.contractor}</span>
                  ) : (
                    <span><span className="font-medium text-purple-600">Aditivo:</span> {document.addendum?.number} - {document.addendum?.description}</span>
                  )}
                </div>
              )}
              <div className="text-xs text-gray-500 mb-3">
                <span className="font-medium">Upload:</span> {formatDateForDisplay(document.upload_date)}
              </div>
              <div className="flex items-center space-x-2">
                {canPreview(document.type) ? (
                  <button onClick={() => handleView(document)} className="flex-1 text-blue-600 hover:text-blue-900 px-3 py-2 border border-blue-600 hover:bg-blue-50 rounded text-sm">
                    <Eye className="h-4 w-4 inline mr-1" /> Visualizar
                  </button>
                ) : (
                  <button onClick={() => handleDownload(document)} className="flex-1 text-blue-600 hover:text-blue-900 px-3 py-2 border border-blue-600 hover:bg-blue-50 rounded text-sm">
                    <ExternalLink className="h-4 w-4 inline mr-1" /> Abrir
                  </button>
                )}
                <button onClick={() => handleDownload(document)} disabled={downloadingId === document.id} className="flex-1 text-green-600 hover:text-green-900 px-3 py-2 border border-green-600 hover:bg-green-50 rounded text-sm disabled:opacity-50">
                  {downloadingId === document.id ? (
                    <div className="animate-spin h-4 w-4 border-2 border-green-600 border-t-transparent rounded-full inline"></div>
                  ) : (
                    <><Download className="h-4 w-4 inline mr-1" /> Download</>
                  )}
                </button>
                <button onClick={() => { setSelectedDocument(document); setIsDeleteModalOpen(true); }} className="text-red-600 hover:text-red-900 px-3 py-2 border border-red-600 hover:bg-red-50 rounded text-sm">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
        
        {filteredDocuments.length === 0 && (
          <div className="text-center py-12">
            <FolderOpen className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-gray-500">
              {documents.length === 0 
                ? 'Nenhum documento cadastrado. Clique em "Upload Documento" para começar.'
                : 'Nenhum documento encontrado com os filtros aplicados'
              }
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      <DocumentForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={fetchDocuments}
        document={selectedDocument}
      />

      <DocumentViewer
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        document={selectedDocument}
      />

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Excluir Documento"
        message={`Tem certeza que deseja excluir o documento ${selectedDocument?.name}? Esta ação não pode ser desfeita.`}
      />

      <DeleteConfirmModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        onConfirm={handleBulkDelete}
        title="Excluir Documentos Selecionados"
        message={`Tem certeza que deseja excluir ${selectedIds.size} ${selectedIds.size === 1 ? 'documento' : 'documentos'}? Esta ação não pode ser desfeita.`}
      />
    </div>
  );
}