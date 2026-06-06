import React, { useState, useEffect, useRef } from 'react';
import { Trash2, FileText, FilePlus, Upload } from 'lucide-react';

interface Document {
  id: number;
  filename: string;
  filepath: string;
  filetype: string;
  upload_date: string;
  summary: string;
}

interface DocumentsProps {
  backendUrl: string;
  onDocumentChange?: () => void;
}

export const Documents: React.FC<DocumentsProps> = ({ backendUrl, onDocumentChange }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${backendUrl}/api/documents`);
      if (!response.ok) throw new Error('Failed to fetch documents');
      const data = await response.json();
      setDocuments(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this document?")) return;
    try {
      const response = await fetch(`${backendUrl}/api/documents/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete document');
      setDocuments(docs => docs.filter(doc => doc.id !== id));
      onDocumentChange?.();
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.name.toLowerCase().endsWith('.txt') && !file.name.toLowerCase().endsWith('.pdf')) {
      alert("Only PDF (.pdf) and Plain Text (.txt) reports are supported.");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const resp = await fetch(`${backendUrl}/api/documents/upload`, {
        method: 'POST',
        body: formData
      });

      if (resp.ok) {
        // Refresh the document list to get proper server-generated data
        await fetchDocuments();
        onDocumentChange?.();
      } else {
        const errData = await resp.json();
        alert(errData.detail || "Failed to upload document.");
      }
    } catch (err) {
      console.error(err);
      alert("Error uploading document.");
    } finally {
      setUploading(false);
      // Reset the file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (loading) return <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>Loading documents...</div>;
  if (error) return <div className="card error-card">Error: {error}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="card-header">
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Clinical Documents</h2>
          <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
            Manage uploaded patient records, pathology reports, and consultation notes.
          </p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={handleUploadClick}
          disabled={uploading}
        >
          {uploading ? (
            <>
              <Upload size={18} className="spin" />
              Processing...
            </>
          ) : (
            <>
              <FilePlus size={18} />
              Upload Document
            </>
          )}
        </button>
        <input 
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileUpload}
          accept=".txt,.pdf"
        />
      </div>

      <div className="card" style={{ padding: 0 }}>
        {documents.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <FileText size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
            <p>No documents uploaded yet.</p>
            <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Upload PDF or TXT files to auto-extract clinical data and power the AI assistant's RAG search.</p>
          </div>
        ) : (
          <table className="timeline-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Upload Date</th>
                <th>AI Summary</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ 
                        background: 'rgba(255, 255, 255, 0.05)', 
                        padding: '0.5rem', 
                        borderRadius: '6px',
                        color: 'var(--accent-blue)' 
                      }}>
                        <FileText size={18} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{doc.filename.split('_').pop()}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{doc.filetype.toUpperCase()}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {new Date(doc.upload_date).toLocaleDateString()}
                  </td>
                  <td style={{ maxWidth: '300px' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.4, color: 'var(--text-secondary)' }}>
                      {doc.summary}
                    </p>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button 
                        className="btn" 
                        style={{ padding: '0.5rem', background: 'transparent', color: 'var(--text-secondary)' }}
                        title="Delete Document"
                        onClick={() => handleDelete(doc.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
