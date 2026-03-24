#!/usr/bin/env bash

# ─── Colores ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'
BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
header()  { echo -e "\n${BOLD}${CYAN}── $* ──${NC}"; }

MYSQL_EXEC="docker exec -i eurekapp-mysql mysql -u eurekapp -peurekapp eurekapp"
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

# Intentar con python3 + bcrypt (instalando si hace falta)
BCRYPT_HASH=$(python3 - <<'PYEOF' 2>/dev/null
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
# Si python no está disponible se usa este hash hardcodeado.
# Para generarlo manualmente: python3 -c "import bcrypt; print(bcrypt.hashpw(b'Eurekapp1!', bcrypt.gensalt(10)).decode())"
if [[ -z "$BCRYPT_HASH" ]]; then
  warn "python3/bcrypt no disponible. Usando hash de fallback."
  BCRYPT_HASH='$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.'
  SEED_PASSWORD="password"  # contraseña del hash de fallback (Spring Security test fixture)
fi

info "Contraseña de todos los usuarios seed: ${BOLD}${SEED_PASSWORD}${NC}"
success "Hash generado"

# ─── 3. Generar vectores dummy para Weaviate ─────────────────────────────────
header "Generando vectores para Weaviate"

# Vectores unitarios normalizados de 1536 dimensiones (compatibles con cosine distance)
generate_vector() {
  local SEED="$1"
  python3 - <<PYEOF 2>/dev/null
import random, math
random.seed($SEED)
v = [random.gauss(0, 1) for _ in range(1536)]
mag = math.sqrt(sum(x*x for x in v))
v = [x / mag for x in v]
print(','.join(f'{x:.6f}' for x in v))
PYEOF
}

info "Generando 8 vectores (puede tardar unos segundos)..."
VEC_1=$(generate_vector 101); [[ -n "$VEC_1" ]] || error "No se pudo generar vectores. Verificá que python3 esté instalado."
VEC_2=$(generate_vector 102)
VEC_3=$(generate_vector 103)
VEC_4=$(generate_vector 104)
VEC_5=$(generate_vector 105)
VEC_6=$(generate_vector 201)
VEC_7=$(generate_vector 202)
VEC_8=$(generate_vector 203)
success "Vectores generados"

# ─── 4. Confirmar reset ──────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}${BOLD}⚠  Esto va a BORRAR todos los datos actuales y reemplazarlos con datos de seed.${NC}"
if [[ "${1:-}" != "--force" ]]; then
  read -rp "¿Continuar? (s/N): " CONFIRM
  [[ "$CONFIRM" =~ ^[sS]$ ]] || { echo "Cancelado."; exit 0; }
fi

# ─── 5. Limpiar MySQL ────────────────────────────────────────────────────────
header "Limpiando MySQL"

$MYSQL_EXEC 2>/dev/null <<'SQL'
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE return_found_objects;
TRUNCATE TABLE add_employee_request;
TRUNCATE TABLE organization_request;
TRUNCATE TABLE users;
TRUNCATE TABLE organizations;
SET FOREIGN_KEY_CHECKS = 1;
SQL
success "MySQL limpio"

# ─── 6. Limpiar Weaviate ─────────────────────────────────────────────────────
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

# Para LostObject el campo es "description"
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

# ─── 7. Insertar Organizaciones ──────────────────────────────────────────────
header "Insertando Organizaciones"

$MYSQL_EXEC 2>/dev/null <<'SQL'
INSERT INTO organizations (id, name, contact_data, latitude, longitude) VALUES
(1, 'UTN FRC',                            'objetos.perdidos@frc.utn.edu.ar',     -31.4377, -64.1829),
(2, 'Terminal de Ómnibus Córdoba',        'objetos@terminalcordoba.com',          -31.4201, -64.1888),
(3, 'Aeropuerto Internacional Córdoba',   'objetosperdidos@aa2000.com.ar',        -31.3233, -64.2081);
SQL
success "3 organizaciones insertadas"

# ─── 8. Insertar Usuarios ────────────────────────────────────────────────────
header "Insertando Usuarios"

# Necesitamos el hash escapado para SQL
HASH_ESCAPED="${BCRYPT_HASH//\'/\'\'}"

$MYSQL_EXEC 2>/dev/null <<SQL
INSERT INTO users (id, username, password, active, first_name, last_name, role, organization_id, XP, returned_objects) VALUES
-- Admin
(1,  'admin@eurekapp.com',      '$HASH_ESCAPED', 1, 'Admin',    'EurekApp',  'ADMIN',                  NULL, 500, 10),
-- Dueños de organización
(2,  'owner.utn@eurekapp.com',  '$HASH_ESCAPED', 1, 'Martina',  'González',  'ORGANIZATION_OWNER',     1,    150,  3),
(3,  'owner.term@eurekapp.com', '$HASH_ESCAPED', 1, 'Rodrigo',  'Fernández', 'ORGANIZATION_OWNER',     2,    80,   2),
-- Empleados
(4,  'emp1.utn@eurekapp.com',   '$HASH_ESCAPED', 1, 'Lucía',    'Pérez',     'ORGANIZATION_EMPLOYEE',  1,    30,   1),
(5,  'emp2.utn@eurekapp.com',   '$HASH_ESCAPED', 1, 'Tomás',    'Ramírez',   'ORGANIZATION_EMPLOYEE',  1,    20,   0),
-- Usuarios regulares
(6,  'julia@mail.com',          '$HASH_ESCAPED', 1, 'Julia',    'Morales',   'USER',                   NULL, 20,   1),
(7,  'pedro@mail.com',          '$HASH_ESCAPED', 1, 'Pedro',    'Soria',     'USER',                   NULL, 10,   0),
(8,  'valeria@mail.com',        '$HASH_ESCAPED', 1, 'Valeria',  'Castro',    'USER',                   NULL, 0,    0);
SQL
success "8 usuarios insertados"

# ─── 9. Insertar FoundObjects en Weaviate ────────────────────────────────────
header "Insertando FoundObjects en Weaviate"

# UUIDs fijos para poder referenciarlos en ReturnFoundObjects
FO_UUID_1="a1b2c3d4-0001-0001-0001-000000000001"
FO_UUID_2="a1b2c3d4-0001-0001-0001-000000000002"
FO_UUID_3="a1b2c3d4-0001-0001-0001-000000000003"
FO_UUID_4="a1b2c3d4-0001-0001-0001-000000000004"
FO_UUID_5="a1b2c3d4-0001-0001-0001-000000000005"

insert_found_object() {
  local UUID="$1" TITLE="$2" HUMAN_DESC="$3" AI_DESC="$4" ORG_ID="$5"
  local LAT="$6" LNG="$7" DATE="$8" RETURNED="$9" VECTOR="${10}"

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
        \"was_returned\": $RETURNED
      }
    }")
  [[ "$HTTP" == "200" ]] || warn "  FoundObject '$TITLE' → HTTP $HTTP"
}

insert_found_object "$FO_UUID_1" \
  "Billetera negra de cuero" \
  "Billetera negra de cuero con tarjetas y algo de efectivo" \
  "Una billetera de cuero negro con compartimentos para tarjetas, billetes y una moneda" \
  "1" "-31.4377" "-64.1829" "2025-03-01" "false" "$VEC_1"
success "  FoundObject 1: Billetera negra"

insert_found_object "$FO_UUID_2" \
  "Llave con llavero azul" \
  "Llave suelta con llavero de goma azul" \
  "Una llave de metal plateada con un llavero de goma de color azul sin inscripciones" \
  "1" "-31.4377" "-64.1829" "2025-03-05" "false" "$VEC_2"
success "  FoundObject 2: Llave con llavero azul"

insert_found_object "$FO_UUID_3" \
  "Auriculares inalámbricos blancos" \
  "Auriculares over-ear blancos, sin cables, marca no visible" \
  "Auriculares inalámbricos de color blanco con almohadillas negras y sin etiqueta visible" \
  "2" "-31.4201" "-64.1888" "2025-03-08" "true" "$VEC_3"
success "  FoundObject 3: Auriculares (retornado)"

insert_found_object "$FO_UUID_4" \
  "Mochila azul con libros" \
  "Mochila azul mediana con varios libros y un estuche adentro" \
  "Mochila de tela de color azul marino con logo desgastado, contiene libros de texto y un estuche escolar" \
  "1" "-31.4375" "-64.1831" "2025-03-10" "false" "$VEC_4"
success "  FoundObject 4: Mochila azul"

insert_found_object "$FO_UUID_5" \
  "Celular Samsung negro" \
  "Celular Samsung con pantalla rota y funda gris" \
  "Smartphone Samsung de color negro con la pantalla fisurada y una funda protectora gris oscuro" \
  "3" "-31.3233" "-64.2081" "2025-03-12" "false" "$VEC_5"
success "  FoundObject 5: Celular Samsung"

# ─── 10. Insertar LostObjects en Weaviate ────────────────────────────────────
header "Insertando LostObjects en Weaviate"

LO_UUID_1="b2c3d4e5-0002-0002-0002-000000000001"
LO_UUID_2="b2c3d4e5-0002-0002-0002-000000000002"
LO_UUID_3="b2c3d4e5-0002-0002-0002-000000000003"

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
  "julia@mail.com" "2025-03-02" "1" "-31.4377" "-64.1829" "$VEC_6"
success "  LostObject 1: Billetera (julia)"

insert_lost_object "$LO_UUID_2" \
  "Se me cayeron unos auriculares inalámbricos blancos en la terminal" \
  "pedro@mail.com" "2025-03-09" "2" "-31.4201" "-64.1888" "$VEC_7"
success "  LostObject 2: Auriculares (pedro)"

insert_lost_object "$LO_UUID_3" \
  "Perdí una mochila azul con libros de ingeniería en UTN" \
  "valeria@mail.com" "2025-03-11" "1" "-31.4375" "-64.1831" "$VEC_8"
success "  LostObject 3: Mochila (valeria)"

# ─── 11. Insertar ReturnFoundObjects ─────────────────────────────────────────
header "Insertando ReturnFoundObjects"

# UUID_3 (auriculares) está marcado como was_returned=true → lo registramos
$MYSQL_EXEC 2>/dev/null <<SQL
INSERT INTO return_found_objects
  (id, user_id, DNI, phone_number, found_object_uuid, person_photo_uuid, datetime_of_return)
VALUES
(1, 7, '35123456', '3516001122', '$FO_UUID_3', 'photo-uuid-fake-001', '2025-03-09 14:35:00'),
(2, NULL, '28987654', '3514009988', '$FO_UUID_3', 'photo-uuid-fake-002', '2025-03-09 14:36:00');
SQL

# Actualizar XP y returned_objects del usuario 7 (Pedro) que retornó el objeto
$MYSQL_EXEC 2>/dev/null <<'SQL'
UPDATE users SET returned_objects = returned_objects + 1, XP = XP + 10 WHERE id = 7;
SQL
success "2 retornos registrados"

# ─── 12. Resumen ─────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║               Seed completado exitosamente           ║${NC}"
echo -e "${GREEN}${BOLD}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}${BOLD}║${NC}  MySQL                                               ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    Organizaciones : 3                                ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    Usuarios       : 8                                ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    Retornos       : 2                                ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}  Weaviate                                            ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    FoundObjects   : 5                                ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    LostObjects    : 3                                ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}${BOLD}║${NC}  Contraseña de todos los usuarios: ${BOLD}${SEED_PASSWORD}${NC}         ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}${BOLD}║${NC}  Usuarios disponibles:                               ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    admin@eurekapp.com      → ADMIN                   ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    owner.utn@eurekapp.com  → OWNER (UTN FRC)         ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    owner.term@eurekapp.com → OWNER (Terminal)        ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    emp1.utn@eurekapp.com   → EMPLOYEE (UTN FRC)      ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    julia@mail.com          → USER (XP: 20)           ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    pedro@mail.com          → USER (XP: 10)           ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    valeria@mail.com        → USER (XP: 0)            ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
