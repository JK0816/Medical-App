import { ShieldAlert } from 'lucide-react';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Upload, 
  Settings, 
  Eye, 
  CheckCircle,
  ChevronLeft,
  ChevronRight
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
  slice_image_urls?: string[]; // Multi-slice array from ZIP uploads
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

const STORAGE_KEY = 'acc_lastScanData';
const PRELOAD_RANGE = 3;

export const ScanViewer: React.FC<ScanViewerProps> = ({ backendUrl, onScanUploaded }) => {
  const [loading, setLoading] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<string | null>(null);
  const [scanData, setScanData] = useState<DicomResult | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // PACS Viewer adjustments
  const [zoom, setZoom] = useState(1);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);

  // Multi-slice navigation
  const [currentSliceIndex, setCurrentSliceIndex] = useState(0);
  const loadedSlicesRef = useRef<Set<number>>(new Set([0]));

  // Persist scan data to localStorage (slim version — exclude large URL arrays)
  useEffect(() => {
    if (scanData) {
      try {
        // Only persist essential metadata, not the full slice URL arrays
        const slimData = { ...scanData };
        delete slimData.slice_image_urls;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(slimData));
      } catch {
        // localStorage might be full; silently fail
      }
    }
  }, [scanData]);

  // Poll background DICOM processing task status
  useEffect(() => {
    if (!taskId) return;

    let isMounted = true;
    const interval = setInterval(async () => {
      try {
        const resp = await fetch(`${backendUrl}/api/dicom/tasks/${taskId}`);
        if (!resp.ok) {
          throw new Error("Failed to fetch task status");
        }
        const task = await resp.json();
        if (!isMounted) return;

        setTaskStatus(task.status);

        if (task.status === 'Completed') {
          clearInterval(interval);
          setScanData(task.result);
          // Start at middle slice for multi-slice scans (most clinically relevant)
          if (task.result?.slice_image_urls && task.result.slice_image_urls.length > 1) {
            setCurrentSliceIndex(Math.floor(task.result.slice_image_urls.length / 2));
          }
          setTaskId(null);
          setTaskStatus(null);
          setLoading(false);
          onScanUploaded(); // Refresh history
        } else if (task.status === 'Failed') {
          clearInterval(interval);
          setError(task.error_message || "Failed to parse and interpret scan.");
          setTaskId(null);
          setTaskStatus(null);
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        if (isMounted) {
          clearInterval(interval);
          setError("Error polling DICOM task status.");
          setTaskId(null);
          setTaskStatus(null);
          setLoading(false);
        }
      }
    }, 2000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [taskId, backendUrl]);

  // Get the array of all slice URLs
  const allSliceUrls = scanData?.slice_image_urls?.length 
    ? scanData.slice_image_urls 
    : (scanData?.slice_image_url ? [scanData.slice_image_url] : []);
  
  const totalSlices = allSliceUrls.length;
  const isMultiSlice = totalSlices > 1;
  const currentSliceUrl = allSliceUrls[currentSliceIndex] || null;

  // Pre-load adjacent slices for smooth scrolling (uses ref to avoid re-render loops)
  useEffect(() => {
    if (!isMultiSlice) return;
    
    for (let i = -PRELOAD_RANGE; i <= PRELOAD_RANGE; i++) {
      const idx = currentSliceIndex + i;
      if (idx >= 0 && idx < totalSlices && !loadedSlicesRef.current.has(idx)) {
        const img = new window.Image();
        img.src = `${backendUrl}${allSliceUrls[idx]}`;
        loadedSlicesRef.current.add(idx);
      }
    }
  }, [currentSliceIndex, totalSlices, isMultiSlice, allSliceUrls, backendUrl]);

  // Navigate slices
  const goToSlice = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(totalSlices - 1, index));
    setCurrentSliceIndex(clamped);
  }, [totalSlices]);

  const prevSlice = useCallback(() => goToSlice(currentSliceIndex - 1), [currentSliceIndex, goToSlice]);
  const nextSlice = useCallback(() => goToSlice(currentSliceIndex + 1), [currentSliceIndex, goToSlice]);

  // Keyboard navigation for DICOM scrubbing
  useEffect(() => {
    if (!isMultiSlice) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        prevSlice();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        nextSlice();
      } else if (e.key === 'Home') {
        e.preventDefault();
        goToSlice(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        goToSlice(totalSlices - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMultiSlice, prevSlice, nextSlice, goToSlice, totalSlices]);

  // Mouse wheel scrolling for DICOM scrubbing (standard radiology UX)
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !isMultiSlice) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) {
        prevSlice();
      } else if (e.deltaY > 0) {
        nextSlice();
      }
    };

    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', handleWheel);
  }, [isMultiSlice, prevSlice, nextSlice]);

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleUpload = async (file: File) => {
    const fname = file.name.toLowerCase();
    if (!fname.endsWith('.dcm') && !fname.endsWith('.dicom') && !fname.endsWith('.zip')) {
      setError("Please select a valid DICOM file (.dcm) or ZIP archive (.zip).");
      return;
    }
    setLoading(true);
    setError(null);
    setScanData(null);
    setCurrentSliceIndex(0);
    loadedSlicesRef.current = new Set([0]);
    setTaskStatus('Queued');

    const formData = new FormData();
    formData.append("file", file);

    try {
      const resp = await fetch(`${backendUrl}/api/dicom/upload`, {
        method: 'POST',
        body: formData
      });

      if (resp.ok) {
        const data = await resp.json();
        setTaskId(data.task_id);
        setTaskStatus(data.status);
      } else {
        const errText = await resp.json();
        setError(errText.detail || "Failed to initiate DICOM upload.");
        setLoading(false);
        setTaskStatus(null);
      }
    } catch (err) {
      console.error(err);
      setError("Network error occurred during scan upload.");
      setLoading(false);
      setTaskStatus(null);
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

  const clearScan = () => {
    setScanData(null);
    setCurrentSliceIndex(0);
    loadedSlicesRef.current = new Set([0]);
    setTaskId(null);
    setTaskStatus(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  // Dynamic message based on background worker state
  const getLoadingText = () => {
    if (taskStatus === 'Queued') return 'QUEUED IN BACKGROUND WORKER QUEUE...';
    if (taskStatus === 'Processing') return 'RECONSTRUCTING SLICES & SCANNING ANATOMY...';
    if (taskStatus === 'Interpreting') return 'GENERATING AI CLINICAL REPORT...';
    return 'PROCESSING SCAN...';
  };

  return (
    <div className="dicom-workstation-container">
      <div className="dicom-header-row">
        <div>
          <h2>DICOM Image Workstation</h2>
          <p className="dicom-header-subtitle">Upload medical DICOM scans (.dcm) or ZIP archives (.zip) for slice reconstruction and multimodal clinical AI interpretation.</p>
        </div>
        
        <div className="status-badge-container">
          {taskStatus && (
            <span className={`status-badge-inline ${taskStatus.toLowerCase()}`}>
              {taskStatus}
            </span>
          )}
          
          {scanData && (
            <button className="btn btn-secondary dicom-new-scan-btn" onClick={clearScan}>
              New Scan
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="card dicom-error-card">
          <ShieldAlert className="dicom-error-icon" />
          <span className="dicom-error-text">{error}</span>
        </div>
      )}

      {/* Main Workstation Layout */}
      <div className="scan-viewer-layout">
        {/* PACS Viewport Container */}
        <div className="dicom-viewport-container">
          <div className="card dicom-screen-wrapper">
            <div className="dicom-screen" ref={viewportRef}>
              {loading && (
                <div className="dicom-loading-overlay">
                  <div className="typing-indicator dicom-loading-indicator">
                    <div className="typing-dot dicom-loading-dot"></div>
                    <div className="typing-dot dicom-loading-dot"></div>
                    <div className="typing-dot dicom-loading-dot"></div>
                  </div>
                  <div className="dicom-loading-text">
                    {getLoadingText()}
                  </div>
                  {/* Glowing green line sliding down */}
                  <div className="dicom-scan-line" />
                </div>
              )}

              {scanData ? (
                <>
                  <div className="dicom-grid-overlay"></div>
                  {currentSliceUrl ? (
                    <img 
                      src={`${backendUrl}${currentSliceUrl}`} 
                      alt={`DICOM Slice ${currentSliceIndex + 1} of ${totalSlices}`}
                      className="dicom-image"
                      style={{
                        transform: `scale(${zoom})`,
                        filter: `brightness(${brightness}%) contrast(${contrast}%)`,
                        transition: 'filter 0.05s ease'
                      }}
                    />
                  ) : (
                    <div className="dicom-empty-pixel-state">
                      <p className="dicom-empty-pixel-title">No Pixel Data Available</p>
                      <p className="dicom-empty-pixel-desc">This DICOM file does not contain renderable pixel data. Metadata has been extracted successfully.</p>
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
                        {isMultiSlice && (<><br />SLICE: {currentSliceIndex + 1} / {totalSlices}</>)}
                      </div>
                      <div>
                        WW: 300 / WC: 50<br />
                        ZOOM: {zoom.toFixed(1)}x<br />
                        SC: CT Image Storage
                      </div>
                    </div>
                  </div>

                  {/* Multi-slice navigation overlay */}
                  {isMultiSlice && (
                    <div className="dicom-navigation-overlay">
                      <button 
                        onClick={prevSlice}
                        disabled={currentSliceIndex === 0}
                        className="dicom-nav-btn"
                        title="Previous Slice"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="dicom-nav-text">
                        {currentSliceIndex + 1} / {totalSlices}
                      </span>
                      <button 
                        onClick={nextSlice}
                        disabled={currentSliceIndex === totalSlices - 1}
                        className="dicom-nav-btn"
                        title="Next Slice"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
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
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>or click anywhere to browse local files (Supports `.dcm` and `.zip` archives)</p>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    className="dicom-hidden-input"
                    onChange={handleFileChange}
                    accept=".dcm,.dicom,.zip"
                    title="Upload DICOM file"
                  />
                </div>
              ) : null}
            </div>

            {/* Viewer Controls */}
            {scanData && (
              <div className="dicom-controls-wrapper">
                {/* Slice slider for multi-slice scans */}
                {isMultiSlice && (
                  <div className="slider-group dicom-slider-border-bottom">
                    <div className="slider-header dicom-slider-header-small">
                      <span className="slider-name">Slice Position ({currentSliceIndex + 1} of {totalSlices})</span>
                      <span className="dicom-slider-header-muted">Scroll wheel or arrow keys to navigate</span>
                    </div>
                    <input 
                      type="range" min="0" max={totalSlices - 1} step="1"
                      className="range-input" 
                      value={currentSliceIndex} 
                      onChange={(e) => goToSlice(parseInt(e.target.value))} 
                      title="Slice Position Slider"
                    />
                  </div>
                )}

                <div className="dicom-slider-grid-controls">
                  <div className="slider-group">
                    <div className="slider-header dicom-slider-header-small">
                      <span className="slider-name">Zoom ({zoom.toFixed(1)}x)</span>
                    </div>
                    <input 
                      type="range" min="1" max="3" step="0.1"
                      className="range-input" 
                      value={zoom} 
                      onChange={(e) => setZoom(parseFloat(e.target.value))} 
                      title="Zoom Slider"
                    />
                  </div>

                  <div className="slider-group">
                    <div className="slider-header dicom-slider-header-small">
                      <span className="slider-name">Brightness ({brightness}%)</span>
                    </div>
                    <input 
                      type="range" min="50" max="200" 
                      className="range-input" 
                      value={brightness} 
                      onChange={(e) => setBrightness(parseInt(e.target.value))} 
                      title="Brightness Slider"
                    />
                  </div>

                  <div className="slider-group">
                    <div className="slider-header dicom-slider-header-small">
                      <span className="slider-name">Contrast ({contrast}%)</span>
                    </div>
                    <input 
                      type="range" min="50" max="200" 
                      className="range-input" 
                      value={contrast} 
                      onChange={(e) => setContrast(parseInt(e.target.value))} 
                      title="Contrast Slider"
                    />
                  </div>
                  
                  <button className="btn btn-secondary dicom-reset-filters-btn" onClick={resetFilters}>
                    Reset Filters
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Info & AI Analysis Panel */}
        <div className="dicom-metadata-panel">
          {/* Metadata Card */}
          <div className="card">
            <h3 className="dicom-card-header-bold">
              <Settings size={18} />
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
                  {isMultiSlice && (
                    <tr>
                      <td className="metadata-key">Total Slices</td>
                      <td className="metadata-val">{totalSlices}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <p className="dicom-empty-tag-text">No scan loaded. Upload a `.dcm` file to view clinical headers.</p>
            )}
          </div>

          {/* AI Clinical Interpretation */}
          <div className="card flex-1">
            <h3 className="dicom-card-header-bold">
              <Eye size={18} />
              AI Clinical Reader Report
            </h3>
            
            {scanData?.interpretation ? (
              <div className="scan-interpretation-panel">
                <div className="dicom-report-section">
                  <span className="dicom-report-label">Clinical Impression</span>
                  <p className="dicom-report-impression">
                    {scanData.interpretation.clinical_impression}
                  </p>
                </div>

                {scanData.interpretation.mass_characteristics && (
                  <div className="dicom-lesion-section">
                    <span className="dicom-report-label">Target Lesion Details</span>
                    <div className="dicom-lesion-grid">
                      <div>Size: <strong className="dicom-lesion-size">{scanData.interpretation.mass_characteristics.size_mm} mm</strong></div>
                      <div>Margins: <strong>{scanData.interpretation.mass_characteristics.margin_status}</strong></div>
                      <div className="dicom-lesion-span-2">Contrast: <strong>{scanData.interpretation.mass_characteristics.contrast_enhancement}</strong></div>
                    </div>
                  </div>
                )}

                <div className="dicom-report-section">
                  <span className="dicom-report-label">Perineural Invasion (PNI) Risk</span>
                  <p className="dicom-report-pni">
                    {scanData.interpretation.pni_risk_assessment}
                  </p>
                </div>

                <div className="dicom-report-section">
                  <span className="dicom-report-label">Primary Site Findings</span>
                  <p className="dicom-report-findings">
                    {scanData.interpretation.primary_site_findings}
                  </p>
                </div>

                <div>
                  <span className="dicom-report-label">Oncology Recommendations</span>
                  <ul className="recommendations-list dicom-recommendations-list-wrapper">
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
              <p className="dicom-empty-tag-text">No scan loaded. Upload a `.dcm` file to execute AI multimodal reading.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
