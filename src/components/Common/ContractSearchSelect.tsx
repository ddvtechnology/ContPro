import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';

interface Contract {
  id: string;
  number: string;
  contractor: string;
  status?: string;
}

interface ContractSearchSelectProps {
  contracts: Contract[];
  value: string;
  onChange: (contractId: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

export default function ContractSearchSelect({
  contracts,
  value,
  onChange,
  placeholder = 'Selecione um contrato',
  required = false,
  disabled = false
}: ContractSearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredContracts, setFilteredContracts] = useState<Contract[]>(contracts);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Encontrar o contrato selecionado
  const selectedContract = contracts.find(c => c.id === value);

  // Filtrar contratos com base na busca
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredContracts(contracts);
    } else {
      const term = searchTerm.toLowerCase();
      setFilteredContracts(
        contracts.filter(contract =>
          contract.number.toLowerCase().includes(term) ||
          contract.contractor.toLowerCase().includes(term)
        )
      );
    }
  }, [searchTerm, contracts]);

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

  const handleSelect = (contractId: string) => {
    onChange(contractId);
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
            {selectedContract ? (
              <div className="truncate">
                <span className="font-medium text-gray-900">{selectedContract.number}</span>
                <span className="text-gray-500 text-sm ml-2">- {selectedContract.contractor}</span>
              </div>
            ) : (
              <span className="text-gray-400">{placeholder}</span>
            )}
          </div>
          <div className="flex items-center space-x-1 ml-2">
            {selectedContract && !disabled && (
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
                placeholder="Buscar por número ou contratado..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
          </div>

          {/* Lista de contratos */}
          <div className="max-h-64 overflow-y-auto">
            {filteredContracts.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500 text-sm">
                <Search className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                Nenhum contrato encontrado
              </div>
            ) : (
              <div className="py-1">
                {filteredContracts.map((contract) => (
                  <button
                    key={contract.id}
                    type="button"
                    onClick={() => handleSelect(contract.id)}
                    className={`w-full px-4 py-2.5 text-left hover:bg-blue-50 transition-colors ${
                      contract.id === value ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 text-sm">
                          {contract.number}
                        </div>
                        <div className="text-gray-600 text-xs truncate mt-0.5">
                          {contract.contractor}
                        </div>
                      </div>
                      {contract.status && (
                        <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                          contract.status === 'ativo' 
                            ? 'bg-green-100 text-green-800' 
                            : contract.status === 'suspenso'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {contract.status}
                        </span>
                      )}
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



