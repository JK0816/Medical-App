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
    ? (lastSevenSymptoms.reduce((sum, s) => sum + (s.pain || 0), 0) / lastSevenSymptoms.length).toFixed(1) 
    : '0.0';
  const avgFatigue = lastSevenSymptoms.length 
    ? (lastSevenSymptoms.reduce((sum, s) => sum + (s.fatigue || 0), 0) / lastSevenSymptoms.length).toFixed(1) 
    : '0.0';
  const avgNausea = lastSevenSymptoms.length 
    ? (lastSevenSymptoms.reduce((sum, s) => sum + (s.nausea || 0), 0) / lastSevenSymptoms.length).toFixed(1) 
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
    <div className="flex-col-large">
      <div className="overview-banner card">
        <div className="banner-welcome">
          <h2>ACC Care Dashboard</h2>
          <p className="text-secondary">
            Surveillance & care pathway tracking for <strong>Adenoid Cystic Carcinoma</strong>.
          </p>
        </div>
        <div className="banner-stats">
          <div className="stat-item">
            <div className="stat-value">{clinicalStage}</div>
            <div className="stat-label">Staging (Clinical)</div>
          </div>
          <div className="stat-item border-left-stat">
            <div className="stat-value">{pbrtDate}</div>
            <div className="stat-label">PBRT Completed</div>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Next Appointment Card */}
        <div className="widget-medium card card-glow pointer" onClick={() => setActiveTab('appointments')}>
          <div className="widget-header">
            <div className="widget-title">
              <Calendar />
              <span>Next Consultation</span>
            </div>
            <ArrowUpRight size={18} className="text-secondary" />
          </div>
          {nextApp ? (
            <div className="flex-col-small">
              <h3 className="title-medium">{nextApp.title}</h3>
              <div className="appointment-time-badge">
                <Clock size={16} />
                <span>{new Date(nextApp.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </div>
              <p className="text-secondary-small-spaced">
                <strong>Clinician:</strong> {nextApp.doctor || 'Unspecified'}<br />
                <strong>Location:</strong> {nextApp.location || 'Unspecified'}
              </p>
            </div>
          ) : (
            <p className="text-secondary-medium">No information input yet. No upcoming appointments scheduled.</p>
          )}
        </div>

        {/* Refill Alerts Card */}
        <div className="widget-medium card pointer" onClick={() => setActiveTab('medications')}>
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
            <p className="text-secondary-medium-margin">No information input yet.</p>
          ) : lowRefills.length > 0 ? (
            <div className="flex-col-medium">
              <p className="text-secondary-small">The following prescriptions need refills:</p>
              <div className="flex-col-small">
                {lowRefills.map(med => (
                  <div key={med.id} className="refill-badge-danger">
                    <span style={{ fontWeight: 600 }}>{med.name}</span>
                    <span style={{ color: 'var(--accent-red)', fontWeight: 600 }}>{med.refills_remaining} refill(s) left</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-col-small">
              <p className="text-secondary-small">All active prescriptions currently have adequate refills remaining.</p>
              <div className="flex-col-small text-secondary-medium-margin">
                {medications.map(med => (
                  <div key={med.id} className="med-refill-row">
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
            <p className="text-secondary-medium-margin">No information input yet.</p>
          ) : (
            <div className="flex-col-medium">
              <div className="flex-row-center-between">
                <div>
                  <div className="trend-label">Pain</div>
                  <div className="trend-value">{avgPain}<span className="trend-unit">/10</span></div>
                </div>
                <span className={`status-badge ${parseFloat(avgPain) > 4 ? 'alert' : ''}`}>
                  {parseFloat(avgPain) > 4 ? 'Elevated' : 'Stable'}
                </span>
              </div>
              <div className="trend-row-bordered">
                <div>
                  <div className="trend-label">Fatigue</div>
                  <div className="trend-value">{avgFatigue}<span className="trend-unit">/10</span></div>
                </div>
                <span className={`status-badge ${parseFloat(avgFatigue) > 4 ? 'alert' : ''}`}>
                  {parseFloat(avgFatigue) > 4 ? 'Elevated' : 'Stable'}
                </span>
              </div>
              <div className="trend-row-bordered">
                <div>
                  <div className="trend-label">Nausea</div>
                  <div className="trend-value">{avgNausea}<span className="trend-unit">/10</span></div>
                </div>
                <span className={`status-badge ${parseFloat(avgNausea) > 4 ? 'alert' : ''}`}>
                  {parseFloat(avgNausea) > 4 ? 'Elevated' : 'Stable'}
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
            <div className="flex-col-small">
              <div className="flex-row-center-between">
                <h4 className="title-small">{lastScan.title}</h4>
                <span className="event-date">{new Date(lastScan.event_date).toLocaleDateString([], { dateStyle: 'medium' })}</span>
              </div>
              <p className="scan-desc">
                {lastScan.description}
              </p>
              {lastScan.details?.findings && (
                <div className="scan-findings-box">
                  <strong>Key Finding:</strong> {lastScan.details.findings}
                </div>
              )}
            </div>
          ) : (
            <p className="text-secondary-medium">No information input yet. No scanning history available.</p>
          )}
        </div>

      </div>
    </div>
  );
};
