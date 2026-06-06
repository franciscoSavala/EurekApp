#!/usr/bin/env bash

# ─── Colores ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'
BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
header()  { echo -e "\n${BOLD}${CYAN}── $* ──${NC}"; }

MYSQL_EXEC="docker exec -i eurekapp-mysql mysql --default-character-set=utf8mb4 -u eurekapp -peurekapp eurekapp"
WEAVIATE_URL="http://localhost:8081"

# Cargar credenciales AWS desde .env.local si existe y AWS CLI no tiene sesión activa
ENV_LOCAL="$(dirname "$0")/.env.local"
if [[ -f "$ENV_LOCAL" ]]; then
  set -a; source "$ENV_LOCAL"; set +a
fi

echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║    EurekApp — Seed Base de Datos     ║${NC}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════╝${NC}"
echo ""

# ─── 1. Verificar que los contenedores estan corriendo ───────────────────────
header "Verificando contenedores"

docker inspect eurekapp-mysql  --format='{{.State.Status}}' 2>/dev/null | grep -q "running" \
  || error "MySQL no esta corriendo. Ejecuta primero: bash start-local.sh"
docker inspect eurekapp-weaviate --format='{{.State.Status}}' 2>/dev/null | grep -q "running" \
  || error "Weaviate no esta corriendo. Ejecuta primero: bash start-local.sh"

success "Contenedores OK"

# ─── 2. Generar hash BCrypt para la contrasena de seed ───────────────────────
header "Generando hash de contrasena"

SEED_PASSWORD="Eurekapp1!"

# Detectar python funcional (en Windows, python3 puede ser un stub de la Store)
PYTHON_CMD=""
for _py in python python3; do
  if command -v "$_py" &>/dev/null && "$_py" -c "import sys; sys.exit(0)" &>/dev/null; then
    PYTHON_CMD="$_py"
    break
  fi
done
BCRYPT_HASH=$(${PYTHON_CMD} - <<'PYEOF' 2>/dev/null
import sys
try:
    import bcrypt
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'bcrypt', '-q'],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    import bcrypt

pw = b'Eurekapp1!'
print(bcrypt.hashpw(pw, bcrypt.gensalt(10)).decode())
PYEOF
)

# Fallback: hash BCrypt precalculado para la contrasena "Eurekapp1!".
# (Verificado con bcrypt.checkpw → True. NO degradar a otra contrasena.)
if [[ -z "$BCRYPT_HASH" ]]; then
  warn "python3/bcrypt no disponible. Usando hash de fallback para 'Eurekapp1!'."
  BCRYPT_HASH='$2b$10$ZH9ybHk6M3hzkYnpVH3FLudxIpTFnNxabcjxe.iQdvmZ7RBI.tCvW'
fi

info "Contrasena de todos los usuarios seed: ${BOLD}${SEED_PASSWORD}${NC}"
success "Hash generado"

# ─── 3. Verificar archivos de datos de Weaviate ──────────────────────────────
header "Verificando datos de Weaviate (embeddings reales)"

# Los objetos de Weaviate (FoundObject / LostObject) ya no usan vectores dummy:
# fueron cargados via la API real (OpenAI text-embedding-3-small) y exportados a NDJSON.
# Cada linea de estos archivos es un objeto listo para POST a /v1/objects.
SEED_DATA_DIR="$(dirname "$0")/seed-data"
FOUND_NDJSON="$SEED_DATA_DIR/FoundObject.ndjson"
LOST_NDJSON="$SEED_DATA_DIR/LostObject.ndjson"

[[ -f "$FOUND_NDJSON" ]] || error "No se encontro $FOUND_NDJSON"
[[ -f "$LOST_NDJSON"  ]] || error "No se encontro $LOST_NDJSON"

FOUND_COUNT=$(grep -c '[^[:space:]]' "$FOUND_NDJSON")
LOST_COUNT=$(grep -c '[^[:space:]]' "$LOST_NDJSON")
success "Datos OK — FoundObjects: $FOUND_COUNT, LostObjects: $LOST_COUNT"

# ─── 4. Confirmar reset ──────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}${BOLD}⚠  Esto va a BORRAR todos los datos actuales y reemplazarlos con datos de seed.${NC}"
if [[ "${1:-}" != "--force" ]]; then
  read -rp "Continuar? (s/N): " CONFIRM
  [[ "$CONFIRM" =~ ^[sS]$ ]] || { echo "Cancelado."; exit 0; }
fi

# ─── 5. Verificar y corregir ENUM de role ───────────────────────────────────
header "Verificando ENUM de columna 'role'"

ENUM_OK=$($MYSQL_EXEC 2>/dev/null <<'SQL'
SELECT COLUMN_TYPE FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'eurekapp' AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role';
SQL
)

if echo "$ENUM_OK" | grep -q "ENCARGADO"; then
  success "ENUM de 'role' contiene ENCARGADO — OK"
else
  warn "ENUM de 'role' no contiene ENCARGADO. Aplicando ALTER TABLE..."
  $MYSQL_EXEC 2>/dev/null <<'SQL'
ALTER TABLE users
  MODIFY COLUMN role ENUM('USER','ORGANIZATION_OWNER','ORGANIZATION_EMPLOYEE','ENCARGADO','ADMIN');
SQL
  success "ENUM corregido"
fi

# ─── 6. Limpiar MySQL ────────────────────────────────────────────────────────
header "Limpiando MySQL"

$MYSQL_EXEC 2>/dev/null <<'SQL'
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE reclamo_history;
TRUNCATE TABLE reclamos;
TRUNCATE TABLE search_feedback;
TRUNCATE TABLE usability_feedback;
TRUNCATE TABLE fraud_alert;
TRUNCATE TABLE reward_exclusions;
TRUNCATE TABLE return_found_objects;
TRUNCATE TABLE add_employee_request;
TRUNCATE TABLE organization_request;
TRUNCATE TABLE in_app_notifications;
TRUNCATE TABLE users;
TRUNCATE TABLE organizations;
SET FOREIGN_KEY_CHECKS = 1;
SQL
success "MySQL limpio"

# ─── 7. Limpiar Weaviate (nuke total) ────────────────────────────────────────
header "Limpiando Weaviate (nuke total)"

for CLASS in FoundObject LostObject; do
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
    -X DELETE "$WEAVIATE_URL/v1/schema/$CLASS")
  if [[ "$HTTP" == "200" ]]; then
    success "  Clase $CLASS eliminada"
  else
    warn "  DELETE /v1/schema/$CLASS → HTTP $HTTP (puede que no existiera)"
  fi
done

sleep 2

curl -sf -X POST "$WEAVIATE_URL/v1/schema" \
  -H "Content-Type: application/json" \
  -d '{
    "class": "FoundObject",
    "description": "Clase para representar objetos encontrados.",
    "vectorIndexType": "hnsw",
    "vectorIndexConfig": {"distance": "cosine"},
    "properties": [
      {"name": "found_date",            "dataType": ["date"]},
      {"name": "title",                 "dataType": ["string"]},
      {"name": "human_description",     "dataType": ["string"]},
      {"name": "ai_description",        "dataType": ["string"]},
      {"name": "organization_id",       "dataType": ["text"]},
      {"name": "coordinates",           "dataType": ["geoCoordinates"]},
      {"name": "was_returned",          "dataType": ["boolean"]},
      {"name": "object_finder_user_id", "dataType": ["text"]},
      {"name": "category",              "dataType": ["text"]}
    ]
  }' >/dev/null && success "  Schema FoundObject recreado" || warn "  No se pudo recrear FoundObject"

curl -sf -X POST "$WEAVIATE_URL/v1/schema" \
  -H "Content-Type: application/json" \
  -d '{
    "class": "LostObject",
    "description": "Clase para representar busquedas abiertas de un objeto perdido.",
    "vectorIndexType": "hnsw",
    "vectorIndexConfig": {"distance": "cosine"},
    "properties": [
      {"name": "lost_date",       "dataType": ["date"]},
      {"name": "description",     "dataType": ["string"]},
      {"name": "username",        "dataType": ["string"]},
      {"name": "organization_id", "dataType": ["text"]},
      {"name": "coordinates",     "dataType": ["geoCoordinates"]}
    ]
  }' >/dev/null && success "  Schema LostObject recreado" || warn "  No se pudo recrear LostObject"

success "Weaviate limpio y schema recreado"

# ─── 8. Insertar Organizaciones ──────────────────────────────────────────────
header "Insertando Organizaciones"

$MYSQL_EXEC 2>/dev/null <<'SQL'
INSERT INTO organizations (id, name, contact_data, street, street_number, city, province, country, organization_type, latitude, longitude, active) VALUES
(1, 'UTN FRC',                            'objetos.perdidos@frc.utn.edu.ar',  'Maestro Marcelo López',      '3814', 'Córdoba', 'Córdoba', 'Argentina', 'UNIVERSITY',    -31.4377, -64.1829, 1),
(2, 'Terminal de Omnibus Cordoba',        'objetos@terminalcordoba.com',       'Bvd. Perón',                 '380',  'Córdoba', 'Córdoba', 'Argentina', 'BUS_TERMINAL',  -31.4201, -64.1888, 1),
(3, 'Aeropuerto Internacional Cordoba',   'objetosperdidos@aa2000.com.ar',     'Av. Fuerza Aérea Argentina', '6900', 'Córdoba', 'Córdoba', 'Argentina', 'AIRPORT',       -31.3233, -64.2081, 1),
(4, 'Shopping Patio Olmos',               'objetos@patioolomos.com.ar',        'Vélez Sársfield',            '361',  'Córdoba', 'Córdoba', 'Argentina', 'SHOPPING',      -31.4163, -64.1885, 1),
(5, 'UNC Ciudad Universitaria',           'objetosperdidos@unc.edu.ar',        'Av. Vélez Sársfield',        '5000', 'Córdoba', 'Córdoba', 'Argentina', 'UNIVERSITY',    -31.4384, -64.1917, 1),
(6, 'Dinosaurio Mall',                    'objetos@dinosauriomall.com.ar',     'Av. Ejército Argentino',     '6050', 'Córdoba', 'Córdoba', 'Argentina', 'SHOPPING_MALL', -31.3693, -64.2254, 1);
SQL
success "6 organizaciones insertadas"

# ─── 9. Insertar Usuarios ────────────────────────────────────────────────────
header "Insertando Usuarios"

HASH_ESCAPED="${BCRYPT_HASH//\'/\'\'}"

$MYSQL_EXEC 2>/dev/null <<SQL
INSERT INTO users (id, username, password, active, first_name, last_name, role, organization_id, XP, returned_objects) VALUES
(1,  'admin@eurekapp.com',          '$HASH_ESCAPED', 1, 'Admin',    'EurekApp',  'ADMIN',                  NULL, 0,   0),
(2,  'owner.utn@eurekapp.com',      '$HASH_ESCAPED', 1, 'Martina',  'Gonzalez',  'ORGANIZATION_OWNER',     1,    150,  3),
(3,  'owner.term@eurekapp.com',     '$HASH_ESCAPED', 1, 'Rodrigo',  'Fernandez', 'ORGANIZATION_OWNER',     2,    80,   2),
(4,  'encargado.utn@eurekapp.com',  '$HASH_ESCAPED', 1, 'Carlos',   'Mendoza',   'ENCARGADO',              1,    0,    0),
(5,  'emp1.utn@eurekapp.com',       '$HASH_ESCAPED', 1, 'Lucia',    'Perez',     'ORGANIZATION_EMPLOYEE',  1,    20,   0),
(6,  'emp2.utn@eurekapp.com',       '$HASH_ESCAPED', 1, 'Tomas',    'Ramirez',   'ORGANIZATION_EMPLOYEE',  1,    20,   0),
(7,  'julia@mail.com',              '$HASH_ESCAPED', 1, 'Julia',    'Morales',   'USER',                   NULL, 20,   1),
(8,  'pedro@mail.com',              '$HASH_ESCAPED', 1, 'Pedro',    'Soria',     'USER',                   NULL, 20,   1),
(9,  'valeria@mail.com',            '$HASH_ESCAPED', 1, 'Valeria',  'Castro',    'USER',                   NULL, 0,    0),
(10, 'emp1.aero@eurekapp.com',      '$HASH_ESCAPED', 1, 'Sofia',     'Herrera',   'ORGANIZATION_EMPLOYEE',  3,    0,    0),
(11, 'owner.patio@eurekapp.com',    '$HASH_ESCAPED', 1, 'Camila',    'Vargas',    'ORGANIZATION_OWNER',     4,    0,    0),
(12, 'emp1.patio@eurekapp.com',     '$HASH_ESCAPED', 1, 'Ignacio',   'Molina',    'ORGANIZATION_EMPLOYEE',  4,    0,    0),
(13, 'owner.unc@eurekapp.com',      '$HASH_ESCAPED', 1, 'Diego',     'Salinas',   'ORGANIZATION_OWNER',     5,    0,    0),
(14, 'emp1.unc@eurekapp.com',       '$HASH_ESCAPED', 1, 'Florencia', 'Torres',    'ORGANIZATION_EMPLOYEE',  5,    0,    0),
(15, 'owner.dino@eurekapp.com',     '$HASH_ESCAPED', 1, 'Sebastián', 'Romero',    'ORGANIZATION_OWNER',     6,    0,    0),
(16, 'emp1.dino@eurekapp.com',      '$HASH_ESCAPED', 1, 'Natalia',   'Gutiérrez', 'ORGANIZATION_EMPLOYEE',  6,    0,    0);
SQL
success "16 usuarios insertados"

# ─── 10. Insertar FoundObjects en Weaviate (desde NDJSON con embeddings reales) ─
header "Insertando FoundObjects en Weaviate"

# Cada linea del NDJSON ya es un objeto completo (class, id, properties, vector)
# listo para POST a /v1/objects. Los vectores son embeddings reales de OpenAI.
FO_INSERTED=0
while IFS= read -r line; do
  [[ -z "${line// }" ]] && continue
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$WEAVIATE_URL/v1/objects" \
    -H "Content-Type: application/json" \
    --data-binary "$line")
  if [[ "$HTTP" == "200" ]]; then
    FO_INSERTED=$((FO_INSERTED + 1))
  else
    warn "  FoundObject → HTTP $HTTP"
  fi
done < "$FOUND_NDJSON"
success "  $FO_INSERTED FoundObjects insertados"

# UUID reales de cada FoundObject. Como insertamos directo en Weaviate con un "id"
# que elegimos nosotros, estos UUID son fijos y conocidos: son los mismos que
# figuran en el campo "id" de FoundObject.ndjson, y apuntan a las imagenes que ya
# existen en S3. Las secciones MySQL (retornos, fraud_alerts, feedback, reclamos)
# referencian estos UUID directamente, sin depender de titulos.
# (FO_UUID_7 no existe: la "Tarjeta universitaria" fue descartada del dataset.)
FO_UUID_1="7ea43eba-7343-4cd8-b5d0-b736e3d575a3"   # Billetera negra de cuero      (org 1)
FO_UUID_2="df2aa6a0-d15c-46e8-902a-e5394538a43e"   # Llave con llavero azul        (org 1)
FO_UUID_3="25e71dcb-9d0d-4b75-96f2-df60b7d99261"   # Auriculares inalambricos      (org 2)
FO_UUID_4="494ddbc4-b4d8-4935-a77c-1d3e7363b67d"   # Mochila azul con libros       (org 1)
FO_UUID_5="18da5796-50dc-4383-8b1f-27e524b04b5d"   # Celular Samsung negro         (org 3)
FO_UUID_6="4b43a1d8-1491-4077-9c1c-463e5906cdeb"   # Paraguas negro plegable       (org 1)
FO_UUID_8="85c55156-216f-4b6c-aa65-782e066567b6"   # Notebook Dell gris            (org 2)
FO_UUID_9="ebaa9336-e9fd-4556-a96e-9c1538d165cb"   # Billetera marron con DNI      (org 2)
FO_UUID_10="498d742e-49e6-4c88-bf8d-f0313581dfaa"  # Cargador USB-C blanco         (org 3)
FO_UUID_11="a1047f2f-0fcd-41b1-92ad-485dd04cb5d8"  # Anteojos de sol negros        (org 1)

# ─── 10b. Asignar finders a FoundObjects ─────────────────────────────────────
header "Asignando finders a FoundObjects (object_finder_user_id)"

# Todos los objetos donde el finder tiene cuenta en la app.
# FO_UUID_2 (Llave) queda con finder_id="0" (anonimo, sin cuenta — caso de uso alternativo).
declare -A FO_FINDERS=(
  ["$FO_UUID_1"]="9"    # Billetera negra de cuero → valeria
  ["$FO_UUID_3"]="9"    # Auriculares              → valeria
  ["$FO_UUID_4"]="6"    # Mochila azul             → emp2.utn  (Tomas Ramirez)
  ["$FO_UUID_5"]="8"    # Celular Samsung          → pedro
  ["$FO_UUID_6"]="5"    # Paraguas                 → emp1.utn  (Lucia Perez)
  ["$FO_UUID_8"]="8"    # Notebook Dell            → pedro
  ["$FO_UUID_9"]="10"   # Billetera marron con DNI → emp1.aero (Sofia Herrera)
  ["$FO_UUID_10"]="7"   # Cargador USB-C           → julia
  ["$FO_UUID_11"]="7"   # Anteojos                 → julia
)
for UUID in "${!FO_FINDERS[@]}"; do
  USER_ID="${FO_FINDERS[$UUID]}"
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
    -X PATCH "$WEAVIATE_URL/v1/objects/FoundObject/$UUID" \
    -H "Content-Type: application/json" \
    -d "{\"properties\": {\"object_finder_user_id\": \"$USER_ID\"}}")
  [[ "$HTTP" == "200" ]] \
    && success "  finder=$USER_ID → $UUID" \
    || warn    "  PATCH fallido (HTTP $HTTP) → $UUID"
done

# ─── 11. Insertar LostObjects en Weaviate (desde NDJSON con embeddings reales) ──
header "Insertando LostObjects en Weaviate"

LO_INSERTED=0
while IFS= read -r line; do
  [[ -z "${line// }" ]] && continue
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$WEAVIATE_URL/v1/objects" \
    -H "Content-Type: application/json" \
    --data-binary "$line")
  if [[ "$HTTP" == "200" ]]; then
    LO_INSERTED=$((LO_INSERTED + 1))
  else
    warn "  LostObject → HTTP $HTTP"
  fi
done < "$LOST_NDJSON"
success "  $LO_INSERTED LostObjects insertados"

# ─── 12. Insertar Retornos ───────────────────────────────────────────────────
header "Insertando Retornos"

$MYSQL_EXEC 2>/dev/null <<SQL
INSERT INTO return_found_objects
  (found_objectuuid, user_id, DNI, phone_number, person_photo_UUID, datetime_of_return, notification_sent_at, notification_recipient)
VALUES
('$FO_UUID_6',  7,    '30987654', '3514000001', 'person-photo-001', '2026-04-20 10:00:00', '2026-04-20 10:05:00', 'finder1@mail.com'),
('$FO_UUID_11', NULL, '42111222', '3514000002', 'person-photo-002', '2026-05-02 14:00:00', '2026-05-02 14:05:00', 'julia@mail.com'),
('$FO_UUID_2',  NULL, '35123456', '3514000003', 'person-photo-003', '2026-05-11 09:00:00', '2026-05-11 09:03:00', 'finder2@mail.com'),
('$FO_UUID_8',  8,    '28123456', '3514000004', 'person-photo-004', '2026-05-06 14:35:00', '2026-05-06 14:40:00', 'finder3@mail.com'),
('$FO_UUID_9',  7,    '28123456', '3514000005', 'person-photo-005', '2026-05-13 12:00:00', '2026-05-13 12:02:00', 'finder4@mail.com');
SQL
success "5 retornos insertados (3 UTN, 2 Terminal)"

header "Marcando objetos devueltos en Weaviate (was_returned=true)"
for UUID in "$FO_UUID_6" "$FO_UUID_11" "$FO_UUID_2" "$FO_UUID_8" "$FO_UUID_9"; do
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
    -X PATCH "$WEAVIATE_URL/v1/objects/FoundObject/$UUID" \
    -H "Content-Type: application/json" \
    -d '{"properties": {"was_returned": true}}')
  [[ "$HTTP" == "200" ]] \
    && success "  was_returned=true → $UUID" \
    || warn    "  PATCH fallido (HTTP $HTTP) → $UUID"
done

# ─── 13. Insertar exclusiones de recompensa ──────────────────────────────────
header "Insertando exclusiones de recompensa"

$MYSQL_EXEC 2>/dev/null <<SQL
INSERT INTO reward_exclusions
  (found_objectuuid, user_id, user_role, reason, excluded_at, organization_id)
VALUES
('$FO_UUID_4', 6, 'ORGANIZATION_EMPLOYEE', 'INCOMPATIBLE_ROLE', '2026-05-07 09:00:00', '1'),
('$FO_UUID_6', 5, 'ORGANIZATION_EMPLOYEE', 'INCOMPATIBLE_ROLE', '2026-04-15 09:00:00', '1'),
('$FO_UUID_9', 10,'ORGANIZATION_EMPLOYEE', 'INCOMPATIBLE_ROLE', '2026-05-12 09:00:00', '3');
SQL
success "3 exclusiones de recompensa registradas (empleados internos)"

# ─── 14. Insertar SearchFeedback ─────────────────────────────────────────────
header "Insertando SearchFeedback"

$MYSQL_EXEC 2>/dev/null <<SQL
INSERT INTO search_feedback (organization_id, found_object_uuid, star_rating, was_found, comment, created_at, user_id) VALUES
('1', '$FO_UUID_1', 5, 1, 'Lo encontre rapido, excelente sistema',             '2026-04-29 11:00:00', 7),
('1', NULL,          2, 0, 'No encontre mi objeto, poca descripcion disponible', '2026-05-03 09:30:00', 8),
('2', '$FO_UUID_3',  4, 1, NULL,                                                 '2026-05-06 15:00:00', 8),
('1', NULL,          1, 0, 'La busqueda no funciono bien',                       '2026-05-07 10:00:00', 9),
('1', '$FO_UUID_4',  3, 1, 'Tardo un poco pero lo encontre',                    '2026-05-08 14:00:00', 9),
('3', NULL,          5, 0, NULL,                                                 '2026-05-10 08:00:00', 7),
('1', '$FO_UUID_2',  4, 1, 'Muy util la app',                                   '2026-05-11 16:00:00', 7),
('2', NULL,          2, 0, 'No habia resultados precisos',                       '2026-05-12 12:00:00', 9),
('2', '$FO_UUID_9',  5, 1, 'Recupere mi billetera al dia siguiente!',            '2026-05-13 10:00:00', 7),
('1', NULL,          3, 0, NULL,                                                 '2026-05-15 09:00:00', 8);
SQL
success "10 registros de search_feedback insertados"

# ─── 15. Insertar UsabilityFeedback ──────────────────────────────────────────
header "Insertando UsabilityFeedback"

$MYSQL_EXEC 2>/dev/null <<'SQL'
INSERT INTO usability_feedback (star_rating, aspects, comment, context, created_at, user_id) VALUES
(5, 'FACILIDAD_USO,NAVEGACION', 'Muy facil de usar',                     'search',        '2026-04-20 10:00:00', 5),
(4, 'CLARIDAD',                  NULL,                                    'profile',       '2026-04-25 11:00:00', 6),
(2, 'NAVEGACION',               'Me confundi con los menus',              'upload_object', '2026-05-01 09:00:00', 5),
(5, 'FACILIDAD_USO,CLARIDAD',   'Excelente experiencia',                  'search',        '2026-05-05 14:00:00', 2),
(3, 'NAVEGACION,FACILIDAD_USO', 'Regular, algunos botones confusos',     'profile',       '2026-05-10 16:00:00', 6),
(4, 'CLARIDAD',                  NULL,                                    'upload_object', '2026-05-14 08:00:00', 5),
(1, 'NAVEGACION',               'No entendi como reportar un objeto',     'upload_object', '2026-05-18 10:00:00', 6);
SQL
success "7 registros de usability_feedback insertados"

# ─── 16. Insertar FraudAlerts ────────────────────────────────────────────────
header "Insertando FraudAlerts"

$MYSQL_EXEC 2>/dev/null <<SQL
INSERT INTO fraud_alert (organization_id, found_object_uuid, suspect_user_id, reason, details, status, created_at, resolved_at, resolved_by_id) VALUES
('1', '$FO_UUID_1', 7,    'MULTIPLE_CLAIMERS_SAME_OBJECT', 'Tres personas reclamaron la misma billetera en 10 minutos',  'PENDING',          '2026-05-03 12:00:00', NULL,                  NULL),
('1', '$FO_UUID_4', 8,    'HIGH_CLAIM_FREQUENCY',          'El usuario realizo 8 reclamos en 2 dias',                   'CONFIRMED_FRAUD',  '2026-05-09 09:00:00', '2026-05-10 10:00:00', 2),
('2', '$FO_UUID_3', NULL, 'FINDER_CLAIMER_COLLUSION',      'El registrador y reclamante tienen el mismo dispositivo',   'FALSE_POSITIVE',   '2026-05-07 11:00:00', '2026-05-08 15:00:00', 3),
('1', NULL,         9,    'REPEATED_REJECTIONS',           'El usuario tuvo 5 reclamos rechazados seguidos',            'PENDING',          '2026-05-20 08:00:00', NULL,                  NULL);
SQL
success "4 fraud_alerts insertados (2 PENDING, 1 CONFIRMED_FRAUD, 1 FALSE_POSITIVE)"

# ─── 17. Insertar Reclamos ───────────────────────────────────────────────────
header "Insertando Reclamos"

$MYSQL_EXEC 2>/dev/null <<SQL
INSERT INTO reclamos (organization_id, found_object_uuid, found_object_category, user_id, comment, claim_description, star_rating, status, created_at, updated_at, search_feedback_id) VALUES
('1', '$FO_UUID_1', 'Billeteras',  7, 'Creo que es mi billetera',    'Billetera negra, tenia mi DNI y tarjeta VISA',    4, 'EN_REVISION', '2026-04-30 10:00:00', '2026-05-02 14:00:00', 1),
('1', '$FO_UUID_4', 'Mochilas',    9, 'Es mi mochila de ingenieria', 'Mochila azul con libros de calculo y fisica',     3, 'EN_REVISION', '2026-05-08 15:00:00', '2026-05-09 09:00:00', 5),
('2', '$FO_UUID_3', 'Electronica', 8, 'Son mis auriculares',         'Auriculares Sony blancos, tenian funda negra',    5, 'EN_REVISION', '2026-05-06 16:00:00', '2026-05-07 11:00:00', 3),
('1', '$FO_UUID_2', 'Llaves',      7, 'Parecen mis llaves',          'Llave de casa con llavero azul de plastico',      2, 'RECHAZADO',   '2026-05-03 09:00:00', '2026-05-04 08:00:00', 7),
('3', '$FO_UUID_5', 'Celulares',   9, 'Es mi celular Samsung',       'Samsung Galaxy A54 negro, pantalla rota',         1, 'PENDIENTE',   '2026-05-10 12:00:00', NULL,                  NULL);
SQL
success "5 reclamos insertados"

# ─── 18. Insertar ReclamoHistory ─────────────────────────────────────────────
header "Insertando ReclamoHistory"

$MYSQL_EXEC 2>/dev/null <<'SQL'
INSERT INTO reclamo_history (reclamo_id, previous_status, new_status, changed_by_id, changed_at, note) VALUES
(1, 'PENDIENTE',    'EN_REVISION', 2, '2026-05-01 09:00:00', 'Iniciando revision del caso');
SQL
success "1 entrada de reclamo_history insertada"

# ─── 19. Insertar OrganizationRequests ──────────────────────────────────────
header "Insertando OrganizationRequests"

$MYSQL_EXEC 2>/dev/null <<SQL
INSERT INTO organization_request
  (id, requesting_user_id, organization_name, organization_type, custom_organization_type,
   street, street_number, city, province, country, latitude, longitude,
   owner_first_name, owner_last_name, owner_email, owner_phone,
   reason, status, created_at, resolved_at, resolved_by_user_id, admin_note)
VALUES
(1, 7,  'Club Atletico Belgrano',       'CLUB',            NULL,
   'Av. Patria',       '1600', 'Cordoba', 'Cordoba', 'Argentina', -31.3720, -64.2080,
   'Juliana', 'Morales', 'julia@mail.com',  '+54 9 351 111 2222',
   'Queremos gestionar objetos perdidos en los partidos del estadio.',
   'PENDING_APPROVAL', '2026-06-01 09:00:00', NULL, NULL, NULL),

(2, 8,  'Hospital Privado',             'HOSPITAL',        NULL,
   'Naciones Unidas',  '346',  'Cordoba', 'Cordoba', 'Argentina', -31.3876, -64.1803,
   'Pedro',   'Soria',   'pedro@mail.com',  '+54 9 351 333 4444',
   'El hospital necesita un sistema para devolver objetos a pacientes y familiares.',
   'APPROVED',         '2026-05-20 10:30:00', '2026-05-22 09:15:00', 1, NULL),

(3, 9,  'Colegio Nacional de Monserrat','SCHOOL',          NULL,
   'Obispo Trejo',     '294',  'Cordoba', 'Cordoba', 'Argentina', -31.4155, -64.1841,
   'Valeria', 'Castro',  'valeria@mail.com', '+54 9 351 555 6666',
   'El colegio quiere digitalizar la gestion de objetos perdidos del alumnado.',
   'REJECTED',         '2026-05-15 14:00:00', '2026-05-17 11:30:00', 1,
   'La organizacion no cumple con los requisitos minimos de infraestructura para gestionar objetos perdidos en la plataforma.'),

(4, 7,  'Mercado Norte',                'OTHER',           'Mercado municipal',
   'Bvd. Illia',       '300',  'Cordoba', 'Cordoba', 'Argentina', -31.4125, -64.1862,
   'Juliana', 'Morales', 'julia@mail.com',  '+54 9 351 111 2222',
   'Los puestos del mercado frecuentemente reciben objetos olvidados por los clientes.',
   'CANCELLED',        '2026-05-10 11:00:00', NULL, NULL, NULL);
SQL
success "4 organization_requests insertados (1 PENDING, 1 APPROVED, 1 REJECTED, 1 CANCELLED)"

# ─── 20. Upload de imagenes a S3 ─────────────────────────────────────────────
header "Imagenes S3"

S3_BUCKET="eurekapp-temp-local"
S3_REGION="sa-east-1"
IMG_DIR="$(dirname "$0")/seed-data/images"
mkdir -p "$IMG_DIR"

FO_KEYS=(
  "$FO_UUID_1" "$FO_UUID_2" "$FO_UUID_3" "$FO_UUID_4"
  "$FO_UUID_5" "$FO_UUID_6" "$FO_UUID_8" "$FO_UUID_9"
  "$FO_UUID_10" "$FO_UUID_11"
)
PERSON_KEYS=("person-photo-001" "person-photo-002" "person-photo-003" "person-photo-004" "person-photo-005")

S3_UPLOADED=0

upload_image() {
  local KEY="$1" SEED="$2" IS_PORTRAIT="${3:-false}"
  local CACHED="$IMG_DIR/${KEY}.jpg"

  # Si ya existe en S3, saltear
  if aws s3 ls "s3://${S3_BUCKET}/${KEY}" --region "$S3_REGION" >/dev/null 2>&1; then
    info "  S3 ✓ $KEY (ya existia)"
    S3_UPLOADED=$((S3_UPLOADED + 1))
    return
  fi

  # Descargar solo si no esta cacheada localmente
  if [[ ! -f "$CACHED" ]]; then
    local SIZE="400/300"
    [[ "$IS_PORTRAIT" == "true" ]] && SIZE="300/400"
    curl -sL "https://picsum.photos/seed/${SEED}/${SIZE}" -o "$CACHED" 2>/dev/null \
      || { warn "  No se pudo descargar imagen para $KEY"; return; }
  fi

  aws s3 cp "$CACHED" "s3://${S3_BUCKET}/${KEY}" --region "$S3_REGION" --quiet 2>/dev/null \
    && { info "  S3 ✓ $KEY (subida)"; S3_UPLOADED=$((S3_UPLOADED + 1)); } \
    || warn "  S3 ✗ $KEY"
}

if command -v aws &>/dev/null && aws sts get-caller-identity --region "$S3_REGION" >/dev/null 2>&1; then
  info "AWS CLI detectado — verificando/subiendo imagenes..."
  i=1
  for KEY in "${FO_KEYS[@]}"; do
    upload_image "$KEY" "fo$(printf '%02d' $i)"
    i=$((i + 1))
  done
  i=1
  for KEY in "${PERSON_KEYS[@]}"; do
    upload_image "$KEY" "pp$(printf '%02d' $i)" "true"
    i=$((i + 1))
  done
  success "$S3_UPLOADED imagenes OK en S3 (bucket: $S3_BUCKET)"
else
  warn "AWS CLI no disponible o sin credenciales — se omite upload de imagenes"
  warn "Al tener credenciales, correr el script de nuevo para subir las imagenes"
fi

# ─── 21. Resumen ─────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║          EurekApp — Seed completado exitosamente         ║${NC}"
echo -e "${GREEN}${BOLD}╠══════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}${BOLD}║${NC}  MySQL                                                   ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    Organizaciones        : 6                             ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    Usuarios              : 16                            ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    Retornos              : 5  (3 UTN, 2 Terminal)       ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    Exclusiones reward    : 3                             ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    Search Feedback       : 10                            ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    Usability Feedback    : 7                             ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    Fraud Alerts          : 4                             ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    Reclamos              : 5                             ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    Reclamo History       : 1                             ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    Org Requests          : 4  (1 PENDING/APPROVED/REJECTED/CANCELLED)${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}╠══════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}${BOLD}║${NC}  Weaviate                                                ${GREEN}${BOLD}║${NC}"
printf "${GREEN}${BOLD}║${NC}  %-54s${GREEN}${BOLD}║${NC}\n" "  FoundObjects          : ${FO_INSERTED} (embeddings reales)"
printf "${GREEN}${BOLD}║${NC}  %-54s${GREEN}${BOLD}║${NC}\n" "  LostObjects           : ${LO_INSERTED}"
echo -e "${GREEN}${BOLD}╠══════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}${BOLD}║${NC}  S3                                                      ${GREEN}${BOLD}║${NC}"
printf "${GREEN}${BOLD}║${NC}  %-54s${GREEN}${BOLD}║${NC}\n" "  Imagenes subidas      : 0 (ya existen por UUID)"
echo -e "${GREEN}${BOLD}╠══════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}${BOLD}║${NC}  Contrasena de todos los usuarios: ${BOLD}${SEED_PASSWORD}${NC}           ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}╠══════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}${BOLD}║${NC}  Usuarios disponibles:                                   ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    admin@eurekapp.com          → ADMIN                   ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    owner.utn@eurekapp.com      → OWNER  (UTN FRC)        ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    owner.term@eurekapp.com     → OWNER  (Terminal)       ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    encargado.utn@eurekapp.com  → ENCARGADO (UTN FRC)     ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    emp1.utn@eurekapp.com       → EMPLOYEE (UTN FRC)      ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    emp2.utn@eurekapp.com       → EMPLOYEE (UTN FRC)      ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    emp1.aero@eurekapp.com      → EMPLOYEE (Aeropuerto)   ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    owner.patio@eurekapp.com   → OWNER  (Patio Olmos)    ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    emp1.patio@eurekapp.com    → EMPLOYEE (Patio Olmos)  ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    owner.unc@eurekapp.com     → OWNER  (UNC)            ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    emp1.unc@eurekapp.com      → EMPLOYEE (UNC)          ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    owner.dino@eurekapp.com    → OWNER  (Dinosaurio Mall)${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    emp1.dino@eurekapp.com     → EMPLOYEE (Dinosaurio)   ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    julia@mail.com              → USER  (XP: 30)          ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    pedro@mail.com              → USER  (XP: 20)          ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    valeria@mail.com            → USER  (XP: 0)           ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
