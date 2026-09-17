import numpy as np
import pytest
from api.rag import normalize_embedding, rag_service, VECTOR_DIMENSION

def test_normalize_embedding_shape_and_type():
    """Verify normalize_embedding returns float32 and shape (1, 384)."""
    raw_vector = np.random.rand(384).astype(np.float64)
    normalized = normalize_embedding(raw_vector)
    
    assert normalized.dtype == np.float32
    assert normalized.shape == (1, 384)

def test_normalize_embedding_norm():
    """Verify the L2 norm of the normalized vector is approx 1.0."""
    raw_vector = np.random.rand(384).astype(np.float32) * 10
    normalized = normalize_embedding(raw_vector)
    
    norm = np.linalg.norm(normalized[0])
    assert np.isclose(norm, 1.0, atol=1e-5)

def test_normalize_embedding_invalid_dim():
    """Verify dimension check raises ValueError."""
    invalid_vector = np.random.rand(100)
    with pytest.raises(ValueError, match="Embedding dimension mismatch"):
        normalize_embedding(invalid_vector)

def test_fastembed_integration():
    """Verify FastEmbed initializes and generates 384-dimensional embeddings."""
    import time
    
    # Wait for background thread to load model
    timeout = 30
    while not rag_service.is_loaded() and timeout > 0:
        time.sleep(1)
        timeout -= 1
        
    assert rag_service.is_loaded(), "Model failed to load"
    
    # Generate raw embedding via model
    embeddings = list(rag_service.model.embed(["This is a test document."]))
    assert len(embeddings) == 1
    
    vector = embeddings[0]
    assert vector.shape[0] == 384
    
    # Test RAG Service wrapper
    user_id = "test_user_123"
    rag_service.embed(user_id, "email_1", "This is a test document about flights.")
    rag_service.embed(user_id, "email_2", "This is a test document about hotels.")
    
    # Verify retrieval
    results = rag_service.retrieve(user_id, "What flight am I taking?")
    assert len(results) > 0
    assert results[0]["emailId"] == "email_1", "Flight document should rank first"
    
    results = rag_service.retrieve(user_id, "Where am I staying?")
    assert len(results) > 0
    assert results[0]["emailId"] == "email_2", "Hotel document should rank first"
