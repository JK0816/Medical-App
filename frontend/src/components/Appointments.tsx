import React, { useState, useMemo, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, MapPin, User, Plus, Trash2, Edit2 } from 'lucide-react';
import type {  Appointment  } from '../types';

interface AppointmentsProps {
  appointments: Appointment[];
  fetchAppointments: () => void;
  backendUrl: string;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const Appointments: React.FC<AppointmentsProps> = ({ 
  appointments, 
  fetchAppointments, 
  backendUrl,
  showToast 
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [doctor, setDoctor] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

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

  // Sort: upcoming (date >= now) ascending, past (date < now) descending
  const upcoming = useMemo(() => {
    const now = new Date();
    return appointments
      .filter(app => new Date(app.date) >= now)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [appointments]);
    
  const past = useMemo(() => {
    const now = new Date();
    return appointments
      .filter(app => new Date(app.date) < now)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [appointments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !date) {
      alert("Title and Date are required.");
      return;
    }

    try {
      const isEdit = editingId !== null;
      const url = isEdit 
        ? `${backendUrl}/api/appointments/${editingId}`
        : `${backendUrl}/api/appointments`;
      const method = isEdit ? 'PUT' : 'POST';

      const resp = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, date, doctor, location, notes })
      });
      if (resp.ok) {
        fetchAppointments();
        showToast(isEdit ? 'Appointment updated successfully' : 'Appointment scheduled successfully');
        // Reset
        setTitle('');
        setDate('');
        setDoctor('');
        setLocation('');
        setNotes('');
        setEditingId(null);
        setShowForm(false);
      }
    } catch (err) {
      console.error("Failed to save appointment:", err);
    }
  };

  const handleStartEdit = (app: Appointment) => {
    setEditingId(app.id);
    setTitle(app.title);
    setDate(app.date.slice(0, 16)); // Format for datetime-local: YYYY-MM-DDTHH:MM
    setDoctor(app.doctor || '');
    setLocation(app.location || '');
    setNotes(app.notes || '');
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    try {
      const resp = await fetch(`${backendUrl}/api/appointments/${id}`, {
        method: 'DELETE'
      });
      if (resp.ok) {
        fetchAppointments();
        showToast('Appointment removed');
      }
    } catch (err) {
      console.error("Failed to delete appointment:", err);
    }
  };


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Consultations & Procedures</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Schedule and manage your surveillance consultations and MRI/CT imaging appointments.</p>
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
          {showForm ? 'Cancel' : 'Schedule Visit'}
        </button>
      </div>

      {showForm && (
        <form className="card" onSubmit={handleSubmit} style={{ animation: 'slideDown 0.25s ease' }}>
          <h3 style={{ marginBottom: '1.25rem', fontWeight: 700 }}>
            {editingId !== null ? 'Edit Consultation' : 'Schedule Consultation'}
          </h3>
          <div className="form-group">
            <label className="form-label" htmlFor="appt-title">Appointment Title / Purpose</label>
            <input 
              id="appt-title"
              type="text" 
              className="form-input" 
              placeholder="e.g., Routine 3-Month Surveillance, Skull Base MRI" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              required 
            />
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="appt-date">Date & Time</label>
              <input 
                id="appt-date"
                type="datetime-local" 
                className="form-input" 
                value={date} 
                onChange={(e) => setDate(e.target.value)} 
                required 
              />
            </div>
            
            <div className="form-group">
              <label className="form-label" htmlFor="appt-doctor">Physician / Clinician</label>
              <input 
                id="appt-doctor"
                type="text" 
                className="form-input" 
                placeholder="e.g., Dr. Sarah Jenkins" 
                value={doctor} 
                onChange={(e) => setDoctor(e.target.value)} 
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="appt-location">Location / Clinic</label>
            <input 
              id="appt-location"
              type="text" 
              className="form-input" 
              placeholder="e.g., ACC Specialty Center, Department of Radiation Oncology" 
              value={location} 
              onChange={(e) => setLocation(e.target.value)} 
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="appt-notes">Preparatory Notes / Reminders</label>
            <textarea 
              id="appt-notes"
              className="form-textarea" 
              rows={3} 
              placeholder="e.g., Fasting 4 hours before, bring contrast allergy notes..." 
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
              {editingId !== null ? 'Save Changes' : 'Schedule Appointment'}
            </button>
          </div>
        </form>
      )}

      {/* Upcoming Section */}
      <div>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Clock size={18} style={{ color: 'var(--accent-cyan)' }} />
          Upcoming Consultations
        </h3>
        
        {upcoming.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {upcoming.map(app => (
              <div key={app.id} className="card card-glow" style={{ borderLeft: '4px solid var(--accent-cyan)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{app.title}</h4>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginTop: '0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <CalendarIcon size={15} style={{ color: 'var(--accent-cyan)' }} />
                        <span>{new Date(app.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                      </div>
                      {app.doctor && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <User size={15} />
                          <span>{app.doctor}</span>
                        </div>
                      )}
                      {app.location && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <MapPin size={15} />
                          <span>{app.location}</span>
                        </div>
                      )}
                    </div>
                    {app.notes && (
                      <p style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        <strong>Notes:</strong> {app.notes}
                      </p>
                    )}
                    {app.created_at && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                        Logged on: {new Date(app.created_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '0.4rem', borderRadius: '8px' }}
                      onClick={() => handleStartEdit(app)}
                      title="Edit appointment"
                    >
                      <Edit2 size={15} style={{ color: 'var(--accent-cyan)' }} />
                    </button>
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '0.4rem', borderRadius: '8px' }}
                      onClick={() => setDeleteConfirmId(app.id)}
                      title="Cancel appointment"
                    >
                      <Trash2 size={15} style={{ color: 'var(--accent-red)' }} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No information input yet. Click "Schedule Visit" to add one.
          </div>
        )}
      </div>

      {/* Historical Section */}
      {past.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            Completed Visits & History
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {past.map(app => (
              <div key={app.id} className="card" style={{ opacity: 0.75, padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 600 }}>{app.title}</h4>
                    <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.35rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <span>{new Date(app.date).toLocaleDateString([], { dateStyle: 'medium' })}</span>
                      {app.doctor && <span>{app.doctor}</span>}
                      {app.location && <span>{app.location}</span>}
                    </div>
                    {app.created_at && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                        Logged on: {new Date(app.created_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginLeft: '1rem' }}>
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '0.35rem', borderRadius: '8px' }}
                      onClick={() => handleStartEdit(app)}
                      title="Edit appointment details"
                    >
                      <Edit2 size={13} style={{ color: 'var(--accent-cyan)' }} />
                    </button>
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '0.35rem', borderRadius: '8px' }}
                      onClick={() => setDeleteConfirmId(app.id)}
                      title="Delete appointment from log"
                    >
                      <Trash2 size={13} style={{ color: 'var(--accent-red)' }} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId !== null && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-header">Confirm Deletion</h3>
            <p className="modal-body">Are you sure you want to delete this appointment? This action cannot be undone.</p>
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

