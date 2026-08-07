#!/usr/bin/env bash
# EU-325 (C) — SEED DEFINITIVO del entorno local de búsqueda.
#
# Es el único script que hay que correr para dejar Weaviate con el set de datos de referencia
# (10 objetos encontrados + 5 búsquedas, 5 de ellos formando pares).
#
# CARGA DIRECTA A LA BASE, NO POR API — y esto es a propósito:
#   El nombre con el que se guarda la foto en S3 es el UUID que Weaviate le da al objeto. Si el seed
#   volviera a cargar por API, cada corrida generaría UUIDs nuevos: subiría las 15 fotos otra vez y
#   dejaría las viejas huérfanas en el bucket, en cada máquina y en cada corrida. Cargando el
#   snapshot —que tiene los UUIDs congelados— las fotos que ya están en S3 siguen sirviendo.
#   De paso no hace falta backend ni CLIP ni OpenAI: la corrida es de segundos y no gasta cuota.
#
#   La API se usó UNA vez, en el bootstrap, para que los datos salieran de las reglas de negocio
#   reales y para subir las fotos. Ver `reseed_via_api.sh` + `dump_seed.sh` (ahí está la receta para
#   regenerar el snapshot si alguna vez cambian los datos).
#
#   1. Preflight:  Weaviate arriba y snapshot presente.
#   2. Limpieza:   reset_weaviate_classes.sh (drop+recreate; NO batch-delete, crashea 1.24.1).
#   3. Carga:      POST directo a /v1/objects con id + propiedades + los dos named vectors.
#   4. Validación: conteos 10/5 y que los 15 objetos tengan categoría.
#
# Uso:  bash Backend/seed-data/seed.sh
# Requiere: contenedores arriba (bash Backend/start-local.sh). El backend NO hace falta.
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SNAP="$HERE/snapshot"
W=http://localhost:8081
EXPECTED_FOUND=10
EXPECTED_LOST=5

fail() { echo; echo "ABORTADO: $*"; exit 1; }

# ─── 1. Preflight ────────────────────────────────────────────────────────────
echo "=== PREFLIGHT ==="
CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$W/v1/.well-known/ready" 2>/dev/null)
[ "$CODE" = "200" ] || fail "Weaviate no responde en $W — levantar los contenedores: bash Backend/start-local.sh"
echo "  OK   Weaviate"
for C in FoundObject LostObject; do
  [ -s "$SNAP/$C.ndjson" ] || fail "falta $SNAP/$C.ndjson — regenerarlo con dump_seed.sh (ver cabecera)"
done
command -v python >/dev/null 2>&1 || fail "hace falta python en el PATH para leer el snapshot"
echo "  OK   snapshot presente"

# ─── 2. Limpieza ─────────────────────────────────────────────────────────────
echo
echo "=== RESET DE CLASES ==="
bash "$HERE/reset_weaviate_classes.sh" || fail "falló el reset de clases"

# ─── 3. Carga ────────────────────────────────────────────────────────────────
echo
echo "=== CARGA DIRECTA A WEAVIATE ==="
for C in FoundObject LostObject; do
  python - "$SNAP/$C.ndjson" "$W" <<'PY' || fail "falló la carga de $C"
import json, sys, urllib.request

path, w = sys.argv[1], sys.argv[2]
ok = bad = 0
with open(path, encoding="utf-8") as fh:
    for n, line in enumerate(fh, 1):
        line = line.strip()
        if not line:
            continue
        o = json.loads(line)
        # El id va explicito: es el nombre de la foto en S3 y no puede cambiar entre corridas.
        body = json.dumps({
            "class": o["class"],
            "id": o["id"],
            "properties": o["properties"],
            "vectors": o["vectors"],
        }).encode()
        req = urllib.request.Request(w + "/v1/objects", data=body,
                                     headers={"Content-Type": "application/json"}, method="POST")
        try:
            urllib.request.urlopen(req, timeout=30).read()
            ok += 1
        except Exception as e:
            bad += 1
            detail = getattr(e, "read", lambda: b"")()[:300].decode(errors="replace")
            print("  ERROR linea %d (%s): %s %s" % (n, o["properties"].get("title") or o["properties"].get("description", "")[:40], e, detail))
print("  %s: %d cargados, %d con error" % (o["class"], ok, bad))
sys.exit(1 if bad else 0)
PY
done

# ─── 4. Validación ───────────────────────────────────────────────────────────
echo
echo "=== VALIDACION ==="
count() { curl -s "$W/v1/graphql" -H 'Content-Type: application/json' \
  -d "{\"query\":\"{Aggregate{$1{meta{count}}}}\"}" | grep -o '"count":[0-9]*' | grep -o '[0-9]*'; }
NF=$(count FoundObject); NL=$(count LostObject)
echo "  FoundObject: ${NF:-?} (esperado $EXPECTED_FOUND) · LostObject: ${NL:-?} (esperado $EXPECTED_LOST)"
[ "${NF:-0}" = "$EXPECTED_FOUND" ] && [ "${NL:-0}" = "$EXPECTED_LOST" ] \
  || fail "los conteos en Weaviate no coinciden con lo esperado"

# Sin categoría el objeto queda invisible para la búsqueda (el filtro es por categoría dura).
cats() { curl -s "$W/v1/graphql" -H 'Content-Type: application/json' \
  -d "{\"query\":\"{Get{$1(limit:50){category}}}\"}" | grep -o '"category":"[^\"]*"' | grep -vc '"category":""'; }
CF=$(cats FoundObject); CL=$(cats LostObject)
[ "${CF:-0}" = "$EXPECTED_FOUND" ] && [ "${CL:-0}" = "$EXPECTED_LOST" ] \
  || fail "faltan categorías (encontrados: ${CF:-0}/$EXPECTED_FOUND · búsquedas: ${CL:-0}/$EXPECTED_LOST)"
echo "  OK   los 15 objetos tienen categoría"

# Los dos vectores tienen que haber viajado: sin ellos la búsqueda no devuelve nada y el síntoma
# (lista vacía) es idéntico al de un problema de matching.
V=$(curl -s "$W/v1/objects?class=FoundObject&limit=1&include=vector" \
  | python -c 'import json,sys; v=(json.load(sys.stdin)["objects"][0]).get("vectors",{}); print("%d/%d"%(len(v.get("image",[])),len(v.get("text",[]))))' 2>/dev/null)
[ "$V" = "512/1536" ] || fail "los vectores no se cargaron bien (image/text = ${V:-vacío}, esperado 512/1536)"
echo "  OK   vectores image(512) + text(1536)"

echo
echo "SEED OK — entorno listo para probar la búsqueda (las fotos ya están en S3)."
