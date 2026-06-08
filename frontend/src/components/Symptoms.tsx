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
  const [painLocation, setPainLocation] = useState('');
  const [fatigue, setFatigue] = useState(4);
  const [nausea, setNausea] = useState(1);
  const [fever, setFever] = useState(1);
  const [constipation, setConstipation] = useState(1);
  const [other, setOther] = useState(1);
  const [otherDescription, setOtherDescription] = useState('');
  const [notes, setNotes] = useState('');

  // Active chart toggles — persisted
  const [visibleSymptoms, setVisibleSymptoms] = useState(() => {
    try {
      const saved = localStorage.getItem('acc_symptomToggles');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      pain: true,
      fatigue: true,
      nausea: true,
      fever: false,
      constipation: false,
      other: false
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
          pain_location: painLocation || null,
          fatigue,
          nausea,
          fever,
          constipation,
          other: other || null,
          other_description: otherDescription || null,
          notes: notes || null
        })
      });
      if (resp.ok) {
        fetchSymptoms();
        setNotes('');
        setPainLocation('');
        setOtherDescription('');
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
    <div className="flex-col-large">
      <div className="flex-row-center-between">
        <div>
          <h2 className="title-medium">Symptom & Side-Effect Diary</h2>
          <p className="text-secondary-small">Track pain (with location), fatigue, nausea, fever, constipation, and other side-effects or symptoms.</p>
        </div>
        <button className="btn" onClick={() => setShowForm(!showForm)}>
          <Plus size={18} />
          {showForm ? 'Cancel' : 'Log Daily Symptoms'}
        </button>
      </div>

      {showForm && (
        <form className="card animate-slide-down" onSubmit={handleSubmit}>
          <h3 className="title-medium margin-bottom-1rem">Daily Symptom Entry</h3>
          <div className="form-group width-300px">
            <label htmlFor="symptom-date" className="form-label">Entry Date</label>
            <input 
              id="symptom-date"
              type="date" 
              className="form-input" 
              value={date} 
              onChange={(e) => setDate(e.target.value)} 
              required 
              title="Entry Date"
            />
          </div>

          <div className="symptom-tracking-layout">
            <div className="symptom-sliders">
              <div className="slider-group">
                <div className="slider-header">
                  <label htmlFor="symptom-pain" className="slider-name">Pain Level</label>
                  <span className="slider-val">{pain}/10</span>
                </div>
                <input 
                  id="symptom-pain"
                  type="range" min="1" max="10" 
                  className="range-input" 
                  value={pain} 
                  onChange={(e) => setPain(parseInt(e.target.value))} 
                  title="Pain Level"
                />
              </div>

              <div className="form-group">
                <label htmlFor="symptom-pain-location" className="form-label">Pain Location</label>
                <input 
                  id="symptom-pain-location"
                  type="text" 
                  className="form-input" 
                  placeholder="e.g., Right jaw, cheek, neck" 
                  value={painLocation} 
                  onChange={(e) => setPainLocation(e.target.value)} 
                  title="Pain Location"
                />
              </div>

              <div className="slider-group">
                <div className="slider-header">
                  <label htmlFor="symptom-fatigue" className="slider-name">Fatigue</label>
                  <span className="slider-val">{fatigue}/10</span>
                </div>
                <input 
                  id="symptom-fatigue"
                  type="range" min="1" max="10" 
                  className="range-input" 
                  value={fatigue} 
                  onChange={(e) => setFatigue(parseInt(e.target.value))} 
                  title="Fatigue"
                />
              </div>

              <div className="slider-group">
                <div className="slider-header">
                  <label htmlFor="symptom-nausea" className="slider-name">Nausea</label>
                  <span className="slider-val">{nausea}/10</span>
                </div>
                <input 
                  id="symptom-nausea"
                  type="range" min="1" max="10" 
                  className="range-input" 
                  value={nausea} 
                  onChange={(e) => setNausea(parseInt(e.target.value))} 
                  title="Nausea"
                />
              </div>

              <div className="slider-group">
                <div className="slider-header">
                  <label htmlFor="symptom-fever" className="slider-name">Fever</label>
                  <span className="slider-val">{fever}/10</span>
                </div>
                <input 
                  id="symptom-fever"
                  type="range" min="1" max="10" 
                  className="range-input" 
                  value={fever} 
                  onChange={(e) => setFever(parseInt(e.target.value))} 
                  title="Fever"
                />
              </div>

              <div className="slider-group">
                <div className="slider-header">
                  <label htmlFor="symptom-constipation" className="slider-name">Constipation</label>
                  <span className="slider-val">{constipation}/10</span>
                </div>
                <input 
                  id="symptom-constipation"
                  type="range" min="1" max="10" 
                  className="range-input" 
                  value={constipation} 
                  onChange={(e) => setConstipation(parseInt(e.target.value))} 
                  title="Constipation"
                />
              </div>

              <div className="slider-group">
                <div className="slider-header">
                  <label htmlFor="symptom-other" className="slider-name">Other Symptom Severity</label>
                  <span className="slider-val">{other}/10</span>
                </div>
                <input 
                  id="symptom-other"
                  type="range" min="1" max="10" 
                  className="range-input" 
                  value={other} 
                  onChange={(e) => setOther(parseInt(e.target.value))} 
                  title="Other Symptom Severity"
                />
              </div>

              <div className="form-group">
                <label htmlFor="symptom-other-description" className="form-label">Other Symptom Description</label>
                <input 
                  id="symptom-other-description"
                  type="text" 
                  className="form-input" 
                  placeholder="e.g., Dry mouth, difficulty swallowing" 
                  value={otherDescription} 
                  onChange={(e) => setOtherDescription(e.target.value)} 
                  title="Other Symptom Description"
                />
              </div>
            </div>

            <div className="form-layout-row">
              <div className="form-group height-100">
                <label htmlFor="symptom-notes" className="form-label">Clinical Notes / Context</label>
                <textarea 
                  id="symptom-notes"
                  className="form-textarea textarea-context" 
                  placeholder="e.g., Felt mild twinges in the jaw. Stretched facial muscles..." 
                  value={notes} 
                  onChange={(e) => setNotes(e.target.value)} 
                  title="Clinical Notes"
                />
              </div>
            </div>
          </div>

          <div className="form-actions">
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
            <div className="flex-row-wrap-gap-1rem margin-bottom-05rem">
              <button 
                className={`filter-chip filter-chip-pain ${visibleSymptoms.pain ? 'active' : ''}`}
                onClick={() => toggleSymptomVisibility('pain')}
              >
                Pain
              </button>
              <button 
                className={`filter-chip filter-chip-fatigue ${visibleSymptoms.fatigue ? 'active' : ''}`}
                onClick={() => toggleSymptomVisibility('fatigue')}
              >
                Fatigue
              </button>
              <button 
                className={`filter-chip filter-chip-nausea ${visibleSymptoms.nausea ? 'active' : ''}`}
                onClick={() => toggleSymptomVisibility('nausea')}
              >
                Nausea
              </button>
              <button 
                className={`filter-chip filter-chip-fever ${visibleSymptoms.fever ? 'active' : ''}`}
                onClick={() => toggleSymptomVisibility('fever')}
              >
                Fever
              </button>
              <button 
                className={`filter-chip filter-chip-constipation ${visibleSymptoms.constipation ? 'active' : ''}`}
                onClick={() => toggleSymptomVisibility('constipation')}
              >
                Constipation
              </button>
              <button 
                className={`filter-chip filter-chip-other ${visibleSymptoms.other ? 'active' : ''}`}
                onClick={() => toggleSymptomVisibility('other')}
              >
                Other
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
              {visibleSymptoms.fatigue && (
                <polyline 
                  fill="none" 
                  stroke="#9d4edd" 
                  strokeWidth="2.5" 
                  points={getCoordinates(chartLogs, 'fatigue')} 
                />
              )}
              {visibleSymptoms.nausea && (
                <polyline 
                  fill="none" 
                  stroke="#00cbd6" 
                  strokeWidth="2.5" 
                  points={getCoordinates(chartLogs, 'nausea')} 
                />
              )}
              {visibleSymptoms.fever && (
                <polyline 
                  fill="none" 
                  stroke="#ff5400" 
                  strokeWidth="2.5" 
                  points={getCoordinates(chartLogs, 'fever')} 
                />
              )}
              {visibleSymptoms.constipation && (
                <polyline 
                  fill="none" 
                  stroke="#d97706" 
                  strokeWidth="2.5" 
                  points={getCoordinates(chartLogs, 'constipation')} 
                />
              )}
              {visibleSymptoms.other && (
                <polyline 
                  fill="none" 
                  stroke="#64748b" 
                  strokeWidth="2.5" 
                  points={getCoordinates(chartLogs, 'other')} 
                />
              )}

              {/* Data points (dots) */}
              {chartLogs.length >= 2 && chartLogs.map((log, index) => {
                const x = paddingX + (index / (chartLogs.length - 1)) * chartWidth;
                return (
                  <g key={log.id}>
                    {visibleSymptoms.pain && log.pain !== undefined && log.pain !== null && (
                      <circle cx={x} cy={paddingY + chartHeight - (((log.pain ?? 1) - 1) / 9) * chartHeight} r="3.5" fill="#ff3366" />
                    )}
                    {visibleSymptoms.fatigue && log.fatigue !== undefined && log.fatigue !== null && (
                      <circle cx={x} cy={paddingY + chartHeight - (((log.fatigue ?? 1) - 1) / 9) * chartHeight} r="3.5" fill="#9d4edd" />
                    )}
                    {visibleSymptoms.nausea && log.nausea !== undefined && log.nausea !== null && (
                      <circle cx={x} cy={paddingY + chartHeight - (((log.nausea ?? 1) - 1) / 9) * chartHeight} r="3.5" fill="#00cbd6" />
                    )}
                    {visibleSymptoms.fever && log.fever !== undefined && log.fever !== null && (
                      <circle cx={x} cy={paddingY + chartHeight - (((log.fever ?? 1) - 1) / 9) * chartHeight} r="3.5" fill="#ff5400" />
                    )}
                    {visibleSymptoms.constipation && log.constipation !== undefined && log.constipation !== null && (
                      <circle cx={x} cy={paddingY + chartHeight - (((log.constipation ?? 1) - 1) / 9) * chartHeight} r="3.5" fill="#d97706" />
                    )}
                    {visibleSymptoms.other && log.other !== undefined && log.other !== null && (
                      <circle cx={x} cy={paddingY + chartHeight - (((log.other ?? 1) - 1) / 9) * chartHeight} r="3.5" fill="#64748b" />
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        ) : (
          <div className="center-text-secondary">
            No information input yet. Need at least 2 logged symptom entries to show progression trends.
          </div>
        )}
      </div>

      {/* Historical Logs List */}
      <div>
        <h3 className="font-size-1-2-margin-bottom-1rem">Symptom Log History</h3>
        
        {symptoms.length > 0 ? (
          <div className="flex-col-small">
            {[...symptoms]
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map(log => (
                <div key={log.id} className="card card-padding-1-25">
                  <div className="flex-row-center-between-wrap">
                    <div>
                      <div className="symptom-history-badge">
                        <Calendar size={15} />
                        <span>{new Date(log.date).toLocaleDateString([], { dateStyle: 'long' })}</span>
                      </div>
                      
                      <div className="symptom-history-values">
                        <div>Pain: <strong className={(log.pain ?? 0) > 4 ? 'score-elevated' : 'score-stable'}>{log.pain ?? 1}/10</strong>{log.pain_location ? ` (${log.pain_location})` : ''}</div>
                        <div>Fatigue: <strong>{log.fatigue ?? 1}/10</strong></div>
                        <div>Nausea: <strong>{log.nausea ?? 1}/10</strong></div>
                        <div>Fever: <strong>{log.fever ?? 1}/10</strong></div>
                        <div>Constipation: <strong>{log.constipation ?? 1}/10</strong></div>
                        {log.other !== undefined && log.other !== null && (
                          <div>Other: <strong>{log.other}/10</strong>{log.other_description ? ` (${log.other_description})` : ''}</div>
                        )}
                      </div>
                      
                      {log.notes && (
                        <p className="symptom-notes">
                          {log.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <div className="card center-text-secondary">
            No information input yet. Click "Log Daily Symptoms" above to record today's metrics.
          </div>
        )}
      </div>
    </div>
  );
};
