import React, { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';

export default function ConfirmEmail() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const confirmEmail = async () => {
      const token = searchParams.get('token');
      const type = searchParams.get('type');

      if (!token) {
        setStatus('error');
        setMessage('Token de confirmação não encontrado.');
        return;
      }

      try {
        if (type === 'signup') {
          // Confirmar email de cadastro
          const { error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: 'signup',
          });

          if (error) {
            setStatus('error');
            setMessage(error.message || 'Erro ao confirmar email.');
            return;
          }

          setStatus('success');
          setMessage('Email confirmado com sucesso! Redirecionando para o login...');
          setTimeout(() => {
            navigate('/login');
          }, 3000);
        } else {
          setStatus('error');
          setMessage('Tipo de confirmação inválido.');
        }
      } catch (err: any) {
        setStatus('error');
        setMessage(err.message || 'Erro ao confirmar email.');
      }
    };

    confirmEmail();
  }, [searchParams, navigate]);

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
          {status === 'loading' && (
            <>
              <Loader2 className="h-16 w-16 text-blue-600 mx-auto mb-4 animate-spin" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Confirmando email...</h1>
              <p className="text-gray-600">Aguarde enquanto confirmamos sua conta.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Email Confirmado!</h1>
              <p className="text-gray-600 mb-6">{message}</p>
              <Link
                to="/login"
                className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Ir para Login
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <AlertCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Erro na Confirmação</h1>
              <p className="text-gray-600 mb-6">{message}</p>
              <div className="space-y-3">
                <Link
                  to="/login"
                  className="block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Ir para Login
                </Link>
                <Link
                  to="/signup"
                  className="block px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Criar Nova Conta
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}