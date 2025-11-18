import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronRight, ChevronLeft, CheckCircle, Sparkles } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface TourStep {
  target: string;
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  route?: string;
  section?: string;
}

interface InteractiveTourProps {
  isOpen: boolean;
  onClose: () => void;
}

const tourSteps: TourStep[] = [
  // ============================================================================
  // SEÇÃO 1: DASHBOARD E SEUS ELEMENTOS
  // ============================================================================
  {
    target: 'body',
    title: 'Bem-vindo ao Sistema de Gestão de Contratos! 👋',
    description: 'Vou te mostrar rapidamente como usar todas as funcionalidades. O tour tem 14 passos e leva apenas 3 minutos. Vamos começar!',
    position: 'center',
    route: '/',
    section: 'Início',
  },
  {
    target: 'DASHBOARD_CARDS',
    title: 'Cards de Resumo',
    description: 'Estes cards mostram a visão geral: total de contratos, quantos estão ativos, valor global dos contratos, alertas de vencimento e quantidade de aditivos e apostilamentos. Clique em qualquer card para filtrar!',
    position: 'bottom',
    route: '/',
    section: 'Dashboard',
  },
  
  // ============================================================================
  // SEÇÃO 2: CONTRATOS E SEUS ELEMENTOS
  // ============================================================================
  {
    target: 'a[href="/contracts"]',
    title: 'Gestão de Contratos',
    description: 'Aqui você cria, edita e visualiza todos os contratos. Esta é a área mais importante do sistema!',
    position: 'right',
    route: '/',
    section: 'Contratos',
  },
  {
    target: 'BUTTON_NOVO_CONTRATO',
    title: 'Botão Novo Contrato',
    description: 'O botão azul "Novo Contrato" abre o formulário de cadastro. Preencha número, objeto, contratado, valor e datas. Você pode anexar documentos junto!',
    position: 'bottom',
    route: '/contracts',
    section: 'Contratos',
  },
  {
    target: '.search-input',
    title: 'Busca e Filtros',
    description: 'Use a busca para encontrar contratos por número, objeto ou contratado. Os filtros à direita permitem filtrar por status (ativo/suspenso/encerrado) ou ver contratos vencendo.',
    position: 'bottom',
    route: '/contracts',
    section: 'Contratos',
  },
  {
    target: 'TABLE_CONTRATOS',
    title: 'Tabela de Contratos',
    description: 'A tabela mostra todos os contratos. Ações disponíveis: Olho (👁️) = ver detalhes | Lápis (✏️) = editar | Lixeira (🗑️) = excluir. O número ao lado mostra quantos aditivos o contrato tem.',
    position: 'top',
    route: '/contracts',
    section: 'Contratos',
  },
  
  // ============================================================================
  // SEÇÃO 3: TERMOS ADITIVOS E APOSTILAMENTOS E SEUS ELEMENTOS
  // ============================================================================
  {
    target: 'a[href="/addendums"]',
    title: 'Termos Aditivos e Apostilamentos',
    description: 'Gerencie 4 tipos de documentos conforme a Lei 14.133: Aditivo de Valor (até 25%), Aditivo de Prazo (execução), Apostilamento de Vigência (renovação) e Apostilamento (outras alterações).',
    position: 'right',
    route: '/',
    section: 'Termos Aditivos',
  },
  {
    target: 'BUTTON_NOVO_DOCUMENTO',
    title: 'Página de Aditivos e Apostilamentos',
    description: 'Cards coloridos mostram métricas por tipo. Botão azul cria novo documento. Filtros permitem buscar por tipo ou contrato específico. Na tabela, cada tipo tem cor diferente: Amarelo (Valor), Azul (Prazo), Verde (Vigência), Roxo (Apostilamento).',
    position: 'bottom',
    route: '/addendums',
    section: 'Termos Aditivos',
  },
  
  // ============================================================================
  // SEÇÃO 4: DOCUMENTOS E SEUS ELEMENTOS
  // ============================================================================
  {
    target: 'a[href="/documents"]',
    title: 'Gestão de Documentos',
    description: 'Centralize todos os arquivos do sistema: PDFs, imagens, planilhas.',
    position: 'right',
    route: '/',
    section: 'Documentos',
  },
  {
    target: 'BUTTON_UPLOAD',
    title: 'Upload e Organização',
    description: 'Botão azul faz upload. Vincule documentos a contratos ou aditivos específicos. Use filtros para encontrar por tipo de arquivo (PDF/DOC/XLS) ou categoria. Ações: Olho = visualizar, Download = baixar, Lápis = editar, Lixeira = excluir.',
    position: 'bottom',
    route: '/documents',
    section: 'Documentos',
  },
  
  // ============================================================================
  // SEÇÃO 5: RELATÓRIOS E SEUS ELEMENTOS
  // ============================================================================
  {
    target: 'a[href="/reports"]',
    title: 'Relatórios e Exportação',
    description: 'Gere relatórios profissionais com dados completos e exportação para Excel ou PDF.',
    position: 'right',
    route: '/',
    section: 'Relatórios',
  },
  {
    target: 'REPORTS_FILTERS',
    title: 'Filtros e Exportação de Relatórios',
    description: 'Escolha o tipo (Contratos ou Aditivos), filtre por ano, mês ou status. Personalize quais colunas quer visualizar. Exporte para Excel ou PDF com um clique!',
    position: 'bottom',
    route: '/reports',
    section: 'Relatórios',
  },
  
  // ============================================================================
  // SEÇÃO 6: NOTIFICAÇÕES E SUAS OBSERVAÇÕES
  // ============================================================================
  {
    target: '.notification-button',
    title: 'Notificações Automáticas',
    description: 'O sino mostra alertas em tempo real. Badge vermelho indica alertas não lidos. Clique para ver: contratos vencendo, aditivos vencendo e contratos atrasados. Clique em qualquer alerta para ir direto ao item!',
    position: 'bottom',
    route: '/',
    section: 'Notificações',
  },
  
  // ============================================================================
  // SEÇÃO 7: MENU DO USUÁRIO E SEUS ELEMENTOS
  // ============================================================================
  {
    target: '.user-menu-button',
    title: 'Menu do Usuário',
    description: 'Clique no avatar para: editar PERFIL (nome, foto, senha) | IMPORTAR CONTRATOS em massa via Excel (template disponível) ⭐ | acessar este TUTORIAL novamente | fazer LOGOUT do sistema.',
    position: 'bottom',
    route: '/',
    section: 'Menu do Usuário',
  },
  {
    target: 'body',
    title: 'Pronto! Você já sabe tudo! 🎉',
    description: 'Agora você conhece todas as funcionalidades do sistema. Comece criando seu primeiro contrato ou explore as outras áreas. Este tutorial está sempre disponível no menu do usuário!',
    position: 'center',
    route: '/',
    section: 'Conclusão',
  },
];

export default function InteractiveTour({ isOpen, onClose }: InteractiveTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [isReady, setIsReady] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const tooltipRef = useRef<HTMLDivElement>(null);

  const step = tourSteps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === tourSteps.length - 1;
  
  // Bloquear scroll do body quando tour está aberto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.height = '100vh';
    } else {
      document.body.style.overflow = '';
      document.body.style.height = '';
    }
    
    return () => {
      document.body.style.overflow = '';
      document.body.style.height = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    setIsReady(false);

    // Navegar para a rota do passo se necessário
    if (step.route && location.pathname !== step.route) {
      navigate(step.route);
    }

    // Função helper para encontrar elementos por texto
    const findElementByText = (text: string, tagName: string = 'button'): HTMLElement | null => {
      const elements = document.querySelectorAll(tagName);
      for (const el of elements) {
        if (el.textContent?.includes(text)) {
          return el as HTMLElement;
        }
      }
      return null;
    };

    // Função helper para encontrar elementos especiais
    const findSpecialElement = (target: string): HTMLElement | null => {
      switch (target) {
        case 'BUTTON_NOVO_CONTRATO':
          return findElementByText('Novo Contrato', 'button');
        case 'BUTTON_NOVO_DOCUMENTO':
          return findElementByText('Novo Documento', 'button');
        case 'BUTTON_UPLOAD':
          return findElementByText('Upload Documento', 'button') || findElementByText('Upload', 'button');
        case 'TABLE_CONTRATOS':
          // Buscar a primeira tabela visível na página de contratos
          const tables = document.querySelectorAll('table');
          for (const table of tables) {
            if (table.offsetParent !== null) { // Verifica se está visível
              return table as HTMLElement;
            }
          }
          return null;
        case 'DASHBOARD_CARDS':
          // Estratégia 1: Buscar diretamente pelo primeiro card com classe metric-card-total
          const firstMetricCard = document.querySelector('.metric-card-total');
          if (firstMetricCard && firstMetricCard.parentElement) {
            const parent = firstMetricCard.parentElement;
            // Verificar se o parent é um grid que contém múltiplos cards
            if (parent.classList.contains('grid') || 
                parent.className.includes('grid-cols') ||
                parent.querySelectorAll('.metric-card-total, [class*="metric"]').length > 1) {
              return parent as HTMLElement;
            }
          }
          
          // Estratégia 2: Buscar por div com grid que contém "Total de Contratos"
          const allDivs = Array.from(document.querySelectorAll('div'));
          for (const div of allDivs) {
            const classList = Array.from(div.classList);
            const hasGrid = classList.some(cls => cls.includes('grid'));
            const hasGridCols = classList.some(cls => cls.includes('grid-cols'));
            const hasMetricCard = div.querySelector('.metric-card-total') !== null;
            const hasText = div.textContent?.includes('Total de Contratos') && 
                           div.textContent?.includes('Contratos Ativos');
            
            if ((hasGrid || hasGridCols) && (hasMetricCard || hasText) && div.offsetParent !== null) {
              return div as HTMLElement;
            }
          }
          
          // Estratégia 3: Buscar por texto e pegar o container grid mais próximo
          const textElement = Array.from(document.querySelectorAll('*')).find(el => 
            el.textContent?.trim() === 'Total de Contratos'
          );
          if (textElement) {
            let current: HTMLElement | null = textElement.parentElement;
            while (current) {
              if (current.classList.contains('grid') || current.className.includes('grid-cols')) {
                return current;
              }
              current = current.parentElement;
            }
          }
          
          return null;
        case 'REPORTS_FILTERS':
          // Estratégia 1: Buscar pelo select que contém "Todo Período"
          const selectTodoPeriodo = Array.from(document.querySelectorAll('select')).find(select => {
            const options = Array.from(select.options);
            return options.some(opt => opt.textContent?.includes('Todo Período'));
          });
          
          if (selectTodoPeriodo) {
            // Encontrar o container que agrupa todos os filtros
            let container = selectTodoPeriodo.parentElement;
            while (container) {
              // Verificar se este container tem múltiplos selects ou o botão "Mais Filtros"
              const selects = container.querySelectorAll('select');
              const hasMaisFiltros = container.textContent?.includes('Mais Filtros');
              
              if ((selects.length >= 2 || hasMaisFiltros) && container.offsetParent !== null) {
                return container as HTMLElement;
              }
              
              // Se chegou no body, parar
              if (container.tagName === 'BODY') break;
              
              container = container.parentElement;
            }
          }
          
          // Estratégia 2: Buscar por div que contém múltiplos selects e "Mais Filtros"
          const containers = Array.from(document.querySelectorAll('div'));
          for (const container of containers) {
            const selects = container.querySelectorAll('select');
            const hasMaisFiltros = container.textContent?.includes('Mais Filtros');
            const hasTodoPeriodo = container.textContent?.includes('Todo Período');
            const hasTodosStatus = container.textContent?.includes('Todos os Status');
            
            if (selects.length >= 2 && (hasMaisFiltros || hasTodoPeriodo || hasTodosStatus) && 
                container.offsetParent !== null) {
              // Verificar se não é um container muito grande (como o body)
              const rect = container.getBoundingClientRect();
              if (rect.width < window.innerWidth * 0.9) {
                return container as HTMLElement;
              }
            }
          }
          
          // Estratégia 3: Buscar pelo botão "Mais Filtros" e pegar o container pai
          const maisFiltrosButton = findElementByText('Mais Filtros', 'button');
          if (maisFiltrosButton && maisFiltrosButton.parentElement) {
            const parent = maisFiltrosButton.parentElement;
            // Verificar se o parent tem selects
            if (parent.querySelectorAll('select').length >= 1) {
              return parent as HTMLElement;
            }
          }
          
          return null;
        default:
          return null;
      }
    };

    // Aguardar até que o elemento exista (polling inteligente)
    let attempts = 0;
    const maxAttempts = 40; // Aumentado para 4 segundos para dar mais tempo
    
    const checkElement = () => {
      let element: HTMLElement | null = null;
      
      // Verificar se é um elemento especial
      if (step.target.startsWith('BUTTON_') || 
          step.target === 'TABLE_CONTRATOS' || 
          step.target === 'DASHBOARD_CARDS' ||
          step.target === 'REPORTS_FILTERS') {
        element = findSpecialElement(step.target);
      } else {
        element = document.querySelector(step.target) as HTMLElement;
      }
      
      if (element) {
        setTargetElement(element);
        
        // Scroll suave até o elemento apenas se não for body
        if (step.target !== 'body') {
          setTimeout(() => {
            element!.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
          }, 100);
        }
        
        // Aguardar scroll completar antes de posicionar
        setTimeout(() => {
          positionTooltip(element!);
          setIsReady(true);
        }, 600); // Aumentado para dar mais tempo ao scroll
      } else {
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkElement, 100); // Tentar novamente em 100ms
        } else {
          // Elemento não encontrado, usar body como fallback
          console.warn(`Elemento não encontrado para target: ${step.target}`);
          const bodyElement = document.body;
          setTargetElement(bodyElement);
          positionTooltip(bodyElement);
          setIsReady(true);
        }
      }
    };

    checkElement();
  }, [currentStep, isOpen, step, navigate, location.pathname]);

  const positionTooltip = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    // Largura responsiva baseada no tamanho da tela
    const tooltipWidth = Math.min(450, window.innerWidth - 40);
    const tooltipHeight = 320; // Altura estimada
    const padding = 20;
    
    let top = 0;
    let left = 0;
    let finalPosition = step.position;

    // Calcular posição baseada no elemento
    switch (step.position) {
      case 'bottom':
        top = rect.bottom + padding;
        left = rect.left + rect.width / 2;
        // Se não cabe embaixo, colocar em cima
        if (top + tooltipHeight > window.innerHeight - padding) {
          finalPosition = 'top';
          top = Math.max(padding, rect.top - tooltipHeight - padding);
        }
        break;
      case 'top':
        top = rect.top - tooltipHeight - padding;
        left = rect.left + rect.width / 2;
        // Se não cabe em cima, colocar embaixo
        if (top < padding) {
          finalPosition = 'bottom';
          top = Math.min(window.innerHeight - tooltipHeight - padding, rect.bottom + padding);
        }
        break;
      case 'right':
        top = rect.top + rect.height / 2;
        left = rect.right + padding;
        // Se não cabe à direita, colocar embaixo
        if (left + tooltipWidth > window.innerWidth - padding) {
          finalPosition = 'bottom';
          top = Math.min(window.innerHeight - tooltipHeight - padding, rect.bottom + padding);
          left = rect.left + rect.width / 2;
        }
        break;
      case 'left':
        top = rect.top + rect.height / 2;
        left = rect.left - tooltipWidth - padding;
        // Se não cabe à esquerda, colocar embaixo
        if (left < padding) {
          finalPosition = 'bottom';
          top = Math.min(window.innerHeight - tooltipHeight - padding, rect.bottom + padding);
          left = rect.left + rect.width / 2;
        }
        break;
      case 'center':
        top = window.innerHeight / 2;
        left = window.innerWidth / 2;
        break;
    }

    // Ajustar horizontalmente para não sair da tela
    if (finalPosition === 'bottom' || finalPosition === 'top') {
      const halfTooltip = tooltipWidth / 2;
      if (left - halfTooltip < padding) {
        left = halfTooltip + padding;
      } else if (left + halfTooltip > window.innerWidth - padding) {
        left = window.innerWidth - halfTooltip - padding;
      }
    }

    // Ajustar verticalmente para não sair da tela
    if (finalPosition === 'left' || finalPosition === 'right') {
      const halfTooltip = tooltipHeight / 2;
      if (top - halfTooltip < padding) {
        top = halfTooltip + padding;
      } else if (top + halfTooltip > window.innerHeight - padding) {
        top = window.innerHeight - halfTooltip - padding;
      }
    }

    // Para center, garantir que está no centro mesmo
    if (finalPosition === 'center') {
      top = Math.max(padding + tooltipHeight / 2, Math.min(top, window.innerHeight - tooltipHeight / 2 - padding));
      left = Math.max(padding + tooltipWidth / 2, Math.min(left, window.innerWidth - tooltipWidth / 2 - padding));
    }

    setTooltipPosition({ top, left });
  };

  if (!isOpen) return null;

  const handleNext = () => {
    if (isLastStep) {
      navigate('/');
      onClose();
      setCurrentStep(0);
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    navigate('/');
    onClose();
    setCurrentStep(0);
  };

  return createPortal(
    <>
      {/* Overlay escurecido */}
      <div
        className="fixed inset-0 z-[9998]"
        style={{
          background: 'rgba(0, 0, 0, 0.75)',
          pointerEvents: 'none',
        }}
      >
        {/* Spotlight destacando elemento */}
        {targetElement && isReady && step.target !== 'body' && (
          <div
            style={{
              position: 'absolute',
              top: targetElement.getBoundingClientRect().top - 10,
              left: targetElement.getBoundingClientRect().left - 10,
              width: targetElement.offsetWidth + 20,
              height: targetElement.offsetHeight + 20,
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.75), 0 0 40px 8px rgba(59, 130, 246, 0.7)',
              borderRadius: '16px',
              border: '4px solid #3b82f6',
              pointerEvents: 'none',
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            }}
          />
        )}
      </div>

      {/* Tooltip flutuante */}
      {isReady && (
        <div
          ref={tooltipRef}
          className="fixed z-[9999] pointer-events-auto"
          style={{
            top: tooltipPosition.top,
            left: tooltipPosition.left,
            transform:
              step.position === 'bottom' || step.position === 'top'
                ? 'translateX(-50%)'
                : step.position === 'left'
                ? 'translate(-100%, -50%)'
                : step.position === 'right'
                ? 'translate(0, -50%)'
                : 'translate(-50%, -50%)',
            maxWidth: 'calc(100vw - 40px)', // Garantir que não sai da tela
            width: 'min(450px, calc(100vw - 40px))', // Largura responsiva
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl border-2 border-blue-500 w-full max-w-md">
            {/* Header azul */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-500 text-white p-4 rounded-t-xl relative">
              <button
                onClick={handleSkip}
                className="absolute top-3 right-3 text-white hover:text-gray-200 transition-colors p-1 hover:bg-white/20 rounded"
                title="Fechar tour"
              >
                <X className="h-5 w-5" />
              </button>
              
              {step.section && (
                <div className="inline-block bg-white bg-opacity-20 px-3 py-1 rounded-full text-xs font-medium mb-2">
                  {step.section}
                </div>
              )}
              
              <div className="flex items-center space-x-2 mb-1">
                <Sparkles className="h-5 w-5" />
                <h3 className="text-lg font-bold pr-8">{step.title}</h3>
              </div>
              
              <p className="text-blue-100 text-xs">
                Passo {currentStep + 1} de {tourSteps.length}
              </p>
            </div>

            {/* Barra de progresso */}
            <div className="bg-gray-200 h-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-blue-600 h-full transition-all duration-500"
                style={{ width: `${((currentStep + 1) / tourSteps.length) * 100}%` }}
              />
            </div>

            {/* Conteúdo */}
            <div className="p-6">
              <p className="text-gray-700 leading-relaxed mb-5 text-base">
                {step.description}
              </p>

              {/* Indicadores de progresso */}
              <div className="flex justify-center space-x-2 mb-5">
                {tourSteps.map((_, index) => (
                  <div
                    key={index}
                    className={`h-2.5 rounded-full transition-all duration-300 ${
                      index === currentStep
                        ? 'w-10 bg-blue-600'
                        : index < currentStep
                        ? 'w-2.5 bg-green-500'
                        : 'w-2.5 bg-gray-300'
                    }`}
                  />
                ))}
              </div>

              {/* Botões de navegação */}
              <div className="flex items-center justify-between">
                <button
                  onClick={handleSkip}
                  className="text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors"
                >
                  Pular Tour
                </button>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={handlePrevious}
                    disabled={isFirstStep}
                    className={`flex items-center space-x-1.5 px-4 py-2.5 rounded-lg font-medium transition-all ${
                      isFirstStep
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="text-sm">Voltar</span>
                  </button>

                  <button
                    onClick={handleNext}
                    className="flex items-center space-x-1.5 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg font-medium hover:from-blue-700 hover:to-blue-600 transition-all shadow-lg shadow-blue-500/30"
                  >
                    <span className="text-sm">{isLastStep ? 'Concluir' : 'Próximo'}</span>
                    {isLastStep ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Seta apontando para o elemento */}
          {step.target !== 'body' && step.position === 'bottom' && (
            <div
              className="absolute -top-3 left-1/2 transform -translate-x-1/2 w-0 h-0"
              style={{
                borderLeft: '14px solid transparent',
                borderRight: '14px solid transparent',
                borderBottom: '14px solid #3b82f6',
              }}
            />
          )}
          {step.target !== 'body' && step.position === 'top' && (
            <div
              className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 w-0 h-0"
              style={{
                borderLeft: '14px solid transparent',
                borderRight: '14px solid transparent',
                borderTop: '14px solid white',
              }}
            />
          )}
          {step.target !== 'body' && step.position === 'right' && (
            <div
              className="absolute -left-3 top-1/2 transform -translate-y-1/2 w-0 h-0"
              style={{
                borderTop: '14px solid transparent',
                borderBottom: '14px solid transparent',
                borderRight: '14px solid white',
              }}
            />
          )}
          {step.target !== 'body' && step.position === 'left' && (
            <div
              className="absolute -right-3 top-1/2 transform -translate-y-1/2 w-0 h-0"
              style={{
                borderTop: '14px solid transparent',
                borderBottom: '14px solid transparent',
                borderLeft: '14px solid white',
              }}
            />
          )}
        </div>
      )}

      {/* Animação de pulse */}
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.9;
            transform: scale(1.02);
          }
        }
      `}</style>
    </>,
    document.body
  );
}
