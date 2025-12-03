import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ContractItem, Contract } from '../../types';
import { formatDateForDB } from '../../utils/dateUtils';

interface ItemFormProps {
  item: ContractItem | null;
  contractId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ItemForm({ item, contractId, onClose, onSuccess }: ItemFormProps) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [formData, setFormData] = useState({
    contractId: contractId || '',
    name: '',
    description: '',
    unit: 'un',
    initialQuantity: 0,
    currentQuantity: 0,
    minimumStock: 0,
    unitValue: 0
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadContracts();
    if (item) {
      setFormData({
        contractId: item.contractId,
        name: item.name,
        description: item.description || '',
        unit: item.unit,
        initialQuantity: item.initialQuantity,
        currentQuantity: item.currentQuantity,
        minimumStock: item.minimumStock,
        unitValue: item.unitValue || 0
      });
    }
  }, [item]);

  const loadContracts = async () => {
    try {
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .order('number', { ascending: true });

      if (error) throw error;
      setContracts(data || []);
    } catch (error) {
      console.error('Erro ao carregar contratos:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const currentDate = formatDateForDB(new Date());
      const itemData = {
        ...formData,
        updatedAt: currentDate
      };

      if (item) {
        // Atualizar item existente
        const { error } = await supabase
          .from('contract_items')
          .update(itemData)
          .eq('id', item.id);

        if (error) throw error;
      } else {
        // Criar novo item
        const { error } = await supabase
          .from('contract_items')
          .insert([{
            ...itemData,
            createdAt: currentDate
          }]);

        if (error) throw error;
      }

      onSuccess();
    } catch (error: any) {
      console.error('Erro ao salvar item:', error);
      alert(`Erro ao salvar item: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {item ? 'Editar Item' : 'Novo Item'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contrato *
            </label>
            <select
              value={formData.contractId}
              onChange={(e) => setFormData({ ...formData, contractId: e.target.value })}
              required
              disabled={!!contractId}
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Selecione um contrato</option>
              {contracts.map((contract) => (
                <option key={contract.id} value={contract.id}>
                  {contract.number} - {contract.object}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome do Item *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Ex: Cimento Portland"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descrição
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Descrição detalhada do item..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unidade de Medida *
              </label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                required
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="un">Unidade (un)</option>
                <option value="kg">Quilograma (kg)</option>
                <option value="g">Grama (g)</option>
                <option value="l">Litro (l)</option>
                <option value="ml">Mililitro (ml)</option>
                <option value="m">Metro (m)</option>
                <option value="m²">Metro Quadrado (m²)</option>
                <option value="m³">Metro Cúbico (m³)</option>
                <option value="cx">Caixa (cx)</option>
                <option value="pc">Pacote (pc)</option>
                <option value="sc">Saco (sc)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valor Unitário (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.unitValue}
                onChange={(e) => setFormData({ ...formData, unitValue: parseFloat(e.target.value) || 0 })}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantidade Inicial *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.initialQuantity}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  initialQuantity: parseFloat(e.target.value) || 0,
                  currentQuantity: item ? formData.currentQuantity : parseFloat(e.target.value) || 0
                })}
                required
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantidade Atual *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max={formData.initialQuantity}
                value={formData.currentQuantity}
                onChange={(e) => setFormData({ ...formData, currentQuantity: parseFloat(e.target.value) || 0 })}
                required
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estoque Mínimo *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.minimumStock}
                onChange={(e) => setFormData({ ...formData, minimumStock: parseFloat(e.target.value) || 0 })}
                required
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Alerta quando atingir este valor
              </p>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Salvando...' : item ? 'Atualizar' : 'Criar Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

