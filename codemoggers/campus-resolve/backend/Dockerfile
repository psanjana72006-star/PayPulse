FROM python:3.12-slim
WORKDIR /srv/backend
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt psycopg2-binary
COPY backend/ .
COPY frontend/ /srv/frontend/
CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","8000"]
