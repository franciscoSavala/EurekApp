#!/usr/bin/env bash
# EU-325 (C) — SEED DEFINITIVO del entorno local de búsqueda.
#
# Es el único script que hay que correr para dejar Weaviate con el set de datos de referencia
# (10 objetos encontrados + 5 búsquedas, 5 de ellos formando pares). Envuelve a los dos scripts
# que ya existían y les agrega lo que faltaba: chequeo previo del entorno y validación final.
#
#   1. Preflight: Weaviate, CLIP y backend arriba y respondiendo.
#   2. Limpieza:  reset_weaviate_classes.sh (drop+recreate; NO batch-delete, crashea 1.24.1).
#   3. Carga:     reseed_via_api.sh — por API REAL, así pasa por normalización + CLIP +
#                 clasificación por IA + subida a S3. No se inyecta NDJSON a propósito.
#   4. Validación: todos los POST en 200 y los conteos finales en 10/5.
#
# Uso:  bash Backend/seed-data/seed.sh
# Requiere: contenedores arriba (bash Backend/start-local.sh) y backend en :8080 con perfil local.
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
API=http://localhost:8080
W=http://localhost:8081
CLIP=http://localhost:8000
EXPECTED_FOUND=10
EXPECTED_LOST=5

fail() { echo; echo "ABORTADO: $*"; exit 1; }

# ─── 1. Preflight ────────────────────────────────────────────────────────────
echo "=== PREFLIGHT ==="
check() { # check <nombre> <url> <pista>
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$2" 2>/dev/null)
  if [ "$code" = "200" ]; then
    echo "  OK   $1"
  else
    echo "  FALLA $1 ($2 -> ${code:-sin respuesta})"
    fail "$3"
  fi
}
check "Weaviate" "$W/v1/.well-known/ready"  "levantar los contenedores: bash Backend/start-local.sh"
check "CLIP"     "$CLIP/health"             "levantar los contenedores: bash Backend/start-local.sh"

# El backend no expone actuator, así que se chequea con el propio login del seed: de paso valida
# que MySQL tiene los usuarios que start-local.sh siembra (si no, todos los POST irían a 401).
LOGIN_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 -X POST "$API/login" \
  -H 'Content-Type: application/json' \
  -d '{"username":"owner.utn@eurekapp.com","password":"Eurekapp1!"}' 2>/dev/null)
case "${LOGIN_CODE:-000}" in
  200) echo "  OK   Backend + usuarios de seed (login 200)" ;;
  000) fail "el backend no responde en $API — levantarlo en perfil local (:8080)" ;;
  *)   fail "el login de seed devolvió $LOGIN_CODE — ¿MySQL tiene el seed de usuarios de start-local.sh y el backend corre con perfil local?" ;;
esac

# ─── 2. Limpieza ─────────────────────────────────────────────────────────────
echo
echo "=== RESET DE CLASES ==="
bash "$HERE/reset_weaviate_classes.sh" || fail "falló el reset de clases"

# ─── 3. Carga ────────────────────────────────────────────────────────────────
echo
echo "=== CARGA POR API ==="
OUT=$(mktemp)
bash "$HERE/reseed_via_api.sh" 2>&1 | tee "$OUT"
grep -q "=== DONE ===" "$OUT" || fail "el reseed no llegó al final (ver salida de arriba)"

# ─── 4. Validación ───────────────────────────────────────────────────────────
echo
echo "=== VALIDACION ==="
BAD=$(grep -E '^(FOUND|LOST)' "$OUT" | grep -vc -- '-> 200')
if [ "$BAD" -ne 0 ]; then
  echo "  $BAD POST no devolvieron 200:"
  grep -E '^(FOUND|LOST)' "$OUT" | grep -v -- '-> 200' | sed 's/^/    /'
  echo "  Pista: un 500 en los FOUND suele ser S3 (bucket/credencial en Backend/.env.local)."
  rm -f "$OUT"
  fail "la carga quedó incompleta"
fi
echo "  OK   los 15 POST devolvieron 200"

rm -f "$OUT"

count() { curl -s "$W/v1/graphql" -H 'Content-Type: application/json' \
  -d "{\"query\":\"{Aggregate{$1{meta{count}}}}\"}" | grep -o '"count":[0-9]*' | grep -o '[0-9]*'; }
NF=$(count FoundObject); NL=$(count LostObject)
echo "  FoundObject: ${NF:-?} (esperado $EXPECTED_FOUND) · LostObject: ${NL:-?} (esperado $EXPECTED_LOST)"
[ "${NF:-0}" = "$EXPECTED_FOUND" ] && [ "${NL:-0}" = "$EXPECTED_LOST" ] \
  || fail "los conteos en Weaviate no coinciden con lo esperado"

# Sin categoría no hay filtro posible: el objeto queda invisible para la búsqueda. La categoría NO
# viene en la respuesta del POST (el DTO no la expone), así que se verifica contra Weaviate.
cats() { curl -s "$W/v1/graphql" -H 'Content-Type: application/json' \
  -d "{\"query\":\"{Get{$1(limit:50){category}}}\"}" | grep -o '"category":"[^\"]*"' | grep -vc '"category":""'; }
CF=$(cats FoundObject); CL=$(cats LostObject)
[ "${CF:-0}" = "$EXPECTED_FOUND" ] && [ "${CL:-0}" = "$EXPECTED_LOST" ] \
  || fail "faltan categorías (FoundObject con categoría: ${CF:-0}/$EXPECTED_FOUND · LostObject: ${CL:-0}/$EXPECTED_LOST) — revisar el clasificador en :8000"
echo "  OK   los 15 objetos tienen categoría"

echo
echo "SEED OK — entorno listo para probar la búsqueda."
