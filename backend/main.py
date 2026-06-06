# pyrefly: ignore [missing-import]
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
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
    title: str
    date: str
    doctor: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None

class MedicationCreate(BaseModel):
    name: str
    dosage: str
    frequency: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    refills_remaining: Optional[int] = 0
    notes: Optional[str] = None

class SymptomCreate(BaseModel):
    date: str
    pain: int = Field(..., ge=1, le=10)
    dry_mouth: int = Field(..., ge=1, le=10)
    swallowing_difficulty: int = Field(..., ge=1, le=10)
    facial_numbness: int = Field(..., ge=1, le=10)
    fatigue: int = Field(..., ge=1, le=10)
    notes: Optional[str] = None

class TimelineEventCreate(BaseModel):
    event_date: str
    event_type: str # "Diagnosis", "Surgery", "Radiation", "Scan", "Medication Change", "Other"
    title: str
    description: Optional[str] = None
    details_json: Optional[str] = None # Expecting a JSON-serialized string

class ChatRequest(BaseModel):
    query: str
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
        INSERT INTO symptoms (date, pain, dry_mouth, swallowing_difficulty, facial_numbness, fatigue, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (item.date, item.pain, item.dry_mouth, item.swallowing_difficulty, item.facial_numbness, item.fatigue, item.notes))
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

@app.post("/api/dicom/upload")
async def upload_dicom(file: UploadFile = File(...), conn: sqlite3.Connection = Depends(get_db)):
    """
    Uploads a .dcm file or a .zip of .dcm files, parses metadata, generates PNG slices, 
    and requests Gemini to provide a clinical interpretation report.
    """
    if not file.filename.lower().endswith((".dcm", ".dicom", ".zip")):
        raise HTTPException(status_code=400, detail="Only DICOM (.dcm) or ZIP (.zip) files are supported.")
    
    # Check file size
    contents = await file.read()
    if len(contents) > MAX_UPLOAD_SIZE * 5: # Allow larger uploads for ZIPs
        raise HTTPException(status_code=413, detail=f"File too large.")
    await file.seek(0)
        
    # Save the uploaded file
    filename = f"{uuid.uuid4()}_{file.filename}"
    filepath = os.path.join(DOCS_DIR, filename)
    
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Parse the DICOM file(s)
    if file.filename.lower().endswith(".zip"):
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
        raise HTTPException(status_code=422, detail=parsed_data["error"])
        
    # Trigger Gemini multimodal interpretation
    slice_url = parsed_data.get("slice_image_url")
    if slice_url:
        try:
            # Convert relative URL back to local file path
            relative_path = slice_url.replace("/static/", "")
            local_png_path = os.path.join(UPLOADS_DIR, relative_path)
            
            # Get interpretation
            report = gemini_handler.interpret_dicom(parsed_data, local_png_path)
            parsed_data["interpretation"] = report
        except Exception as e:
            parsed_data["interpretation"] = {"error": f"AI interpretation failed: {str(e)}", "clinical_impression": "Upload succeeded, but interpretation failed."}
    else:
        parsed_data["interpretation"] = {"error": "Could not generate slice image for AI interpretation."}
        
    # Also log this scan as a Timeline Event automatically!
    try:
        cursor = conn.cursor()
        
        # Format timeline details
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
        conn.commit()
    except Exception as e:
        # Don't fail the whole request if timeline logging fails
        print(f"Failed to auto-log scan to timeline: {str(e)}")
        
    return parsed_data

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
    
    # Check file size
    contents = await file.read()
    if len(contents) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail=f"File too large. Maximum size is {MAX_UPLOAD_SIZE // (1024*1024)} MB.")
    await file.seek(0)
        
    filename = f"{uuid.uuid4()}_{file.filename}"
    filepath = os.path.join(DOCS_DIR, filename)
    
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
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
                    INSERT INTO symptoms (date, pain, dry_mouth, swallowing_difficulty, facial_numbness, fatigue, notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    symp.get("date", datetime.now().strftime("%Y-%m-%d")),
                    symp.get("pain", 1),
                    symp.get("dry_mouth", 1),
                    symp.get("swallowing_difficulty", 1),
                    symp.get("facial_numbness", 1),
                    symp.get("fatigue", 1),
                    symp.get("notes", "Auto-extracted from document.")
                ))
            except Exception as e:
                print(f"Failed to auto-insert symptom: {str(e)}")
    
    # Compute embeddings in chunks
    chunk_size = 500
    overlap = 50
    if len(text_content) > chunk_size:
        all_chunks = []
        for i in range(0, len(text_content), chunk_size - overlap):
            all_chunks.append(text_content[i:i+chunk_size])
            if i + chunk_size >= len(text_content):
                break
                
        for chunk in all_chunks:
            embedding = gemini_handler.generate_embeddings(chunk)
            cursor.execute("""
                INSERT INTO document_embeddings (document_id, chunk_text, embedding_vector)
                VALUES (?, ?, ?)
            """, (doc_id, chunk, json.dumps(embedding)))
    elif text_content:
        embedding = gemini_handler.generate_embeddings(text_content)
        cursor.execute("""
            INSERT INTO document_embeddings (document_id, chunk_text, embedding_vector)
            VALUES (?, ?, ?)
        """, (doc_id, text_content, json.dumps(embedding)))
        
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
        cursor.execute("SELECT date, pain, dry_mouth, swallowing_difficulty, facial_numbness, fatigue, notes FROM symptoms ORDER BY date DESC LIMIT 5")
        syms = cursor.fetchall()
        syms_str = "\n".join([
            f"- Date {s['date']}: Pain={s['pain']}/10, Dry Mouth={s['dry_mouth']}/10, Swallowing Difficulty={s['swallowing_difficulty']}/10, Facial Numbness={s['facial_numbness']}/10, Fatigue={s['fatigue']}/10. Notes: {s['notes']}"
            for s in syms
        ])
        
        # 4. Timeline Milestones (Surgeries, scans, etc.)
        cursor.execute("SELECT event_date, event_type, title, description, details_json FROM timeline_events ORDER BY event_date DESC")
        events = cursor.fetchall()
        events_str = "\n".join([
            f"- Event ({e['event_date']} - {e['event_type']}): {e['title']}. Description: {e['description']}. Details: {e['details_json']}"
            for e in events
        ])
        
        # 5. Semantic Search over uploaded documents (Vector Search)
        query_vector = gemini_handler.generate_embeddings(req.query)
        cursor.execute("SELECT id, document_id, chunk_text, embedding_vector FROM document_embeddings")
        all_chunks = cursor.fetchall()
        
        # Rank chunks by cosine similarity in python
        q_vec = np.array(query_vector)
        norm_q = np.linalg.norm(q_vec) if q_vec.size > 0 else 0.0
        
        if norm_q > 0 and all_chunks and len(query_vector) == 768:
            # Parse embeddings once and filter valid 768-dim vectors
            parsed_chunks = []
            for chunk in all_chunks:
                try:
                    vec = json.loads(chunk["embedding_vector"])
                    if len(vec) == 768:
                        parsed_chunks.append((chunk["chunk_text"], vec))
                except (json.JSONDecodeError, TypeError):
                    continue
            
            if not parsed_chunks:
                ranked_chunks = [(0.0, chunk["chunk_text"]) for chunk in all_chunks]
            else:
                chunks_text = [pc[0] for pc in parsed_chunks]
                c_vecs = np.array([pc[1] for pc in parsed_chunks])
                
                # Vectorized cosine similarity
                dot_products = np.dot(c_vecs, q_vec)
                norm_cs = np.linalg.norm(c_vecs, axis=1)
                
                valid_norms = norm_cs > 0
                sims = np.zeros(len(c_vecs))
                sims[valid_norms] = dot_products[valid_norms] / (norm_q * norm_cs[valid_norms])
                
                ranked_chunks = list(zip(sims, chunks_text))
        else:
            ranked_chunks = [(0.0, chunk["chunk_text"]) for chunk in all_chunks]
            
        ranked_chunks.sort(key=lambda x: x[0], reverse=True)
        top_chunks = [item[1] for item in ranked_chunks[:3] if item[0] > 0.4]  # similarity threshold
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
