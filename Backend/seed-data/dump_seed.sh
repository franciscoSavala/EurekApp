#!/usr/bin/env bash
# EU-325 — BOOTSTRAP (se corre a mano, casi nunca): congela el estado actual de Weaviate en
# snapshot/*.ndjson, que es lo que después carga `seed.sh` en cada máquina.
#
# POR QUE EXISTE ESTE PASO INTERMEDIO:
#   La carga por API (`reseed_via_api.sh`) es la que garantiza que los datos cumplan las reglas de
#   negocio y la que SUBE LAS FOTOS A S3. Pero el nombre del archivo en S3 es el UUID que Weaviate
#   le asigna al objeto, y ese UUID cambia en cada corrida: volver a cargar por API significaría
#   volver a subir las 15 fotos y dejar las anteriores huérfanas en el bucket.
#   Por eso la API se usa UNA vez (bootstrap) y acá se congelan UUIDs + vectores + propiedades.
#   A partir de ahí `seed.sh` inyecta directo a Weaviate, sin tocar S3 ni gastar CLIP/OpenAI.
#
# CUANDO HAY QUE VOLVER A CORRERLO: sólo si cambian los datos del seed (otra foto, otro texto, otro
# objeto) o el esquema. Receta: backend arriba -> reset_weaviate_classes.sh -> reseed_via_api.sh ->
# validar los matches -> dump_seed.sh -> commitear snapshot/.
#
# Uso: bash Backend/seed-data/dump_seed.sh   (con Weaviate arriba en :8081 y el seed cargado)
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
W=http://localhost:8081
OUT="$HERE/snapshot"
mkdir -p "$OUT"

for C in FoundObject LostObject; do
  curl -s "$W/v1/objects?class=$C&limit=200&include=vector" \
    | python -c '
import json, sys
objs = json.load(sys.stdin).get("objects") or []
if not objs:
    sys.exit("sin objetos: cargar el seed antes de volcarlo")
# Orden estable por fecha para que el diff del snapshot sea legible entre corridas.
def key(o):
    p = o["properties"]
    return p.get("found_date") or p.get("lost_date") or ""
for o in sorted(objs, key=key):
    print(json.dumps({
        "id": o["id"],
        "class": o["class"],
        "properties": o["properties"],
        "vectors": o["vectors"],
    }, ensure_ascii=False, sort_keys=True))
' > "$OUT/$C.ndjson" || { echo "FALLO el volcado de $C"; exit 1; }
  echo "$C -> $(wc -l < "$OUT/$C.ndjson") objetos ($(du -h "$OUT/$C.ndjson" | cut -f1))"
done

echo "snapshot en $OUT — commitearlo para que el resto lo cargue con seed.sh"
