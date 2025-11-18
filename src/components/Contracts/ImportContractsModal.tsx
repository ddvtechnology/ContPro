import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Upload, AlertCircle, CheckCircle, Loader2, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { supabase } from '../../lib/supabase';

interface ImportContractsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

interface ContractRow {
  numero: string;
  objeto: string;
  contratado: string;
  valor: number;
  data_inicio: string;
  data_fim: string;
  status: string;
  categoria: string;
}

interface ImportResult {
  success: number;
  errors: Array<{ row: number; error: string }>;
}

export default function ImportContractsModal({ isOpen, onClose, onImportComplete }: ImportContractsModalProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Gerar template XLSX com ExcelJS (melhor formatação e validação)
  const generateTemplate = async () => {
    setIsDownloading(true);
    try {
      const workbook = new ExcelJS.Workbook();
      
      // Criar worksheet principal
      const worksheet = workbook.addWorksheet('Contratos');
      
      // Definir larguras das colunas (maiores e padronizadas)
      worksheet.columns = [
        { header: 'Número', key: 'numero', width: 20 },
        { header: 'Objeto', key: 'objeto', width: 55 },
        { header: 'Contratado', key: 'contratado', width: 40 },
        { header: 'Valor', key: 'valor', width: 20 },
        { header: 'Data Início', key: 'data_inicio', width: 18 },
        { header: 'Data Fim', key: 'data_fim', width: 18 },
        { header: 'Status', key: 'status', width: 18 },
        { header: 'Categoria', key: 'categoria', width: 25 }
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

      // Dados de exemplo com formato brasileiro
      const exampleData = [
        {
          numero: 'CT-2025-001',
          objeto: 'Prestação de serviços de manutenção',
          contratado: 'Empresa Exemplo Ltda',
          valor: 50000.00,
          data_inicio: new Date(2025, 0, 1), // 01-01-2025
          data_fim: new Date(2025, 11, 31), // 31-12-2025
          status: 'ativo',
          categoria: 'Serviços'
        },
        {
          numero: 'CT-2025-002',
          objeto: 'Aquisição de material de escritório',
          contratado: 'Fornecedor XYZ S.A.',
          valor: 120000.00,
          data_inicio: new Date(2025, 1, 1), // 01-02-2025
          data_fim: new Date(2025, 7, 31), // 31-08-2025
          status: 'ativo',
          categoria: 'Material'
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
          if (columnKey === 'valor') {
            // Formato numérico (Excel usa ponto como decimal, mas aceitará vírgula no processamento)
            cell.numFmt = '#,##0.00';
          } else if (columnKey === 'data_inicio' || columnKey === 'data_fim') {
            cell.numFmt = 'dd-mm-yyyy'; // Formato brasileiro de data
          }
        });
      });

      // Definir categorias (mesmas do formulário de contratos)
      const categoriasComuns = [
        'Material',
        'Serviços',
        'Locação de Imóvel',
        'Tecnologia',
        'Obras',
        'Consultoria',
        'Outros'
      ];

      // Adicionar validação de dados para Status (coluna G)
      // Aplicar validação a um range de células (linha 2 até 1000)
      const statusColumn = worksheet.getColumn('status');
      for (let rowNum = 2; rowNum <= 1000; rowNum++) {
        const cell = worksheet.getCell(`G${rowNum}`);
        cell.dataValidation = {
          type: 'list',
          allowBlank: false,
          formulae: ['"ativo,suspenso,encerrado"'],
          showErrorMessage: true,
          errorStyle: 'error',
          errorTitle: 'Valor Inválido',
          error: 'Por favor, selecione uma das opções: ativo, suspenso ou encerrado'
        };
      }
      
      // Adicionar validação de dados para Categoria (coluna H)
      for (let rowNum = 2; rowNum <= 1000; rowNum++) {
        const cell = worksheet.getCell(`H${rowNum}`);
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`"${categoriasComuns.join(',')}"`],
          showErrorMessage: true,
          errorStyle: 'warning',
          errorTitle: 'Categoria Sugerida',
          error: 'Consulte as categorias sugeridas na aba Categorias_Validas ou digite uma personalizada'
        };
      }

      // Criar aba de Status Válidos
      const statusSheet = workbook.addWorksheet('Status_Validos');
      statusSheet.columns = [
        { header: 'Status', key: 'status', width: 25 }
      ];
      ['ativo', 'suspenso', 'encerrado'].forEach(status => {
        statusSheet.addRow({ status });
      });
      const statusHeaderRow = statusSheet.getRow(1);
      statusHeaderRow.font = { bold: true, size: 12 };
      statusHeaderRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
      statusHeaderRow.alignment = { horizontal: 'center' };

      // Criar aba de Categorias Válidas
      const categoriaSheet = workbook.addWorksheet('Categorias_Validas');
      categoriaSheet.columns = [
        { header: 'Categoria', key: 'categoria', width: 30 }
      ];
      categoriasComuns.forEach(categoria => {
        categoriaSheet.addRow({ categoria });
      });
      const categoriaHeaderRow = categoriaSheet.getRow(1);
      categoriaHeaderRow.font = { bold: true, size: 12 };
      categoriaHeaderRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
      categoriaHeaderRow.alignment = { horizontal: 'center' };

      // Criar aba de Instruções
      const instructionsSheet = workbook.addWorksheet('Instruções');
      instructionsSheet.columns = [
        { header: 'Campo', key: 'campo', width: 35 },
        { header: 'Descrição', key: 'descricao', width: 75 }
      ];
      
      const instructions = [
        { campo: 'Instruções para preenchimento:', descricao: '' },
        { campo: '', descricao: '' },
        { campo: 'numero', descricao: 'Número único do contrato (obrigatório, sem duplicatas)' },
        { campo: 'objeto', descricao: 'Descrição do objeto do contrato (obrigatório)' },
        { campo: 'contratado', descricao: 'Nome da empresa/entidade contratada (obrigatório)' },
        { campo: 'valor', descricao: 'Valor do contrato em reais. Use formato numérico ou brasileiro (ex: 50000 ou 50.000,00)' },
        { campo: 'data_inicio', descricao: 'Data de início no formato DD-MM-AAAA (obrigatório, ex: 01-01-2025)' },
        { campo: 'data_fim', descricao: 'Data de término no formato DD-MM-AAAA (obrigatório, ex: 31-12-2025)' },
        { campo: 'status', descricao: 'Status: use a lista suspensa para selecionar (ativo, suspenso ou encerrado)' },
        { campo: 'categoria', descricao: 'Categoria: use a lista suspensa ou digite uma personalizada (padrão: Outros)' },
        { campo: '', descricao: '' },
        { campo: 'VALIDAÇÃO DE DADOS:', descricao: '' },
        { campo: 'Status:', descricao: 'As células têm lista suspensa com as opções válidas (ativo, suspenso, encerrado)' },
        { campo: 'Categoria:', descricao: 'As células têm lista suspensa com categorias sugeridas (mas aceita valores personalizados)' },
        { campo: '', descricao: '' },
        { campo: 'IMPORTANTE:', descricao: '' },
        { campo: '- Mantenha a primeira linha com os cabeçalhos', descricao: '' },
        { campo: '- Não altere os nomes das colunas', descricao: '' },
        { campo: '- Use formato brasileiro: DD-MM-AAAA para datas', descricao: '' },
        { campo: '- Use formato brasileiro para valores: 50.000,00 (ponto para milhar, vírgula para decimal)', descricao: '' },
        { campo: '- A data de fim deve ser maior ou igual à data de início', descricao: '' },
        { campo: '- O número do contrato deve ser único', descricao: '' },
        { campo: '- Remova as linhas de exemplo antes de preencher', descricao: '' },
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
      link.download = 'template_importacao_contratos.xlsx';
      link.click();
      window.URL.revokeObjectURL(url);
      
      setError('');
    } catch (err) {
      setError('Erro ao gerar template. Tente novamente.');
      console.error('Erro ao gerar template:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  // Processar arquivo XLSX
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
      setError('Por favor, selecione um arquivo Excel (.xlsx ou .xls)');
      return;
    }

    setFile(selectedFile);
    setError('');
    setImportResult(null);
  };

  // Importar contratos
  const handleImport = async () => {
    if (!file) {
      setError('Por favor, selecione um arquivo para importar');
      return;
    }

    setIsUploading(true);
    setError('');
    setImportResult(null);

    try {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          // Ler primeira aba
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          // Converter para JSON
          const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);
          
          if (jsonData.length === 0) {
            setError('O arquivo está vazio ou não possui dados válidos');
            setIsUploading(false);
            return;
          }

          // Validar e processar dados
          const contracts: ContractRow[] = [];
          const errors: Array<{ row: number; error: string }> = [];

          jsonData.forEach((row: any, index: number) => {
            const rowNumber = index + 2; // +2 porque linha 1 é cabeçalho e index começa em 0
            
            try {
              // Normalizar nomes de colunas (case-insensitive)
              const normalizeKey = (key: string) => key.toLowerCase().trim();
              const normalizedRow: any = {};
              
              Object.keys(row).forEach(key => {
                normalizedRow[normalizeKey(key)] = row[key];
              });

              // Validar campos obrigatórios
              const numero = normalizedRow.numero || normalizedRow['número'] || normalizedRow.number;
              const objeto = normalizedRow.objeto || normalizedRow.object;
              const contratado = normalizedRow.contratado || normalizedRow.contractor;
              const valor = normalizedRow.valor || normalizedRow.value;
              const data_inicio = normalizedRow.data_inicio || normalizedRow['data início'] || normalizedRow.start_date || normalizedRow['start date'];
              const data_fim = normalizedRow.data_fim || normalizedRow['data fim'] || normalizedRow.end_date || normalizedRow['end date'];
              const status = (normalizedRow.status || 'ativo').toLowerCase();
              const categoria = normalizedRow.categoria || normalizedRow.category || 'Outros';

              // Validações
              if (!numero || String(numero).trim() === '') {
                errors.push({ row: rowNumber, error: 'Número do contrato é obrigatório' });
                return;
              }

              if (!objeto || String(objeto).trim() === '') {
                errors.push({ row: rowNumber, error: 'Objeto do contrato é obrigatório' });
                return;
              }

              if (!contratado || String(contratado).trim() === '') {
                errors.push({ row: rowNumber, error: 'Contratado é obrigatório' });
                return;
              }

              // Converter valor brasileiro para número
              let valorNumerico: number;
              try {
                // Se já é número, usar diretamente
                if (typeof valor === 'number') {
                  valorNumerico = valor;
                } else if (typeof valor === 'string') {
                  const valorStr = String(valor).trim();
                  
                  // Remover símbolos de moeda (R$, $, etc.) e espaços
                  let valorLimpo = valorStr.replace(/[R$\s]/g, '');
                  
                  // Estratégia: identificar o separador decimal pelo padrão
                  // Formato brasileiro: 50.000,00 (ponto = milhar, vírgula = decimal)
                  // Formato internacional: 50,000.00 ou 50000.00 (vírgula/ponto = decimal)
                  
                  if (valorLimpo.includes(',') && valorLimpo.includes('.')) {
                    // Tem ambos - verificar qual vem por último (geralmente é o decimal)
                    const lastDot = valorLimpo.lastIndexOf('.');
                    const lastComma = valorLimpo.lastIndexOf(',');
                    
                    if (lastComma > lastDot) {
                      // Vírgula é o decimal: formato brasileiro 50.000,50
                      valorLimpo = valorLimpo.replace(/\./g, '').replace(',', '.');
                    } else {
                      // Ponto é o decimal: formato internacional 50,000.50
                      valorLimpo = valorLimpo.replace(/,/g, '');
                    }
                  } else if (valorLimpo.includes(',')) {
                    // Só tem vírgula
                    // Se tem apenas uma vírgula com 1-2 dígitos após, é decimal brasileiro
                    const parts = valorLimpo.split(',');
                    if (parts.length === 2 && parts[1].length <= 2 && /^\d+$/.test(parts[0].replace(/\./g, ''))) {
                      // Formato brasileiro: 50000,50 ou 50.000,50
                      valorLimpo = valorLimpo.replace(/\./g, '').replace(',', '.');
                    } else {
                      // Pode ser separador de milhar (formato europeu), remover
                      valorLimpo = valorLimpo.replace(/,/g, '');
                    }
                  } else if (valorLimpo.includes('.')) {
                    // Só tem ponto
                    const parts = valorLimpo.split('.');
                    // Se tem apenas uma parte após o ponto com 1-2 dígitos, é decimal
                    if (parts.length === 2 && parts[1].length <= 2 && /^\d+$/.test(parts[0])) {
                      // Decimal: 50000.50 - manter como está
                      // Não fazer nada
                    } else {
                      // Separador de milhar: 50.000 - remover pontos
                      valorLimpo = valorLimpo.replace(/\./g, '');
                    }
                  }
                  
                  valorNumerico = parseFloat(valorLimpo);
                } else {
                  // Tentar converter para número
                  valorNumerico = Number(valor);
                }
                
                if (isNaN(valorNumerico) || valorNumerico <= 0) {
                  errors.push({ row: rowNumber, error: 'Valor deve ser um número positivo. Use formato brasileiro: 50.000,00 ou numérico: 50000.00' });
                  return;
                }
              } catch (valError) {
                errors.push({ row: rowNumber, error: 'Valor inválido. Use formato brasileiro (50.000,00) ou numérico (50000.00)' });
                return;
              }

              if (!data_inicio) {
                errors.push({ row: rowNumber, error: 'Data de início é obrigatória' });
                return;
              }

              if (!data_fim) {
                errors.push({ row: rowNumber, error: 'Data de fim é obrigatória' });
                return;
              }

              // Validar e converter datas (formato brasileiro DD-MM-AAAA)
              let startDate: string;
              let endDate: string;

              // Função para converter data brasileira (DD-MM-AAAA) ou outros formatos
              const convertDate = (dateValue: any): string => {
                const dateStr = String(dateValue).trim();
                
                // Formato brasileiro: DD-MM-AAAA
                const brDateRegex = /^(\d{2})-(\d{2})-(\d{4})$/;
                const brMatch = dateStr.match(brDateRegex);
                if (brMatch) {
                  const [, day, month, year] = brMatch;
                  // Validar se a data é válida
                  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                  if (date.getDate() === parseInt(day) && 
                      date.getMonth() === parseInt(month) - 1 && 
                      date.getFullYear() === parseInt(year)) {
                    return `${year}-${month}-${day}`;
                  }
                }

                // Formato ISO: AAAA-MM-DD
                const isoDateRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
                if (isoDateRegex.test(dateStr)) {
                  return dateStr;
                }

                // Se é número (serial do Excel)
                if (typeof dateValue === 'number') {
                  // Excel usa 1 de janeiro de 1900 como base (com correção para bug do Excel)
                  const excelEpoch = new Date(1899, 11, 30);
                  const excelDate = new Date(excelEpoch.getTime() + dateValue * 86400000);
                  if (!isNaN(excelDate.getTime())) {
                    return excelDate.toISOString().split('T')[0];
                  }
                }

                // Tentar parsear como string de data em vários formatos
                // Formato: DD/MM/AAAA
                const brSlashRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
                const brSlashMatch = dateStr.match(brSlashRegex);
                if (brSlashMatch) {
                  const [, day, month, year] = brSlashMatch;
                  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                  if (date.getDate() === parseInt(day) && 
                      date.getMonth() === parseInt(month) - 1 && 
                      date.getFullYear() === parseInt(year)) {
                    return `${year}-${month}-${day}`;
                  }
                }

                // Tentar parsear com Date nativo (pode funcionar para alguns formatos)
                const parsedDate = new Date(dateValue);
                if (!isNaN(parsedDate.getTime())) {
                  const year = parsedDate.getFullYear();
                  const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
                  const day = String(parsedDate.getDate()).padStart(2, '0');
                  return `${year}-${month}-${day}`;
                }

                throw new Error('Formato de data inválido');
              };

              try {
                startDate = convertDate(data_inicio);
                endDate = convertDate(data_fim);
              } catch (dateError) {
                errors.push({ row: rowNumber, error: 'Formato de data inválido. Use DD-MM-AAAA (ex: 01-01-2025)' });
                return;
              }

              // Validar que data_fim >= data_inicio
              if (new Date(endDate) < new Date(startDate)) {
                errors.push({ row: rowNumber, error: 'Data de fim deve ser maior ou igual à data de início' });
                return;
              }

              // Validar status
              const validStatuses = ['ativo', 'suspenso', 'encerrado'];
              if (!validStatuses.includes(status)) {
                errors.push({ row: rowNumber, error: `Status inválido. Use: ${validStatuses.join(', ')}` });
                return;
              }

              contracts.push({
                numero: String(numero).trim(),
                objeto: String(objeto).trim(),
                contratado: String(contratado).trim(),
                valor: valorNumerico,
                data_inicio: startDate,
                data_fim: endDate,
                status,
                categoria: String(categoria).trim() || 'Outros'
              });
            } catch (err: any) {
              errors.push({ row: rowNumber, error: err.message || 'Erro ao processar linha' });
            }
          });

          if (errors.length > 0 && contracts.length === 0) {
            setError(`Nenhum contrato válido encontrado. ${errors.length} erro(s) encontrado(s).`);
            setImportResult({ success: 0, errors });
            setIsUploading(false);
            return;
          }

          // Inserir contratos no banco
          let successCount = 0;
          const insertErrors: Array<{ row: number; error: string }> = [];

          for (let i = 0; i < contracts.length; i++) {
            const contract = contracts[i];
            const originalRowNumber = jsonData.findIndex((row: any, idx: number) => {
              const normalizeKey = (key: string) => key.toLowerCase().trim();
              const normalizedRow: any = {};
              Object.keys(row).forEach(key => {
                normalizedRow[normalizeKey(key)] = row[key];
              });
              const numero = normalizedRow.numero || normalizedRow['número'] || normalizedRow.number;
              return String(numero).trim() === contract.numero;
            }) + 2;

            try {
              const { error: insertError } = await supabase
                .from('contracts')
                .insert({
                  number: contract.numero,
                  object: contract.objeto,
                  contractor: contract.contratado,
                  value: contract.valor,
                  start_date: contract.data_inicio,
                  end_date: contract.data_fim,
                  status: contract.status,
                  category: contract.categoria
                });

              if (insertError) {
                if (insertError.code === '23505') { // Unique violation
                  insertErrors.push({ row: originalRowNumber, error: `Número de contrato já existe: ${contract.numero}` });
                } else {
                  insertErrors.push({ row: originalRowNumber, error: insertError.message });
                }
              } else {
                successCount++;
              }
            } catch (err: any) {
              insertErrors.push({ row: originalRowNumber, error: err.message || 'Erro ao inserir contrato' });
            }
          }

          setImportResult({
            success: successCount,
            errors: [...errors, ...insertErrors]
          });

          if (successCount > 0) {
            onImportComplete();
          }
        } catch (err: any) {
          setError(`Erro ao processar arquivo: ${err.message}`);
          console.error('Erro ao processar arquivo:', err);
        } finally {
          setIsUploading(false);
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (err: any) {
      setError(`Erro ao ler arquivo: ${err.message}`);
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setError('');
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col relative">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 z-10 flex items-center justify-between p-6">
          <div className="flex items-center space-x-3">
            <FileSpreadsheet className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">Importar Contratos</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors flex-shrink-0"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Step 1: Download Template */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Passo 1: Baixar Template</h3>
            <p className="text-sm text-gray-600 mb-4">
              Baixe o template Excel com as colunas necessárias e exemplos de preenchimento.
            </p>
            <button
              onClick={generateTemplate}
              disabled={isDownloading}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Gerando...</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  <span>Baixar Template</span>
                </>
              )}
            </button>
          </div>

          {/* Step 2: Upload File */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Passo 2: Enviar Arquivo Preenchido</h3>
            <p className="text-sm text-gray-600 mb-4">
              Após preencher o template, selecione o arquivo para importar os contratos.
            </p>
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {file && (
                <div className="flex items-center space-x-2 text-sm text-gray-700">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Arquivo selecionado: {file.name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-red-800">Erro</h4>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Import Result */}
          {importResult && (
            <div className={`border rounded-lg p-4 ${importResult.success > 0 ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
              <div className="flex items-start space-x-2">
                {importResult.success > 0 ? (
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <h4 className={`text-sm font-semibold ${importResult.success > 0 ? 'text-green-800' : 'text-yellow-800'}`}>
                    Resultado da Importação
                  </h4>
                  <p className={`text-sm mt-1 ${importResult.success > 0 ? 'text-green-700' : 'text-yellow-700'}`}>
                    {importResult.success} contrato(s) importado(s) com sucesso.
                  </p>
                  {importResult.errors.length > 0 && (
                    <div className="mt-3 max-h-48 overflow-y-auto">
                      <p className="text-xs font-semibold text-gray-700 mb-2">Erros encontrados:</p>
                      <ul className="space-y-1">
                        {importResult.errors.map((err, idx) => (
                          <li key={idx} className="text-xs text-gray-600">
                            <span className="font-medium">Linha {err.row}:</span> {err.error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Instruções Importantes:</h3>
            <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
              <li>Mantenha a primeira linha com os cabeçalhos (numero, objeto, contratado, etc.)</li>
              <li>Não altere os nomes das colunas</li>
              <li>Use formato brasileiro de data: DD-MM-AAAA (ex: 01-01-2025)</li>
              <li>Valores no formato brasileiro: 50.000,00 (ponto para milhar, vírgula para decimal)</li>
              <li>Status deve ser: ativo, suspenso ou encerrado (consulte a aba Status_Validos)</li>
              <li>Categoria: consulte a aba Categorias_Validas ou use uma personalizada</li>
              <li>A data de fim deve ser maior ou igual à data de início</li>
              <li>O número do contrato deve ser único no sistema</li>
              <li>O template possui validação de dados nas células de Status e Categoria</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Fechar
          </button>
          <button
            onClick={handleImport}
            disabled={!file || isUploading}
            className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Importando...</span>
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                <span>Importar Contratos</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

