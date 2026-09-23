#!/usr/bin/env python3
"""
EU-410 - Constructor del juego de datos de prueba definitivo.

Parte del snapshot del rework de busqueda (10 objetos encontrados + 5 busquedas, con sus dos
vectores nombrados ya congelados) y le agrega los objetos encontrados que hacen falta para que
cada devolucion del seed apunte a un objeto distinto y propio.

COMO SE FABRICA UN OBJETO NUEVO (y por que no hace falta ni CLIP ni el backend):
  - La FOTO se reusa: es la misma foto de un objeto que ya esta en el juego, copiada con el nombre
    del objeto nuevo (el nombre del archivo en S3 ES el uuid del objeto, por eso cada objeto
    necesita su propia copia).
  - El VECTOR DE IMAGEN se copia tal cual del objeto de origen: misma foto, mismo vector. Volver a
    pedirselo a CLIP daria exactamente lo mismo.
  - La CATEGORIA se copia del objeto de origen, por el mismo motivo: la decide el clasificador
    sobre la foto, y la foto no cambio.
  - El VECTOR DE TEXTO si se calcula de nuevo, porque el titulo y la descripcion cambian. Se arma
    con el mismo texto que arma el backend al dar de alta un objeto encontrado
    (descripcion + " " + titulo) y con el mismo modelo de embeddings.

Uso:  python Backend/seed-data/build_dataset.py
Requiere: OPENAI_SECRET_KEY en el entorno (o en Backend/.env.local).
Salida:   sobrescribe snapshot/FoundObject.ndjson y copia las fotos que falten a photos/.
          No borra nada. Es idempotente.
"""

import json
import os
import shutil
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
SNAP = os.path.join(HERE, "snapshot")
PHOTOS = os.path.join(HERE, "photos")
OPENAI_URL = "https://api.openai.com/v1/embeddings"
OPENAI_MODEL = "text-embedding-3-small"

# -- De que archivo de foto salio cada objeto del snapshot ---------------------
# El bootstrap por API subio las fotos de photos/<uuid-viejo>.jpg y Weaviate les dio un uuid nuevo.
# Esta tabla es ese puente, y es la que permite que cada objeto tenga su copia de la foto.
PHOTO_OF = {
    # FoundObject del snapshot -> archivo de foto
    "dcfc219a-8142-4a2f-9344-d2521889689d": "4b43a1d8-1491-4077-9c1c-463e5906cdeb",  # paraguas
    "2121ffa9-8773-4c23-a5ef-f3d393def659": "85c55156-216f-4b6c-aa65-782e066567b6",  # notebook
    "96c3a201-7251-45c2-b442-2102a98fb474": "7ea43eba-7343-4cd8-b5d0-b736e3d575a3",  # billetera cuero
    "5fe28eaf-8994-44aa-bf2f-15f2e3691cae": "df2aa6a0-d15c-46e8-902a-e5394538a43e",  # llave
    "05e3b579-30c2-47fc-8bd4-e90dab97c498": "25e71dcb-9d0d-4b75-96f2-df60b7d99261",  # auriculares
    "b0a4573c-2db6-4858-9ac9-bb314769e445": "494ddbc4-b4d8-4935-a77c-1d3e7363b67d",  # mochila
    "77965d32-7ba3-4497-8471-3d94f7acd5cd": "18da5796-50dc-4383-8b1f-27e524b04b5d",  # celular
    "d5937d67-e758-4e53-9ae4-844803027bdb": "ebaa9336-e9fd-4556-a96e-9c1538d165cb",  # billetera DNI
    "0412e370-c1a5-442d-b740-4fd9cfda59be": "498d742e-49e6-4c88-bf8d-f0313581dfaa",  # cargador
    "2c817a63-1027-48c3-bb95-c24d73022f33": "a1047f2f-0fcd-41b1-92ad-485dd04cb5d8",  # anteojos
    # LostObject del snapshot -> archivo de foto
    "8044d799-77b3-4326-bb3f-f6a0ad195f94": "26f82583-f553-40a1-a1b8-3775c384971f",  # paraguas
    "9970bf61-92c7-47be-a120-41424bdc1320": "56d511e3-899b-41cf-9f2c-a811437b0b28",  # notebook
    "aeaac6e1-893c-4f49-af6e-f43f62f6d71f": "ea9f4057-4f1d-4daf-aeca-c6162fe9aeb6",  # billetera
    "56fcd220-9532-45d9-beee-1253f5846677": "771c2c2b-4dd2-45e4-977b-3a2186e86b6e",  # auriculares
    "8645d88c-529c-496c-a213-f768892dd2ad": "8ec5ebe1-5b65-412a-9cda-576f42401e35",  # mochila
}

# Coordenadas de cada organizacion (mismas que siembra seed-local.sh).
ORG_COORDS = {
    "1": (-31.4377, -64.1829),   # UTN FRC
    "2": (-31.4201, -64.1888),   # Terminal de Omnibus
    "3": (-31.3233, -64.2081),   # Aeropuerto
    "4": (-31.4163, -64.1885),   # Patio Olmos
    "5": (-31.4384, -64.1917),   # UNC Ciudad Universitaria
    "6": (-31.3693, -64.2254),   # Dinosaurio Mall
}

# -- Objetos encontrados nuevos -----------------------------------------------
# "src" es el objeto del snapshot cuya foto (y por lo tanto su vector de imagen y su categoria) se
# reusa. Todo lo demas -fecha, sede, titulo y descripcion- es propio.
# (id, src, organizacion, fecha, finder, titulo, descripcion)
NEW_OBJECTS = [
    ("c1000001-0000-4000-8000-000000000001", "05e3b579-30c2-47fc-8bd4-e90dab97c498", "2", "2026-04-12T16:00:00Z", "0",
     "Auriculares over-ear blancos",
     "Auriculares over-ear blancos sin cables, olvidados en la sala de espera de la terminal"),
    ("c1000002-0000-4000-8000-000000000002", "2c817a63-1027-48c3-bb95-c24d73022f33", "4", "2026-04-19T18:00:00Z", "0",
     "Anteojos de sol con montura negra",
     "Anteojos de sol de montura negra y lentes espejados, encontrados en el patio de comidas"),
    ("c1000003-0000-4000-8000-000000000003", "0412e370-c1a5-442d-b740-4fd9cfda59be", "5", "2026-04-26T10:00:00Z", "0",
     "Cargador USB-C blanco",
     "Cargador USB-C blanco con su cable, encontrado en un aula del pabellon Argentina"),
    ("c1000004-0000-4000-8000-000000000004", "dcfc219a-8142-4a2f-9344-d2521889689d", "1", "2026-05-18T09:00:00Z", "0",
     "Paraguas negro plegable",
     "Paraguas negro plegable compacto olvidado en el hall del pabellon central"),
    ("c1000005-0000-4000-8000-000000000005", "b0a4573c-2db6-4858-9ac9-bb314769e445", "6", "2026-05-28T12:00:00Z", "0",
     "Mochila azul mediana",
     "Mochila azul mediana con utiles adentro, encontrada en el estacionamiento del shopping"),
    ("c1000006-0000-4000-8000-000000000006", "2121ffa9-8773-4c23-a5ef-f3d393def659", "1", "2026-06-21T15:00:00Z", "0",
     "Notebook gris de 15 pulgadas",
     "Notebook gris de 15 pulgadas con la tapa de aluminio, olvidada en la sala de lectura"),
    ("c1000007-0000-4000-8000-000000000007", "d5937d67-e758-4e53-9ae4-844803027bdb", "4", "2026-07-01T11:00:00Z", "12",
     "Billetera marron con documentos",
     "Billetera marron de cuero con documentos y tarjetas, encontrada en la caja de un local"),
    ("c1000008-0000-4000-8000-000000000008", "77965d32-7ba3-4497-8471-3d94f7acd5cd", "4", "2026-07-09T19:00:00Z", "12",
     "Celular Samsung negro",
     "Celular Samsung negro con la pantalla rota y funda gris, encontrado en la escalera mecanica"),
    ("c1000009-0000-4000-8000-000000000009", "2121ffa9-8773-4c23-a5ef-f3d393def659", "4", "2026-07-20T14:00:00Z", "12",
     "Notebook Dell gris",
     "Notebook Dell gris con stickers en la tapa, olvidada en el area de coworking del shopping"),
    ("c1000010-0000-4000-8000-000000000010", "2c817a63-1027-48c3-bb95-c24d73022f33", "5", "2026-08-02T10:00:00Z", "0",
     "Anteojos de sol negros",
     "Anteojos de sol con montura negra y lentes espejados, encontrados en el anfiteatro"),
    ("c1000011-0000-4000-8000-000000000011", "77965d32-7ba3-4497-8471-3d94f7acd5cd", "6", "2026-08-05T18:00:00Z", "0",
     "Celular negro con funda gris",
     "Celular negro con funda gris y la pantalla rajada, encontrado en la zona de juegos"),
    ("c1000012-0000-4000-8000-000000000012", "0412e370-c1a5-442d-b740-4fd9cfda59be", "6", "2026-08-13T16:00:00Z", "0",
     "Cargador de celular blanco",
     "Cargador blanco de 20W con cable USB-C, encontrado en el patio de comidas del shopping"),
    ("c1000013-0000-4000-8000-000000000013", "d5937d67-e758-4e53-9ae4-844803027bdb", "6", "2026-08-21T12:00:00Z", "0",
     "Billetera de cuero con documentos",
     "Billetera de cuero marron con documentos adentro, encontrada en el estacionamiento"),
    ("c1000014-0000-4000-8000-000000000014", "b0a4573c-2db6-4858-9ac9-bb314769e445", "4", "2026-08-24T09:00:00Z", "12",
     "Mochila azul con apuntes",
     "Mochila azul mediana con apuntes y un estuche, encontrada en el area de descanso"),
    ("c1000015-0000-4000-8000-000000000015", "5fe28eaf-8994-44aa-bf2f-15f2e3691cae", "1", "2026-08-28T11:00:00Z", "0",
     "Llave con llavero de goma azul",
     "Llave tipo Yale con llavero de goma azul, encontrada en el laboratorio de sistemas"),
    ("c1000016-0000-4000-8000-000000000016", "05e3b579-30c2-47fc-8bd4-e90dab97c498", "4", "2026-08-31T20:00:00Z", "12",
     "Auriculares inalambricos blancos",
     "Auriculares inalambricos blancos over-ear, encontrados en la butaca de un cine"),
    ("c1000017-0000-4000-8000-000000000017", "dcfc219a-8142-4a2f-9344-d2521889689d", "2", "2026-09-04T17:00:00Z", "0",
     "Paraguas negro compacto",
     "Paraguas negro compacto olvidado en el anden 12 de la terminal un dia de lluvia"),
    ("c1000018-0000-4000-8000-000000000018", "96c3a201-7251-45c2-b442-2102a98fb474", "4", "2026-09-06T13:00:00Z", "12",
     "Billetera de cuero marron",
     "Billetera de cuero marron con costuras en zigzag, encontrada en el patio de comidas"),
    ("c1000019-0000-4000-8000-000000000019", "5fe28eaf-8994-44aa-bf2f-15f2e3691cae", "4", "2026-09-11T11:00:00Z", "0",
     "Juego de llaves con llavero azul",
     "Llave suelta con llavero de goma azul, encontrada en los banos del primer piso"),
    # Los dos ultimos NO se devuelven: suman volumen a la busqueda sin competir
    # con los cinco objetos que forman pareja con una busqueda guardada.
    ("c1000020-0000-4000-8000-000000000020", "5fe28eaf-8994-44aa-bf2f-15f2e3691cae", "6", "2026-08-30T15:00:00Z", "0",
     "Llave con llavero azul de goma",
     "Llave tipo Yale con llavero de goma azul, encontrada en la entrada norte del shopping"),
    ("c1000021-0000-4000-8000-000000000021", "0412e370-c1a5-442d-b740-4fd9cfda59be", "5", "2026-09-05T11:00:00Z", "0",
     "Cargador USB-C blanco de 20W",
     "Cargador USB-C blanco de 20W sin cable, encontrado en un aula del pabellon Mecanica"),
]


# -- Quien encontro cada uno de los diez objetos originales ---------------------
# Hasta EU-410 esto vivia solo en seed-local.sh, que lo aplicaba despues de cargar. Eran dos lados
# que podian desincronizarse, que es exactamente como se rompio el juego de datos anterior. Ahora
# el archivo ya sale con el dato adentro y hay un solo lugar donde mirarlo. "0" es sin cuenta.
FINDERS = {
    "dcfc219a-8142-4a2f-9344-d2521889689d": "5",   # paraguas    -> Lucia Perez (empleada UTN)
    "2121ffa9-8773-4c23-a5ef-f3d393def659": "8",   # notebook    -> Pedro
    "96c3a201-7251-45c2-b442-2102a98fb474": "9",   # billetera   -> Valeria
    "5fe28eaf-8994-44aa-bf2f-15f2e3691cae": "0",   # llave       -> sin cuenta
    "05e3b579-30c2-47fc-8bd4-e90dab97c498": "9",   # auriculares -> Valeria
    "b0a4573c-2db6-4858-9ac9-bb314769e445": "6",   # mochila     -> Tomas Ramirez (empleado UTN)
    "77965d32-7ba3-4497-8471-3d94f7acd5cd": "8",   # celular     -> Pedro
    "d5937d67-e758-4e53-9ae4-844803027bdb": "7",   # billeteraDNI-> Julia
    "0412e370-c1a5-442d-b740-4fd9cfda59be": "7",   # cargador    -> Julia
    "2c817a63-1027-48c3-bb95-c24d73022f33": "4",   # anteojos    -> Carlos Mendoza (encargado UTN)
}

# -- Objetos que se devolvieron -------------------------------------------------
# Tiene que coincidir exactamente con las devoluciones que siembra seed-local.sh: un objeto marcado
# como devuelto sin su devolucion detras, o al reves, es la clase de inconsistencia que este ticket
# vino a sacar. Un objeto devuelto desaparece de la busqueda, asi que los cinco que forman pareja
# con una busqueda guardada NO estan en esta lista, ni los dos ultimos agregados.
RETURNED = (
    ["5fe28eaf-8994-44aa-bf2f-15f2e3691cae",   # llave
     "77965d32-7ba3-4497-8471-3d94f7acd5cd",   # celular
     "d5937d67-e758-4e53-9ae4-844803027bdb",   # billetera con DNI
     "0412e370-c1a5-442d-b740-4fd9cfda59be",   # cargador
     "2c817a63-1027-48c3-bb95-c24d73022f33"]   # anteojos
    + ["c10000%02d-0000-4000-8000-0000000000%02d" % (i, i) for i in range(1, 20)]
)


def openai_key():
    key = os.environ.get("OPENAI_SECRET_KEY", "")
    if key:
        return key
    env = os.path.join(os.path.dirname(HERE), ".env.local")
    if os.path.isfile(env):
        for line in open(env, encoding="utf-8"):
            if line.startswith("OPENAI_SECRET_KEY="):
                return line.split("=", 1)[1].strip()
    sys.exit("[ERROR] Falta OPENAI_SECRET_KEY (entorno o Backend/.env.local)")


def text_vector(text, key):
    body = json.dumps({"model": OPENAI_MODEL, "input": text}).encode()
    req = urllib.request.Request(OPENAI_URL, data=body, headers={
        "Authorization": "Bearer " + key, "Content-Type": "application/json"})
    raw = json.loads(urllib.request.urlopen(req, timeout=60).read())["data"][0]["embedding"]
    # Se redondea a 8 decimales. No cambia en nada la similitud (la diferencia esta muy por debajo
    # de lo que distingue una comparacion de vectores) y deja las lineas del archivo del mismo
    # tamano que las de los objetos que ya estaban, que es lo que el seed sabe cargar.
    return [round(v, 8) for v in raw]


def read_ndjson(name):
    with open(os.path.join(SNAP, name), encoding="utf-8") as fh:
        return [json.loads(l) for l in fh if l.strip()]


def copy_photos(pairs):
    """Cada objeto necesita su propia copia de la foto: el nombre del archivo es su uuid."""
    copied = 0
    for obj_id, source_id in pairs:
        dest = os.path.join(PHOTOS, obj_id + ".jpg")
        src = os.path.join(PHOTOS, source_id + ".jpg")
        if os.path.isfile(dest):
            continue
        if not os.path.isfile(src):
            sys.exit("[ERROR] Falta la foto de origen %s" % src)
        shutil.copyfile(src, dest)
        copied += 1
    return copied


def main():
    key = openai_key()
    found = read_ndjson("FoundObject.ndjson")
    lost = read_ndjson("LostObject.ndjson")
    base = {o["id"]: o for o in found}

    # Los objetos que ya existian no se tocan; solo se agregan los que faltan.
    nuevos = []
    for obj_id, src_id, org, fecha, finder, titulo, desc in NEW_OBJECTS:
        if obj_id in base:
            continue
        src = base[src_id]
        lat, lon = ORG_COORDS[org]
        print("  nuevo: %-36s <- foto de %s" % (titulo, src["properties"]["title"]))
        nuevos.append({
            "class": "FoundObject",
            "id": obj_id,
            "properties": {
                "category": src["properties"]["category"],
                "coordinates": {"latitude": lat, "longitude": lon},
                "found_date": fecha,
                "human_description": desc,
                "object_finder_user_id": finder,
                "organization_id": org,
                "title": titulo,
                "was_returned": False,
            },
            "vectors": {
                "image": src["vectors"]["image"],          # misma foto, mismo vector
                "text": text_vector(desc + " " + titulo, key),
            },
        })

    todos = found + nuevos
    # Quien encontro el objeto y si ya se devolvio quedan escritos en el archivo, no aplicados
    # despues por el seed.
    devueltos = set(RETURNED)
    for o in todos:
        if o["id"] in FINDERS:
            o["properties"]["object_finder_user_id"] = FINDERS[o["id"]]
        o["properties"]["was_returned"] = o["id"] in devueltos
    faltan = devueltos - {o["id"] for o in todos}
    if faltan:
        sys.exit("[ERROR] Hay devoluciones sobre objetos que no existen: %s" % ", ".join(faltan))
    todos.sort(key=lambda o: o["properties"].get("found_date", ""))
    with open(os.path.join(SNAP, "FoundObject.ndjson"), "w", encoding="utf-8") as fh:
        for o in todos:
            fh.write(json.dumps(o, ensure_ascii=False, sort_keys=True) + "\n")

    # Fotos: las de los objetos del snapshot (que hoy viven bajo el nombre viejo) y las copias de
    # los objetos nuevos.
    pairs = list(PHOTO_OF.items())
    pairs += [(o[0], PHOTO_OF[o[1]]) for o in NEW_OBJECTS]
    copiadas = copy_photos(pairs)

    print("")
    print("FoundObject.ndjson: %d objetos (%d nuevos, %d devueltos, %d a la vista de la busqueda)"
          % (len(todos), len(nuevos), len(devueltos), len(todos) - len(devueltos)))
    print("LostObject.ndjson:  %d objetos (sin cambios)" % len(lost))
    print("fotos copiadas:     %d" % copiadas)


if __name__ == "__main__":
    main()
