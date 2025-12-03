import React, { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, AlertCircle, Lock, CheckCircle, Loader2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';
import { translateSupabaseError } from '../../utils/errorTranslations';

export default function FirstAccessForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [email, setEmail] = useState('');
  const [tokenValid, setTokenValid] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tokenHashRef = useRef<string | null>(null);
  const typeRef = useRef<string | null>(null);

  useEffect(() => {
    const verifyToken = async () => {
      // Extrair token da URL - pode vir como token_hash ou token
      const tokenHash = searchParams.get('token_hash') || searchParams.get('token');
      const type = searchParams.get('type') || 'invite';
      
      // Guardar token para uso posterior
      tokenHashRef.current = tokenHash;
      typeRef.current = type;
      
      // Se não tem token na URL, verificar se há sessão ativa
      if (!tokenHash) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // Usuário foi autenticado pelo link do email
          setEmail(session.user.email || '');
          setTokenValid(true);
          setIsVerifying(false);
          return;
        } else {
          setError('Token de convite não encontrado. Verifique o link do email.');
          setIsVerifying(false);
          return;
        }
      }

      try {
        // Verificar o token - isso cria uma sessão
        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type === 'invite' ? 'invite' : 'signup',
        });

        if (verifyError) {
          setError(translateSupabaseError(verifyError.message) || 'Token inválido ou expirado.');
          setIsVerifying(false);
          return;
        }

        // Verificar se a sessão foi criada
        if (data.session) {
          setEmail(data.session.user.email || '');
          setTokenValid(true);
        } else if (data.user?.email) {
          setEmail(data.user.email);
          setTokenValid(true);
        } else {
          setError('Não foi possível obter informações do usuário.');
          setIsVerifying(false);
          return;
        }

        setIsVerifying(false);
      } catch (err: any) {
        setError(translateSupabaseError(err.message) || 'Erro ao verificar convite.');
        setIsVerifying(false);
      }
    };

    verifyToken();
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!password || !confirmPassword) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setIsLoading(true);

    try {
      // Verificar se há sessão ativa
      let { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      // Se não há sessão, tentar verificar o token novamente
      if (!session && tokenHashRef.current) {
        const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHashRef.current,
          type: (typeRef.current === 'invite' ? 'invite' : 'signup') as any,
        });

        if (verifyError) {
          setError(translateSupabaseError(verifyError.message) || 'Token expirado ou inválido. Solicite um novo convite.');
          setIsLoading(false);
          return;
        }

        // Atualizar sessão após verificar novamente
        if (verifyData.session) {
          session = verifyData.session;
        } else {
          setError('Não foi possível criar sessão. Tente novamente.');
          setIsLoading(false);
          return;
        }
      }

      if (!session) {
        setError('Sessão não encontrada. Use o link do email novamente.');
        setIsLoading(false);
        return;
      }

      // Atualizar a senha (precisa estar autenticado)
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        setError(translateSupabaseError(updateError.message) || 'Erro ao definir senha.');
        setIsLoading(false);
        return;
      }

      setSuccess(true);
      // Fazer logout para que o usuário faça login com a nova senha
      await supabase.auth.signOut();
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err: any) {
      setError(translateSupabaseError(err.message) || 'Erro ao definir senha.');
      setIsLoading(false);
    }
  };

  if (isVerifying) {
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
        <div className="absolute inset-0 bg-white" style={{ opacity: 0.5 }}></div>
        <div className="max-w-md w-full relative z-10">
          <div className="bg-white shadow-2xl rounded-2xl border border-gray-100 overflow-hidden p-8 sm:p-10 text-center">
            <Loader2 className="h-16 w-16 text-blue-600 mx-auto mb-4 animate-spin" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Verificando convite...</h1>
            <p className="text-gray-600">Aguarde enquanto validamos seu convite.</p>
          </div>
        </div>
      </div>
    );
  }

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
      <div className="absolute inset-0 bg-white" style={{ opacity: 0.5 }}></div>
      <div className="max-w-md w-full relative z-10">
        <div className="bg-white shadow-2xl rounded-2xl border border-gray-100 overflow-hidden p-8 sm:p-10">
          {error && !success && !tokenValid ? (
            <div className="mb-6">
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-5 w-5" />
                  <div>
                    <p className="font-medium">Erro ao processar convite</p>
                    <p className="text-sm mt-1">{error}</p>
                  </div>
                </div>
              </div>
              <Link
                to="/login"
                className="mt-4 block text-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Ir para Login
              </Link>
            </div>
          ) : success ? (
            <div className="text-center">
              <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Senha Definida!</h1>
              <p className="text-gray-600 mb-6">
                Sua conta foi configurada com sucesso. Redirecionando para o login...
              </p>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <div className="flex items-center justify-center mb-4">
                  <img src="/ContPro.svg" alt="ContPro Logo" className="h-24 w-auto" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-600 mb-2">
                  Primeiro Acesso
                </h1>
                {email && (
                  <p className="text-sm text-gray-500">
                    Configurando conta para: <strong>{email}</strong>
                  </p>
                )}
                <p className="text-sm text-gray-600 mt-2">
                  Defina uma senha para acessar o sistema
                </p>
              </div>

              <form className="space-y-5" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    <div className="flex items-center space-x-2">
                      <Lock className="h-4 w-4 text-gray-400" />
                      <span>Nova Senha</span>
                    </div>
                  </label>
                  <div className="mt-1 relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 transition-colors"
                      placeholder="••••••••"
                      disabled={isLoading}
                      minLength={6}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isLoading}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5 text-gray-400" />
                      ) : (
                        <Eye className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Mínimo de 6 caracteres
                  </p>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                    <div className="flex items-center space-x-2">
                      <Lock className="h-4 w-4 text-gray-400" />
                      <span>Confirmar Senha</span>
                    </div>
                  </label>
                  <div className="mt-1 relative">
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="block w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 transition-colors"
                      placeholder="••••••••"
                      disabled={isLoading}
                      minLength={6}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      disabled={isLoading}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-5 w-5 text-gray-400" />
                      ) : (
                        <Eye className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-start space-x-2">
                    <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <span className="flex-1">{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !tokenValid}
                  className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm sm:text-base font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      <span>Configurando...</span>
                    </div>
                  ) : (
                    <span>Definir Senha e Acessar</span>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}