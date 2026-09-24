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

# El seed NO lee .env.local. Antes lo hacia para ver si habia credenciales de AWS y, en ese caso,
# subir las fotos a la cuenta real. Se saco a proposito: este script lo corre cada integrante del
# equipo en su maquina, y el juego de datos tiene que quedar igual en todas, sin depender de que
# alguien tenga credenciales ni de que se le suban archivos a una cuenta compartida sin querer.
# Las fotos van siempre al almacenamiento local (MinIO, ver docker-compose.yml).

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
# EU-410: el juego de datos es UNO SOLO y vive en seed-data/snapshot/. Hasta este ticket convivian
# dos: el de snapshot/ (el del rework de busqueda, el bueno) y otro suelto en seed-data/, con
# categorias que ya no existen. Como la busqueda descarta todo lo que no sea de la categoria
# buscada, con el juego suelto NINGUNA busqueda devolvia nada, y sin ningun aviso de que algo
# estuviera mal. Los archivos viejos siguen en seed-data/ pero ya no los usa nadie.
SEED_DATA_DIR="$(dirname "$0")/seed-data"
FOUND_NDJSON="$SEED_DATA_DIR/snapshot/FoundObject.ndjson"
LOST_NDJSON="$SEED_DATA_DIR/snapshot/LostObject.ndjson"

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
-- (rework fraude/reclamos) Reclamo deshabilitado en el seed:
-- 'reclamo_history' ya no existe (EU-278) y 'reclamos' se extirpa (EU-292).
-- TRUNCATE TABLE reclamo_history;
-- TRUNCATE TABLE reclamos;
TRUNCATE TABLE search_feedback;
TRUNCATE TABLE usability_feedback;
-- EU-371: la calificacion de la atencion cuelga de una devolucion. Va ANTES que
-- return_found_objects: si sobrevive al reset, queda apuntando a devoluciones que ya no existen.
TRUNCATE TABLE organization_feedback;
-- EU-393: las alertas de fraude se limpian junto con los usuarios a los que apuntan. Si
-- sobreviven al reset quedan sospechosos y bloqueos colgando de usuarios que ya no existen,
-- y como el TRUNCATE de 'users' reinicia el contador, esos ids se reasignan a otras personas.
-- Van antes que 'users': los hijos primero (sospechosos, casos y bloqueos), después la alerta.
TRUNCATE TABLE fraud_alert_suspect_user;
TRUNCATE TABLE fraud_alert_case;
TRUNCATE TABLE fraud_block;
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

# EU-323/EU-325: dos VECTORES NOMBRADOS por objeto ("image" = CLIP de la foto, "text" = OpenAI del
# título/descripción), ambos con vectorizer "none" (los provee el seed/backend) y distancia coseno.
# Debe coincidir con el esquema de start-local.sh. FoundObject ya NO tiene ai_description (deprecada);
# LostObject suma category (filtro duro, definido por IA desde la foto).
curl -sf -X POST "$WEAVIATE_URL/v1/schema" \
  -H "Content-Type: application/json" \
  -d '{
    "class": "FoundObject",
    "description": "Clase para representar objetos encontrados.",
    "vectorConfig": {
      "image": { "vectorizer": { "none": {} }, "vectorIndexType": "hnsw", "vectorIndexConfig": { "distance": "cosine" } },
      "text":  { "vectorizer": { "none": {} }, "vectorIndexType": "hnsw", "vectorIndexConfig": { "distance": "cosine" } }
    },
    "properties": [
      {"name": "found_date",            "dataType": ["date"]},
      {"name": "title",                 "dataType": ["string"]},
      {"name": "human_description",     "dataType": ["string"]},
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
    "vectorConfig": {
      "image": { "vectorizer": { "none": {} }, "vectorIndexType": "hnsw", "vectorIndexConfig": { "distance": "cosine" } },
      "text":  { "vectorizer": { "none": {} }, "vectorIndexType": "hnsw", "vectorIndexConfig": { "distance": "cosine" } }
    },
    "properties": [
      {"name": "lost_date",       "dataType": ["date"]},
      {"name": "description",     "dataType": ["string"]},
      {"name": "username",        "dataType": ["string"]},
      {"name": "organization_id", "dataType": ["text"]},
      {"name": "coordinates",     "dataType": ["geoCoordinates"]},
      {"name": "status",          "dataType": ["text"]},
      {"name": "closed_date",     "dataType": ["date"]},
      {"name": "recovered",       "dataType": ["boolean"]},
      {"name": "category",        "dataType": ["text"]},
      {"name": "has_image",       "dataType": ["boolean"]},
      {"name": "matched_object_uuid", "dataType": ["text"]}
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
# EU-378: el username ES la direccion a la que se le manda el correo. La cuenta
# ADMIN usa una casilla real porque recibe avisos que alguien tiene que leer
# (alertas de fraude, solicitudes de alta de organizacion); antes tenia
# admin@eurekapp.com, un dominio sin registros MX, y esos correos no llegaban a
# ninguna parte. Las demas cuentas son de prueba y no esperan recibir nada.
header "Insertando Usuarios"

HASH_ESCAPED="${BCRYPT_HASH//\'/\'\'}"

$MYSQL_EXEC 2>/dev/null <<SQL
INSERT INTO users (id, username, password, active, first_name, last_name, role, organization_id, XP, returned_objects) VALUES
(1,  'soporte.eurekapp@gmail.com',  '$HASH_ESCAPED', 1, 'Admin',    'EurekApp',  'ADMIN',                  NULL, 0,   0),
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
(16, 'emp1.dino@eurekapp.com',      '$HASH_ESCAPED', 1, 'Natalia',   'Gutiérrez', 'ORGANIZATION_EMPLOYEE',  6,    0,    0),
-- EU-410: usuario final con cuenta que queda bloqueado por fraude. No tiene busquedas guardadas
-- a proposito: bloquear a Julia, Pedro o Valeria dejaria sin poder abrirse las busquedas que son
-- de ellos. Es la persona que retira con el documento 39456789.
(17, 'micaela@mail.com',            '$HASH_ESCAPED', 1, 'Micaela',   'Ledesma',   'USER',                   NULL, 0,    0);
SQL
success "17 usuarios insertados"

# ─── 10. Insertar FoundObjects en Weaviate (desde NDJSON con embeddings reales) ─
header "Insertando FoundObjects en Weaviate"

# Cada linea del NDJSON ya es un objeto completo (class, id, properties, vector)
# listo para POST a /v1/objects. Los vectores son embeddings reales de OpenAI.
# Cada objeto se manda desde un archivo temporal y no como argumento de curl: una linea trae
# dos vectores completos y pesa decenas de miles de caracteres, y pasada como argumento la
# rechaza el sistema operativo por larga. Cuando eso pasaba, el objeto no entraba y el unico
# rastro era un contador mas bajo al final.
FO_INSERTED=0
POST_TMP=$(mktemp)
while IFS= read -r line; do
  [[ -z "${line// }" ]] && continue
  printf '%s' "$line" > "$POST_TMP"
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$WEAVIATE_URL/v1/objects" \
    -H "Content-Type: application/json" \
    --data-binary "@$POST_TMP")
  if [[ "$HTTP" == "200" ]]; then
    FO_INSERTED=$((FO_INSERTED + 1))
  else
    warn "  FoundObject → HTTP $HTTP"
  fi
done < "$FOUND_NDJSON"
success "  $FO_INSERTED FoundObjects insertados"

# UUID reales de cada FoundObject. Como insertamos directo en Weaviate con un "id" que elegimos
# nosotros, estos UUID son fijos y conocidos: son los mismos que figuran en el campo "id" del
# snapshot, y son tambien el nombre de la foto del objeto en S3. Las secciones de MySQL
# (devoluciones, exclusiones, opiniones) los referencian directamente, sin depender de titulos.
#
# Los DIEZ PRIMEROS son los del rework de busqueda y se quedan como estan. Los cinco que forman
# pareja con una busqueda guardada (paraguas, notebook, billetera de cuero, auriculares y mochila)
# NO se devuelven nunca: si se marcaran devueltos desaparecerian de la busqueda y el juego dejaria
# de servir para probarla.
FO_PARAGUAS="dcfc219a-8142-4a2f-9344-d2521889689d"     # Paraguas negro plegable        (org 1) PAR
FO_NOTEBOOK="2121ffa9-8773-4c23-a5ef-f3d393def659"     # Notebook Dell gris             (org 2) PAR
FO_BILLETERA="96c3a201-7251-45c2-b442-2102a98fb474"    # Billetera de cuero marron      (org 1) PAR
FO_AURICULARES="05e3b579-30c2-47fc-8bd4-e90dab97c498"  # Auriculares inalambricos       (org 2) PAR
FO_MOCHILA="b0a4573c-2db6-4858-9ac9-bb314769e445"      # Mochila azul con libros        (org 1) PAR
FO_LLAVE="5fe28eaf-8994-44aa-bf2f-15f2e3691cae"        # Llave con llavero azul         (org 1)
FO_CELULAR="77965d32-7ba3-4497-8471-3d94f7acd5cd"      # Celular Samsung negro          (org 3)
FO_BILLETERA_DNI="d5937d67-e758-4e53-9ae4-844803027bdb" # Billetera marron con DNI      (org 2)
FO_CARGADOR="0412e370-c1a5-442d-b740-4fd9cfda59be"     # Cargador USB-C blanco          (org 3)
FO_ANTEOJOS="2c817a63-1027-48c3-bb95-c24d73022f33"     # Anteojos de sol negros         (org 1)

# EU-410: objetos encontrados agregados para que cada devolucion tenga el suyo. Reusan la foto de
# alguno de los diez de arriba (cada uno con su propia copia, porque el nombre del archivo en S3 es
# el uuid del objeto) pero con fecha, sede y texto propios. Los dos ultimos quedan SIN devolver.
FO_N01="c1000001-0000-4000-8000-000000000001"  # Auriculares over-ear blancos       (Terminal)
FO_N02="c1000002-0000-4000-8000-000000000002"  # Anteojos de sol con montura negra  (Patio Olmos)
FO_N03="c1000003-0000-4000-8000-000000000003"  # Cargador USB-C blanco              (UNC)
FO_N04="c1000004-0000-4000-8000-000000000004"  # Paraguas negro plegable            (UTN)
FO_N05="c1000005-0000-4000-8000-000000000005"  # Mochila azul mediana               (Dinosaurio)
FO_N06="c1000006-0000-4000-8000-000000000006"  # Notebook gris de 15 pulgadas       (UTN)
FO_N07="c1000007-0000-4000-8000-000000000007"  # Billetera marron con documentos    (Patio Olmos)
FO_N08="c1000008-0000-4000-8000-000000000008"  # Celular Samsung negro              (Patio Olmos)
FO_N09="c1000009-0000-4000-8000-000000000009"  # Notebook Dell gris                 (Patio Olmos)
FO_N10="c1000010-0000-4000-8000-000000000010"  # Anteojos de sol negros             (UNC)
FO_N11="c1000011-0000-4000-8000-000000000011"  # Celular negro con funda gris       (Dinosaurio)
FO_N12="c1000012-0000-4000-8000-000000000012"  # Cargador de celular blanco         (Dinosaurio)
FO_N13="c1000013-0000-4000-8000-000000000013"  # Billetera de cuero con documentos  (Dinosaurio)
FO_N14="c1000014-0000-4000-8000-000000000014"  # Mochila azul con apuntes           (Patio Olmos)
FO_N15="c1000015-0000-4000-8000-000000000015"  # Llave con llavero de goma azul     (UTN)
FO_N16="c1000016-0000-4000-8000-000000000016"  # Auriculares inalambricos blancos   (Patio Olmos)
FO_N17="c1000017-0000-4000-8000-000000000017"  # Paraguas negro compacto            (Terminal)
FO_N18="c1000018-0000-4000-8000-000000000018"  # Billetera de cuero marron          (Patio Olmos)
FO_N19="c1000019-0000-4000-8000-000000000019"  # Juego de llaves con llavero azul   (Patio Olmos)
FO_N20="c1000020-0000-4000-8000-000000000020"  # Llave con llavero azul de goma     (Dinosaurio)  SIN DEVOLVER
FO_N21="c1000021-0000-4000-8000-000000000021"  # Cargador USB-C blanco de 20W       (UNC)  SIN DEVOLVER

# ─── 11. Insertar LostObjects en Weaviate (desde NDJSON con embeddings reales) ──
header "Insertando LostObjects en Weaviate"

LO_INSERTED=0
while IFS= read -r line; do
  [[ -z "${line// }" ]] && continue
  printf '%s' "$line" > "$POST_TMP"
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$WEAVIATE_URL/v1/objects" \
    -H "Content-Type: application/json" \
    --data-binary "@$POST_TMP")
  if [[ "$HTTP" == "200" ]]; then
    LO_INSERTED=$((LO_INSERTED + 1))
  else
    warn "  LostObject → HTTP $HTTP"
  fi
done < "$LOST_NDJSON"
success "  $LO_INSERTED LostObjects insertados"
rm -f "$POST_TMP"

# Si alguno no entro, la busqueda queda incompleta sin ningun sintoma visible:
# conviene enterarse aca y no despues, buscando un objeto que nunca se cargo.
[[ "$FO_INSERTED" == "$FOUND_COUNT" ]] || error "Entraron $FO_INSERTED de $FOUND_COUNT objetos encontrados"
[[ "$LO_INSERTED" == "$LOST_COUNT" ]]  || error "Entraron $LO_INSERTED de $LOST_COUNT busquedas guardadas"

# ─── 12. Insertar Retornos ───────────────────────────────────────────────────
header "Insertando Retornos"

# EU-362: 'first_name' y 'last_name' son columnas NUEVAS, así que Hibernate las crea solo al
# levantar el backend con el código del ticket. Si el seed corre ANTES de ese arranque, el INSERT de
# más abajo falla por columna inexistente y —como el error va a /dev/null— el script igual diría
# "5 retornos insertados". Se agregan acá si faltan, para que el orden de los pasos no importe.
for COL in first_name last_name; do
  COL_EXISTS=$($MYSQL_EXEC 2>/dev/null <<SQL
SELECT COUNT(*) FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'eurekapp' AND TABLE_NAME = 'return_found_objects' AND COLUMN_NAME = '$COL';
SQL
)
  if echo "$COL_EXISTS" | grep -q "^1$"; then
    success "'$COL' ya existe en return_found_objects — OK"
  else
    warn "Falta '$COL' en return_found_objects. Aplicando ALTER TABLE..."
    $MYSQL_EXEC 2>/dev/null <<SQL
ALTER TABLE return_found_objects ADD COLUMN $COL VARCHAR(100) NULL;
SQL
    success "'$COL' agregada"
  fi
done

# EU-371: la devolucion asienta en que organizacion ocurrio; de ahi cuelga la calificacion de la
# atencion. Hibernate agrega la columna sola en una DB que ya existia, pero el seed inserta las
# devoluciones a mano y necesita que este.
ORG_COL_EXISTS=$($MYSQL_EXEC 2>/dev/null <<SQL
SELECT COUNT(*) FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'eurekapp' AND TABLE_NAME = 'return_found_objects' AND COLUMN_NAME = 'organization_id';
SQL
)
if echo "$ORG_COL_EXISTS" | grep -q "^1$"; then
  success "'organization_id' ya existe en return_found_objects — OK"
else
  warn "Falta 'organization_id' en return_found_objects. Aplicando ALTER TABLE..."
  $MYSQL_EXEC 2>/dev/null <<SQL
ALTER TABLE return_found_objects ADD COLUMN organization_id BIGINT NULL;
SQL
  success "'organization_id' agregada"
fi

# EU-410: el empleado que entrega el objeto es el prerrequisito de la regla de fraude por
# complicidad de un empleado. El seed lo escribe, asi que la columna tiene que estar aunque el
# backend todavia no haya arrancado nunca contra esta base.
EMP_COL_EXISTS=$($MYSQL_EXEC 2>/dev/null <<SQL
SELECT COUNT(*) FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'eurekapp' AND TABLE_NAME = 'return_found_objects' AND COLUMN_NAME = 'returned_by_employee_id';
SQL
)
if echo "$EMP_COL_EXISTS" | grep -q "^1$"; then
  success "'returned_by_employee_id' ya existe en return_found_objects — OK"
else
  warn "Falta 'returned_by_employee_id' en return_found_objects. Aplicando ALTER TABLE..."
  $MYSQL_EXEC 2>/dev/null <<SQL
ALTER TABLE return_found_objects ADD COLUMN returned_by_employee_id BIGINT NULL;
SQL
  success "'returned_by_employee_id' agregada"
fi

# EU-374: token opaco de la encuesta de atencion. El enlace del correo lo lleva en vez del id de la
# devolucion, que es secuencial y quedaria a la vista en la barra de direcciones.
TOKEN_COL_EXISTS=$($MYSQL_EXEC 2>/dev/null <<SQL
SELECT COUNT(*) FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'eurekapp' AND TABLE_NAME = 'return_found_objects' AND COLUMN_NAME = 'feedback_token';
SQL
)
if echo "$TOKEN_COL_EXISTS" | grep -q "^1$"; then
  success "'feedback_token' ya existe en return_found_objects — OK"
else
  warn "Falta 'feedback_token' en return_found_objects. Aplicando ALTER TABLE..."
  $MYSQL_EXEC 2>/dev/null <<SQL
ALTER TABLE return_found_objects ADD COLUMN feedback_token VARCHAR(36) NULL UNIQUE;
SQL
  success "'feedback_token' agregada"
fi

# EU-372: la calificacion de la pantalla de resultados dejo de atribuirse a la organizacion, asi que
# search_feedback ya no la guarda. Hibernate NO afloja un NOT NULL existente con ddl-auto=update.
$MYSQL_EXEC 2>/dev/null <<SQL
ALTER TABLE search_feedback MODIFY star_rating INT NULL;
SQL
success "search_feedback.star_rating admite nulos (EU-372)"

# EU-410: 24 devoluciones, cada una sobre un objeto DISTINTO y propio. Antes eran cinco y las cinco
# apuntaban a objetos que ya no existian: se habian escrito contra el juego de datos viejo y
# quedaron asi cuando el rework de busqueda rehizo los objetos.
#
# Como estan armadas: hay cinco focos de sospecha (cada uno, un mismo documento retirando varias
# veces en pocas semanas) y tres devoluciones normales y aisladas. Las alertas de fraude que se
# siembran mas abajo se apoyan en estas devoluciones, asi que los documentos, las fechas, las sedes
# y los empleados que entregan tienen que coincidir con las de alla.
#
#   42111222 Julia Morales   - abril              - retira 3 veces; termino siendo falsa alarma
#   27998877 Nahuel Ibarra   - mayo               - siempre lo atiende el mismo empleado de la UTN
#   28123456 Ramiro Otero    - junio y septiembre - reincidente, dos alertas separadas
#   39456789 Micaela Ledesma - julio a septiembre - siempre retira objetos registrados por la misma
#                                                   persona del shopping; tiene cuenta de usuario
#                                                   final, asi que queda bloqueada ella tambien
#   31555444 Brenda Sosa     - agosto             - siempre la atiende la misma empleada del shopping
#   33145892 / 26874159 / 29334857 - devoluciones normales, una sola vez cada una
#
# Quienes quedan senalados son personal de las organizaciones y una cuarta cuenta de usuario final
# creada para eso (micaela@mail.com), que no tiene busquedas guardadas. Julia, Pedro y Valeria
# quedan siempre afuera: una alerta vigente bloquea la cuenta, y las cinco busquedas guardadas son
# de ellos tres, asi que bloquear a cualquiera dejaria sus busquedas sin poder abrirse.
$MYSQL_EXEC 2>/dev/null <<SQL
INSERT INTO return_found_objects
  (found_objectuuid, user_id, organization_id, returned_by_employee_id, feedback_token, first_name, last_name, DNI, phone_number, person_photo_UUID, datetime_of_return, notification_sent_at, notification_recipient)
VALUES
('$FO_N01', 7, 2, 3, 'b0000001-0000-4000-8000-000000000001', 'Julia', 'Morales', '42111222', '3514000101', 'person-photo-001', '2026-04-16 10:20:00', '2026-04-16 10:25:00', NULL),
('$FO_N02', 7, 4, 12, 'b0000002-0000-4000-8000-000000000002', 'Julia', 'Morales', '42111222', '3514000101', 'person-photo-002', '2026-04-23 10:00:00', '2026-04-23 10:05:00', NULL),
('$FO_N03', 7, 5, 14, 'b0000003-0000-4000-8000-000000000003', 'Julia', 'Morales', '42111222', '3514000101', 'person-photo-003', '2026-04-29 11:30:00', '2026-04-29 11:35:00', NULL),
('$FO_LLAVE', NULL, 1, 6, 'b0000004-0000-4000-8000-000000000004', 'Nahuel', 'Ibarra', '27998877', '3514000102', 'person-photo-004', '2026-05-06 09:15:00', NULL, NULL),
('$FO_ANTEOJOS', NULL, 1, 6, 'b0000005-0000-4000-8000-000000000005', 'Nahuel', 'Ibarra', '27998877', '3514000102', 'person-photo-005', '2026-05-24 16:40:00', '2026-05-24 16:45:00', 'encargado.utn@eurekapp.com'),
('$FO_N04', NULL, 1, 6, 'b0000006-0000-4000-8000-000000000006', 'Nahuel', 'Ibarra', '27998877', '3514000102', 'person-photo-006', '2026-05-30 12:00:00', NULL, NULL),
('$FO_N05', NULL, 6, 16, 'b0000007-0000-4000-8000-000000000007', 'Ramiro', 'Otero', '28123456', '3514000103', 'person-photo-007', '2026-06-02 18:10:00', NULL, NULL),
('$FO_BILLETERA_DNI', NULL, 2, 3, 'b0000008-0000-4000-8000-000000000008', 'Laura', 'Fernandez', '33145892', '3514000106', 'person-photo-008', '2026-06-05 13:00:00', '2026-06-05 13:04:00', 'julia@mail.com'),
('$FO_CELULAR', NULL, 3, 10, 'b0000009-0000-4000-8000-000000000009', 'Ramiro', 'Otero', '28123456', '3514000103', 'person-photo-009', '2026-06-10 17:25:00', '2026-06-10 17:30:00', 'pedro@mail.com'),
('$FO_CARGADOR', NULL, 3, 10, 'b0000010-0000-4000-8000-000000000010', 'Ramiro', 'Otero', '28123456', '3514000103', 'person-photo-010', '2026-06-18 11:05:00', '2026-06-18 11:10:00', 'julia@mail.com'),
('$FO_N06', NULL, 1, 4, 'b0000011-0000-4000-8000-000000000011', 'Hector', 'Quiroga', '26874159', '3514000107', 'person-photo-011', '2026-06-27 09:40:00', NULL, NULL),
('$FO_N07', 17, 4, 11, 'b0000012-0000-4000-8000-000000000012', 'Micaela', 'Ledesma', '39456789', '3514000104', 'person-photo-012', '2026-07-05 08:50:00', '2026-07-05 08:55:00', 'emp1.patio@eurekapp.com'),
('$FO_N08', 17, 4, 12, 'b0000013-0000-4000-8000-000000000013', 'Micaela', 'Ledesma', '39456789', '3514000104', 'person-photo-013', '2026-07-14 19:30:00', '2026-07-14 19:35:00', 'emp1.patio@eurekapp.com'),
('$FO_N09', 17, 4, 11, 'b0000014-0000-4000-8000-000000000014', 'Micaela', 'Ledesma', '39456789', '3514000104', 'person-photo-014', '2026-07-25 15:10:00', '2026-07-25 15:15:00', 'emp1.patio@eurekapp.com'),
('$FO_N10', NULL, 5, 13, 'b0000015-0000-4000-8000-000000000015', 'Gaston', 'Peralta', '29334857', '3514000108', 'person-photo-015', '2026-08-07 10:00:00', NULL, NULL),
('$FO_N11', NULL, 6, 16, 'b0000016-0000-4000-8000-000000000016', 'Brenda', 'Sosa', '31555444', '3514000105', 'person-photo-016', '2026-08-10 12:20:00', NULL, NULL),
('$FO_N12', NULL, 6, 16, 'b0000017-0000-4000-8000-000000000017', 'Brenda', 'Sosa', '31555444', '3514000105', 'person-photo-017', '2026-08-18 14:45:00', NULL, NULL),
('$FO_N13', NULL, 6, 16, 'b0000018-0000-4000-8000-000000000018', 'Brenda', 'Sosa', '31555444', '3514000105', 'person-photo-018', '2026-08-25 09:30:00', NULL, NULL),
('$FO_N14', 17, 4, 11, 'b0000019-0000-4000-8000-000000000019', 'Micaela', 'Ledesma', '39456789', '3514000104', 'person-photo-019', '2026-08-28 10:15:00', '2026-08-28 10:20:00', 'emp1.patio@eurekapp.com'),
('$FO_N15', NULL, 1, 5, 'b0000020-0000-4000-8000-000000000020', 'Ramiro', 'Otero', '28123456', '3514000103', 'person-photo-020', '2026-09-02 18:00:00', NULL, NULL),
('$FO_N16', 17, 4, 12, 'b0000021-0000-4000-8000-000000000021', 'Micaela', 'Ledesma', '39456789', '3514000104', 'person-photo-021', '2026-09-03 17:20:00', '2026-09-03 17:25:00', 'emp1.patio@eurekapp.com'),
('$FO_N17', NULL, 2, 3, 'b0000022-0000-4000-8000-000000000022', 'Ramiro', 'Otero', '28123456', '3514000103', 'person-photo-022', '2026-09-09 14:00:00', NULL, NULL),
('$FO_N18', 17, 4, 11, 'b0000023-0000-4000-8000-000000000023', 'Micaela', 'Ledesma', '39456789', '3514000104', 'person-photo-023', '2026-09-10 08:40:00', '2026-09-10 08:45:00', 'emp1.patio@eurekapp.com'),
('$FO_N19', NULL, 4, 11, 'b0000024-0000-4000-8000-000000000024', 'Ramiro', 'Otero', '28123456', '3514000103', 'person-photo-024', '2026-09-15 12:30:00', NULL, NULL);
SQL
# Los tokens son fijos en el seed para que el enlace de prueba sea estable entre resembrados.
success "24 devoluciones insertadas, cada una sobre su propio objeto, con su token de encuesta"

header "Comprobando que cada devolucion tenga su objeto"

# Quien encontro cada objeto y cuales ya se devolvieron vienen escritos en el juego de datos, no se
# aplican aca. Antes se parcheaban despues de cargar, y eso dejaba dos lados que podian
# desincronizarse: fue asi como las devoluciones terminaron colgando de objetos inexistentes.
# Lo unico que queda es comprobar que los dos lados dicen lo mismo, y avisar fuerte si no.
FALTANTES=0
while read -r UUID; do
  [[ -z "$UUID" ]] && continue
  MARCADO=$(curl -s "$WEAVIATE_URL/v1/objects/FoundObject/$UUID" | grep -o '"was_returned":[a-z]*' | cut -d: -f2)
  if [[ "$MARCADO" != "true" ]]; then
    warn "  La devolucion de $UUID no encuentra su objeto (was_returned=${MARCADO:-no existe})"
    FALTANTES=$((FALTANTES + 1))
  fi
done < <($MYSQL_EXEC -N 2>/dev/null <<'SQL'
SELECT found_objectuuid FROM return_found_objects;
SQL
)
[[ "$FALTANTES" == "0" ]] \
  && success "Las 24 devoluciones apuntan a un objeto que existe y figura como devuelto" \
  || error "$FALTANTES devoluciones apuntan a un objeto que no existe o no figura como devuelto"

# ─── 13. Insertar exclusiones de recompensa ──────────────────────────────────
header "Insertando exclusiones de recompensa"

$MYSQL_EXEC 2>/dev/null <<SQL
INSERT INTO reward_exclusions
  (found_objectuuid, user_id, user_role, reason, excluded_at, organization_id)
VALUES
('$FO_MOCHILA',  6, 'ORGANIZATION_EMPLOYEE', 'INCOMPATIBLE_ROLE', '2026-05-07 10:00:00', '1'),
('$FO_PARAGUAS', 5, 'ORGANIZATION_EMPLOYEE', 'INCOMPATIBLE_ROLE', '2026-04-15 10:00:00', '1'),
('$FO_ANTEOJOS', 4, 'ENCARGADO',             'INCOMPATIBLE_ROLE', '2026-05-20 10:00:00', '1');
SQL
success "3 exclusiones de recompensa registradas (personal de la organizacion)"

# ─── 14. Insertar SearchFeedback ─────────────────────────────────────────────
header "Insertando SearchFeedback"

$MYSQL_EXEC 2>/dev/null <<SQL
INSERT INTO search_feedback (organization_id, found_object_uuid, was_found, created_at, user_id) VALUES
('1', '$FO_BILLETERA',   1, '2026-04-29 11:00:00', 7),
('1', NULL,              0, '2026-05-03 09:30:00', 8),
('2', '$FO_AURICULARES', 1, '2026-05-06 15:00:00', 8),
('1', NULL,              0, '2026-05-07 10:00:00', 9),
('1', '$FO_MOCHILA',     1, '2026-05-08 14:00:00', 9),
('3', NULL,              0, '2026-05-10 08:00:00', 7),
('1', '$FO_PARAGUAS',    1, '2026-05-11 16:00:00', 7),
('2', NULL,              0, '2026-05-12 12:00:00', 9),
('2', '$FO_NOTEBOOK',    1, '2026-05-13 10:00:00', 7),
('1', NULL,              0, '2026-05-15 09:00:00', 8);
SQL
success "10 registros de search_feedback insertados"

# ─── 14.b Insertar OrganizationFeedback ──────────────────────────────────────
# EU-375: la calificacion de la ATENCION, que la persona deja despues de retirar su objeto. Cuelga
# de la devolucion, y por ella de la organizacion. Se toman las devoluciones con usuario asociado:
# la encuesta llega por correo, y sin cuenta no hay correo.
header "Insertando OrganizationFeedback"

$MYSQL_EXEC 2>/dev/null <<SQL
INSERT INTO organization_feedback
  (return_found_object_id, organization_id, user_id, staff_treatment, waiting_time,
   instructions_clarity, object_condition, pickup_security, comment, created_at)
SELECT r.id, r.organization_id, r.user_id, v.trato, v.espera, v.claridad, v.estado, v.seguridad,
       v.comentario, v.creado
FROM return_found_objects r
JOIN (
  SELECT '$FO_N01'  AS uuid, 5 AS trato, 4 AS espera, 5 AS claridad, 5 AS estado, 4 AS seguridad,
         'Me atendieron muy bien, todo rapidisimo' AS comentario, '2026-04-17 09:00:00' AS creado
  UNION ALL SELECT '$FO_N02', 3, 2, 4, 5, 4, 'Espere casi media hora para que me lo entreguen', '2026-04-24 10:00:00'
  
) v ON v.uuid = r.found_objectuuid
WHERE r.user_id IS NOT NULL AND r.organization_id IS NOT NULL;
SQL
# Las demas devoluciones con usuario asociado quedan SIN calificar a proposito: son las que
# permiten probar a mano la encuesta de atencion de punta a punta.
success "2 calificaciones de atencion insertadas (Terminal y Patio Olmos) + 1 devolucion sin calificar"

# ─── 15. Insertar UsabilityFeedback ──────────────────────────────────────────
header "Insertando UsabilityFeedback"

# EU-367: la opinion sobre la aplicacion se le pide al USUARIO FINAL y la lee el administrador de
# EurekApp, consolidada. Las respuestas viejas eran de empleados opinando al cargar objetos
# ('upload_object'), un momento que ya no existe; se descartan y se siembran respuestas de usuarios
# finales (7 Julia, 8 Pedro, 9 Valeria), que antes quedaban invisibles por no tener organizacion.
$MYSQL_EXEC 2>/dev/null <<'SQL'
INSERT INTO usability_feedback (star_rating, aspects, comment, context, created_at, user_id) VALUES
(5, 'FACILIDAD_USO,NAVEGACION', 'Muy facil de usar',                  'close_search', '2026-04-20 10:00:00', 7),
(4, 'CLARIDAD',                  NULL,                                'profile',      '2026-04-25 11:00:00', 8),
(2, 'NAVEGACION',               'Me confundi con los menus',          'close_search', '2026-05-01 09:00:00', 9),
(5, 'FACILIDAD_USO,CLARIDAD',   'Excelente experiencia',              'close_search', '2026-05-05 14:00:00', 7),
(3, 'NAVEGACION,FACILIDAD_USO', 'Regular, algunos botones confusos',  'profile',      '2026-05-10 16:00:00', 8),
(4, 'CLARIDAD',                  NULL,                                'close_search', '2026-05-14 08:00:00', 9),
(1, 'NAVEGACION',               'No entendi como cerrar mi busqueda', 'close_search', '2026-05-18 10:00:00', 8);
SQL
success "7 registros de usability_feedback insertados"

# ─── 16. Insertar FraudAlerts ────────────────────────────────────────────────
header "Insertando FraudAlerts"

# EU-410: las pantallas de fraude arrancaban vacias. El seed no plantaba ninguna alerta desde que
# se rediseño el modelo, asi que para mirarlas habia que fabricar los casos a mano cada vez.
#
# Las alertas se escriben acá, pero NO salen de la nada: cada una se apoya en las devoluciones que
# se sembraron mas arriba. El documento, las fechas, la sede y el empleado que entrega coinciden
# con los de esas devoluciones, y la cantidad que informa cada caso es la cantidad de devoluciones
# que efectivamente hay detras. El seed viejo insertaba alertas sueltas, apuntando a personas y
# objetos que no existian, y por eso quedaban incoherentes.
#
# Lo que queda para mirar en las pantallas:
#   - 4 alertas vigentes y 3 falsas alarmas ya resueltas;
#   - dos documentos con dos alertas cada uno, y dos personas registradas tambien con dos;
#   - un usuario final bloqueado, para ver el bloqueo desde ese lado y no solo desde una cuenta
#     de organizacion;
#   - alertas repartidas de abril a septiembre, una por mes (dos en septiembre);
#   - 9 bloqueos, todos vigentes. No hay ninguno vencido a proposito: los bloqueos se levantan
#     al resolver la alerta como falsa alarma, asi que las tres falsas alarmas no tienen, y las
#     cuatro vigentes nacieron dentro de los 90 dias de bloqueo.
#
# Primero, los parametros de deteccion. Por defecto son "5 retiros en 1 dia" y bloqueo de 7 dias,
# que sirven para un ambiente real pero no para mirar una pantalla: con esa ventana ninguno de los
# focos sembrados seria detectable. Se deja "3 retiros en 30 dias" y bloqueo de 90 dias, que es lo
# que describen las alertas de abajo. El bloqueo largo tambien evita que los bloqueos vigentes se
# venzan a los pocos dias de sembrar, porque las fechas del juego de datos son fijas.
$MYSQL_EXEC 2>/dev/null <<SQL
INSERT INTO fraud_detection_config (id, fraud_threshold, fraud_window_days, block_duration_days)
VALUES (1, 3, 30, 90)
ON DUPLICATE KEY UPDATE fraud_threshold=3, fraud_window_days=30, block_duration_days=90;
SQL
success "Parametros de deteccion: 3 retiros en 30 dias, bloqueo de 90 dias"

# 'reason' guarda los casos crudos separados por coma; la aplicacion los traduce a lenguaje llano al
# mostrarlos. 'details' respeta el formato exacto que arma la deteccion.
# Los ids son fijos para que las tablas hijas (casos, sospechosos y bloqueos) los puedan referenciar.
$MYSQL_EXEC 2>/dev/null <<SQL
INSERT INTO fraud_alert
  (id, organization_id, found_object_uuid, dni, returned_by_employee_id, reason, details, status, created_at, resolved_at, resolved_by_id, dedup_key)
VALUES
(1, NULL, NULL, '42111222', NULL, 'CASE_1',
 'DNI 42111222 — Caso 1: 3 devoluciones del mismo DNI.',
 'FALSE_POSITIVE', '2026-04-29 11:40:00', '2026-05-02 16:00:00', 1, 'dni:42111222'),
(2, NULL, NULL, '27998877', 6, 'CASE_1,CASE_3',
 'DNI 27998877 — Caso 1: 3 devoluciones del mismo DNI; Caso 3: 3 devoluciones del par empleado+DNI (emp2.utn@eurekapp.com).',
 'FALSE_POSITIVE', '2026-05-30 12:05:00', '2026-06-02 10:00:00', 1, 'dni:27998877'),
(3, NULL, NULL, '28123456', NULL, 'CASE_1',
 'DNI 28123456 — Caso 1: 3 devoluciones del mismo DNI.',
 'FALSE_POSITIVE', '2026-06-18 11:10:00', '2026-06-21 09:00:00', 1, 'dni:28123456'),
(4, NULL, NULL, '39456789', NULL, 'CASE_1,CASE_2',
 'DNI 39456789 — Caso 1: 3 devoluciones del mismo DNI; Caso 2: 3 devoluciones del par finder+DNI.',
 'ACTIVE', '2026-07-25 15:16:00', NULL, NULL, 'dni:39456789'),
(5, NULL, NULL, '31555444', 10, 'CASE_1,CASE_3',
 'DNI 31555444 — Caso 1: 3 devoluciones del mismo DNI; Caso 3: 3 devoluciones del par empleado+DNI (emp1.dino@eurekapp.com).',
 'ACTIVE', '2026-08-25 09:35:00', NULL, NULL, 'dni:31555444'),
(6, NULL, NULL, '39456789', NULL, 'CASE_1,CASE_2',
 'DNI 39456789 — Caso 1: 3 devoluciones del mismo DNI; Caso 2: 3 devoluciones del par finder+DNI.',
 'ACTIVE', '2026-09-10 08:46:00', NULL, NULL, 'dni:39456789'),
(7, NULL, NULL, '28123456', NULL, 'CASE_1',
 'DNI 28123456 — Caso 1: 3 devoluciones del mismo DNI.',
 'ACTIVE', '2026-09-15 12:35:00', NULL, NULL, 'dni:28123456');
SQL
success "7 alertas de fraude insertadas (4 vigentes, 3 falsas alarmas), de abril a septiembre"

# Casos que disparo cada alerta, con la cantidad de devoluciones detectada. Es el dato que la
# pantalla muestra como "cantidad detectada".
$MYSQL_EXEC 2>/dev/null <<SQL
INSERT INTO fraud_alert_case (fraud_alert_id, case_type, matched_count) VALUES
(1, 'CASE_1', 3),
(2, 'CASE_1', 3), (2, 'CASE_3', 3),
(3, 'CASE_1', 3),
(4, 'CASE_1', 3), (4, 'CASE_2', 3),
(5, 'CASE_1', 3), (5, 'CASE_3', 3),
(6, 'CASE_1', 3), (6, 'CASE_2', 3),
(7, 'CASE_1', 3);
SQL
success "11 casos detectados distribuidos entre las 7 alertas"

# Personas senaladas por cada alerta. Solo aparecen cuando la regla involucra a alguien con cuenta:
# quien registro el objeto, quien lo retiro si tiene cuenta, y el empleado que lo entrego. Las
# alertas de retiros repetidos a secas no senalan a nadie registrado, porque quien retira puede no
# tener cuenta: ahi el foco es el documento.
$MYSQL_EXEC 2>/dev/null <<SQL
INSERT INTO fraud_alert_suspect_user (fraud_alert_id, user_id) VALUES
(2, 6),    -- Tomas Ramirez, el empleado de la UTN que atendio las tres veces
(4, 12),   -- Ignacio Molina, que habia registrado los tres objetos retirados
(4, 17),   -- Micaela Ledesma, la usuaria que retiro las tres veces
(5, 16),   -- Natalia Gutierrez, la empleada del shopping que atendio las tres veces
(6, 12),   -- Ignacio Molina otra vez, dos meses despues
(6, 17);   -- Micaela Ledesma otra vez, dos meses despues
SQL
success "6 personas senaladas (Ignacio Molina y Micaela Ledesma figuran en dos alertas cada uno)"

# Bloqueos. Al nacer, una alerta bloquea al documento y a cada persona que senala, por 90 dias;
# marcar la alerta como falsa alarma levanta esos bloqueos, y por eso las tres falsas alarmas no
# tienen ninguno. Las cuatro alertas vigentes si los tienen.
$MYSQL_EXEC 2>/dev/null <<SQL
INSERT INTO fraud_block (target_dni, target_user_id, fraud_alert_id, blocked_at, expires_at) VALUES
('39456789', NULL, 4, '2026-07-25 15:16:00', '2026-10-23 15:16:00'),
(NULL,       12,   4, '2026-07-25 15:16:00', '2026-10-23 15:16:00'),
(NULL,       17,   4, '2026-07-25 15:16:00', '2026-10-23 15:16:00'),
('31555444', NULL, 5, '2026-08-25 09:35:00', '2026-11-23 09:35:00'),
(NULL,       16,   5, '2026-08-25 09:35:00', '2026-11-23 09:35:00'),
('39456789', NULL, 6, '2026-09-10 08:46:00', '2026-12-09 08:46:00'),
(NULL,       12,   6, '2026-09-10 08:46:00', '2026-12-09 08:46:00'),
(NULL,       17,   6, '2026-09-10 08:46:00', '2026-12-09 08:46:00'),
('28123456', NULL, 7, '2026-09-15 12:35:00', '2026-12-14 12:35:00');
SQL
success "9 bloqueos vigentes sobre 3 documentos, 2 personas de las organizaciones y 1 usuario final"

# ─── 17. Insertar Reclamos ───────────────────────────────────────────────────
header "Insertando Reclamos"

# DESHABILITADO (rework fraude/reclamos): la columna 'reclamos.status' se eliminó (EU-278)
# y la entidad 'Reclamo' se extirpa por completo (EU-292). En una DB fresca este INSERT
# rompía contra el esquema nuevo. No reactivar: el reclamo dejó de ser una entidad propia.
#
# $MYSQL_EXEC 2>/dev/null <<SQL
# INSERT INTO reclamos (organization_id, found_object_uuid, found_object_category, user_id, comment, claim_description, star_rating, status, created_at, updated_at, search_feedback_id) VALUES
# ('1', '$FO_UUID_1', 'Billeteras',  7, 'Creo que es mi billetera',    'Billetera negra, tenia mi DNI y tarjeta VISA',    4, 'EN_REVISION', '2026-04-30 10:00:00', '2026-05-02 14:00:00', 1),
# ('1', '$FO_UUID_4', 'Mochilas',    9, 'Es mi mochila de ingenieria', 'Mochila azul con libros de calculo y fisica',     3, 'EN_REVISION', '2026-05-08 15:00:00', '2026-05-09 09:00:00', 5),
# ('2', '$FO_UUID_3', 'Electronica', 8, 'Son mis auriculares',         'Auriculares Sony blancos, tenian funda negra',    5, 'EN_REVISION', '2026-05-06 16:00:00', '2026-05-07 11:00:00', 3),
# ('1', '$FO_UUID_2', 'Llaves',      7, 'Parecen mis llaves',          'Llave de casa con llavero azul de plastico',      2, 'RECHAZADO',   '2026-05-03 09:00:00', '2026-05-04 08:00:00', 7),
# ('3', '$FO_UUID_5', 'Celulares',   9, 'Es mi celular Samsung',       'Samsung Galaxy A54 negro, pantalla rota',         1, 'PENDIENTE',   '2026-05-10 12:00:00', NULL,                  NULL);
# SQL
warn "Reclamos: seed deshabilitado (status eliminado en EU-278; entidad extirpada en EU-292)."

# ─── 18. Insertar ReclamoHistory ─────────────────────────────────────────────
header "Insertando ReclamoHistory"

# DESHABILITADO (rework fraude/reclamos): la entidad 'ReclamoHistory' y su tabla
# 'reclamo_history' se eliminaron (EU-278); en una DB fresca no existe y el INSERT rompía.
#
# $MYSQL_EXEC 2>/dev/null <<'SQL'
# INSERT INTO reclamo_history (reclamo_id, previous_status, new_status, changed_by_id, changed_at, note) VALUES
# (1, 'PENDIENTE',    'EN_REVISION', 2, '2026-05-01 09:00:00', 'Iniciando revision del caso');
# SQL
warn "ReclamoHistory: seed deshabilitado (tabla eliminada en EU-278)."

# ─── 19. Insertar OrganizationRequests ──────────────────────────────────────
header "Insertando OrganizationRequests"

$MYSQL_EXEC 2>/dev/null <<SQL
INSERT INTO organization_request
  (id, requesting_user_id, organization_name, organization_type, custom_organization_type,
   street, street_number, city, province, country, latitude, longitude,
   owner_first_name, owner_last_name, owner_email, owner_phone,
   reason, status, created_at, resolved_at, resolved_by_user_id, admin_note, organization_id)
VALUES
(1, 7,  'Club Atletico Belgrano',       'CLUB',            NULL,
   'Av. Patria',       '1600', 'Cordoba', 'Cordoba', 'Argentina', -31.3720, -64.2080,
   'Juliana', 'Morales', 'julia@mail.com',  '+54 9 351 111 2222',
   'Queremos gestionar objetos perdidos en los partidos del estadio.',
   'PENDING_APPROVAL', '2026-06-01 09:00:00', NULL, NULL, NULL, NULL),

(2, 8,  'Hospital Privado',             'HOSPITAL',        NULL,
   'Naciones Unidas',  '346',  'Cordoba', 'Cordoba', 'Argentina', -31.3876, -64.1803,
   'Pedro',   'Soria',   'pedro@mail.com',  '+54 9 351 333 4444',
   'El hospital necesita un sistema para devolver objetos a pacientes y familiares.',
   'APPROVED',         '2026-05-20 10:30:00', '2026-05-22 09:15:00', 1, NULL, NULL),

(3, 9,  'Colegio Nacional de Monserrat','SCHOOL',          NULL,
   'Obispo Trejo',     '294',  'Cordoba', 'Cordoba', 'Argentina', -31.4155, -64.1841,
   'Valeria', 'Castro',  'valeria@mail.com', '+54 9 351 555 6666',
   'El colegio quiere digitalizar la gestion de objetos perdidos del alumnado.',
   'REJECTED',         '2026-05-15 14:00:00', '2026-05-17 11:30:00', 1,
   'La organizacion no cumple con los requisitos minimos de infraestructura para gestionar objetos perdidos en la plataforma.', NULL),

(4, 7,  'Mercado Norte',                'OTHER',           'Mercado municipal',
   'Bvd. Illia',       '300',  'Cordoba', 'Cordoba', 'Argentina', -31.4125, -64.1862,
   'Juliana', 'Morales', 'julia@mail.com',  '+54 9 351 111 2222',
   'Los puestos del mercado frecuentemente reciben objetos olvidados por los clientes.',
   'CANCELLED',        '2026-05-10 11:00:00', NULL, NULL, NULL, NULL),

-- Solicitudes aprobadas para las organizaciones precargadas
(5, 2,  'UTN FRC',                            'UNIVERSITY',    NULL,
   'Maestro Marcelo Lopez', '3814', 'Cordoba', 'Cordoba', 'Argentina', -31.4377, -64.1829,
   'Martina', 'Gonzalez',  'owner.utn@eurekapp.com',   '+54 9 351 000 0001',
   'Gestion de objetos perdidos en la facultad.',
   'APPROVED', '2025-01-10 10:00:00', '2025-01-12 09:00:00', 1, NULL, 1),

(6, 3,  'Terminal de Omnibus Cordoba',        'BUS_TERMINAL',  NULL,
   'Bvd. Peron',            '380',  'Cordoba', 'Cordoba', 'Argentina', -31.4201, -64.1888,
   'Rodrigo', 'Fernandez', 'owner.term@eurekapp.com',  '+54 9 351 000 0002',
   'Gestion de objetos perdidos en la terminal de omnibus.',
   'APPROVED', '2025-01-10 10:00:00', '2025-01-12 09:00:00', 1, NULL, 2),

(7, 1,  'Aeropuerto Internacional Cordoba',   'AIRPORT',       NULL,
   'Av. Fuerza Aerea Argentina', '6900', 'Cordoba', 'Cordoba', 'Argentina', -31.3233, -64.2081,
   'Sofia',   'Herrera',  'emp1.aero@eurekapp.com',   '+54 9 351 000 0003',
   'Gestion de objetos perdidos en el aeropuerto.',
   'APPROVED', '2025-01-10 10:00:00', '2025-01-12 09:00:00', 1, NULL, 3),

(8, 11, 'Shopping Patio Olmos',               'SHOPPING',      NULL,
   'Velez Sarsfield',       '361',  'Cordoba', 'Cordoba', 'Argentina', -31.4163, -64.1885,
   'Camila',  'Vargas',    'owner.patio@eurekapp.com', '+54 9 351 000 0004',
   'Gestion de objetos perdidos en el shopping.',
   'APPROVED', '2025-01-10 10:00:00', '2025-01-12 09:00:00', 1, NULL, 4),

(9, 13, 'UNC Ciudad Universitaria',           'UNIVERSITY',    NULL,
   'Av. Velez Sarsfield',   '5000', 'Cordoba', 'Cordoba', 'Argentina', -31.4384, -64.1917,
   'Diego',   'Salinas',   'owner.unc@eurekapp.com',   '+54 9 351 000 0005',
   'Gestion de objetos perdidos en la universidad.',
   'APPROVED', '2025-01-10 10:00:00', '2025-01-12 09:00:00', 1, NULL, 5),

(10, 15, 'Dinosaurio Mall',                   'SHOPPING_MALL', NULL,
   'Av. Ejercito Argentino', '6050', 'Cordoba', 'Cordoba', 'Argentina', -31.3693, -64.2254,
   'Sebastian', 'Romero',  'owner.dino@eurekapp.com',  '+54 9 351 000 0006',
   'Gestion de objetos perdidos en el shopping mall.',
   'APPROVED', '2025-01-10 10:00:00', '2025-01-12 09:00:00', 1, NULL, 6);
SQL
success "10 organization_requests insertados (6 APPROVED precargadas + 1 PENDING + 1 APPROVED + 1 REJECTED + 1 CANCELLED)"

# ─── 20. Upload de imagenes a S3 (MinIO local, ver docker-compose.yml) ───────
header "Imagenes S3 (MinIO)"

S3_BUCKET="eurekapp-temp"
# Siempre almacenamiento local. Las credenciales son las fijas de MinIO (las mismas que trae
# application-local.yml por default), no las de ninguna cuenta real: se fuerzan acá para que, si
# quien corre el seed tiene credenciales de AWS en su terminal, el cliente no las use igual.
S3_MODE="MinIO local"
S3_ENDPOINT="http://localhost:9000"
export AWS_ACCESS_KEY_ID="minioadmin"
export AWS_SECRET_ACCESS_KEY="minioadmin"
export AWS_DEFAULT_REGION="us-east-1"
S3_ENDPOINT_ARGS=(--endpoint-url "$S3_ENDPOINT")
IMG_DIR="$(dirname "$0")/seed-data/images"
# EU-325: las fotos REALES de cada objeto (found + búsquedas guardadas) viven versionadas acá,
# nombradas por UUID (= key de S3). Son las mismas que vectorizó generate_seed_vectors.py, así que
# lo que se ve en la app coincide con lo que se buscó por similitud.
PHOTOS_DIR="$(dirname "$0")/seed-data/photos"
mkdir -p "$IMG_DIR"

# FoundObjects y LostObjects: la key S3 es el UUID; la foto real está en PHOTOS_DIR/<uuid>.jpg.
FO_KEYS=(
  "$FO_PARAGUAS" "$FO_NOTEBOOK" "$FO_BILLETERA" "$FO_LLAVE" "$FO_AURICULARES"
  "$FO_MOCHILA" "$FO_CELULAR" "$FO_BILLETERA_DNI" "$FO_CARGADOR" "$FO_ANTEOJOS"
  "$FO_N01" "$FO_N02" "$FO_N03" "$FO_N04" "$FO_N05" "$FO_N06" "$FO_N07"
  "$FO_N08" "$FO_N09" "$FO_N10" "$FO_N11" "$FO_N12" "$FO_N13" "$FO_N14"
  "$FO_N15" "$FO_N16" "$FO_N17" "$FO_N18" "$FO_N19" "$FO_N20" "$FO_N21"
)
# UUID de las 5 búsquedas guardadas (LostObject). Su foto se persiste en S3 al guardar (decisión 8),
# por eso el seed también las sube (para poder mostrarlas al ver la búsqueda guardada).
LO_KEYS=(
  "8044d799-77b3-4326-bb3f-f6a0ad195f94"  # paraguas
  "9970bf61-92c7-47be-a120-41424bdc1320"  # notebook Dell
  "aeaac6e1-893c-4f49-af6e-f43f62f6d71f"  # billetera de cuero marron
  "56fcd220-9532-45d9-beee-1253f5846677"  # auriculares
  "8645d88c-529c-496c-a213-f768892dd2ad"  # mochila azul
)
# Una foto de persona por devolucion. Las cinco primeras son las que ya existian.
PERSON_KEYS=()
for i in $(seq -w 1 24); do PERSON_KEYS+=("person-photo-0$i"); done

S3_UPLOADED=0

# Las fotos de persona no existen como material real: se usa una imagen cualquiera, cacheada en
# IMG_DIR para no volver a bajarla en cada corrida.
for i in $(seq 1 ${#PERSON_KEYS[@]}); do
  KEY="${PERSON_KEYS[$((i-1))]}"
  CACHED="$IMG_DIR/${KEY}.jpg"
  if [[ ! -f "$CACHED" ]]; then
    curl -sL "https://picsum.photos/seed/pp$(printf '%03d' $i)/300/400" -o "$CACHED" 2>/dev/null \
      || warn "  No se pudo descargar la foto de persona $KEY"
  fi
done

# Lista de todo lo que hay que subir: "<nombre-destino> <archivo-local>".
MANIFEST=$(mktemp)
for KEY in "${FO_KEYS[@]}" "${LO_KEYS[@]}"; do
  if [[ -f "$PHOTOS_DIR/${KEY}.jpg" ]]; then
    echo "$KEY $PHOTOS_DIR/${KEY}.jpg" >> "$MANIFEST"
  else
    warn "  Falta la foto de $KEY"
  fi
done
for KEY in "${PERSON_KEYS[@]}"; do
  [[ -f "$IMG_DIR/${KEY}.jpg" ]] && echo "$KEY $IMG_DIR/${KEY}.jpg" >> "$MANIFEST"
done
TOTAL_FOTOS=$(wc -l < "$MANIFEST")

if command -v aws &>/dev/null && aws s3 ls "s3://${S3_BUCKET}" "${S3_ENDPOINT_ARGS[@]}" >/dev/null 2>&1; then
  info "$S3_MODE detectado — subiendo $TOTAL_FOTOS imagenes..."
  while read -r KEY SRC; do
    aws s3 cp "$SRC" "s3://${S3_BUCKET}/${KEY}" "${S3_ENDPOINT_ARGS[@]}" --quiet 2>/dev/null \
      && S3_UPLOADED=$((S3_UPLOADED + 1)) || warn "  no se pudo subir $KEY"
  done < "$MANIFEST"
  success "$S3_UPLOADED de $TOTAL_FOTOS imagenes en $S3_MODE (bucket: $S3_BUCKET)"
else
  # Sin el cliente de linea de comandos de AWS instalado, el paso se saltaba entero y la
  # aplicacion quedaba sin una sola foto. Contra el almacenamiento local no hace falta: se sube
  # hablando directo con el, que es lo que hace este script.
  info "Subiendo $TOTAL_FOTOS imagenes al almacenamiento local..."
  if S3_ENDPOINT="$S3_ENDPOINT" S3_BUCKET="$S3_BUCKET" \
     ${PYTHON_CMD} "$SEED_DATA_DIR/upload_photos.py" "$MANIFEST"; then
    S3_UPLOADED=$TOTAL_FOTOS
    success "$TOTAL_FOTOS imagenes en $S3_MODE (bucket: $S3_BUCKET)"
  else
    warn "Quedaron imagenes sin subir: los objetos se van a ver sin foto."
  fi
fi
rm -f "$MANIFEST"

# ─── 21. Resumen ─────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║          EurekApp — Seed completado exitosamente         ║${NC}"
echo -e "${GREEN}${BOLD}╠══════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}${BOLD}║${NC}  MySQL                                                   ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    Organizaciones        : 6                             ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    Usuarios              : 17                            ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    Devoluciones          : 24 (una por objeto)         ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    Exclusiones reward    : 3                             ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    Search Feedback       : 10                            ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    Organization Feedback : 2  (+1 sin calificar)       ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    Usability Feedback    : 7                             ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    Alertas de fraude     : 7  (4 vigentes, 3 falsas)   ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    Reclamos              : 0  (seed off — EU-278/292)    ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    Reclamo History       : 0  (seed off — EU-278)        ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    Org Requests          : 10 (6 APPROVED precargadas + 1P/1A/1R/1C) ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}╠══════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}${BOLD}║${NC}  Weaviate                                                ${GREEN}${BOLD}║${NC}"
printf "${GREEN}${BOLD}║${NC}  %-54s${GREEN}${BOLD}║${NC}\n" "  FoundObjects          : ${FO_INSERTED} (embeddings reales)"
printf "${GREEN}${BOLD}║${NC}  %-54s${GREEN}${BOLD}║${NC}\n" "  LostObjects           : ${LO_INSERTED}"
echo -e "${GREEN}${BOLD}╠══════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}${BOLD}║${NC}  S3                                                      ${GREEN}${BOLD}║${NC}"
printf "${GREEN}${BOLD}║${NC}  %-54s${GREEN}${BOLD}║${NC}\n" "  Imagenes subidas      : ${S3_UPLOADED}"
echo -e "${GREEN}${BOLD}╠══════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}${BOLD}║${NC}  Contrasena de todos los usuarios: ${BOLD}${SEED_PASSWORD}${NC}           ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}╠══════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}${BOLD}║${NC}  Usuarios disponibles:                                   ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    soporte.eurekapp@gmail.com  → ADMIN                   ${GREEN}${BOLD}║${NC}"
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
echo -e "${GREEN}${BOLD}║${NC}    micaela@mail.com            → USER  (bloqueada)       ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
