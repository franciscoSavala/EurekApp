# Imagen del microservicio de vectorización CLIP (EU-321).
FROM python:3.11-slim

# Los pesos del modelo (~600MB) se cachean acá; en docker-compose se monta un volumen sobre
# esta ruta para no rebajarlos en cada arranque.
ENV HF_HOME=/models \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# torch primero, desde el índice CPU: evita traer las libs de CUDA (varios GB de más) porque
# el servicio corre en CPU. El resto de dependencias van desde PyPI normal.
COPY requirements.txt .
RUN pip install --index-url https://download.pytorch.org/whl/cpu torch \
 && pip install fastapi "uvicorn[standard]" transformers pillow numpy python-multipart

COPY app.py .

EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
