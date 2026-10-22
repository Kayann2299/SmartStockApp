import { useEffect, useState } from 'react';

/**
 * Campo de upload de imagem com pré-visualização, usado para fotos de produtos e fornecedores.
 * Envia o arquivo selecionado para o backend e comunica a URL resultante via `onImageSelected`.
 *
 * @param {Object} props Propriedades do componente.
 * @param {(result: {url: string, filename: string}|null) => void} props.onImageSelected Callback chamado com os dados da imagem enviada (ou `null` ao remover).
 * @param {string|null} [props.currentImage=null] URL da imagem atual, exibida como pré-visualização inicial.
 * @param {string} [props.label='Upload image'] Rótulo exibido acima do campo.
 * @param {'products'|'suppliers'} [props.folder='products'] Pasta/destino de upload no backend.
 * @returns {JSX.Element} Campo de upload com pré-visualização, estado de carregamento e erros.
 */
export default function ImageUpload({ 
  onImageSelected, 
  currentImage = null, 
  label = 'Upload image',
  folder = 'products'
}) {
  const [preview, setPreview] = useState(currentImage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setPreview(currentImage || null);
  }, [currentImage]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setPreview(event.target.result);
    };
    reader.readAsDataURL(file);

    // Call parent callback
    setLoading(true);
    setError('');
    try {
      await onImageSelected(file, folder);
    } catch (err) {
      setError(err?.response?.data?.message || 'Error uploading image');
      setPreview(currentImage); // Revert preview on error
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="image-upload-wrapper">
      <div className="image-upload-container">
        {preview ? (
          <div className="image-preview">
            <img src={preview} alt="Preview" />
            <button
              type="button"
              className="btn-secondary image-preview-remove"
              onClick={() => {
                setPreview(null);
                onImageSelected(null, folder);
              }}
              disabled={loading}
            >
              ✕ Remove
            </button>
          </div>
        ) : (
          <div className="image-upload-placeholder">
            <div className="image-upload-icon">📸</div>
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem' }}>No image selected</p>
          </div>
        )}
      </div>

      <div className="image-upload-input-wrapper">
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={loading}
          id={`image-upload-${folder}`}
          style={{ display: 'none' }}
        />
        <label htmlFor={`image-upload-${folder}`} className="btn-secondary" style={{ cursor: 'pointer', textAlign: 'center' }}>
          {loading ? '⟳ Uploading...' : `📁 ${label}`}
        </label>
      </div>

      {error && (
        <div style={{
          padding: '0.75rem',
          borderRadius: '6px',
          background: 'rgba(185, 28, 28, 0.12)',
          color: '#b91c1c',
          fontSize: '0.9rem',
          marginTop: '0.5rem'
        }}>
          ✕ {error}
        </div>
      )}

      <style jsx>{`
        .image-upload-wrapper {
          display: grid;
          gap: 1rem;
        }

        .image-upload-container {
          border: 2px dashed #ddd;
          border-radius: 8px;
          overflow: hidden;
          background: #fafafa;
          aspect-ratio: 4 / 3;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .image-preview {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .image-preview img {
          max-width: 100%;
          max-height: 100%;
          object-fit: cover;
        }

        .image-preview-remove {
          position: absolute;
          top: 0.5rem;
          right: 0.5rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.85rem;
        }

        .image-upload-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 100%;
          color: #999;
        }

        .image-upload-icon {
          font-size: 2.5rem;
          margin: 0;
        }

        .image-upload-input-wrapper {
          display: flex;
        }

        .image-upload-input-wrapper label {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }
      `}</style>
    </div>
  );
}
