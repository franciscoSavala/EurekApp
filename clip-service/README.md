# clip-service — vectorización de imágenes (EU-321)

Microservicio self-hosted que corre **CLIP** (`openai/clip-vit-base-patch32`) y devuelve el
embedding visual de una imagen, para la búsqueda reversa por similitud coseno del rework de
búsqueda (EU-320). El backend Java lo consume por HTTP, igual que hoy consume el embedding de
texto de OpenAI. No llama a ningún servicio externo: el modelo corre acá.

## Contrato

```
GET  /health       -> 200 { "status": "ok", "model": "...", "dim": 512 } cuando el modelo cargó
                      503 mientras se descarga/carga o si la carga falló
POST /embed/image  -> multipart/form-data, campo "file" con la imagen
                      -> { "model": "...", "dim": 512, "vector": [float, ...] }   # vector unitario
POST /classify     -> multipart/form-data, campo "file" con la imagen
                      -> { "category": "BILLETERA", "scores": { "BILLETERA": 0.34, ... } }
```

El vector viene normalizado (L2), así que el producto punto entre dos vectores es directamente
la similitud coseno. Se vectoriza la imagen **completa** (sin recorte); ver el docstring de
`app.py` para el por qué y la red de seguridad del center-crop (comentada).

`/classify` (EU-322) hace **clasificación zero-shot**: compara la imagen contra nubes de prompts
por categoría (ROPA, BILLETERA, LLAVES, CELULAR) y cae en **OTROS** cuando ninguna gana con
claridad (el discriminante es el MARGEN top1-top2, no un umbral absoluto). Prompts y umbrales
(`CLASSIFY_MIN_SIM`, `CLASSIFY_MIN_MARGIN`) son configurables por entorno y se calibran sobre fixtures.

## Correr

Normalmente **no hace falta** hacer nada a mano: `Backend/start-local.sh` lo levanta como un
contenedor más (`eurekapp-clip`, puerto `8000`) junto a MySQL y Weaviate.

La **primera** vez, `docker compose` buildea la imagen (instala torch/transformers) y, al primer
arranque, descarga ~600 MB de pesos a un volumen (`eurekapp_clip_models`); las siguientes veces
usa la caché y arranca directo.

### Suelto (debug del micro)

```bash
docker build -t eurekapp-clip ./clip-service
docker run --rm -p 8000:8000 -v eurekapp_clip_models:/models eurekapp-clip
curl -F "file=@Backend/src/test/resources/fixtures/billetera_1.jpg" http://localhost:8000/embed/image
```

### Sin Docker (como la PoC, con venv)

```bash
cd clip-service
python -m venv .venv && ./.venv/Scripts/python.exe -m pip install -r requirements.txt
./.venv/Scripts/python.exe -m uvicorn app:app --port 8000
```

## Variables de entorno

| Variable    | Default                          | Descripción                                  |
|-------------|----------------------------------|----------------------------------------------|
| `CLIP_MODEL`| `openai/clip-vit-base-patch32`   | Modelo CLIP a cargar.                        |
| `HF_HOME`   | `/models` (en la imagen)         | Dónde cachea transformers los pesos.         |
