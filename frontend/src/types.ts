export interface Appointment {
  id: number;
  title: string;
  date: string; // ISO format
  doctor?: string;
  location?: string;
  notes?: string;
  created_at?: string;
}

export interface Medication {
  id: number;
  name: string;
  dosage: string;
  frequency: string;
  start_date?: string;
  end_date?: string;
  refills_remaining: number;
  last_refill_date?: string;
  notes?: string;
  created_at?: string;
}

export interface SymptomLog {
  id: number;
  date: string; // YYYY-MM-DD
  pain?: number;
  pain_location?: string;
  fatigue?: number;
  nausea?: number;
  fever?: number;
  constipation?: number;
  other?: number;
  other_description?: string;
  notes?: string;
  created_at?: string;
}

export interface TimelineEvent {
  id: number;
  event_date: string; // YYYY-MM-DD
  event_type: 'Diagnosis' | 'Surgery' | 'Radiation' | 'Scan' | 'Medication Change' | 'Other';
  title: string;
  description?: string;
  details_json?: string;
  details?: Record<string, any>;
  created_at?: string;
}

export interface DocumentRecord {
  id: number;
  filename: string;
  filepath: string;
  filetype: string;
  upload_date?: string;
  summary?: string;
  text_content?: string;
}

export interface Citation {
  title: string;
  url: string;
  snippet: string;
}

export interface ChatMessage {
  sender: 'user' | 'assistant';
  text: string;
  citations?: Citation[];
  mode?: string;
}
