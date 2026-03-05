"""
Training Worker Service
Handles async fine-tuning of organization-specific models
"""

import os
import json
import asyncio
import time
from datetime import datetime
from typing import Optional, Dict, Any

import aiohttp
from supabase import create_client, Client

# Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "10"))
TRAINING_OUTPUT_DIR = os.getenv("TRAINING_OUTPUT_DIR", "/models/trained")

# Training configuration
DEFAULT_EPOCHS = int(os.getenv("DEFAULT_EPOCHS", "10"))
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "8"))
LEARNING_RATE = float(os.getenv("LEARNING_RATE", "0.0001"))


class TrainingWorker:
    """
    Training worker for fine-tuning organization models
    """
    
    def __init__(self):
        self.supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        self.is_running = False
        self.current_job: Optional[Dict] = None
        
    async def start(self):
        """Start the training worker"""
        print("[Training Worker] Starting...")
        self.is_running = True
        
        # Ensure output directory exists
        os.makedirs(TRAINING_OUTPUT_DIR, exist_ok=True)
        
        while self.is_running:
            try:
                await self.poll_and_process()
            except Exception as e:
                print(f"[Training Worker] Error in poll loop: {e}")
            
            await asyncio.sleep(POLL_INTERVAL)
    
    def stop(self):
        """Stop the training worker"""
        print("[Training Worker] Stopping...")
        self.is_running = False
    
    async def poll_and_process(self):
        """Poll for and process training jobs"""
        job = await self.claim_next_job()
        
        if not job:
            return
        
        self.current_job = job
        job_id = job["job_id"]
        org_id = job["job_org_id"]
        
        print(f"[Training Worker] Processing training job {job_id} for org {org_id}")
        
        try:
            # Execute training
            await self.execute_training(job)
            
        except Exception as e:
            print(f"[Training Worker] Training failed: {e}")
            await self.fail_job(job_id, str(e))
        
        finally:
            self.current_job = None
    
    async def claim_next_job(self) -> Optional[Dict]:
        """Claim the next queued training job"""
        try:
            response = self.supabase.rpc("claim_next_training_job").execute()
            
            if response.data and len(response.data) > 0:
                return response.data[0]
            
            return None
            
        except Exception as e:
            print(f"[Training Worker] Error claiming job: {e}")
            return None
    
    async def execute_training(self, job: Dict):
        """
        Execute the fine-tuning process
        
        This is a placeholder implementation.
        In production, this would:
        1. Load the training dataset
        2. Load the base model
        3. Run fine-tuning loop
        4. Evaluate on validation set
        5. Save the trained model
        """
        job_id = job["job_id"]
        org_id = job["job_org_id"]
        dataset_path = job["job_dataset_path"]
        model_id = job["job_model_id"]
        
        print(f"[Training Worker] Starting training for model {model_id}")
        
        # Update status to training
        await self.update_job_progress(job_id, status="training", progress=0)
        
        # Simulate training process
        epochs = DEFAULT_EPOCHS
        metrics_history = []
        
        for epoch in range(1, epochs + 1):
            if not self.is_running:
                raise Exception("Worker stopped during training")
            
            # Simulate epoch training
            print(f"[Training Worker] Epoch {epoch}/{epochs}")
            await asyncio.sleep(2)  # Simulate training time
            
            # Simulate metrics
            train_loss = 1.0 / epoch
            val_accuracy = 0.5 + (0.4 * epoch / epochs)
            
            metrics_history.append({
                "epoch": epoch,
                "train_loss": train_loss,
                "val_accuracy": val_accuracy
            })
            
            # Update progress
            progress = int((epoch / epochs) * 100)
            await self.update_job_progress(
                job_id, 
                status="training", 
                progress=progress,
                epochs_completed=epoch,
                total_epochs=epochs
            )
        
        # Save model
        model_filename = f"model_{org_id}_{model_id}_{int(time.time())}.pt"
        model_path = os.path.join(TRAINING_OUTPUT_DIR, model_filename)
        
        # In production, actually save the model here
        with open(model_path, "w") as f:
            f.write(f"# Trained model placeholder for {model_id}")
        
        print(f"[Training Worker] Model saved to {model_path}")
        
        # Calculate final metrics
        final_metrics = {
            "final_train_loss": metrics_history[-1]["train_loss"],
            "final_val_accuracy": metrics_history[-1]["val_accuracy"],
            "epochs_trained": epochs,
            "training_history": metrics_history,
            "model_size_mb": 100,  # Placeholder
            "inference_time_ms": 150  # Placeholder
        }
        
        # Estimate cost (placeholder)
        actual_cost = epochs * 0.50  # $0.50 per epoch
        
        # Complete job
        await self.complete_job(job_id, model_path, final_metrics, actual_cost)
        
        print(f"[Training Worker] Job {job_id} completed successfully")
    
    async def update_job_progress(
        self,
        job_id: str,
        status: str,
        progress: int,
        epochs_completed: int = 0,
        total_epochs: int = 0
    ):
        """Update job progress in database"""
        try:
            self.supabase.table("training_jobs").update({
                "status": status,
                "progress_percent": progress,
                "epochs_completed": epochs_completed,
                "total_epochs": total_epochs,
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", job_id).execute()
        except Exception as e:
            print(f"[Training Worker] Error updating progress: {e}")
    
    async def complete_job(
        self,
        job_id: str,
        model_path: str,
        metrics: Dict,
        actual_cost: float
    ):
        """Mark training job as complete"""
        try:
            self.supabase.rpc("complete_training_job", {
                "p_job_id": job_id,
                "p_model_path": model_path,
                "p_metrics_json": metrics,
                "p_actual_cost": actual_cost
            }).execute()
        except Exception as e:
            print(f"[Training Worker] Error completing job: {e}")
            raise
    
    async def fail_job(self, job_id: str, error_message: str):
        """Mark training job as failed"""
        try:
            self.supabase.rpc("fail_training_job", {
                "p_job_id": job_id,
                "p_error_message": error_message
            }).execute()
        except Exception as e:
            print(f"[Training Worker] Error failing job: {e}")


async def main():
    """Main entry point"""
    worker = TrainingWorker()
    
    # Handle shutdown signals
    def signal_handler():
        worker.stop()
    
    import signal
    signal.signal(signal.SIGTERM, lambda s, f: signal_handler())
    signal.signal(signal.SIGINT, lambda s, f: signal_handler())
    
    try:
        await worker.start()
    except Exception as e:
        print(f"[Training Worker] Fatal error: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())
