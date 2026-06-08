# pyrefly: ignore [missing-import]
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
import shutil
import uuid
import json
# pyrefly: ignore [missing-import]
import numpy as np
from datetime import datetime
# pyrefly: ignore [missing-import]
from pydantic import BaseModel, Field
from typing import Optional, List

import sqlite3
from backend.db import get_db_connection, get_db
import backend.dicom_handler as dicom_handler
import backend.gemini_handler as gemini_handler

# Create FastAPI app
app = FastAPI(title="ACC Patient Care API")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In development, allow all.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Upload directory paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
DOCS_DIR = os.path.join(UPLOADS_DIR, "documents")
os.makedirs(DOCS_DIR, exist_ok=True)

# Maximum upload file size: 100 MB
MAX_UPLOAD_SIZE = 100 * 1024 * 1024

# Mount static folder for DICOM slices and documents
app.mount("/static", StaticFiles(directory=UPLOADS_DIR), name="static")

# --- Pydantic Schemas ---
class AppointmentCreate(BaseModel):
    title: str = Field(..., max_length=200)
    date: str = Field(..., max_length=20)
    doctor: Optional[str] = Field(None, max_length=200)
    location: Optional[str] = Field(None, max_length=300)
    notes: Optional[str] = Field(None, max_length=2000)

class AppointmentUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    date: Optional[str] = Field(None, max_length=20)
    doctor: Optional[str] = Field(None, max_length=200)
    location: Optional[str] = Field(None, max_length=300)
    notes: Optional[str] = Field(None, max_length=2000)

class MedicationCreate(BaseModel):
    name: str = Field(..., max_length=200)
    dosage: str = Field(..., max_length=100)
    frequency: str = Field(..., max_length=200)
    start_date: Optional[str] = Field(None, max_length=20)
    end_date: Optional[str] = Field(None, max_length=20)
    refills_remaining: Optional[int] = 0
    notes: Optional[str] = Field(None, max_length=2000)

class MedicationUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    dosage: Optional[str] = Field(None, max_length=100)
    frequency: Optional[str] = Field(None, max_length=200)
    start_date: Optional[str] = Field(None, max_length=20)
    end_date: Optional[str] = Field(None, max_length=20)
    refills_remaining: Optional[int] = None
    notes: Optional[str] = Field(None, max_length=2000)

class SymptomCreate(BaseModel):
    date: str = Field(..., max_length=20)
    pain: Optional[int] = Field(None, ge=1, le=10)
    pain_location: Optional[str] = Field(None, max_length=200)
    fatigue: Optional[int] = Field(None, ge=1, le=10)
    nausea: Optional[int] = Field(None, ge=1, le=10)
    fever: Optional[int] = Field(None, ge=1, le=10)
    constipation: Optional[int] = Field(None, ge=1, le=10)
    other: Optional[int] = Field(None, ge=1, le=10)
    other_description: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = Field(None, max_length=2000)

class SymptomUpdate(BaseModel):
    date: Optional[str] = Field(None, max_length=20)
    pain: Optional[int] = Field(None, ge=1, le=10)
    pain_location: Optional[str] = Field(None, max_length=200)
    fatigue: Optional[int] = Field(None, ge=1, le=10)
    nausea: Optional[int] = Field(None, ge=1, le=10)
    fever: Optional[int] = Field(None, ge=1, le=10)
    constipation: Optional[int] = Field(None, ge=1, le=10)
    other: Optional[int] = Field(None, ge=1, le=10)
    other_description: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = Field(None, max_length=2000)

class TimelineEventCreate(BaseModel):
    event_date: str = Field(..., max_length=20)
    event_type: str = Field(..., max_length=50) # "Diagnosis", "Surgery", "Radiation", "Scan", "Medication Change", "Other"
    title: str = Field(..., max_length=300)
    description: Optional[str] = Field(None, max_length=5000)
    details_json: Optional[str] = None # Expecting a JSON-serialized string

class TimelineEventUpdate(BaseModel):
    event_date: Optional[str] = Field(None, max_length=20)
    event_type: Optional[str] = Field(None, max_length=50)
    title: Optional[str] = Field(None, max_length=300)
    description: Optional[str] = Field(None, max_length=5000)
    details_json: Optional[str] = None

class ChatRequest(BaseModel):
    query: str = Field(..., max_length=5000)
    search_web: bool
    search_records: bool

# --- APPOINTMENTS API ---
@app.get("/api/appointments")
def get_appointments(conn: sqlite3.Connection = Depends(get_db)):
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM appointments ORDER BY date ASC")
    rows = cursor.fetchall()
    return [dict(row) for row in rows]

@app.post("/api/appointments")
def create_appointment(item: AppointmentCreate, conn: sqlite3.Connection = Depends(get_db)):
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO appointments (title, date, doctor, location, notes)
        VALUES (?, ?, ?, ?, ?)
    """, (item.title, item.date, item.doctor, item.location, item.notes))
    conn.commit()
    new_id = cursor.lastrowid
    return {"id": new_id, "message": "Appointment created successfully"}

@app.delete("/api/appointments/{id}")
def delete_appointment(id: int, conn: sqlite3.Connection = Depends(get_db)):
    cursor = conn.cursor()
    cursor.execute("DELETE FROM appointments WHERE id = ?", (id,))
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Appointment not found")
    conn.commit()
    return {"message": "Appointment deleted"}

@app.put("/api/appointments/{id}")
def update_appointment(id: int, item: AppointmentUpdate, conn: sqlite3.Connection = Depends(get_db)):
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM appointments WHERE id = ?", (id,))
    if not cursor.fetchone():
        raise HTTPException(status_code=404, detail="Appointment not found")
    updates = []
    values = []
    for field, val in item.model_dump(exclude_unset=True).items():
        updates.append(f"{field} = ?")
        values.append(val)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    values.append(id)
    cursor.execute(f"UPDATE appointments SET {', '.join(updates)} WHERE id = ?", values)
    conn.commit()
    return {"id": id, "message": "Appointment updated"}

# --- MEDICATIONS API ---
@app.get("/api/medications")
def get_medications(conn: sqlite3.Connection = Depends(get_db)):
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM medications ORDER BY name ASC")
    rows = cursor.fetchall()
    return [dict(row) for row in rows]

@app.post("/api/medications")
def create_medication(item: MedicationCreate, conn: sqlite3.Connection = Depends(get_db)):
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO medications (name, dosage, frequency, start_date, end_date, refills_remaining, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (item.name, item.dosage, item.frequency, item.start_date, item.end_date, item.refills_remaining, item.notes))
    conn.commit()
    new_id = cursor.lastrowid
    return {"id": new_id, "message": "Medication added successfully"}

@app.post("/api/medications/{id}/refill")
def refill_medication(id: int, conn: sqlite3.Connection = Depends(get_db)):
    cursor = conn.cursor()
    cursor.execute("SELECT refills_remaining FROM medications WHERE id = ?", (id,))
    row = cursor.fetchone()
    if not row:
            raise HTTPException(status_code=404, detail="Medication not found")
    
    current_refills = row["refills_remaining"]
    if current_refills <= 0:
            raise HTTPException(status_code=400, detail="No refills remaining")
        
    today = datetime.now().strftime("%Y-%m-%d")
    cursor.execute("""
        UPDATE medications 
        SET refills_remaining = refills_remaining - 1,
            last_refill_date = ?
        WHERE id = ?
    """, (today, id))
    conn.commit()
    return {"message": "Medication refilled successfully", "last_refill_date": today, "refills_remaining": current_refills - 1}

@app.delete("/api/medications/{id}")
def delete_medication(id: int, conn: sqlite3.Connection = Depends(get_db)):
    cursor = conn.cursor()
    cursor.execute("DELETE FROM medications WHERE id = ?", (id,))
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Medication not found")
    conn.commit()
    return {"message": "Medication deleted"}

@app.put("/api/medications/{id}")
def update_medication(id: int, item: MedicationUpdate, conn: sqlite3.Connection = Depends(get_db)):
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM medications WHERE id = ?", (id,))
    if not cursor.fetchone():
        raise HTTPException(status_code=404, detail="Medication not found")
    updates = []
    values = []
    for field, val in item.model_dump(exclude_unset=True).items():
        updates.append(f"{field} = ?")
        values.append(val)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    values.append(id)
    cursor.execute(f"UPDATE medications SET {', '.join(updates)} WHERE id = ?", values)
    conn.commit()
    return {"id": id, "message": "Medication updated"}

# --- SYMPTOMS API ---
@app.get("/api/symptoms")
def get_symptoms(conn: sqlite3.Connection = Depends(get_db)):
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM symptoms ORDER BY date ASC")
    rows = cursor.fetchall()
    return [dict(row) for row in rows]

@app.post("/api/symptoms")
def create_symptom(item: SymptomCreate, conn: sqlite3.Connection = Depends(get_db)):
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO symptoms (
            date, pain, pain_location, fatigue, nausea, fever, constipation, other, other_description, notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        item.date, item.pain, item.pain_location, item.fatigue, item.nausea, item.fever, item.constipation, item.other, item.other_description, item.notes
    ))
    conn.commit()
    new_id = cursor.lastrowid
    return {"id": new_id, "message": "Symptom log saved"}

@app.delete("/api/symptoms/{id}")
def delete_symptom(id: int, conn: sqlite3.Connection = Depends(get_db)):
    cursor = conn.cursor()
    cursor.execute("DELETE FROM symptoms WHERE id = ?", (id,))
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Symptom log not found")
    conn.commit()
    return {"message": "Symptom log deleted"}

@app.put("/api/symptoms/{id}")
def update_symptom(id: int, item: SymptomUpdate, conn: sqlite3.Connection = Depends(get_db)):
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM symptoms WHERE id = ?", (id,))
    if not cursor.fetchone():
        raise HTTPException(status_code=404, detail="Symptom log not found")
    updates = []
    values = []
    for field, val in item.model_dump(exclude_unset=True).items():
        updates.append(f"{field} = ?")
        values.append(val)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    values.append(id)
    cursor.execute(f"UPDATE symptoms SET {', '.join(updates)} WHERE id = ?", values)
    conn.commit()
    return {"id": id, "message": "Symptom log updated"}

# --- TIMELINE EVENTS API ---
@app.get("/api/timeline")
def get_timeline(conn: sqlite3.Connection = Depends(get_db)):
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM timeline_events ORDER BY event_date ASC")
    rows = cursor.fetchall()
    
    # Parse JSON strings in details_json back to actual dictionary objects
    results = []
    for row in rows:
        d = dict(row)
        if d.get("details_json"):
            try:
                d["details"] = json.loads(d["details_json"])
            except (json.JSONDecodeError, ValueError, TypeError):
                d["details"] = {}
        else:
            d["details"] = {}
        results.append(d)
    return results

@app.post("/api/timeline")
def create_timeline_event(item: TimelineEventCreate, conn: sqlite3.Connection = Depends(get_db)):
    cursor = conn.cursor()
    
    # Validate details_json is proper JSON if provided
    det_json = item.details_json or "{}"
    try:
        json.loads(det_json)
    except ValueError:
        raise HTTPException(status_code=400, detail="details_json must be a valid JSON string")
        
    cursor.execute("""
        INSERT INTO timeline_events (event_date, event_type, title, description, details_json)
        VALUES (?, ?, ?, ?, ?)
    """, (item.event_date, item.event_type, item.title, item.description, det_json))
    conn.commit()
    new_id = cursor.lastrowid
    return {"id": new_id, "message": "Timeline event created"}

@app.delete("/api/timeline/{id}")
def delete_timeline_event(id: int, conn: sqlite3.Connection = Depends(get_db)):
    cursor = conn.cursor()
    cursor.execute("DELETE FROM timeline_events WHERE id = ?", (id,))
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Timeline event not found")
    conn.commit()
    return {"message": "Timeline event deleted"}

@app.put("/api/timeline/{id}")
def update_timeline_event(id: int, item: TimelineEventUpdate, conn: sqlite3.Connection = Depends(get_db)):
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM timeline_events WHERE id = ?", (id,))
    if not cursor.fetchone():
        raise HTTPException(status_code=404, detail="Timeline event not found")
    updates = []
    values = []
    for field, val in item.model_dump(exclude_unset=True).items():
        if field == 'details_json' and val is not None:
            try:
                json.loads(val)
            except ValueError:
                raise HTTPException(status_code=400, detail="details_json must be a valid JSON string")
        updates.append(f"{field} = ?")
        values.append(val)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    values.append(id)
    cursor.execute(f"UPDATE timeline_events SET {', '.join(updates)} WHERE id = ?", values)
    conn.commit()
    return {"id": id, "message": "Timeline event updated"}

# --- HEALTH CHECK & DATA EXPORT ---
@app.get("/api/health")
def health_check():
    """Simple health check for frontend connectivity monitoring."""
    return {"status": "ok", "timestamp": datetime.now().isoformat()}

@app.get("/api/export")
def export_all_data(conn: sqlite3.Connection = Depends(get_db)):
    """Exports all patient data as a structured JSON archive for backup or portability."""
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM appointments ORDER BY date ASC")
    appointments = [dict(r) for r in cursor.fetchall()]
    
    cursor.execute("SELECT * FROM medications ORDER BY name ASC")
    medications = [dict(r) for r in cursor.fetchall()]
    
    cursor.execute("SELECT * FROM symptoms ORDER BY date ASC")
    symptoms = [dict(r) for r in cursor.fetchall()]
    
    cursor.execute("SELECT * FROM timeline_events ORDER BY event_date ASC")
    timeline = [dict(r) for r in cursor.fetchall()]
    
    cursor.execute("SELECT id, filename, filetype, upload_date, summary FROM documents ORDER BY upload_date DESC")
    documents = [dict(r) for r in cursor.fetchall()]
    
    return {
        "export_date": datetime.now().isoformat(),
        "appointments": appointments,
        "medications": medications,
        "symptoms": symptoms,
        "timeline_events": timeline,
        "documents": documents
    }

# --- DICOM IMAGING & SCAN INTERPRETATION API ---

@app.get("/api/dicom/synthetic")
def download_synthetic_dicom():
    """
    Generates a synthetic DICOM .dcm scan file and serves it as a download.
    This lets users easily test the DICOM upload and visual interpretation.
    """
    try:
        filepath = dicom_handler.generate_synthetic_dicom()
        return FileResponse(
            filepath,
            media_type="application/dicom",
            filename="acc_sample_scan.dcm"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate synthetic scan: {str(e)}")

def process_dicom_background_task(task_id: str, filepath: str, original_filename: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # 1. Update status to 'Processing'
        cursor.execute("UPDATE dicom_tasks SET status = 'Processing' WHERE id = ?", (task_id,))
        conn.commit()
        
        # 2. Parse file
        if original_filename.lower().endswith(".zip"):
            import zipfile
            extract_dir = os.path.join(UPLOADS_DIR, f"extracted_{uuid.uuid4()}")
            os.makedirs(extract_dir, exist_ok=True)
            try:
                with zipfile.ZipFile(filepath, 'r') as zip_ref:
                    zip_ref.extractall(extract_dir)
                parsed_data = dicom_handler.parse_dicom_directory(extract_dir)
            finally:
                shutil.rmtree(extract_dir, ignore_errors=True)
        else:
            parsed_data = dicom_handler.parse_dicom(filepath)
            
        if "error" in parsed_data:
            raise Exception(parsed_data["error"])
            
        # 3. Update status to 'Interpreting'
        cursor.execute("UPDATE dicom_tasks SET status = 'Interpreting' WHERE id = ?", (task_id,))
        conn.commit()
        
        # 4. Trigger Gemini interpretation
        slice_url = parsed_data.get("slice_image_url")
        if slice_url:
            relative_path = slice_url.replace("/static/", "")
            local_png_path = os.path.join(UPLOADS_DIR, relative_path)
            report = gemini_handler.interpret_dicom(parsed_data, local_png_path)
            parsed_data["interpretation"] = report
        else:
            parsed_data["interpretation"] = {"error": "Could not generate slice image for AI interpretation."}
            
        # 5. Log Timeline Event
        findings = parsed_data.get("interpretation", {}).get("clinical_impression", "Scan uploaded.")
        details = {
            "modality": parsed_data.get("modality"),
            "body_part": parsed_data.get("body_part"),
            "findings": findings,
            "patient_id": parsed_data.get("patient_id"),
            "slice_image": slice_url
        }
        cursor.execute("""
            INSERT INTO timeline_events (event_date, event_type, title, description, details_json)
            VALUES (?, 'Scan', ?, ?, ?)
        """, (
            parsed_data.get("study_date", datetime.now().strftime("%Y-%m-%d")),
            f"Uploaded {parsed_data.get('modality')} Scan",
            parsed_data.get("study_description", "DICOM Imaging Upload"),
            json.dumps(details)
        ))
        
        # 6. Update status to 'Completed'
        cursor.execute("""
            UPDATE dicom_tasks 
            SET status = 'Completed', result_json = ?
            WHERE id = ?
        """, (json.dumps(parsed_data), task_id))
        conn.commit()
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        cursor.execute("""
            UPDATE dicom_tasks 
            SET status = 'Failed', error_message = ?
            WHERE id = ?
        """, (str(e), task_id))
        conn.commit()
    finally:
        try:
            if os.path.exists(filepath):
                os.remove(filepath)
        except Exception as cleanup_err:
            print(f"Failed to delete temp file {filepath}: {str(cleanup_err)}")
        conn.close()

@app.post("/api/dicom/upload")
async def upload_dicom(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    conn: sqlite3.Connection = Depends(get_db)
):
    """
    Ingests a DICOM file or ZIP of files asynchronously, returning a task ID immediately.
    Processes slice reconstruction and AI interpretation in a background queue.
    """
    if not file.filename.lower().endswith((".dcm", ".dicom", ".zip")):
        raise HTTPException(status_code=400, detail="Only DICOM (.dcm) or ZIP (.zip) files are supported.")
    
    task_id = str(uuid.uuid4())
    temp_dir = os.path.join(UPLOADS_DIR, "temp")
    os.makedirs(temp_dir, exist_ok=True)
    
    filename = f"{task_id}_{file.filename}"
    filepath = os.path.join(temp_dir, filename)
    max_allowed = MAX_UPLOAD_SIZE * 5
    
    total_bytes = 0
    try:
        with open(filepath, "wb") as buffer:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                total_bytes += len(chunk)
                if total_bytes > max_allowed:
                    buffer.close()
                    os.remove(filepath)
                    raise HTTPException(status_code=413, detail="File too large.")
                buffer.write(chunk)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded file: {str(e)}")
        
    # Queue task in DB
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO dicom_tasks (id, filename, status)
        VALUES (?, ?, 'Queued')
    """, (task_id, file.filename))
    conn.commit()
    
    # Add background task
    background_tasks.add_task(process_dicom_background_task, task_id, filepath, file.filename)
    
    return {"task_id": task_id, "status": "Queued"}

@app.get("/api/dicom/tasks/{task_id}")
def get_dicom_task(task_id: str, conn: sqlite3.Connection = Depends(get_db)):
    """
    Retrieves status and results of a background DICOM processing task.
    """
    cursor = conn.cursor()
    cursor.execute("SELECT id, filename, status, result_json, error_message FROM dicom_tasks WHERE id = ?", (task_id,))
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Task not found")
        
    d = dict(row)
    if d.get("result_json"):
        try:
            d["result"] = json.loads(d["result_json"])
        except ValueError:
            d["result"] = None
    else:
        d["result"] = None
    return d

# --- DOCUMENTS API ---
@app.get("/api/documents")
def get_documents(conn: sqlite3.Connection = Depends(get_db)):
    """Returns a list of all uploaded documents with metadata."""
    cursor = conn.cursor()
    cursor.execute("SELECT id, filename, filepath, filetype, upload_date, summary FROM documents ORDER BY upload_date DESC")
    rows = cursor.fetchall()
    return [dict(row) for row in rows]

# --- DOCUMENT UPLOAD FOR GENERAL RAG ---
@app.post("/api/documents/upload")
async def upload_document(file: UploadFile = File(...), conn: sqlite3.Connection = Depends(get_db)):
    """
    Uploads a clinical PDF, TXT, or report document, extracts its text, 
    and computes embeddings to save them in the vector database for RAG.
    """
    if not file.filename.lower().endswith((".txt", ".pdf")):
        raise HTTPException(status_code=400, detail="Only plain text (.txt) and PDF (.pdf) files are currently supported for documents.")
    
    # Read file in chunks to prevent memory exhaustion from large uploads
    temp_dir = os.path.join(DOCS_DIR, "temp")
    os.makedirs(temp_dir, exist_ok=True)
    filename = f"{uuid.uuid4()}_{file.filename}"
    temp_path = os.path.join(temp_dir, filename)
    final_path = os.path.join(DOCS_DIR, filename)
    
    total_bytes = 0
    try:
        with open(temp_path, "wb") as buffer:
            while True:
                chunk = await file.read(1024 * 1024)  # 1MB chunks
                if not chunk:
                    break
                total_bytes += len(chunk)
                if total_bytes > MAX_UPLOAD_SIZE:
                    buffer.close()
                    os.remove(temp_path)
                    raise HTTPException(status_code=413, detail=f"File too large. Maximum size is {MAX_UPLOAD_SIZE // (1024*1024)} MB.")
                buffer.write(chunk)
    except HTTPException:
        raise
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded file: {str(e)}")
    
    # Move to final location
    shutil.move(temp_path, final_path)
    filepath = final_path
        
    # Extract text content
    text_content = ""
    file_type = "txt"
    if file.filename.lower().endswith(".txt"):
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            text_content = f.read()
    elif file.filename.lower().endswith(".pdf"):
        file_type = "pdf"
        try:
            from pypdf import PdfReader
            reader = PdfReader(filepath)
            pages_text = []
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    pages_text.append(page_text)
            text_content = "\n\n".join(pages_text) if pages_text else f"[PDF Document: {file.filename} — no extractable text found]"
        except ImportError:
            text_content = f"[PDF Document: {file.filename} — pypdf not installed, text extraction unavailable]"
        except Exception as pdf_err:
            text_content = f"[PDF Document: {file.filename} — extraction failed: {str(pdf_err)}]"
        
    # Generate document summary using Gemini
    summary = "Uploaded medical document containing clinical notes."
    if text_content and not gemini_handler.USE_MOCK_GEMINI:
        try:
            model = gemini_handler.get_gemini_model("gemini-2.5-flash")
            resp = model.generate_content(f"Summarize this medical document in two sentences for a patient's reference:\n\n{text_content[:4000]}")
            summary = resp.text.strip()
        except Exception:
            pass
            
    # Save document metadata
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO documents (filename, filepath, filetype, summary, text_content)
        VALUES (?, ?, ?, ?, ?)
    """, (file.filename, filepath, file_type, summary, text_content))
    doc_id = cursor.lastrowid
    
    # Auto-Extract clinical data from the document
    if text_content:
        extracted_data = gemini_handler.extract_clinical_data_from_document(text_content)
        
        # Insert Timeline Events
        for event in extracted_data.get("timeline_events", []):
            try:
                cursor.execute("""
                    INSERT INTO timeline_events (event_date, event_type, title, description, details_json)
                    VALUES (?, ?, ?, ?, ?)
                """, (
                    event.get("event_date", datetime.now().strftime("%Y-%m-%d")),
                    event.get("event_type", "Other"),
                    event.get("title", "Extracted Event"),
                    event.get("description", ""),
                    json.dumps(event.get("details", {}))
                ))
            except Exception as e:
                print(f"Failed to auto-insert timeline event: {str(e)}")
                
        # Insert Symptoms
        for symp in extracted_data.get("symptoms", []):
            try:
                cursor.execute("""
                    INSERT INTO symptoms (
                        date, pain, pain_location, fatigue, nausea, fever, constipation, other, other_description, notes
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    symp.get("date", datetime.now().strftime("%Y-%m-%d")),
                    symp.get("pain"),
                    symp.get("pain_location"),
                    symp.get("fatigue"),
                    symp.get("nausea"),
                    symp.get("fever"),
                    symp.get("constipation"),
                    symp.get("other"),
                    symp.get("other_description"),
                    symp.get("notes", "Auto-extracted from document.")
                ))
            except Exception as e:
                print(f"Failed to auto-insert symptom: {str(e)}")
    
    import backend.vector_db as vector_db
    
    # Compute embeddings in chunks
    chunk_size = 500
    overlap = 50
    chunks = []
    vectors = []
    
    if len(text_content) > chunk_size:
        for i in range(0, len(text_content), chunk_size - overlap):
            chunks.append(text_content[i:i+chunk_size])
            if i + chunk_size >= len(text_content):
                break
    elif text_content:
        chunks.append(text_content)
        
    for chunk in chunks:
        embedding = gemini_handler.generate_embeddings(chunk)
        vectors.append(embedding)
        
    if chunks:
        vector_db.insert_embeddings(doc_id, chunks, vectors)
        
    conn.commit()
    return {"id": doc_id, "filename": file.filename, "message": "Document uploaded, parsed, and clinical data auto-extracted."}

@app.delete("/api/documents/{id}")
def delete_document(id: int, conn: sqlite3.Connection = Depends(get_db)):
    cursor = conn.cursor()
    # Need to fetch filepath to delete the actual file
    cursor.execute("SELECT filepath FROM documents WHERE id = ?", (id,))
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Document not found")
        
    filepath = row["filepath"]
    
    # Delete from DB (embeddings will cascade if foreign keys are ON)
    cursor.execute("DELETE FROM documents WHERE id = ?", (id,))
    conn.commit()
    
    # Delete from LanceDB
    import backend.vector_db as vector_db
    vector_db.delete_embeddings(id)
    
    # Delete file from disk
    try:
        if os.path.exists(filepath):
            os.remove(filepath)
    except Exception as e:
        print(f"Failed to delete file {filepath}: {str(e)}")
        
    return {"message": "Document deleted"}

# --- ASSISTANT / CHAT RAG API ---
@app.post("/api/assistant/chat")
def chat_assistant(req: ChatRequest, conn: sqlite3.Connection = Depends(get_db)):
    """
    RAG Chat endpoint. Searches local documents (via vector similarity) 
    and/or runs a real-time web search, passing both as context to Gemini.
    """
    local_context_str = ""
    
    if req.search_records:
        # Gather local SQLite records context
        cursor = conn.cursor()
        
        # 1. Active Medications
        cursor.execute("SELECT name, dosage, frequency, refills_remaining, last_refill_date, notes FROM medications")
        meds = cursor.fetchall()
        meds_str = "\n".join([
            f"- {m['name']} {m['dosage']} ({m['frequency']}) | Refills left: {m['refills_remaining']} | Last refill: {m['last_refill_date']}. Notes: {m['notes']}"
            for m in meds
        ])
        
        # 2. Upcoming Appointments
        cursor.execute("SELECT title, date, doctor, location, notes FROM appointments WHERE date >= ?", (datetime.now().strftime("%Y-%m-%dT%H:%M"),))
        apps = cursor.fetchall()
        apps_str = "\n".join([
            f"- Appointment: {a['title']} with {a['doctor']} on {a['date']} at {a['location']}. Notes: {a['notes']}"
            for a in apps
        ])
        
        # 3. Recent Symptoms (last 5 entries)
        cursor.execute("SELECT date, pain, pain_location, fatigue, nausea, fever, constipation, other, other_description, notes FROM symptoms ORDER BY date DESC LIMIT 5")
        syms = cursor.fetchall()
        syms_str = "\n".join([
            f"- Date {s['date']}: Pain={s['pain']}/10 ({s['pain_location'] or 'not specified'}), Fatigue={s['fatigue']}/10, Nausea={s['nausea']}/10, Fever={s['fever']}/10, Constipation={s['constipation']}/10, Other={s['other']}/10 ({s['other_description'] or 'no description'}). Notes: {s['notes']}"
            for s in syms
        ])
        
        # 4. Timeline Milestones (Surgeries, scans, etc.)
        cursor.execute("SELECT event_date, event_type, title, description, details_json FROM timeline_events ORDER BY event_date DESC LIMIT 20")
        events = cursor.fetchall()
        events_str = "\n".join([
            f"- Event ({e['event_date']} - {e['event_type']}): {e['title']}. Description: {e['description']}. Details: {e['details_json']}"
            for e in events
        ])
        
        # 5. Semantic Search over uploaded documents (Vector Search)
        import backend.vector_db as vector_db
        query_vector = gemini_handler.generate_embeddings(req.query)
        results = vector_db.search_embeddings(query_vector, limit=3)
        top_chunks = [item["text"] for item in results if item["_distance"] < 0.6]
        documents_str = "\n".join([f"- Doc Excerpt: {chunk}" for chunk in top_chunks])
        
        # Assemble local context text block
        local_context_parts = []
        if meds_str:
            local_context_parts.append(f"Active Medications:\n{meds_str}")
        if apps_str:
            local_context_parts.append(f"Upcoming Appointments:\n{apps_str}")
        if syms_str:
            local_context_parts.append(f"Recent Symptom Logs:\n{syms_str}")
        if events_str:
            local_context_parts.append(f"Historical Medical Milestones:\n{events_str}")
        if documents_str:
            local_context_parts.append(f"Relevant Uploaded Records:\n{documents_str}")
            
        local_context_str = "\n\n".join(local_context_parts)
        if len(local_context_str) > 8000:
            local_context_str = local_context_str[:8000] + "\n\n[Context truncated due to length limits]"
            
    # Call Gemini RAG logic
    result = gemini_handler.answer_query_with_rag(
        query=req.query,
        search_web=req.search_web,
        search_records=req.search_records,
        local_records_context=local_context_str
    )
    return result

if __name__ == "__main__":
    import uvicorn
    # Make sure database is seeded on start
    import backend.db as db
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
