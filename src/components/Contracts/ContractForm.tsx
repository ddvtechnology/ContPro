import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Calendar, DollarSign, FileText, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Contract } from '../../types';
import { formatDateForInput, formatDateForDB, getCurrentDate } from '../../utils/dateUtils';
import { formatCurrencyInput, parseCurrencyInput } from '../../utils/currencyUtils';

interface ContractFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  contract?: Contract | null;
}

export default function ContractForm({ isOpen, onClose, onSave, contract }: ContractFormProps) {
  const [formData, setFormData] = useState({
    number: '',
    object: '',
    contractor: '',
    value: '',
    startDate: '',
    endDate: '',
    status: 'ativo' as 'ativo' | 'suspenso' | 'encerrado',
    category: 'Outros'
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (contract) {
      setFormData({
        number: contract.number,
        object: contract.object,
        contractor: contract.contractor,
        value: formatCurrencyInput(contract.value),
        startDate: formatDateForInput(contract.startDate),
        endDate: formatDateForInput(contract.endDate),
        status: contract.status,
        category: contract.category
      });
    } else {
      setFormData({
        number: '',
        object: '',
        contractor: '',
        value: '',
        startDate: getCurrentDate(),
        endDate: '',
        status: 'ativo',
        category: 'Outros'
      });
    }
    setSelectedFiles([]);
  }, [contract, isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const uploadFileToStorage = async (file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `contracts/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file);

    if (uploadError) {
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath);

    return {
      name: file.name,
      type: file.type,
      size: file.size,
      url: publicUrl
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const contractData = {
        number: formData.number,
        object: formData.object,
        contractor: formData.contractor,
        value: parseCurrencyInput(formData.value),
        start_date: formatDateForDB(formData.startDate),
        end_date: formatDateForDB(formData.endDate),
        status: formData.status,
        category: formData.category
      };

      let contractId: string;

      if (contract) {
        // Update existing contract
        const { data, error } = await supabase
          .from('contracts')
          .update(contractData)
          .eq('id', contract.id)
          .select('id')
          .single();

        if (error) throw error;
        contractId = data.id;
      } else {
        // Create new contract
        const { data, error } = await supabase
          .from('contracts')
          .insert(contractData)
          .select('id')
          .single();

        if (error) throw error;
        contractId = data.id;
      }

      // Upload de arquivos se houver
      if (selectedFiles.length > 0 && contractId) {
        for (const file of selectedFiles) {
          const uploaded = await uploadFileToStorage(file);
          await supabase.from('documents').insert({
            contract_id: contractId,
            name: uploaded.name,
            type: uploaded.type,
            category: 'Contrato',
            size: uploaded.size,
            url: uploaded.url,
            upload_date: formatDateForDB(new Date())
          });
        }
      }

      onSave();
      onClose();
    } catch (error: any) {
      console.error('Erro ao salvar contrato:', error);
      setError(error.message || 'Erro ao salvar contrato');
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
            {contract ? 'Editar Contrato' : 'Novo Contrato'}
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
                Número do Contrato
              </label>
              <input
                type="text"
                required
                value={formData.number}
                onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="001/2024"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <DollarSign className="inline h-4 w-4 mr-1" />
                Valor
              </label>
              <input
                type="text"
                required
                value={formData.value}
                onChange={(e) => {
                  const formatted = formatCurrencyInput(e.target.value);
                  setFormData({ ...formData, value: formatted });
                }}
                onBlur={(e) => {
                  // Garantir formatação completa ao sair do campo
                  const numValue = parseCurrencyInput(e.target.value);
                  setFormData({ ...formData, value: formatCurrencyInput(numValue) });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0,00"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Objeto do Contrato
            </label>
            <textarea
              required
              rows={3}
              value={formData.object}
              onChange={(e) => setFormData({ ...formData, object: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Descrição detalhada do objeto do contrato..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <User className="inline h-4 w-4 mr-1" />
              Contratado
            </label>
            <input
              type="text"
              required
              value={formData.contractor}
              onChange={(e) => setFormData({ ...formData, contractor: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Nome da empresa contratada"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="inline h-4 w-4 mr-1" />
                Data de Início
              </label>
              <input
                type="date"
                required
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="inline h-4 w-4 mr-1" />
                Data de Término
              </label>
              <input
                type="date"
                required
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="ativo">Ativo</option>
                <option value="suspenso">Suspenso</option>
                <option value="encerrado">Encerrado</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Categoria
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="Material">Material</option>
                <option value="Serviços">Serviços</option>
                <option value="Locação de Imóvel">Locação de Imóvel</option>
                <option value="Tecnologia">Tecnologia</option>
                <option value="Obras">Obras</option>
                <option value="Consultoria">Consultoria</option>
                <option value="Outros">Outros</option>
              </select>
            </div>
          </div>

          {/* Upload de Arquivos (Opcional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FileText className="inline h-4 w-4 mr-1" />
              Anexar Documentos (Opcional)
            </label>
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {selectedFiles.length > 0 && (
              <div className="mt-2">
                <p className="text-sm text-gray-600 mb-1">{selectedFiles.length} arquivo(s) selecionado(s):</p>
                <ul className="text-xs text-gray-500 space-y-1">
                  {selectedFiles.map((file, index) => (
                    <li key={index} className="flex items-center">
                      <FileText className="h-3 w-3 mr-1" />
                      {file.name}
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
              <Save className="h-4 w-4" />
              <span>{isLoading ? 'Salvando...' : 'Salvar'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    window.document.body
  );
}