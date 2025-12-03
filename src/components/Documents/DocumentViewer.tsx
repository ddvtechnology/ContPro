import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, ExternalLink, FileText, Image, File, AlertCircle, Eye } from 'lucide-react';
import { formatDateForDisplay } from '../../utils/dateUtils';

interface Document {
  id: string;
  name: string;
  type: string;
  category: string;
  size: number;
  url: string;
  upload_date: string;
}

interface DocumentViewerProps {
  isOpen: boolean;
  onClose: () => void;
  document: Document | null;
}

export default function DocumentViewer({ isOpen, onClose, document }: DocumentViewerProps) {
  const [imageError, setImageError] = useState(false);
  const [pdfError, setPdfError] = useState(false);

  if (!isOpen || !document) return null;

  if (typeof window === 'undefined' || !window.document?.body) return null;

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pdf':
        return <FileText className="h-8 w-8 text-red-500" />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return <Image className="h-8 w-8 text-blue-500" />;
      default:
        return <File className="h-8 w-8 text-gray-500" />;
    }
  };

  const canPreview = (type: string) => {
    const previewableTypes = ['pdf', 'jpg', 'jpeg', 'png', 'gif'];
    return previewableTypes.includes(type.toLowerCase());
  };

  const handleDownload = async () => {
    try {
      // Para arquivos do Supabase Storage, usar a URL diretamente
      if (document.url.includes('supabase')) {
        // Criar um link temporário para download
        const response = await fetch(document.url);
        const blob = await response.blob();
        
        const url = window.URL.createObjectURL(blob);
        const link = window.document.createElement('a');
        link.href = url;
        link.download = document.name;
        window.document.body.appendChild(link);
        link.click();
        window.document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        // Para outras URLs, tentar download direto
        const link = window.document.createElement('a');
        link.href = document.url;
        link.download = document.name;
        link.target = '_blank';
        window.document.body.appendChild(link);
        link.click();
        window.document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Erro ao baixar arquivo:', error);
      // Fallback: abrir em nova aba
      window.open(document.url, '_blank');
    }
  };

  const renderPreview = () => {
    const type = document.type.toLowerCase();
    
    if (['jpg', 'jpeg', 'png', 'gif'].includes(type)) {
      return (
        <div className="flex items-center justify-center bg-gray-100 rounded-lg p-8 min-h-96">
          {!imageError ? (
            <img 
              src={document.url}
              alt={document.name}
              className="max-w-full max-h-96 object-contain rounded-lg shadow-lg"
              onError={() => setImageError(true)}
              onLoad={() => setImageError(false)}
            />
          ) : (
            <div className="text-center">
              <Image className="mx-auto h-16 w-16 text-gray-400 mb-4" />
              <p className="text-gray-500 mb-4">Não foi possível carregar a imagem</p>
              <p className="text-sm text-gray-400 mb-4">
                Arquivo: {document.name}
              </p>
              <button 
                onClick={handleDownload}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 mx-auto"
              >
                <Download className="h-4 w-4" />
                <span>Baixar Arquivo</span>
              </button>
            </div>
          )}
        </div>
      );
    }
    
    if (type === 'pdf') {
      return (
        <div className="bg-gray-100 rounded-lg p-8">
          {!pdfError ? (
            <div>
              <iframe
                src={document.url}
                className="w-full h-96 rounded-lg border bg-white"
                title={document.name}
                onError={() => setPdfError(true)}
              />
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-600 mb-4">
                  Visualização do PDF. Se não carregar corretamente, use os botões abaixo.
                </p>
                <div className="flex justify-center space-x-4">
                  <button 
                    onClick={() => window.open(document.url, '_blank')}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>Abrir em Nova Aba</span>
                  </button>
                  <button 
                    onClick={handleDownload}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                  >
                    <Download className="h-4 w-4" />
                    <span>Baixar PDF</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <FileText className="mx-auto h-16 w-16 text-red-400 mb-4" />
              <p className="text-gray-500 mb-4">Não foi possível carregar o PDF</p>
              <p className="text-sm text-gray-400 mb-4">
                Arquivo: {document.name}
              </p>
              <div className="flex justify-center space-x-4">
                <button 
                  onClick={() => window.open(document.url, '_blank')}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>Tentar Abrir</span>
                </button>
                <button 
                  onClick={handleDownload}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                >
                  <Download className="h-4 w-4" />
                  <span>Baixar</span>
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }
    
    // Para outros tipos de arquivo
    return (
      <div className="bg-gray-100 rounded-lg p-8 text-center min-h-96 flex flex-col justify-center">
        {getFileIcon(document.type)}
        <h3 className="mt-4 text-lg font-medium text-gray-900">{document.name}</h3>
        <p className="text-sm text-gray-500 mt-2">
          Tipo: {document.type.toUpperCase()} • Tamanho: {formatFileSize(document.size)}
        </p>
        <p className="text-sm text-gray-600 mt-4 mb-6">
          Este tipo de arquivo não pode ser visualizado no navegador.
        </p>
      </div>
    );
  };

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto relative">
        <div className="sticky top-0 bg-white border-b border-gray-200 z-10 flex items-center justify-between p-6">
          <div className="flex items-center space-x-3">
            {getFileIcon(document.type)}
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{document.name}</h2>
              <p className="text-sm text-gray-500">
                {document.category} • {formatFileSize(document.size)} • {document.type.toUpperCase()}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownload}
              className="text-green-600 hover:text-green-800 p-2 hover:bg-green-50 rounded-lg transition-colors"
              title="Download"
            >
              <Download className="h-5 w-5" />
            </button>
            <button
              onClick={() => window.open(document.url, '_blank')}
              className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-50 rounded-lg transition-colors"
              title="Abrir em nova aba"
            >
              <ExternalLink className="h-5 w-5" />
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {renderPreview()}
        </div>

        <div className="flex justify-between items-center p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600 space-y-1">
            <p><strong>Categoria:</strong> {document.category}</p>
            <p><strong>Tipo:</strong> {document.type.toUpperCase()}</p>
            <p><strong>Tamanho:</strong> {formatFileSize(document.size)}</p>
            <p><strong>Upload:</strong> {formatDateForDisplay(document.upload_date)}</p>
          </div>
        </div>
      </div>
    </div>,
    window.document.body
  );
}