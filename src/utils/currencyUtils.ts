/**
 * Utilitários para formatação de moeda brasileira (Real)
 */

/**
 * Formata um número para o formato brasileiro de moeda (ex: 50000.50 -> "50.000,50")
 * Aceita entrada como string formatada, número ou string numérica
 */
export function formatCurrencyInput(value: number | string): string {
  if (value === '' || value === null || value === undefined) return '';
  
  // Se for string, pode já estar formatada ou ser número puro
  if (typeof value === 'string') {
    // Se já está no formato brasileiro válido, retornar como está
    if (/^\d{1,3}(\.\d{3})*,\d{2}$/.test(value.trim())) {
      return value.trim();
    }
    
    // Remover tudo exceto números
    const numbers = value.replace(/\D/g, '');
    if (!numbers) return '';
    
    // Converter para número (dividir por 100 para ter centavos)
    const numValue = parseFloat(numbers) / 100;
    if (isNaN(numValue)) return '';
    
    // Formatar como moeda brasileira
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numValue);
  }
  
  // Se for número
  if (typeof value === 'number') {
    if (isNaN(value)) return '';
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }
  
  return '';
}

/**
 * Converte um valor formatado em Real brasileiro para número
 * (ex: "50.000,50" -> 50000.50)
 */
export function parseCurrencyInput(value: string): number {
  if (!value) return 0;
  
  // Remover tudo exceto números, vírgulas e pontos
  const cleaned = value.replace(/[^\d,.-]/g, '');
  
  // Se não tem vírgula, tratar ponto como decimal
  if (!cleaned.includes(',')) {
    return parseFloat(cleaned) || 0;
  }
  
  // Formato brasileiro: remover pontos (milhares) e substituir vírgula por ponto (decimal)
  const normalized = cleaned
    .replace(/\./g, '')  // Remove pontos (milhares)
    .replace(',', '.');  // Substitui vírgula por ponto (decimal)
  
  return parseFloat(normalized) || 0;
}

/**
 * Formata um número para exibição como moeda brasileira
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

/**
 * Aplica máscara de moeda brasileira enquanto o usuário digita
 */
export function handleCurrencyInput(value: string): string {
  // Remove tudo exceto números
  const numbers = value.replace(/\D/g, '');
  
  if (!numbers) return '';
  
  // Converte para número e divide por 100 para ter os centavos
  const number = parseFloat(numbers) / 100;
  
  // Formata como moeda brasileira
  return formatCurrencyInput(number);
}
