import React, { useState } from 'react';
import { 
  ShieldAlert, 
  FileText, 
  Pill,
  Plus, 
  Trash2, 
  Scissors, 
  Flame, 
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import type {  TimelineEvent  } from '../types';

interface TimelineProps {
  timeline: TimelineEvent[];
  fetchTimeline: () => void;
  backendUrl: string;
}

export const Timeline: React.FC<TimelineProps> = ({ timeline, fetchTimeline, backendUrl }) => {
  const [filter, setFilter] = useState<'All' | 'Scans' | 'Treatments' | 'Diagnosis'>('All');
  const [expandedEventId, setExpandedEventId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Form State
  const [eventDate, setEventDate] = useState('');
  const [eventType, setEventType] = useState('Other');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  
  // Event-specific details inputs
  const [marginStatus, setMarginStatus] = useState('');
  const [lymphNodes, setLymphNodes] = useState('');
  const [radiationDose, setRadiationDose] = useState('');
  const [radiationFractions, setRadiationFractions] = useState('');
  const [scanFindings, setScanFindings] = useState('');

  const toggleExpand = (id: number) => {
    if (expandedEventId === id) {
      setExpandedEventId(null);
    } else {
      setExpandedEventId(id);
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'Diagnosis': return <ShieldAlert size={20} />;
      case 'Surgery': return <Scissors size={20} />;
      case 'Radiation': return <Flame size={20} />;
      case 'Scan': return <FileText size={20} />;
      case 'Medication Change': return <Pill size={20} />;
      default: return <Info size={20} />;
    }
  };

  const getEventNodeClass = (type: string) => {
    switch (type) {
      case 'Diagnosis': return 'node-diagnosis';
      case 'Surgery': return 'node-surgery';
      case 'Radiation': return 'node-radiation';
      case 'Scan': return 'node-scan';
      case 'Medication Change': return 'node-medication';
      default: return 'node-other';
    }
  };

  const getEventBadgeClass = (type: string) => {
    switch (type) {
      case 'Diagnosis': return 'event-badge diagnosis';
      case 'Surgery': return 'event-badge surgery';
      case 'Radiation': return 'event-badge radiation';
      case 'Scan': return 'event-badge scan';
      case 'Medication Change': return 'event-badge medication';
      default: return 'event-badge';
    }
  };

  const filteredEvents = timeline.filter(event => {
    if (filter === 'All') return true;
    if (filter === 'Scans') return event.event_type === 'Scan';
    if (filter === 'Treatments') return event.event_type === 'Surgery' || event.event_type === 'Radiation';
    if (filter === 'Diagnosis') return event.event_type === 'Diagnosis';
    return true;
  });

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering card toggle
    if (!confirm('Are you sure you want to delete this timeline event?')) return;
    
    try {
      const resp = await fetch(`${backendUrl}/api/timeline/${id}`, {
        method: 'DELETE'
      });
      if (resp.ok) {
        fetchTimeline();
        if (expandedEventId === id) setExpandedEventId(null);
      }
    } catch (err) {
      console.error("Failed to delete timeline event:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventDate || !title) {
      alert("Please fill in the date and title.");
      return;
    }

    // Construct details object based on type
    const details: Record<string, any> = {};
    if (eventType === 'Surgery') {
      if (marginStatus) details.margin_status = marginStatus;
      if (lymphNodes) details.lymph_nodes_cleared = lymphNodes;
    } else if (eventType === 'Radiation') {
      if (radiationDose) details.planned_dose_cgy = parseInt(radiationDose) || radiationDose;
      if (radiationFractions) details.fractions = parseInt(radiationFractions) || radiationFractions;
    } else if (eventType === 'Scan') {
      if (scanFindings) details.findings = scanFindings;
    }

    const payload = {
      event_date: eventDate,
      event_type: eventType,
      title: title,
      description: description || null,
      details_json: JSON.stringify(details)
    };

    try {
      const resp = await fetch(`${backendUrl}/api/timeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (resp.ok) {
        fetchTimeline();
        // Reset Form
        setEventDate('');
        setEventType('Other');
        setTitle('');
        setDescription('');
        setMarginStatus('');
        setLymphNodes('');
        setRadiationDose('');
        setRadiationFractions('');
        setScanFindings('');
        setShowAddForm(false);
      } else {
        const data = await resp.json();
        alert(data.detail || "Failed to create timeline event.");
      }
    } catch (err) {
      console.error("Error creating timeline event:", err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="timeline-controls">
        <div className="timeline-filters">
          <button 
            className={`filter-chip ${filter === 'All' ? 'active' : ''}`}
            onClick={() => setFilter('All')}
          >
            All Events
          </button>
          <button 
            className={`filter-chip ${filter === 'Treatments' ? 'active' : ''}`}
            onClick={() => setFilter('Treatments')}
          >
            Treatments (Surgery/Radiation)
          </button>
          <button 
            className={`filter-chip ${filter === 'Scans' ? 'active' : ''}`}
            onClick={() => setFilter('Scans')}
          >
            Scans & Imaging
          </button>
          <button 
            className={`filter-chip ${filter === 'Diagnosis' ? 'active' : ''}`}
            onClick={() => setFilter('Diagnosis')}
          >
            Diagnoses
          </button>
        </div>

        <button className="btn" onClick={() => setShowAddForm(!showAddForm)}>
          <Plus size={18} />
          {showAddForm ? 'Cancel' : 'Add Milestone'}
        </button>
      </div>

      {showAddForm && (
        <form className="card" onSubmit={handleSubmit} style={{ animation: 'slideDown 0.25s ease' }}>
          <h3 style={{ marginBottom: '1.25rem', fontWeight: 700 }}>Add Clinical Milestone</h3>
          
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Event Date</label>
              <input 
                type="date" 
                className="form-input" 
                value={eventDate} 
                onChange={(e) => setEventDate(e.target.value)} 
                required 
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Event Type</label>
              <select 
                className="form-select" 
                value={eventType} 
                onChange={(e) => setEventType(e.target.value)}
              >
                <option value="Diagnosis">Diagnosis / Biopsy</option>
                <option value="Surgery">Surgical Resection</option>
                <option value="Radiation">Radiation Therapy</option>
                <option value="Scan">Surveillance Scan</option>
                <option value="Medication Change">Medication Adjustment</option>
                <option value="Other">Other Milestone</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Title</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g., Submandibular gland excision" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              required 
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description / Summary Findings</label>
            <textarea 
              className="form-textarea" 
              rows={3} 
              placeholder="Provide a general description of the findings or medical decisions..." 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
            />
          </div>

          {/* Dynamic details fields based on event type */}
          {eventType === 'Surgery' && (
            <div className="details-grid" style={{ marginBottom: '1.25rem', padding: '1rem', border: '1px dashed var(--border-color)' }}>
              <div className="form-group">
                <label className="form-label">Surgical Margin Status</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g., Close (<1mm) or Negative (>5mm)" 
                  value={marginStatus} 
                  onChange={(e) => setMarginStatus(e.target.value)} 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Lymph Nodes Status</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g., 0/14 (negative) or 1/14 (positive)" 
                  value={lymphNodes} 
                  onChange={(e) => setLymphNodes(e.target.value)} 
                />
              </div>
            </div>
          )}

          {eventType === 'Radiation' && (
            <div className="details-grid" style={{ marginBottom: '1.25rem', padding: '1rem', border: '1px dashed var(--border-color)' }}>
              <div className="form-group">
                <label className="form-label">Radiation Dose (cGy)</label>
                <input 
                  type="number" 
                  className="form-input" 
                  placeholder="e.g., 6000 (60 Gy)" 
                  value={radiationDose} 
                  onChange={(e) => setRadiationDose(e.target.value)} 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Fractions completed</label>
                <input 
                  type="number" 
                  className="form-input" 
                  placeholder="e.g., 30" 
                  value={radiationFractions} 
                  onChange={(e) => setRadiationFractions(e.target.value)} 
                />
              </div>
            </div>
          )}

          {eventType === 'Scan' && (
            <div className="details-grid" style={{ marginBottom: '1.25rem', padding: '1rem', border: '1px dashed var(--border-color)' }}>
              <div className="form-group">
                <label className="form-label">Key Radiographic Findings</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g., Stable bed, no recurrences or lung nodules" 
                  value={scanFindings} 
                  onChange={(e) => setScanFindings(e.target.value)} 
                />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(false)}>
              Cancel
            </button>
            <button type="submit" className="btn">
              Save Milestone
            </button>
          </div>
        </form>
      )}

      <div className="timeline-container">
        <div className="timeline-line"></div>
        
        {filteredEvents.length > 0 ? (
          filteredEvents.map((event) => {
            const isExpanded = expandedEventId === event.id;
            const detailsKeys = event.details ? Object.keys(event.details) : [];
            
            return (
              <div 
                key={event.id} 
                className="timeline-event-wrapper"
              >
                {/* Node icon with glowing ring based on category */}
                <div className={`timeline-node ${getEventNodeClass(event.event_type)}`}>
                  {getEventIcon(event.event_type)}
                </div>
                
                {/* Main Card */}
                <div 
                  className="card timeline-card"
                  onClick={() => toggleExpand(event.id)}
                >
                  <div className="timeline-event-header">
                    <div>
                      <div className="event-meta">
                        <span className="event-date">
                          {new Date(event.event_date).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </span>
                        <span className={getEventBadgeClass(event.event_type)}>
                          {event.event_type}
                        </span>
                      </div>
                      <h3 className="timeline-event-title" style={{ marginTop: '0.35rem' }}>{event.title}</h3>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '0.35rem', borderRadius: '8px' }}
                        onClick={(e) => handleDelete(event.id, e)}
                        title="Delete Milestone"
                      >
                        <Trash2 size={15} style={{ color: 'var(--accent-red)' }} />
                      </button>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '0.35rem', borderRadius: '8px' }}
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>
                  
                  <p className="timeline-event-desc">{event.description}</p>
                  
                  {/* Detailed Pane if expanded */}
                  {isExpanded && detailsKeys.length > 0 && (
                    <div className="timeline-details-pane">
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>Specific Findings / Data Metrics</h4>
                      <div className="details-grid">
                        {detailsKeys.map(key => {
                          const val = event.details?.[key];
                          // Format key to a readable name
                          const formattedKey = key
                            .split('_')
                            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                            .join(' ');
                            
                          return (
                            <div key={key} className="details-item">
                              <span className="details-label">{formattedKey}</span>
                              {key === 'slice_image' && val ? (
                                <a 
                                  href={`${backendUrl}${val}`} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="citation-link" 
                                  style={{ marginTop: '0.2rem' }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  View Scan Image Slice
                                </a>
                              ) : (
                                <span className="details-value">
                                  {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            No information input yet.
          </div>
        )}
      </div>
    </div>
  );
};
