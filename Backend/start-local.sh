#!/usr/bin/env bash

# ─── Colores ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo -e "${CYAN}╔══════════════════════════════════╗${NC}"
echo -e "${CYAN}║      EurekApp — Local Setup      ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════╝${NC}"
echo ""

# ─── 1. Prerequisitos ────────────────────────────────────────────────────────
info "Verificando prerequisitos..."

command -v docker >/dev/null 2>&1  || error "Docker no encontrado. Instalalo desde https://docs.docker.com/get-docker/"
command -v java   >/dev/null 2>&1  || error "Java no encontrado. Necesitás Java 21."
command -v curl   >/dev/null 2>&1  || error "curl no encontrado."

docker info >/dev/null 2>&1 || error "Docker no está corriendo. Abrí Docker Desktop y esperá que inicie."

JAVA_VER=$(java -version 2>&1 | awk -F '"' '/version/{print $2}' | cut -d'.' -f1)
if [[ "$JAVA_VER" -lt 21 ]] 2>/dev/null; then
  warn "Se recomienda Java 21 (versión detectada: $JAVA_VER)"
fi

success "Prerequisitos OK"

# ─── 2. Cargar .env.local ─────────────────────────────────────────────────────
ENV_FILE="$SCRIPT_DIR/.env.local"

if [[ ! -f "$ENV_FILE" ]]; then
  warn ".env.local no encontrado."
  if [[ -f "$SCRIPT_DIR/.env.local.example" ]]; then
    cp "$SCRIPT_DIR/.env.local.example" "$ENV_FILE"
    error "Se creó .env.local desde el ejemplo. Completá las claves reales y volvé a ejecutar el script."
  else
    error "No existe .env.local ni .env.local.example. Revisá el repositorio."
  fi
fi

info "Cargando variables desde .env.local..."
# Leer línea a línea ignorando comentarios y líneas vacías, y eliminar \r (CRLF de Windows)
while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line//$'\r'/}"                  # strip \r
  [[ -z "$line" || "$line" == \#* ]] && continue
  if [[ "$line" == *=* ]]; then
    key="${line%%=*}"
    value="${line#*=}"
    # Quitar comillas simples o dobles opcionales alrededor del valor
    value="${value%\"}"
    value="${value#\"}"
    value="${value%\'}"
    value="${value#\'}"
    export "$key=$value"
  fi
done < "$ENV_FILE"

# ─── 3. Validar claves críticas (comparación exacta con los placeholders) ─────
MISSING=()

[[ -z "${OPENAI_SECRET_KEY:-}"     || "${OPENAI_SECRET_KEY}"     == "sk-..."                                ]] && MISSING+=("OPENAI_SECRET_KEY")
[[ -z "${JWT_SIGN_KEY:-}"          || "${JWT_SIGN_KEY}"          == "cambia-esto-por-un-string-largo-y-random-local" ]] && MISSING+=("JWT_SIGN_KEY")
[[ -z "${AWS_ACCESS_KEY_ID:-}"     || "${AWS_ACCESS_KEY_ID}"     == "AKIA..."                               ]] && MISSING+=("AWS_ACCESS_KEY_ID")
[[ -z "${AWS_SECRET_ACCESS_KEY:-}" || "${AWS_SECRET_ACCESS_KEY}" == "tu-secret-key-de-aws"                  ]] && MISSING+=("AWS_SECRET_ACCESS_KEY")

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo ""
  echo -e "${RED}[ERROR]${NC} Las siguientes claves en .env.local tienen valores de ejemplo sin completar:"
  for k in "${MISSING[@]}"; do
    echo -e "         ${YELLOW}→ $k${NC}"
  done
  echo ""
  exit 1
fi

success "Variables de entorno cargadas"

# ─── 4. Levantar Docker Compose ──────────────────────────────────────────────
info "Levantando MySQL y Weaviate con Docker Compose..."
docker compose -f "$SCRIPT_DIR/docker-compose.yml" up -d

# ─── 5. Esperar MySQL (healthcheck) ──────────────────────────────────────────
info "Esperando que MySQL esté saludable..."
MAX=60
i=0
while true; do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' eurekapp-mysql 2>/dev/null || echo "starting")
  if [[ "$STATUS" == "healthy" ]]; then
    break
  fi
  i=$((i + 1))
  if [[ $i -ge $MAX ]]; then
    error "MySQL no alcanzó estado healthy luego de $((MAX * 3))s. Revisá: docker logs eurekapp-mysql"
  fi
  echo -n "."
  sleep 3
done
echo ""
success "MySQL listo"

# ─── 6. Esperar Weaviate (healthcheck) ───────────────────────────────────────
info "Esperando que Weaviate esté saludable..."
i=0
while true; do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' eurekapp-weaviate 2>/dev/null || echo "starting")
  if [[ "$STATUS" == "healthy" ]]; then
    break
  fi
  i=$((i + 1))
  if [[ $i -ge $MAX ]]; then
    error "Weaviate no alcanzó estado healthy luego de $((MAX * 3))s. Revisá: docker logs eurekapp-weaviate"
  fi
  echo -n "."
  sleep 3
done
echo ""
success "Weaviate listo"

# ─── 7. Inicializar schema Weaviate (idempotente) ────────────────────────────
WEAVIATE_URL="http://localhost:8081"

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

# ─── 8. Levantar backend Spring Boot ─────────────────────────────────────────
echo ""
info "Iniciando backend Spring Boot (perfil: local)..."
info "Usá Ctrl+C para detenerlo."
echo ""

cd "$SCRIPT_DIR"

export OPENAI_SECRET_KEY JWT_SIGN_KEY AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY
export MAILTRAP_KEY="${MAILTRAP_KEY:-}"

./mvnw spring-boot:run -Dspring-boot.run.profiles=local
