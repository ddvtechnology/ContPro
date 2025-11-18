import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';

interface Addendum {
  id: string;
  number: string;
  type: string;
  description: string;
  contract?: {
    number: string;
    contractor: string;
  };
}

interface AddendumSearchSelectProps {
  addendums: Addendum[];
  value: string;
  onChange: (addendumId: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

export default function AddendumSearchSelect({
  addendums,
  value,
  onChange,
  placeholder = 'Selecione um termo aditivo/apostilamento',
  required = false,
  disabled = false
}: AddendumSearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredAddendums, setFilteredAddendums] = useState<Addendum[]>(addendums);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Encontrar o aditivo selecionado
  const selectedAddendum = addendums.find(a => a.id === value);

  // Função auxiliar para obter label do tipo
  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'valor': return '💰 Aditivo de Valor';
      case 'prazo': return '📅 Aditivo de Prazo';
      case 'vigencia': return '⏰ Apostilamento de Vigência';
      case 'apostilamento': return '📝 Apostilamento';
      default: return type;
    }
  };

  // Filtrar aditivos com base na busca
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredAddendums(addendums);
    } else {
      const term = searchTerm.toLowerCase();
      setFilteredAddendums(
        addendums.filter(addendum =>
          addendum.number.toLowerCase().includes(term) ||
          addendum.description.toLowerCase().includes(term) ||
          addendum.type.toLowerCase().includes(term) ||
          addendum.contract?.number.toLowerCase().includes(term) ||
          addendum.contract?.contractor.toLowerCase().includes(term)
        )
      );
    }
  }, [searchTerm, addendums]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Focar no input de busca quando abrir
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (addendumId: string) => {
    onChange(addendumId);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Campo de seleção */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-3 py-2 border rounded-lg text-left focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
          disabled 
            ? 'bg-gray-100 cursor-not-allowed' 
            : 'bg-white hover:border-gray-400 cursor-pointer'
        } ${
          isOpen ? 'border-blue-500 ring-2 ring-blue-500' : 'border-gray-300'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            {selectedAddendum ? (
              <div className="truncate">
                <span className="font-medium text-gray-900">{selectedAddendum.number}</span>
                <span className="text-gray-500 text-sm ml-2">- {getTypeLabel(selectedAddendum.type)}</span>
                {selectedAddendum.contract && (
                  <span className="text-gray-500 text-sm ml-2">({selectedAddendum.contract.number})</span>
                )}
              </div>
            ) : (
              <span className="text-gray-400">{placeholder}</span>
            )}
          </div>
          <div className="flex items-center space-x-1 ml-2">
            {selectedAddendum && !disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
              </button>
            )}
            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
          </div>
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-80 overflow-hidden">
          {/* Campo de busca */}
          <div className="p-2 border-b border-gray-200 bg-gray-50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por número, tipo, descrição ou contrato..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
          </div>

          {/* Lista de aditivos */}
          <div className="max-h-64 overflow-y-auto">
            {filteredAddendums.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500 text-sm">
                <Search className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                Nenhum termo aditivo/apostilamento encontrado
              </div>
            ) : (
              <div className="py-1">
                {filteredAddendums.map((addendum) => (
                  <button
                    key={addendum.id}
                    type="button"
                    onClick={() => handleSelect(addendum.id)}
                    className={`w-full px-4 py-2.5 text-left hover:bg-blue-50 transition-colors ${
                      addendum.id === value ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 text-sm">
                          {addendum.number}
                        </div>
                        <div className="text-gray-600 text-xs truncate mt-0.5">
                          {getTypeLabel(addendum.type)} {addendum.contract && `• ${addendum.contract.number}`}
                        </div>
                        {addendum.description && (
                          <div className="text-gray-500 text-xs truncate mt-0.5">
                            {addendum.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Input hidden para validação de formulário */}
      <input
        type="hidden"
        value={value}
        required={required}
      />
    </div>
  );
}

