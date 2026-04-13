FROM python:3.12-slim

WORKDIR /app

COPY agents/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY agents/ .
COPY dagster/ai_ingest /dagster/ai_ingest
COPY dagster/sources /dagster/sources

# Run as non-root user
RUN addgroup --system appuser && adduser --system --ingroup appuser appuser && \
    chown -R appuser:appuser /app /dagster
USER appuser

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8001"]
