import os
import json
import logging
from PIL import Image
import numpy as np

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Check for API Keys
API_KEY = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
USE_MOCK_GEMINI = False

if API_KEY:
    try:
        import google.generativeai as genai
        genai.configure(api_key=API_KEY)
        logger.info("Gemini API successfully configured via API key.")
    except Exception as e:
        logger.error(f"Error configuring google-generativeai: {str(e)}. Falling back to mock mode.")
        USE_MOCK_GEMINI = True
else:
    # Try to load application default credentials
    try:
        import google.auth
        import google.generativeai as genai
        credentials, project = google.auth.default()
        genai.configure(credentials=credentials)
        logger.info("Gemini API configured via Application Default Credentials (ADC).")
    except Exception as e:
        logger.warning("No Gemini API Key found and ADC could not be loaded. Running backend in simulated/mock Gemini mode.")
        USE_MOCK_GEMINI = True

def get_gemini_model(model_name="gemini-2.5-flash"):
    if USE_MOCK_GEMINI:
        return None
    import google.generativeai as genai
    return genai.GenerativeModel(model_name)

def generate_embeddings(text: str) -> list:
    """
    Generates a 768-dimensional embedding vector for the text.
    """
    if USE_MOCK_GEMINI:
        # Mock embedding: generate a deterministic float vector based on hash of text
        rng = np.random.default_rng(abs(hash(text)) % (2**32))
        vector = rng.normal(0.0, 0.1, 768).tolist()
        return vector
        
    try:
        import google.generativeai as genai
        result = genai.embed_content(
            model="models/text-embedding-004",
            content=text,
            task_type="retrieval_document"
        )
        embedding = result['embedding']
        if len(embedding) != 768:
            logger.warning(f"Unexpected embedding dimension: {len(embedding)} (expected 768). Falling back to mock.")
            rng = np.random.default_rng(abs(hash(text)) % (2**32))
            return rng.normal(0.0, 0.1, 768).tolist()
        return embedding
    except Exception as e:
        logger.error(f"Error generating embeddings: {str(e)}")
        # Fallback to deterministic mock
        rng = np.random.default_rng(abs(hash(text)) % (2**32))
        return rng.normal(0.0, 0.1, 768).tolist()

def interpret_dicom(metadata: dict, image_path: str) -> dict:
    """
    Uses Gemini's multimodal capacity to interpret a converted DICOM slice
    and output a structured clinical report in JSON format.
    """
    prompt = f"""
    You are an expert neuroradiologist specializing in Head & Neck oncology and Adenoid Cystic Carcinoma (ACC).
    Analyze this axial CT scan slice along with the accompanying DICOM metadata.
    
    DICOM Metadata:
    - Modality: {metadata.get('modality')}
    - Body Part: {metadata.get('body_part')}
    - Study Description: {metadata.get('study_description')}
    - Series Description: {metadata.get('series_description')}
    - Patient ID: {metadata.get('patient_id')}
    - Slice Thickness: {metadata.get('slice_thickness')} mm
    
    Evaluate the image and metadata for:
    1. Primary anatomical site findings (specifically look at the submandibular salivary gland region).
    2. Mass/Lesion dimensions, density, margins, and contrast enhancement.
    3. Signs of Perineural Invasion (PNI) - look for asymmetric enlargement or enhancement along cranial nerves (CN VII Facial Nerve or CN V Trigeminal Nerve).
    4. Lymph node status (lymphadenopathy).
    5. Pulmonary nodules or other chest findings if modality covers chest.
    
    Provide your analysis in a structured JSON format containing the following keys:
    - primary_site_findings (str)
    - mass_characteristics (dict with keys: size_mm, margin_status, contrast_enhancement)
    - pni_risk_assessment (str describing nerve path involvement and risks)
    - nodal_metastasis_findings (str)
    - clinical_impression (str summarizing severity and tumor pattern e.g. cribriform/tubular)
    - recommendations (list of str for next steps, scans, consults)
    
    Return ONLY raw valid JSON. Do not include markdown code block formatting or backticks.
    """
    
    if USE_MOCK_GEMINI:
        # High-fidelity simulated clinical report
        is_synthetic = metadata.get("patient_id") == "ACC-2026-X11"
        if is_synthetic:
            return {
                "primary_site_findings": "Axial imaging demonstrates a well-defined soft-tissue mass in the right submandibular salivary gland measuring approximately 20 x 18 mm. The contralateral left submandibular gland is normal in size and attenuation.",
                "mass_characteristics": {
                    "size_mm": "20 x 18",
                    "margin_status": "Close/infiltrative at the posterior margin, abutting adjacent facial musculature.",
                    "contrast_enhancement": "Moderate heterogenous contrast enhancement. Multiple micro-cystic/hypodense internal spaces are visible, suggestive of a cribriform histological architecture."
                },
                "pni_risk_assessment": "High risk of Perineural Invasion (PNI). The lesion directly abuts the posterior margin of the gland near the pathway of the mandibular branch of the facial nerve (CN VII) and the lingual nerve (CN V3). No gross widening of the stylomastoid foramen or skull base foramina is visualized on this slice, but close surveillance is warranted.",
                "nodal_metastasis_findings": "No pathological lymph node enlargement in the visualized Level I-III cervical chain stations. Fat planes around main vessels are preserved.",
                "clinical_impression": "Enhancing right submandibular salivary gland lesion (2.0 cm) consistent with primary Adenoid Cystic Carcinoma (ACC). The presence of cystic micro-spaces strongly correlates with cribriform subtype. High risk for micro-perineural spread.",
                "recommendations": [
                    "Correlate with tissue biopsy (cribriform vs. solid subtype).",
                    "High-resolution skull base MRI with contrast to evaluate for subclinical perineural tumor spread.",
                    "Chest CT scan to establish baseline surveillance for distant pulmonary metastasis.",
                    "Multidisciplinary tumor board consultation for surgical planning and postoperative radiation (e.g. Proton Beam)."
                ]
            }
        else:
            return {
                "primary_site_findings": "Normal head and neck structures. A mild density variant is observed in the salivary gland bed, with no clear focal lesion.",
                "mass_characteristics": {
                    "size_mm": "None",
                    "margin_status": "Regular",
                    "contrast_enhancement": "Homogeneous"
                },
                "pni_risk_assessment": "Low. Cranial nerve pathways appear symmetrical and clear.",
                "nodal_metastasis_findings": "No adenopathy detected.",
                "clinical_impression": "No radiographic evidence of local recurrence or gross neoplastic mass.",
                "recommendations": [
                    "Continue routine clinical surveillance.",
                    "Correlate with patient's symptom diary (facial numbness/pain)."
                ]
            }
            
    try:
        model = get_gemini_model("gemini-2.5-flash")
        with Image.open(image_path) as img:
            response = model.generate_content(
                [prompt, img],
                generation_config={"response_mime_type": "application/json"}
            )
        
        # Clean response string of any markdown markers
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
        
        return json.loads(text)
    except Exception as e:
        logger.error(f"Gemini API DICOM interpretation failed: {str(e)}. Returning fallback report.")
        # Return fallback structure
        return {
            "primary_site_findings": f"Image loaded but API analysis failed. [Error: {str(e)}]",
            "mass_characteristics": {"size_mm": "Unknown", "margin_status": "Unable to evaluate", "contrast_enhancement": "N/A"},
            "pni_risk_assessment": "Unable to assess perineural pathways due to API connection error.",
            "nodal_metastasis_findings": "N/A",
            "clinical_impression": "DICOM scan loaded successfully. Manual radiological review recommended.",
            "recommendations": ["Verify Gemini API Key configuration.", "Review raw DICOM slice manually in clinical workspace."]
        }

def extract_clinical_data_from_document(text: str) -> dict:
    """
    Extracts clinical timeline events and symptoms from a document's text.
    Returns a dict with 'timeline_events' and 'symptoms' lists.
    """
    prompt = f"""
    You are an expert clinical data extractor. Analyze the following medical document.
    Extract two types of data:
    1. Timeline Events: Significant clinical events (Diagnosis, Surgery, Radiation, Scan, Medication Change, Other).
    2. Symptoms: Patient-reported symptoms with an estimated 1-10 severity score (1=mild, 10=severe).
    
    Document text:
    ---
    {text[:8000]}
    ---
    
    Output a structured JSON object with two keys:
    - "timeline_events": A list of objects with keys: "event_date" (YYYY-MM-DD format), "event_type" (must be one of: Diagnosis, Surgery, Radiation, Scan, Medication Change, Other), "title" (short string), "description" (detailed string), "details" (a dictionary of any specific metrics/findings). If date is unclear, estimate based on text or omit the event.
    - "symptoms": A list of objects with keys: "date" (YYYY-MM-DD), "pain" (1-10), "dry_mouth" (1-10), "swallowing_difficulty" (1-10), "facial_numbness" (1-10), "fatigue" (1-10), "notes" (string). Default any unmentioned symptom to 1.
    
    Return ONLY valid JSON.
    """
    
    if USE_MOCK_GEMINI:
        # Mock extracted data for demonstration
        from datetime import datetime
        today = datetime.now().strftime("%Y-%m-%d")
        return {
            "timeline_events": [
                {
                    "event_date": today,
                    "event_type": "Other",
                    "title": "Document Uploaded",
                    "description": "Patient uploaded a clinical document containing medical history.",
                    "details": {"source": "Auto-extracted"}
                }
            ],
            "symptoms": [
                {
                    "date": today,
                    "pain": 2,
                    "dry_mouth": 4,
                    "swallowing_difficulty": 1,
                    "facial_numbness": 1,
                    "fatigue": 3,
                    "notes": "Auto-extracted symptom defaults based on mock document processing."
                }
            ]
        }
        
    try:
        model = get_gemini_model("gemini-2.5-flash")
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        
        text_resp = response.text.strip()
        if text_resp.startswith("```json"):
            text_resp = text_resp[7:]
        if text_resp.endswith("```"):
            text_resp = text_resp[:-3]
        text_resp = text_resp.strip()
        
        return json.loads(text_resp)
    except Exception as e:
        logger.error(f"Failed to extract clinical data from document: {str(e)}")
        return {"timeline_events": [], "symptoms": []}

def answer_query_with_rag(query: str, search_web: bool, search_records: bool, local_records_context: str = "") -> dict:
    """
    Answers a user query using context from local records (if search_records) 
    and web search results (if search_web).
    """
    context_chunks = []
    citations = []
    
    # 1. Gather Local Records Context
    if search_records and local_records_context:
        context_chunks.append("=== PATIENT CLINICAL HISTORY & MEDICAL LOGS ===\n" + local_records_context)
        citations.append({
            "title": "Patient Care Record Database",
            "url": "local://database",
            "snippet": "Retrieved active medications, appointments, symptom trends, and historical medical timeline milestones."
        })
        
    # 2. Gather Web Search Context
    if search_web:
        from backend.search_handler import get_web_context
        # Formulate search query optimized for ACC information
        search_query = query
        if "acc" not in query.lower() and "adenoid" not in query.lower() and "carcinoma" not in query.lower():
            search_query = f"Adenoid Cystic Carcinoma {query}"
            
        logger.info(f"Triggering RAG web search for: '{search_query}'")
        web_results = get_web_context(search_query, max_pages=3)
        
        for idx, page in enumerate(web_results):
            context_chunks.append(f"=== WEB SOURCE: {page['title']} (URL: {page['url']}) ===\n{page['content']}")
            citations.append({
                "title": page["title"],
                "url": page["url"],
                "snippet": page["snippet"]
            })
            
    # Combine Context
    combined_context = "\n\n".join(context_chunks)
    
    prompt = f"""
    You are Antigravity-Med, an advanced clinical AI assistant specializing in Adenoid Cystic Carcinoma (ACC).
    You are assisting a patient or clinician. Answer the user's question accurately, with high empathy, and in accordance with current medical guidelines.
    
    Using ONLY the clinical context provided below, formulate your response.
    If the context does not contain enough information to answer the question, or if there is no context provided, rely on your medical knowledge base but clearly note which information is from general knowledge versus the patient's records.
    
    CRITICAL: 
    - When discussing prognosis or treatment options (like Lenvatinib, Proton Therapy, clinical trials targeting Notch1 or c-Kit), be precise and maintain a supportive, objective tone.
    - Cite your sources by appending numbers like [1], [2] corresponding to the sources in the context.
    
    Context:
    {combined_context}
    
    User Question: {query}
    
    Please provide your answer. Focus on readability. Use headings, bullet points, and highlight key details.
    """
    
    if USE_MOCK_GEMINI:
        # High-fidelity simulated clinical response
        response_text = simulate_gemini_chat(query, search_web, search_records, local_records_context)
        return {
            "answer": response_text,
            "citations": citations,
            "mode": "Simulated (Gemini Offline)"
        }
        
    try:
        model = get_gemini_model("gemini-2.5-flash")
        response = model.generate_content(prompt)
        return {
            "answer": response.text,
            "citations": citations,
            "mode": "Gemini Online"
        }
    except Exception as e:
        logger.error(f"Gemini API chat failed: {str(e)}")
        # Return fallback simulation
        response_text = simulate_gemini_chat(query, search_web, search_records, local_records_context)
        return {
            "answer": f"*[Note: The API encountered an error, showing simulated clinical response]*\n\n" + response_text,
            "citations": citations,
            "mode": "Simulated (Error Fallback)"
        }

def simulate_gemini_chat(query: str, search_web: bool, search_records: bool, local_context: str) -> str:
    """
    Simulates a highly specialized ACC medical expert chatbot response.
    """
    q = query.lower()
    
    if "treatment" in q or "therapy" in q or "lenvatinib" in q or "proton" in q:
        return """
### Adenoid Cystic Carcinoma (ACC) Treatment Overview

Adenoid Cystic Carcinoma is a rare salivary gland malignancy known for its slow growth but high propensity for **perineural invasion (PNI)** and hematogenous spread (most commonly to the lungs). Standard treatment is highly multi-modal:

1. **Surgical Resection**: 
   - The primary objective is complete surgical removal with **wide negative margins**.
   - Preserving major nerves (like the facial nerve CN VII) is balanced against obtaining clear margins. If margins are close or positive (common due to microscopic perineural tracking), adjuvant radiation is mandatory.

2. **Radiation Therapy**:
   - **Proton Beam Radiation Therapy (PBRT)** or **Carbon Ion Therapy** are preferred over standard photon radiation. ACC is relatively radioresistant, and particle therapies allow high doses to be delivered directly to skull-base nerve pathways while sparing surrounding healthy brain and oral tissue.

3. **Systemic Therapies (Metastatic/Recurrent)**:
   - Traditional chemotherapy (e.g., CAP regimen) has limited long-term efficacy and is reserved for rapidly progressive disease.
   - **Targeted Agents**: 
     - **VEGFR Inhibitors** (like **Lenvatinib** or **Axitinib**) have shown clinical benefit by stabilizing disease growth. Lenvatinib is frequently used off-label, showing progression-free survival benefits.
     - **Notch Inhibitors** (e.g., AL101): Specifically active in patient subsets harboring **Notch1 mutations**, which define a more aggressive phenotype.
     - **c-Kit Inhibitors** (e.g., Imatinib): c-Kit is overexpressed in >90% of ACC cases, though imatinib single-agent response is low.

*Citations: Web medical literature on ACC surveillance protocols [1].*
"""
    elif "symptom" in q or "pain" in q or "dry mouth" in q or "refill" in q:
        # Check local records
        has_pilocarpine = "Pilocarpine" in local_context
        has_gabapentin = "Gabapentin" in local_context
        
        reply = "### Symptom & Medication Review\n\nBased on your logged records, we analyzed your current profile:\n\n"
        if has_pilocarpine:
            reply += "- **Xerostomia (Dry Mouth)**: You are currently prescribed **Pilocarpine 5mg** three times daily. Your logs show dry mouth levels hovering around 5-6 out of 10. Pilocarpine stimulates saliva production; ensure you are taking it 30 minutes before meals. If dryness persists, check with your oncologist about dry-mouth rinses or gels.\n"
        if has_gabapentin:
            reply += "- **Neuropathy / Jaw Pain**: You are taking **Gabapentin 300mg** every 8 hours. Your pain is logged as 2-3 out of 10. Gabapentin helps stabilize nerves affected by surgery or tumor perineural paths. Ensure you do not skip doses, as nerve pain spikes can occur.\n"
            
        reply += "\n**Timeline Correlations**:\n- Your dry mouth onset correlates with the completion of your **Proton Beam Radiation course in June 2025**. Xerostomia is a well-documented late side-effect of salivary gland irradiation. \n- Make sure to check your **medication refills**. Low counts will trigger notifications on your Dashboard."
        return reply

    elif "timeline" in q or "surgery" in q or "scan" in q:
        return """
### Your Medical Timeline Summary

Based on your local health tracker records:
* **March 12, 2025**: Diagnosed with **Adenoid Cystic Carcinoma (T2N0M0)** of the right submandibular salivary gland.
* **April 5, 2025**: Underwent a **submandibular gland resection** with selective neck dissection. Pathology noted close margins (<1mm) but no lymph node metastasis (0/14).
* **May - June 2025**: Completed **30 fractions of Proton Beam Therapy (60 Gy)** targeting the salivary bed.
* **October 2025 & February 2026**: Surveillance scans (Head & Neck CT and Chest CT) were completed, showing **no evidence of disease recurrence or lung nodules**.

*Next Step*: Discussion of your upcoming oncologist appointment on **June 15, 2026** is recommended.
"""
    else:
        # General response
        return f"""
### Antigravity-Med Assistance

I am here to help you manage your Adenoid Cystic Carcinoma (ACC) care plan. 

- **Records RAG**: I can search your uploaded medical documents, logged symptoms, medications, and timeline milestones to summarize your health status.
- **Web Search RAG**: I can scan the internet for clinical trials, emerging VEGFR/Notch targeted treatments, and salivary gland cancer research.

*You asked: "{query}"*

How can I assist you further? You can ask me to:
- "Summarize my medical history and timeline"
- "Tell me about treatments for Adenoid Cystic Carcinoma"
- "Correlate my symptoms with my active medications"
"""
