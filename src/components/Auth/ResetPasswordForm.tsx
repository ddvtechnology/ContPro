import React, { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, AlertCircle, Lock, Mail, CheckCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { translateSupabaseError } from '../../utils/errorTranslations';

export default function ResetPasswordForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tokenHashRef = useRef<string | null>(null);

  useEffect(() => {
    const checkResetToken = async () => {
      // Verificar se há token de reset na URL - pode vir como token_hash ou token
      const tokenHash = searchParams.get('token_hash') || searchParams.get('token');
      const type = searchParams.get('type');
      
      // Se há token na URL, é um link de recuperação
      if (tokenHash) {
        tokenHashRef.current = tokenHash;
        setIsVerifying(true);
        
        try {
          // Verificar o token - isso autentica o usuário
          const { data, error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'recovery',
          });

          if (verifyError) {
            setError(translateSupabaseError(verifyError.message) || 'Token inválido ou expirado.');
            setIsVerifying(false);
            setStep('request');
            return;
          }

          // Se autenticou, obter email e ir para step de reset
          if (data.session?.user) {
            setEmail(data.session.user.email || '');
            setStep('reset');
          } else {
            setError('Não foi possível verificar o token.');
            setStep('request');
          }

          setIsVerifying(false);
        } catch (err: any) {
          setError(translateSupabaseError(err.message) || 'Erro ao verificar token de recuperação.');
          setIsVerifying(false);
          setStep('request');
        }
      } else if (type === 'recovery') {
        // Se tem type mas não tem token, verificar se há sessão ativa
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setEmail(session.user.email || '');
          setStep('reset');
        }
      }
    };

    checkResetToken();
  }, [searchParams]);

  const sanitizeEmail = (value: string): string => {
    return value.trim().toLowerCase().replace(/[^a-z0-9@._-]/g, '');
  };

  const validateEmail = (value: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value) && value.length <= 255;
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!email) {
      setError('Por favor, insira seu email.');
      return;
    }

    if (!validateEmail(email)) {
      setError('Por favor, insira um email válido.');
      return;
    }

    setIsLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        sanitizeEmail(email),
        {
          redirectTo: `${window.location.origin}/reset-password?type=recovery`,
        }
      );

      if (resetError) {
        setError(translateSupabaseError(resetError.message) || 'Erro ao enviar email de recuperação.');
        return;
      }

      setSuccess(true);
    } catch (err: any) {
      setError(translateSupabaseError(err.message) || 'Erro ao enviar email de recuperação.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
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
          type: 'recovery',
        });

        if (verifyError) {
          setError(translateSupabaseError(verifyError.message) || 'Token expirado ou inválido. Solicite um novo link de recuperação.');
          setIsLoading(false);
          return;
        }

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

      // Atualizar a senha
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        setError(translateSupabaseError(updateError.message) || 'Erro ao atualizar senha.');
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
      setError(translateSupabaseError(err.message) || 'Erro ao atualizar senha.');
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
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Verificando link...</h1>
            <p className="text-gray-600">Aguarde enquanto validamos seu link de recuperação.</p>
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
          <Link 
            to="/login" 
            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para login
          </Link>

          <h1 className="text-2xl sm:text-3xl font-bold text-gray-600 mb-6">
            {step === 'request' ? 'Recuperar Senha' : 'Nova Senha'}
          </h1>

          {success ? (
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5" />
                <div>
                  {step === 'request' ? (
                    <>
                      <p className="font-medium">Email enviado!</p>
                      <p className="text-sm mt-1">
                        Enviamos um link de recuperação para <strong>{email}</strong>. 
                        Verifique sua caixa de entrada.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium">Senha alterada com sucesso!</p>
                      <p className="text-sm mt-1">Redirecionando para o login...</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <form 
              className="space-y-5" 
              onSubmit={step === 'request' ? handleRequestReset : handleResetPassword}
            >
              {step === 'request' ? (
                <>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                      <div className="flex items-center space-x-2">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <span>Email</span>
                      </div>
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(sanitizeEmail(e.target.value))}
                      className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 transition-colors"
                      placeholder="seu.email@exemplo.com"
                      disabled={isLoading}
                    />
                    <p className="mt-2 text-sm text-gray-500">
                      Digite seu email e enviaremos um link para redefinir sua senha.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  {email && (
                    <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg text-sm mb-4">
                      <p>
                        Redefinindo senha para: <strong>{email}</strong>
                      </p>
                    </div>
                  )}
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
                        <span>Confirmar Nova Senha</span>
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
                </>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-start space-x-2">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <span className="flex-1">{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm sm:text-base font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    <span>{step === 'request' ? 'Enviando...' : 'Atualizando...'}</span>
                  </div>
                ) : (
                  <span>{step === 'request' ? 'Enviar Link de Recuperação' : 'Atualizar Senha'}</span>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}