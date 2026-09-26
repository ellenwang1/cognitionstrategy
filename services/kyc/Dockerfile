FROM python:3.10-slim
WORKDIR /app
COPY platform/core /app/platform/core
COPY services/kyc /app/services/kyc
RUN pip install --no-cache-dir /app/platform/core /app/services/kyc
CMD ["uvicorn", "services.kyc.app.main:app", "--host", "0.0.0.0", "--port", "8001"]
