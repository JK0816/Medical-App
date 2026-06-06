import { Calendar } from 'lucide-react';
import React, { useState } from 'react';
import { BarChart2, Plus } from 'lucide-react';
import type {  SymptomLog  } from '../types';

interface SymptomsProps {
  symptoms: SymptomLog[];
  fetchSymptoms: () => void;
  backendUrl: string;
}

export const Symptoms: React.FC<SymptomsProps> = ({ 
  symptoms, 
  fetchSymptoms, 
  backendUrl 
}) => {
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [pain, setPain] = useState(3);
  const [dryMouth, setDryMouth] = useState(5);
  const [swallowing, setSwallowing] = useState(2);
  const [numbness, setNumbness] = useState(3);
  const [fatigue, setFatigue] = useState(4);
  const [notes, setNotes] = useState('');

  // Active chart toggles — persisted
  const [visibleSymptoms, setVisibleSymptoms] = useState(() => {
    try {
      const saved = localStorage.getItem('acc_symptomToggles');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      pain: true,
      dryMouth: true,
      swallowing: false,
      numbness: false,
      fatigue: true
    };
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const resp = await fetch(`${backendUrl}/api/symptoms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          pain,
          dry_mouth: dryMouth,
          swallowing_difficulty: swallowing,
          facial_numbness: numbness,
          fatigue,
          notes: notes || null
        })
      });
      if (resp.ok) {
        fetchSymptoms();
        setNotes('');
        setShowForm(false);
      }
    } catch (err) {
      console.error("Failed to log symptoms:", err);
    }
  };

  // Persist chart toggles
  React.useEffect(() => {
    try {
      localStorage.setItem('acc_symptomToggles', JSON.stringify(visibleSymptoms));
    } catch {}
  }, [visibleSymptoms]);

  // SVG Chart Geometry Constants
  const width = 680;
  const height = 240;
  const paddingX = 50;
  const paddingY = 30;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  // Filter logs for the chart (take up to the last 10 entries, sorted chronologically)
  const chartLogs = [...symptoms]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-10);

  // Map symptom values to SVG Coordinates
  const getCoordinates = (logs: SymptomLog[], valKey: keyof SymptomLog) => {
    if (logs.length < 2) return '';
    return logs.map((log, index) => {
      const x = paddingX + (index / (logs.length - 1)) * chartWidth;
      const val = Number(log[valKey]) || 1;
      // Map 1-10 to Y space: 10 is at the top (symptom severity high), 1 is at the bottom
      const y = paddingY + chartHeight - ((val - 1) / 9) * chartHeight;
      return `${x},${y}`;
    }).join(' ');
  };

  const toggleSymptomVisibility = (key: keyof typeof visibleSymptoms) => {
    setVisibleSymptoms((prev: typeof visibleSymptoms) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Symptom & Side-Effect Diary</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Track radiation-induced dry mouth (xerostomia), facial nerve neuropathy, swallowing difficulties, and general fatigue.</p>
        </div>
        <button className="btn" onClick={() => setShowForm(!showForm)}>
          <Plus size={18} />
          {showForm ? 'Cancel' : 'Log Daily Symptoms'}
        </button>
      </div>

      {showForm && (
        <form className="card" onSubmit={handleSubmit} style={{ animation: 'slideDown 0.25s ease' }}>
          <h3 style={{ marginBottom: '1.25rem', fontWeight: 700 }}>Daily Symptom Entry</h3>
          
          <div className="form-group" style={{ maxWidth: '300px' }}>
            <label className="form-label">Entry Date</label>
            <input 
              type="date" 
              className="form-input" 
              value={date} 
              onChange={(e) => setDate(e.target.value)} 
              required 
            />
          </div>

          <div className="symptom-tracking-layout">
            <div className="symptom-sliders">
              <div className="slider-group">
                <div className="slider-header">
                  <span className="slider-name">Neuropathic Jaw/Cheek Pain</span>
                  <span className="slider-val">{pain}/10</span>
                </div>
                <input 
                  type="range" min="1" max="10" 
                  className="range-input" 
                  value={pain} 
                  onChange={(e) => setPain(parseInt(e.target.value))} 
                />
              </div>

              <div className="slider-group">
                <div className="slider-header">
                  <span className="slider-name">Dry Mouth (Xerostomia)</span>
                  <span className="slider-val">{dryMouth}/10</span>
                </div>
                <input 
                  type="range" min="1" max="10" 
                  className="range-input" 
                  value={dryMouth} 
                  onChange={(e) => setDryMouth(parseInt(e.target.value))} 
                />
              </div>

              <div className="slider-group">
                <div className="slider-header">
                  <span className="slider-name">Swallowing Difficulty (Dysphagia)</span>
                  <span className="slider-val">{swallowing}/10</span>
                </div>
                <input 
                  type="range" min="1" max="10" 
                  className="range-input" 
                  value={swallowing} 
                  onChange={(e) => setSwallowing(parseInt(e.target.value))} 
                />
              </div>

              <div className="slider-group">
                <div className="slider-header">
                  <span className="slider-name">Facial Muscle Numbness / Weakness</span>
                  <span className="slider-val">{numbness}/10</span>
                </div>
                <input 
                  type="range" min="1" max="10" 
                  className="range-input" 
                  value={numbness} 
                  onChange={(e) => setNumbness(parseInt(e.target.value))} 
                />
              </div>

              <div className="slider-group">
                <div className="slider-header">
                  <span className="slider-name">General Fatigue</span>
                  <span className="slider-val">{fatigue}/10</span>
                </div>
                <input 
                  type="range" min="1" max="10" 
                  className="range-input" 
                  value={fatigue} 
                  onChange={(e) => setFatigue(parseInt(e.target.value))} 
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group" style={{ height: '100%' }}>
                <label className="form-label">Clinical Notes / Context</label>
                <textarea 
                  className="form-textarea" 
                  style={{ height: '100%', minHeight: '150px' }}
                  placeholder="e.g., Felt sharp jaw twinges in evening. Took extra dry mouth gel before bed. Speech slightly slurred after talking for long..." 
                  value={notes} 
                  onChange={(e) => setNotes(e.target.value)} 
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
              Cancel
            </button>
            <button type="submit" className="btn">
              Save Log Entry
            </button>
          </div>
        </form>
      )}

      {/* SVG Chart Dashboard Widget */}
      <div className="card">
        <div className="widget-header">
          <div className="widget-title">
            <BarChart2 />
            <span>Symptom Severity Over Time (Surveillance Trends)</span>
          </div>
        </div>

        {chartLogs.length >= 2 ? (
          <div className="symptom-chart-container">
            {/* Legend Toggles */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              <button 
                className={`filter-chip ${visibleSymptoms.pain ? 'active' : ''}`}
                style={visibleSymptoms.pain ? { background: '#ff3366', color: '#fff', borderColor: '#ff3366' } : {}}
                onClick={() => toggleSymptomVisibility('pain')}
              >
                Pain (Jaw/Cheek)
              </button>
              <button 
                className={`filter-chip ${visibleSymptoms.dryMouth ? 'active' : ''}`}
                style={visibleSymptoms.dryMouth ? { background: '#00e5ff', color: '#000', borderColor: '#00e5ff' } : {}}
                onClick={() => toggleSymptomVisibility('dryMouth')}
              >
                Dry Mouth (Xerostomia)
              </button>
              <button 
                className={`filter-chip ${visibleSymptoms.swallowing ? 'active' : ''}`}
                style={visibleSymptoms.swallowing ? { background: '#ffb703', color: '#000', borderColor: '#ffb703' } : {}}
                onClick={() => toggleSymptomVisibility('swallowing')}
              >
                Swallowing (Dysphagia)
              </button>
              <button 
                className={`filter-chip ${visibleSymptoms.numbness ? 'active' : ''}`}
                style={visibleSymptoms.numbness ? { background: '#4facfe', color: '#fff', borderColor: '#4facfe' } : {}}
                onClick={() => toggleSymptomVisibility('numbness')}
              >
                Facial Numbness
              </button>
              <button 
                className={`filter-chip ${visibleSymptoms.fatigue ? 'active' : ''}`}
                style={visibleSymptoms.fatigue ? { background: '#9d4edd', color: '#fff', borderColor: '#9d4edd' } : {}}
                onClick={() => toggleSymptomVisibility('fatigue')}
              >
                Fatigue
              </button>
            </div>

            {/* Custom SVG Render */}
            <svg className="symptom-svg-chart" viewBox={`0 0 ${width} ${height}`}>
              <defs>
                <linearGradient id="grid-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="rgba(0,0,0,0.02)" />
                  <stop offset="100%" stopColor="rgba(0,0,0,0)" />
                </linearGradient>
              </defs>

              {/* Grid Background */}
              <rect x={paddingX} y={paddingY} width={chartWidth} height={chartHeight} fill="url(#grid-grad)" />

              {/* Horizontal Gridlines */}
              {[1, 3, 5, 7, 10].map(level => {
                const y = paddingY + chartHeight - ((level - 1) / 9) * chartHeight;
                return (
                  <g key={level}>
                    <line 
                      x1={paddingX} 
                      y1={y} 
                      x2={width - paddingX} 
                      y2={y} 
                      stroke="rgba(0,0,0,0.08)" 
                      strokeDasharray="4,4" 
                    />
                    <text 
                      x={paddingX - 12} 
                      y={y + 4} 
                      fill="var(--text-muted)" 
                      fontSize="10" 
                      textAnchor="end"
                      fontFamily="monospace"
                    >
                      {level}
                    </text>
                  </g>
                );
              })}

              {/* X Axis Date Labels */}
              {chartLogs.map((log, index) => {
                const x = paddingX + (index / (chartLogs.length - 1)) * chartWidth;
                const formattedDate = new Date(log.date).toLocaleDateString([], { month: 'short', day: 'numeric' });
                return (
                  <g key={log.id}>
                    <line 
                      x1={x} 
                      y1={paddingY + chartHeight} 
                      x2={x} 
                      y2={paddingY + chartHeight + 5} 
                      stroke="rgba(0,0,0,0.15)" 
                    />
                    <text 
                      x={x} 
                      y={paddingY + chartHeight + 18} 
                      fill="var(--text-muted)" 
                      fontSize="9" 
                      textAnchor="middle"
                    >
                      {formattedDate}
                    </text>
                  </g>
                );
              })}

              {/* Draw Lines */}
              {visibleSymptoms.pain && (
                <polyline 
                  fill="none" 
                  stroke="#ff3366" 
                  strokeWidth="2.5" 
                  points={getCoordinates(chartLogs, 'pain')} 
                />
              )}
              {visibleSymptoms.dryMouth && (
                <polyline 
                  fill="none" 
                  stroke="#00e5ff" 
                  strokeWidth="2.5" 
                  points={getCoordinates(chartLogs, 'dry_mouth')} 
                />
              )}
              {visibleSymptoms.swallowing && (
                <polyline 
                  fill="none" 
                  stroke="#ffb703" 
                  strokeWidth="2.5" 
                  points={getCoordinates(chartLogs, 'swallowing_difficulty')} 
                />
              )}
              {visibleSymptoms.numbness && (
                <polyline 
                  fill="none" 
                  stroke="#4facfe" 
                  strokeWidth="2.5" 
                  points={getCoordinates(chartLogs, 'facial_numbness')} 
                />
              )}
              {visibleSymptoms.fatigue && (
                <polyline 
                  fill="none" 
                  stroke="#9d4edd" 
                  strokeWidth="2.5" 
                  points={getCoordinates(chartLogs, 'fatigue')} 
                />
              )}

              {/* Data points (dots) */}
              {chartLogs.length >= 2 && chartLogs.map((log, index) => {
                const x = paddingX + (index / (chartLogs.length - 1)) * chartWidth;
                return (
                  <g key={log.id}>
                    {visibleSymptoms.pain && (
                      <circle cx={x} cy={paddingY + chartHeight - ((log.pain - 1) / 9) * chartHeight} r="3.5" fill="#ff3366" />
                    )}
                    {visibleSymptoms.dryMouth && (
                      <circle cx={x} cy={paddingY + chartHeight - ((log.dry_mouth - 1) / 9) * chartHeight} r="3.5" fill="#00e5ff" />
                    )}
                    {visibleSymptoms.swallowing && (
                      <circle cx={x} cy={paddingY + chartHeight - ((log.swallowing_difficulty - 1) / 9) * chartHeight} r="3.5" fill="#ffb703" />
                    )}
                    {visibleSymptoms.numbness && (
                      <circle cx={x} cy={paddingY + chartHeight - ((log.facial_numbness - 1) / 9) * chartHeight} r="3.5" fill="#4facfe" />
                    )}
                    {visibleSymptoms.fatigue && (
                      <circle cx={x} cy={paddingY + chartHeight - ((log.fatigue - 1) / 9) * chartHeight} r="3.5" fill="#9d4edd" />
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        ) : (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No information input yet. Need at least 2 logged symptom entries to show progression trends.
          </div>
        )}
      </div>

      {/* Historical Logs List */}
      <div>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Symptom Log History</h3>
        
        {symptoms.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[...symptoms]
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map(log => (
                <div key={log.id} className="card" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-cyan)', fontWeight: 600, fontSize: '0.95rem' }}>
                        <Calendar size={15} />
                        <span>{new Date(log.date).toLocaleDateString([], { dateStyle: 'long' })}</span>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', marginTop: '0.75rem', fontSize: '0.85rem' }}>
                        <div>Pain: <strong style={{ color: log.pain > 4 ? 'var(--accent-red)' : 'var(--text-primary)' }}>{log.pain}</strong></div>
                        <div>Dry Mouth: <strong style={{ color: log.dry_mouth > 5 ? 'var(--accent-red)' : 'var(--text-primary)' }}>{log.dry_mouth}</strong></div>
                        <div>Swallowing: <strong>{log.swallowing_difficulty}</strong></div>
                        <div>Numbness: <strong>{log.facial_numbness}</strong></div>
                        <div>Fatigue: <strong>{log.fatigue}</strong></div>
                      </div>
                      
                      {log.notes && (
                        <p style={{ marginTop: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.4 }}>
                          {log.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No information input yet. Click "Log Daily Symptoms" above to record today's metrics.
          </div>
        )}
      </div>
    </div>
  );
};
