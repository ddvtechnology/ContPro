import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, FileText, Calendar, DollarSign, Edit3 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatDateForInput, formatDateForDB, getCurrentDate } from '../../utils/dateUtils';
import { formatCurrencyInput, parseCurrencyInput, handleCurrencyInput } from '../../utils/currencyUtils';
import ContractSearchSelect from '../Common/ContractSearchSelect';

interface AddendumFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  addendum?: any;
}

export default function AddendumForm({ isOpen, onClose, onSave, addendum }: AddendumFormProps) {
  const [formData, setFormData] = useState({
    contractId: '',
    number: '',
    type: 'valor' as 'valor' | 'prazo' | 'vigencia' | 'apostilamento',
    description: '',
    value: '',
    newEndDate: '',
    date: ''
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchContracts();
    }
  }, [isOpen]);

  useEffect(() => {
    if (addendum) {
      setFormData({
        contractId: addendum.contract_id || '',
        number: addendum.number,
        type: addendum.type,
        description: addendum.description,
        value: addendum.value ? formatCurrencyInput(addendum.value) : '',
        newEndDate: formatDateForInput(addendum.new_end_date),
        date: formatDateForInput(addendum.date)
      });
    } else {
      setFormData({
        contractId: '',
        number: '',
        type: 'valor',
        description: '',
        value: '',
        newEndDate: '',
        date: getCurrentDate()
      });
    }
    setSelectedFiles([]);
  }, [addendum, isOpen]);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const uploadFileToStorage = async (file: File) => {
    // Usar o nome original do arquivo, sanitizado
    const fileExtension = file.name.split('.').pop() || 'pdf';
    const originalName = file.name.replace(/\.[^/.]+$/, ''); // Remove extensão
    
    // Sanitizar o nome para evitar caracteres especiais
    const sanitizedName = originalName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres especiais
      .replace(/\s+/g, '-') // Substitui espaços por hífens
      .substring(0, 100); // Limita tamanho
    
    // Gerar nome único garantindo que não haja duplicatas
    // Usar timestamp + número aleatório para garantir unicidade mesmo em uploads simultâneos
    const generateUniqueFileName = (baseName: string, extension: string, attempt: number = 0): string => {
      const timestamp = Date.now();
      const randomSuffix = Math.floor(Math.random() * 1000000); // 0-999999
      const uniqueSuffix = attempt > 0 ? `${timestamp}_${randomSuffix}_${attempt}` : `${timestamp}_${randomSuffix}`;
      return `${baseName}_${uniqueSuffix}.${extension}`;
    };
    
    // Gerar nome único desde o início usando timestamp + random
    // Isso garante que mesmo com múltiplos uploads simultâneos, os nomes serão únicos
    let filePath = `addendums/${generateUniqueFileName(sanitizedName, fileExtension)}`;
    let attempts = 0;
    let uploadSuccess = false;
    const maxAttempts = 10; // Aumentar tentativas para garantir sucesso
    
    while (attempts < maxAttempts && !uploadSuccess) {
      // Tentar upload diretamente
      // O nome já é único devido ao timestamp + random, mas tratamos erros de duplicata como segurança
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || 'application/octet-stream'
        });

      if (!uploadError) {
        uploadSuccess = true;
        break;
      }

      // Se for erro de duplicata (improvável, mas possível em casos extremos), gerar novo nome único
      if (uploadError.message.includes('duplicate') || 
          uploadError.message.includes('already exists') || 
          uploadError.message.includes('The resource already exists')) {
        attempts++;
        // Gerar novo nome com timestamp atualizado + random + número de tentativa
        filePath = `addendums/${generateUniqueFileName(sanitizedName, fileExtension, attempts)}`;
        continue;
      }

      // Outros erros
      if (uploadError) {
        throw uploadError;
      }
    }

    if (!uploadSuccess) {
      throw new Error('Não foi possível fazer upload do arquivo após várias tentativas. Tente novamente.');
    }

    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath);

    return {
      name: file.name, // Nome original para exibição no banco
      type: file.type,
      size: file.size,
      url: publicUrl
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Validações obrigatórias
    if (!formData.contractId) {
      setError('Por favor, selecione um contrato');
      setIsLoading(false);
      return;
    }

    if (!formData.number.trim()) {
      setError('Por favor, informe o número do termo aditivo');
      setIsLoading(false);
      return;
    }

    if (!formData.description.trim()) {
      setError('Por favor, informe a descrição');
      setIsLoading(false);
      return;
    }

    if (!formData.date) {
      setError('Por favor, informe a data');
      setIsLoading(false);
      return;
    }

    // Validações específicas por tipo
    if (formData.type === 'valor') {
      const parsedValue = parseCurrencyInput(formData.value);
      if (!formData.value || parsedValue <= 0) {
        setError('Por favor, informe um valor válido para o aditivo de valor');
        setIsLoading(false);
        return;
      }
    }

    if ((formData.type === 'prazo' || formData.type === 'vigencia') && !formData.newEndDate) {
      setError('Por favor, informe a nova data de término');
      setIsLoading(false);
      return;
    }

    try {
      const addendumData = {
        contract_id: formData.contractId,
        number: formData.number.trim(),
        type: formData.type,
        description: formData.description.trim(),
        value: formData.type === 'valor' ? parseCurrencyInput(formData.value) : null,
        new_end_date: (formData.type === 'prazo' || formData.type === 'vigencia') ? formatDateForDB(formData.newEndDate) : null,
        date: formatDateForDB(formData.date)
      };

      let addendumId: string;

      if (addendum) {
        const { data, error } = await supabase
          .from('addendums')
          .update(addendumData)
          .eq('id', addendum.id)
          .select('id')
          .single();

        if (error) throw error;
        addendumId = data.id;
      } else {
        const { data, error } = await supabase
          .from('addendums')
          .insert(addendumData)
          .select('id')
          .single();

        if (error) throw error;
        addendumId = data.id;
      }

      // Upload de arquivos se houver
      if (selectedFiles.length > 0 && addendumId) {
        for (const file of selectedFiles) {
          const uploaded = await uploadFileToStorage(file);
          await supabase.from('documents').insert({
            addendum_id: addendumId,
            name: uploaded.name,
            type: uploaded.type,
            category: 'Termo Aditivo',
            size: uploaded.size,
            url: uploaded.url,
            upload_date: new Date().toISOString().split('T')[0]
          });
        }
      }

      onSave();
      onClose();
    } catch (error: any) {
      console.error('Erro ao salvar aditivo:', error);
      setError(error.message || 'Erro ao salvar aditivo');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  if (typeof window === 'undefined' || !window.document?.body) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative">
        <div className="sticky top-0 bg-white border-b border-gray-200 z-10 flex items-center justify-between p-6">
          <h2 className="text-xl font-semibold text-gray-900">
            {addendum ? 'Editar Termo Aditivo' : 'Novo Documento'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg flex-shrink-0"
            aria-label="Fechar"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FileText className="inline h-4 w-4 mr-1" />
                Número do Aditivo
              </label>
              <input
                type="text"
                required
                value={formData.number}
                onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="AD001/2024"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Edit3 className="inline h-4 w-4 mr-1" />
                Contrato
              </label>
              <ContractSearchSelect
                contracts={contracts}
                value={formData.contractId}
                onChange={(contractId) => setFormData({ ...formData, contractId })}
                placeholder="Selecione um contrato"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Edit3 className="inline h-4 w-4 mr-1" />
              Tipo de Documento
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="valor">Aditivo de Valor (acréscimo/supressão até 25%)</option>
              <option value="prazo">Aditivo de Prazo (prorrogação de execução)</option>
              <option value="vigencia">Apostilamento de Vigência (prorrogação prevista)</option>
              <option value="apostilamento">Apostilamento (alterações não-substantivas)</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              {formData.type === 'valor' && '💰 Altera o valor final do contrato'}
              {formData.type === 'prazo' && '⏱️ Altera o prazo de execução (por justificativa)'}
              {formData.type === 'vigencia' && '📅 Altera a vigência (prorrogação anual prevista)'}
              {formData.type === 'apostilamento' && '📝 Alterações de dados cadastrais, reajuste, etc.'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descrição
            </label>
            <textarea
              required
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Descrição detalhada do aditivo..."
            />
          </div>

          {formData.type === 'valor' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <DollarSign className="inline h-4 w-4 mr-1" />
                Valor do Aditivo
              </label>
              <input
                type="text"
                required
                value={formData.value}
                onChange={(e) => {
                  const formatted = handleCurrencyInput(e.target.value);
                  setFormData({ ...formData, value: formatted });
                }}
                onBlur={(e) => {
                  // Garantir formatação completa ao sair do campo
                  if (e.target.value) {
                    const numValue = parseCurrencyInput(e.target.value);
                    setFormData({ ...formData, value: formatCurrencyInput(numValue) });
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0,00"
              />
            </div>
          )}

          {(formData.type === 'prazo' || formData.type === 'vigencia') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="inline h-4 w-4 mr-1" />
                Nova Data de Término
              </label>
              <input
                type="date"
                required
                value={formData.newEndDate}
                onChange={(e) => setFormData({ ...formData, newEndDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">
                {formData.type === 'prazo' && 'Novo prazo de execução do contrato'}
                {formData.type === 'vigencia' && 'Nova data de vigência do contrato'}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="inline h-4 w-4 mr-1" />
              Data do Aditivo
            </label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Upload de Arquivos */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Anexar Arquivos (Opcional)
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-gray-400 transition-colors">
              <div className="space-y-1 text-center">
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <div className="flex text-sm text-gray-600">
                  <label
                    htmlFor="file-upload"
                    className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                  >
                    <span>Selecionar arquivos</span>
                    <input
                      id="file-upload"
                      name="file-upload"
                      type="file"
                      multiple
                      className="sr-only"
                      onChange={handleFileChange}
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                    />
                  </label>
                  <p className="pl-1">ou arrastar e soltar</p>
                </div>
                <p className="text-xs text-gray-500">
                  PDF, DOC, XLS, JPG até 10MB cada
                </p>
              </div>
            </div>
            {selectedFiles.length > 0 && (
              <div className="mt-2">
                <p className="text-sm font-medium text-gray-700 mb-2">Arquivos selecionados:</p>
                <ul className="space-y-1">
                  {selectedFiles.map((file, index) => (
                    <li key={index} className="flex items-center justify-between text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded">
                      <span className="flex items-center">
                        <FileText className="h-4 w-4 mr-2" />
                        {file.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedFiles(selectedFiles.filter((_, i) => i !== index))}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center space-x-2 transition-colors disabled:opacity-50"
            >
              <Edit3 className="h-4 w-4" />
              <span>{isLoading ? 'Salvando...' : (addendum ? 'Atualizar' : 'Salvar Documento')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    window.document.body
  );
}