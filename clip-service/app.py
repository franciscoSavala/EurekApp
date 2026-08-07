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
# gane. Prompts y umbrales se CALIBRAN sobre fixtures; por eso son configurables por entorno.
#
# OTROS TIENE NUBE PROPIA (además de seguir siendo el fallback del empate). Sin ella, a un objeto
# fuera de las categorías concretas no se le ofrecía "ninguna de las anteriores" y quedaba forzado
# en la más cercana: medido sobre el seed (2026-08-01) una notebook caía en CELULAR y unos anteojos
# en ROPA, con márgenes de 0.003-0.042 contra un corte de 0.03 (o sea, casi al azar). Con nube
# propia los márgenes pasaron a 0.034-0.086 y las 15 fotos del seed quedaron bien clasificadas.
#
# POCAS Y ANCHAS A PROPÓSITO. El filtro por categoría es duro: si los dos lados de una comparación
# caen distinto, el par nunca se compara (fallo silencioso e irrecuperable, nadie se entera). Y cada
# categoría compite contra sus VECINAS, no contra el objeto, así que agregar una le come el margen
# a las que ya están. Dos esquemas más finos se PROBARON Y SE DESCARTARON con medición:
#   - 12 categorías (teléfono/computadora/audio/cargadores/bolsos/paraguas/anteojos/botellas/libros):
#     2 de los 5 pares del seed se partieron y hasta una foto limpia de celular dejó de reconocerse.
#   - 6 categorías (las actuales + BOLSOS para mochilas/carteras/bolsos): partió el par de la mochila
#     (hallazgo BOLSOS 0.325 / búsqueda OTROS por empate 0.006 contra ELECTRONICA) y de paso bajó el
#     margen de BILLETERA de 0.076/0.074 a 0.044/0.034 —al borde del corte—, porque las carteras son
#     vecinas visuales de las billeteras. Con OTROS ancho, esa misma foto ambigua cae OTROS de los
#     DOS lados y el par sobrevive: la categoría ancha absorbe el ruido de la foto.
# ELECTRONICA reemplazó a CELULAR por lo mismo: "¿tiene batería o se enchufa?" se responde solo,
# mientras que "¿cuán parecida a un celular es una notebook?" no.
# REGLA PARA AGREGAR UNA CATEGORÍA: que sea inconfundible respecto de TODAS las existentes Y que
# los dos lados de un par la elijan aun con fotos malas. Medirlo antes, como se midió esto.
CATEGORY_PROMPTS = {
    "ROPA": ["clothing", "sneakers", "a shoe", "a sweater", "a t-shirt", "a jacket", "pants", "a dress", "a cap"],
    # OJO con "a purse": en inglés es CARTERA (bolso de mano), no billetera. Estaba acá y arrastraba
    # las carteras a esta categoría, que después las puntúa con pesos text-heavy (0.35/0.65) pensados
    # para el DNI/nombre que una cartera no tiene. Va "a coin purse" (monedero), que sí es pariente de
    # la billetera; las carteras caen en OTROS, junto a mochilas y bolsos. Medido: las 3 billeteras del
    # seed dan los MISMOS scores con una u otra (0.349/0.330/0.355) -> "a purse" nunca era el prompt
    # ganador, sólo atraía objetos ajenos.
    "BILLETERA": ["a wallet", "a coin purse", "an id card", "a credit card", "a driver's license", "a transit card"],
    "LLAVES": ["a key", "a bunch of keys", "a keychain"],
    "ELECTRONICA": ["a cellphone", "a smartphone", "a mobile phone", "a laptop computer", "a tablet computer",
                    "headphones", "earbuds", "a phone charger", "a power bank", "a digital camera", "a smartwatch"],
    "OTROS": ["an umbrella", "a backpack", "a school bag", "a water bottle", "a thermos", "a book", "a notebook and papers",
              "sunglasses", "eyeglasses", "a toy", "a mug", "a pen", "a ball", "a pair of gloves", "a set of tools"],
}
OTHER_CATEGORY = "OTROS"

# UMBRAL EN LA ESCALA DEL MODELO, no en coseno crudo.
#
# El coseno imagen-texto de CLIP vive en una franja angosta (~0.20-0.36) por el *modality gap*: las
# imágenes y los textos ocupan dos conos separados del espacio, así que el coseno entre modalidades
# nunca se acerca a 1 (la media documentada del par imagen-texto correcto es ~0.22). Leídas así, las
# diferencias parecen milésimas irrelevantes — y no lo son. CLIP aprende durante el entrenamiento un
# `logit_scale` (topeado en 100 por el paper) que ES el factor con el que hay que leer esos cosenos:
# multiplicando por 100 se obtienen logits, y el softmax sobre ellos da la probabilidad. Un margen de
# 0.03 en coseno son 3 logits = ~20:1 de ventaja; uno de 0.006 son 0.6 logits = 1.8:1, duda real.
#
# Por eso el corte se expresa como CONFIANZA (probabilidad de la categoría ganadora) y no como margen
# de coseno: es una perilla legible ("clasificar sólo si supera el 90%"), sobrevive a un cambio de
# modelo (cada uno trae su propio logit_scale) y la confianza se devuelve al backend para poder medir
# en producción cuántas clasificaciones fueron dudosas (insumo de EU-327).
#
# 0.90 se eligió para replicar el comportamiento del corte anterior (margen 0.03 ~ 95% entre top1 y
# top2); las 15 fotos del seed clasifican igual. Por debajo del umbral -> OTROS ("no sé"), que es la
# categoría ancha y por lo tanto el lugar seguro para la duda.
CLASSIFY_MIN_CONFIDENCE = float(os.environ.get("CLASSIFY_MIN_CONFIDENCE", "0.90"))
# Piso absoluto de similitud: descarta la imagen que no se parece a NINGÚN prompt (foto ilegible,
# objeto fuera de todo el vocabulario). Es independiente de la confianza relativa.
CLASSIFY_MIN_SIM = float(os.environ.get("CLASSIFY_MIN_SIM", "0.22"))

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


def _logit_scale() -> float:
    """Factor con el que CLIP quiere que se lean sus cosenos (aprendido, topeado en 100)."""
    model, _ = _get_model()
    return float(model.logit_scale.exp().item())


def classify_image(image: Image.Image) -> tuple[str, dict[str, float], dict[str, float]]:
    """imagen -> (categoría, coseno por categoría, confianza por categoría).

    La categoría gana si su CONFIANZA (softmax sobre los cosenos escalados por el logit_scale del
    modelo) supera CLASSIFY_MIN_CONFIDENCE; si no, OTROS. Ver el bloque de comentarios de los umbrales.
    """
    img = embed_image(image)  # vector imagen unitario (numpy 512), mismo pipeline que /embed/image
    labels, text_feats = _get_text_bank()
    sims = text_feats @ img  # coseno imagen-texto por prompt (ambos unitarios)

    best_per_cat: dict[str, float] = {}
    for label, sim in zip(labels, sims):
        sim = float(sim)
        if label not in best_per_cat or sim > best_per_cat[label]:
            best_per_cat[label] = sim

    # Softmax en la escala del modelo. Se resta el máximo antes de exponenciar (estabilidad numérica).
    cats = list(best_per_cat)
    logits = np.array([best_per_cat[c] for c in cats]) * _logit_scale()
    exp = np.exp(logits - logits.max())
    confidence = {c: float(p) for c, p in zip(cats, exp / exp.sum())}

    top_cat = max(confidence, key=confidence.get)
    if best_per_cat[top_cat] < CLASSIFY_MIN_SIM or confidence[top_cat] < CLASSIFY_MIN_CONFIDENCE:
        category = OTHER_CATEGORY
    else:
        category = top_cat
    return category, best_per_cat, confidence


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

    category, scores, confidence = classify_image(image)
    return {
        "category": category,
        # Confianza de la categoría devuelta: 1.0 si ninguna superó el umbral y cayó en OTROS por duda.
        "confidence": round(float(confidence.get(category, 0.0)), 4),
        "scores": {k: round(float(v), 4) for k, v in scores.items()},
        "confidences": {k: round(float(v), 4) for k, v in confidence.items()},
    }
