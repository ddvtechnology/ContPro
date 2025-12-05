import { useState, useEffect } from 'react';
import { X, Download, Upload, AlertCircle, CheckCircle, FileSpreadsheet, Package, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { supabase } from '../../lib/supabase';
import { ContractItem } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { formatDateForDisplay, formatDateForDB } from '../../utils/dateUtils';

interface ImportOrdersModalProps {
  contractId: string;
  contractNumber: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface OrderRow {
  numero_pedido: string;
  nome_item: string;
  quantidade: number | null;
  data: string;
  solicitante: string;
  observacao?: string;
  error?: string;
  itemId?: string;
  quantidadeVazia?: boolean;
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

  const downloadTemplate = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      
      // Formato brasileiro: DD-MM-AAAA
      const today = new Date();
      const day = String(today.getDate()).padStart(2, '0');
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const year = today.getFullYear();
      const dataBrasileira = `${day}-${month}-${year}`;
      
      // Número único de pedido para toda a tabela (sequencial)
      const numeroPedido = `PED-${year}-001`;
      
      // Criar worksheet principal
      const worksheet = workbook.addWorksheet('Pedidos');
      
      // Definir larguras das colunas
      worksheet.columns = [
        { header: 'Número Pedido', key: 'numero_pedido', width: 20 },
        { header: 'Nome Item', key: 'nome_item', width: 40 },
        { header: 'Quantidade', key: 'quantidade', width: 15 },
        { header: 'Data', key: 'data', width: 15 },
        { header: 'Solicitante', key: 'solicitante', width: 30 },
        { header: 'Observação', key: 'observacao', width: 45 }
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

      // Gerar template com TODOS os itens do contrato
      const templateData = items.length > 0
        ? items.map((item) => ({
            numero_pedido: numeroPedido, // Mesmo número para todos
            nome_item: item.name,
            quantidade: '', // Vazio - pode ser preenchido depois
            data: dataBrasileira,
            solicitante: 'Nome do Solicitante',
            observacao: 'Observação opcional'
          }))
        : [
            {
              numero_pedido: numeroPedido,
              nome_item: 'Nome do Item (deve existir no contrato)',
              quantidade: '',
              data: dataBrasileira,
              solicitante: 'Nome do Solicitante',
              observacao: 'Observação opcional'
            }
          ];

      // Adicionar dados ao worksheet
      templateData.forEach((row) => {
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
          if (columnKey === 'quantidade') {
            cell.numFmt = '#,##0';
            cell.alignment = { horizontal: 'right' };
          } else if (columnKey === 'data') {
            // Formato de data brasileiro
            cell.numFmt = 'dd-mm-yyyy';
          }
        });
      });
      
      // Criar aba com a lista de itens disponíveis
      if (items.length > 0) {
        const itemsSheet = workbook.addWorksheet('Itens Disponíveis');
        itemsSheet.columns = [
          { header: 'Nome Item', key: 'nome_item', width: 40 },
          { header: 'Unidade', key: 'unidade', width: 15 },
          { header: 'Estoque Disponível', key: 'estoque_disponivel', width: 20 },
          { header: 'Descrição', key: 'descricao', width: 50 }
        ];
        
        const itemsList = items.map(item => ({
          nome_item: item.name,
          unidade: item.unit,
          estoque_disponivel: item.currentQuantity,
          descricao: item.description || ''
        }));
        
        // Formatar cabeçalho da aba de itens
        const itemsHeaderRow = itemsSheet.getRow(1);
        itemsHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
        itemsHeaderRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF1E40AF' }
        };
        itemsHeaderRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        itemsHeaderRow.height = 30;
        
        itemsSheet.getRow(1).eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
          };
        });
        
        itemsList.forEach((row) => {
          const newRow = itemsSheet.addRow(row);
          newRow.height = 22;
          
          newRow.eachCell((cell, colNumber) => {
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
              bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
              left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
              right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
            };
            
            const columnKey = itemsSheet.getColumn(colNumber).key;
            if (columnKey === 'estoque_disponivel') {
              cell.numFmt = '#,##0';
              cell.alignment = { horizontal: 'right' };
            }
          });
        });
        
        itemsSheet.views = [{ state: 'frozen', ySplit: 1 }];
      }
      
      // Criar aba de Instruções
      const instructionsSheet = workbook.addWorksheet('Instruções');
      instructionsSheet.columns = [
        { header: 'Campo', key: 'campo', width: 35 },
        { header: 'Descrição', key: 'descricao', width: 75 }
      ];
      
      const instructions = [
        { campo: 'Instruções para preenchimento:', descricao: '' },
        { campo: '', descricao: '' },
        { campo: 'numero_pedido', descricao: 'Número único do pedido. Use o mesmo número para todos os itens do mesmo pedido. Para novo pedido, use sequência: PED-2025-001, PED-2025-002, etc.' },
        { campo: 'nome_item', descricao: 'Nome do item (obrigatório). Deve ser exatamente igual ao cadastrado no contrato. Consulte a aba "Itens Disponíveis"' },
        { campo: 'quantidade', descricao: 'Quantidade solicitada (opcional). Pode ficar vazio se não houver solicitação. Deve ser menor ou igual ao estoque disponível' },
        { campo: 'data', descricao: 'Data do pedido no formato DD-MM-AAAA (obrigatório, ex: 03-12-2025)' },
        { campo: 'solicitante', descricao: 'Nome do solicitante (obrigatório)' },
        { campo: 'observacao', descricao: 'Observações adicionais sobre o pedido (opcional)' },
        { campo: '', descricao: '' },
        { campo: 'IMPORTANTE:', descricao: '' },
        { campo: '- Mantenha a primeira linha com os cabeçalhos', descricao: '' },
        { campo: '- Não altere os nomes das colunas', descricao: '' },
        { campo: '- Use formato brasileiro: DD-MM-AAAA para datas', descricao: '' },
        { campo: '- O número do pedido pode ser o mesmo para todos os itens do mesmo pedido', descricao: '' },
        { campo: '- A quantidade pode ficar vazia (linha será ignorada na importação)', descricao: '' },
        { campo: '- O nome do item deve ser exatamente igual ao cadastrado', descricao: '' },
        { campo: '- Remova as linhas que não deseja importar', descricao: '' },
        { campo: '- Para criar múltiplos pedidos, use números sequenciais diferentes', descricao: '' },
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
      link.download = `template_pedidos_contrato_${contractNumber}.xlsx`;
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

        console.log(`Total de linhas lidas do arquivo: ${jsonData.length}`);

        if (!jsonData || jsonData.length === 0) {
          setErrors(['O arquivo está vazio ou não contém dados válidos.']);
          setLoading(false);
          return;
        }

        if (items.length === 0) {
          setErrors(['Não há itens cadastrados no contrato. Cadastre itens antes de importar pedidos.']);
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

        // Mostrar colunas disponíveis para debug (primeira linha)
        if (jsonData.length > 0) {
          console.log('Colunas encontradas no arquivo:', Object.keys(jsonData[0]));
          console.log('Primeira linha de dados:', jsonData[0]);
        }
        
        // Mostrar itens disponíveis no contrato para debug
        console.log('Itens disponíveis no contrato:', items.map(i => ({ id: i.id, name: i.name, stock: i.currentQuantity })));

        // Validar dados
        const validatedOrders = jsonData.map((row, rowIndex) => {
          const errors: string[] = [];
          
          // Log da linha atual para debug
          console.log(`\n=== Processando linha ${rowIndex + 1} ===`);
          console.log('Dados brutos da linha:', row);
          console.log('Chaves disponíveis:', Object.keys(row));
          
          // Normalizar nomes das colunas
          const normalizedRow: any = {};
          Object.keys(row).forEach(key => {
            normalizedRow[normalizeKey(key)] = row[key];
          });
          
          console.log('Linha normalizada:', normalizedRow);
          
          // Mapear diferentes variações de nomes de colunas (tentar todas as possibilidades)
          const numeroPedido = 
            normalizedRow.numero_pedido || 
            normalizedRow['número_pedido'] || 
            normalizedRow.numero || 
            row['Número Pedido'] || 
            row['numero pedido'] || 
            row.numero_pedido ||
            row.Número_Pedido ||
            '';
          
          console.log(`Número do pedido extraído: "${numeroPedido}"`);
          
          // Tentar todas as variações possíveis do nome do item
          let nomeItem = 
            normalizedRow.nome_item || 
            normalizedRow.nome || 
            row['Nome Item'] || 
            row['nome item'] ||
            row['NomeItem'] ||
            row.Nome_Item ||
            row.NomeItem ||
            row.nome_item ||
            row.nome ||
            '';
          
          // Se ainda não encontrou, tentar buscar em qualquer coluna que contenha "item" ou "nome"
          if (!nomeItem || nomeItem.trim() === '') {
            for (const key of Object.keys(row)) {
              const normalizedKey = normalizeKey(key);
              if ((normalizedKey.includes('nome') && normalizedKey.includes('item')) ||
                  (normalizedKey.includes('item') && row[key])) {
                nomeItem = row[key];
                console.log(`Nome do item encontrado na coluna "${key}": "${nomeItem}"`);
                break;
              }
            }
          }
          
          console.log(`Nome do item extraído: "${nomeItem}"`);
          
          const quantidade = 
            normalizedRow.quantidade || 
            row.Quantidade || 
            row['quantidade'] ||
            row.quantidade ||
            '';
          
          const dataValue = 
            normalizedRow.data || 
            row.Data || 
            row['data'] ||
            row.data ||
            '';
          
          const solicitante = 
            normalizedRow.solicitante || 
            row.Solicitante || 
            row['solicitante'] ||
            row.solicitante ||
            '';
          
          const observacao = 
            normalizedRow.observacao || 
            normalizedRow.observação || 
            row.Observação || 
            row.Observacao || 
            row['observação'] ||
            row['observacao'] ||
            row.observacao || 
            '';
          
          // Converter quantidade para número (pode ser vazio)
          const quantidadeNum = quantidade === '' || quantidade === null || quantidade === undefined
            ? null
            : parseFloat(String(quantidade).replace(/[^\d,.-]/g, '').replace(',', '.'));
          
          // Se quantidade está vazia, linha será ignorada (não é erro)
          const quantidadeVazia = quantidadeNum === null || isNaN(quantidadeNum);
          
          // Validar número do pedido
          if (!numeroPedido || String(numeroPedido).trim() === '') {
            errors.push('Número do pedido é obrigatório');
          }
          
          // Validar nome do item
          if (!nomeItem || String(nomeItem).trim() === '') {
            errors.push('Nome do item é obrigatório');
          } else {
            // Normalizar nome do item para comparação (remove acentos, espaços extras, etc)
            const normalizeItemName = (name: string) => {
              if (!name) return '';
              return String(name)
                .toLowerCase()
                .trim()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '') // Remove acentos
                .replace(/\s+/g, ' ') // Normaliza espaços múltiplos para um único espaço
                .replace(/[^\w\s]/g, '') // Remove caracteres especiais (mantém letras, números e espaços)
                .trim();
            };
            
            const nomeItemStr = String(nomeItem || '').trim();
            const nomeItemNormalizado = normalizeItemName(nomeItemStr);
            
            console.log(`Procurando item: "${nomeItemStr}" (normalizado: "${nomeItemNormalizado}")`);
            
            // Buscar item pelo nome (comparação mais flexível)
            let item = items.find(i => {
              const itemNameNormalizado = normalizeItemName(i.name);
              const match = itemNameNormalizado === nomeItemNormalizado;
              if (match) {
                console.log(`Match encontrado: "${i.name}" (normalizado: "${itemNameNormalizado}")`);
              }
              return match;
            });
            
            // Se não encontrou, tentar busca parcial (contém)
            if (!item && nomeItemNormalizado.length > 3) {
              item = items.find(i => {
                const itemNameNormalizado = normalizeItemName(i.name);
                return itemNameNormalizado.includes(nomeItemNormalizado) || 
                       nomeItemNormalizado.includes(itemNameNormalizado);
              });
            }
            
            if (!item) {
              // Criar mensagem mais útil
              const nomeItemOriginal = String(nomeItem).trim();
              console.warn(`Item não encontrado: "${nomeItemOriginal}" (normalizado: "${nomeItemNormalizado}")`);
              console.log('Itens cadastrados:', items.map(i => `"${i.name}"`));
              
              errors.push(`Item não encontrado: "${nomeItemOriginal}". Verifique se o nome está exatamente igual ao cadastrado no contrato.`);
            } else {
              console.log(`Item encontrado: "${item.name}" (procurado: "${nomeItem}")`);
              normalizedRow.itemId = item.id;
              
              // Validar estoque disponível apenas se tiver quantidade
              if (!quantidadeVazia && quantidadeNum && quantidadeNum > item.currentQuantity) {
                errors.push(`Estoque insuficiente (disponível: ${item.currentQuantity} ${item.unit})`);
              }
            }
          }
          
          // Validar quantidade apenas se preenchida (não pode ser zero ou negativa)
          if (!quantidadeVazia) {
            if (quantidadeNum === null || isNaN(quantidadeNum) || quantidadeNum <= 0) {
              errors.push('Quantidade deve ser maior que zero');
            }
          }
          
          // Validar e converter data
          let dataConvertida = '';
          if (!dataValue) {
            errors.push('Data é obrigatória');
          } else {
            try {
              dataConvertida = convertDateBRtoISO(dataValue);
              if (!dataConvertida) {
                errors.push('Data inválida (use formato DD-MM-AAAA, ex: 03-12-2025)');
              }
            } catch {
              errors.push('Data inválida');
            }
          }
          
          // Validar solicitante
          if (!solicitante || String(solicitante).trim() === '') {
            errors.push('Solicitante é obrigatório');
          }

          return {
            numero_pedido: String(numeroPedido || '').trim(),
            nome_item: String(nomeItem || '').trim(),
            quantidade: quantidadeVazia ? null : quantidadeNum,
            data: dataConvertida || dataValue, // Usar data convertida se válida
            solicitante: String(solicitante || '').trim(),
            observacao: String(observacao || '').trim(),
            itemId: normalizedRow.itemId,
            quantidadeVazia, // Flag para ignorar linha
            error: errors.length > 0 ? errors.join(', ') : undefined
          };
        });

        console.log(`Total de pedidos validados: ${validatedOrders.length}`);
        console.log(`Pedidos com erro: ${validatedOrders.filter(o => o.error).length}`);
        console.log(`Pedidos válidos: ${validatedOrders.filter(o => !o.error).length}`);
        
        // Detalhar erros para debug
        const ordersWithErrors = validatedOrders.filter(o => o.error);
        if (ordersWithErrors.length > 0) {
          console.log('Pedidos com erros:', ordersWithErrors.map((o, idx) => ({
            linha: idx + 1,
            numero_pedido: o.numero_pedido,
            nome_item: o.nome_item,
            erro: o.error
          })));
        }
        
        setOrders(validatedOrders);
        
        // Verificar se há pedidos válidos para importar
        const validOrdersCount = validatedOrders.filter(o => 
          !o.error && !o.quantidadeVazia && o.quantidade !== null && o.quantidade > 0
        ).length;
        
        const hasErrors = validatedOrders.some(order => order.error);
        
        if (hasErrors) {
          const errorCount = ordersWithErrors.length;
          const errorMessages = ordersWithErrors.slice(0, 3).map((o) => {
            const lineNum = validatedOrders.findIndex(order => order === o) + 1;
            return `Linha ${lineNum}: ${o.error}`;
          });
          
          if (validOrdersCount > 0) {
            // Tem erros mas também tem pedidos válidos - permitir continuar
            setErrors([
              `⚠️ Existem erros em ${errorCount} linha(s), mas ${validOrdersCount} pedido(s) válido(s) podem ser importados.`,
              ...(errorMessages.length > 0 ? errorMessages : []),
              'Você pode corrigir os erros e tentar novamente, ou importar apenas os pedidos válidos.'
            ]);
            // Permitir ir para preview mesmo com erros se houver pedidos válidos
            setStep('preview');
          } else {
            // Só tem erros - não permitir continuar
            setErrors([
              `❌ Existem erros em ${errorCount} linha(s). Corrija os erros antes de continuar.`,
              ...(errorMessages.length > 0 ? errorMessages : [])
            ]);
          }
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
      // Filtrar: remover erros, linhas sem itemId, e linhas com quantidade vazia
      const validOrders = orders.filter(order => 
        !order.error && 
        order.itemId && 
        !order.quantidadeVazia &&
        order.quantidade !== null &&
        order.quantidade > 0
      );
      
      if (validOrders.length === 0) {
        alert('Nenhum pedido válido para importar. Verifique se há quantidades preenchidas.');
        return;
      }
      
      // Criar um mapa para rastrear o estoque atualizado de cada item
      const currentStockMap = new Map<string, number>();
      items.forEach(item => {
        currentStockMap.set(item.id, item.currentQuantity);
      });

      // Processar pedidos um por um para garantir atomicidade
      let successCount = 0;
      const errors: string[] = [];
      
      console.log(`Processando ${validOrders.length} pedidos válidos...`);
      
      for (let i = 0; i < validOrders.length; i++) {
        const order = validOrders[i];
        console.log(`Processando pedido ${i + 1}/${validOrders.length}: ${order.numero_pedido} - ${order.nome_item} - Qtd: ${order.quantidade}`);
        
        try {
          // Buscar estoque atual do item
          const currentStock = currentStockMap.get(order.itemId!) || 0;
          console.log(`Estoque atual do item ${order.nome_item}: ${currentStock}`);
          
          // Verificar se há estoque suficiente
          if (order.quantidade! > currentStock) {
            const item = items.find(i => i.id === order.itemId);
            const errorMsg = `Pedido ${order.numero_pedido} - ${order.nome_item}: Estoque insuficiente (disponível: ${currentStock} ${item?.unit || ''})`;
            console.warn(errorMsg);
            errors.push(errorMsg);
            continue;
          }

          // Inserir pedido
          console.log(`Inserindo pedido no banco...`);
          const { error: orderError } = await supabase
            .from('orders')
            .insert([{
              contractId,
              itemId: order.itemId,
              orderNumber: order.numero_pedido.trim(),
              quantity: order.quantidade!,
              date: order.data,
              requester: order.solicitante.trim(),
              observation: order.observacao?.trim() || null,
              createdBy: user.id,
              createdAt: currentDate
            }]);

          if (orderError) {
            // Se for erro de número duplicado (constraint única), tentar continuar
            // Isso pode acontecer se a constraint UNIQUE ainda existir no banco
            if (orderError.code === '23505') {
              console.warn(`Erro de constraint única no pedido ${order.numero_pedido}. Isso pode acontecer se múltiplos pedidos têm o mesmo número.`);
              console.warn('SOLUÇÃO: Execute o script SQL fix_order_number_constraint.sql para remover a constraint UNIQUE do orderNumber.');
              errors.push(`Pedido ${order.numero_pedido} - ${order.nome_item}: Erro de constraint única. Execute o script de correção SQL.`);
              continue; // Continuar processando os próximos pedidos
            }
            // Para outros erros, também continuar mas registrar
            console.error(`Erro ao inserir pedido ${order.numero_pedido}:`, orderError);
            errors.push(`Pedido ${order.numero_pedido} - ${order.nome_item}: ${orderError.message || 'Erro ao inserir'}`);
            continue; // Continuar processando mesmo com erro
          }
          console.log(`Pedido inserido com sucesso!`);

          // Calcular novo estoque
          const newQuantity = currentStock - order.quantidade!;
          console.log(`Novo estoque será: ${newQuantity}`);
          
          // Atualizar estoque no banco
          const { error: updateError } = await supabase
            .from('contract_items')
            .update({ 
              currentQuantity: newQuantity,
              updatedAt: currentDate
            })
            .eq('id', order.itemId);

          if (updateError) {
            console.error(`Erro ao atualizar estoque:`, updateError);
            throw updateError;
          }
          console.log(`Estoque atualizado no banco!`);

          // Atualizar o mapa de estoque em memória para próximos pedidos
          currentStockMap.set(order.itemId!, newQuantity);
          console.log(`Mapa de estoque atualizado. Novo valor: ${newQuantity}`);
          successCount++;
        } catch (error: any) {
          console.error(`Erro ao processar pedido ${order.numero_pedido}:`, error);
          errors.push(`Pedido ${order.numero_pedido} - ${order.nome_item}: ${error.message || 'Erro ao processar'}`);
          // Continuar processando os próximos pedidos mesmo se este falhar
        }
      }
      
      console.log(`Processamento concluído. ${successCount} sucessos, ${errors.length} erros.`);

      const skippedCount = orders.filter(order => order.quantidadeVazia).length;
      
      // Construir mensagem de resultado
      let message = '';
      if (successCount > 0) {
        message = `${successCount} pedido(s) registrado(s) com sucesso!`;
        if (skippedCount > 0) {
          message += ` ${skippedCount} linha(s) com quantidade vazia foram ignoradas.`;
        }
        if (errors.length > 0) {
          message += `\n\n${errors.length} pedido(s) não foram processados:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n... e mais ${errors.length - 5}` : ''}`;
        }
      } else {
        message = `Nenhum pedido foi registrado.`;
        if (errors.length > 0) {
          message += `\n\nErros encontrados:\n${errors.slice(0, 10).join('\n')}${errors.length > 10 ? `\n... e mais ${errors.length - 10}` : ''}`;
        }
      }
      
      alert(message);
      
      if (successCount > 0) {
        onSuccess();
      }
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
              <li>Baixe o template Excel (incluirá <strong>TODOS</strong> os itens do contrato como exemplos)</li>
              <li>Preencha a planilha com os pedidos (pode editar, remover ou adicionar linhas)</li>
              <li>O número do pedido pode ser o mesmo para todos os itens do mesmo pedido</li>
              <li>O nome do item deve ser <strong>exatamente igual</strong> ao cadastrado</li>
              <li>A quantidade pode ficar <strong>vazia</strong> - a linha será ignorada na importação</li>
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

              {/* Preview com TODOS os pedidos (válidos e com erro) */}
              {orders.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                    <h3 className="text-sm font-medium text-gray-900">
                      📋 Visualização de Todos os Pedidos
                    </h3>
                    <p className="text-xs text-gray-600 mt-1">
                      Mostrando todos os pedidos do arquivo para revisão antes da importação
                    </p>
                  </div>
                  <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Nº Pedido</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Item</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Qtd</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Data</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Solicitante</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Erro</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {orders.map((order, index) => {
                          const hasError = !!order.error;
                          const isSkipped = order.quantidadeVazia;
                          return (
                            <tr 
                              key={index} 
                              className={
                                hasError 
                                  ? 'bg-red-50 hover:bg-red-100' 
                                  : isSkipped
                                  ? 'bg-yellow-50 hover:bg-yellow-100'
                                  : 'bg-green-50 hover:bg-green-100'
                              }
                            >
                              <td className="px-4 py-2">
                                {hasError ? (
                                  <AlertCircle className="h-4 w-4 text-red-600" />
                                ) : isSkipped ? (
                                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                                ) : (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                )}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap">{order.numero_pedido || '-'}</td>
                              <td className="px-4 py-2 text-sm text-gray-900">{order.nome_item || '-'}</td>
                              <td className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap">
                                {order.quantidade !== null && order.quantidade !== undefined 
                                  ? order.quantidade.toLocaleString('pt-BR') 
                                  : '-'}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap">
                                {order.data ? formatDateForDisplay(order.data) : '-'}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900">{order.solicitante || '-'}</td>
                              <td className="px-4 py-2 text-sm">
                                {hasError ? (
                                  <span className="text-red-600 text-xs">{order.error}</span>
                                ) : isSkipped ? (
                                  <span className="text-yellow-600 text-xs">Quantidade vazia (será ignorada)</span>
                                ) : (
                                  <span className="text-green-600">✓ OK</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="bg-gray-50 px-4 py-2 border-t border-gray-200 text-xs text-gray-600 flex justify-between items-center">
                    <div>
                      Total: <strong>{orders.length}</strong> linha(s) - 
                      <strong className="text-green-600"> {orders.filter(o => !o.error && !o.quantidadeVazia).length}</strong> válidas - 
                      <strong className="text-yellow-600"> {orders.filter(o => o.quantidadeVazia).length}</strong> ignoradas - 
                      <strong className="text-red-600"> {orders.filter(o => o.error).length}</strong> com erro
                    </div>
                    {orders.some(o => o.error) && (
                      <div className="text-red-600 font-medium">
                        ⚠️ Corrija os erros antes de continuar
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {step === 'preview' && (
            <>
              {/* Preview dos dados */}
              {(() => {
                const validOrders = orders.filter(o => !o.error && !o.quantidadeVazia && o.quantidade !== null && o.quantidade > 0);
                const skippedOrders = orders.filter(o => o.quantidadeVazia);
                const errorOrders = orders.filter(o => o.error);
                
                console.log(`Preview - Total de pedidos: ${orders.length}`);
                console.log(`Preview - Pedidos válidos: ${validOrders.length}`);
                console.log(`Preview - Pedidos ignorados (quantidade vazia): ${skippedOrders.length}`);
                console.log(`Preview - Pedidos com erro: ${errorOrders.length}`);
                
                return (
                  <>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                          <span className="text-sm font-medium text-green-900">
                            {validOrders.length} pedido(s) pronto(s) para registrar
                          </span>
                        </div>
                        <span className="text-xs text-gray-600">
                          Total processado: {orders.length} linha(s)
                        </span>
                      </div>
                      {skippedOrders.length > 0 && (
                        <p className="text-xs text-yellow-700 mt-1">
                          ⚠️ {skippedOrders.length} linha(s) com quantidade vazia serão ignoradas
                        </p>
                      )}
                      {errorOrders.length > 0 && (
                        <p className="text-xs text-red-700 mt-1">
                          ⚠️ {errorOrders.length} linha(s) com erro encontradas - verifique a tabela abaixo
                        </p>
                      )}
                      <p className="text-xs text-green-700 mt-1">
                        ⚠️ O estoque dos itens será abatido automaticamente após a confirmação
                      </p>
                    </div>

                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                        <h3 className="text-sm font-medium text-gray-900">
                          📋 Todos os Pedidos do Arquivo
                        </h3>
                        <p className="text-xs text-gray-600 mt-1">
                          Revise todos os pedidos antes de confirmar a importação
                        </p>
                      </div>
                      <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50 sticky top-0 z-10">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Nº Pedido</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Item</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Quantidade</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Data</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Solicitante</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Observação</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {orders.map((order, index) => {
                              const hasError = !!order.error;
                              const isSkipped = order.quantidadeVazia;
                              const isValid = !hasError && !isSkipped && order.quantidade !== null && order.quantidade > 0;
                              const item = items.find(i => i.id === order.itemId);
                              
                              return (
                                <tr 
                                  key={index} 
                                  className={
                                    hasError 
                                      ? 'bg-red-50 hover:bg-red-100' 
                                      : isSkipped
                                      ? 'bg-yellow-50 hover:bg-yellow-100'
                                      : 'bg-green-50 hover:bg-green-100'
                                  }
                                >
                                  <td className="px-4 py-2">
                                    {hasError ? (
                                      <AlertCircle className="h-4 w-4 text-red-600" />
                                    ) : isSkipped ? (
                                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                                    ) : (
                                      <CheckCircle className="h-4 w-4 text-green-600" />
                                    )}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap">{order.numero_pedido || '-'}</td>
                                  <td className="px-4 py-2 text-sm text-gray-900">{order.nome_item || '-'}</td>
                                  <td className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap">
                                    {order.quantidade !== null && order.quantidade !== undefined 
                                      ? `${order.quantidade.toLocaleString('pt-BR')} ${item?.unit || ''}`
                                      : '-'}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap">
                                    {order.data ? formatDateForDisplay(order.data) : '-'}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-gray-900">{order.solicitante || '-'}</td>
                                  <td className="px-4 py-2 text-sm text-gray-500">
                                    {hasError ? (
                                      <span className="text-red-600 text-xs">{order.error}</span>
                                    ) : isSkipped ? (
                                      <span className="text-yellow-600 text-xs">Quantidade vazia - será ignorada</span>
                                    ) : (
                                      order.observacao || '-'
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {orders.length === 0 && (
                          <div className="text-center py-8 text-gray-500">
                            Nenhum pedido encontrado no arquivo
                          </div>
                        )}
                      </div>
                      <div className="bg-gray-50 px-4 py-2 border-t border-gray-200 text-xs text-gray-600 flex justify-between items-center">
                        <div>
                          Total: <strong>{orders.length}</strong> linha(s) - 
                          <strong className="text-green-600"> {validOrders.length}</strong> serão importadas - 
                          <strong className="text-yellow-600"> {skippedOrders.length}</strong> ignoradas - 
                          <strong className="text-red-600"> {errorOrders.length}</strong> com erro
                        </div>
                        <div className="text-gray-500">
                          {validOrders.length > 0 && (
                            <span className="text-green-600 font-medium">
                              ✓ {validOrders.length} pedido(s) válido(s) serão processados
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
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

