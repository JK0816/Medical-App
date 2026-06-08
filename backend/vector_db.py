import os
import lancedb
import logging

logger = logging.getLogger(__name__)

# Locate the LanceDB database directory inside uploads
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LANCE_DB_DIR = os.path.join(BASE_DIR, "uploads", "vector_db")
os.makedirs(LANCE_DB_DIR, exist_ok=True)

TABLE_NAME = "document_embeddings"

# Module-level cached handles for performance
_db_instance = None
_table_instance = None

def get_db():
    global _db_instance
    if _db_instance is None:
        _db_instance = lancedb.connect(LANCE_DB_DIR)
    return _db_instance

def get_table():
    global _table_instance
    if _table_instance is not None:
        return _table_instance
    db = get_db()
    if TABLE_NAME in db.table_names():
        _table_instance = db.open_table(TABLE_NAME)
    else:
        # Create table with a dummy row to initialize schema
        # Gemini embedding dimension is 768
        dummy_row = {
            "document_id": 0,
            "text": "initialization_sentinel",
            "vector": [0.0] * 768
        }
        logger.info("Initializing LanceDB table 'document_embeddings' with sentinel row.")
        _table_instance = db.create_table(TABLE_NAME, data=[dummy_row])
    return _table_instance

def insert_embeddings(document_id: int, chunks: list[str], vectors: list[list[float]]):
    """
    Inserts a list of text chunks and their corresponding embedding vectors into LanceDB.
    """
    if not chunks or not vectors:
        return
        
    tbl = get_table()
    data = []
    for chunk, vector in zip(chunks, vectors):
        data.append({
            "document_id": document_id,
            "text": chunk,
            "vector": vector
        })
    tbl.add(data)
    logger.info(f"Successfully indexed {len(chunks)} chunks in LanceDB for document_id={document_id}")

def search_embeddings(query_vector: list[float], limit: int = 3) -> list[dict]:
    """
    Searches the LanceDB table for nearest neighbors using cosine similarity.
    Returns a list of dicts containing 'document_id', 'text', and '_distance'.
    """
    try:
        tbl = get_table()
        # Query nearest neighbors using cosine similarity
        results = tbl.search(query_vector).metric("cosine").limit(limit + 5).to_list()
        
        # Filter out sentinel row if present
        filtered_results = [
            item for item in results 
            if item.get("document_id") != 0
        ]
        
        # Limit to the requested size
        return filtered_results[:limit]
    except Exception as e:
        logger.error(f"Error performing LanceDB vector search: {str(e)}")
        return []

def delete_embeddings(document_id: int):
    """
    Deletes all chunks belonging to the specified document ID from LanceDB.
    """
    try:
        tbl = get_table()
        tbl.delete(f"document_id = {document_id}")
        logger.info(f"Deleted vector index for document_id={document_id} from LanceDB.")
    except Exception as e:
        logger.error(f"Failed to delete LanceDB vectors for document_id={document_id}: {str(e)}")
