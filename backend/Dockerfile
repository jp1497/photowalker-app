# Photowalker API - Container image per PRD v2 Containerization
# See Design/PRD_v2.md and Design/IMPLEMENTATION_ROADMAP.md Step 7.3

FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (postgresql-client for migration/health tooling)
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

EXPOSE 8000

# Production: Gunicorn + Uvicorn workers per PRD v2 ASGI Server Configuration
CMD ["gunicorn", "app.main:app", \
     "--workers", "4", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--bind", "0.0.0.0:8000", \
     "--timeout", "60", \
     "--graceful-timeout", "30", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
