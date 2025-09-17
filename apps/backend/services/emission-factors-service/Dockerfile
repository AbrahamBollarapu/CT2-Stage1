FROM python:3.11-slim
WORKDIR /app
RUN python -m pip install --no-cache-dir fastapi uvicorn pydantic
COPY app/main.py ./main.py
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
