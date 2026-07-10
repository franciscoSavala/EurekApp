# Rework: Algoritmo de búsqueda (matching visual + texto)

Documento de contexto y seguimiento para el reemplazo del algoritmo de matching actual
por uno de **búsqueda reversa**: similitud visual (imagen→vector) + textual, con filtro
duro por categoría y modulación geográfica. Objetivo central: mejorar precisión y
**reducir notificaciones impertinentes** sobre búsquedas guardadas.

> Independiente del rework de fraude+reclamos ([REWORK-FRAUDE-RECLAMOS.md](REWORK-FRAUDE-RECLAMOS.md)).
> Cubierto por la PoC local `poc-reverse-search/` (experimento, no versionado).

Jira: **EU-320** (Story, epic EU-5 "Búsqueda de objetos perdidos", 5 puntos, asignada a Facundo).

---

## 1. Decisiones de diseño (cerradas en PoC)

1. **Dos vectores por objeto en Weaviate** (FoundObject y LostObject):
   - **Imagen:** foto → vector directo (sin pasar por texto), modelo CLIP. Se vectoriza la
     imagen **completa**: en la PoC el center-crop (para enfocar el objeto e ignorar el fondo)
     no mejoró el matching —dio igual o levemente peor—, coherente con que CLIP fue entrenado
     con imágenes completas. El recorte queda **comentado** en el micro como red de seguridad
     (descomentar y recalibrar sólo si el matching real flojea con fondos muy dominantes).
   - **Texto:** FoundObject = título + descripción del usuario; LostObject = descripción
     del usuario.
2. **Eliminar la descripción generada por IA** (no aporta: inferior al vector de imagen en
   lo visual e inferior al texto humano en lo no-visible).
3. **Foto obligatoria en la búsqueda** (si no hay, instar a buscar una imagen representativa
   en internet).
4. **Score combinado:** `score = α · sim_imagen + β · sim_texto`, con **α/β por categoría**:
   - Billetera/credenciales → texto pesa mucho.
   - Ropa → texto pesa poco (puede ensuciar).
   - Celular y llaves → ~50/50.
   - Otros → 50/50 por defecto.
5. **Categorías duras pero abarcativas como filtro previo** (definidas por IA desde la
   imagen, NO elegidas por el usuario, fronteras 0-ambiguas). Nunca se compara ni notifica
   entre categorías distintas:
   - **Ropa:** todo lo que se usa para vestirse (zapatillas y sweater sí; anteojos no).
   - **Billetera/tarjetas:** billetera + lo importante que se guarda (DNI, licencia, boleto
     estudiantil; no un papelito de recuerdo).
   - **Llaves.**
   - **Celular.**
   - **Otros / misceláneos.**
6. **Geo-temporal:** radio + fecha como filtro duro; geoScore (mayor cuanto más cerca)
   **escala** la suma (sim_imagen + sim_texto) dentro del radio.
7. **Umbral:** se conserva el mínimo (hoy MIN_SCORE = 0.75) para disparar notificación de
   búsqueda guardada, complementado por el filtro duro de categoría.
8bis. **Categoría: la decide siempre la IA, el usuario la VE pero NO la edita.** La clasificación
   por IA se **muestra** al usuario (read-only) por transparencia y como red de seguridad ante un fallo
   silencioso (una categoría mal elegida vuelve al objeto invisible para las búsquedas de la categoría
   correcta, porque es un filtro duro). Si el usuario la ve mal, el recurso es **reintentar con otra
   foto** —no hay override manual—. Motivo: el filtro sólo es consistente si ambos lados (objeto
   encontrado y búsqueda) se clasifican con el MISMO criterio; como los dos pasan por el mismo modelo,
   coinciden por construcción. Un override manual de un solo lado reintroduce la inconsistencia humana
   que el diseño quiso eliminar (decisión 5). El error temido —confundir dos categorías CONCRETAS— es
   improbable: el clasificador cae en OTROS por margen top1-top2 ante la duda, así que el error típico
   es "ambiguo→OTROS" (deseado), no "billetera→celular". Se reevalúa con datos reales en EU-327.
8. **Foto de la búsqueda: se persiste sólo al guardar.** La búsqueda por foto vectoriza la
   imagen en memoria (CLIP) y **NO** la sube a S3. Recién cuando el usuario **guarda** la
   búsqueda se sube a S3 (key = uuid del `LostObject`), para poder mostrarla al ver la
   búsqueda guardada. El **front reenvía la imagen al guardar** (stateless, sin caché en el
   backend): si la búsqueda no se guarda, no hay costo de S3.

## 2. Alcance técnico (modificar lo existente, no de cero)

- **Inferencia CLIP (EU-321):** se sirve con un **microservicio Python self-hosted**
  (`clip-service/`, FastAPI + `transformers`, modelo `openai/clip-vit-base-patch32`), tercer
  contenedor en `Backend/docker-compose.yml`. El backend Java lo consume por HTTP
  (`ImageEmbeddingService` / `ClipImageEmbeddingService`, `RestClient` `clipClient`), igual que
  hoy consume el embedding de texto de OpenAI. No usa servicios externos; los pesos (~600MB) se
  cachean en un volumen. El vectorizador de **texto sigue en OpenAI** (se evaluó pasarlo a local
  y se decidió no hacerlo por ahora).
- Backend: lógica de matching/scoring (α/β por categoría, geoScore modulador, clasificación
  por IA) — FoundObjectService y alrededores. `reportLostObject` sube la foto a S3 **sólo al
  guardar** (key = uuid); `searchByPhoto` no sube nada.
- Weaviate: FoundObject y LostObject pasan a dos vectores (imagen + texto).
- Seed de la BD: regenerar objetos plantados con dos vectores + categoría.
- Frontend: form de búsqueda y de alta de objeto (foto obligatoria, sin descripción IA). Al
  guardar la búsqueda, reenviar la foto (multipart) y mostrarla en el detalle de la búsqueda
  guardada.

## 3. A calibrar durante la implementación

- Rango de distancia coseno de CLIP (recalibrar umbral). Smoke sobre fixtures con el micro real
  (EU-321): **mismo objeto** ~0.91–0.95 (billetera 3 ángulos), **objetos distintos** ~0.62–0.71,
  **similar pero no igual** (dos zapatillas Adidas distintas) ~0.75. Confirma la PoC (mismo obj ≥ 0.9),
  pero el coseno crudo vive en rango angosto (~0.62–0.95) con zona gris → el umbral hay que fijarlo
  con datos reales y apoyándose en el filtro duro por categoría (que evita comparar entre categorías).
- Valores concretos de α/β por categoría y rango del modulador geo (propuesto 0.75–1 dentro
  del radio).

## 4. Estado de tareas

Story **EU-320** (5 puntos, Sprint 14, asignada a Facundo). Subtareas:

| # | Subtarea | Jira | Horas | Estado | Nota |
|---|----------|------|-------|--------|------|
| 1 | Vectorización de imagen (CLIP, imagen completa) | EU-321 | 6 | **HECHO** | Micro Python self-hosted `clip-service/` (FastAPI+CLIP) + `ClipImageEmbeddingService` (Java, RestClient) + tests unitarios (5, verdes). Verificado end-to-end con el micro real (smoke sobre fixtures: 512-dim normalizado, mismo obj ~0.9+, distintos ~0.6-0.7). Falta cablearlo al flujo (eso es EU-324) |
| 2 | Clasificación por IA en categorías duras | EU-322 | 5 | **HECHO** | **Local, sin OpenAI**: CLIP zero-shot en el micro (`/classify`, nubes de prompts + fallback OTROS por MARGEN top1-top2, no umbral absoluto). Abstraído en Java: `ImageClassificationService` + `ClipImageClassificationService` + enum `ObjectCategory`. Smoke 9/9 sobre fixtures + tests unitarios (12 verdes). Falta cablearlo (EU-324) |
| 3 | Weaviate: dos vectores + categoría; quitar descripción IA | EU-323 | 4 | **HECHO** | **Named vectors** (`image`+`text`, vectorizer none, coseno) en FoundObject y LostObject (schema manual `start-local.sh`); `category` agregada a LostObject; `ai_description` eliminada del schema+modelo+repo. `WeaviateService` soporta create con vectores nombrados y `targetVectors` en la query; las búsquedas textuales actuales apuntan a `"text"`. El vector `image` se **cablea al flujo en EU-324** (por ahora queda null y no se persiste). Tests unitarios de repositorio (6 verdes) + suite existente verde. **OJO:** cambio de schema incompatible con el vector único previo → hay que recrear las clases (borrar volumen Weaviate) y regenerar el seed (EU-325) |
| 4 | Algoritmo de scoring (α/β por categoría, geo modulador, umbral) | EU-324 | 8 | **HECHO** | Corazón. Partido en 4 subtareas (A núcleo scoring · B recuperación de dos similitudes · C cablear CLIP en la escritura · D cablear CLIP en la búsqueda + wiring). `combinedScore = geoModulator·(α·sim_img + β·sim_txt)` con α/β por categoría externalizados a `application.yml`. `searchByPhoto` = búsqueda en vivo foto+texto (ambos obligatorios) + ubicación obligatoria, vectoriza imagen en memoria (sin S3), clasifica categoría por IA y la devuelve read-only; `notifyMatchingSavedSearches` (inverso) idem con ambos vectores + filtro duro por categoría. `queryDual` con limit alto (5000, fusible no poda). `reportLostObject` sube la foto a S3 sólo al guardar; `searchByPhoto` no sube. Suite unitaria/mockeada verde (138; los 4 rojos son los tests de contexto que necesitan MySQL, ambiental) |
| 5 | Regenerar el seed con dos vectores + categoría | EU-325 | 4 | TODO (con insumos listos) | Se hace **DESPUÉS de EU-142/#8/#9** (el esquema de texto debe estar cerrado, para plantar una sola vez). El NDJSON se genera fresco entonces. **Insumos ya preparados** (ver sección 7): 15 fotos reales mapeadas en `seed-data/photos/`, generador `generate_seed_vectors.py`, y `seed-local.sh` con esquema named vectors + upload de fotos reales. Al retomar: (ajustar la parte de texto del generador si EU-142 lo cambió) → correr generador → `seed-local.sh --force` → validar |
| 6 | Frontend: foto obligatoria, quitar descripción IA | EU-326 | 5 | TODO | En paralelo una vez definido el contrato del back. Al guardar, reenviar la foto; mostrar imageUrl en detalle de búsqueda guardada. **Mostrar la categoría clasificada por IA (read-only)** al usuario: si la ve mal elegida, el recurso es **reintentar con otra foto** (NO se habilita override manual —ver decisión abajo—). Requiere que el back devuelva la categoría en la respuesta de la búsqueda (324-D) |
| 7 | Calibración (coseno CLIP, α/β, rango geo) | EU-327 | 4 | TODO | Empírica; aislada de la implementación. **Revisar la tasa de error de categorización con datos reales**: si la IA confunde categorías CONCRETAS (no el caso ambiguo→OTROS, que es el esperado) más de lo tolerable, reconsiderar habilitar override manual de categoría (hoy descartado, ver decisión abajo) |
| 8 | Coincidencia de texto robusta al vocabulario/formato (búsqueda híbrida) | EU-142 | — | EN CURSO (arranca por PoC, #9) | Reemplaza el matching de texto por 100% coseno denso por **búsqueda híbrida** (denso + BM25) + **normalización de texto**. Detalle técnico en la sección 6. Story reescrita en lenguaje de negocio. **Va ANTES del seed**: la #5 debe regenerarse con el esquema ya definitivo (tokenización BM25 de la sección 6), así se planta una sola vez. **Se implementa a partir de la PoC #9** (PoC que evoluciona a implementación real) |
| 9 | **PoC: apilamiento de algoritmos de texto (híbrido) vs coseno solo** | EU-142 (PoC) | — | **SIGUIENTE (build arranca acá)** | **Es lo próximo que ejecuta `/build`.** Objetivo: comprobar empíricamente **cuánto mejora apilar denso + BM25 + normalización** (sección 6) por sobre **usar solo distancia coseno densa** (lo actual), sobre los 4 casos eje (sinónimos, término raro tipo "prince", identificador con distinto formato, typo). **PoC que EVOLUCIONA a la implementación real** (no descartable): el código que rinda queda como base de la #8. **Trabajar en una rama colgada del rework**: `git switch -c EU-142-poc-hybrid-text` desde `EU-320-rework-algoritmo-busqueda`. Entregable: comparación híbrido vs coseno en los casos eje + `alpha`/estrategia de fusión (`relativeScoreFusion` vs `rankedFusion`)/normalización tentativos, para cerrar sobre esos valores en #8 y calibrar fino en #7 |

Orden sugerido: **1 → 2 → 3 → 4 → 9 → 8 → 5 → 7**, con **6** en paralelo desde que el contrato del back esté claro. La **#9 (PoC del texto híbrido) es lo próximo que corre `/build`**; de ahí evoluciona la #8 (implementación), que va antes de la #5 porque cambia el esquema de texto (tokenización BM25) y el seed debe regenerarse una sola vez sobre el esquema final; la calibración fina de `alpha`/normalización se cierra en la #7.

---

## 6. Búsqueda híbrida de texto (EU-142)

**Problema.** Hoy la coincidencia de texto es 100% distancia coseno de un único embedding denso (OpenAI) del vector `text`. El embedding denso **promedia y diluye** los términos raros y distintivos: si una persona escribe datos que la otra no puso (marca "prince", un DNI, un nombre), o los escribe con otro formato, la similitud baja aunque compartan lo esencial. El coseno denso es justo el mecanismo que NO pondera por rareza.

**Los cuatro casos a cubrir son ejes independientes** — ninguna métrica única los resuelve:

| Caso de ejemplo | Naturaleza | Quién lo resuelve |
|---|---|---|
| "mochila roja" ≈ "bolsa bermeja" | sinónimos / semántica | vector denso (OpenAI), ya existente |
| "prince" (palabra rara compartida) | término exacto e infrecuente | **BM25** (ponderación por rareza) |
| "45.789.654" ≈ "45789654" | formato de identificador | **normalización** de texto |
| "evelin" ≈ "evelyn" | typo / variante ortográfica | **tokenización por n-gramas** de caracteres |

### Enfoque

Es la misma receta que un buscador tipo Google, en miniatura: denso (semántica) + BM25 (palabras clave por rareza) + normalización/corrección. **Sin capas nuevas de GPT** (se descartan la query-expansion y el re-ranking con IA de la versión vieja de EU-142: suman costo, latencia y no-determinismo). Todo es **config de esquema + cambio en la query**, sin infra ni dependencias nuevas.

**Pieza 1 — Hybrid search (BM25 + denso) en Weaviate.**
- Weaviate ya corre BM25 sobre un índice invertido de las propiedades de texto, gratis y de forma incremental (no recalcula el corpus en cada carga; el IDF sale de contadores agregados y el score se computa en la query sobre los candidatos).
- La query de texto pasa de `nearVector { vector, certainty }` a `hybrid { query, vector, alpha }`:
  - vector = el embedding `text` de OpenAI actual (lado semántico),
  - query = el texto crudo del usuario (lado BM25),
  - `alpha` ∈ [0,1]: 1 = puro denso, 0 = puro BM25. **Valor inicial ~0.5–0.75, a calibrar** (EU-327) con el caso mochila/DNI.
- **Fusión de los dos puntajes:** BM25 y coseno viven en escalas distintas; Weaviate los normaliza y combina en un único `score` 0–1 (`_additional { score }`, reemplaza a `certainty`). Estrategia **`relativeScoreFusion`** (reescala por valor, preserva magnitud) preferida sobre `rankedFusion` (RRF, sólo posición). Para `SearchScoringService` sigue siendo "un número de similitud de texto": se sustituye la fuente de `sim_texto`, el resto del scoring combinado (α·img + β·txt, geo) queda igual.

**Pieza 2 — Normalización + tokenización tolerante.**
- **Normalización de formato (código, en carga Y búsqueda, aplicada por igual a ambos lados):** minúsculas, quitar puntos/guiones/espacios dentro de secuencias numéricas ("45.789.654"→"45789654"), opcional quitar tildes. Limpieza **ciega**, sin regex por tipo de dato (no sabe si es DNI/IMEI/patente). Resuelve el caso del identificador.
- **Tokenización por n-gramas de caracteres** en la propiedad de texto del esquema: en vez de indexar palabras enteras, trigramas ("evelin"→eve,vel,eli,lin / "evelyn"→eve,vel,ely,lyn → matchean parcial). Resuelve el typo y refuerza el caso del identificador.

### Puntos de cambio en el código

- **Esquema** ([start-local.sh:158-195](Backend/start-local.sh#L158-L195) y el bloque gemelo de `seed-local.sh`): asegurar que `title`/`human_description` (FoundObject) y `description` (LostObject) sean propiedades de texto **indexables por BM25** con la tokenización elegida (n-gramas). Hoy son `string` y se guardan pero **la búsqueda nunca las consulta**.
- **Query** ([WeaviateService.java:138-143](Backend/src/main/java/com/eurekapp/backend/service/client/WeaviateService.java#L138-L143)): el bloque `nearVector { … certainty: 0.0 }` pasa a `hybrid { query, vector, targetVectors, alpha }`, y `_additional` pide `score` en lugar de `certainty` cuando se usa hybrid.
- **Normalización:** función aplicada en el punto donde se persiste el texto (carga de FoundObject/LostObject) y donde se arma la query de búsqueda — misma función en ambos lados.
- **Calibración:** `alpha`, estrategia de fusión y la normalización se validan con los cuatro casos de aceptación de la story (EU-327).

## 5. Fotos para los tests (fixtures)

Varias subtareas necesitan imágenes reales para probar **carga** y **similitud**. Se
**reutilizan las fotos de la PoC** (`poc-reverse-search/images/` e `images2/`: billetera,
boligrafo, cargador_redmi, control_philips, zapatillas_*).

**Importante:** `poc-reverse-search/` **NUNCA** se versiona, así que los tests **no** pueden
leer de esa ruta (no existiría en CI ni en otra máquina → el test rompe). Copiar un subconjunto
curado a `Backend/src/test/resources/fixtures/` (versionado) y cargarlo desde el classpath:

- **Carga:** cualquier imagen como archivo multipart de `searchByPhoto` / `uploadFoundObject`.
- **Similitud:** mismo objeto en distinto ángulo (p. ej. `images/billetera_1.jpg` vs
  `images2/billetera.jpg`) → coseno alto; objetos de distinta categoría → bajo.
- **Categoría dura:** billetera (Billetera/tarjetas) vs zapatillas (Ropa) vs cargador/control
  (Otros). Ojo: la PoC **no** tiene fotos de Llaves ni Celular (conseguir aparte si se testean).

Ya staged: subconjunto curado (9 fotos) en `Backend/src/test/resources/fixtures/`, con
`README.md` que detalla para qué sirve cada foto, las relaciones de similitud esperadas y la
metadata (title/description/categoría/organización o coordenadas) que va junto a cada una.

---

## 7. EU-325 — insumos preparados (hacer POST EU-142)

EU-325 se hace **después** de cerrar el esquema de texto (EU-142/#8, que empieza por la PoC #9), para
plantar el seed una sola vez sobre el formato final. Los NDJSON se **generan frescos** en ese momento
(no se conservan a medias). Lo que quedó **preparado como insumo** (en disco, reusable, NO lo invalida
EU-142 porque solo toca el vector de texto):

- **15 fotos reales** (10 found + 5 lost; cubren TODOS los objetos del seed) en
  **`Backend/seed-data/photos/<uuid>.jpg`** (versionado; nombre = UUID = key de S3). Origen:
  `C:\Users\Facundo\Desktop\imagenesEurekapp\{foundObjects,lostObjects}`. Mapeo: `foundObjects/N.jpg`
  → `FO_UUID_N`; `lostObjects/{1,2,3,4,6}` → billetera / auriculares / mochila / paraguas / notebook
  (por contenido; ver `LO_KEYS` en `seed-local.sh`). **Esto es lo caro ya resuelto: no re-conseguir fotos.**
- **Generador `Backend/seed-data/generate_seed_vectors.py`** (Python stdlib, zero-dep): por objeto
  llama al micro CLIP `/embed/image` (imagen 512) y `/classify` (categoría dura), y al embebedor de
  texto. Hoy usa OpenAI `text-embedding-3-small` sobre el string que arma el backend actual
  (FoundObject = `"" + " " + human_description + " " + title`; LostObject = `description`). **Ese bloque
  de texto es lo único a revisar/ajustar según lo que defina EU-142.**
- **`seed-local.sh` actualizado**: (a) esquema recreado a **named vectors** `image`+`text` (igual que
  `start-local.sh`), −`ai_description`, +`category` en LostObject; (b) upload S3 usa las **fotos reales**
  de `seed-data/photos/` para found Y lost (`upload_real_photo`); picsum solo para las person-photo.

**Al retomar EU-325 (post-EU-142):** (1) ajustar la parte de texto del generador si EU-142 la cambió;
(2) correr el generador → regenera `seed-data/{FoundObject,LostObject}.ndjson` con `vectors:{image,text}`
+ `category`; (3) `bash seed-local.sh --force` (MySQL+Weaviate+clip arriba, AWS creds en `.env.local`);
(4) validar conteos (10 FO / 5 LO), categorías, y que una búsqueda por foto matchea su par sembrado.

### Notas
- Los NDJSON del repo están en el **formato viejo** (vector único + `ai_description`); se sobrescriben
  al correr el generador. Mientras tanto **NO correr `seed-local.sh`** tal cual: su esquema (named
  vectors) no matchea ese NDJSON viejo.
- `Backend/.env.local`: `OPENAI_SECRET_KEY` quedó apuntando a una cuenta CON crédito.
  Micro CLIP en `localhost:8000`, Weaviate en `8081`.
- **Para EU-327:** en la corrida de prueba el clasificador puso **Anteojos de sol → ROPA** (el diseño
  decía OTROS). No es bug: es la salida real del modelo y es autoconsistente; es el error a medir en EU-327.
