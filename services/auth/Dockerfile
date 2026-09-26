FROM python:3.10-slim
WORKDIR /app
COPY platform/core /app/platform/core
COPY services/auth /app/services/auth
RUN pip install --no-cache-dir /app/platform/core /app/services/auth
CMD ["uvicorn", "services.auth.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
