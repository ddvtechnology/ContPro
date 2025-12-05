import { useState } from 'react';
import { X, Download, Upload, AlertCircle, CheckCircle, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { supabase } from '../../lib/supabase';
import { formatDateForDB } from '../../utils/dateUtils';

interface ImportModalProps {
  contractId: string;
  contractNumber: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface ItemRow {
  nome: string;
  descricao: string;
  unidade: string;
  quantidade_inicial: number;
  estoque_minimo: number;
  valor_unitario?: number;
  error?: string;
}

export default function ImportModal({ contractId, contractNumber, onClose, onSuccess }: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [errors, setErrors] = useState<string[]>([]);

  const downloadTemplate = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      
      // Criar worksheet principal
      const worksheet = workbook.addWorksheet('Itens');
      
      // Definir larguras das colunas
      worksheet.columns = [
        { header: 'Nome', key: 'nome', width: 40 },
        { header: 'Descrição', key: 'descricao', width: 50 },
        { header: 'Unidade', key: 'unidade', width: 15 },
        { header: 'Quantidade Inicial', key: 'quantidade_inicial', width: 20 },
        { header: 'Estoque Mínimo', key: 'estoque_minimo', width: 18 },
        { header: 'Valor Unitário', key: 'valor_unitario', width: 18 }
      ];

      // Formatar cabeçalho (linha 1) - cor azul e negrito
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E40AF' } // Azul #1E40AF
      };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      headerRow.height = 30;
      
      // Adicionar bordas ao cabeçalho
      worksheet.getRow(1).eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } }
        };
      });

      // Dados de exemplo
      const exampleData = [
        {
          nome: 'Cimento Portland CP-II 50kg',
          descricao: 'Cimento para construção civil',
          unidade: 'sc',
          quantidade_inicial: 1000,
          estoque_minimo: 100,
          valor_unitario: 35.50
        },
        {
          nome: 'Areia Média',
          descricao: 'Areia para construção',
          unidade: 'm³',
          quantidade_inicial: 500,
          estoque_minimo: 50,
          valor_unitario: 80.00
        },
        {
          nome: 'Tijolo Cerâmico 8 furos',
          descricao: 'Tijolo para alvenaria',
          unidade: 'un',
          quantidade_inicial: 50000,
          estoque_minimo: 5000,
          valor_unitario: 0.85
        }
      ];

      // Adicionar dados de exemplo
      exampleData.forEach((row) => {
        const newRow = worksheet.addRow(row);
        newRow.height = 22;
        
        // Formatar células
        newRow.eachCell((cell, colNumber) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
          };
          
          // Formatação específica por coluna
          const columnKey = worksheet.getColumn(colNumber).key;
          if (columnKey === 'quantidade_inicial' || columnKey === 'estoque_minimo') {
            cell.numFmt = '#,##0';
          } else if (columnKey === 'valor_unitario') {
            cell.numFmt = '#,##0.00';
          }
        });
      });

      // Criar aba de Instruções
      const instructionsSheet = workbook.addWorksheet('Instruções');
      instructionsSheet.columns = [
        { header: 'Campo', key: 'campo', width: 35 },
        { header: 'Descrição', key: 'descricao', width: 75 }
      ];
      
      const instructions = [
        { campo: 'Instruções para preenchimento:', descricao: '' },
        { campo: '', descricao: '' },
        { campo: 'nome', descricao: 'Nome do item (obrigatório, sem duplicatas no mesmo contrato)' },
        { campo: 'descricao', descricao: 'Descrição detalhada do item (opcional)' },
        { campo: 'unidade', descricao: 'Unidade de medida (ex: sc, m³, un, kg, l, etc.) - obrigatório' },
        { campo: 'quantidade_inicial', descricao: 'Quantidade inicial em estoque (obrigatório, deve ser maior que zero)' },
        { campo: 'estoque_minimo', descricao: 'Quantidade mínima em estoque para alerta (opcional, padrão: 0)' },
        { campo: 'valor_unitario', descricao: 'Valor unitário do item em reais (opcional). Use formato numérico ou brasileiro (ex: 35.50 ou 35,50)' },
        { campo: '', descricao: '' },
        { campo: 'IMPORTANTE:', descricao: '' },
        { campo: '- Mantenha a primeira linha com os cabeçalhos', descricao: '' },
        { campo: '- Não altere os nomes das colunas', descricao: '' },
        { campo: '- Use formato brasileiro para valores: 1.000,50 (ponto para milhar, vírgula para decimal)', descricao: '' },
        { campo: '- O nome do item deve ser único no contrato', descricao: '' },
        { campo: '- Remova as linhas de exemplo antes de preencher seus dados', descricao: '' },
      ];
      
      instructions.forEach((inst) => {
        instructionsSheet.addRow(inst);
      });
      
      const instructionsHeaderRow = instructionsSheet.getRow(1);
      instructionsHeaderRow.font = { bold: true, size: 12 };
      instructionsHeaderRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      // Congelar primeira linha do worksheet principal
      worksheet.views = [{ state: 'frozen', ySplit: 1 }];

      // Gerar buffer e download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `template_itens_contrato_${contractNumber}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erro ao gerar template:', err);
      alert('Erro ao gerar template. Tente novamente.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseFile(selectedFile);
    }
  };

  // Função para converter valores do formato brasileiro para número
  const parseNumericValue = (value: any): number => {
    // Se já é número, retornar
    if (typeof value === 'number') {
      return value;
    }

    // Se for string
    if (typeof value === 'string') {
      const valueStr = String(value).trim();
      
      // Remover símbolos de moeda (R$, $, etc.) e espaços
      let valueCleaned = valueStr.replace(/[R$\s]/g, '');
      
      // Formato brasileiro: 1.000,50 (ponto = milhar, vírgula = decimal)
      // Formato internacional: 1,000.50 ou 1000.50 (vírgula = milhar, ponto = decimal)
      
      if (valueCleaned.includes(',') && valueCleaned.includes('.')) {
        // Tem ambos - verificar qual vem por último (geralmente é o decimal)
        const lastDot = valueCleaned.lastIndexOf('.');
        const lastComma = valueCleaned.lastIndexOf(',');
        
        if (lastComma > lastDot) {
          // Vírgula é o decimal: formato brasileiro 1.000,50
          valueCleaned = valueCleaned.replace(/\./g, '').replace(',', '.');
        } else {
          // Ponto é o decimal: formato internacional 1,000.50
          valueCleaned = valueCleaned.replace(/,/g, '');
        }
      } else if (valueCleaned.includes(',')) {
        // Só tem vírgula
        const parts = valueCleaned.split(',');
        if (parts.length === 2 && parts[1].length <= 2) {
          // Formato brasileiro: 1000,50 ou 1.000,50
          valueCleaned = valueCleaned.replace(/\./g, '').replace(',', '.');
        } else {
          // Separador de milhar, remover
          valueCleaned = valueCleaned.replace(/,/g, '');
        }
      }
      
      return parseFloat(valueCleaned) || 0;
    }
    
    return 0;
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

        if (!jsonData || jsonData.length === 0) {
          setErrors(['O arquivo está vazio ou não contém dados válidos.']);
          setLoading(false);
          return;
        }

        // Função para normalizar nomes de colunas
        const normalizeKey = (key: string) => {
          if (!key) return '';
          return key.toLowerCase()
            .trim()
            .replace(/\s+/g, '_')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
        };

        // Validar e converter dados
        const validatedItems = jsonData.map((row) => {
          const errors: string[] = [];
          
          // Normalizar nomes das colunas
          const normalizedRow: any = {};
          Object.keys(row).forEach(key => {
            normalizedRow[normalizeKey(key)] = row[key];
          });
          
          // Mapear diferentes variações de nomes de colunas
          const nome = normalizedRow.nome || row.Nome || row.nome;
          const descricao = normalizedRow.descricao || normalizedRow.descrição || row.Descrição || row.Descricao || row.descricao || '';
          const unidade = normalizedRow.unidade || row.Unidade || row.unidade;
          const quantidadeInicial = normalizedRow.quantidade_inicial || row['Quantidade Inicial'] || row.quantidade_inicial;
          const estoqueMinimo = normalizedRow.estoque_minimo || normalizedRow['estoque_mínimo'] || row['Estoque Mínimo'] || row.estoque_minimo;
          const valorUnitario = normalizedRow.valor_unitario || normalizedRow['valor_unitário'] || row['Valor Unitário'] || row.valor_unitario;
          
          // Converter valores numéricos
          const quantidadeInicialNum = parseNumericValue(quantidadeInicial);
          const estoqueMinimoNum = parseNumericValue(estoqueMinimo);
          const valorUnitarioNum = parseNumericValue(valorUnitario);
          
          if (!nome || String(nome).trim() === '') {
            errors.push('Nome é obrigatório');
          }
          
          if (!unidade || String(unidade).trim() === '') {
            errors.push('Unidade é obrigatória');
          }
          
          if (!quantidadeInicialNum || quantidadeInicialNum <= 0) {
            errors.push('Quantidade inicial deve ser maior que zero');
          }
          
          if (estoqueMinimoNum < 0) {
            errors.push('Estoque mínimo inválido');
          }

          return {
            nome: String(nome || '').trim(),
            descricao: String(descricao || '').trim(),
            unidade: String(unidade || '').trim(),
            quantidade_inicial: quantidadeInicialNum,
            estoque_minimo: estoqueMinimoNum,
            valor_unitario: valorUnitarioNum,
            error: errors.length > 0 ? errors.join(', ') : undefined
          };
        });

        setItems(validatedItems);
        
        const hasErrors = validatedItems.some(item => item.error);
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
    setLoading(true);
    
    try {
      const currentDate = formatDateForDB(new Date());
      const itemsToInsert = items
        .filter(item => !item.error)
        .map(item => ({
          contractId,
          name: item.nome.trim(),
          description: item.descricao?.trim() || null,
          unit: item.unidade.trim(),
          initialQuantity: item.quantidade_inicial,
          currentQuantity: item.quantidade_inicial, // Quantidade atual = inicial ao importar
          minimumStock: item.estoque_minimo,
          unitValue: item.valor_unitario || 0,
          createdAt: currentDate,
          updatedAt: currentDate
        }));

      const { error } = await supabase
        .from('contract_items')
        .insert(itemsToInsert);

      if (error) throw error;

      alert(`${itemsToInsert.length} itens importados com sucesso!`);
      onSuccess();
    } catch (error: any) {
      console.error('Erro ao importar itens:', error);
      alert(`Erro ao importar: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Importar Itens do Contrato
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
          </div>

          {/* Instruções */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-2">
              📋 Como importar itens:
            </h3>
            <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
              <li>Baixe o template Excel clicando no botão abaixo</li>
              <li>Preencha a planilha com os dados dos itens</li>
              <li>Faça o upload do arquivo preenchido</li>
              <li>Revise os dados e confirme a importação</li>
            </ol>
            <div className="mt-3 pt-3 border-t border-gray-300">
              <p className="text-xs text-gray-600">
                💡 <strong>Valores numéricos:</strong> Aceita formato brasileiro (1.000,50) ou internacional (1000.50)
              </p>
            </div>
          </div>

          {/* Download Template */}
          <div className="flex justify-center">
            <button
              onClick={downloadTemplate}
              className="inline-flex items-center px-6 py-3 border border-blue-600 rounded-lg shadow-sm text-sm font-medium text-blue-600 bg-white hover:bg-blue-50"
            >
              <Download className="h-5 w-5 mr-2" />
              Baixar Template Excel
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
              {items.length > 0 && items.some(item => item.error) && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Nome</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Unidade</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Qtd. Inicial</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Erro</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {items.map((item, index) => (
                          <tr key={index} className={item.error ? 'bg-red-50' : 'bg-green-50'}>
                            <td className="px-4 py-2">
                              {item.error ? (
                                <AlertCircle className="h-4 w-4 text-red-600" />
                              ) : (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              )}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">{item.nome}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">{item.unidade}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">{item.quantidade_inicial}</td>
                            <td className="px-4 py-2 text-sm text-red-600">{item.error || '-'}</td>
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
                    {items.length} itens prontos para importar
                  </span>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Nome</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Descrição</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Unidade</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Qtd. Inicial</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Estoque Mín.</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Valor Unit.</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {items.filter(item => !item.error).map((item, index) => (
                        <tr key={index}>
                          <td className="px-4 py-2 text-sm text-gray-900">{item.nome}</td>
                          <td className="px-4 py-2 text-sm text-gray-500">{item.descricao || '-'}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">{item.unidade}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {item.quantidade_inicial.toLocaleString('pt-BR')}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {item.estoque_minimo.toLocaleString('pt-BR')}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {item.valor_unitario 
                              ? `R$ ${item.valor_unitario.toFixed(2)}` 
                              : '-'}
                          </td>
                        </tr>
                      ))}
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
                    setItems([]);
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
                  {loading ? 'Importando...' : 'Confirmar Importação'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

