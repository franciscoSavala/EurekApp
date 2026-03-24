#!/usr/bin/env bash

# ─── Inicialización del schema de Weaviate (idempotente) ─────────────────────
# Crea las clases FoundObject y LostObject si no existen.
# Se puede correr múltiples veces sin efecto secundario.
#
# Uso: bash init-weaviate.sh
# Env: WEAVIATE_URL (default: http://localhost:8081)

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

WEAVIATE_URL="${WEAVIATE_URL:-http://localhost:8081}"

command -v curl >/dev/null 2>&1 || error "curl no encontrado."

create_class_if_missing() {
  local CLASS_NAME="$1"
  local PAYLOAD="$2"

  HTTP_CHECK=$(curl -s -o /dev/null -w "%{http_code}" "$WEAVIATE_URL/v1/schema/$CLASS_NAME")
  if [[ "$HTTP_CHECK" == "200" ]]; then
    info "Clase '$CLASS_NAME' ya existe, saltando."
  else
    info "Creando clase '$CLASS_NAME'..."
    HTTP_POST=$(curl -s -o /tmp/weaviate_resp.json -w "%{http_code}" \
      -X POST "$WEAVIATE_URL/v1/schema" \
      -H "Content-Type: application/json" \
      -d "$PAYLOAD")
    if [[ "$HTTP_POST" == "200" ]]; then
      success "Clase '$CLASS_NAME' creada"
    else
      echo -e "${RED}[ERROR]${NC} No se pudo crear '$CLASS_NAME' (HTTP $HTTP_POST):"
      cat /tmp/weaviate_resp.json 2>/dev/null
      exit 1
    fi
  fi
}

create_class_if_missing "FoundObject" '{
  "class": "FoundObject",
  "description": "Clase para representar objetos encontrados.",
  "vectorIndexType": "hnsw",
  "vectorIndexConfig": { "distance": "cosine" },
  "properties": [
    { "name": "found_date",        "dataType": ["date"] },
    { "name": "title",             "dataType": ["string"] },
    { "name": "human_description", "dataType": ["string"] },
    { "name": "ai_description",    "dataType": ["string"] },
    { "name": "organization_id",   "dataType": ["text"] },
    { "name": "coordinates",       "dataType": ["geoCoordinates"] },
    { "name": "was_returned",      "dataType": ["boolean"] }
  ]
}'

create_class_if_missing "LostObject" '{
  "class": "LostObject",
  "description": "Clase para representar busquedas abiertas de un objeto perdido.",
  "vectorIndexType": "hnsw",
  "vectorIndexConfig": { "distance": "cosine" },
  "properties": [
    { "name": "lost_date",       "dataType": ["date"] },
    { "name": "description",     "dataType": ["string"] },
    { "name": "username",        "dataType": ["string"] },
    { "name": "organization_id", "dataType": ["text"] },
    { "name": "coordinates",     "dataType": ["geoCoordinates"] }
  ]
}'

success "Schema de Weaviate inicializado correctamente."
