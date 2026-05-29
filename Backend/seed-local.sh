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

echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║    EurekApp — Seed Base de Datos     ║${NC}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════╝${NC}"
echo ""

# ─── 1. Verificar que los contenedores están corriendo ───────────────────────
header "Verificando contenedores"

docker inspect eurekapp-mysql  --format='{{.State.Status}}' 2>/dev/null | grep -q "running" \
  || error "MySQL no está corriendo. Ejecutá primero: bash start-local.sh"
docker inspect eurekapp-weaviate --format='{{.State.Status}}' 2>/dev/null | grep -q "running" \
  || error "Weaviate no está corriendo. Ejecutá primero: bash start-local.sh"

success "Contenedores OK"

# ─── 2. Generar hash BCrypt para la contraseña de seed ───────────────────────
header "Generando hash de contraseña"

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

# Fallback: hash conocido de Spring Security para la contraseña "Eurekapp1!"
if [[ -z "$BCRYPT_HASH" ]]; then
  warn "python3/bcrypt no disponible. Usando hash de fallback."
  BCRYPT_HASH='$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.'
  SEED_PASSWORD="password"
fi

info "Contraseña de todos los usuarios seed: ${BOLD}${SEED_PASSWORD}${NC}"
success "Hash generado"

# ─── 3. Generar vectores dummy para Weaviate ─────────────────────────────────
header "Generando vectores para Weaviate"

generate_vector() {
  local SEED="$1"
  ${PYTHON_CMD} - <<PYEOF 2>/dev/null
import random, math
random.seed($SEED)
v = [random.gauss(0, 1) for _ in range(1536)]
mag = math.sqrt(sum(x*x for x in v))
v = [x / mag for x in v]
print(','.join(f'{x:.6f}' for x in v))
PYEOF
}

info "Generando 16 vectores (puede tardar unos segundos)..."
VEC_1=$(generate_vector 101);  [[ -n "$VEC_1" ]] || error "No se pudo generar vectores. Verificá que python3 o python esté instalado."
VEC_2=$(generate_vector 102)
VEC_3=$(generate_vector 103)
VEC_4=$(generate_vector 104)
VEC_5=$(generate_vector 105)
VEC_6=$(generate_vector 106)
VEC_7=$(generate_vector 107)
VEC_8=$(generate_vector 108)
VEC_9=$(generate_vector 109)
VEC_10=$(generate_vector 110)
VEC_11=$(generate_vector 111)
VEC_12=$(generate_vector 201)
VEC_13=$(generate_vector 202)
VEC_14=$(generate_vector 203)
VEC_15=$(generate_vector 204)
VEC_16=$(generate_vector 205)
success "Vectores generados"

# ─── 4. Confirmar reset ──────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}${BOLD}⚠  Esto va a BORRAR todos los datos actuales y reemplazarlos con datos de seed.${NC}"
if [[ "${1:-}" != "--force" ]]; then
  read -rp "¿Continuar? (s/N): " CONFIRM
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
TRUNCATE TABLE users;
TRUNCATE TABLE organizations;
SET FOREIGN_KEY_CHECKS = 1;
SQL
success "MySQL limpio"

# ─── 7. Limpiar Weaviate ─────────────────────────────────────────────────────
header "Limpiando Weaviate"

for CLASS in FoundObject LostObject; do
  curl -sf -X POST "$WEAVIATE_URL/v1/batch/objects/delete" \
    -H "Content-Type: application/json" \
    -d "{
      \"match\": {
        \"class\": \"$CLASS\",
        \"where\": {
          \"path\": [\"title\"],
          \"operator\": \"Like\",
          \"valueText\": \"*\"
        }
      }
    }" >/dev/null 2>&1 || true
done

curl -sf -X POST "$WEAVIATE_URL/v1/batch/objects/delete" \
  -H "Content-Type: application/json" \
  -d '{
    "match": {
      "class": "LostObject",
      "where": {
        "path": ["description"],
        "operator": "Like",
        "valueText": "*"
      }
    }
  }' >/dev/null 2>&1 || true

success "Weaviate limpio"

# ─── 8. Insertar Organizaciones ──────────────────────────────────────────────
header "Insertando Organizaciones"

$MYSQL_EXEC 2>/dev/null <<'SQL'
INSERT INTO organizations (id, name, contact_data, latitude, longitude) VALUES
(1, 'UTN FRC',                            'objetos.perdidos@frc.utn.edu.ar',     -31.4377, -64.1829),
(2, 'Terminal de Ómnibus Córdoba',        'objetos@terminalcordoba.com',          -31.4201, -64.1888),
(3, 'Aeropuerto Internacional Córdoba',   'objetosperdidos@aa2000.com.ar',        -31.3233, -64.2081);
SQL
success "3 organizaciones insertadas"

# ─── 9. Insertar Usuarios ────────────────────────────────────────────────────
header "Insertando Usuarios"

HASH_ESCAPED="${BCRYPT_HASH//\'/\'\'}"

$MYSQL_EXEC 2>/dev/null <<SQL
INSERT INTO users (id, username, password, active, first_name, last_name, role, organization_id, XP, returned_objects) VALUES
(1,  'admin@eurekapp.com',          '$HASH_ESCAPED', 1, 'Admin',    'EurekApp',  'ADMIN',                  NULL, 500, 10),
(2,  'owner.utn@eurekapp.com',      '$HASH_ESCAPED', 1, 'Martina',  'González',  'ORGANIZATION_OWNER',     1,    150,  3),
(3,  'owner.term@eurekapp.com',     '$HASH_ESCAPED', 1, 'Rodrigo',  'Fernández', 'ORGANIZATION_OWNER',     2,    80,   2),
(4,  'encargado.utn@eurekapp.com',  '$HASH_ESCAPED', 1, 'Carlos',   'Mendoza',   'ENCARGADO',              1,    0,    0),
(5,  'emp1.utn@eurekapp.com',       '$HASH_ESCAPED', 1, 'Lucía',    'Pérez',     'ORGANIZATION_EMPLOYEE',  1,    30,   1),
(6,  'emp2.utn@eurekapp.com',       '$HASH_ESCAPED', 1, 'Tomás',    'Ramírez',   'ORGANIZATION_EMPLOYEE',  1,    20,   0),
(7,  'julia@mail.com',              '$HASH_ESCAPED', 1, 'Julia',    'Morales',   'USER',                   NULL, 20,   1),
(8,  'pedro@mail.com',              '$HASH_ESCAPED', 1, 'Pedro',    'Soria',     'USER',                   NULL, 10,   0),
(9,  'valeria@mail.com',            '$HASH_ESCAPED', 1, 'Valeria',  'Castro',    'USER',                   NULL, 0,    0);
SQL
success "9 usuarios insertados"

# ─── 10. Insertar FoundObjects en Weaviate ───────────────────────────────────
header "Insertando FoundObjects en Weaviate"

FO_UUID_1="a1b2c3d4-0001-0001-0001-000000000001"
FO_UUID_2="a1b2c3d4-0001-0001-0001-000000000002"
FO_UUID_3="a1b2c3d4-0001-0001-0001-000000000003"
FO_UUID_4="a1b2c3d4-0001-0001-0001-000000000004"
FO_UUID_5="a1b2c3d4-0001-0001-0001-000000000005"
FO_UUID_6="a1b2c3d4-0001-0001-0001-000000000006"
FO_UUID_7="a1b2c3d4-0001-0001-0001-000000000007"
FO_UUID_8="a1b2c3d4-0001-0001-0001-000000000008"
FO_UUID_9="a1b2c3d4-0001-0001-0001-000000000009"
FO_UUID_10="a1b2c3d4-0001-0001-0001-000000000010"
FO_UUID_11="a1b2c3d4-0001-0001-0001-000000000011"

insert_found_object() {
  local UUID="$1" TITLE="$2" HUMAN_DESC="$3" AI_DESC="$4" ORG_ID="$5"
  local LAT="$6" LNG="$7" DATE="$8" RETURNED="$9" CATEGORY="${10}" VECTOR="${11}"

  local HTTP
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$WEAVIATE_URL/v1/objects" \
    -H "Content-Type: application/json" \
    -d "{
      \"class\": \"FoundObject\",
      \"id\": \"$UUID\",
      \"vector\": [$VECTOR],
      \"properties\": {
        \"title\": \"$TITLE\",
        \"human_description\": \"$HUMAN_DESC\",
        \"ai_description\": \"$AI_DESC\",
        \"organization_id\": \"$ORG_ID\",
        \"found_date\": \"${DATE}T10:00:00Z\",
        \"coordinates\": { \"latitude\": $LAT, \"longitude\": $LNG },
        \"was_returned\": $RETURNED,
        \"object_finder_user_id\": \"0\",
        \"category\": \"$CATEGORY\"
      }
    }")
  [[ "$HTTP" == "200" ]] || warn "  FoundObject '$TITLE' → HTTP $HTTP"
}

insert_found_object "$FO_UUID_1" \
  "Billetera negra de cuero" \
  "Billetera negra de cuero con tarjetas y algo de efectivo" \
  "Una billetera de cuero negro con compartimentos para tarjetas, billetes y una moneda" \
  "1" "-31.4377" "-64.1829" "2026-04-28" "false" "Billeteras" "$VEC_1"
success "  FO-1: Billetera negra (Billeteras)"

insert_found_object "$FO_UUID_2" \
  "Llave con llavero azul" \
  "Llave suelta con llavero de goma azul" \
  "Una llave de metal plateada con un llavero de goma de color azul sin inscripciones" \
  "1" "-31.4377" "-64.1829" "2026-05-02" "false" "Llaves" "$VEC_2"
success "  FO-2: Llave (Llaves)"

insert_found_object "$FO_UUID_3" \
  "Auriculares inalámbricos blancos" \
  "Auriculares over-ear blancos, sin cables, marca no visible" \
  "Auriculares inalámbricos de color blanco con almohadillas negras y sin etiqueta visible" \
  "2" "-31.4201" "-64.1888" "2026-05-05" "true" "Electrónica" "$VEC_3"
success "  FO-3: Auriculares (Electrónica) — retornado"

insert_found_object "$FO_UUID_4" \
  "Mochila azul con libros" \
  "Mochila azul mediana con varios libros y un estuche adentro" \
  "Mochila de tela de color azul marino con logo desgastado, contiene libros de texto y un estuche escolar" \
  "1" "-31.4375" "-64.1831" "2026-05-07" "false" "Mochilas" "$VEC_4"
success "  FO-4: Mochila azul (Mochilas)"

insert_found_object "$FO_UUID_5" \
  "Celular Samsung negro" \
  "Celular Samsung con pantalla rota y funda gris" \
  "Smartphone Samsung de color negro con la pantalla fisurada y una funda protectora gris oscuro" \
  "3" "-31.3233" "-64.2081" "2026-05-09" "false" "Celulares" "$VEC_5"
success "  FO-5: Celular Samsung (Celulares)"

insert_found_object "$FO_UUID_6" \
  "Paraguas negro plegable" \
  "Paraguas negro plegable de tamaño compacto, sin marca visible" \
  "Paraguas plegable de color negro con mango recto y funda de tela" \
  "1" "-31.4377" "-64.1829" "2026-04-15" "true" "Paraguas" "$VEC_6"
success "  FO-6: Paraguas (Paraguas) — retornado"

insert_found_object "$FO_UUID_7" \
  "Tarjeta de acceso universitaria" \
  "Tarjeta de acceso universitaria plastificada con foto de alumno" \
  "Tarjeta de identificación universitaria con foto carnet, nombre impreso y código de barras" \
  "1" "-31.4375" "-64.1831" "2026-04-22" "true" "Documentos" "$VEC_7"
success "  FO-7: Tarjeta universitaria (Documentos) — retornada"

insert_found_object "$FO_UUID_8" \
  "Notebook Dell gris" \
  "Notebook Dell gris de 15 pulgadas con stickers en la tapa" \
  "Laptop Dell Inspiron de 15 pulgadas color gris plateado, con varios stickers decorativos en la cubierta" \
  "2" "-31.4201" "-64.1888" "2026-04-25" "true" "Computadoras" "$VEC_8"
success "  FO-8: Notebook Dell (Computadoras) — retornada"

insert_found_object "$FO_UUID_9" \
  "Billetera marrón con DNI" \
  "Billetera marrón de cuero con DNI y tarjetas bancarias adentro" \
  "Billetera de cuero marrón con múltiples compartimentos, contiene DNI y tarjetas de crédito visibles" \
  "2" "-31.4201" "-64.1888" "2026-05-12" "true" "Billeteras" "$VEC_9"
success "  FO-9: Billetera marrón (Billeteras) — retornada"

insert_found_object "$FO_UUID_10" \
  "Cargador USB-C blanco" \
  "Cargador USB-C blanco de 20W con cable incluido" \
  "Adaptador de corriente blanco con puerto USB-C y cable corto, potencia 20W, sin marca visible" \
  "3" "-31.3233" "-64.2081" "2026-05-14" "false" "Electrónica" "$VEC_10"
success "  FO-10: Cargador USB-C (Electrónica)"

insert_found_object "$FO_UUID_11" \
  "Anteojos de sol negros" \
  "Anteojos de sol con montura negra y lentes espejados" \
  "Lentes de sol con armazón negro mate y cristales espejados dorados, sin estuche" \
  "1" "-31.4377" "-64.1829" "2026-05-20" "false" "Accesorios" "$VEC_11"
success "  FO-11: Anteojos de sol (Accesorios)"

# ─── 11. Insertar LostObjects en Weaviate ────────────────────────────────────
header "Insertando LostObjects en Weaviate"

LO_UUID_1="b2c3d4e5-0002-0002-0002-000000000001"
LO_UUID_2="b2c3d4e5-0002-0002-0002-000000000002"
LO_UUID_3="b2c3d4e5-0002-0002-0002-000000000003"
LO_UUID_4="b2c3d4e5-0002-0002-0002-000000000004"
LO_UUID_5="b2c3d4e5-0002-0002-0002-000000000005"
LO_UUID_6="b2c3d4e5-0002-0002-0002-000000000006"

insert_lost_object() {
  local UUID="$1" DESC="$2" USERNAME="$3" DATE="$4" ORG_ID="$5"
  local LAT="$6" LNG="$7" VECTOR="$8"

  local HTTP
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$WEAVIATE_URL/v1/objects" \
    -H "Content-Type: application/json" \
    -d "{
      \"class\": \"LostObject\",
      \"id\": \"$UUID\",
      \"vector\": [$VECTOR],
      \"properties\": {
        \"description\": \"$DESC\",
        \"username\": \"$USERNAME\",
        \"organization_id\": \"$ORG_ID\",
        \"lost_date\": \"${DATE}T08:00:00Z\",
        \"coordinates\": { \"latitude\": $LAT, \"longitude\": $LNG }
      }
    }")
  [[ "$HTTP" == "200" ]] || warn "  LostObject '$DESC' → HTTP $HTTP"
}

insert_lost_object "$LO_UUID_1" \
  "Perdí mi billetera negra de cuero cerca de la facultad, tenía DNI y tarjetas" \
  "julia@mail.com" "2026-04-29" "1" "-31.4377" "-64.1829" "$VEC_12"
success "  LO-1: Billetera (julia)"

insert_lost_object "$LO_UUID_2" \
  "Se me cayeron unos auriculares inalámbricos blancos en la terminal" \
  "pedro@mail.com" "2026-05-06" "2" "-31.4201" "-64.1888" "$VEC_13"
success "  LO-2: Auriculares (pedro)"

insert_lost_object "$LO_UUID_3" \
  "Perdí una mochila azul con libros de ingeniería en UTN" \
  "valeria@mail.com" "2026-05-08" "1" "-31.4375" "-64.1831" "$VEC_14"
success "  LO-3: Mochila (valeria)"

insert_lost_object "$LO_UUID_4" \
  "Se me olvidó mi paraguas negro en el aula magna de UTN" \
  "julia@mail.com" "2026-04-16" "1" "-31.4377" "-64.1829" "$VEC_15"
success "  LO-4: Paraguas (julia)"

insert_lost_object "$LO_UUID_5" \
  "Perdí mi tarjeta universitaria en la biblioteca de UTN" \
  "pedro@mail.com" "2026-04-23" "1" "-31.4375" "-64.1831" "$VEC_16"
success "  LO-5: Tarjeta universitaria (pedro)"

insert_lost_object "$LO_UUID_6" \
  "Olvidé mi notebook Dell gris en la sala de espera de la terminal" \
  "valeria@mail.com" "2026-04-26" "2" "-31.4201" "-64.1888" "$VEC_1"
success "  LO-6: Notebook (valeria)"

# ─── 12. Insertar ReturnFoundObjects ─────────────────────────────────────────
header "Insertando ReturnFoundObjects"

$MYSQL_EXEC 2>/dev/null <<SQL
INSERT INTO return_found_objects
  (id, user_id, DNI, phone_number, found_objectuuid, person_photo_uuid, datetime_of_return)
VALUES
(1, 8,    '35123456', '3516001122', '$FO_UUID_3', 'person-photo-001', '2026-05-06 14:35:00'),
(2, 7,    '28123456', '3516003344', '$FO_UUID_9', 'person-photo-002', '2026-05-13 12:00:00'),
(3, NULL, '30987654', '3515009988', '$FO_UUID_6', 'person-photo-003', '2026-04-20 10:00:00'),
(4, 8,    '35123456', '3516001122', '$FO_UUID_7', 'person-photo-004', '2026-05-01 10:00:00'),
(5, NULL, '42111222', '3517005566', '$FO_UUID_8', 'person-photo-005', '2026-05-05 10:00:00');
SQL

$MYSQL_EXEC 2>/dev/null <<'SQL'
UPDATE users SET returned_objects = returned_objects + 1, XP = XP + 10 WHERE id = 8;
UPDATE users SET returned_objects = returned_objects + 1, XP = XP + 10 WHERE id = 7;
SQL
success "5 retornos registrados"

# ─── 13. Insertar exclusiones de recompensa ──────────────────────────────────
header "Insertando exclusiones de recompensa"

$MYSQL_EXEC 2>/dev/null <<SQL
INSERT INTO reward_exclusions
  (found_objectuuid, user_id, user_role, reason, excluded_at, organization_id)
VALUES
('$FO_UUID_4', 4, 'ENCARGADO', 'INCOMPATIBLE_ROLE', '2026-05-10 09:15:00', '1');
SQL
success "1 exclusión de recompensa registrada (encargado)"

# ─── 14. Insertar SearchFeedback ─────────────────────────────────────────────
header "Insertando SearchFeedback"

$MYSQL_EXEC 2>/dev/null <<SQL
INSERT INTO search_feedback (organization_id, found_object_uuid, star_rating, was_found, comment, created_at, user_id) VALUES
('1', '$FO_UUID_1', 5, 1, 'Lo encontré rápido, excelente sistema',             '2026-04-29 11:00:00', 7),
('1', NULL,          2, 0, 'No encontré mi objeto, poca descripción disponible', '2026-05-03 09:30:00', 8),
('2', '$FO_UUID_3',  4, 1, NULL,                                                 '2026-05-06 15:00:00', 8),
('1', NULL,          1, 0, 'La búsqueda no funcionó bien',                       '2026-05-07 10:00:00', 9),
('1', '$FO_UUID_4',  3, 1, 'Tardó un poco pero lo encontré',                    '2026-05-08 14:00:00', 9),
('3', NULL,          5, 0, NULL,                                                 '2026-05-10 08:00:00', 7),
('1', '$FO_UUID_2',  4, 1, 'Muy útil la app',                                   '2026-05-11 16:00:00', 7),
('2', NULL,          2, 0, 'No había resultados precisos',                       '2026-05-12 12:00:00', 9),
('2', '$FO_UUID_9',  5, 1, 'Recuperé mi billetera al día siguiente!',            '2026-05-13 10:00:00', 7),
('1', NULL,          3, 0, NULL,                                                 '2026-05-15 09:00:00', 8);
SQL
success "10 registros de search_feedback insertados"

# ─── 15. Insertar UsabilityFeedback ──────────────────────────────────────────
header "Insertando UsabilityFeedback"

$MYSQL_EXEC 2>/dev/null <<'SQL'
INSERT INTO usability_feedback (star_rating, aspects, comment, context, created_at, user_id) VALUES
(5, 'FACILIDAD_USO,NAVEGACION', 'Muy fácil de usar',                     'search',        '2026-04-20 10:00:00', 5),
(4, 'CLARIDAD',                  NULL,                                    'profile',       '2026-04-25 11:00:00', 6),
(2, 'NAVEGACION',               'Me confundí con los menús',              'upload_object', '2026-05-01 09:00:00', 5),
(5, 'FACILIDAD_USO,CLARIDAD',   'Excelente experiencia',                  'search',        '2026-05-05 14:00:00', 2),
(3, 'NAVEGACION,FACILIDAD_USO', 'Regular, algunos botones confusos',     'profile',       '2026-05-10 16:00:00', 6),
(4, 'CLARIDAD',                  NULL,                                    'upload_object', '2026-05-14 08:00:00', 5),
(1, 'NAVEGACION',               'No entendí cómo reportar un objeto',     'upload_object', '2026-05-18 10:00:00', 6);
SQL
success "7 registros de usability_feedback insertados"

# ─── 16. Insertar FraudAlerts ────────────────────────────────────────────────
header "Insertando FraudAlerts"

$MYSQL_EXEC 2>/dev/null <<SQL
INSERT INTO fraud_alert (organization_id, found_object_uuid, suspect_user_id, reason, details, status, created_at, resolved_at, resolved_by_id) VALUES
('1', '$FO_UUID_1', 7,    'MULTIPLE_CLAIMERS_SAME_OBJECT', 'Tres personas reclamaron la misma billetera en 10 minutos',  'PENDING',          '2026-05-03 12:00:00', NULL,                  NULL),
('1', '$FO_UUID_4', 8,    'HIGH_CLAIM_FREQUENCY',          'El usuario realizó 8 reclamos en 2 días',                   'CONFIRMED_FRAUD',  '2026-05-09 09:00:00', '2026-05-10 10:00:00', 2),
('2', '$FO_UUID_3', NULL, 'FINDER_CLAIMER_COLLUSION',      'El registrador y reclamante tienen el mismo dispositivo',   'FALSE_POSITIVE',   '2026-05-07 11:00:00', '2026-05-08 15:00:00', 3),
('1', NULL,         9,    'REPEATED_REJECTIONS',           'El usuario tuvo 5 reclamos rechazados seguidos',            'PENDING',          '2026-05-20 08:00:00', NULL,                  NULL);
SQL
success "4 fraud_alerts insertados (2 PENDING, 1 CONFIRMED_FRAUD, 1 FALSE_POSITIVE)"

# ─── 17. Insertar Reclamos ───────────────────────────────────────────────────
header "Insertando Reclamos"

$MYSQL_EXEC 2>/dev/null <<SQL
INSERT INTO reclamos (organization_id, found_object_uuid, found_object_category, user_id, comment, claim_description, star_rating, status, created_at, updated_at, search_feedback_id) VALUES
('1', '$FO_UUID_1', 'Billeteras',  7, 'Creo que es mi billetera',    'Billetera negra, tenía mi DNI y tarjeta VISA',    4, 'DEVUELTO',    '2026-04-30 10:00:00', '2026-05-02 14:00:00', 1),
('1', '$FO_UUID_4', 'Mochilas',    9, 'Es mi mochila de ingeniería', 'Mochila azul con libros de cálculo y física',     3, 'EN_REVISION', '2026-05-08 15:00:00', '2026-05-09 09:00:00', NULL),
('2', '$FO_UUID_3', 'Electrónica', 8, 'Son mis auriculares',         'Auriculares Sony blancos, tenían funda negra',    5, 'APROBADO',    '2026-05-06 16:00:00', '2026-05-07 11:00:00', 3),
('1', '$FO_UUID_2', 'Llaves',      7, 'Parecen mis llaves',          'Llave de casa con llavero azul de plástico',      2, 'RECHAZADO',   '2026-05-03 09:00:00', '2026-05-04 08:00:00', NULL),
('3', '$FO_UUID_5', 'Celulares',   9, 'Es mi celular Samsung',       'Samsung Galaxy A54 negro, pantalla rota',         1, 'PENDIENTE',   '2026-05-10 12:00:00', NULL,                  NULL);
SQL
success "5 reclamos insertados"

# ─── 18. Insertar ReclamoHistory ─────────────────────────────────────────────
header "Insertando ReclamoHistory"

$MYSQL_EXEC 2>/dev/null <<'SQL'
INSERT INTO reclamo_history (reclamo_id, previous_status, new_status, changed_by_id, changed_at, note) VALUES
(1, 'PENDIENTE',    'EN_REVISION', 2, '2026-05-01 09:00:00', 'Iniciando revisión del caso'),
(1, 'EN_REVISION',  'APROBADO',    2, '2026-05-01 16:00:00', 'Verificado: la billetera corresponde al reclamante'),
(1, 'APROBADO',     'DEVUELTO',    2, '2026-05-02 14:00:00', 'Objeto entregado al dueño');
SQL
success "3 entradas de reclamo_history insertadas"

# ─── 19. Upload de imágenes a S3 (opcional) ──────────────────────────────────
header "Imágenes S3"

S3_BUCKET="eurekapp-temp-local"
S3_REGION="sa-east-1"
S3_IMAGES_UPLOADED=0

upload_to_s3() {
  local KEY="$1" URL="$2"
  local TMP="/tmp/seed_img_${KEY}.jpg"
  curl -sL "$URL" -o "$TMP" 2>/dev/null || { warn "  No se pudo descargar imagen para $KEY"; return; }
  aws s3 cp "$TMP" "s3://${S3_BUCKET}/${KEY}" --region "$S3_REGION" --quiet 2>/dev/null \
    && { info "  S3 ✓ $KEY"; S3_IMAGES_UPLOADED=$((S3_IMAGES_UPLOADED + 1)); } \
    || warn "  S3 ✗ $KEY (verificá tus credenciales AWS)"
  rm -f "$TMP"
}

if command -v aws &>/dev/null && aws sts get-caller-identity --region "$S3_REGION" >/dev/null 2>&1; then
  info "AWS CLI detectado — subiendo imágenes placeholder..."
  # FoundObjects: key = UUID del objeto (así lo resuelve S3Service.generatePresignedUrl)
  upload_to_s3 "$FO_UUID_1"  "https://picsum.photos/seed/fo01/400/300"
  upload_to_s3 "$FO_UUID_2"  "https://picsum.photos/seed/fo02/400/300"
  upload_to_s3 "$FO_UUID_3"  "https://picsum.photos/seed/fo03/400/300"
  upload_to_s3 "$FO_UUID_4"  "https://picsum.photos/seed/fo04/400/300"
  upload_to_s3 "$FO_UUID_5"  "https://picsum.photos/seed/fo05/400/300"
  upload_to_s3 "$FO_UUID_6"  "https://picsum.photos/seed/fo06/400/300"
  upload_to_s3 "$FO_UUID_7"  "https://picsum.photos/seed/fo07/400/300"
  upload_to_s3 "$FO_UUID_8"  "https://picsum.photos/seed/fo08/400/300"
  upload_to_s3 "$FO_UUID_9"  "https://picsum.photos/seed/fo09/400/300"
  upload_to_s3 "$FO_UUID_10" "https://picsum.photos/seed/fo10/400/300"
  upload_to_s3 "$FO_UUID_11" "https://picsum.photos/seed/fo11/400/300"
  # ReturnFoundObjects: key = person_photo_uuid (foto de la persona que retira el objeto)
  upload_to_s3 "person-photo-001" "https://picsum.photos/seed/pp01/300/400"
  upload_to_s3 "person-photo-002" "https://picsum.photos/seed/pp02/300/400"
  upload_to_s3 "person-photo-003" "https://picsum.photos/seed/pp03/300/400"
  upload_to_s3 "person-photo-004" "https://picsum.photos/seed/pp04/300/400"
  upload_to_s3 "person-photo-005" "https://picsum.photos/seed/pp05/300/400"
  success "$S3_IMAGES_UPLOADED imágenes subidas a S3 (bucket: $S3_BUCKET)"
else
  warn "AWS CLI no disponible o sin credenciales — se omite upload de imágenes"
  warn "Para subir imágenes: configurar 'aws configure' y correr el script nuevamente"
  warn "Para limpiar el bucket: aws s3 rm s3://${S3_BUCKET}/ --recursive"
  S3_IMAGES_UPLOADED="— (sin AWS CLI)"
fi

# ─── 20. Resumen ─────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║          EurekApp — Seed completado exitosamente         ║${NC}"
echo -e "${GREEN}${BOLD}╠══════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}${BOLD}║${NC}  MySQL                                                   ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    Organizaciones        : 3                             ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    Usuarios              : 9                             ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    Retornos              : 5                             ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    Exclusiones reward    : 1                             ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    Search Feedback       : 10                            ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    Usability Feedback    : 7                             ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    Fraud Alerts          : 4                             ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    Reclamos              : 5                             ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    Reclamo History       : 3                             ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}╠══════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}${BOLD}║${NC}  Weaviate                                                ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    FoundObjects          : 11  (todos con categoría)     ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    LostObjects           : 6                             ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}╠══════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}${BOLD}║${NC}  S3                                                      ${GREEN}${BOLD}║${NC}"
printf "${GREEN}${BOLD}║${NC}  %-54s${GREEN}${BOLD}║${NC}\n" "  Imágenes subidas      : ${S3_IMAGES_UPLOADED}"
echo -e "${GREEN}${BOLD}╠══════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}${BOLD}║${NC}  Contraseña de todos los usuarios: ${BOLD}${SEED_PASSWORD}${NC}           ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}╠══════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}${BOLD}║${NC}  Usuarios disponibles:                                   ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    admin@eurekapp.com          → ADMIN                   ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    owner.utn@eurekapp.com      → OWNER  (UTN FRC)        ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    owner.term@eurekapp.com     → OWNER  (Terminal)       ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    encargado.utn@eurekapp.com  → ENCARGADO (UTN FRC)     ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    emp1.utn@eurekapp.com       → EMPLOYEE (UTN FRC)      ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    emp2.utn@eurekapp.com       → EMPLOYEE (UTN FRC)      ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    julia@mail.com              → USER  (XP: 30)          ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    pedro@mail.com              → USER  (XP: 20)          ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    valeria@mail.com            → USER  (XP: 0)           ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
