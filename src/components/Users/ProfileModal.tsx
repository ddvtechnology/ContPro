import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { User as UserIcon, Save, LogOut, X, Lock, Image, Mail, User, Camera } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const navigate = useNavigate();

  // Atualizar estados quando o modal for aberto ou o usuário mudar
  useEffect(() => {
    if (isOpen && user) {
      setName(user.name || '');
      setAvatar(user.avatar || '');
    }
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');
    try {
      // Atualizar metadata do usuário no Supabase Auth
      // O display_name será salvo em user_metadata.display_name
      const { error } = await supabase.auth.updateUser({
        data: { 
          name, 
          avatar,
          display_name: name // Salvar no display_name dentro de user_metadata
        }
      });
      if (error) throw error;
      
      setSuccess('Perfil atualizado com sucesso!');
      // Buscar usuário atualizado do Supabase Auth
      const { data: refreshedUser, error: refreshError } = await supabase.auth.getUser();
      if (!refreshError && refreshedUser?.user) {
        updateUser({
          name: refreshedUser.user.user_metadata?.display_name || refreshedUser.user.user_metadata?.name || name,
          avatar: refreshedUser.user.user_metadata?.avatar || avatar,
        });
      } else {
        updateUser({ name, avatar });
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar perfil');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      setError('Por favor, selecione um arquivo de imagem válido.');
      return;
    }
    
    // Validar tamanho do arquivo (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('A imagem deve ter no máximo 5MB.');
      return;
    }
    
    setIsLoading(true);
    setError('');
    setSuccess('');
    
    try {
      // Usar um nome de arquivo fixo baseado no ID do usuário para substituir o anterior
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${user.id}_avatar.${fileExt}`;
      const filePath = `avatars/${fileName}`;
      
      // Fazer upload do arquivo (upsert substitui se já existir)
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, { 
          upsert: true,
          contentType: file.type
        });
      
      if (uploadError) {
        throw new Error('Erro ao fazer upload do avatar: ' + uploadError.message);
      }
      
      // Obter URL pública - adicionar timestamp para forçar reload
      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);
      const timestamp = Date.now();
      const avatarUrl = `${urlData.publicUrl}?v=${timestamp}`;
      
      // Aguardar um pouco para garantir que o arquivo está disponível
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Atualizar no Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        data: { 
          avatar: urlData.publicUrl, // Salvar sem timestamp no metadata
          display_name: name || user.name
        }
      });
      
      if (updateError) {
        throw new Error('Erro ao atualizar avatar: ' + updateError.message);
      }
      
      // Atualizar estado local imediatamente com a URL com timestamp
      setAvatar(avatarUrl);
      
      // Buscar usuário atualizado do Supabase para sincronizar
      const { data: refreshedUser } = await supabase.auth.getUser();
      if (refreshedUser?.user) {
        const metadataAvatar = refreshedUser.user.user_metadata?.avatar;
        // Se o metadata tiver a URL, usar com timestamp para forçar reload
        const finalAvatarUrl = metadataAvatar ? `${metadataAvatar}?v=${timestamp}` : avatarUrl;
        setAvatar(finalAvatarUrl);
        updateUser({ 
          name: refreshedUser.user.user_metadata?.display_name || refreshedUser.user.user_metadata?.name || name,
          avatar: finalAvatarUrl
        });
      } else {
        updateUser({ avatar: avatarUrl });
      }
      
      setSuccess('Foto atualizada com sucesso!');
      
      // Limpar o input para permitir selecionar o mesmo arquivo novamente
      e.target.value = '';
    } catch (err: any) {
      console.error('Erro ao atualizar avatar:', err);
      setError(err.message || 'Erro ao atualizar foto. Por favor, tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!avatar) return;
    
    setIsLoading(true);
    setError('');
    try {
      // Remover avatar do Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar: null }
      });
      
      if (updateError) {
        throw new Error('Erro ao remover avatar: ' + updateError.message);
      }
      
      setAvatar('');
      updateUser({ avatar: undefined });
      setSuccess('Foto removida com sucesso!');
    } catch (err: any) {
      setError(err.message || 'Erro ao remover foto');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    if (!newPassword || newPassword.length < 6) {
      setPasswordError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('As senhas não coincidem.');
      return;
    }
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordSuccess('Senha alterada com sucesso!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordError(err.message || 'Erro ao alterar senha');
    }
  };

  if (typeof window === 'undefined' || !window.document?.body) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-lg sm:rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
          <div className="flex items-center justify-between p-4 sm:p-6">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <UserIcon className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Meu Perfil</h2>
                <p className="text-xs sm:text-sm text-gray-500">Gerencie suas informações pessoais</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          {/* Seção: Foto de Perfil */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
              <div className="relative">
                <div className="h-24 w-24 sm:h-32 sm:w-32 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden border-4 border-white shadow-lg">
                  {avatar ? (
                    <img 
                      key={avatar} 
                      src={avatar} 
                      alt="Avatar" 
                      className="h-24 w-24 sm:h-32 sm:w-32 object-cover"
                      onError={(e) => {
                        // Se a imagem falhar ao carregar, remover o avatar
                        console.error('Erro ao carregar avatar:', avatar);
                        setAvatar('');
                        updateUser({ avatar: undefined });
                      }}
                    />
                  ) : (
                    <UserIcon className="h-12 w-12 sm:h-16 sm:w-16 text-blue-600" />
                  )}
                </div>
                <label className={`absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full cursor-pointer hover:bg-blue-700 transition-colors shadow-lg ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <Camera className="h-4 w-4" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                    disabled={isLoading}
                  />
                </label>
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-1">{name || user.name}</h3>
                <p className="text-sm text-gray-600 mb-3">{user.email}</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <label className="inline-flex items-center justify-center px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg cursor-pointer transition-colors text-sm">
                    <Image className="h-4 w-4 mr-2" />
                    Alterar Foto
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                      disabled={isLoading}
                    />
                  </label>
                  {avatar && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      disabled={isLoading}
                      className="inline-flex items-center justify-center px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Remover Foto
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Seção: Informações Pessoais */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
            <div className="flex items-center space-x-2 mb-4">
              <div className="bg-blue-100 p-2 rounded-lg">
                <User className="h-4 w-4 text-blue-600" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">Informações Pessoais</h3>
            </div>
            
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
                  <User className="h-4 w-4 text-gray-400" />
                  <span>Nome Completo</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                  placeholder="Seu nome completo"
                  required
                />
              </div>

              <div>
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span>Email</span>
                </label>
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="w-full px-3 sm:px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 text-sm sm:text-base cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">O email não pode ser alterado</p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
              {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                  {success}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 sm:px-6 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm sm:text-base font-medium"
                  disabled={isLoading}
                >
                  <Save className="h-4 w-4" />
                  {isLoading ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>

          {/* Seção: Segurança */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
            <div className="flex items-center space-x-2 mb-4">
              <div className="bg-amber-100 p-2 rounded-lg">
                <Lock className="h-4 w-4 text-amber-600" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">Segurança</h3>
            </div>

            {!showPasswordFields ? (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-sm text-gray-600 mb-4">Mantenha sua conta segura alterando sua senha regularmente.</p>
                <button
                  type="button"
                  onClick={() => { setShowPasswordFields(true); setPasswordError(''); setPasswordSuccess(''); }}
                  className="bg-amber-600 text-white px-4 sm:px-6 py-2 rounded-lg flex items-center gap-2 hover:bg-amber-700 transition-colors text-sm sm:text-base font-medium"
                >
                  <Lock className="h-4 w-4" />
                  Trocar Senha
                </button>
              </div>
            ) : (
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
                    <Lock className="h-4 w-4 text-gray-400" />
                    <span>Nova Senha</span>
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm sm:text-base"
                    placeholder="Mínimo 6 caracteres"
                    minLength={6}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">A senha deve ter pelo menos 6 caracteres</p>
                </div>

                <div>
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
                    <Lock className="h-4 w-4 text-gray-400" />
                    <span>Confirmar Nova Senha</span>
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm sm:text-base"
                    placeholder="Digite a senha novamente"
                    minLength={6}
                    required
                  />
                </div>

                {passwordError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {passwordError}
                  </div>
                )}
                {passwordSuccess && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                    {passwordSuccess}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    type="submit"
                    className="bg-amber-600 text-white px-4 sm:px-6 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-amber-700 transition-colors text-sm sm:text-base font-medium"
                  >
                    <Save className="h-4 w-4" />
                    Salvar Nova Senha
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowPasswordFields(false); setNewPassword(''); setConfirmPassword(''); setPasswordError(''); setPasswordSuccess(''); }}
                    className="bg-gray-100 text-gray-700 px-4 sm:px-6 py-2 rounded-lg hover:bg-gray-200 transition-colors text-sm sm:text-base font-medium"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-4 sm:p-6">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 sm:px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors text-sm sm:text-base font-medium"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>,
    window.document.body
  );
} 