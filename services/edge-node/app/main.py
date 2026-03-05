"""
Edge Node Service
Lightweight inference server for regional/edge deployment
"""

import os
import json
import hmac
import hashlib
import time
import asyncio
from contextlib import asynccontextmanager
from typing import Optional, Dict, Any
from datetime import datetime

from fastapi import FastAPI, File, UploadFile, HTTPException, Header, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import aiohttp
import numpy as np
from PIL import Image
import io

# Configuration
NODE_ID = os.getenv("NODE_ID", "edge-node-1")
REGION = os.getenv("REGION", "us-east-1")
HMAC_SECRET = os.getenv("HMAC_SECRET", "")
CENTRAL_API_URL = os.getenv("CENTRAL_API_URL", "")
HEARTBEAT_INTERVAL = int(os.getenv("HEARTBEAT_INTERVAL", "5"))
MODEL_PATH = os.getenv("MODEL_PATH", "/models/default")
SUPPORTS_LOCAL_MODELS = os.getenv("SUPPORTS_LOCAL_MODELS", "true").lower() == "true"

# Node state
node_state = {
    "status": "initializing",
    "current_load": 0,
    "total_requests": 0,
    "error_count": 0,
    "avg_response_time_ms": 0,
    "start_time": datetime.utcnow().isoformat()
}


class HealthResponse(BaseModel):
    status: str
    node_id: str
    region: str
    current_load: int
    capacity_score: int
    supports_local_models: bool
    version: str


class InferenceResult(BaseModel):
    version: str
    measurements: Dict[str, float]
    landmarks: list
    summary: str
    confidence: float
    processed_by: str
    latency_ms: int


class JobPayload(BaseModel):
    job_id: str
    org_id: str
    case_id: str
    user_id: str
    timestamp: int
    signature: str
    model_config: Optional[Dict[str, Any]] = None


class EdgeInferenceModel:
    """
    Edge inference model handler
    
    In production, this would load actual ML models.
    This is a placeholder that can be replaced with real model loading.
    """
    
    def __init__(self, model_path: str):
        self.model_path = model_path
        self.loaded = False
        self.model = None
        
    async def load(self):
        """Load the model asynchronously"""
        print(f"[Edge Node {NODE_ID}] Loading model from {self.model_path}")
        # TODO: Load actual model
        await asyncio.sleep(1)  # Simulate loading
        self.loaded = True
        print(f"[Edge Node {NODE_ID}] Model loaded successfully")
        
    async def predict(self, image: np.ndarray, model_config: Optional[Dict] = None) -> Dict:
        """
        Run inference on image
        
        Args:
            image: numpy array of image
            model_config: Optional custom model configuration
            
        Returns:
            Analysis results
        """
        if not self.loaded:
            raise RuntimeError("Model not loaded")
        
        # TODO: Replace with actual model inference
        # This simulates processing time
        await asyncio.sleep(0.5)
        
        # Check if using custom model
        if model_config and model_config.get("fine_tuned_path"):
            print(f"[Edge Node {NODE_ID}] Using fine-tuned model: {model_config['fine_tuned_path']}")
        
        # Mock result
        return {
            "measurements": {
                "sna_angle": 82.5,
                "snb_angle": 79.2,
                "anb_angle": 3.3,
                "mandibular_plane_angle": 26.8,
                "upper_incisor_to_na": 4.2,
                "lower_incisor_to_nb": 4.8,
            },
            "landmarks": [
                {"x": 150, "y": 200, "label": "sella"},
                {"x": 180, "y": 250, "label": "nasion"},
                {"x": 200, "y": 300, "label": "a_point"},
            ],
            "summary": "Edge-processed analysis complete.",
            "confidence": 0.92,
            "model_version": model_config.get("base_model", "default") if model_config else "default"
        }


# Global model instance
model: Optional[EdgeInferenceModel] = None


async def report_heartbeat():
    """Report heartbeat to central API"""
    if not CENTRAL_API_URL:
        return
    
    while True:
        try:
            async with aiohttp.ClientSession() as session:
                payload = {
                    "node_id": NODE_ID,
                    "load": node_state["current_load"],
                    "metrics": {
                        "total_requests": node_state["total_requests"],
                        "error_count": node_state["error_count"],
                        "avg_response_time": node_state["avg_response_time_ms"]
                    }
                }
                
                async with session.post(
                    f"{CENTRAL_API_URL}/edge/heartbeat",
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=5)
                ) as resp:
                    if resp.status == 200:
                        print(f"[Heartbeat] Reported successfully")
                    else:
                        print(f"[Heartbeat] Failed: {resp.status}")
                        
        except Exception as e:
            print(f"[Heartbeat] Error: {e}")
        
        await asyncio.sleep(HEARTBEAT_INTERVAL)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    global model
    
    # Startup
    print(f"[Edge Node {NODE_ID}] Starting up in region {REGION}...")
    
    # Load model
    model = EdgeInferenceModel(MODEL_PATH)
    await model.load()
    
    node_state["status"] = "active"
    
    # Start heartbeat task
    if CENTRAL_API_URL:
        asyncio.create_task(report_heartbeat())
    
    print(f"[Edge Node {NODE_ID}] Ready")
    
    yield
    
    # Shutdown
    print(f"[Edge Node {NODE_ID}] Shutting down...")
    node_state["status"] = "offline"


# Create FastAPI app
app = FastAPI(
    title="Orca Dental AI - Edge Node",
    description="Regional edge inference server",
    version="1.0.0",
    lifespan=lifespan,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def verify_signature(payload: JobPayload) -> bool:
    """Verify HMAC signature of job payload"""
    if not HMAC_SECRET:
        print("[Warning] HMAC_SECRET not set, skipping verification")
        return True
    
    # Check timestamp expiry (60 seconds)
    current_time = int(time.time())
    if current_time - payload.timestamp > 60:
        print(f"[Auth] Job expired: {current_time - payload.timestamp}s old")
        return False
    
    # Build payload string
    payload_string = f"{payload.job_id}:{payload.org_id}:{payload.timestamp}"
    
    # Calculate expected signature
    expected_sig = hmac.new(
        HMAC_SECRET.encode(),
        payload_string.encode(),
        hashlib.sha256
    ).hexdigest()
    
    # Compare signatures
    return hmac.compare_digest(expected_sig, payload.signature)


def preprocess_image(image_bytes: bytes) -> np.ndarray:
    """Preprocess image for inference"""
    try:
        image = Image.open(io.BytesIO(image_bytes))
        
        if image.mode != "RGB":
            image = image.convert("RGB")
        
        # Resize if needed
        max_size = 2048
        if max(image.size) > max_size:
            ratio = max_size / max(image.size)
            new_size = (int(image.size[0] * ratio), int(image.size[1] * ratio))
            image = image.resize(new_size, Image.Resampling.LANCZOS)
        
        return np.array(image)
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {str(e)}")


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status=node_state["status"],
        node_id=NODE_ID,
        region=REGION,
        current_load=node_state["current_load"],
        capacity_score=100,  # Configurable
        supports_local_models=SUPPORTS_LOCAL_MODELS,
        version="1.0.0"
    )


@app.post("/infer", response_model=InferenceResult)
async def infer(
    background_tasks: BackgroundTasks,
    image: UploadFile = File(...),
    payload: str = File(...)
):
    """
    Run inference on uploaded image
    
    Args:
        image: Image file to analyze
        payload: JSON string containing signed job payload
        
    Returns:
        Analysis results
    """
    import time
    start_time = time.time()
    
    # Validate file
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Parse payload
    try:
        payload_data = json.loads(payload)
        job_payload = JobPayload(**payload_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid payload: {str(e)}")
    
    # Verify signature
    if not verify_signature(job_payload):
        raise HTTPException(status_code=401, detail="Invalid signature")
    
    # Increment load
    node_state["current_load"] += 1
    node_state["total_requests"] += 1
    
    try:
        # Read image
        image_bytes = await image.read()
        
        if len(image_bytes) == 0:
            raise HTTPException(status_code=400, detail="Empty file")
        
        # Preprocess
        img_array = preprocess_image(image_bytes)
        
        # Run inference
        result = await model.predict(img_array, job_payload.model_config)
        
        # Calculate latency
        latency_ms = int((time.time() - start_time) * 1000)
        
        # Update metrics
        # Simple moving average
        prev_avg = node_state["avg_response_time_ms"]
        total = node_state["total_requests"]
        node_state["avg_response_time_ms"] = (prev_avg * (total - 1) + latency_ms) / total
        
        return InferenceResult(
            version=result["model_version"],
            measurements=result["measurements"],
            landmarks=result["landmarks"],
            summary=result["summary"],
            confidence=result["confidence"],
            processed_by=NODE_ID,
            latency_ms=latency_ms
        )
        
    except HTTPException:
        raise
    except Exception as e:
        node_state["error_count"] += 1
        print(f"[Error] Inference failed: {e}")
        raise HTTPException(status_code=500, detail=f"Inference failed: {str(e)}")
    finally:
        # Decrement load
        node_state["current_load"] = max(0, node_state["current_load"] - 1)


@app.get("/metrics")
async def get_metrics():
    """Get node metrics"""
    return {
        "node_id": NODE_ID,
        "region": REGION,
        "status": node_state["status"],
        "current_load": node_state["current_load"],
        "total_requests": node_state["total_requests"],
        "error_count": node_state["error_count"],
        "avg_response_time_ms": round(node_state["avg_response_time_ms"], 2),
        "uptime_seconds": (datetime.utcnow() - datetime.fromisoformat(node_state["start_time"])).seconds
    }


@app.post("/admin/reload-model")
async def reload_model():
    """Admin endpoint to reload model"""
    global model
    
    try:
        model = EdgeInferenceModel(MODEL_PATH)
        await model.load()
        return {"status": "success", "message": "Model reloaded"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reload model: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    
    uvicorn.run(app, host=host, port=port)
