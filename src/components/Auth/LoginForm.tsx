import React, { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, AlertCircle, Lock, Mail, Shield } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Link, useNavigate } from 'react-router-dom';
import { translateSupabaseError } from '../../utils/errorTranslations';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockUntil, setLockUntil] = useState<Date | null>(null);
  const { user, login, isLoading } = useAuth();
  const navigate = useNavigate();
  const emailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Não redirecionar se estiver vindo de first-access ou reset-password
    const searchParams = new URLSearchParams(window.location.search);
    const fromFirstAccess = searchParams.get('from') === 'first-access';
    
    if (user && !fromFirstAccess) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    // Verificar se ainda está bloqueado
    if (lockUntil) {
      const now = new Date();
      if (now < lockUntil) {
        setIsLocked(true);
        const timeLeft = lockUntil.getTime() - now.getTime();
        const timer = setTimeout(() => {
          setIsLocked(false);
          setLockUntil(null);
          setAttempts(0);
        }, timeLeft);
        return () => clearTimeout(timer);
      } else {
        setIsLocked(false);
        setLockUntil(null);
        setAttempts(0);
      }
    }
  }, [lockUntil]);

  // Sanitizar email
  const sanitizeEmail = (value: string): string => {
    return value.trim().toLowerCase().replace(/[^a-z0-9@._-]/g, '');
  };

  // Validar email
  const validateEmail = (value: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value) && value.length <= 255;
  };

  // Validar senha
  const validatePassword = (value: string): boolean => {
    return value.length >= 6 && value.length <= 128;
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sanitized = sanitizeEmail(e.target.value);
    setEmail(sanitized);
    setError('');
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Verificar se está bloqueado
    if (isLocked && lockUntil && new Date() < lockUntil) {
      const minutesLeft = Math.ceil((lockUntil.getTime() - Date.now()) / 60000);
      setError(`Muitas tentativas. Tente novamente em ${minutesLeft} minuto(s).`);
      return;
    }

    // Validações
    if (!email || !password) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    if (!validateEmail(email)) {
      setError('Por favor, insira um email válido.');
      emailInputRef.current?.focus();
      return;
    }

    if (!validatePassword(password)) {
      setError('A senha deve ter entre 6 e 128 caracteres.');
      return;
    }

    try {
      const success = await login(email, password);
      if (!success) {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);

        // Bloquear após 5 tentativas
        if (newAttempts >= 5) {
          const lockTime = new Date();
          lockTime.setMinutes(lockTime.getMinutes() + 15);
          setLockUntil(lockTime);
          setIsLocked(true);
          setError('Muitas tentativas falhadas. Acesso bloqueado por 15 minutos.');
        } else {
          setError('Credenciais inválidas. Verifique seus dados e tente novamente.');
        }
      } else {
        // Resetar tentativas em caso de sucesso
        setAttempts(0);
      }
    } catch (error: any) {
      setError(translateSupabaseError(error.message) || 'Erro ao conectar. Verifique sua conexão e tente novamente.');
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative"
      style={{
        backgroundImage: 'url(/fundo.svg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        position: 'relative'
      }}
    >
      {/* Camada de opacidade sobre o fundo */}
      <div 
        className="absolute inset-0 bg-white"
        style={{ opacity: 0.5 }}
      ></div>
      <div className="max-w-4xl w-full relative z-10">
        <div className="bg-white shadow-2xl rounded-2xl border border-gray-100 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
            {/* Lado Esquerdo - Logo e Informações */}
            <div className="bg-white p-8 sm:p-12 flex flex-col justify-center items-center relative overflow-hidden border-r border-gray-100">
              {/* Efeito sutil de fundo */}
              <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 via-transparent to-gray-50/30"></div>
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/20 rounded-full blur-3xl -mr-32 -mt-32"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-50/20 rounded-full blur-3xl -ml-32 -mb-32"></div>
              
              <div className="relative z-10 flex flex-col items-center w-full">
                <div className="flex items-center justify-center mb-8 w-full">
                  <img src="/ContPro.svg" alt="ContPro Logo" className="h-40 sm:h-52 md:h-64 lg:h-72 xl:h-80 w-auto max-w-full object-contain" />
                </div>
              </div>
            </div>

            {/* Lado Direito - Formulário */}
            <div className="p-8 sm:p-10 lg:p-12">
              {/* Título Login */}
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-600 mb-6">Login</h1>

              {/* Aviso de segurança */}
              {attempts > 0 && attempts < 5 && (
                <div className="mb-6 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>Tentativa {attempts} de 5. Após 5 tentativas, o acesso será bloqueado por 15 minutos.</span>
                </div>
              )}

              <form className="space-y-5" onSubmit={handleSubmit}>
                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span>Email</span>
                    </div>
                  </label>
                  <input
                    ref={emailInputRef}
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={handleEmailChange}
                    className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors text-sm sm:text-base"
                    placeholder="seu.email@exemplo.com"
                    disabled={isLoading || isLocked}
                    maxLength={255}
                  />
                </div>

                {/* Senha */}
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    <div className="flex items-center space-x-2">
                      <Lock className="h-4 w-4 text-gray-400" />
                      <span>Senha</span>
                    </div>
                  </label>
                  <div className="mt-1 relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={handlePasswordChange}
                      className="block w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors text-sm sm:text-base"
                      placeholder="••••••••"
                      disabled={isLoading || isLocked}
                      minLength={6}
                      maxLength={128}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center hover:text-gray-600 transition-colors disabled:cursor-not-allowed"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isLoading || isLocked}
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5 text-gray-400" />
                      ) : (
                        <Eye className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Mensagem de erro */}
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-start space-x-2">
                    <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <span className="flex-1">{error}</span>
                  </div>
                )}

                {/* Botão de login */}
                <button
                  type="submit"
                  disabled={isLoading || isLocked}
                  className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm sm:text-base font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      <span>Conectando...</span>
                    </div>
                  ) : isLocked ? (
                    <div className="flex items-center space-x-2">
                      <Shield className="h-5 w-5" />
                      <span>
                        Acesso Bloqueado ({lockUntil && new Date() < lockUntil 
                          ? Math.ceil((lockUntil.getTime() - Date.now()) / 60000) 
                          : 0} min)
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <Lock className="h-5 w-5" />
                      <span>Entrar</span>
                    </div>
                  )}
                </button>
              </form>

              {/* Link de recuperação de senha */}
              <div className="mt-6 text-center">
                <Link 
                  to="/reset-password" 
                  className="text-sm text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                >
                  Esqueci minha senha
                </Link>
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <footer className="mt-8 text-center">
          <p className="text-xs sm:text-sm font-medium" style={{ color: '#13294b' }}>
            © 2025 DDV TECHNOLOGY - Todos os direitos reservados
          </p>
          <p className="text-xs sm:text-sm mt-1" style={{ color: '#13294b' }}>
            Versão 1.0.0
          </p>
        </footer>
      </div>
    </div>
  );
}