import { Calendar, Pill, Activity, FileText, ArrowUpRight, Clock } from 'lucide-react';
import type {  Appointment, Medication, SymptomLog, TimelineEvent  } from '../types';

interface OverviewProps {
  appointments: Appointment[];
  medications: Medication[];
  symptoms: SymptomLog[];
  timeline: TimelineEvent[];
  setActiveTab: (tab: string) => void;
  backendUrl: string;
}

export const Overview: React.FC<OverviewProps> = ({ 
  appointments, 
  medications, 
  symptoms, 
  timeline, 
  setActiveTab,
  backendUrl: _backendUrl 
}) => {
  // Find next upcoming appointment
  const now = new Date();
  const nextApp = appointments
    .filter(app => new Date(app.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

  // Find medications with low refills (refills <= 1)
  const lowRefills = medications.filter(med => med.refills_remaining <= 1);
  
  // Calculate average symptom levels from last 7 entries
  const lastSevenSymptoms = symptoms.slice(-7);
  const avgPain = lastSevenSymptoms.length 
    ? (lastSevenSymptoms.reduce((sum, s) => sum + s.pain, 0) / lastSevenSymptoms.length).toFixed(1) 
    : '0.0';
  const avgDryMouth = lastSevenSymptoms.length 
    ? (lastSevenSymptoms.reduce((sum, s) => sum + s.dry_mouth, 0) / lastSevenSymptoms.length).toFixed(1) 
    : '0.0';

  // Last scan event
  const lastScan = [...timeline]
    .filter(e => e.event_type === 'Scan')
    .sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime())[0];

  // Get clinical staging from the diagnosis event in the timeline
  const diagnosisEvent = timeline.find(e => e.event_type === 'Diagnosis');
  const clinicalStage = diagnosisEvent?.details?.stage || 'Not staged';

  // Get radiation completion info
  const radiationComplete = [...timeline]
    .filter(e => e.event_type === 'Radiation' && e.title.toLowerCase().includes('completed'))
    .sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime())[0];
  const pbrtDate = radiationComplete 
    ? new Date(radiationComplete.event_date).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : 'N/A';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="overview-banner card">
        <div className="banner-welcome">
          <h2>ACC Care Dashboard</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Surveillance & care pathway tracking for <strong>Adenoid Cystic Carcinoma</strong>.
          </p>
        </div>
        <div className="banner-stats">
          <div className="stat-item">
            <div className="stat-value">{clinicalStage}</div>
            <div className="stat-label">Staging (Clinical)</div>
          </div>
          <div className="stat-item" style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '2rem' }}>
            <div className="stat-value">{pbrtDate}</div>
            <div className="stat-label">PBRT Completed</div>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Next Appointment Card */}
        <div className="widget-medium card card-glow" onClick={() => setActiveTab('appointments')} style={{ cursor: 'pointer' }}>
          <div className="widget-header">
            <div className="widget-title">
              <Calendar />
              <span>Next Consultation</span>
            </div>
            <ArrowUpRight size={18} style={{ color: 'var(--text-secondary)' }} />
          </div>
          {nextApp ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700 }}>{nextApp.title}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-cyan)', fontSize: '0.95rem' }}>
                <Clock size={16} />
                <span>{new Date(nextApp.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </div>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                <strong>Clinician:</strong> {nextApp.doctor || 'Unspecified'}<br />
                <strong>Location:</strong> {nextApp.location || 'Unspecified'}
              </p>
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>No information input yet. No upcoming appointments scheduled.</p>
          )}
        </div>

        {/* Refill Alerts Card */}
        <div className="widget-medium card" onClick={() => setActiveTab('medications')} style={{ cursor: 'pointer' }}>
          <div className="widget-header">
            <div className="widget-title">
              <Pill />
              <span>Medication Refill Status</span>
            </div>
            <span className={`status-badge ${lowRefills.length > 0 ? 'alert' : 'success'}`}>
              {lowRefills.length > 0 ? `${lowRefills.length} Low Refills` : 'All Refills OK'}
            </span>
          </div>
          
          {medications.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.5rem' }}>No information input yet.</p>
          ) : lowRefills.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>The following prescriptions need refills:</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {lowRefills.map(med => (
                  <div key={med.id} style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255, 51, 102, 0.05)', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(255, 51, 102, 0.15)', fontSize: '0.9rem' }}>
                    <span style={{ fontWeight: 600 }}>{med.name}</span>
                    <span style={{ color: 'var(--accent-red)', fontWeight: 600 }}>{med.refills_remaining} refill(s) left</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>All active prescriptions currently have adequate refills remaining.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.5rem' }}>
                {medications.map(med => (
                  <div key={med.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <span>{med.name} ({med.dosage})</span>
                    <span>{med.refills_remaining} refills</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Weekly Symptom Trends */}
        <div className="widget-small card">
          <div className="widget-header">
            <div className="widget-title">
              <Activity />
              <span>Weekly Averages</span>
            </div>
          </div>
          {symptoms.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.5rem' }}>No information input yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Neuropathic Pain</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>{avgPain}<span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>/10</span></div>
                </div>
                <span className={`status-badge ${parseFloat(avgPain) > 4 ? 'alert' : ''}`}>
                  {parseFloat(avgPain) > 4 ? 'Elevated' : 'Stable'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Dry Mouth (Xerostomia)</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>{avgDryMouth}<span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>/10</span></div>
                </div>
                <span className="status-badge" style={{ color: 'var(--accent-cyan)', background: 'rgba(0, 229, 255, 0.05)' }}>
                  Managed
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Last Surveillance Scan */}
        <div className="widget-large card">
          <div className="widget-header">
            <div className="widget-title">
              <FileText />
              <span>Latest Surveillance Scan</span>
            </div>
          </div>
          {lastScan ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{lastScan.title}</h4>
                <span className="event-date">{new Date(lastScan.event_date).toLocaleDateString([], { dateStyle: 'medium' })}</span>
              </div>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {lastScan.description}
              </p>
              {lastScan.details?.findings && (
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginTop: '0.25rem', fontSize: '0.85rem' }}>
                  <strong>Key Finding:</strong> {lastScan.details.findings}
                </div>
              )}
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>No information input yet. No scanning history available.</p>
          )}
        </div>


      </div>
    </div>
  );
};
