import React, { useState, useMemo, useEffect } from 'react';
import {   AlertTriangle, CheckCircle, Plus, RefreshCw, Trash2, Edit2 } from 'lucide-react';
import type {  Medication  } from '../types';

interface MedicationsProps {
  medications: Medication[];
  fetchMedications: () => void;
  backendUrl: string;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const Medications: React.FC<MedicationsProps> = ({ 
  medications, 
  fetchMedications, 
  backendUrl,
  showToast 
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [refills, setRefills] = useState('0');
  const [notes, setNotes] = useState('');
  
  const [refillingId, setRefillingId] = useState<number | null>(null);

  // Keyboard shortcut (Escape to close form/modal)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowForm(false);
        setEditingId(null);
        setDeleteConfirmId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // useMemo for sorted medication array
  const sortedMedications = useMemo(() => {
    return [...medications].sort((a, b) => a.name.localeCompare(b.name));
  }, [medications]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !dosage || !frequency) {
      alert("Name, dosage, and frequency are required.");
      return;
    }

    try {
      const isEdit = editingId !== null;
      const url = isEdit 
        ? `${backendUrl}/api/medications/${editingId}`
        : `${backendUrl}/api/medications`;
      const method = isEdit ? 'PUT' : 'POST';

      const resp = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          dosage,
          frequency,
          start_date: startDate || null,
          end_date: endDate || null,
          refills_remaining: parseInt(refills) || 0,
          notes: notes || null
        })
      });
      if (resp.ok) {
        fetchMedications();
        showToast(isEdit ? 'Medication updated successfully' : 'Medication added successfully');
        // Reset
        setName('');
        setDosage('');
        setFrequency('');
        setStartDate('');
        setEndDate('');
        setRefills('0');
        setNotes('');
        setEditingId(null);
        setShowForm(false);
      }
    } catch (err) {
      console.error("Failed to save medication:", err);
    }
  };

  const handleStartEdit = (med: Medication) => {
    setEditingId(med.id);
    setName(med.name);
    setDosage(med.dosage);
    setFrequency(med.frequency);
    setStartDate(med.start_date || '');
    setEndDate(med.end_date || '');
    setRefills(med.refills_remaining.toString());
    setNotes(med.notes || '');
    setShowForm(true);
  };

  const handleRefill = async (id: number) => {
    setRefillingId(id);
    try {
      const resp = await fetch(`${backendUrl}/api/medications/${id}/refill`, {
        method: 'POST'
      });
      if (resp.ok) {
        fetchMedications();
        showToast('Refill logged successfully');
      } else {
        const data = await resp.json();
        alert(data.detail || "Refill failed.");
      }
    } catch (err) {
      console.error("Failed to refill:", err);
    } finally {
      setRefillingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const resp = await fetch(`${backendUrl}/api/medications/${id}`, {
        method: 'DELETE'
      });
      if (resp.ok) {
        fetchMedications();
        showToast('Medication removed');
      } else {
        const data = await resp.json();
        alert(data.detail || "Failed to delete medication.");
      }
    } catch (err) {
      console.error("Failed to delete medication:", err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Prescription & Refill Manager</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Track dosages, scheduling, and request refill logging for critical supportive medications.</p>
        </div>
        <button 
          className="btn" 
          onClick={() => {
            if (showForm) {
              setShowForm(false);
              setEditingId(null);
            } else {
              setShowForm(true);
            }
          }}
        >
          <Plus size={18} />
          {showForm ? 'Cancel' : 'Add Medication'}
        </button>
      </div>

      {showForm && (
        <form className="card" onSubmit={handleSubmit} style={{ animation: 'slideDown 0.25s ease' }}>
          <h3 style={{ marginBottom: '1.25rem', fontWeight: 700 }}>
            {editingId !== null ? 'Edit Prescription Details' : 'Record Prescription'}
          </h3>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Medication Name</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g., Pilocarpine, Gabapentin" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                required 
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Dosage Strength</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g., 5mg, 300mg" 
                value={dosage} 
                onChange={(e) => setDosage(e.target.value)} 
                required 
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Frequency</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g., Once daily, Three times daily" 
                value={frequency} 
                onChange={(e) => setFrequency(e.target.value)} 
                required 
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Initial Refills Remaining</label>
              <input 
                type="number" 
                className="form-input" 
                value={refills} 
                onChange={(e) => setRefills(e.target.value)} 
                min="0"
                required 
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input 
                type="date" 
                className="form-input" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">End Date</label>
              <input 
                type="date" 
                className="form-input" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)} 
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Instructions & Special Precautions</label>
            <textarea 
              className="form-textarea" 
              rows={3} 
              placeholder="e.g., Take 30 mins before meals. Do not drink alcohol..." 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)} 
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
            >
              Cancel
            </button>
            <button type="submit" className="btn">
              {editingId !== null ? 'Save Changes' : 'Save Prescription'}
            </button>
          </div>
        </form>
      )}

      {/* Grid of Medications */}
      {sortedMedications.length > 0 ? (
        <div className="med-grid">
          {sortedMedications.map(med => {
            const isLow = med.refills_remaining <= 1;
            const isExhausted = med.refills_remaining === 0;
            
            return (
              <div 
                key={med.id} 
                className="card med-card"
                style={{
                  borderLeft: isExhausted 
                    ? '4px solid var(--accent-red)' 
                    : isLow 
                      ? '4px solid #ffb703' 
                      : '4px solid var(--accent-blue)',
                  boxShadow: isExhausted
                    ? '0 10px 30px rgba(255, 51, 102, 0.05)'
                    : isLow
                      ? '0 10px 30px rgba(255, 183, 3, 0.05)'
                      : 'none'
                }}
              >
                <div>
                  <div className="med-header">
                    <div>
                      <h3 className="med-title">{med.name}</h3>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                        {med.frequency}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
                      <span className="med-dose-tag">{med.dosage}</span>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '0.3rem', borderRadius: '8px' }}
                        onClick={() => handleStartEdit(med)}
                        title="Edit Medication"
                      >
                        <Edit2 size={13} style={{ color: 'var(--accent-cyan)' }} />
                      </button>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '0.3rem', borderRadius: '8px' }}
                        onClick={() => setDeleteConfirmId(med.id)}
                        title="Remove Medication"
                      >
                        <Trash2 size={13} style={{ color: 'var(--accent-red)' }} />
                      </button>
                    </div>
                  </div>

                  <div className="med-body">
                    {med.notes && (
                      <p style={{ fontStyle: 'italic', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        "{med.notes}"
                      </p>
                    )}
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                      <div className="med-info-row">
                        <span>Timeline:</span>
                        <span>{med.start_date || 'N/A'} to {med.end_date || 'N/A'}</span>
                      </div>
                      <div className="med-info-row">
                        <span>Last Refill:</span>
                        <span>{med.last_refill_date ? new Date(med.last_refill_date).toLocaleDateString() : 'Never logged'}</span>
                      </div>
                      {med.created_at && (
                        <div className="med-info-row">
                          <span>Logged on:</span>
                          <span>{new Date(med.created_at).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    {isExhausted ? (
                      <AlertTriangle size={16} style={{ color: 'var(--accent-red)' }} />
                    ) : isLow ? (
                      <AlertTriangle size={16} style={{ color: '#ffb703' }} />
                    ) : (
                      <CheckCircle size={16} style={{ color: 'var(--accent-cyan)' }} />
                    )}
                    <span style={{ fontSize: '0.85rem' }}>
                      Refills Remaining: <strong className={`refills-left-count ${isLow ? 'low' : ''}`}>{med.refills_remaining}</strong>
                    </span>
                  </div>

                  <button 
                    className="btn btn-secondary" 
                    style={{ 
                      padding: '0.4rem 0.85rem', 
                      fontSize: '0.8rem', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.25rem',
                      borderColor: isLow ? 'rgba(255, 183, 3, 0.4)' : 'var(--border-color)'
                    }}
                    onClick={() => handleRefill(med.id)}
                    disabled={isExhausted || refillingId === med.id}
                  >
                    <RefreshCw size={12} className={refillingId === med.id ? 'spin' : ''} />
                    {refillingId === med.id ? 'Refilling...' : 'Log Refill'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          No information input yet. Click "Add Medication" to log your first prescription.
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId !== null && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-header">Confirm Deletion</h3>
            <p className="modal-body">Are you sure you want to delete this medication? This action cannot be undone.</p>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setDeleteConfirmId(null)}>Cancel</button>
              <button 
                type="button" 
                className="btn btn-danger" 
                onClick={() => {
                  handleDelete(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
