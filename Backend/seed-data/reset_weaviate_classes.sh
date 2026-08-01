#!/usr/bin/env bash
# EU-325 — deja FoundObject/LostObject VACÍAS y con el esquema de named vectors (image+text).
#
# POR QUÉ DROP+RECREATE Y NO BORRAR OBJETOS: borrar todos los objetos de una clase con
# `DELETE /v1/batch/objects` (filtro match-all) CRASHEA Weaviate 1.24.1
# (`panic: findNewLocalEntrypoint called on an empty hnsw graph`, al vaciar el grafo HNSW).
#
# El JSON de cada clase es el mismo de `Backend/start-local.sh` §158-195: si se toca allá, tocar acá.
# Uso: bash Backend/seed-data/reset_weaviate_classes.sh   (con Weaviate arriba en :8081)
# Después: backend arriba + `bash Backend/seed-data/reseed_via_api.sh`.
set -u
W=http://localhost:8081
for C in FoundObject LostObject; do
  echo -n "drop $C: "; curl -s -o /dev/null -w '%{http_code}\n' -X DELETE "$W/v1/schema/$C"
done

post_class() {
  echo -n "create $1: "
  curl -s -o /tmp/wsch.json -w '%{http_code}\n' -X POST "$W/v1/schema" -H 'Content-Type: application/json' -d "$2"
}

post_class FoundObject '{
  "class": "FoundObject",
  "description": "Clase para representar objetos encontrados.",
  "vectorConfig": {
    "image": { "vectorizer": { "none": {} }, "vectorIndexType": "hnsw", "vectorIndexConfig": { "distance": "cosine" } },
    "text":  { "vectorizer": { "none": {} }, "vectorIndexType": "hnsw", "vectorIndexConfig": { "distance": "cosine" } }
  },
  "properties": [
    { "name": "found_date",        "dataType": ["date"] },
    { "name": "title",             "dataType": ["string"] },
    { "name": "human_description", "dataType": ["string"] },
    { "name": "organization_id",   "dataType": ["text"] },
    { "name": "coordinates",            "dataType": ["geoCoordinates"] },
    { "name": "was_returned",           "dataType": ["boolean"] },
    { "name": "object_finder_user_id",  "dataType": ["text"] },
    { "name": "category",               "dataType": ["text"] }
  ]
}'

post_class LostObject '{
  "class": "LostObject",
  "description": "Clase para representar busquedas abiertas de un objeto perdido.",
  "vectorConfig": {
    "image": { "vectorizer": { "none": {} }, "vectorIndexType": "hnsw", "vectorIndexConfig": { "distance": "cosine" } },
    "text":  { "vectorizer": { "none": {} }, "vectorIndexType": "hnsw", "vectorIndexConfig": { "distance": "cosine" } }
  },
  "properties": [
    { "name": "lost_date",       "dataType": ["date"] },
    { "name": "description",     "dataType": ["string"] },
    { "name": "username",        "dataType": ["string"] },
    { "name": "organization_id", "dataType": ["text"] },
    { "name": "coordinates",     "dataType": ["geoCoordinates"] },
    { "name": "status",          "dataType": ["text"] },
    { "name": "closed_date",     "dataType": ["date"] },
    { "name": "recovered",       "dataType": ["boolean"] },
    { "name": "category",        "dataType": ["text"] }
  ]
}'

for C in FoundObject LostObject; do
  echo -n "$C count: "
  curl -s "$W/v1/graphql" -H 'Content-Type: application/json' -d "{\"query\":\"{Aggregate{$C{meta{count}}}}\"}"
  echo
done
