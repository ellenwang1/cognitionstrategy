FROM python:3.10-slim
WORKDIR /app
COPY platform/core /app/platform/core
COPY services/flags /app/services/flags
RUN pip install --no-cache-dir /app/platform/core /app/services/flags
CMD ["uvicorn", "services.flags.app.main:app", "--host", "0.0.0.0", "--port", "8003"]
