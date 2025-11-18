import React, { useState, useEffect, useMemo } from 'react';
import { FileBarChart, Download, Calendar, Filter, TrendingUp, FileText, DollarSign, Clock, X, CheckSquare, Square } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, startOfQuarter, endOfQuarter, parseISO, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { formatDateForDisplay, parseDateFromDB } from '../../utils/dateUtils';
import * as XLSX from 'xlsx';

export default function ReportsPage() {
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [reportType, setReportType] = useState<'contracts' | 'addendums' | 'financial'>('contracts');
  const [contracts, setContracts] = useState<any[]>([]);
  const [addendums, setAddendums] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filtros avançados
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [addendumTypeFilter, setAddendumTypeFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  
  // Seleção de colunas
  const [visibleColumns, setVisibleColumns] = useState<{
    contracts: string[];
    addendums: string[];
  }>({
    contracts: ['number', 'object', 'contractor', 'value', 'status', 'startDate', 'endDate', 'category'],
    addendums: ['number', 'contract', 'type', 'description', 'value', 'date']
  });

  useEffect(() => {
    fetchContracts();
  }, []);

  const fetchContracts = async () => {
    try {
      setIsLoading(true);
      const [contractsResult, addendumsResult] = await Promise.all([
        supabase.from('contracts').select('*').order('created_at', { ascending: false }),
        supabase.from('addendums').select('*, contract:contracts(number, contractor)').order('date', { ascending: false })
      ]);
      
      if (contractsResult.error) throw contractsResult.error;
      if (addendumsResult.error) throw addendumsResult.error;
      
      setContracts(contractsResult.data || []);
      setAddendums(addendumsResult.data || []);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Extrair anos únicos dos dados baseado na data de início dos contratos
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    
    // Anos dos contratos baseado na data de início (start_date)
    contracts.forEach(contract => {
      if (contract.start_date) {
        const date = parseDateFromDB(contract.start_date);
        years.add(date.getFullYear());
      }
    });
    
    // Anos dos aditivos baseado na data
    addendums.forEach(addendum => {
      if (addendum.date) {
        const date = parseDateFromDB(addendum.date);
        years.add(date.getFullYear());
      }
    });
    
    const sortedYears = Array.from(years).sort((a, b) => b - a);
    
    // Se não houver anos, usar ano atual
    if (sortedYears.length === 0) {
      return [new Date().getFullYear()];
    }
    
    return sortedYears;
  }, [contracts, addendums]);

  // Inicializar com o primeiro ano disponível ou ano atual
  useEffect(() => {
    if (availableYears.length > 0 && !selectedYear) {
      setSelectedYear(availableYears[0].toString());
    }
  }, [availableYears, selectedYear]);

  // Calculate date range based on selected year and month
  const { startDate, endDate } = useMemo(() => {
    // Se "Todo Período" estiver selecionado, retornar null para não filtrar por data
    if (selectedYear === 'all') {
      return {
        startDate: null as Date | null,
        endDate: null as Date | null
      };
    }
    
    if (!selectedYear) {
      const now = new Date();
      const start = startOfYear(now);
      start.setHours(0, 0, 0, 0);
      const end = endOfYear(now);
      end.setHours(23, 59, 59, 999);
      return {
        startDate: start,
        endDate: end
      };
    }
    
    const year = parseInt(selectedYear);
    
    if (selectedMonth === 'all') {
      // Ano completo
      const start = new Date(year, 0, 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(year, 11, 31, 23, 59, 59);
      end.setHours(23, 59, 59, 999);
      return {
        startDate: start,
        endDate: end
      };
    } else if (selectedMonth === 'quarter1') {
      const start = new Date(year, 0, 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(year, 2, 31, 23, 59, 59);
      end.setHours(23, 59, 59, 999);
      return {
        startDate: start,
        endDate: end
      };
    } else if (selectedMonth === 'quarter2') {
      const start = new Date(year, 3, 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(year, 5, 30, 23, 59, 59);
      end.setHours(23, 59, 59, 999);
      return {
        startDate: start,
        endDate: end
      };
    } else if (selectedMonth === 'quarter3') {
      const start = new Date(year, 6, 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(year, 8, 30, 23, 59, 59);
      end.setHours(23, 59, 59, 999);
      return {
        startDate: start,
        endDate: end
      };
    } else if (selectedMonth === 'quarter4') {
      const start = new Date(year, 9, 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(year, 11, 31, 23, 59, 59);
      end.setHours(23, 59, 59, 999);
      return {
        startDate: start,
        endDate: end
      };
    } else {
      // Mês específico (1-12)
      const month = parseInt(selectedMonth) - 1;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const start = new Date(year, month, 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(year, month, lastDay, 23, 59, 59);
      end.setHours(23, 59, 59, 999);
      return {
        startDate: start,
        endDate: end
      };
    }
  }, [selectedYear, selectedMonth]);

  // Get unique categories and statuses
  const uniqueCategories = useMemo(() => {
    const categories = new Set(contracts.map(c => c.category).filter(Boolean));
    return Array.from(categories).sort();
  }, [contracts]);

  // Filter contracts with all filters
  const filteredContracts = useMemo(() => {
    let filtered = contracts.filter(contract => {
      // Filtro de data baseado na data de início (apenas se não for "Todo Período")
      if (startDate && endDate) {
        const contractDate = contract.start_date ? parseDateFromDB(contract.start_date) : null;
        if (!contractDate) return false;
        contractDate.setHours(0, 0, 0, 0); // Zerar horas para comparação precisa
        
        const inDateRange = contractDate >= startDate && contractDate <= endDate;
        if (!inDateRange) return false;
      }
      
      // Filtro de status
      if (statusFilter !== 'all' && contract.status !== statusFilter) return false;
      
      // Filtro de categoria
      if (categoryFilter !== 'all' && contract.category !== categoryFilter) return false;
      
      return true;
    });
    
    return filtered;
  }, [contracts, startDate, endDate, statusFilter, categoryFilter]);

  // Filter addendums with all filters
  const filteredAddendums = useMemo(() => {
    let filtered = addendums.filter(addendum => {
      // Filtro de data (apenas se não for "Todo Período")
      if (startDate && endDate) {
        const addendumDate = addendum.date ? parseDateFromDB(addendum.date) : null;
        if (!addendumDate) return false;
        addendumDate.setHours(0, 0, 0, 0); // Zerar horas para comparação precisa
        
        const inDateRange = addendumDate >= startDate && addendumDate <= endDate;
        if (!inDateRange) return false;
      }
      
      // Filtro de tipo
      if (addendumTypeFilter !== 'all' && addendum.type !== addendumTypeFilter) return false;
      
      return true;
    });
    
    return filtered;
  }, [addendums, startDate, endDate, addendumTypeFilter]);

  // Calculate metrics based on filtered data
  const contractMetrics = useMemo(() => ({
    total: filteredContracts.length,
    active: filteredContracts.filter(c => c.status === 'ativo').length,
    completed: filteredContracts.filter(c => c.status === 'encerrado').length,
    suspended: filteredContracts.filter(c => c.status === 'suspenso').length,
    totalValue: filteredContracts.reduce((sum, c) => sum + (c.value || 0), 0),
  }), [filteredContracts]);

  const addendumMetrics = useMemo(() => {
    const valorAddendums = filteredAddendums.filter(a => a.type === 'valor');
    return {
      total: filteredAddendums.length,
      valor: valorAddendums.length,
      prazo: filteredAddendums.filter(a => a.type === 'prazo').length,
      vigencia: filteredAddendums.filter(a => a.type === 'vigencia').length,
      apostilamento: filteredAddendums.filter(a => a.type === 'apostilamento').length,
      totalValue: valorAddendums.reduce((sum, a) => sum + (a.value || 0), 0),
    };
  }, [filteredAddendums]);

  const financialMetrics = useMemo(() => ({
    totalContractValue: contractMetrics.totalValue,
    totalAddendumValue: addendumMetrics.totalValue,
    totalValue: contractMetrics.totalValue + addendumMetrics.totalValue,
  }), [contractMetrics, addendumMetrics]);

  // Column definitions
  const contractColumns = {
    number: { label: 'Número', key: 'number' },
    object: { label: 'Objeto', key: 'object' },
    contractor: { label: 'Contratado', key: 'contractor' },
    value: { label: 'Valor', key: 'value' },
    status: { label: 'Status', key: 'status' },
    startDate: { label: 'Data Início', key: 'start_date' },
    endDate: { label: 'Data Término', key: 'end_date' },
    category: { label: 'Categoria', key: 'category' }
  };

  const addendumColumns = {
    number: { label: 'Número', key: 'number' },
    contract: { label: 'Contrato', key: 'contract' },
    type: { label: 'Tipo', key: 'type' },
    description: { label: 'Descrição', key: 'description' },
    value: { label: 'Valor', key: 'value' },
    date: { label: 'Data', key: 'date' }
  };

  const toggleColumn = (columnKey: string, type: 'contracts' | 'addendums') => {
    setVisibleColumns(prev => ({
      ...prev,
      [type]: prev[type].includes(columnKey)
        ? prev[type].filter(c => c !== columnKey)
        : [...prev[type], columnKey]
    }));
  };

  // Export functions - Excel melhorado
  const exportToExcel = () => {
    try {
      let workbook = XLSX.utils.book_new();
      let filename = '';
      let wsData: any[][] = [];

      if (reportType === 'contracts') {
        filename = `relatorio_contratos_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
        
        // Cabeçalho com estilo
        wsData.push(['RELATÓRIO DE CONTRATOS']);
        if (selectedYear === 'all') {
          wsData.push(['Período: Todo Período']);
        } else {
          wsData.push([`Ano: ${selectedYear} | Período: ${months.find(m => m.value === selectedMonth)?.label || 'Ano Completo'}`]);
          if (startDate && endDate) {
            wsData.push([`Intervalo: ${format(startDate, 'dd/MM/yyyy', { locale: ptBR })} - ${format(endDate, 'dd/MM/yyyy', { locale: ptBR })}`]);
          }
        }
        wsData.push([`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`]);
        wsData.push([]);
        
        // Seção de Métricas
        wsData.push(['MÉTRICAS RESUMIDAS']);
        wsData.push(['Total de Contratos', contractMetrics.total]);
        wsData.push(['Contratos Ativos', contractMetrics.active]);
        wsData.push(['Contratos Encerrados', contractMetrics.completed]);
        wsData.push(['Contratos Suspensos', contractMetrics.suspended]);
        wsData.push(['Valor Total dos Contratos', formatCurrency(contractMetrics.totalValue)]);
        wsData.push([]);
        
        // Filtros aplicados
        if (statusFilter !== 'all' || categoryFilter !== 'all') {
          wsData.push(['FILTROS APLICADOS']);
          if (statusFilter !== 'all') wsData.push(['Status', statusFilter]);
          if (categoryFilter !== 'all') wsData.push(['Categoria', categoryFilter]);
          wsData.push([]);
        }
        
        // Cabeçalho da tabela (apenas colunas visíveis)
        const headerRow: string[] = [];
        Object.entries(contractColumns).forEach(([key, col]) => {
          if (visibleColumns.contracts.includes(key)) {
            headerRow.push(col.label);
          }
        });
        wsData.push(headerRow);
        
        // Dados dos contratos
        filteredContracts.forEach(contract => {
          const row: any[] = [];
          Object.entries(contractColumns).forEach(([key, col]) => {
            if (visibleColumns.contracts.includes(key)) {
              if (key === 'value') {
                row.push(contract.value || 0);
              } else if (key === 'startDate') {
                row.push(contract.start_date ? formatDateForDisplay(contract.start_date) : '');
              } else if (key === 'endDate') {
                row.push(contract.end_date ? formatDateForDisplay(contract.end_date) : '');
              } else {
                row.push(contract[col.key] || '');
              }
            }
          });
          wsData.push(row);
        });

      } else if (reportType === 'addendums') {
        filename = `relatorio_aditivos_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
        
        wsData.push(['RELATÓRIO DE TERMOS ADITIVOS E APOSTILAMENTOS']);
        if (selectedYear === 'all') {
          wsData.push(['Período: Todo Período']);
        } else {
          wsData.push([`Ano: ${selectedYear} | Período: ${months.find(m => m.value === selectedMonth)?.label || 'Ano Completo'}`]);
          if (startDate && endDate) {
            wsData.push([`Intervalo: ${format(startDate, 'dd/MM/yyyy', { locale: ptBR })} - ${format(endDate, 'dd/MM/yyyy', { locale: ptBR })}`]);
          }
        }
        wsData.push([`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`]);
        wsData.push([]);
        
        wsData.push(['MÉTRICAS RESUMIDAS']);
        wsData.push(['Total de Termos Aditivos e Apostilamentos', addendumMetrics.total]);
        wsData.push(['Aditivos de Valor', addendumMetrics.valor]);
        wsData.push(['Aditivos de Prazo', addendumMetrics.prazo]);
        wsData.push(['Apostilamentos de Vigência', addendumMetrics.vigencia]);
        wsData.push(['Apostilamentos', addendumMetrics.apostilamento]);
        wsData.push(['Valor Total Adicionado', formatCurrency(addendumMetrics.totalValue)]);
        wsData.push([]);
        
        if (addendumTypeFilter !== 'all') {
          wsData.push(['FILTROS APLICADOS']);
          wsData.push(['Tipo', addendumTypeFilter]);
          wsData.push([]);
        }
        
        // Cabeçalho da tabela
        const headerRow: string[] = [];
        Object.entries(addendumColumns).forEach(([key, col]) => {
          if (visibleColumns.addendums.includes(key)) {
            headerRow.push(col.label);
          }
        });
        wsData.push(headerRow);
        
        // Dados dos aditivos
        filteredAddendums.forEach(addendum => {
          const row: any[] = [];
          Object.entries(addendumColumns).forEach(([key, col]) => {
            if (visibleColumns.addendums.includes(key)) {
              if (key === 'contract') {
                row.push(addendum.contract?.number || 'N/A');
              } else if (key === 'value') {
                row.push(addendum.value || 0);
              } else if (key === 'date') {
                row.push(addendum.date ? formatDateForDisplay(addendum.date) : '');
              } else {
                row.push(addendum[col.key] || '');
              }
            }
          });
          wsData.push(row);
        });

      } else {
        filename = `relatorio_financeiro_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
        
        wsData.push(['RELATÓRIO FINANCEIRO CONSOLIDADO']);
        if (selectedYear === 'all') {
          wsData.push(['Período: Todo Período']);
        } else {
          wsData.push([`Ano: ${selectedYear} | Período: ${months.find(m => m.value === selectedMonth)?.label || 'Ano Completo'}`]);
          if (startDate && endDate) {
            wsData.push([`Intervalo: ${format(startDate, 'dd/MM/yyyy', { locale: ptBR })} - ${format(endDate, 'dd/MM/yyyy', { locale: ptBR })}`]);
          }
        }
        wsData.push([`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`]);
        wsData.push([]);
        
        wsData.push(['ANÁLISE FINANCEIRA']);
        wsData.push(['Valor Total Contratos', formatCurrency(financialMetrics.totalContractValue)]);
        wsData.push(['Valor Total Aditivos', formatCurrency(financialMetrics.totalAddendumValue)]);
        wsData.push(['Valor Total Geral', formatCurrency(financialMetrics.totalValue)]);
        wsData.push([]);
        
        const percentAditivos = financialMetrics.totalContractValue > 0 
          ? Math.round((financialMetrics.totalAddendumValue / financialMetrics.totalContractValue) * 100) 
          : 0;
        wsData.push(['Percentual de Aditivos sobre Contratos', `${percentAditivos}%`]);
      }

      // Criar worksheet
      const worksheet = XLSX.utils.aoa_to_sheet(wsData);
      
      // Encontrar linha do cabeçalho da tabela
      const headerRowIndex = wsData.findIndex((row, index) => 
        row.length > 1 && index > 8
      );
      
      // Configurar largura das colunas
      if (headerRowIndex >= 0 && wsData[headerRowIndex]) {
        const headerRow = wsData[headerRowIndex];
        const colWidths = headerRow.map((header, colIndex) => {
          const headerLength = String(header || '').length;
          const maxDataLength = Math.max(
            ...wsData.slice(headerRowIndex + 1).map(row => {
              const cell = row[colIndex];
              return cell ? String(cell).length : 0;
            })
          );
          const maxLength = Math.max(headerLength, maxDataLength);
          return { wch: Math.min(Math.max(maxLength + 2, 12), 50) };
        });
        worksheet['!cols'] = colWidths;
      } else {
        const maxCols = Math.max(...wsData.map(row => row.length));
        worksheet['!cols'] = Array(maxCols).fill({ wch: 30 });
      }

      // Adicionar estilo com cores (usando células de estilo)
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      
      // Estilo para cabeçalho (primeira linha)
      if (!worksheet['A1']?.s) worksheet['A1'].s = {};
      worksheet['A1'].s = {
        font: { bold: true, sz: 16, color: { rgb: '1E40AF' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      };
      
      // Mesclar células do cabeçalho
      if (range.e.c > 0) {
        worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: range.e.c } }];
      }

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Relatório');
      XLSX.writeFile(workbook, filename);

    } catch (error) {
      console.error('Erro ao exportar para Excel:', error);
      alert('Erro ao exportar o relatório. Tente novamente.');
    }
  };

  // PDF melhorado
  const exportToPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Relatório - ${reportTypes.find(t => t.id === reportType)?.name}</title>
          <meta charset="UTF-8">
          <style>
            @page {
              margin: 2cm;
              size: A4;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Arial', 'Helvetica', sans-serif;
              font-size: 11pt;
              line-height: 1.6;
              color: #333;
              padding: 20px;
              background: #fff;
            }
            .header {
              border-bottom: 3px solid #1e40af;
              padding-bottom: 15px;
              margin-bottom: 25px;
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 20px;
            }
            .header-content {
              flex: 1;
            }
            .header-logo {
              height: 200px;
              width: auto;
              flex-shrink: 0;
              order: 2;
            }
            .header h1 {
              color: #1e40af;
              font-size: 24pt;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .header .subtitle {
              color: #666;
              font-size: 12pt;
            }
            .info-box {
              background: #f8f9fa;
              border-left: 4px solid #1e40af;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .info-box h3 {
              color: #1e40af;
              font-size: 14pt;
              margin-bottom: 10px;
              font-weight: bold;
            }
            .metrics-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 15px;
              margin: 20px 0;
            }
            .metric-card {
              background: #f8f9fa;
              border: 1px solid #dee2e6;
              padding: 15px;
              border-radius: 4px;
            }
            .metric-label {
              font-size: 10pt;
              color: #666;
              margin-bottom: 5px;
            }
            .metric-value {
              font-size: 14pt;
              font-weight: bold;
              color: #1e40af;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 25px;
              font-size: 10pt;
              page-break-inside: auto;
            }
            thead {
              background: #1e40af;
              color: white;
            }
            th {
              padding: 12px 8px;
              text-align: left;
              font-weight: bold;
              border: 1px solid #1e40af;
            }
            td {
              padding: 10px 8px;
              border: 1px solid #dee2e6;
            }
            tbody tr:nth-child(even) {
              background: #f8f9fa;
            }
            tbody tr:hover {
              background: #e9ecef;
            }
            .footer {
              margin-top: 30px;
              padding-top: 15px;
              border-top: 2px solid #dee2e6;
              text-align: center;
              font-size: 9pt;
              color: #666;
            }
            .currency {
              text-align: right;
              font-weight: bold;
            }
            .status-active { color: #10b981; font-weight: bold; }
            .status-encerrado { color: #8b5cf6; font-weight: bold; }
            .status-suspenso { color: #f59e0b; font-weight: bold; }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-content">
              <h1>${reportTypes.find(t => t.id === reportType)?.name}</h1>
              ${selectedYear === 'all' 
                ? '<div class="subtitle">Período: Todo Período</div>'
                : `<div class="subtitle">Ano: ${selectedYear} | Período: ${months.find(m => m.value === selectedMonth)?.label || 'Ano Completo'}</div>
                   ${startDate && endDate ? `<div class="subtitle">Intervalo: ${format(startDate, 'dd/MM/yyyy', { locale: ptBR })} - ${format(endDate, 'dd/MM/yyyy', { locale: ptBR })}</div>` : ''}`
              }
              ${statusFilter !== 'all' ? `<div class="subtitle">Filtro: Status = ${statusFilter}</div>` : ''}
              ${categoryFilter !== 'all' ? `<div class="subtitle">Filtro: Categoria = ${categoryFilter}</div>` : ''}
              ${addendumTypeFilter !== 'all' ? `<div class="subtitle">Filtro: Tipo = ${addendumTypeFilter}</div>` : ''}
              <div class="subtitle">Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</div>
            </div>
            <img src="/ContPro.svg" alt="ContPro Logo" class="header-logo" />
          </div>
          
          ${generatePDFContent()}
          
          <div class="footer">
            ContPro - Gestão de Contratos
          </div>
        </body>
      </html>
    `;
    
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
  };

  const generatePDFContent = () => {
    if (reportType === 'contracts') {
      const filtersInfo = [];
      if (statusFilter !== 'all') filtersInfo.push(`Status: ${statusFilter}`);
      if (categoryFilter !== 'all') filtersInfo.push(`Categoria: ${categoryFilter}`);
      
      return `
        <div class="info-box">
          <h3>Métricas Resumidas</h3>
          <div class="metrics-grid">
            <div class="metric-card">
              <div class="metric-label">Total de Contratos</div>
              <div class="metric-value">${contractMetrics.total}</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Contratos Ativos</div>
              <div class="metric-value" style="color: #10b981;">${contractMetrics.active}</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Contratos Encerrados</div>
              <div class="metric-value" style="color: #8b5cf6;">${contractMetrics.completed}</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Valor Total</div>
              <div class="metric-value">${formatCurrency(contractMetrics.totalValue)}</div>
            </div>
          </div>
          ${filtersInfo.length > 0 ? `<p style="margin-top: 10px;"><strong>Filtros aplicados:</strong> ${filtersInfo.join(', ')}</p>` : ''}
        </div>
        
        <h2 style="margin-top: 25px; margin-bottom: 15px; color: #374151; font-size: 16pt;">Contratos</h2>
        <table>
          <thead>
            <tr>
              ${Object.entries(contractColumns).filter(([key]) => visibleColumns.contracts.includes(key)).map(([_, col]) => `<th>${col.label}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${filteredContracts.length === 0 ? `
              <tr>
                <td colspan="${visibleColumns.contracts.length}" style="text-align: center; padding: 20px; color: #374151;">
                  Nenhum contrato encontrado para os filtros aplicados
                </td>
              </tr>
            ` : filteredContracts.map(c => `
              <tr>
                ${Object.entries(contractColumns).filter(([key]) => visibleColumns.contracts.includes(key)).map(([key, col]) => {
                  let cellValue = '';
                  if (key === 'value') {
                    cellValue = `<td class="currency">${formatCurrency(c.value || 0)}</td>`;
                  } else if (key === 'status') {
                    const statusClass = c.status === 'ativo' ? 'status-active' : c.status === 'encerrado' ? 'status-encerrado' : 'status-suspenso';
                    cellValue = `<td class="${statusClass}">${c.status || 'N/A'}</td>`;
                  } else if (key === 'startDate') {
                    cellValue = `<td>${c.start_date ? formatDateForDisplay(c.start_date) : '-'}</td>`;
                  } else if (key === 'endDate') {
                    cellValue = `<td>${c.end_date ? formatDateForDisplay(c.end_date) : '-'}</td>`;
                  } else {
                    cellValue = `<td>${(c[col.key] || '').toString().substring(0, 100)}</td>`;
                  }
                  return cellValue;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if (reportType === 'addendums') {
      const filtersInfo = [];
      if (addendumTypeFilter !== 'all') filtersInfo.push(`Tipo: ${addendumTypeFilter}`);
      
      return `
        <div class="info-box">
          <h3>Métricas Resumidas</h3>
          <div class="metrics-grid">
            <div class="metric-card">
              <div class="metric-label">Total</div>
              <div class="metric-value">${addendumMetrics.total}</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Aditivos de Valor</div>
              <div class="metric-value" style="color: #10b981;">${addendumMetrics.valor}</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Aditivos de Prazo</div>
              <div class="metric-value" style="color: #f59e0b;">${addendumMetrics.prazo}</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Valor Total Adicionado</div>
              <div class="metric-value">${formatCurrency(addendumMetrics.totalValue)}</div>
            </div>
          </div>
          ${filtersInfo.length > 0 ? `<p style="margin-top: 10px;"><strong>Filtros aplicados:</strong> ${filtersInfo.join(', ')}</p>` : ''}
        </div>
        
        <h2 style="margin-top: 25px; margin-bottom: 15px; color: #374151; font-size: 16pt;">Termos Aditivos e Apostilamentos</h2>
        <table>
          <thead>
            <tr>
              ${Object.entries(addendumColumns).filter(([key]) => visibleColumns.addendums.includes(key)).map(([_, col]) => `<th>${col.label}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${filteredAddendums.length === 0 ? `
              <tr>
                <td colspan="${visibleColumns.addendums.length}" style="text-align: center; padding: 20px; color: #999;">
                  Nenhum termo aditivo encontrado para os filtros aplicados
                </td>
              </tr>
            ` : filteredAddendums.map(a => `
              <tr>
                ${Object.entries(addendumColumns).filter(([key]) => visibleColumns.addendums.includes(key)).map(([key, col]) => {
                  let cellValue = '';
                  if (key === 'contract') {
                    cellValue = `<td>${a.contract?.number || 'N/A'}</td>`;
                  } else if (key === 'value') {
                    cellValue = `<td class="currency">${a.value ? formatCurrency(a.value) : '-'}</td>`;
                  } else if (key === 'date') {
                    cellValue = `<td>${a.date ? formatDateForDisplay(a.date) : '-'}</td>`;
                  } else {
                    cellValue = `<td>${(a[col.key] || '').toString().substring(0, 100)}</td>`;
                  }
                  return cellValue;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else {
      const percentAditivos = financialMetrics.totalContractValue > 0 
        ? Math.round((financialMetrics.totalAddendumValue / financialMetrics.totalContractValue) * 100) 
        : 0;
      
      return `
        <div class="info-box">
          <h3>Análise Financeira Consolidada</h3>
          <div class="metrics-grid">
            <div class="metric-card">
              <div class="metric-label">Valor Total Contratos</div>
              <div class="metric-value">${formatCurrency(financialMetrics.totalContractValue)}</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Valor Total Aditivos</div>
              <div class="metric-value" style="color: #10b981;">${formatCurrency(financialMetrics.totalAddendumValue)}</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Valor Total Geral</div>
              <div class="metric-value" style="color: #8b5cf6;">${formatCurrency(financialMetrics.totalValue)}</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">% Aditivos sobre Contratos</div>
              <div class="metric-value">${percentAditivos}%</div>
            </div>
          </div>
        </div>
      `;
    }
  };

  const handleExport = (type: 'pdf' | 'excel') => {
    if (type === 'pdf') {
      exportToPDF();
    } else {
      exportToExcel();
    }
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setCategoryFilter('all');
    setAddendumTypeFilter('all');
    if (availableYears.length > 0) {
      setSelectedYear(availableYears[0].toString());
    }
    setSelectedMonth('all');
  };

  const months = [
    { value: 'all', label: 'Ano Completo' },
    { value: 'quarter1', label: '1º Trimestre' },
    { value: 'quarter2', label: '2º Trimestre' },
    { value: 'quarter3', label: '3º Trimestre' },
    { value: 'quarter4', label: '4º Trimestre' },
    { value: '1', label: 'Janeiro' },
    { value: '2', label: 'Fevereiro' },
    { value: '3', label: 'Março' },
    { value: '4', label: 'Abril' },
    { value: '5', label: 'Maio' },
    { value: '6', label: 'Junho' },
    { value: '7', label: 'Julho' },
    { value: '8', label: 'Agosto' },
    { value: '9', label: 'Setembro' },
    { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' },
    { value: '12', label: 'Dezembro' }
  ];

  const reportTypes = [
    {
      id: 'contracts',
      name: 'Relatório de Contratos',
      description: 'Análise completa dos contratos por período',
      icon: FileText,
      color: 'blue'
    },
    {
      id: 'addendums',
      name: 'Relatório de Termos Aditivos e Apostilamentos',
      description: 'Análise de aditivos de valor, prazo e apostilamentos',
      icon: FileText,
      color: 'green'
    },
    {
      id: 'financial',
      name: 'Relatório Financeiro',
      description: 'Consolidado financeiro e indicadores',
      icon: TrendingUp,
      color: 'purple'
    }
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Relatórios e Análises</h1>
        <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-2">
          {/* Filtro de Ano */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs sm:text-sm"
          >
            <option value="all">Todo Período</option>
            {availableYears.map(year => (
              <option key={year} value={year.toString()}>
                {year}
              </option>
            ))}
          </select>
          
          {/* Filtro de Mês/Trimestre */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            disabled={selectedYear === 'all'}
            className={`border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs sm:text-sm ${
              selectedYear === 'all' ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''
            }`}
          >
            {months.map(month => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>

          {/* Filtro de Status - Sempre visível para contratos */}
          {reportType === 'contracts' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos os Status</option>
              <option value="ativo">Ativo</option>
              <option value="suspenso">Suspenso</option>
              <option value="encerrado">Encerrado</option>
            </select>
          )}

          {/* Filtro de Tipo - Sempre visível para aditivos */}
          {reportType === 'addendums' && (
            <select
              value={addendumTypeFilter}
              onChange={(e) => setAddendumTypeFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos os Tipos</option>
              <option value="valor">Aditivo de Valor</option>
              <option value="prazo">Aditivo de Prazo</option>
              <option value="vigencia">Apostilamento de Vigência</option>
              <option value="apostilamento">Apostilamento</option>
            </select>
          )}

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors ${
              showFilters 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Filter className="h-4 w-4" />
            <span>Mais Filtros</span>
          </button>
          
          <button 
            onClick={() => handleExport('excel')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* Painel de Filtros Avançados */}
      {showFilters && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Filtros Adicionais</h3>
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
            >
              <X className="h-4 w-4" />
              <span>Limpar Todos</span>
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Filtro de Categoria - Apenas para contratos */}
            {reportType === 'contracts' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Categoria
                </label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">Todas as Categorias</option>
                  {uniqueCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Indicadores de Filtros Ativos */}
          {(statusFilter !== 'all' || categoryFilter !== 'all' || addendumTypeFilter !== 'all' || selectedMonth !== 'all' || selectedYear === 'all') && (
            <div className="mt-4 flex flex-wrap gap-2">
              {selectedYear === 'all' && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-indigo-100 text-indigo-800">
                  Período: Todo Período
                  <button onClick={() => setSelectedYear(availableYears[0]?.toString() || '')} className="ml-2">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {statusFilter !== 'all' && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                  Status: {statusFilter}
                  <button onClick={() => setStatusFilter('all')} className="ml-2">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {categoryFilter !== 'all' && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
                  Categoria: {categoryFilter}
                  <button onClick={() => setCategoryFilter('all')} className="ml-2">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {addendumTypeFilter !== 'all' && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-100 text-purple-800">
                  Tipo: {addendumTypeFilter}
                  <button onClick={() => setAddendumTypeFilter('all')} className="ml-2">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {selectedYear !== 'all' && selectedMonth !== 'all' && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-orange-100 text-orange-800">
                  Período: {months.find(m => m.value === selectedMonth)?.label}
                  <button onClick={() => setSelectedMonth('all')} className="ml-2">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Seletor de Colunas - Apenas para contracts e addendums */}
      {(reportType === 'contracts' || reportType === 'addendums') && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Colunas Visíveis</h3>
            <button
              onClick={() => {
                if (reportType === 'contracts') {
                  setVisibleColumns(prev => ({
                    ...prev,
                    contracts: Object.keys(contractColumns)
                  }));
                } else {
                  setVisibleColumns(prev => ({
                    ...prev,
                    addendums: Object.keys(addendumColumns)
                  }));
                }
              }}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Selecionar Todas
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(reportType === 'contracts' ? Object.entries(contractColumns) : Object.entries(addendumColumns)).map(([key, col]) => (
              <label key={key} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={(reportType === 'contracts' ? visibleColumns.contracts : visibleColumns.addendums).includes(key)}
                  onChange={() => toggleColumn(key, reportType as 'contracts' | 'addendums')}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{col.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Report Type Selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {reportTypes.map((type) => (
          <button
            key={type.id}
            onClick={() => setReportType(type.id as any)}
            className={`text-left p-6 rounded-xl border-2 transition-all ${
              reportType === type.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg ${
                type.color === 'blue' ? 'bg-blue-100' :
                type.color === 'green' ? 'bg-green-100' : 'bg-purple-100'
              }`}>
                <type.icon className={`h-6 w-6 ${
                  type.color === 'blue' ? 'text-blue-600' :
                  type.color === 'green' ? 'text-green-600' : 'text-purple-600'
                }`} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{type.name}</h3>
                <p className="text-sm text-gray-500">{type.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Metrics Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        {reportType === 'contracts' && (
          <>
            <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Total de Contratos</p>
                  <p className="text-sm sm:text-lg lg:text-xl font-bold text-gray-900 truncate">{contractMetrics.total}</p>
                </div>
                <div className="bg-blue-100 p-2 sm:p-3 rounded-lg flex-shrink-0">
                  <FileText className="h-4 sm:h-5 w-4 sm:w-5 text-blue-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Contratos Ativos</p>
                  <p className="text-sm sm:text-lg lg:text-xl font-bold text-green-600 truncate">{contractMetrics.active}</p>
                </div>
                <div className="bg-green-100 p-2 sm:p-3 rounded-lg flex-shrink-0">
                  <div className="h-4 sm:h-5 w-4 sm:w-5 bg-green-600 rounded-full"></div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Encerrados</p>
                  <p className="text-sm sm:text-lg lg:text-xl font-bold text-purple-600 truncate">{contractMetrics.completed}</p>
                </div>
                <div className="bg-purple-100 p-2 sm:p-3 rounded-lg flex-shrink-0">
                  <div className="h-4 sm:h-5 w-4 sm:w-5 bg-purple-600 rounded-full"></div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Valor Total</p>
                  <p className="text-sm sm:text-lg lg:text-xl font-bold text-blue-600 truncate">
                    {formatCurrency(contractMetrics.totalValue)}
                  </p>
                </div>
                <div className="bg-blue-100 p-2 sm:p-3 rounded-lg flex-shrink-0">
                  <DollarSign className="h-4 sm:h-5 w-4 sm:w-5 text-blue-600" />
                </div>
              </div>
            </div>
          </>
        )}

        {reportType === 'addendums' && (
          <>
            <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Total</p>
                  <p className="text-sm sm:text-lg lg:text-xl font-bold text-gray-900 truncate">{addendumMetrics.total}</p>
                </div>
                <div className="bg-blue-100 p-2 sm:p-3 rounded-lg flex-shrink-0">
                  <FileText className="h-4 sm:h-5 w-4 sm:w-5 text-blue-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Aditivos de Valor</p>
                  <p className="text-sm sm:text-lg lg:text-xl font-bold text-blue-600 truncate">{addendumMetrics.valor}</p>
                </div>
                <div className="bg-blue-100 p-2 sm:p-3 rounded-lg flex-shrink-0">
                  <DollarSign className="h-4 sm:h-5 w-4 sm:w-5 text-blue-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Aditivos de Prazo</p>
                  <p className="text-sm sm:text-lg lg:text-xl font-bold text-green-600 truncate">{addendumMetrics.prazo}</p>
                </div>
                <div className="bg-green-100 p-2 sm:p-3 rounded-lg flex-shrink-0">
                  <div className="h-4 sm:h-5 w-4 sm:w-5 bg-green-600 rounded-full"></div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Valor Total</p>
                  <p className="text-sm sm:text-lg lg:text-xl font-bold text-purple-600 truncate">
                    {formatCurrency(addendumMetrics.totalValue)}
                  </p>
                </div>
                <div className="bg-purple-100 p-2 sm:p-3 rounded-lg flex-shrink-0">
                  <DollarSign className="h-4 sm:h-5 w-4 sm:w-5 text-purple-600" />
                </div>
              </div>
            </div>
          </>
        )}

        {reportType === 'financial' && (
          <>
            <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Valor Total Contratos</p>
                  <p className="text-sm sm:text-lg lg:text-xl font-bold text-blue-600 truncate">
                    {formatCurrency(financialMetrics.totalContractValue)}
                  </p>
                </div>
                <div className="bg-blue-100 p-2 sm:p-3 rounded-lg flex-shrink-0">
                  <DollarSign className="h-4 sm:h-5 w-4 sm:w-5 text-blue-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Valor Total Aditivos</p>
                  <p className="text-sm sm:text-lg lg:text-xl font-bold text-green-600 truncate">
                    {formatCurrency(financialMetrics.totalAddendumValue)}
                  </p>
                </div>
                <div className="bg-green-100 p-2 sm:p-3 rounded-lg flex-shrink-0">
                  <DollarSign className="h-4 sm:h-5 w-4 sm:w-5 text-green-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Valor Total Geral</p>
                  <p className="text-sm sm:text-lg lg:text-xl font-bold text-purple-600 truncate">
                    {formatCurrency(financialMetrics.totalValue)}
                  </p>
                </div>
                <div className="bg-purple-100 p-2 sm:p-3 rounded-lg flex-shrink-0">
                  <TrendingUp className="h-4 sm:h-5 w-4 sm:w-5 text-purple-600" />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Detailed Report with Tables */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">
            {reportTypes.find(t => t.id === reportType)?.name}
          </h3>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <Calendar className="h-4 w-4" />
            <span>
              {selectedYear === 'all' 
                ? 'Período: Todo Período'
                : startDate && endDate 
                  ? `Período: ${format(startDate, 'dd/MM/yyyy', { locale: ptBR })} - ${format(endDate, 'dd/MM/yyyy', { locale: ptBR })}`
                  : 'Período: Não definido'
              }
            </span>
          </div>
        </div>

        {reportType === 'contracts' && (
          <div className="space-y-6">
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    {Object.entries(contractColumns).filter(([key]) => visibleColumns.contracts.includes(key)).map(([_, col]) => (
                      <th key={col.key} className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredContracts.length === 0 ? (
                    <tr>
                      <td colSpan={visibleColumns.contracts.length} className="px-3 py-4 text-center text-gray-500">
                        Nenhum contrato encontrado para os filtros aplicados
                      </td>
                    </tr>
                  ) : (
                    filteredContracts.map((contract) => (
                      <tr key={contract.id} className="hover:bg-gray-50">
                        {Object.entries(contractColumns).filter(([key]) => visibleColumns.contracts.includes(key)).map(([key, col]) => {
                          if (key === 'value') {
                            return (
                              <td key={key} className="px-2 py-1.5 text-xs font-medium text-blue-600">
                                {formatCurrency(contract.value || 0)}
                              </td>
                            );
                          } else if (key === 'status') {
                            return (
                              <td key={key} className="px-2 py-1.5">
                                <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded-full ${
                                  contract.status === 'ativo' ? 'bg-green-100 text-green-800' :
                                  contract.status === 'encerrado' ? 'bg-purple-100 text-purple-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {contract.status || 'N/A'}
                        </span>
                              </td>
                            );
                          } else if (key === 'startDate') {
                            return (
                              <td key={key} className="px-2 py-1.5 text-xs text-gray-600">
                                {contract.start_date ? formatDateForDisplay(contract.start_date) : '-'}
                              </td>
                            );
                          } else if (key === 'endDate') {
                            return (
                              <td key={key} className="px-2 py-1.5 text-xs text-gray-600">
                                {contract.end_date ? formatDateForDisplay(contract.end_date) : '-'}
                              </td>
                            );
                          } else {
                            return (
                              <td key={key} className="px-2 py-1.5 text-xs text-gray-900 max-w-[150px] truncate" title={String(contract[col.key] || '')}>
                                {contract[col.key] || 'N/A'}
                              </td>
                            );
                          }
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Mobile Cards for Contracts */}
            <div className="lg:hidden space-y-4">
              {filteredContracts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Nenhum contrato encontrado para os filtros aplicados
                </div>
              ) : (
                filteredContracts.map((contract) => (
                  <div key={contract.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-gray-900">{contract.number}</div>
                        <div className="text-sm text-gray-500">{contract.category}</div>
                      </div>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        contract.status === 'ativo' ? 'bg-green-100 text-green-800' :
                        contract.status === 'encerrado' ? 'bg-purple-100 text-purple-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {contract.status || 'N/A'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-700">{contract.object}</div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500">Contratado:</span>
                        <div className="font-medium">{contract.contractor}</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Valor:</span>
                        <div className="font-medium text-blue-600">{formatCurrency(contract.value || 0)}</div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-600">
                      <div>Início: {contract.start_date ? formatDateForDisplay(contract.start_date) : '-'}</div>
                      <div>Fim: {contract.end_date ? formatDateForDisplay(contract.end_date) : '-'}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {reportType === 'addendums' && (
          <div className="space-y-6">
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    {Object.entries(addendumColumns).filter(([key]) => visibleColumns.addendums.includes(key)).map(([_, col]) => (
                      <th key={col.key} className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredAddendums.length === 0 ? (
                    <tr>
                      <td colSpan={visibleColumns.addendums.length} className="px-3 py-4 text-center text-gray-500">
                        Nenhum termo aditivo encontrado para os filtros aplicados
                      </td>
                    </tr>
                  ) : (
                    filteredAddendums.map((addendum) => (
                      <tr key={addendum.id} className="hover:bg-gray-50">
                        {Object.entries(addendumColumns).filter(([key]) => visibleColumns.addendums.includes(key)).map(([key, col]) => {
                          if (key === 'contract') {
                            return (
                              <td key={key} className="px-2 py-1.5 text-xs text-gray-600">
                                {addendum.contract?.number || 'N/A'}
                              </td>
                            );
                          } else if (key === 'value') {
                            return (
                              <td key={key} className="px-2 py-1.5 text-xs font-medium text-blue-600">
                                {addendum.value ? formatCurrency(addendum.value) : '-'}
                              </td>
                            );
                          } else if (key === 'type') {
                            return (
                              <td key={key} className="px-2 py-1.5">
                                <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded-full ${
                                  addendum.type === 'valor' ? 'bg-green-100 text-green-800' :
                                  addendum.type === 'prazo' ? 'bg-yellow-100 text-yellow-800' :
                                  addendum.type === 'vigencia' ? 'bg-blue-100 text-blue-800' :
                                  'bg-purple-100 text-purple-800'
                                }`}>
                                  {addendum.type || 'N/A'}
                    </span>
                              </td>
                            );
                          } else if (key === 'date') {
                            return (
                              <td key={key} className="px-2 py-1.5 text-xs text-gray-600">
                                {addendum.date ? formatDateForDisplay(addendum.date) : '-'}
                              </td>
                            );
                          } else {
                            return (
                              <td key={key} className="px-2 py-1.5 text-xs text-gray-600 max-w-[150px] truncate" title={String(addendum[col.key] || '')}>
                                {addendum[col.key] || 'N/A'}
                              </td>
                            );
                          }
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Mobile Cards for Addendums */}
            <div className="lg:hidden space-y-4">
              {filteredAddendums.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Nenhum termo aditivo encontrado para os filtros aplicados
                </div>
              ) : (
                filteredAddendums.map((addendum) => (
                  <div key={addendum.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-gray-900">{addendum.number}</div>
                        <div className="text-sm text-gray-500">{addendum.contract?.number || 'N/A'}</div>
                      </div>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        addendum.type === 'valor' ? 'bg-green-100 text-green-800' :
                        addendum.type === 'prazo' ? 'bg-yellow-100 text-yellow-800' :
                        addendum.type === 'vigencia' ? 'bg-blue-100 text-blue-800' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                        {addendum.type || 'N/A'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-700">{addendum.description}</div>
                    {addendum.value && (
                      <div className="text-sm font-medium text-blue-600">
                        Valor: {formatCurrency(addendum.value)}
                      </div>
                    )}
                    <div className="text-xs text-gray-600">
                      Data: {addendum.date ? formatDateForDisplay(addendum.date) : '-'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {reportType === 'financial' && (
          <div className="space-y-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Análise Financeira Consolidada</h4>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-blue-600">
                      {financialMetrics.totalContractValue > 0 ? Math.round((financialMetrics.totalAddendumValue / financialMetrics.totalContractValue) * 100) : 0}%
                    </p>
                    <p className="text-sm text-gray-600">% Aditivos sobre Contratos</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-purple-600">
                      {formatCurrency(financialMetrics.totalAddendumValue)}
                    </p>
                    <p className="text-sm text-gray-600">Valor Total Aditivos</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(financialMetrics.totalValue)}
                    </p>
                    <p className="text-sm text-gray-600">Valor Total Geral</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Export Options */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Opções de Exportação</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button 
            onClick={() => handleExport('pdf')}
            className="flex items-center justify-center space-x-2 p-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <FileBarChart className="h-5 w-5 text-blue-600" />
            <span>Exportar PDF</span>
          </button>
          <button 
            onClick={() => handleExport('excel')}
            className="flex items-center justify-center space-x-2 p-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <FileText className="h-5 w-5 text-green-600" />
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>
    </div>
  );
}
