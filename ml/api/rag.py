"""
rag.py — RAG (Retrieval-Augmented Generation) Service.

Handles embedding generation using sentence-transformers
and user-isolated semantic retrieval using FAISS.

Design Rules:
- MongoDB is the source of truth; FAISS is purely an indexing layer.
- Indexes are held in memory. They must be rebuilt by the Node backend upon restart.
- User isolation is mandatory. Each user gets an independent FAISS index.
"""

import logging
from typing import List, Dict, Any, Tuple
import faiss
import numpy as np
import threading

# Lazy load to avoid slowing down startup unless RAG is actually called
from fastembed import TextEmbedding

logger = logging.getLogger("detectiq-rag")

EMBEDDING_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
VECTOR_DIMENSION = 384

def normalize_embedding(vector: np.ndarray) -> np.ndarray:
    """Explicitly normalize vector to ensure Inner Product acts as Cosine Similarity."""
    vector = np.asarray(vector, dtype=np.float32).flatten()
    if vector.shape[0] != VECTOR_DIMENSION:
        raise ValueError(f"Embedding dimension mismatch: Expected {VECTOR_DIMENSION}, got {vector.shape[0]}")
    norm = np.linalg.norm(vector)
    if norm > 0:
        vector = vector / norm
    # FAISS expects 2D arrays: (batch_size, dimension)
    return vector.reshape(1, -1)


class RAGService:
    def __init__(self):
        self._is_loaded = False
        self.model = None
        # user_id -> { "index": faiss.IndexFlatIP, "id_map": { faiss_id: email_id }, "next_id": int }
        self.user_indexes: Dict[str, Dict[str, Any]] = {}
        threading.Thread(target=self._load_async, daemon=True).start()

    def _load_async(self):
        logger.info(f"Loading fastembed embedding model: {EMBEDDING_MODEL_NAME}...")
        try:
            self.model = TextEmbedding(model_name=EMBEDDING_MODEL_NAME, threads=1)
            logger.info("FastEmbed model loaded successfully on CPU.")
            self._is_loaded = True
        except Exception as e:
            logger.error(f"Failed to load embedding model: {e}")
            self._is_loaded = False
            self.model = None

    def is_loaded(self) -> bool:
        return self._is_loaded

    def get_user_index(self, user_id: str) -> Dict[str, Any]:
        """Get or create a user-specific FAISS index."""
        if user_id not in self.user_indexes:
            # Using Inner Product (cosine similarity proxy since vectors are normalized)
            index = faiss.IndexFlatIP(VECTOR_DIMENSION)
            self.user_indexes[user_id] = {
                "index": index,
                "id_map": {},  # faiss sequential ID -> MongoDB email ID
                "next_id": 0
            }
        return self.user_indexes[user_id]

    def clear_user_index(self, user_id: str):
        """Clear a user's index (useful for full rebuilds)."""
        if user_id in self.user_indexes:
            del self.user_indexes[user_id]

    def embed(self, user_id: str, email_id: str, text: str) -> bool:
        """Embed a single email and add it to the user's FAISS index."""
        if not self._is_loaded:
            raise RuntimeError("Embedding model is not loaded.")

        if not text.strip():
            return False

        # FastEmbed returns a generator of numpy arrays
        embeddings = list(self.model.embed([text]))
        if not embeddings:
            return False
            
        vector = normalize_embedding(embeddings[0])

        user_data = self.get_user_index(user_id)
        faiss_id = user_data["next_id"]
        
        # Add to FAISS index
        user_data["index"].add(vector)
        
        # Map FAISS ID to MongoDB Email ID
        user_data["id_map"][faiss_id] = email_id
        user_data["next_id"] += 1
        
        return True

    def retrieve(self, user_id: str, query_text: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """Retrieve the most similar emails for a user."""
        if not self._is_loaded:
            raise RuntimeError("Embedding model is not loaded.")

        if user_id not in self.user_indexes:
            raise ValueError("index_missing")

        user_data = self.user_indexes[user_id]
        if user_data["index"].ntotal == 0:
            return []
            
        if not query_text.strip():
            return []

        # Ensure we don't ask for more than exists
        k = min(top_k, user_data["index"].ntotal)

        # Generate query embedding and normalize identically
        embeddings = list(self.model.embed([query_text]))
        if not embeddings:
            return []
            
        vector = normalize_embedding(embeddings[0])

        # Search
        similarities, indices = user_data["index"].search(vector, k)

        results = []
        for i in range(k):
            faiss_id = int(indices[0][i])
            similarity = float(similarities[0][i])
            if faiss_id in user_data["id_map"]:
                results.append({
                    "emailId": user_data["id_map"][faiss_id],
                    "similarity": similarity
                })

        return results

    def build_rag_context(self, current_email: str, retrieved_emails: List[str]) -> str:
        """
        Format the retrieved legitimate emails and current email into a structured string
        for the Node backend to send to Groq.
        """
        context = "USER'S HISTORICAL LEGITIMATE EMAILS (For Baseline Comparison):\n"
        if not retrieved_emails:
            context += "No history available.\n"
        else:
            for i, email in enumerate(retrieved_emails):
                context += f"--- History {i+1} ---\n{email}\n"

        context += "\nCURRENT EMAIL TO ANALYZE:\n"
        context += f"\"\"\"\n{current_email}\n\"\"\"\n"

        return context

# Singleton instance
rag_service = RAGService()
