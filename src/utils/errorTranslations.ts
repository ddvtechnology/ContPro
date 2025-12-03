/**
 * Traduz mensagens de erro do Supabase para português
 */
export function translateSupabaseError(errorMessage: string): string {
  if (!errorMessage) return 'Erro desconhecido.';

  const errorLower = errorMessage.toLowerCase();

  // Mapeamento de erros comuns do Supabase
  const translations: { [key: string]: string } = {
    // Erros de senha
    'new password should be different from the old password': 'A nova senha deve ser diferente da senha atual.',
    'password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres.',
    'invalid password': 'Senha inválida.',
    'password is too short': 'A senha é muito curta.',
    'password is too long': 'A senha é muito longa.',
    
    // Erros de autenticação
    'invalid login credentials': 'Email ou senha incorretos.',
    'email not confirmed': 'Email não confirmado. Verifique sua caixa de entrada.',
    'user not found': 'Usuário não encontrado.',
    'email already registered': 'Este email já está cadastrado.',
    'invalid email': 'Email inválido.',
    'email rate limit exceeded': 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
    
    // Erros de token
    'token has expired': 'Token expirado. Solicite um novo link.',
    'invalid token': 'Token inválido ou expirado.',
    'token is invalid or has expired': 'Token inválido ou expirado.',
    'invalid or expired token': 'Token inválido ou expirado.',
    'expired token': 'Token expirado.',
    
    // Erros de sessão
    'auth session missing': 'Sessão não encontrada. Faça login novamente.',
    'session not found': 'Sessão não encontrada.',
    'session expired': 'Sessão expirada. Faça login novamente.',
    
    // Erros de convite
    'invite not found': 'Convite não encontrado.',
    'invite has expired': 'Convite expirado. Solicite um novo convite.',
    
    // Erros de recuperação de senha
    'password reset required': 'É necessário redefinir a senha.',
    'password reset link expired': 'Link de recuperação expirado. Solicite um novo.',
    
    // Erros de email
    'email rate limit exceeded': 'Limite de emails excedido. Aguarde alguns minutos.',
    'error sending email': 'Erro ao enviar email. Tente novamente mais tarde.',
    'email already exists': 'Este email já está cadastrado.',
    
    // Erros genéricos
    'network request failed': 'Erro de conexão. Verifique sua internet.',
    'request failed': 'Falha na requisição. Tente novamente.',
    'internal server error': 'Erro interno do servidor. Tente novamente mais tarde.',
    'service unavailable': 'Serviço temporariamente indisponível. Tente novamente mais tarde.',
  };

  // Procurar por correspondência exata ou parcial
  for (const [english, portuguese] of Object.entries(translations)) {
    if (errorLower.includes(english)) {
      return portuguese;
    }
  }

  // Se não encontrar tradução, retornar a mensagem original
  return errorMessage;
}
