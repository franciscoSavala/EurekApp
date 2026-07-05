"""
Microservicio de vectorización de imágenes con CLIP (EU-321).

Expone la inferencia CLIP que el backend Java no puede correr de forma nativa: recibe
una imagen y devuelve su embedding visual (vector unitario), para hacer búsqueda reversa
por similitud coseno. Es self-hosted (no llama a ningún servicio externo) y reusa 1:1 el
preprocesado validado en la PoC (poc-reverse-search/compare.py):

    imagen -> CLIP vision -> visual_projection -> normalización L2

Se vectoriza la imagen COMPLETA, sin recorte: en la PoC el center-crop no mejoró el matching
(dio igual o levemente peor), coherente con que CLIP fue entrenado con imágenes completas
—incluido su fondo/contexto—, así que recortar tiende a quitarle señal en vez de agregarla.
Igualmente el recorte queda listo pero COMENTADO (ver center_crop y embed_image): si en las
pruebas reales el matching flojea con fondos muy dominantes, se descomenta y se recalibra.

Contrato HTTP:
    GET  /health       -> 200 {"status": "ok", "model": ..., "dim": ...} cuando el modelo cargó;
                          503 mientras se está cargando/descargando o si la carga falló.
    POST /embed/image  -> multipart: file (requerido)
                          respuesta: {"model": ..., "dim": 512, "vector": [float, ...]}

El modelo (~600MB) NO se versiona: transformers lo descarga la primera vez desde HuggingFace
y lo cachea en HF_HOME (montado como volumen Docker para no rebajarlo en cada arranque). Esa
descarga inicial se hace en segundo plano: si se corta la red, el contenedor NO se cae —queda
vivo, /health reporta 503, y la carga se reintenta en la primera request a /embed/image.
"""

import io
import os
import threading

import numpy as np
import torch
from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError
from transformers import CLIPModel, CLIPProcessor

# Mismo modelo que la PoC. clip-vit-base-patch32 -> embedding de 512 dimensiones.
MODEL_NAME = os.environ.get("CLIP_MODEL", "openai/clip-vit-base-patch32")

app = FastAPI(title="EurekApp CLIP service", version="1.0.0")

# Se cargan una vez y se reutilizan en cada request. La carga es perezosa y thread-safe.
_model: CLIPModel | None = None
_processor: CLIPProcessor | None = None
_model_lock = threading.Lock()
_load_error: str | None = None  # último error de carga, para exponerlo en /health


def _get_model() -> tuple[CLIPModel, CLIPProcessor]:
    """Carga perezosa y thread-safe del modelo (la primera vez descarga/lee del cache)."""
    global _model, _processor, _load_error
    if _model is None or _processor is None:
        with _model_lock:
            if _model is None or _processor is None:
                try:
                    model = CLIPModel.from_pretrained(MODEL_NAME)
                    processor = CLIPProcessor.from_pretrained(MODEL_NAME)
                    model.eval()
                    _model, _processor = model, processor
                    _load_error = None
                except Exception as e:  # noqa: BLE001 - se re-lanza; sólo se registra el motivo
                    _load_error = repr(e)
                    raise
    return _model, _processor


# Red de seguridad, desactivada por defecto (ver docstring del módulo). Recorta un cuadrado
# central que cubre `frac` del lado más corto, para que el fondo pese menos. Descomentar junto
# con la línea marcada en embed_image sólo si el matching real no rinde y se sospecha del fondo.
# def center_crop(image: Image.Image, frac: float) -> Image.Image:
#     width, height = image.size
#     side = int(min(width, height) * frac)
#     left = (width - side) // 2
#     top = (height - side) // 2
#     return image.crop((left, top, left + side, top + side))


def embed_image(image: Image.Image) -> np.ndarray:
    """imagen PIL -> vector CLIP unitario (mismo pipeline que poc-reverse-search)."""
    image = image.convert("RGB")
    # image = center_crop(image, 0.6)  # descomentar (con center_crop) si hace falta enfocar el objeto
    model, processor = _get_model()
    inputs = processor(images=image, return_tensors="pt")
    with torch.no_grad():
        vision_out = model.vision_model(**inputs)
        # Embedding CLIP real = pooler_output proyectado al espacio compartido.
        feats = model.visual_projection(vision_out.pooler_output)
    vec = feats[0].cpu().numpy()
    # Normalizamos a vector unitario => el producto punto ES la similitud coseno.
    return vec / np.linalg.norm(vec)


@app.on_event("startup")
def _warm_up() -> None:
    # Cargar el modelo en segundo plano: si la descarga inicial falla (p. ej. corte de red), el
    # contenedor NO se cae; queda vivo, /health reporta 503 y la carga se reintenta on-demand.
    def _load() -> None:
        try:
            _get_model()
        except Exception:  # noqa: BLE001 - el motivo ya quedó en _load_error; se reintenta luego
            pass

    threading.Thread(target=_load, daemon=True).start()


@app.get("/health")
def health() -> dict:
    if _model is not None:
        return {"status": "ok", "model": MODEL_NAME, "dim": int(_model.config.projection_dim)}
    # Aún cargando/descargando, o la carga falló: 503 para que el healthcheck no lo dé por listo.
    raise HTTPException(status_code=503, detail=_load_error or "loading_model")


@app.post("/embed/image")
async def embed(file: UploadFile = File(...)) -> dict:
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="empty_image")

    try:
        image = Image.open(io.BytesIO(raw))
    except UnidentifiedImageError:
        raise HTTPException(status_code=400, detail="invalid_image")

    # Asegura que el modelo esté cargado (lo dispara si el warm-up aún no terminó o falló).
    try:
        _get_model()
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=503, detail="model_not_ready: " + repr(e)[:200])

    vector = embed_image(image)
    return {
        "model": MODEL_NAME,
        "dim": int(vector.shape[0]),
        "vector": vector.astype(float).tolist(),
    }


# ── Clasificación de categoría por zero-shot CLIP (EU-322) ────────────────────────────────
# Categorías DURAS y abarcativas del rework. Cada una se representa con una NUBE de prompts (en
# inglés, donde CLIP rinde mejor); la imagen se asigna a la categoría cuyo prompt más cercano
# gane. "OTROS" no es una nube: es el fallback cuando ninguna categoría concreta supera el
# umbral de confianza (o cuando top-1 y top-2 quedan pegados = duda). Prompts y umbrales se
# CALIBRAN sobre fixtures (es la PoC dentro de la story); por eso son configurables por entorno.
CATEGORY_PROMPTS = {
    "ROPA": ["clothing", "sneakers", "a shoe", "a sweater", "a t-shirt", "a jacket", "pants", "a dress", "a cap"],
    "BILLETERA": ["a wallet", "a purse", "an id card", "a credit card", "a driver's license", "a transit card"],
    "LLAVES": ["a key", "a bunch of keys", "a keychain"],
    "CELULAR": ["a cellphone", "a smartphone", "a mobile phone"],
}
OTHER_CATEGORY = "OTROS"
# Calibrado sobre fixtures (EU-322): un objeto que ES de una categoría gana despegado del 2º
# (margen ~0.05-0.09); un objeto "otros" queda pegado (margen ~0.004-0.011). El MARGEN separa
# mejor que el umbral absoluto (los cosenos img-texto de CLIP se solapan en ~0.22-0.36).
CLASSIFY_MIN_SIM = float(os.environ.get("CLASSIFY_MIN_SIM", "0.22"))
CLASSIFY_MIN_MARGIN = float(os.environ.get("CLASSIFY_MIN_MARGIN", "0.03"))

_text_bank: tuple[list[str], "torch.Tensor"] | None = None  # cache de prompts vectorizados


def _get_text_bank() -> tuple[list[str], np.ndarray]:
    """Vectoriza (una sola vez) todos los prompts de categoría, normalizados (numpy [N, 512]).

    Usa la proyección manual (text_model + text_projection), igual que embed_image hace con la
    imagen: es el equivalente de get_text_features pero robusto ante cambios de esa API de alto nivel.
    """
    global _text_bank
    if _text_bank is None:
        model, processor = _get_model()
        labels: list[str] = []
        prompts: list[str] = []
        for category, prompt_list in CATEGORY_PROMPTS.items():
            for prompt in prompt_list:
                labels.append(category)
                prompts.append(f"a photo of {prompt}")
        inputs = processor(text=prompts, return_tensors="pt", padding=True)
        with torch.no_grad():
            text_out = model.text_model(**inputs)
            feats = model.text_projection(text_out.pooler_output)
        feats = feats / feats.norm(dim=-1, keepdim=True)
        _text_bank = (labels, feats.cpu().numpy())
    return _text_bank


def classify_image(image: Image.Image) -> tuple[str, dict[str, float]]:
    """imagen -> (categoría, mejor similitud coseno por categoría). OTROS si nada supera el umbral."""
    img = embed_image(image)  # vector imagen unitario (numpy 512), mismo pipeline que /embed/image
    labels, text_feats = _get_text_bank()
    sims = text_feats @ img  # coseno imagen-texto por prompt (ambos unitarios)

    best_per_cat: dict[str, float] = {}
    for label, sim in zip(labels, sims):
        sim = float(sim)
        if label not in best_per_cat or sim > best_per_cat[label]:
            best_per_cat[label] = sim

    ranked = sorted(best_per_cat.items(), key=lambda kv: kv[1], reverse=True)
    top_cat, top_sim = ranked[0]
    second_sim = ranked[1][1] if len(ranked) > 1 else 0.0
    if top_sim < CLASSIFY_MIN_SIM or (top_sim - second_sim) < CLASSIFY_MIN_MARGIN:
        category = OTHER_CATEGORY
    else:
        category = top_cat
    return category, best_per_cat


@app.post("/classify")
async def classify(file: UploadFile = File(...)) -> dict:
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="empty_image")

    try:
        image = Image.open(io.BytesIO(raw))
    except UnidentifiedImageError:
        raise HTTPException(status_code=400, detail="invalid_image")

    try:
        _get_model()
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=503, detail="model_not_ready: " + repr(e)[:200])

    category, scores = classify_image(image)
    return {
        "category": category,
        "scores": {k: round(float(v), 4) for k, v in scores.items()},
    }
