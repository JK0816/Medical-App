import React, { useState } from 'react';
import { Calendar as CalendarIcon, Clock, MapPin, User, Plus, Trash2 } from 'lucide-react';
import type {  Appointment  } from '../types';

interface AppointmentsProps {
  appointments: Appointment[];
  fetchAppointments: () => void;
  backendUrl: string;
}

export const Appointments: React.FC<AppointmentsProps> = ({ 
  appointments, 
  fetchAppointments, 
  backendUrl 
}) => {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [doctor, setDoctor] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  const now = new Date();

  // Sort: upcoming (date >= now) ascending, past (date < now) descending
  const upcoming = appointments
    .filter(app => new Date(app.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
  const past = appointments
    .filter(app => new Date(app.date) < now)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !date) {
      alert("Title and Date are required.");
      return;
    }

    try {
      const resp = await fetch(`${backendUrl}/api/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, date, doctor, location, notes })
      });
      if (resp.ok) {
        fetchAppointments();
        // Reset
        setTitle('');
        setDate('');
        setDoctor('');
        setLocation('');
        setNotes('');
        setShowForm(false);
      }
    } catch (err) {
      console.error("Failed to save appointment:", err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to cancel/delete this appointment?")) return;
    try {
      const resp = await fetch(`${backendUrl}/api/appointments/${id}`, {
        method: 'DELETE'
      });
      if (resp.ok) {
        fetchAppointments();
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
        <button className="btn" onClick={() => setShowForm(!showForm)}>
          <Plus size={18} />
          {showForm ? 'Cancel' : 'Schedule Visit'}
        </button>
      </div>

      {showForm && (
        <form className="card" onSubmit={handleSubmit} style={{ animation: 'slideDown 0.25s ease' }}>
          <h3 style={{ marginBottom: '1.25rem', fontWeight: 700 }}>Schedule Consultation</h3>
          <div className="form-group">
            <label className="form-label">Appointment Title / Purpose</label>
            <input 
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
              <label className="form-label">Date & Time</label>
              <input 
                type="datetime-local" 
                className="form-input" 
                value={date} 
                onChange={(e) => setDate(e.target.value)} 
                required 
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Physician / Clinician</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g., Dr. Sarah Jenkins" 
                value={doctor} 
                onChange={(e) => setDoctor(e.target.value)} 
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Location / Clinic</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g., ACC Specialty Center, Department of Radiation Oncology" 
              value={location} 
              onChange={(e) => setLocation(e.target.value)} 
            />
          </div>

          <div className="form-group">
            <label className="form-label">Preparatory Notes / Reminders</label>
            <textarea 
              className="form-textarea" 
              rows={3} 
              placeholder="e.g., Fasting 4 hours before, bring contrast allergy notes..." 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)} 
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
              Cancel
            </button>
            <button type="submit" className="btn">
              Schedule Appointment
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
                  <div>
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
                  </div>
                  <button 
                    className="btn btn-secondary" 
                    style={{ padding: '0.4rem', borderRadius: '8px' }}
                    onClick={() => handleDelete(app.id)}
                  >
                    <Trash2 size={16} style={{ color: 'var(--accent-red)' }} />
                  </button>
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
                  <div>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 600 }}>{app.title}</h4>
                    <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.35rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <span>{new Date(app.date).toLocaleDateString([], { dateStyle: 'medium' })}</span>
                      {app.doctor && <span>{app.doctor}</span>}
                      {app.location && <span>{app.location}</span>}
                    </div>
                  </div>
                  <button 
                    className="btn btn-secondary" 
                    style={{ padding: '0.35rem', borderRadius: '8px' }}
                    onClick={() => handleDelete(app.id)}
                  >
                    <Trash2 size={14} style={{ color: 'var(--accent-red)' }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
