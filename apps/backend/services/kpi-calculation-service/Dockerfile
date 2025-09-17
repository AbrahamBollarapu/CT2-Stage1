FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app/services/kpi-calculation-service

COPY services/kpi-calculation-service/requirements.txt /app/services/kpi-calculation-service/requirements.txt
RUN pip install --no-cache-dir -r /app/services/kpi-calculation-service/requirements.txt

COPY _shared /app/_shared
ENV PYTHONPATH=/app

COPY services/kpi-calculation-service/ .

ENV PORT=8000
EXPOSE 8000
CMD ["uvicorn","main:app","--host","0.0.0.0","--port","8000"]
