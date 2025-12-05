import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ContractItem, Order, Contract } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { formatDateForDisplay, getCurrentDate, formatDateForDB } from '../../utils/dateUtils';

interface OrderFormProps {
  item: ContractItem;
  onClose: () => void;
  onSuccess: () => void;
}

export default function OrderForm({ item, onClose, onSuccess }: OrderFormProps) {
  const { user } = useAuth();
  const [contract, setContract] = useState<Contract | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [formData, setFormData] = useState({
    orderNumber: '',
    quantity: 0,
    date: getCurrentDate(),
    requester: '',
    observation: ''
  });
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadContract();
    loadOrderHistory();
  }, [item]);

  const loadContract = async () => {
    try {
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .eq('id', item.contractId)
        .single();

      if (error) throw error;
      setContract(data);
    } catch (error) {
      console.error('Erro ao carregar contrato:', error);
    }
  };

  const loadOrderHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('itemId', item.id)
        .order('date', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.quantity <= 0) {
      alert('A quantidade deve ser maior que zero');
      return;
    }

    if (formData.quantity > item.currentQuantity) {
      alert('A quantidade solicitada excede o estoque disponível');
      return;
    }

    setLoading(true);

    try {
      const currentDate = formatDateForDB(new Date());
      
      // Criar o pedido
      const orderData = {
        contractId: item.contractId,
        itemId: item.id,
        orderNumber: formData.orderNumber,
        quantity: formData.quantity,
        date: formData.date,
        requester: formData.requester,
        observation: formData.observation,
        createdBy: user?.id || '',
        createdAt: currentDate
      };

      const { error: orderError } = await supabase
        .from('orders')
        .insert([orderData]);

      if (orderError) throw orderError;

      // Atualizar a quantidade atual do item
      const newQuantity = item.currentQuantity - formData.quantity;
      const { error: updateError } = await supabase
        .from('contract_items')
        .update({ 
          currentQuantity: newQuantity,
          updatedAt: currentDate
        })
        .eq('id', item.id);

      if (updateError) throw updateError;

      alert('Pedido registrado com sucesso!');
      onSuccess();
    } catch (error: any) {
      console.error('Erro ao registrar pedido:', error);
      alert(`Erro ao registrar pedido: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const totalOrdered = orders.reduce((sum, order) => sum + order.quantity, 0);

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Registrar Pedido
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Informações do Item */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-900 mb-2">Informações do Item</h3>
            <div className="space-y-1 text-sm text-blue-800">
              <p><strong>Item:</strong> {item.name}</p>
              {item.description && <p><strong>Descrição:</strong> {item.description}</p>}
              <p><strong>Contrato:</strong> {contract?.number} - {contract?.object}</p>
              <p><strong>Estoque Disponível:</strong> {item.currentQuantity.toLocaleString('pt-BR')} {item.unit}</p>
              {item.currentQuantity <= item.minimumStock && (
                <div className="flex items-center text-yellow-700 mt-2">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  <span>Estoque baixo ou esgotado!</span>
                </div>
              )}
            </div>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número do Pedido *
                </label>
                <input
                  type="text"
                  value={formData.orderNumber}
                  onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                  required
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Ex: PED-2024-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data do Pedido *
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantidade *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={item.currentQuantity}
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                    required
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                    {item.unit}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Máximo: {item.currentQuantity.toLocaleString('pt-BR')} {item.unit}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Solicitante *
                </label>
                <input
                  type="text"
                  value={formData.requester}
                  onChange={(e) => setFormData({ ...formData, requester: e.target.value })}
                  required
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Nome do solicitante"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observação
              </label>
              <textarea
                value={formData.observation}
                onChange={(e) => setFormData({ ...formData, observation: e.target.value })}
                rows={3}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Observações sobre o pedido..."
              />
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
                disabled={loading || item.currentQuantity === 0}
                className="px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Registrando...' : 'Registrar Pedido'}
              </button>
            </div>
          </form>

          {/* Histórico de Pedidos */}
          <div className="border-t pt-4">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              {showHistory ? 'Ocultar' : 'Mostrar'} Histórico de Pedidos ({orders.length})
            </button>

            {showHistory && orders.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="bg-gray-50 rounded-lg p-3 mb-3">
                  <p className="text-sm text-gray-700">
                    <strong>Total solicitado:</strong> {totalOrdered.toLocaleString('pt-BR')} {item.unit}
                  </p>
                </div>
                {orders.map((order) => (
                  <div key={order.id} className="bg-gray-50 rounded-lg p-3 text-sm">
                    <div className="flex justify-between mb-1">
                      <span className="font-medium">{order.orderNumber}</span>
                      <span className="text-gray-600">
                        {formatDateForDisplay(order.date)}
                      </span>
                    </div>
                    <div className="text-gray-700">
                      <p><strong>Quantidade:</strong> {order.quantity.toLocaleString('pt-BR')} {item.unit}</p>
                      <p><strong>Solicitante:</strong> {order.requester}</p>
                      {order.observation && (
                        <p className="text-gray-600 mt-1"><em>{order.observation}</em></p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

