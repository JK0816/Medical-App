import { useState, useEffect } from 'react';
import './App.css';
import { Sidebar } from './components/Sidebar';
import { Overview } from './components/Overview';
import { Timeline } from './components/Timeline';
import { Appointments } from './components/Appointments';
import { Medications } from './components/Medications';
import { Symptoms } from './components/Symptoms';
import { ScanViewer } from './components/ScanViewer';
import { Assistant } from './components/Assistant';
import { Documents } from './components/Documents';

import type {  Appointment, Medication, SymptomLog, TimelineEvent  } from './types';

const BACKEND_URL = 'http://127.0.0.1:8000';

function App() {
  const [activeTab, setActiveTab] = useState<string>(() => {
    return localStorage.getItem('acc_activeTab') || 'overview';
  });
  
  // Data State
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [symptoms, setSymptoms] = useState<SymptomLog[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  
  // Global loading/error state
  const [isLoading, setIsLoading] = useState(true);
  const [backendError, setBackendError] = useState<string | null>(null);

  // Fetch functions
  const fetchAppointments = async () => {
    try {
      const resp = await fetch(`${BACKEND_URL}/api/appointments`);
      if (resp.ok) {
        const data = await resp.json();
        setAppointments(data);
      }
    } catch (err) {
      console.error("Error fetching appointments:", err);
    }
  };

  const fetchMedications = async () => {
    try {
      const resp = await fetch(`${BACKEND_URL}/api/medications`);
      if (resp.ok) {
        const data = await resp.json();
        setMedications(data);
      }
    } catch (err) {
      console.error("Error fetching medications:", err);
    }
  };

  const fetchSymptoms = async () => {
    try {
      const resp = await fetch(`${BACKEND_URL}/api/symptoms`);
      if (resp.ok) {
        const data = await resp.json();
        setSymptoms(data);
      }
    } catch (err) {
      console.error("Error fetching symptoms:", err);
    }
  };

  const fetchTimeline = async () => {
    try {
      const resp = await fetch(`${BACKEND_URL}/api/timeline`);
      if (resp.ok) {
        const data = await resp.json();
        setTimeline(data);
      }
    } catch (err) {
      console.error("Error fetching timeline:", err);
    }
  };

  // Initial Data Fetch
  useEffect(() => {
    const loadAll = async () => {
      setIsLoading(true);
      setBackendError(null);
      try {
        await Promise.all([
          fetchAppointments(),
          fetchMedications(),
          fetchSymptoms(),
          fetchTimeline()
        ]);
      } catch {
        setBackendError('Unable to connect to the backend server. Please ensure it is running on port 8000.');
      } finally {
        setIsLoading(false);
      }
    };
    loadAll();
  }, []);

  // Persist active tab to localStorage
  useEffect(() => {
    localStorage.setItem('acc_activeTab', activeTab);
  }, [activeTab]);

  const getPageTitleAndSubtitle = () => {
    switch (activeTab) {
      case 'overview':
        return { title: "Patient Dashboard", subtitle: "Surveillance and care management details." };
      case 'timeline':
        return { title: "Clinical Timeline", subtitle: "Chronological progression log of diagnoses, surgeries, scans, and therapies." };
      case 'appointments':
        return { title: "Consultation Scheduler", subtitle: "Manage oncological visits, imaging appointments, and radiation fractions." };
      case 'medications':
        return { title: "Medications & Refill Center", subtitle: "Manage xerostomia stimulants, neuropathic pain relievers, and log pharmacy refills." };
      case 'symptoms':
        return { title: "Daily Symptom Diary", subtitle: "Log xerostomia severity, swallowing complications, and face neuropathy." };
      case 'scans':
        return { title: "DICOM Imaging Workstation", subtitle: "Analyze slices of head & neck MRI/CT scans with AI diagnostic reading." };
      case 'documents':
        return { title: "Document Repository", subtitle: "Manage medical reports, insurance forms, and correspondence." };
      case 'assistant':
        return { title: "ACC AI RAG Assistant", subtitle: "Query guidelines, clinical trials, and request semantic summaries of your records." };
      default:
        return { title: "Patient Tracker", subtitle: "ACC care management." };
    }
  };

  const { title, subtitle } = getPageTitleAndSubtitle();

  return (
    <div className="app-container">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="main-content">
        <div className="page-title-container">
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>

        {backendError && (
          <div className="card" style={{ borderLeft: '4px solid var(--accent-red)', background: 'rgba(225, 29, 72, 0.06)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.2rem' }}>⚠️</span>
            <div>
              <strong style={{ color: 'var(--accent-red)' }}>Connection Error</strong>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>{backendError}</p>
            </div>
          </div>
        )}

        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
            <div className="typing-indicator">
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
            </div>
          </div>
        )}

        {activeTab === 'overview' && (
          <Overview 
            appointments={appointments}
            medications={medications}
            symptoms={symptoms}
            timeline={timeline}
            setActiveTab={setActiveTab}
            backendUrl={BACKEND_URL}
          />
        )}

        {activeTab === 'timeline' && (
          <Timeline 
            timeline={timeline}
            fetchTimeline={fetchTimeline}
            backendUrl={BACKEND_URL}
          />
        )}

        {activeTab === 'appointments' && (
          <Appointments 
            appointments={appointments}
            fetchAppointments={fetchAppointments}
            backendUrl={BACKEND_URL}
          />
        )}

        {activeTab === 'medications' && (
          <Medications 
            medications={medications}
            fetchMedications={fetchMedications}
            backendUrl={BACKEND_URL}
          />
        )}

        {activeTab === 'symptoms' && (
          <Symptoms 
            symptoms={symptoms}
            fetchSymptoms={fetchSymptoms}
            backendUrl={BACKEND_URL}
          />
        )}

        {activeTab === 'scans' && (
          <ScanViewer 
            backendUrl={BACKEND_URL}
            onScanUploaded={() => {
              fetchTimeline(); // Automatically update timeline on new scan upload
            }}
          />
        )}

        {activeTab === 'documents' && (
          <Documents 
            backendUrl={BACKEND_URL}
            onDocumentChange={() => {
              fetchTimeline(); // Documents can auto-extract timeline events
            }}
          />
        )}

        {activeTab === 'assistant' && (
          <Assistant backendUrl={BACKEND_URL} />
        )}
      </main>
    </div>
  );
}

export default App;
