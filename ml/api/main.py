"""
main.py — FastAPI ML inference service for DetectIQ.

Exposes:
  POST /predict  — classify text as phishing or safe
  GET  /health   — health check + model status

Security:
  - Input is validated (non-empty, max 10,000 chars)
  - Submitted text is NEVER executed
  - Submitted text is NEVER stored (only the in-memory clean vector is kept)
  - No API keys are exposed
  - Stack traces are suppressed in error responses

Usage:
  python -m uvicorn ml.api.main:app --host 0.0.0.0 --port 8001
  # or from project root:
  python -m uvicorn ml.api.main:app --port 8001
"""

from fastapi import FastAPI, HTTPException, Request, Header, Depends
from fastapi.responses import JSONResponse
import logging
import os

from .schemas import (
    PredictRequest, PredictResponse, HealthResponse, ModelInfo,
    EmbedRequest, RetrieveRequest, RetrieveResponse, RetrievedEmail,
    RagContextRequest, RagContextResponse
)
from .predictor import get_predictor, is_model_loaded, _load_error
from .rag import rag_service

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("detectiq-ml")

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="DetectIQ ML Inference Service",
    description="Phishing text classifier — TF-IDF + Logistic Regression",
    version="1.0.0",
    docs_url="/docs",
    redoc_url=None,
)

# ---------------------------------------------------------------------------
# Security: Internal Token
# ---------------------------------------------------------------------------
ML_INTERNAL_TOKEN = os.environ.get("ML_INTERNAL_TOKEN", "dev-internal-token-change-me")

async def verify_internal_token(authorization: str = Header(None)):
    """Verifies that the Node backend is the caller using a shared secret."""
    if not authorization or authorization != f"Bearer {ML_INTERNAL_TOKEN}":
        raise HTTPException(status_code=403, detail="Forbidden: Invalid or missing internal token.")
    return True


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health():
    """Health check — returns model status."""
    loaded = is_model_loaded()
    rag_loaded = rag_service.is_loaded()
    
    if loaded and rag_loaded:
        predictor = get_predictor()
        return HealthResponse(
            status="ok",
            modelLoaded=True,
            modelVersion=predictor.version,
            ragLoaded=True,
        )
    else:
        errors = []
        if not loaded: errors.append("Classifier not loaded.")
        if not rag_loaded: errors.append("RAG model not loaded.")
        return HealthResponse(
            status="degraded",
            modelLoaded=loaded,
            ragLoaded=rag_loaded,
            error=" ".join(errors) if errors else None,
        )


@app.post("/predict", response_model=PredictResponse, tags=["Prediction"])
async def predict(request: PredictRequest):
    """
    Classify text as phishing or safe.

    SECURITY NOTE: The submitted text is treated as untrusted data.
    It is vectorised and classified — never executed, never stored.
    """
    if not is_model_loaded():
        raise HTTPException(
            status_code=503,
            detail="ML model is not loaded. Run 'python ml/train.py' to generate artifacts.",
        )

    try:
        predictor = get_predictor()
        result = predictor.predict(request.text)

        return PredictResponse(
            label=result["label"],
            probability=result["probability"],
            model=ModelInfo(
                name=result["model"]["name"],
                version=result["model"]["version"],
            ),
        )
    except Exception as e:
        logger.error(f"Prediction error: {type(e).__name__}: {e}")
        # Don't expose internal error details to the caller
        raise HTTPException(status_code=500, detail="Prediction failed. Please try again.")

@app.post("/embed", tags=["RAG"], dependencies=[Depends(verify_internal_token)])
async def embed(request: EmbedRequest):
    """Embed an email and store it in the user's specific FAISS index."""
    if not rag_service.is_loaded():
        raise HTTPException(status_code=503, detail="RAG model is not loaded.")
    
    try:
        success = rag_service.embed(request.userId, request.emailId, request.text)
        if not success:
            raise HTTPException(status_code=400, detail="Failed to embed text (might be empty).")
        return JSONResponse(status_code=200, content={"status": "success", "emailId": request.emailId})
    except Exception as e:
        logger.error(f"Embedding error: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail="Embedding failed.")

@app.post("/retrieve", response_model=RetrieveResponse, tags=["RAG"], dependencies=[Depends(verify_internal_token)])
async def retrieve(request: RetrieveRequest):
    """Retrieve the Top-K most similar historical emails from the user's FAISS index."""
    if not rag_service.is_loaded():
        raise HTTPException(status_code=503, detail="RAG model is not loaded.")
    
    try:
        results = rag_service.retrieve(request.userId, request.queryText, request.topK)
        return RetrieveResponse(results=[RetrievedEmail(**r) for r in results])
    except Exception as e:
        logger.error(f"Retrieval error: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail="Retrieval failed.")

@app.post("/rag-context", response_model=RagContextResponse, tags=["RAG"], dependencies=[Depends(verify_internal_token)])
async def build_rag_context(request: RagContextRequest):
    """Format the retrieved legitimate emails and current email into a structured string."""
    try:
        context = rag_service.build_rag_context(request.currentEmail, request.historicalEmails)
        return RagContextResponse(context=context)
    except Exception as e:
        logger.error(f"RAG context error: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail="Failed to build RAG context.")

from pydantic import BaseModel
class ClearIndexRequest(BaseModel):
    userId: str

@app.post("/clear-index", tags=["RAG"], dependencies=[Depends(verify_internal_token)])
async def clear_index(request: ClearIndexRequest):
    """Clear a user's FAISS index. Used by Node before a bulk rebuild."""
    try:
        rag_service.clear_user_index(request.userId)
        return JSONResponse(status_code=200, content={"status": "success", "message": f"Index cleared for {request.userId}"})
    except Exception as e:
        logger.error(f"Clear index error: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail="Failed to clear index.")

# ---------------------------------------------------------------------------
# Global exception handler — suppress stack traces in responses
# ---------------------------------------------------------------------------
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {type(exc).__name__}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred."},
    )


# ---------------------------------------------------------------------------
# Startup log
# ---------------------------------------------------------------------------
@app.on_event("startup")
async def startup_event():
    if is_model_loaded():
        predictor = get_predictor()
        logger.info(
            f"[detectiq-ml] Model loaded: {predictor.metadata.get('modelName')} "
            f"v{predictor.version} | "
            f"Accuracy={predictor.metadata.get('accuracy')} | "
            f"F1={predictor.metadata.get('f1')}"
        )
    else:
        logger.warning(
            f"[detectiq-ml] Model NOT loaded: {_load_error}. "
            "Run 'python ml/train.py' to generate artifacts."
        )
    
    if rag_service.is_loaded():
        logger.info("[detectiq-ml] RAG embedding model loaded successfully.")
    else:
        logger.warning("[detectiq-ml] RAG embedding model NOT loaded.")
