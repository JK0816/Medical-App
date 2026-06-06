import { ShieldAlert } from 'lucide-react';
import React, { useState, useRef } from 'react';
import { 
   
  Upload, 
  Settings, 
  Eye, 
  Download,
  CheckCircle,
  HelpCircle
} from 'lucide-react';

interface ScanViewerProps {
  backendUrl: string;
  onScanUploaded: () => void; // Refresh global timeline on successful upload
}

interface DicomResult {
  patient_name: string;
  patient_id: string;
  patient_sex: string;
  patient_dob: string;
  study_date: string;
  study_time: string;
  modality: string;
  body_part: string;
  study_description: string;
  series_description: string;
  manufacturer: string;
  slice_thickness: string;
  slice_image_url: string;
  interpretation?: {
    primary_site_findings: string;
    mass_characteristics?: {
      size_mm: string;
      margin_status: string;
      contrast_enhancement: string;
    };
    pni_risk_assessment: string;
    nodal_metastasis_findings: string;
    clinical_impression: string;
    recommendations: string[];
    error?: string;
  };
}

export const ScanViewer: React.FC<ScanViewerProps> = ({ backendUrl, onScanUploaded }) => {
  const [loading, setLoading] = useState(false);
  const [scanData, setScanData] = useState<DicomResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // PACS Viewer adjustments
  const [zoom, setZoom] = useState(1);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.dcm') && !file.name.toLowerCase().endsWith('.dicom')) {
      setError("Please select a valid DICOM file (.dcm).");
      return;
    }

    setLoading(true);
    setError(null);
    setScanData(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const resp = await fetch(`${backendUrl}/api/dicom/upload`, {
        method: 'POST',
        body: formData
      });

      if (resp.ok) {
        const data: DicomResult = await resp.json();
        setScanData(data);
        onScanUploaded(); // Refresh history
      } else {
        const errText = await resp.json();
        setError(errText.detail || "Failed to process DICOM file.");
      }
    } catch (err) {
      console.error(err);
      setError("Network error occurred during scan upload.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleUpload(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleUpload(files[0]);
    }
  };

  const resetFilters = () => {
    setZoom(1);
    setBrightness(100);
    setContrast(100);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>DICOM Image Workstation</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Upload medical DICOM scans (.dcm) for slice reconstruction and multimodal clinical AI interpretation.</p>
        </div>
        

      </div>

      {error && (
        <div className="card" style={{ borderLeft: '4px solid var(--accent-red)', background: 'rgba(255, 51, 102, 0.05)', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ShieldAlert style={{ color: 'var(--accent-red)' }} />
          <span style={{ fontSize: '0.95rem' }}>{error}</span>
        </div>
      )}

      {/* Main Workstation Layout */}
      <div className="scan-viewer-layout">
        {/* PACS Viewport Container */}
        <div className="dicom-viewport-container">
          <div className="card" style={{ padding: '1rem' }}>
            <div className="dicom-screen">
              {loading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', zIndex: 10 }}>
                  <div className="typing-indicator" style={{ background: 'transparent', border: 'none' }}>
                    <div className="typing-dot" style={{ backgroundColor: 'var(--accent-cyan)' }}></div>
                    <div className="typing-dot" style={{ backgroundColor: 'var(--accent-cyan)' }}></div>
                    <div className="typing-dot" style={{ backgroundColor: 'var(--accent-cyan)' }}></div>
                  </div>
                  <div style={{ color: 'var(--accent-cyan)', fontWeight: 600, fontSize: '0.95rem', letterSpacing: '0.5px' }}>
                    RECONSTRUCTING SLICES & SCANNING ANATOMY...
                  </div>
                  {/* Glowing green line sliding down */}
                  <div style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0,
                    height: '2px',
                    background: 'var(--accent-cyan)',
                    boxShadow: '0 0 10px var(--accent-cyan)',
                    animation: 'slideDown 2s infinite linear'
                  }} />
                </div>
              )}

              {scanData ? (
                <>
                  <div className="dicom-grid-overlay"></div>
                  {scanData.slice_image_url ? (
                    <img 
                      src={`${backendUrl}${scanData.slice_image_url}`} 
                      alt="DICOM Slice" 
                      className="dicom-image"
                      style={{
                        transform: `scale(${zoom})`,
                        filter: `brightness(${brightness}%) contrast(${contrast}%)`,
                        transition: 'filter 0.05s ease'
                      }}
                    />
                  ) : (
                    <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
                      <p style={{ fontSize: '1rem', fontWeight: 600 }}>No Pixel Data Available</p>
                      <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>This DICOM file does not contain renderable pixel data. Metadata has been extracted successfully.</p>
                    </div>
                  )}
                  
                  {/* HUD Corner Text */}
                  <div className="dicom-corners">
                    <div className="corner-row">
                      <div>
                        ID: {scanData.patient_id}<br />
                        NAME: {scanData.patient_name}<br />
                        SEX: {scanData.patient_sex}
                      </div>
                      <div>
                        STUDY: {scanData.study_date}<br />
                        TIME: {scanData.study_time}<br />
                        MOD: {scanData.modality}
                      </div>
                    </div>
                    <div className="corner-row">
                      <div>
                        THICK: {scanData.slice_thickness} mm<br />
                        BODY PART: {scanData.body_part}
                      </div>
                      <div>
                        WW: 300 / WC: 50<br />
                        ZOOM: {zoom.toFixed(1)}x<br />
                        SC: CT Image Storage
                      </div>
                    </div>
                  </div>
                </>
              ) : !loading ? (
                <div 
                  className="dicom-empty-state"
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={triggerFileInput}
                >
                  <Upload size={48} />
                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Drag & Drop DICOM File Here</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>or click anywhere to browse local files (Supports `.dcm` files)</p>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                    accept=".dcm,.dicom"
                  />

                </div>
              ) : null}
            </div>

            {/* Viewer Controls */}
            {scanData && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr) auto', gap: '1rem', marginTop: '1rem', padding: '0.5rem', alignItems: 'center' }}>
                <div className="slider-group">
                  <div className="slider-header" style={{ fontSize: '0.75rem' }}>
                    <span className="slider-name">Zoom ({zoom.toFixed(1)}x)</span>
                  </div>
                  <input 
                    type="range" min="1" max="3" step="0.1"
                    className="range-input" 
                    value={zoom} 
                    onChange={(e) => setZoom(parseFloat(e.target.value))} 
                  />
                </div>

                <div className="slider-group">
                  <div className="slider-header" style={{ fontSize: '0.75rem' }}>
                    <span className="slider-name">Brightness ({brightness}%)</span>
                  </div>
                  <input 
                    type="range" min="50" max="200" 
                    className="range-input" 
                    value={brightness} 
                    onChange={(e) => setBrightness(parseInt(e.target.value))} 
                  />
                </div>

                <div className="slider-group">
                  <div className="slider-header" style={{ fontSize: '0.75rem' }}>
                    <span className="slider-name">Contrast ({contrast}%)</span>
                  </div>
                  <input 
                    type="range" min="50" max="200" 
                    className="range-input" 
                    value={contrast} 
                    onChange={(e) => setContrast(parseInt(e.target.value))} 
                  />
                </div>
                
                <button className="btn btn-secondary" onClick={resetFilters} style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}>
                  Reset Filters
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Info & AI Analysis Panel */}
        <div className="dicom-metadata-panel">
          {/* Metadata Card */}
          <div className="card">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Settings size={18} style={{ color: 'var(--accent-cyan)' }} />
              DICOM Header Tags
            </h3>
            
            {scanData ? (
              <table className="metadata-table">
                <tbody>
                  <tr>
                    <td className="metadata-key">Patient Name</td>
                    <td className="metadata-val">{scanData.patient_name}</td>
                  </tr>
                  <tr>
                    <td className="metadata-key">Patient ID</td>
                    <td className="metadata-val">{scanData.patient_id}</td>
                  </tr>
                  <tr>
                    <td className="metadata-key">Birth Date</td>
                    <td className="metadata-val">{scanData.patient_dob}</td>
                  </tr>
                  <tr>
                    <td className="metadata-key">Study Date</td>
                    <td className="metadata-val">{scanData.study_date}</td>
                  </tr>
                  <tr>
                    <td className="metadata-key">Modality</td>
                    <td className="metadata-val">{scanData.modality}</td>
                  </tr>
                  <tr>
                    <td className="metadata-key">Body Part</td>
                    <td className="metadata-val">{scanData.body_part}</td>
                  </tr>
                  <tr>
                    <td className="metadata-key">Slice Thickness</td>
                    <td className="metadata-val">{scanData.slice_thickness} mm</td>
                  </tr>
                  <tr>
                    <td className="metadata-key">Manufacturer</td>
                    <td className="metadata-val">{scanData.manufacturer}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No scan loaded. Upload a `.dcm` file to view clinical headers.</p>
            )}
          </div>

          {/* AI Clinical Interpretation */}
          <div className="card" style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Eye size={18} style={{ color: 'var(--accent-cyan)' }} />
              AI Clinical Reader Report
            </h3>
            
            {scanData?.interpretation ? (
              <div className="scan-interpretation-panel">
                <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Clinical Impression</span>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginTop: '0.2rem', fontWeight: 500, lineHeight: 1.4 }}>
                    {scanData.interpretation.clinical_impression}
                  </p>
                </div>

                {scanData.interpretation.mass_characteristics && (
                  <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', fontSize: '0.85rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Target Lesion Details</span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginTop: '0.35rem' }}>
                      <div>Size: <strong style={{ color: 'var(--accent-cyan)' }}>{scanData.interpretation.mass_characteristics.size_mm} mm</strong></div>
                      <div>Margins: <strong>{scanData.interpretation.mass_characteristics.margin_status}</strong></div>
                      <div style={{ gridColumn: 'span 2' }}>Contrast: <strong>{scanData.interpretation.mass_characteristics.contrast_enhancement}</strong></div>
                    </div>
                  </div>
                )}

                <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Perineural Invasion (PNI) Risk</span>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem', lineHeight: 1.4 }}>
                    {scanData.interpretation.pni_risk_assessment}
                  </p>
                </div>

                <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Primary Site Findings</span>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem', lineHeight: 1.4 }}>
                    {scanData.interpretation.primary_site_findings}
                  </p>
                </div>

                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Oncology Recommendations</span>
                  <ul className="recommendations-list" style={{ marginTop: '0.35rem' }}>
                    {scanData.interpretation.recommendations.map((rec, i) => (
                      <li key={i}>
                        <CheckCircle size={12} />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No scan loaded. Upload a `.dcm` file to execute AI multimodal reading.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
