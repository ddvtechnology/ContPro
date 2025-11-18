import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { User as UserIcon, Save, LogOut, Image } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');
    try {
      const { error } = await supabase
        .from('users')
        .update({ name, avatar })
        .eq('id', user?.id);
      if (error) throw error;
      setSuccess('Perfil atualizado com sucesso!');
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar perfil');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Upload do avatar para o bucket (opcional: pode usar um bucket avatars)
    const fileExt = file.name.split('.').pop();
    const fileName = `${user?.id}_avatar.${fileExt}`;
    const { data, error } = await supabase.storage.from('documents').upload(`avatars/${fileName}`, file, { upsert: true });
    if (error) {
      setError('Erro ao fazer upload do avatar');
      return;
    }
    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(`avatars/${fileName}`);
    setAvatar(urlData.publicUrl);
  };

  if (!user) return null;

  return (
    <div className="max-w-xl mx-auto mt-10 bg-white rounded-xl shadow-lg p-8">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <UserIcon className="h-6 w-6 text-blue-600" /> Meu Perfil
      </h1>
      <form onSubmit={handleSave} className="space-y-6">
        <div className="flex items-center space-x-4">
          <div className="h-20 w-20 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden">
            {avatar ? (
              <img src={avatar} alt="Avatar" className="h-20 w-20 object-cover" />
            ) : (
              <UserIcon className="h-10 w-10 text-blue-600" />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Alterar Avatar</label>
            <input type="file" accept="image/*" onChange={handleAvatarChange} className="text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={user.email}
            disabled
            className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Perfil</label>
          <input
            type="text"
            value={user.role}
            disabled
            className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 capitalize"
          />
        </div>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        {success && <div className="text-green-600 text-sm">{success}</div>}
        <div className="flex items-center gap-4 mt-4">
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50"
            disabled={isLoading}
          >
            <Save className="h-4 w-4" /> Salvar
          </button>
          <button
            type="button"
            onClick={() => navigate('/reset-password')}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200"
          >
            Trocar Senha
          </button>
          <button
            type="button"
            onClick={logout}
            className="bg-red-100 text-red-600 px-4 py-2 rounded-lg hover:bg-red-200 ml-auto"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </form>
    </div>
  );
} 