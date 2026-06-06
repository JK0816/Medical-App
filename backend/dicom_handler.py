# pyrefly: ignore [missing-import]
import pydicom
# pyrefly: ignore [missing-import]
from pydicom.dataset import FileDataset, FileMetaDataset
from pydicom.uid import ExplicitVRLittleEndian
import numpy as np
from PIL import Image
import os
import uuid
import json
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

UPLOADS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
SLICES_DIR = os.path.join(UPLOADS_DIR, "slices")
os.makedirs(SLICES_DIR, exist_ok=True)

# Maximum number of worker threads for batch PNG generation
MAX_PNG_WORKERS = 4

def _apply_windowing(pixels: np.ndarray, dcm) -> np.ndarray:
    """
    Applies HU rescaling and windowing to a pixel array.
    Returns a uint8 numpy array suitable for PNG conversion.
    """
    # 1. Rescale slope and intercept (HU conversion)
    slope = float(getattr(dcm, "RescaleSlope", 1))
    intercept = float(getattr(dcm, "RescaleIntercept", 0))
    if slope != 1 or intercept != 0:
        pixels = pixels * slope + intercept

    # 2. Windowing
    wc = getattr(dcm, "WindowCenter", None)
    ww = getattr(dcm, "WindowWidth", None)

    if wc is not None and ww is not None:
        # Handle potential multi-valued tags
        if isinstance(wc, pydicom.multival.MultiValue):
            wc = float(wc[0])
        else:
            wc = float(wc)

        if isinstance(ww, pydicom.multival.MultiValue):
            ww = float(ww[0])
        else:
            ww = float(ww)

        vmin = wc - ww / 2.0
        vmax = wc + ww / 2.0
        pixels = np.clip(pixels, vmin, vmax)

        if vmax > vmin:
            pixels = ((pixels - vmin) / (vmax - vmin) * 255.0).astype(np.uint8)
        else:
            pixels = np.zeros_like(pixels, dtype=np.uint8)
    else:
        # Min-max scale fallback
        p_min, p_max = pixels.min(), pixels.max()
        if p_max > p_min:
            pixels = ((pixels - p_min) / (p_max - p_min) * 255.0).astype(np.uint8)
        else:
            pixels = pixels.astype(np.uint8)

    return pixels


def _save_png(pixels: np.ndarray) -> str:
    """Save a uint8 pixel array as a grayscale PNG. Returns the relative URL path."""
    slice_filename = f"{uuid.uuid4()}.png"
    slice_path = os.path.join(SLICES_DIR, slice_filename)
    img = Image.fromarray(pixels)
    if img.mode != 'L':
        img = img.convert('L')
    img.save(slice_path, optimize=True)
    return f"/static/slices/{slice_filename}"


def parse_dicom(filepath: str) -> dict:
    """
    Parses a DICOM file, extracts clinical metadata, and converts the 
    pixel array into a standard PNG slice image.
    """
    try:
        dcm = pydicom.dcmread(filepath)
    except Exception as e:
        return {"error": f"Failed to read DICOM file: {str(e)}"}
    
    # Extract metadata tags with fallbacks
    metadata = {
        "patient_name": str(getattr(dcm, "PatientName", "Unknown Patient")),
        "patient_id": str(getattr(dcm, "PatientID", "N/A")),
        "patient_sex": str(getattr(dcm, "PatientSex", "N/A")),
        "patient_dob": str(getattr(dcm, "PatientBirthDate", "N/A")),
        "study_date": str(getattr(dcm, "StudyDate", "N/A")),
        "study_time": str(getattr(dcm, "StudyTime", "N/A")),
        "modality": str(getattr(dcm, "Modality", "Unknown")),
        "body_part": str(getattr(dcm, "BodyPartExamined", "Unknown")),
        "study_description": str(getattr(dcm, "StudyDescription", "N/A")),
        "series_description": str(getattr(dcm, "SeriesDescription", "N/A")),
        "manufacturer": str(getattr(dcm, "Manufacturer", "N/A")),
        "slice_thickness": str(getattr(dcm, "SliceThickness", "N/A")),
    }
    
    # Re-format dates if present (YYYYMMDD to YYYY-MM-DD)
    for date_key in ["patient_dob", "study_date"]:
        val = metadata[date_key]
        if val and len(val) == 8 and val.isdigit():
            metadata[date_key] = f"{val[:4]}-{val[4:6]}-{val[6:]}"

    try:
        pixel_data_available = hasattr(dcm, "PixelData")
        if pixel_data_available:
            pixels = dcm.pixel_array.astype(float)
            pixels = _apply_windowing(pixels, dcm)
            metadata["slice_image_url"] = _save_png(pixels)
        else:
            metadata["slice_image_url"] = None
            metadata["warning"] = "DICOM contains no pixel data."
    except Exception as img_err:
        metadata["slice_image_url"] = None
        metadata["warning"] = f"Failed to generate slice image: {str(img_err)}"
        
    return metadata


def convert_dicom_to_png(filepath: str, window_center: float = None, window_width: float = None) -> str | None:
    """
    Lightweight pixel-only conversion: reads a DICOM file, applies windowing,
    saves a PNG, and returns the URL path. Skips all metadata extraction.
    
    If window_center/window_width are provided, uses those instead of reading
    from the DICOM tags (for consistent windowing across a series).
    """
    try:
        dcm = pydicom.dcmread(filepath)
        if not hasattr(dcm, "PixelData"):
            return None
            
        pixels = dcm.pixel_array.astype(float)
        
        # Apply rescaling
        slope = float(getattr(dcm, "RescaleSlope", 1))
        intercept = float(getattr(dcm, "RescaleIntercept", 0))
        if slope != 1 or intercept != 0:
            pixels = pixels * slope + intercept
        
        # Apply windowing (use provided values or fall back to DICOM tags)
        wc = window_center
        ww = window_width
        
        if wc is None or ww is None:
            wc_tag = getattr(dcm, "WindowCenter", None)
            ww_tag = getattr(dcm, "WindowWidth", None)
            if wc_tag is not None and ww_tag is not None:
                wc = float(wc_tag[0]) if isinstance(wc_tag, pydicom.multival.MultiValue) else float(wc_tag)
                ww = float(ww_tag[0]) if isinstance(ww_tag, pydicom.multival.MultiValue) else float(ww_tag)
        
        if wc is not None and ww is not None:
            vmin = wc - ww / 2.0
            vmax = wc + ww / 2.0
            pixels = np.clip(pixels, vmin, vmax)
            if vmax > vmin:
                pixels = ((pixels - vmin) / (vmax - vmin) * 255.0).astype(np.uint8)
            else:
                pixels = np.zeros_like(pixels, dtype=np.uint8)
        else:
            p_min, p_max = pixels.min(), pixels.max()
            if p_max > p_min:
                pixels = ((pixels - p_min) / (p_max - p_min) * 255.0).astype(np.uint8)
            else:
                pixels = pixels.astype(np.uint8)
        
        return _save_png(pixels)
    except Exception:
        return None


def parse_dicom_directory(dir_path: str) -> dict:
    """
    Parses a directory of DICOM files (e.g. extracted from a ZIP), 
    sorts them by physical location/instance, generates PNG slices for all,
    and returns combined metadata.
    
    Performance optimizations:
    - Uses stop_before_pixels=True for initial sorting pass (reads only headers)
    - Extracts metadata from only the middle slice  
    - Uses a lightweight pixel-only converter for all other slices
    - Pre-computes window center/width from the metadata slice and reuses
    - Runs PNG generation in parallel using a thread pool
    """
    dcm_files = []
    for root, _, files in os.walk(dir_path):
        for f in files:
            if f.lower().endswith((".dcm", ".dicom")) or f.isdigit(): # Some DICOMs have no extension
                dcm_files.append(os.path.join(root, f))
                
    if not dcm_files:
        return {"error": "No DICOM files found in archive."}
    
    # --- Phase 1: Fast header-only sorting pass ---
    parsed_slices = []
    for f in dcm_files:
        try:
            dcm = pydicom.dcmread(f, stop_before_pixels=True)
            instance_num = getattr(dcm, "InstanceNumber", 0)
            slice_loc = getattr(dcm, "SliceLocation", 0)
            parsed_slices.append({
                "path": f, 
                "instance": int(instance_num) if instance_num else 0, 
                "loc": float(slice_loc) if slice_loc else 0
            })
        except Exception:
            continue
            
    if not parsed_slices:
        return {"error": "Failed to read DICOM headers in archive."}
        
    # Sort slices (prefer SliceLocation, fallback to InstanceNumber)
    parsed_slices.sort(key=lambda x: (x["loc"], x["instance"]))
    
    # Cap at 500 slices to prevent server hang on massive scans
    if len(parsed_slices) > 500:
        parsed_slices = parsed_slices[:500]
    
    # --- Phase 2: Extract full metadata from the middle slice only ---
    middle_idx = len(parsed_slices) // 2
    middle_slice_path = parsed_slices[middle_idx]["path"]
    
    overall_metadata = parse_dicom(middle_slice_path)
    if "error" in overall_metadata:
        return overall_metadata
    
    # --- Phase 3: Pre-compute windowing parameters from the middle slice ---
    # This avoids re-reading window tags for every single slice
    wc, ww = None, None
    try:
        ref_dcm = pydicom.dcmread(middle_slice_path, stop_before_pixels=True)
        wc_tag = getattr(ref_dcm, "WindowCenter", None)
        ww_tag = getattr(ref_dcm, "WindowWidth", None)
        if wc_tag is not None and ww_tag is not None:
            wc = float(wc_tag[0]) if isinstance(wc_tag, pydicom.multival.MultiValue) else float(wc_tag)
            ww = float(ww_tag[0]) if isinstance(ww_tag, pydicom.multival.MultiValue) else float(ww_tag)
    except Exception:
        pass  # Fall back to per-file windowing
    
    # --- Phase 4: Parallel batch PNG generation for all slices ---
    # The middle slice was already converted by parse_dicom(); skip it
    middle_url = overall_metadata.get("slice_image_url")
    
    # Build the ordered result array, converting non-middle slices in parallel
    slice_image_urls = [None] * len(parsed_slices)
    slice_image_urls[middle_idx] = middle_url
    
    # Collect indices of slices that need conversion
    work_items = [
        (idx, s["path"]) 
        for idx, s in enumerate(parsed_slices) 
        if idx != middle_idx
    ]
    
    def _convert_worker(args):
        idx, path = args
        url = convert_dicom_to_png(path, window_center=wc, window_width=ww)
        return idx, url
    
    with ThreadPoolExecutor(max_workers=MAX_PNG_WORKERS) as executor:
        futures = [executor.submit(_convert_worker, item) for item in work_items]
        for future in as_completed(futures):
            try:
                idx, url = future.result()
                if url:
                    slice_image_urls[idx] = url
            except Exception:
                pass
    
    # Filter out None values (failed conversions) but maintain order
    overall_metadata["slice_image_urls"] = [url for url in slice_image_urls if url is not None]
    
    return overall_metadata
