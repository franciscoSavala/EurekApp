#!/usr/bin/env python3
"""
Regenera los NDJSON del seed (FoundObject / LostObject) con los DOS vectores nombrados del
rework de búsqueda (EU-320/EU-325):

  - "image": embedding VISUAL (CLIP) de la foto real del objeto  -> micro clip-service (/embed/image)
  - "text":  embedding TEXTUAL (OpenAI text-embedding-3-small)    -> API de OpenAI

y la categoría dura la decide el CLASIFICADOR CLIP sobre la MISMA foto (/classify), no se asigna a
mano: así el objeto sembrado y una búsqueda en vivo se clasifican con el mismo criterio (decisión
8bis del rework). Se elimina `ai_description` (deprecada, EU-323).

Por qué se regenera TODO y no se reusa el `vector` viejo del NDJSON: ese vector era un embedding de
texto que incluía la descripción IA de gpt-4o (`textRepresentation`), hoy deshabilitada. El backend
actual embebe otro string (ver más abajo), así que el vector viejo quedó OBSOLETO. Este generador
replica EXACTAMENTE el texto que arma el backend hoy:

  - FoundObject (FoundObjectService):  "" + " " + human_description + " " + title
  - LostObject  (LostObjectService):   description   (crudo)

Requisitos para correrlo:
  - clip-service levantado (docker compose up clip-service) en CLIP_URL (default http://localhost:8000)
  - OPENAI_SECRET_KEY en el entorno (lo carga start-local.sh desde .env.local)
  - las fotos reales en seed-data/photos/<uuid>.jpg

Salida: sobrescribe seed-data/FoundObject.ndjson y seed-data/LostObject.ndjson. Es idempotente.
"""

import json
import os
import sys
import urllib.error
import urllib.request
import uuid as uuidlib

HERE = os.path.dirname(os.path.abspath(__file__))
PHOTOS_DIR = os.path.join(HERE, "photos")
CLIP_URL = os.environ.get("CLIP_URL", "http://localhost:8000")
OPENAI_URL = "https://api.openai.com/v1/embeddings"
OPENAI_MODEL = "text-embedding-3-small"  # mismo modelo que EmbeddingRequest.java
OPENAI_KEY = os.environ.get("OPENAI_SECRET_KEY", "")

# ── Inventario de objetos ─────────────────────────────────────────────────────
# La metadata (títulos, descripciones, coords, fechas, orgs, finder) sale del NDJSON previo; sólo
# cambian los vectores y la categoría. El id ES la key de S3 y el nombre del archivo de foto.
FOUND_OBJECTS = [
    {"id": "7ea43eba-7343-4cd8-b5d0-b736e3d575a3", "title": "Billetera negra de cuero",
     "human_description": "Billetera negra de cuero con tarjetas y algo de efectivo",
     "organization_id": "1", "lat": -31.4377, "lon": -64.1829, "found_date": "2026-04-28T10:00:00Z"},
    {"id": "df2aa6a0-d15c-46e8-902a-e5394538a43e", "title": "Llave con llavero azul",
     "human_description": "Llave suelta con llavero de goma azul",
     "organization_id": "1", "lat": -31.4377, "lon": -64.1829, "found_date": "2026-05-02T10:00:00Z"},
    {"id": "25e71dcb-9d0d-4b75-96f2-df60b7d99261", "title": "Auriculares inalambricos blancos",
     "human_description": "Auriculares over-ear blancos, sin cables, marca no visible",
     "organization_id": "2", "lat": -31.4201, "lon": -64.1888, "found_date": "2026-05-05T10:00:00Z"},
    {"id": "494ddbc4-b4d8-4935-a77c-1d3e7363b67d", "title": "Mochila azul con libros",
     "human_description": "Mochila azul mediana con varios libros y un estuche adentro",
     "organization_id": "1", "lat": -31.4375, "lon": -64.1831, "found_date": "2026-05-07T10:00:00Z"},
    {"id": "18da5796-50dc-4383-8b1f-27e524b04b5d", "title": "Celular Samsung negro",
     "human_description": "Celular Samsung con pantalla rota y funda gris",
     "organization_id": "3", "lat": -31.3233, "lon": -64.2081, "found_date": "2026-05-09T10:00:00Z"},
    {"id": "4b43a1d8-1491-4077-9c1c-463e5906cdeb", "title": "Paraguas negro plegable",
     "human_description": "Paraguas negro plegable de tamano compacto, sin marca visible",
     "organization_id": "1", "lat": -31.4377, "lon": -64.1829, "found_date": "2026-04-15T10:00:00Z"},
    {"id": "85c55156-216f-4b6c-aa65-782e066567b6", "title": "Notebook Dell gris",
     "human_description": "Notebook Dell gris de 15 pulgadas con stickers en la tapa",
     "organization_id": "2", "lat": -31.4201, "lon": -64.1888, "found_date": "2026-04-25T10:00:00Z"},
    {"id": "ebaa9336-e9fd-4556-a96e-9c1538d165cb", "title": "Billetera marron con DNI",
     "human_description": "Billetera marron de cuero con DNI y tarjetas bancarias adentro",
     "organization_id": "2", "lat": -31.4201, "lon": -64.1888, "found_date": "2026-05-12T10:00:00Z"},
    {"id": "498d742e-49e6-4c88-bf8d-f0313581dfaa", "title": "Cargador USB-C blanco",
     "human_description": "Cargador USB-C blanco de 20W con cable incluido",
     "organization_id": "3", "lat": -31.3233, "lon": -64.2081, "found_date": "2026-05-14T10:00:00Z"},
    {"id": "a1047f2f-0fcd-41b1-92ad-485dd04cb5d8", "title": "Anteojos de sol negros",
     "human_description": "Anteojos de sol con montura negra y lentes espejados",
     "organization_id": "1", "lat": -31.4377, "lon": -64.1829, "found_date": "2026-05-20T10:00:00Z"},
]

LOST_OBJECTS = [
    {"id": "ea9f4057-4f1d-4daf-aeca-c6162fe9aeb6", "username": "julia@mail.com",
     "description": "Perdi mi billetera negra de cuero cerca de la facultad, tenia DNI y tarjetas",
     "organization_id": "1", "lat": -31.4377, "lon": -64.1829, "lost_date": "2026-04-29T08:00:00Z"},
    {"id": "771c2c2b-4dd2-45e4-977b-3a2186e86b6e", "username": "pedro@mail.com",
     "description": "Se me cayeron unos auriculares inalambricos blancos en la terminal",
     "organization_id": "2", "lat": -31.4201, "lon": -64.1888, "lost_date": "2026-05-06T08:00:00Z"},
    {"id": "8ec5ebe1-5b65-412a-9cda-576f42401e35", "username": "valeria@mail.com",
     "description": "Perdi una mochila azul con libros de ingenieria en UTN",
     "organization_id": "1", "lat": -31.4375, "lon": -64.1831, "lost_date": "2026-05-08T08:00:00Z"},
    {"id": "26f82583-f553-40a1-a1b8-3775c384971f", "username": "julia@mail.com",
     "description": "Se me olvido mi paraguas negro en el aula magna de UTN",
     "organization_id": "1", "lat": -31.4377, "lon": -64.1829, "lost_date": "2026-04-16T08:00:00Z"},
    {"id": "56d511e3-899b-41cf-9f2c-a811437b0b28", "username": "valeria@mail.com",
     "description": "Olvide mi notebook Dell gris en la sala de espera de la terminal",
     "organization_id": "2", "lat": -31.4201, "lon": -64.1888, "lost_date": "2026-04-26T08:00:00Z"},
]


def _multipart(photo_path):
    """Arma un body multipart/form-data con un único campo 'file' (la foto)."""
    boundary = "----eurekappseed" + uuidlib.uuid4().hex
    with open(photo_path, "rb") as fh:
        payload = fh.read()
    pre = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{os.path.basename(photo_path)}"\r\n'
        f"Content-Type: image/jpeg\r\n\r\n"
    ).encode()
    post = f"\r\n--{boundary}--\r\n".encode()
    return b"".join([pre, payload, post]), boundary


def _clip_post(endpoint, photo_path):
    body, boundary = _multipart(photo_path)
    req = urllib.request.Request(
        f"{CLIP_URL}{endpoint}", data=body, method="POST",
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read())


def clip_image_vector(photo_path):
    return _clip_post("/embed/image", photo_path)["vector"]


def clip_category(photo_path):
    return _clip_post("/classify", photo_path)["category"]


def openai_text_vector(text):
    body = json.dumps({"model": OPENAI_MODEL, "input": text}).encode()
    req = urllib.request.Request(
        OPENAI_URL, data=body, method="POST",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {OPENAI_KEY}"},
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read())["data"][0]["embedding"]


def photo_for(obj_id):
    path = os.path.join(PHOTOS_DIR, f"{obj_id}.jpg")
    if not os.path.isfile(path):
        sys.exit(f"[ERROR] Falta la foto {path}")
    return path


def build_found(obj):
    photo = photo_for(obj["id"])
    # Texto EXACTO que arma FoundObjectService hoy: "" + " " + human_description + " " + title
    text = "" + " " + obj["human_description"] + " " + obj["title"]
    category = clip_category(photo)
    line = {
        "class": "FoundObject",
        "id": obj["id"],
        "properties": {
            "category": category,
            "coordinates": {"latitude": obj["lat"], "longitude": obj["lon"]},
            "found_date": obj["found_date"],
            "human_description": obj["human_description"],
            "object_finder_user_id": "0",  # seed-local.sh reasigna finders por PATCH
            "organization_id": obj["organization_id"],
            "title": obj["title"],
            "was_returned": False,          # seed-local.sh marca devueltos por PATCH
        },
        "vectors": {
            "image": clip_image_vector(photo),
            "text": openai_text_vector(text),
        },
    }
    print(f"  FoundObject {obj['title']:34s} -> categoria={category}")
    return line


def build_lost(obj):
    photo = photo_for(obj["id"])
    # Texto EXACTO que arma LostObjectService hoy: la description cruda.
    category = clip_category(photo)
    line = {
        "class": "LostObject",
        "id": obj["id"],
        "properties": {
            "category": category,
            "coordinates": {"latitude": obj["lat"], "longitude": obj["lon"]},
            "description": obj["description"],
            "lost_date": obj["lost_date"],
            "organization_id": obj["organization_id"],
            "username": obj["username"],
        },
        "vectors": {
            "image": clip_image_vector(photo),
            "text": openai_text_vector(obj["description"]),
        },
    }
    print(f"  LostObject  {obj['description'][:40]:40s} -> categoria={category}")
    return line


def main():
    if not OPENAI_KEY:
        sys.exit("[ERROR] Falta OPENAI_SECRET_KEY en el entorno (lo carga .env.local).")
    # Chequeo temprano de que el micro CLIP responde.
    try:
        with urllib.request.urlopen(f"{CLIP_URL}/health", timeout=10) as r:
            json.loads(r.read())
    except urllib.error.HTTPError as e:
        sys.exit(f"[ERROR] clip-service en {CLIP_URL} no está listo (HTTP {e.code}). "
                 f"Levantalo: docker compose up -d clip-service")
    except Exception as e:  # noqa: BLE001
        sys.exit(f"[ERROR] no se pudo contactar clip-service en {CLIP_URL}: {e}")

    print("Generando FoundObjects...")
    found = [build_found(o) for o in FOUND_OBJECTS]
    print("Generando LostObjects...")
    lost = [build_lost(o) for o in LOST_OBJECTS]

    with open(os.path.join(HERE, "FoundObject.ndjson"), "w", encoding="utf-8") as fh:
        for line in found:
            fh.write(json.dumps(line, ensure_ascii=False) + "\n")
    with open(os.path.join(HERE, "LostObject.ndjson"), "w", encoding="utf-8") as fh:
        for line in lost:
            fh.write(json.dumps(line, ensure_ascii=False) + "\n")

    print(f"\nOK: {len(found)} FoundObjects y {len(lost)} LostObjects escritos con vectores image+text.")


if __name__ == "__main__":
    main()
