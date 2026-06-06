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

UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "uploads")
SLICES_DIR = os.path.join(UPLOADS_DIR, "slices")
os.makedirs(SLICES_DIR, exist_ok=True)

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

    # Generate output PNG path
    slice_filename = f"{uuid.uuid4()}.png"
    slice_path = os.path.join(SLICES_DIR, slice_filename)
    
    try:
        # Convert pixel data
        pixel_data_available = hasattr(dcm, "PixelData")
        if pixel_data_available:
            pixels = dcm.pixel_array.astype(float)
            
            # 1. Rescale slope and intercept (HU conversion)
            slope = getattr(dcm, "RescaleSlope", 1)
            intercept = getattr(dcm, "RescaleIntercept", 0)
            pixels = pixels * float(slope) + float(intercept)
            
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
            
            # Save PNG
            img = Image.fromarray(pixels)
            # If monochrome, convert to L
            if img.mode != 'L':
                img = img.convert('L')
            img.save(slice_path)
            metadata["slice_image_url"] = f"/static/slices/{slice_filename}"
        else:
            metadata["slice_image_url"] = None
            metadata["warning"] = "DICOM contains no pixel data."
    except Exception as img_err:
        metadata["slice_image_url"] = None
        metadata["warning"] = f"Failed to generate slice image: {str(img_err)}"
        
    return metadata

def parse_dicom_directory(dir_path: str) -> dict:
    """
    Parses a directory of DICOM files (e.g. extracted from a ZIP), 
    sorts them by physical location/instance, generates PNG slices for all,
    and returns combined metadata.
    """
    dcm_files = []
    for root, _, files in os.walk(dir_path):
        for f in files:
            if f.lower().endswith((".dcm", ".dicom")) or f.isdigit(): # Some DICOMs have no extension
                dcm_files.append(os.path.join(root, f))
                
    if not dcm_files:
        return {"error": "No DICOM files found in archive."}
        
    parsed_slices = []
    for f in dcm_files:
        try:
            dcm = pydicom.dcmread(f, stop_before_pixels=True)
            instance_num = getattr(dcm, "InstanceNumber", 0)
            slice_loc = getattr(dcm, "SliceLocation", 0)
            parsed_slices.append({"path": f, "instance": int(instance_num) if instance_num else 0, "loc": float(slice_loc) if slice_loc else 0})
        except Exception:
            continue
            
    if not parsed_slices:
        return {"error": "Failed to read DICOM headers in archive."}
        
    # Sort slices (prefer SliceLocation, fallback to InstanceNumber)
    parsed_slices.sort(key=lambda x: (x["loc"], x["instance"]))
    
    # Cap at 500 slices to prevent server hang on massive scans
    if len(parsed_slices) > 500:
        parsed_slices = parsed_slices[:500]
        
    # Parse the "middle" slice to get overall metadata
    middle_idx = len(parsed_slices) // 2
    middle_slice_path = parsed_slices[middle_idx]["path"]
    
    overall_metadata = parse_dicom(middle_slice_path)
    if "error" in overall_metadata:
        return overall_metadata
        
    # Now generate PNGs for all slices to support scrolling
    slice_image_urls = []
    for s in parsed_slices:
        if s["path"] == middle_slice_path:
            slice_image_urls.append(overall_metadata.get("slice_image_url"))
            continue
            
        try:
            # We just need the PNG, so we do a fast parse
            slice_meta = parse_dicom(s["path"])
            if slice_meta.get("slice_image_url"):
                slice_image_urls.append(slice_meta.get("slice_image_url"))
        except Exception:
            pass
            
    # Add array of slices
    overall_metadata["slice_image_urls"] = [url for url in slice_image_urls if url is not None]
    
    return overall_metadata


