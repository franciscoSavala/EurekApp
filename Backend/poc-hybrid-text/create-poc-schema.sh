#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# PoC EU-142 (#9.2) — Esquema de la clase de pruebas para la búsqueda híbrida de texto.
#
# Crea UNA clase desechable, `PocTextObject`, aislada del esquema productivo. NO toca
# start-local.sh ni las clases FoundObject/LostObject: es un banco de pruebas solo-texto para
# medir denso vs híbrido (BM25 + denso) sobre los 4 casos eje, sin depender del seed (EU-325).
#
# Diferencia clave con el esquema productivo: la propiedad de texto `content` usa tokenización
# `trigram` (en vez de `word`), que es lo que da tolerancia a typos ("evelin" ≈ "evelyn") y
# refuerza el matcheo de identificadores. Named vector `text` (vectorizer none, coseno): el
# embedding lo provee el backend, igual que en producción.
#
# Uso:
#   bash create-poc-schema.sh          # crea la clase si no existe
#   bash create-poc-schema.sh --force  # la borra y la recrea (para iterar sobre el esquema)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

WEAVIATE_URL="${WEAVIATE_URL:-http://localhost:8081}"
CLASS_NAME="PocTextObject"
FORCE="${1:-}"
# Tokenización de la propiedad de texto para el lado BM25 del híbrido. La base sólo ofrece de forma
# nativa "trigram" (n-gramas de 3 letras, tolera typos) o "word" (palabra entera, IDF fuerte sobre
# términos raros). Se elige por env para comparar ambas sin editar el script: TOKENIZATION=word.
TOKENIZATION="${TOKENIZATION:-trigram}"

CYAN='\033[0;36m'; GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }

# Named vector `text` (vectorizer none, coseno) + propiedad `content` con tokenización trigram.
# `indexSearchable: true` habilita el índice invertido BM25 sobre `content` (imprescindible para
# el lado por-palabras del hybrid). Las propiedades de metadata (doc_id/role/case_axis) sólo sirven
# para que el harness identifique el par esperado por caso; su tokenización es indiferente.
PAYLOAD='{
  "class": "PocTextObject",
  "description": "PoC EU-142: banco de pruebas solo-texto para búsqueda híbrida (denso + BM25).",
  "vectorConfig": {
    "text": { "vectorizer": { "none": {} }, "vectorIndexType": "hnsw", "vectorIndexConfig": { "distance": "cosine" } }
  },
  "properties": [
    { "name": "content",   "dataType": ["text"], "tokenization": "'"$TOKENIZATION"'", "indexSearchable": true },
    { "name": "doc_id",    "dataType": ["text"] },
    { "name": "role",      "dataType": ["text"] },
    { "name": "case_axis", "dataType": ["text"] }
  ]
}'

if [[ "$FORCE" == "--force" ]]; then
  if [[ "$(curl -s -o /dev/null -w "%{http_code}" "$WEAVIATE_URL/v1/schema/$CLASS_NAME")" == "200" ]]; then
    info "Borrando clase '$CLASS_NAME' existente (--force)..."
    curl -s -o /dev/null -X DELETE "$WEAVIATE_URL/v1/schema/$CLASS_NAME"
  fi
fi

if [[ "$(curl -s -o /dev/null -w "%{http_code}" "$WEAVIATE_URL/v1/schema/$CLASS_NAME")" == "200" ]]; then
  info "Clase '$CLASS_NAME' ya existe, saltando. Usá --force para recrearla."
  exit 0
fi

info "Creando clase '$CLASS_NAME'..."
HTTP_POST=$(curl -s -o /tmp/poc_weaviate_resp.json -w "%{http_code}" \
  -X POST "$WEAVIATE_URL/v1/schema" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

if [[ "$HTTP_POST" == "200" ]]; then
  success "Clase '$CLASS_NAME' creada (content: text/$TOKENIZATION, named vector 'text' coseno)."
else
  echo -e "${RED}[ERROR]${NC} No se pudo crear '$CLASS_NAME' (HTTP $HTTP_POST):"
  cat /tmp/poc_weaviate_resp.json 2>/dev/null
  exit 1
fi
