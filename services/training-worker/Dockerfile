# Training Worker Dockerfile
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV TRAINING_OUTPUT_DIR=/models/trained

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/

# Create model directory
RUN mkdir -p /models/trained

# Create non-root user
RUN useradd -m -u 1000 trainer && chown -R trainer:trainer /app /models
USER trainer

# Set Python path
ENV PYTHONPATH=/app

# Run the worker
CMD ["python", "-u", "app/main.py"]
