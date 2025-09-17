FROM python:3.11-slim

WORKDIR /app

# System deps for pyarrow wheels (slim image is fine)
RUN pip install --no-cache-dir fastapi uvicorn pydantic pandas pyarrow

# Copy app
COPY app/main.py ./main.py
COPY app/storage.py ./storage.py

# Data dir for Parquet files
ENV TS_DATA_DIR=/data
RUN mkdir -p /data

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
