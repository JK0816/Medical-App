import sqlite3
import os
import json
from datetime import datetime
from contextlib import closing

DB_PATH = os.path.join(os.path.dirname(__file__), "medical_app.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn

def get_db():
    conn = get_db_connection()
    try:
        yield conn
    finally:
        conn.close()

def init_db():
    with closing(get_db_connection()) as conn:
        with conn:
            cursor = conn.cursor()
            
            # 1. Appointments Table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS appointments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                date TEXT NOT NULL, -- ISO Format: YYYY-MM-DDTHH:MM
                doctor TEXT,
                location TEXT,
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """)
            
            # 2. Medications Table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS medications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                dosage TEXT NOT NULL,       -- e.g., "400mg" or "2 tablets"
                frequency TEXT NOT NULL,    -- e.g., "Once daily" or "Every 8 hours"
                start_date TEXT,            -- YYYY-MM-DD
                end_date TEXT,              -- YYYY-MM-DD
                refills_remaining INTEGER DEFAULT 0,
                last_refill_date TEXT,      -- YYYY-MM-DD
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """)
            
            # Safe additive schema migration for symptoms table
            # Instead of dropping the table (which destroys user data), add missing columns
            cursor.execute("PRAGMA table_info(symptoms)")
            existing_cols = {col[1] for col in cursor.fetchall()}
            if existing_cols:  # Table already exists
                migrations = {
                    "pain_location": "TEXT",
                    "constipation": "INTEGER CHECK(constipation BETWEEN 1 AND 10)",
                    "other": "INTEGER CHECK(other BETWEEN 1 AND 10)",
                    "other_description": "TEXT",
                }
                for col_name, col_type in migrations.items():
                    if col_name not in existing_cols:
                        try:
                            cursor.execute(f"ALTER TABLE symptoms ADD COLUMN {col_name} {col_type}")
                        except sqlite3.OperationalError:
                            pass  # Column may already exist in a different form

            # 3. Symptoms Table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS symptoms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL, -- YYYY-MM-DD
                pain INTEGER CHECK(pain BETWEEN 1 AND 10),
                pain_location TEXT,
                fatigue INTEGER CHECK(fatigue BETWEEN 1 AND 10),
                nausea INTEGER CHECK(nausea BETWEEN 1 AND 10),
                fever INTEGER CHECK(fever BETWEEN 1 AND 10),
                constipation INTEGER CHECK(constipation BETWEEN 1 AND 10),
                other INTEGER CHECK(other BETWEEN 1 AND 10),
                other_description TEXT,
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """)

            # 3.5. DICOM Tasks Table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS dicom_tasks (
                id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                status TEXT NOT NULL, -- 'Queued', 'Processing', 'Interpreting', 'Completed', 'Failed'
                result_json TEXT,     -- JSON string containing parsed metadata and report
                error_message TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """)
            
            # 4. Documents Table (For RAG)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT NOT NULL,
                filepath TEXT NOT NULL,
                filetype TEXT NOT NULL, -- "pdf", "txt", "dicom", etc.
                upload_date TEXT DEFAULT CURRENT_TIMESTAMP,
                summary TEXT,
                text_content TEXT
            )
            """)
            
            # 5. Document Embeddings Table (For local RAG index)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS document_embeddings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                document_id INTEGER,
                chunk_text TEXT NOT NULL,
                embedding_vector TEXT NOT NULL, -- JSON-serialized float list
                FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE
            )
            """)
            
            # 6. Timeline Events Table (Interactive findings timeline)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS timeline_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_date TEXT NOT NULL, -- YYYY-MM-DD
                event_type TEXT NOT NULL, -- "Diagnosis", "Surgery", "Radiation", "Scan", "Medication Change", "Other"
                title TEXT NOT NULL,
                description TEXT,
                details_json TEXT, -- JSON string containing specific metrics or findings (e.g., margins, SUV max, dosage change)
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """)
            
            # 7. Create Indexes for Performance
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_document_embeddings_doc_id ON document_embeddings(document_id);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_timeline_events_date ON timeline_events(event_date);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_symptoms_date ON symptoms(date);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);")

            # 8. App Settings Table (guards seed data, stores app state)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
            """)

# --- Seed Initial ACC Dummy Data if empty ---
def seed_dummy_data():
    with closing(get_db_connection()) as conn:
        with conn:
            cursor = conn.cursor()
            
            # Check the persistent 'seeded' flag — never re-insert if it was already done
            cursor.execute("SELECT value FROM app_settings WHERE key = 'db_seeded'")
            row = cursor.fetchone()
            if row and row[0] == 'true':
                return
            
            # Check if data already exists (first-run migration safety)
            cursor.execute("SELECT COUNT(*) FROM timeline_events")
            if cursor.fetchone()[0] > 0:
                # Data exists already — set the flag and return
                cursor.execute("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('db_seeded', 'true')")
                return
                
            # Seed timeline events
            events = [
                ("2025-03-12", "Diagnosis", "Initial ACC Diagnosis", 
                 "Biopsy of right submandibular mass confirmed Adenoid Cystic Carcinoma (cribriform pattern).",
                 json.dumps({"stage": "T2N0M0", "pattern": "Cribriform & Tubular", "perineural_invasion": "Detected"})),
                ("2025-04-05", "Surgery", "Submandibular Gland Resection", 
                 "Right submandibular gland resection with selective neck dissection (Levels I-III).",
                 json.dumps({"margin_status": "Close (<1mm) at posterior margin", "lymph_nodes_cleared": "0/14", "facial_nerve_status": "Preserved"})),
                ("2025-05-15", "Radiation", "Proton Therapy Course Commenced", 
                 "Began postoperative Proton Beam Radiation Therapy (PBRT) targeting the right submandibular bed and perineural pathways.",
                 json.dumps({"planned_dose_cgy": 6000, "fractions": 30, "target": "Right salivary bed & skull base cranial nerve pathways"})),
                ("2025-06-28", "Radiation", "Proton Therapy Completed", 
                 "Successfully completed full course of PBRT (60 Gy in 30 fractions) with minor acute mucositis and xerostomia.",
                 json.dumps({"final_dose_cgy": 6000, "tolerability": "Good, managed with oral rinses", "xerostomia_grade": 2})),
                ("2025-10-10", "Scan", "Follow-up Contrast CT (Head & Neck)", 
                 "First post-radiation follow-up CT scan. Stable surgical bed with no signs of local recurrence or perineural enhancement.",
                 json.dumps({"findings": "No soft tissue mass, surgical cavity clean, stable skull base.", "result_status": "Clear"})),
                ("2026-02-15", "Scan", "Chest CT Scan", 
                 "Baseline chest CT to screen for distant metastasis (standard surveillance protocol for ACC).",
                 json.dumps({"lung_nodules": "None detected", "findings": "Lungs clear, no mediastinal lymphadenopathy.", "result_status": "Clear"}))
            ]
            cursor.executemany("""
            INSERT INTO timeline_events (event_date, event_type, title, description, details_json)
            VALUES (?, ?, ?, ?, ?)
            """, events)
            
            # Seed appointments
            appointments = [
                ("Oncology Consultation", "2026-06-15T10:00", "Dr. Sarah Jenkins", "ACC Specialist Center", "Routine 3-month follow-up visit. Discuss recent MRI scans and dry mouth symptoms."),
                ("Routine Chest X-Ray", "2026-07-20T14:30", "Dr. Raymond Vance", "Radiology Imaging Partners", "6-month screening for lung surveillance.")
            ]
            cursor.executemany("""
            INSERT INTO appointments (title, date, doctor, location, notes)
            VALUES (?, ?, ?, ?, ?)
            """, appointments)
            
            # Seed medications
            medications = [
                ("Pilocarpine", "5mg", "Three times daily", "2025-06-30", "2026-12-31", 2, "2026-05-15", "For radiation-induced xerostomia (dry mouth). Take 30 minutes before meals."),
                ("Gabapentin", "300mg", "Every 8 hours", "2025-04-10", "2026-09-30", 4, "2026-05-25", "For post-surgical neuropathy and nerve pain in the right jaw region.")
            ]
            cursor.executemany("""
            INSERT INTO medications (name, dosage, frequency, start_date, end_date, refills_remaining, last_refill_date, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, medications)
            
            # Seed symptoms
            cursor.execute("SELECT COUNT(*) FROM symptoms")
            if cursor.fetchone()[0] == 0:
                symptoms = [
                    # date, pain, pain_location, fatigue, nausea, fever, constipation, other, other_description, notes
                    ("2026-05-28", 3, "Right jaw", 4, 1, 1, 2, None, None, "Jaw nerve pain managed. Slight fatigue."),
                    ("2026-05-30", 2, "Right jaw", 3, 2, 1, 1, 3, "Dry mouth", "Dry mouth noticeable."),
                    ("2026-06-01", 3, "Right cheek", 5, 1, 1, 2, 4, "Dry mouth", "Felt fatigued after work. Mild shooting pain in cheek."),
                    ("2026-06-03", 2, "Right jaw", 3, 1, 2, 1, None, None, "Overall stable day.")
                ]
                cursor.executemany("""
                INSERT INTO symptoms (
                    date, pain, pain_location, fatigue, nausea, fever, constipation, other, other_description, notes
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, symptoms)
            
            # Mark seed as complete — prevents re-insertion on subsequent restarts
            cursor.execute("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('db_seeded', 'true')")

# Initialize on import
init_db()
seed_dummy_data()
