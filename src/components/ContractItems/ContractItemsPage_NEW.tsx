import { useState, useEffect } from 'react';
import { Package, Plus, Search, AlertTriangle, ShoppingCart, Upload, FileDown, Trash2, CheckSquare, Square } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Contract, ContractItem } from '../../types';
import { formatDateForDisplay } from '../../utils/dateUtils';
import ContractSearchSelect from '../Common/ContractSearchSelect';
import ItemForm from './ItemForm';
import OrderForm from './OrderForm';
import ImportModal from './ImportModal';
import ImportOrdersModal from './ImportOrdersModal';
import DeleteConfirmModal from '../Common/DeleteConfirmModal';

export default function ContractItemsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [items, setItems] = useState<ContractItem[]>([]);
  const [selectedContract, setSelectedContract] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showItemForm, setShowItemForm] = useState(false);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showImportOrdersModal, setShowImportOrdersModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ContractItem | null>(null);
  const [orderingItem, setOrderingItem] = useState<ContractItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteModal, setDeleteModal] = useState<{ show: boolean; itemId: string | null }>({
    show: false,
    itemId: null
  });
  const [bulkDeleteModal, setBulkDeleteModal] = useState(false);

  useEffect(() => {
    loadContracts();
  }, []);

  useEffect(() => {
    if (selectedContract) {
      loadItems(selectedContract);
    } else {
      loadAllItems();
    }
    setSelectedIds(new Set()); // Limpar seleção ao mudar contrato
  }, [selectedContract]);

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

  const loadItems = async (contractId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('contract_items')
        .select('*')
        .eq('contractId', contractId)
        .order('name', { ascending: true });

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Erro ao carregar itens:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAllItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('contract_items')
        .select('*')
        .order('name', { ascending: true});

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Erro ao carregar itens:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!deleteModal.itemId) return;

    try {
      const { error } = await supabase
        .from('contract_items')
        .delete()
        .eq('id', deleteModal.itemId);

      if (error) throw error;

      if (selectedContract) {
        loadItems(selectedContract);
      } else {
        loadAllItems();
      }
      setDeleteModal({ show: false, itemId: null });
      alert('Item excluído com sucesso!');
    } catch (error: any) {
      console.error('Erro ao deletar item:', error);
      alert(`Erro ao deletar item: ${error.message}`);
    }
  };

  const handleBulkDelete = async () => {
    try {
      const idsArray = Array.from(selectedIds);
      const { error } = await supabase
        .from('contract_items')
        .delete()
        .in('id', idsArray);

      if (error) throw error;

      if (selectedContract) {
        loadItems(selectedContract);
      } else {
        loadAllItems();
      }
      setSelectedIds(new Set());
      setBulkDeleteModal(false);
      alert(`${idsArray.length} item(ns) excluído(s) com sucesso!`);
    } catch (error: any) {
      console.error('Erro ao deletar itens:', error);
      alert(`Erro ao deletar itens: ${error.message}`);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map(item => item.id)));
    }
  };

  const toggleSelectItem = (itemId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedIds(newSelected);
  };

  const handleEditItem = (item: ContractItem) => {
    setEditingItem(item);
    setShowItemForm(true);
  };

  const handleNewOrder = (item: ContractItem) => {
    setOrderingItem(item);
    setShowOrderForm(true);
  };

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStockStatus = (item: ContractItem) => {
    if (item.currentQuantity === 0) return 'out';
    if (item.currentQuantity <= item.minimumStock) return 'low';
    return 'ok';
  };

  const selectedContractData = contracts.find(c => c.id === selectedContract);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            Controle de Itens dos Contratos
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Gerencie os itens e controle o estoque de cada contrato
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {selectedIds.size > 0 && (
            <button
              onClick={() => setBulkDeleteModal(true)}
              className="inline-flex items-center px-4 py-2 border border-red-600 rounded-lg shadow-sm text-sm font-medium text-red-600 bg-white hover:bg-red-50 transition-colors"
              title="Excluir itens selecionados"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir ({selectedIds.size})
            </button>
          )}
          <button
            onClick={() => setShowImportModal(true)}
            disabled={!selectedContract}
            className="inline-flex items-center px-4 py-2 border border-blue-600 rounded-lg shadow-sm text-sm font-medium text-blue-600 bg-white hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Importar múltiplos itens de uma vez"
          >
            <Upload className="h-4 w-4 mr-2" />
            Importar Itens
          </button>
          <button
            onClick={() => setShowImportOrdersModal(true)}
            disabled={!selectedContract || items.length === 0}
            className="inline-flex items-center px-4 py-2 border border-green-600 rounded-lg shadow-sm text-sm font-medium text-green-600 bg-white hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Registrar múltiplos pedidos de uma vez"
          >
            <FileDown className="h-4 w-4 mr-2" />
            Importar Pedidos
          </button>
          <button
            onClick={() => {
              setEditingItem(null);
              setShowItemForm(true);
            }}
            disabled={!selectedContract}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Item
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contrato
            </label>
            <ContractSearchSelect
              contracts={contracts.map(c => ({
                id: c.id,
                number: c.number,
                contractor: c.contractor,
                status: c.status
              }))}
              value={selectedContract}
              onChange={(contractId) => setSelectedContract(contractId)}
              placeholder="Todos os contratos"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Buscar Item
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome ou descrição..."
                className="w-full pl-10 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Informações do contrato selecionado */}
      {selectedContractData && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-1">
              <h3 className="text-sm font-medium text-blue-900">
                Contrato: {selectedContractData.number}
              </h3>
              <p className="text-sm text-blue-700 mt-1">
                {selectedContractData.object}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Contratado: {selectedContractData.contractor}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Lista de itens */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <Package className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum item encontrado</h3>
            <p className="mt-1 text-sm text-gray-500">
              {selectedContract 
                ? 'Comece adicionando um novo item para este contrato.'
                : 'Selecione um contrato para adicionar itens.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <button
                      onClick={toggleSelectAll}
                      className="text-gray-400 hover:text-gray-600"
                      title={selectedIds.size === filteredItems.length ? 'Desmarcar todos' : 'Selecionar todos'}
                    >
                      {selectedIds.size === filteredItems.length ? (
                        <CheckSquare className="h-5 w-5" />
                      ) : (
                        <Square className="h-5 w-5" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Item
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unidade
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Qtd. Inicial
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Qtd. Atual
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredItems.map((item) => {
                  const status = getStockStatus(item);
                  const usedPercentage = ((item.initialQuantity - item.currentQuantity) / item.initialQuantity * 100).toFixed(1);
                  const isSelected = selectedIds.has(item.id);
                  
                  return (
                    <tr key={item.id} className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => toggleSelectItem(item.id)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          {isSelected ? (
                            <CheckSquare className="h-5 w-5 text-blue-600" />
                          ) : (
                            <Square className="h-5 w-5" />
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{item.name}</div>
                          {item.description && (
                            <div className="text-sm text-gray-500">{item.description}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.unit}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.initialQuantity.toLocaleString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {item.currentQuantity.toLocaleString('pt-BR')}
                        </div>
                        <div className="text-xs text-gray-500">
                          {usedPercentage}% utilizado
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {status === 'out' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Esgotado
                          </span>
                        )}
                        {status === 'low' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Baixo
                          </span>
                        )}
                        {status === 'ok' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            OK
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                        <button
                          onClick={() => handleNewOrder(item)}
                          className="text-blue-600 hover:text-blue-900 inline-flex items-center"
                          title="Registrar Pedido"
                        >
                          <ShoppingCart className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEditItem(item)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Editar"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => setDeleteModal({ show: true, itemId: item.id })}
                          className="text-red-600 hover:text-red-900"
                          title="Excluir"
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {showImportModal && selectedContract && (
        <ImportModal
          contractId={selectedContract}
          contractNumber={selectedContractData?.number || ''}
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            setShowImportModal(false);
            loadItems(selectedContract);
          }}
        />
      )}

      {showImportOrdersModal && selectedContract && (
        <ImportOrdersModal
          contractId={selectedContract}
          contractNumber={selectedContractData?.number || ''}
          onClose={() => setShowImportOrdersModal(false)}
          onSuccess={() => {
            setShowImportOrdersModal(false);
            if (selectedContract) {
              loadItems(selectedContract);
            } else {
              loadAllItems();
            }
          }}
        />
      )}

      {showItemForm && (
        <ItemForm
          item={editingItem}
          contractId={selectedContract}
          onClose={() => {
            setShowItemForm(false);
            setEditingItem(null);
          }}
          onSuccess={() => {
            setShowItemForm(false);
            setEditingItem(null);
            if (selectedContract) {
              loadItems(selectedContract);
            } else {
              loadAllItems();
            }
          }}
        />
      )}

      {showOrderForm && orderingItem && (
        <OrderForm
          item={orderingItem}
          onClose={() => {
            setShowOrderForm(false);
            setOrderingItem(null);
          }}
          onSuccess={() => {
            setShowOrderForm(false);
            setOrderingItem(null);
            if (selectedContract) {
              loadItems(selectedContract);
            } else {
              loadAllItems();
            }
          }}
        />
      )}

      {deleteModal.show && (
        <DeleteConfirmModal
          title="Excluir Item"
          message="Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita."
          onConfirm={handleDeleteItem}
          onCancel={() => setDeleteModal({ show: false, itemId: null })}
        />
      )}

      {bulkDeleteModal && (
        <DeleteConfirmModal
          title="Excluir Itens Selecionados"
          message={`Tem certeza que deseja excluir ${selectedIds.size} item(ns) selecionado(s)? Esta ação não pode ser desfeita.`}
          onConfirm={handleBulkDelete}
          onCancel={() => setBulkDeleteModal(false)}
        />
      )}
    </div>
  );
}

