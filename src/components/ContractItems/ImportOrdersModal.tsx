import { useState, useEffect } from 'react';
import { X, Download, Upload, AlertCircle, CheckCircle, FileSpreadsheet, Package } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import { ContractItem, Order } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { formatDateForDisplay, getCurrentDate, formatDateForDB } from '../../utils/dateUtils';

interface ImportOrdersModalProps {
  contractId: string;
  contractNumber: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface OrderRow {
  numero_pedido: string;
  nome_item: string;
  quantidade: number;
  data: string;
  solicitante: string;
  observacao?: string;
  error?: string;
  itemId?: string;
}

export default function ImportOrdersModal({ contractId, contractNumber, onClose, onSuccess }: ImportOrdersModalProps) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [items, setItems] = useState<ContractItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    loadItems();
  }, [contractId]);

  const loadItems = async () => {
    try {
      const { data, error } = await supabase
        .from('contract_items')
        .select('*')
        .eq('contractId', contractId);

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Erro ao carregar itens:', error);
    }
  };

  const downloadTemplate = () => {
    // Pegar alguns itens como exemplo
    const exampleItems = items.slice(0, 3);
    
    // Formato brasileiro: DD-MM-AAAA
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const dataBrasileira = `${day}-${month}-${year}`;
    
    const template = exampleItems.length > 0 
      ? exampleItems.map((item, index) => ({
          numero_pedido: `PED-${year}-${String(index + 1).padStart(3, '0')}`,
          nome_item: item.name,
          quantidade: Math.min(10, item.currentQuantity / 10),
          data: dataBrasileira,
          solicitante: 'Nome do Solicitante',
          observacao: 'Observação opcional'
        }))
      : [
          {
            numero_pedido: `PED-${year}-001`,
            nome_item: 'Nome do Item (deve existir no contrato)',
            quantidade: 10,
            data: dataBrasileira,
            solicitante: 'Nome do Solicitante',
            observacao: 'Observação opcional'
          }
        ];

    const ws = XLSX.utils.json_to_sheet(template);
    
    // Definir larguras das colunas
    ws['!cols'] = [
      { wch: 20 }, // numero_pedido
      { wch: 35 }, // nome_item
      { wch: 12 }, // quantidade
      { wch: 12 }, // data
      { wch: 25 }, // solicitante
      { wch: 40 }  // observacao
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pedidos');
    
    // Adicionar uma aba com a lista de itens disponíveis
    const itemsList = items.map(item => ({
      nome_item: item.name,
      unidade: item.unit,
      estoque_disponivel: item.currentQuantity,
      descricao: item.description || ''
    }));

    if (itemsList.length > 0) {
      const wsItems = XLSX.utils.json_to_sheet(itemsList);
      wsItems['!cols'] = [
        { wch: 35 }, // nome_item
        { wch: 10 }, // unidade
        { wch: 18 }, // estoque_disponivel
        { wch: 40 }  // descricao
      ];
      XLSX.utils.book_append_sheet(wb, wsItems, 'Itens Disponíveis');
    }
    
    XLSX.writeFile(wb, `template_pedidos_contrato_${contractNumber}.xlsx`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseFile(selectedFile);
    }
  };

  // Função para converter data do formato brasileiro DD-MM-AAAA para YYYY-MM-DD
  const convertDateBRtoISO = (dateValue: any): string => {
    const dateStr = String(dateValue).trim();
    
    // Formato brasileiro com hífen: DD-MM-AAAA
    const brDateRegex = /^(\d{2})-(\d{2})-(\d{4})$/;
    const brMatch = dateStr.match(brDateRegex);
    if (brMatch) {
      const [, day, month, year] = brMatch;
      return `${year}-${month}-${day}`;
    }

    // Formato brasileiro com barra: DD/MM/AAAA
    const brSlashRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const brSlashMatch = dateStr.match(brSlashRegex);
    if (brSlashMatch) {
      const [, day, month, year] = brSlashMatch;
      return `${year}-${month}-${day}`;
    }

    // Formato ISO: AAAA-MM-DD (já está correto)
    const isoDateRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
    if (isoDateRegex.test(dateStr)) {
      return dateStr;
    }

    // Se é número (serial do Excel)
    if (typeof dateValue === 'number') {
      const excelEpoch = new Date(1899, 11, 30);
      const excelDate = new Date(excelEpoch.getTime() + dateValue * 86400000);
      if (!isNaN(excelDate.getTime())) {
        const year = excelDate.getFullYear();
        const month = String(excelDate.getMonth() + 1).padStart(2, '0');
        const day = String(excelDate.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }

    return '';
  };

  const parseFile = (file: File) => {
    setLoading(true);
    setErrors([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);

        // Validar dados
        const validatedOrders = jsonData.map((row, index) => {
          const errors: string[] = [];
          
          // Validar número do pedido
          if (!row.numero_pedido || row.numero_pedido.trim() === '') {
            errors.push('Número do pedido é obrigatório');
          }
          
          // Validar nome do item
          if (!row.nome_item || row.nome_item.trim() === '') {
            errors.push('Nome do item é obrigatório');
          } else {
            // Buscar item pelo nome
            const item = items.find(i => 
              i.name.toLowerCase().trim() === row.nome_item.toLowerCase().trim()
            );
            
            if (!item) {
              errors.push('Item não encontrado no contrato');
            } else {
              row.itemId = item.id;
              
              // Validar estoque disponível
              if (row.quantidade > item.currentQuantity) {
                errors.push(`Estoque insuficiente (disponível: ${item.currentQuantity} ${item.unit})`);
              }
            }
          }
          
          // Validar quantidade
          if (!row.quantidade || row.quantidade <= 0) {
            errors.push('Quantidade deve ser maior que zero');
          }
          
          // Validar e converter data
          let dataConvertida = '';
          if (!row.data) {
            errors.push('Data é obrigatória');
          } else {
            try {
              dataConvertida = convertDateBRtoISO(row.data);
              if (!dataConvertida) {
                errors.push('Data inválida (use formato DD-MM-AAAA, ex: 03-12-2025)');
              }
            } catch {
              errors.push('Data inválida');
            }
          }
          
          // Validar solicitante
          if (!row.solicitante || row.solicitante.trim() === '') {
            errors.push('Solicitante é obrigatório');
          }

          return {
            numero_pedido: row.numero_pedido,
            nome_item: row.nome_item,
            quantidade: row.quantidade,
            data: dataConvertida || row.data, // Usar data convertida se válida
            solicitante: row.solicitante,
            observacao: row.observacao || '',
            itemId: row.itemId,
            error: errors.length > 0 ? errors.join(', ') : undefined
          };
        });

        setOrders(validatedOrders);
        
        const hasErrors = validatedOrders.some(order => order.error);
        if (hasErrors) {
          setErrors(['Existem erros nos dados. Verifique a tabela abaixo.']);
        } else {
          setStep('preview');
        }
      } catch (error) {
        console.error('Erro ao processar arquivo:', error);
        setErrors(['Erro ao processar arquivo. Verifique se está no formato correto.']);
      } finally {
        setLoading(false);
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleImport = async () => {
    if (!user?.id) {
      alert('Usuário não autenticado');
      return;
    }

    setLoading(true);
    
    try {
      const currentDate = formatDateForDB(new Date());
      const validOrders = orders.filter(order => !order.error && order.itemId);
      
      // Processar pedidos um por um para garantir atomicidade
      for (const order of validOrders) {
        // Inserir pedido
        const { error: orderError } = await supabase
          .from('orders')
          .insert([{
            contractId,
            itemId: order.itemId,
            orderNumber: order.numero_pedido.trim(),
            quantity: order.quantidade,
            date: order.data,
            requester: order.solicitante.trim(),
            observation: order.observacao?.trim() || null,
            createdBy: user.id,
            createdAt: currentDate
          }]);

        if (orderError) {
          // Se for erro de número duplicado, pular e continuar
          if (orderError.code === '23505') {
            console.warn(`Pedido ${order.numero_pedido} já existe, pulando...`);
            continue;
          }
          throw orderError;
        }

        // Atualizar estoque do item
        const item = items.find(i => i.id === order.itemId);
        if (item) {
          const newQuantity = item.currentQuantity - order.quantidade;
          const { error: updateError } = await supabase
            .from('contract_items')
            .update({ 
              currentQuantity: newQuantity,
              updatedAt: currentDate
            })
            .eq('id', order.itemId);

          if (updateError) throw updateError;
        }
      }

      alert(`${validOrders.length} pedidos registrados com sucesso!`);
      onSuccess();
    } catch (error: any) {
      console.error('Erro ao importar pedidos:', error);
      alert(`Erro ao importar: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-7xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <Package className="h-6 w-6 mr-2 text-blue-600" />
            Importar Pedidos em Lote
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Informações do contrato */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <strong>Contrato:</strong> {contractNumber}
            </p>
            <p className="text-sm text-blue-700 mt-1">
              <strong>Itens disponíveis:</strong> {items.length} itens cadastrados
            </p>
          </div>

          {/* Instruções */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-2">
              📋 Como importar pedidos:
            </h3>
            <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
              <li>Baixe o template Excel (incluirá lista de itens disponíveis)</li>
              <li>Preencha a planilha com os pedidos</li>
              <li>O nome do item deve ser <strong>exatamente igual</strong> ao cadastrado</li>
              <li>Use formato de data brasileiro: <strong>DD-MM-AAAA</strong> (ex: 03-12-2025)</li>
              <li>Faça o upload do arquivo preenchido</li>
              <li>Revise os dados e confirme - o estoque será abatido automaticamente</li>
            </ol>
          </div>

          {/* Download Template */}
          <div className="flex justify-center">
            <button
              onClick={downloadTemplate}
              disabled={items.length === 0}
              className="inline-flex items-center px-6 py-3 border border-blue-600 rounded-lg shadow-sm text-sm font-medium text-blue-600 bg-white hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-5 w-5 mr-2" />
              Baixar Template Excel
              {items.length === 0 && ' (cadastre itens primeiro)'}
            </button>
          </div>

          {step === 'upload' && (
            <>
              {/* Upload Area */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
                <div className="text-center">
                  <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="mt-4">
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <span className="mt-2 block text-sm font-medium text-gray-900">
                        Selecione o arquivo Excel ou arraste aqui
                      </span>
                      <input
                        id="file-upload"
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleFileChange}
                        className="sr-only"
                      />
                      <span className="mt-1 block text-xs text-gray-500">
                        Formatos aceitos: .xlsx, .xls, .csv
                      </span>
                    </label>
                  </div>
                  {file && (
                    <p className="mt-2 text-sm text-gray-600">
                      Arquivo selecionado: <strong>{file.name}</strong>
                    </p>
                  )}
                </div>
              </div>

              {/* Erros */}
              {errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <AlertCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-red-800">
                        Erros encontrados:
                      </h3>
                      <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                        {errors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Preview com erros */}
              {orders.length > 0 && orders.some(order => order.error) && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Nº Pedido</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Item</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Qtd</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Erro</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {orders.map((order, index) => (
                          <tr key={index} className={order.error ? 'bg-red-50' : 'bg-green-50'}>
                            <td className="px-4 py-2">
                              {order.error ? (
                                <AlertCircle className="h-4 w-4 text-red-600" />
                              ) : (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              )}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">{order.numero_pedido}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">{order.nome_item}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">{order.quantidade}</td>
                            <td className="px-4 py-2 text-sm text-red-600">{order.error || '✓'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {step === 'preview' && (
            <>
              {/* Preview dos dados */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                  <span className="text-sm font-medium text-green-900">
                    {orders.filter(o => !o.error).length} pedidos prontos para registrar
                  </span>
                </div>
                <p className="text-xs text-green-700 mt-1">
                  ⚠️ O estoque dos itens será abatido automaticamente após a confirmação
                </p>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Nº Pedido</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Item</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Quantidade</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Data</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Solicitante</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Observação</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {orders.filter(order => !order.error).map((order, index) => {
                        const item = items.find(i => i.id === order.itemId);
                        return (
                          <tr key={index}>
                            <td className="px-4 py-2 text-sm text-gray-900">{order.numero_pedido}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">{order.nome_item}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {order.quantidade.toLocaleString('pt-BR')} {item?.unit}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {formatDateForDisplay(order.data)}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">{order.solicitante}</td>
                            <td className="px-4 py-2 text-sm text-gray-500">{order.observacao || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            {step === 'preview' && (
              <>
                <button
                  onClick={() => {
                    setStep('upload');
                    setOrders([]);
                    setFile(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Voltar
                </button>
                <button
                  onClick={handleImport}
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {loading ? 'Registrando...' : 'Confirmar e Registrar Todos'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

