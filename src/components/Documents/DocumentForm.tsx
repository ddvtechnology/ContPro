import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Upload, FileText, Building, Tag, AlertCircle, CheckCircle, Info, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import ContractSearchSelect from '../Common/ContractSearchSelect';
import AddendumSearchSelect from '../Common/AddendumSearchSelect';

interface DocumentFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  document?: any;
}

export default function DocumentForm({ isOpen, onClose, onSave, document }: DocumentFormProps) {
  const [formData, setFormData] = useState({
    contractId: '',
    name: '',
    type: 'pdf',
    category: 'Outros',
    size: 0,
    url: ''
  });
  const [linkType, setLinkType] = useState<'contract' | 'contract_related' | 'addendum' | 'none'>('none');
  const [contracts, setContracts] = useState<any[]>([]);
  const [addendums, setAddendums] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [bucketStatus, setBucketStatus] = useState<'checking' | 'ready' | 'error'>('checking');

  useEffect(() => {
    if (isOpen) {
      fetchContracts();
      fetchAddendums();
      checkBucketStatus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (document) {
      // Determinar tipo de vinculação baseado no documento
      if (document.contract_id) {
        // Verificar se é documento principal de contrato ou outro tipo relacionado
        const isMainContract = document.category === 'Contrato' || document.category === 'Locação de Imóvel';
        setLinkType(isMainContract ? 'contract' : 'contract_related');
        setFormData({
          contractId: document.contract_id,
          name: document.name,
          type: document.type,
          category: document.category,
          size: document.size,
          url: document.url
        });
      } else if (document.addendum_id) {
        setLinkType('addendum');
        setFormData({
          contractId: document.addendum_id,
          name: document.name,
          type: document.type,
          category: document.category,
          size: document.size,
          url: document.url
        });
      } else {
        setLinkType('none');
        setFormData({
          contractId: '',
          name: document.name,
          type: document.type,
          category: document.category,
          size: document.size,
          url: document.url
        });
      }
    } else {
      setLinkType('none');
      setFormData({
        contractId: '',
        name: '',
        type: 'pdf',
        category: 'Outros',
        size: 0,
        url: ''
      });
      setSelectedFile(null);
    }
    setError('');
    setUploadProgress(0);
  }, [document]);

  const checkBucketStatus = async () => {
    try {
      setBucketStatus('checking');
      
      // Verificar se o bucket 'documents' existe
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      
      if (bucketsError) {
        throw bucketsError;
      }

      const documentsBucket = buckets?.find(b => b.name === 'documents');
      if (!documentsBucket) {
        setBucketStatus('error');
        setError('Bucket "documents" não existe. Verifique a configuração no Supabase.');
        return;
      }

      // Tentar listar arquivos no bucket para verificar permissões
      const { error: listError } = await supabase.storage
        .from('documents')
        .list('', { limit: 1 });

      if (listError) {
        setBucketStatus('error');
        setError('Erro ao acessar o bucket. Verifique as políticas RLS.');
        return;
      }

      setBucketStatus('ready');
      
    } catch (error: any) {
      setBucketStatus('error');
      setError(`Erro ao verificar armazenamento: ${error.message}`);
    }
  };

  const fetchContracts = async () => {
    try {
      const { data, error } = await supabase
        .from('contracts')
        .select('id, number, contractor')
        .order('number');

      if (error) throw error;
      
      setContracts(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar contratos:', error);
    }
  };

  const fetchAddendums = async () => {
    try {
      const { data, error } = await supabase
        .from('addendums')
        .select('id, number, type, contract_id, contract:contracts(number, contractor)')
        .order('number');

      if (error) throw error;
      
      setAddendums(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar aditivos:', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tamanho do arquivo (10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('Arquivo muito grande. Tamanho máximo: 10MB');
        return;
      }

      // Validar tipos permitidos
      const allowedTypes = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'txt', 'csv'];
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      
      if (!fileExtension || !allowedTypes.includes(fileExtension)) {
        setError('Tipo de arquivo não permitido. Use: PDF, DOC, XLS, PPT, PNG, JPG, GIF, TXT, CSV');
        return;
      }

      setSelectedFile(file);
      setFormData({
        ...formData,
        name: file.name,
        type: fileExtension,
        size: file.size,
        url: ''
      });
      setError('');
    }
  };

  const uploadFileToStorage = async (file: File): Promise<string> => {
    try {
      setUploadProgress(10);
      
      // Usar o nome do documento digitado pelo usuário
      // Sanitizar o nome para evitar caracteres especiais e garantir extensão
      const documentName = formData.name.trim() || 'documento';
      const sanitizedName = documentName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres especiais
        .replace(/\s+/g, '-') // Substitui espaços por hífens
        .substring(0, 100); // Limita tamanho
      
      const fileExtension = file.name.split('.').pop() || 'pdf';
      const fileName = `${sanitizedName}.${fileExtension}`;
      let filePath = `documents/${fileName}`;

      setUploadProgress(25);

      // Verificar novamente o bucket antes do upload
      const { data: buckets } = await supabase.storage.listBuckets();
      const documentsBucket = buckets?.find(b => b.name === 'documents');
      if (!documentsBucket) {
        throw new Error('Bucket "documents" não encontrado no momento do upload');
      }

      // Upload do arquivo para o Supabase Storage
      // Se o arquivo já existir, adicionar timestamp para tornar único
      let attempts = 0;
      let uploadSuccess = false;

      while (attempts < 3 && !uploadSuccess) {
        const { error } = await supabase.storage
          .from('documents')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type || 'application/octet-stream'
          });

        if (!error) {
          uploadSuccess = true;
          break; // Upload bem-sucedido
        }

        // Se for erro de duplicata e ainda houver tentativas, adicionar timestamp
        if (error.message.includes('duplicate') && attempts < 2) {
          attempts++;
          const timestamp = Date.now();
          filePath = `documents/${sanitizedName}_${timestamp}.${fileExtension}`;
          continue;
        }

        // Outros erros
        if (error.message.includes('permission')) {
          throw new Error('Sem permissão para upload. Verifique as políticas RLS do bucket.');
        } else if (error.message.includes('size')) {
          throw new Error('Arquivo muito grande para o bucket.');
        } else if (error.message.includes('duplicate')) {
          throw new Error('Arquivo com este nome já existe. Tente usar um nome diferente.');
        } else {
          throw new Error(`Erro no upload: ${error.message}`);
        }
      }

      if (!uploadSuccess) {
        throw new Error('Não foi possível fazer upload do arquivo após várias tentativas.');
      }

      setUploadProgress(75);

      // Obter URL pública do arquivo
      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        throw new Error('Erro ao obter URL pública do arquivo');
      }

      setUploadProgress(90);
      
      return urlData.publicUrl;

    } catch (error: any) {
      setUploadProgress(0);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setUploadProgress(0);

    try {
      // Verificar status do bucket
      if (bucketStatus !== 'ready') {
        setError('Sistema de armazenamento não está pronto. Execute o diagnóstico novamente.');
        return;
      }

      // Validar se há arquivo selecionado para novos documentos
      if (!document && !selectedFile) {
        setError('Selecione um arquivo para upload');
        return;
      }

      // Validar campos obrigatórios
      if (!formData.name.trim()) {
        setError('Nome do documento é obrigatório');
        return;
      }

      // Validar vinculação se necessário
      if ((linkType === 'contract' || linkType === 'contract_related' || linkType === 'addendum') && !formData.contractId) {
        if (linkType === 'addendum') {
          setError('Selecione o termo aditivo/apostilamento');
        } else {
          setError('Selecione o contrato');
        }
        return;
      }

      let fileUrl = formData.url;

      // Se há um arquivo selecionado, fazer upload
      if (selectedFile) {
        fileUrl = await uploadFileToStorage(selectedFile);
      }

      // Salvar no banco de dados
      const documentData = {
        contract_id: (linkType === 'contract' || linkType === 'contract_related') ? formData.contractId : null,
        addendum_id: linkType === 'addendum' ? formData.contractId : null,
        name: formData.name.trim(),
        type: selectedFile ? selectedFile.name.split('.').pop()?.toLowerCase() || 'pdf' : formData.type,
        category: formData.category,
        size: selectedFile ? selectedFile.size : formData.size,
        url: fileUrl,
        upload_date: new Date().toISOString().split('T')[0]
      };

      setUploadProgress(95);

      if (document) {
        const { error } = await supabase
          .from('documents')
          .update(documentData)
          .eq('id', document.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('documents')
          .insert(documentData);

        if (error) throw error;
      }

      setUploadProgress(100);
      console.log('✅ Sistema de armazenamento pronto');
      
      // Pequeno delay para mostrar o progresso completo
      setTimeout(() => {
        onSave();
        onClose();
      }, 500);

    } catch (error: any) {
      setError(error.message || 'Erro ao salvar documento');
      setUploadProgress(0);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  // Categorias dinâmicas baseadas no tipo de vinculação
  const getCategoriesByLinkType = () => {
    switch (linkType) {
      case 'contract':
        return [
          'Contrato',
          'Locação de Imóvel',
          'Outros'
        ];
      case 'contract_related':
        return [
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
          'Ordem de Serviço',
          'Termo de Recebimento',
          'Outros'
        ];
      case 'addendum':
        return [
          'Termo Aditivo',
          'Apostilamento',
          'Justificativa',
          'Parecer Jurídico',
          'Parecer Técnico',
          'Planilha',
          'Outros'
        ];
      case 'none':
      default:
        return [
          'Ofício',
          'Memorando',
          'Comunicado',
          'Parecer',
          'Relatório',
          'Ata',
          'Nota Técnica',
          'Outros'
        ];
    }
  };

  const categories = getCategoriesByLinkType();

  if (typeof window === 'undefined' || !window.document?.body) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto relative">
        <div className="sticky top-0 bg-white border-b border-gray-200 z-10 flex items-center justify-between p-6">
          <h2 className="text-xl font-semibold text-gray-900">
            {document ? 'Editar Documento' : 'Novo Documento'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg flex-shrink-0"
            disabled={isLoading}
            aria-label="Fechar"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Status do Bucket */}
          <div className={`rounded-lg p-4 ${
            bucketStatus === 'ready' ? 'bg-green-50 border border-green-200' :
            bucketStatus === 'error' ? 'bg-red-50 border border-red-200' :
            'bg-blue-50 border border-blue-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {bucketStatus === 'ready' && <CheckCircle className="h-5 w-5 text-green-600" />}
                {bucketStatus === 'error' && <AlertCircle className="h-5 w-5 text-red-600" />}
                {bucketStatus === 'checking' && <Info className="h-5 w-5 text-blue-600" />}
                <span className={`text-sm font-medium ${
                  bucketStatus === 'ready' ? 'text-green-800' :
                  bucketStatus === 'error' ? 'text-red-800' :
                  'text-blue-800'
                }`}>
                  {bucketStatus === 'ready' && 'Sistema de armazenamento pronto'}
                  {bucketStatus === 'error' && 'Erro no sistema de armazenamento'}
                  {bucketStatus === 'checking' && 'Verificando sistema de armazenamento...'}
                </span>
              </div>
              <button
                type="button"
                onClick={checkBucketStatus}
                disabled={bucketStatus === 'checking'}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                title="Reexecutar diagnóstico"
              >
                <RefreshCw className={`h-4 w-4 ${bucketStatus === 'checking' ? 'animate-spin' : ''}`} />
              </button>
            </div>
            
            {bucketStatus === 'ready' && (
              <p className="text-sm text-green-700 mt-1">
               
              </p>
            )}
                      </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {selectedFile && (
            <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg text-sm flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 flex-shrink-0" />
              <span>Arquivo selecionado: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
            </div>
          )}

          {/* Progress Bar */}
          {isLoading && uploadProgress > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-900">Progresso do Upload</span>
                <span className="text-sm text-blue-700">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {!document && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Upload className="inline h-4 w-4 mr-1" />
                Arquivo
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv"
                  disabled={isLoading || bucketStatus !== 'ready'}
                />
                <label htmlFor="file-upload" className={`cursor-pointer ${isLoading || bucketStatus !== 'ready' ? 'pointer-events-none opacity-50' : ''}`}>
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-900">
                      {selectedFile ? selectedFile.name : 'Clique para selecionar um arquivo'}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      PDF, DOC, XLS, PPT, PNG, JPG, GIF, TXT, CSV até 10MB
                    </p>
                    {selectedFile && (
                      <p className="text-xs text-blue-600 mt-2">
                        Tamanho: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    )}
                  </div>
                </label>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FileText className="inline h-4 w-4 mr-1" />
              Nome do Documento
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Nome do documento"
              disabled={isLoading}
            />
          </div>

          {/* Tipo de Vinculação - Interface Melhorada */}
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              <FileText className="inline h-4 w-4 mr-1" />
              Tipo de Documento
            </label>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Documento Avulso */}
              <button
                type="button"
                onClick={() => {
                  setLinkType('none');
                  setFormData({ ...formData, contractId: '', category: 'Outros' });
                }}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  linkType === 'none'
                    ? 'border-blue-500 bg-blue-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
                disabled={isLoading}
              >
                <div className="flex items-start space-x-3">
                  <div className={`p-2 rounded-lg ${
                    linkType === 'none' ? 'bg-blue-100' : 'bg-gray-100'
                  }`}>
                    <FileText className={`h-5 w-5 ${
                      linkType === 'none' ? 'text-blue-600' : 'text-gray-600'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <h4 className={`font-medium text-sm ${
                      linkType === 'none' ? 'text-blue-900' : 'text-gray-900'
                    }`}>
                      Documento Avulso
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">
                      Não vinculado a contratos ou aditivos
                    </p>
                  </div>
                </div>
              </button>

              {/* Documento Principal de Contrato */}
              <button
                type="button"
                onClick={() => {
                  setLinkType('contract');
                  setFormData({ ...formData, contractId: '', category: 'Contrato' });
                }}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  linkType === 'contract'
                    ? 'border-blue-500 bg-blue-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
                disabled={isLoading}
              >
                <div className="flex items-start space-x-3">
                  <div className={`p-2 rounded-lg ${
                    linkType === 'contract' ? 'bg-blue-100' : 'bg-gray-100'
                  }`}>
                    <Building className={`h-5 w-5 ${
                      linkType === 'contract' ? 'text-blue-600' : 'text-gray-600'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <h4 className={`font-medium text-sm ${
                      linkType === 'contract' ? 'text-blue-900' : 'text-gray-900'
                    }`}>
                      Documento Principal do Contrato
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">
                      O próprio contrato ou locação
                    </p>
                  </div>
                </div>
              </button>

              {/* Outros Documentos Relacionados a Contratos */}
              <button
                type="button"
                onClick={() => {
                  setLinkType('contract_related');
                  setFormData({ ...formData, contractId: '', category: 'Habilitação' });
                }}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  linkType === 'contract_related'
                    ? 'border-green-500 bg-green-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
                disabled={isLoading}
              >
                <div className="flex items-start space-x-3">
                  <div className={`p-2 rounded-lg ${
                    linkType === 'contract_related' ? 'bg-green-100' : 'bg-gray-100'
                  }`}>
                    <Tag className={`h-5 w-5 ${
                      linkType === 'contract_related' ? 'text-green-600' : 'text-gray-600'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <h4 className={`font-medium text-sm ${
                      linkType === 'contract_related' ? 'text-green-900' : 'text-gray-900'
                    }`}>
                      Outro Documento de Contrato
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">
                      Habilitação, Nota Fiscal, Certidão, etc.
                    </p>
                  </div>
                </div>
              </button>

              {/* Documento de Termo Aditivo */}
              <button
                type="button"
                onClick={() => {
                  setLinkType('addendum');
                  setFormData({ ...formData, contractId: '', category: 'Termo Aditivo' });
                }}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  linkType === 'addendum'
                    ? 'border-purple-500 bg-purple-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
                disabled={isLoading}
              >
                <div className="flex items-start space-x-3">
                  <div className={`p-2 rounded-lg ${
                    linkType === 'addendum' ? 'bg-purple-100' : 'bg-gray-100'
                  }`}>
                    <FileText className={`h-5 w-5 ${
                      linkType === 'addendum' ? 'text-purple-600' : 'text-gray-600'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <h4 className={`font-medium text-sm ${
                      linkType === 'addendum' ? 'text-purple-900' : 'text-gray-900'
                    }`}>
                      Termo Aditivo/Apostilamento
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">
                      Documentos de aditivos e apostilamentos
                    </p>
                  </div>
                </div>
              </button>
            </div>

            {/* Campos de Vinculação - Aparecem condicionalmente */}
            {(linkType === 'contract' || linkType === 'contract_related') && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Building className="inline h-4 w-4 mr-1" />
                  {linkType === 'contract' ? 'Selecione o Contrato *' : 'Selecione o Contrato Relacionado *'}
                </label>
                <ContractSearchSelect
                  contracts={contracts}
                  value={formData.contractId}
                  onChange={(contractId) => setFormData({ ...formData, contractId })}
                  placeholder={linkType === 'contract' ? "Selecione o contrato" : "Selecione o contrato relacionado"}
                  required
                  disabled={isLoading}
                />
                <p className="mt-2 text-xs text-gray-600">
                  {linkType === 'contract' 
                    ? '📄 Este documento será vinculado diretamente ao contrato selecionado'
                    : '📎 Este documento será vinculado ao contrato selecionado (ex: Habilitação, Nota Fiscal, etc.)'}
                </p>
              </div>
            )}

            {linkType === 'addendum' && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FileText className="inline h-4 w-4 mr-1" />
                  Selecione o Termo Aditivo/Apostilamento *
                </label>
                <AddendumSearchSelect
                  addendums={addendums}
                  value={formData.contractId}
                  onChange={(addendumId) => setFormData({ ...formData, contractId: addendumId })}
                  placeholder="Selecione o termo aditivo/apostilamento"
                  required
                  disabled={isLoading}
                />
                <p className="mt-2 text-xs text-gray-600">
                  📝 Este documento será vinculado ao termo aditivo ou apostilamento selecionado
                </p>
              </div>
            )}

            {linkType === 'none' && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-600">
                  📋 Este documento não será vinculado a nenhum contrato ou aditivo. Documento administrativo geral.
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Tag className="inline h-4 w-4 mr-1" />
                Categoria
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
              >
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Arquivo
              </label>
              <input
                type="text"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="pdf"
                readOnly={!!selectedFile}
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tamanho (bytes)
              </label>
              <input
                type="number"
                value={formData.size}
                onChange={(e) => setFormData({ ...formData, size: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
                readOnly={!!selectedFile}
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Mostrar URL do arquivo se disponível */}
          {formData.url && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                URL do Arquivo
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="https://exemplo.com/documento.pdf"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => window.open(formData.url, '_blank')}
                  className="px-3 py-2 text-blue-600 hover:text-blue-800 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
                  disabled={isLoading}
                >
                  Testar
                </button>
              </div>
            </div>
          )}



          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading || (!document && !selectedFile) || bucketStatus !== 'ready'}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center space-x-2 transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>
                    {uploadProgress > 0 && uploadProgress < 100 ? `Enviando... ${uploadProgress}%` : 'Salvando...'}
                  </span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Salvar</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    window.document.body
  );
}

