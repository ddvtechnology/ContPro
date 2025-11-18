/**
 * Utilitários para manipulação de datas com fuso horário de Brasília
 */

/**
 * Converte uma data para o formato ISO sem considerar timezone
 * Útil para enviar datas ao Supabase
 */
export function formatDateForDB(date: Date | string): string {
  // Se for string, usar parseDateFromDB para evitar problemas de timezone
  const d = typeof date === 'string' ? parseDateFromDB(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Converte uma string de data do banco para um objeto Date
 * Garante que a data seja interpretada no fuso horário local (Brasília)
 */
export function parseDateFromDB(dateString: string): Date {
  if (!dateString) return new Date();
  
  // Se já tiver timezone, criar normalmente
  if (dateString.includes('T') || dateString.includes('Z')) {
    return new Date(dateString);
  }
  
  // Para datas no formato YYYY-MM-DD, adicionar o horário para evitar conversão de timezone
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Obtém a data atual no formato YYYY-MM-DD (Brasília)
 */
export function getCurrentDate(): string {
  return formatDateForDB(new Date());
}

/**
 * Formata uma data para exibição no padrão brasileiro
 */
export function formatDateForDisplay(date: Date | string): string {
  const d = typeof date === 'string' ? parseDateFromDB(date) : date;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Formata uma data para input do tipo date (YYYY-MM-DD)
 */
export function formatDateForInput(date: Date | string | null): string {
  if (!date) return '';
  const d = typeof date === 'string' ? parseDateFromDB(date) : date;
  return formatDateForDB(d);
}

/**
 * Compara duas datas (ignora horário)
 */
export function compareDates(date1: Date | string, date2: Date | string): number {
  const d1 = typeof date1 === 'string' ? parseDateFromDB(date1) : date1;
  const d2 = typeof date2 === 'string' ? parseDateFromDB(date2) : date2;
  
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  
  return d1.getTime() - d2.getTime();
}

/**
 * Adiciona dias a uma data
 */
export function addDays(date: Date | string, days: number): Date {
  const d = typeof date === 'string' ? parseDateFromDB(date) : new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Verifica se uma data está dentro de um período
 */
export function isDateInRange(date: Date | string, startDate: Date | string, endDate: Date | string): boolean {
  const d = typeof date === 'string' ? parseDateFromDB(date) : date;
  const start = typeof startDate === 'string' ? parseDateFromDB(startDate) : startDate;
  const end = typeof endDate === 'string' ? parseDateFromDB(endDate) : endDate;
  
  return d >= start && d <= end;
}


