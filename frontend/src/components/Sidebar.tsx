import { Activity, GitCommit, Calendar, Pill, FileText, ShieldAlert, Database } from 'lucide-react';
import React from 'react';
import { 
   
  BarChart2, 
  Brain 
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isConnected: boolean;
  onExport: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isConnected, onExport }) => {
  const menuItems = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'timeline', label: 'Clinical Timeline', icon: GitCommit },
    { id: 'appointments', label: 'Appointments', icon: Calendar },
    { id: 'medications', label: 'Medications', icon: Pill },
    { id: 'symptoms', label: 'Symptom Diary', icon: BarChart2 },
    { id: 'scans', label: 'DICOM Imaging', icon: FileText },
    { id: 'documents', label: 'Clinical Documents', icon: FileText },
    { id: 'assistant', label: 'ACC AI Assistant', icon: Brain },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <ShieldAlert size={28} />
        <span>ACC CarePath</span>
      </div>
      
      <nav style={{ flex: 1 }}>
        <ul className="sidebar-menu">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <li 
                key={item.id}
                className={`sidebar-item ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => setActiveTab(item.id)}
              >
                <Icon />
                <span>{item.label}</span>
              </li>
            );
          })}
        </ul>
      </nav>
      
      <div className="sidebar-footer">
        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>ACC Tracker v1.2</div>
        <div>Local Secure Mode</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span className={`sync-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
          <span>Sync: {isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
        <button className="btn-backup" onClick={onExport} title="Download database backup file">
          <Database size={13} />
          <span>Export Backup</span>
        </button>
      </div>
    </aside>
  );
};

