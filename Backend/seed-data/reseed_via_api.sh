#!/usr/bin/env bash
# EU-325 part B — reseed vía API real (CLIP + clasificación + S3 + normalización).
#
# FUNCIONA (probado 2026-07-25): con backend arriba (:8080, perfil local) + MySQL + Weaviate + CLIP,
# carga los 10 found + 5 lost del inventario aprobado (§9-ter). Cada POST devolvió 200 y persistió
# ambos named vectors (image 512 / text 1536) + categoría por IA.
#
# ANTES de correr: limpiar Weaviate dropeando+recreando FoundObject/LostObject (NO batch-delete: crashea
# 1.24.1). Ver el bloque de recreación en §9-quater del tracker.
#
# GOTCHAS resueltos:
#  - git-bash MANGLEA el `;type=image/jpeg` de curl -F -> curl (26). Se omite; curl infiere image/jpeg del .jpg.
#  - Descripciones SIN tildes a propósito (evita mojibake por encoding en git-bash). El vector se normaliza
#    igual (TextNormalizer quita tildes); lo persistido es demo, sólo el DNI 40.682.351/40682351 importa como
#    prueba de normalización. Si se quiere persistir con tildes, mandar UTF-8 real por otro medio.
set -u
API=http://localhost:8080
PHOTOS=/c/Users/Facundo/Documents/Repositorios/Eurekapp/Backend/seed-data/photos
PW='Eurekapp1!'

login() { curl -s -X POST "$API/login" -H 'Content-Type: application/json' \
  -d "{\"username\":\"$1\",\"password\":\"$PW\"}" | grep -o '"token":"[^"]*"' | sed 's/"token":"//;s/"//'; }

TOK_ORG1=$(login owner.utn@eurekapp.com)
TOK_ORG2=$(login owner.term@eurekapp.com)
TOK_ORG3=$(login emp1.aero@eurekapp.com)
TOK_JULIA=$(login julia@mail.com)
TOK_PEDRO=$(login pedro@mail.com)
TOK_VALERIA=$(login valeria@mail.com)
for v in ORG1 ORG2 ORG3 JULIA PEDRO VALERIA; do
  eval t=\$TOK_$v; [ -z "$t" ] && { echo "LOGIN FAIL: $v"; exit 1; }
done
echo "logins OK"

# Modelo de organizacion/coordenadas (§9-quinquies del tracker):
#  - HALLAZGO: la organizacion siempre esta (quien recepta y custodia). Las coordenadas son la SEÑAL de
#    donde se encontro: SIN coordenadas = se encontro dentro de la sede (hereda las de la org);
#    CON coordenadas = se encontro en via publica, en ese punto.
#  - BUSQUEDA: puede ir sin organizacion; las coordenadas son el punto de perdida.
# En ambas funciones, pasar "-" en lat/lon/org omite ese campo del multipart.

# post_found <token> <org> <uuid> <found_date> <lat|-> <lon|-> <title> <desc>
post_found() {
  local tok=$1 org=$2 uuid=$3 fd=$4 lat=$5 lon=$6 title=$7 desc=$8
  local geo=()
  [ "$lat" != "-" ] && geo=(-F "latitude=$lat" -F "longitude=$lon")
  local code=$(curl -s -o /tmp/rf.json -w '%{http_code}' -X POST "$API/found-objects/organizations/$org" \
    -H "Authorization: Bearer $tok" \
    -F "file=@$PHOTOS/$uuid.jpg" \
    -F "title=$title" -F "detailed_description=$desc" \
    -F "found_date=$fd" ${geo[@]+"${geo[@]}"})
  local cat=$(grep -o '"category":"[^"]*"' /tmp/rf.json | head -1)
  echo "FOUND $uuid org$org geo=${lat} -> $code  $cat"
}

# post_lost <token> <org|-> <uuid> <lost_date> <lat|-> <lon|-> <desc>
post_lost() {
  local tok=$1 org=$2 uuid=$3 ld=$4 lat=$5 lon=$6 desc=$7
  local extra=()
  [ "$lat" != "-" ] && extra+=(-F "latitude=$lat" -F "longitude=$lon")
  [ "$org" != "-" ] && extra+=(-F "organization_id=$org")
  local code=$(curl -s -o /tmp/rl.json -w '%{http_code}' -X POST "$API/lost-objects" \
    -H "Authorization: Bearer $tok" \
    -F "file=@$PHOTOS/$uuid.jpg" \
    -F "description=$desc" -F "lost_date=$ld" ${extra[@]+"${extra[@]}"})
  local cat=$(grep -o '"category":"[^"]*"' /tmp/rl.json | head -1)
  echo "LOST  $uuid org$org -> $code  $cat"
}

echo "=== FOUND (con par) ==="
# Dentro de la sede -> sin coordenadas (las hereda de la org).
post_found "$TOK_ORG1" 1 7ea43eba-7343-4cd8-b5d0-b736e3d575a3 2026-04-28T10:00:00 - - "Billetera de cuero marron" "Billetera de cuero marron con costuras en zigzag. Adentro tiene el DNI 40.682.351 a nombre de Martin Gomez, una tarjeta de debito Visa del Banco Nacion y algo de efectivo"
# Via publica: plazoleta junto a la terminal (lo recepta la Terminal, org 2).
post_found "$TOK_ORG2" 2 25e71dcb-9d0d-4b75-96f2-df60b7d99261 2026-05-05T10:00:00 -31.42118 -64.18760 "Auriculares inalambricos blancos" "Auriculares over-ear blancos, marca Sony modelo WH-1000XM4. Estaban tirados en un banco de la plazoleta"
# Via publica: vereda de Velez Sarsfield frente a la UTN (lo recepta la UTN, org 1).
post_found "$TOK_ORG1" 1 494ddbc4-b4d8-4935-a77c-1d3e7363b67d 2026-05-07T10:00:00 -31.43943 -64.18451 "Mochila azul con libros" "Mochila azul mediana marca Jansport, con varios libros de ingenieria y un estuche adentro. Estaba apoyada contra un arbol en la vereda"
post_found "$TOK_ORG1" 1 4b43a1d8-1491-4077-9c1c-463e5906cdeb 2026-04-15T10:00:00 - - "Paraguas negro plegable" "Paraguas negro plegable compacto, sin marca visible"
post_found "$TOK_ORG2" 2 85c55156-216f-4b6c-aa65-782e066567b6 2026-04-25T10:00:00 - - "Notebook Dell gris" "Notebook Dell Inspiron 15 gris, con la tapa de aluminio y el logo en el centro"

echo "=== FOUND (distractores) ==="
post_found "$TOK_ORG1" 1 df2aa6a0-d15c-46e8-902a-e5394538a43e 2026-05-02T10:00:00 - - "Llave con llavero azul" "Llave tipo Yale suelta con llavero de goma azul"
post_found "$TOK_ORG3" 3 18da5796-50dc-4383-8b1f-27e524b04b5d 2026-05-09T10:00:00 - - "Celular Samsung negro" "Celular Samsung Galaxy S21 negro con pantalla rota y funda gris"
post_found "$TOK_ORG2" 2 ebaa9336-e9fd-4556-a96e-9c1538d165cb 2026-05-12T10:00:00 - - "Billetera marron con DNI" "Billetera marron de cuero con DNI 33.145.892 a nombre de Laura Fernandez y tarjetas bancarias"
post_found "$TOK_ORG3" 3 498d742e-49e6-4c88-bf8d-f0313581dfaa 2026-05-14T10:00:00 - - "Cargador USB-C blanco" "Cargador USB-C blanco de 20W marca Samsung con cable incluido"
post_found "$TOK_ORG1" 1 a1047f2f-0fcd-41b1-92ad-485dd04cb5d8 2026-05-20T10:00:00 - - "Anteojos de sol negros" "Anteojos de sol Ray-Ban con montura negra y lentes espejados"

echo "=== LOST (busquedas) ==="
post_lost "$TOK_JULIA"   1 ea9f4057-4f1d-4daf-aeca-c6162fe9aeb6 2026-04-29T08:00:00 -31.4377 -64.1829 "Perdi mi billetera de cuero marron cerca de la facultad. Adentro esta mi DNI 40682351 a nombre de Martin Gomez y una tarjeta de debito Visa"
# Perdidos en via publica -> sin organizacion, solo el punto de perdida (a ~74 m y ~36 m del hallazgo).
post_lost "$TOK_PEDRO"   - 771c2c2b-4dd2-45e4-977b-3a2186e86b6e 2026-05-06T08:00:00 -31.42160 -64.18700 "Se me cayeron unos auriculares blancos Sony WH 1000XM4 caminando por la plaza, cerca de la terminal"
post_lost "$TOK_VALERIA" - 8ec5ebe1-5b65-412a-9cda-576f42401e35 2026-05-08T08:00:00 -31.43910 -64.18450 "Perdi una mochila azul Jansport con libros de ingenieria en la vereda de Velez Sarsfield"
post_lost "$TOK_JULIA"   1 26f82583-f553-40a1-a1b8-3775c384971f 2026-04-16T08:00:00 -31.4377 -64.1829 "Se me olvido mi paraguas negro plegable en el aula magna de la UTN"
post_lost "$TOK_VALERIA" 2 56d511e3-899b-41cf-9f2c-a811437b0b28 2026-04-26T08:00:00 -31.4201 -64.1888 "Olvide mi notebook Dell Inspiron 15 gris en la sala de espera de la terminal"

echo "=== DONE ==="
