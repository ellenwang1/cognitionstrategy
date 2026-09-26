FROM python:3.10-slim
WORKDIR /app
COPY platform/core /app/platform/core
COPY services/refunds /app/services/refunds
RUN pip install --no-cache-dir /app/platform/core /app/services/refunds
CMD ["uvicorn", "services.refunds.app.main:app", "--host", "0.0.0.0", "--port", "8002"]
