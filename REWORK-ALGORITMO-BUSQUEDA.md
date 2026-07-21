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
| 8 | Coincidencia de texto robusta al vocabulario/formato | EU-142 | — | TODO (alcance recortado por la PoC #9) | **La PoC (#9) recortó el alcance:** se implementa **`denso + normalización de texto`** (NO búsqueda híbrida BM25 — descartada, ver §8-bis). La categoría ya está (EU-322/323). El **híbrido BM25 y los trigramas quedan fuera**; la **keyword-exacta para identificadores queda cajoneada** (mecanismo diferido, §8-bis). **Va ANTES del seed**: la #5 se regenera con el esquema definitivo (con la normalización aplicada), así se planta una sola vez |
| 9 | **PoC: apilamiento de algoritmos de texto (híbrido) vs coseno solo** | EU-142 (PoC) | — | **HECHO** (concluida; ver §8-bis) | **Es lo próximo que ejecuta `/build`.** Objetivo: comprobar empíricamente **cuánto mejora apilar denso + BM25 + normalización** (sección 6) por sobre **usar solo distancia coseno densa** (lo actual), sobre los 4 casos eje (sinónimos, término raro tipo "prince", identificador con distinto formato, typo). **PoC que EVOLUCIONA a la implementación real** (no descartable): el código que rinda queda como base de la #8. **Trabajar en una rama colgada del rework**: `git switch -c EU-142-poc-hybrid-text` desde `EU-320-rework-algoritmo-busqueda`. Entregable: comparación híbrido vs coseno en los casos eje + `alpha`/estrategia de fusión (`relativeScoreFusion` vs `rankedFusion`)/normalización tentativos, para cerrar sobre esos valores en #8 y calibrar fino en #7. **Desglose ejecutable en subtareas 9.1–9.6: ver sección 8** |

Orden sugerido: **1 → 2 → 3 → 4 → 9 → 8 → 5 → 7**, con **6** en paralelo desde que el contrato del back esté claro. La **#9 (PoC del texto híbrido) es lo próximo que corre `/build`**; de ahí evoluciona la #8 (implementación), que va antes de la #5 porque cambia el esquema de texto (tokenización BM25) y el seed debe regenerarse una sola vez sobre el esquema final; la calibración fina de `alpha`/normalización se cierra en la #7.

---

## 6. Búsqueda híbrida de texto (EU-142)

> **SUPERSEDED por la conclusión de la PoC (§8-bis, #9.6).** Esta sección es el **diseño pre-PoC**. La
> PoC lo puso a prueba y **descartó el híbrido BM25 y los trigramas**: la evidencia no justificó sumar esa
> complejidad sobre `denso + normalización`. Lo que sobrevive de acá: **la normalización (Pieza 2)** y el
> caso del identificador, que se reinterpretó como **mecanismo de keyword exacta cajoneado** (no BM25).
> Leer esta sección como contexto histórico; la decisión vigente está en §8-bis.

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
  - **`alpha` es POR CATEGORÍA** (decisión, análoga a α/β): la categoría la fija el clasificador de
    imagen y es filtro duro, así que ambos lados de una comparación ya comparten categoría → el `alpha`
    de esa categoría aplica sin ambigüedad. Billetera/credenciales → `alpha` **bajo** (el identificador
    es prueba casi unívoca, BM25 pesa); ropa → `alpha`≈1 (sin identificadores, los tokens son palabras
    comunes que ensucian → puro denso); celular/llaves → intermedio. **Ojo con la colisión de nombres:**
    α/β pesa imagen-vs-texto; este `alpha` pesa denso-vs-BM25 DENTRO del texto. Son dos niveles → claves
    distintas en `application.yml`. Se calibra en EU-327.
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

---

## 8. #9 — PoC de texto híbrido, desglose ejecutable

Rama de trabajo: `EU-142-poc-hybrid-text`, colgada de `EU-320-rework-algoritmo-busqueda`.

**Decisiones de arranque (tomadas, no reabrir sin motivo):**
- **Corpus:** mini-corpus ad-hoc **solo-texto**, desechable. NO depende del seed (EU-325), que va después.
- **Forma:** Java dentro del backend. Itera más lento que un script suelto, pero es código reutilizable.
  **(Actualización #9.6:** de lo escrito, sobrevive a la #8 la **normalización** (`TextNormalizer`); el
  `hybridQuery` de `WeaviateService` **NO** —el híbrido se descartó—, queda sólo como referencia por si
  se revisita la keyword-exacta.)
- **Métrica:** por cada caso eje, **posición del documento esperado en el ranking + score**. Tabla
  comparativa baseline (coseno denso solo) vs híbrido a distintos `alpha`.

| # | Subtarea | Estado | Detalle |
|---|----------|--------|---------|
| 9.1 | Normalización de texto | **HECHO** | `util/TextNormalizer.java` (estático, aislado, sin infra): minúsculas, colapsar separadores **entre dígitos** ("45.789.654"/"45-789-654"→"45789654"), quitar tildes (preserva **ñ**), colapsar espacios. Limpieza **ciega**, sin regex por tipo de dato. Idempotente. 8 tests unitarios verdes (`util/TextNormalizerTest.java`) cubriendo los casos eje |
| 9.2 | Esquema PoC en Weaviate | **HECHO** | `poc-hybrid-text/create-poc-schema.sh` (aparte, **NO** toca `start-local.sh`): clase `PocTextObject`, named vector `text` (vectorizer none, coseno), propiedad `content` en tokenización **`trigram`** + `indexSearchable` (BM25 on); metadata doc_id/role/case_axis para el harness. Soporta `--force` (borra+recrea). Verificado: clase levanta con config correcta y acepta escritura con vector provisto (smoke write+count+cleanup OK) |
| 9.3 | Corpus + embeddings | **HECHO** | 24 publicaciones en `src/test/resources/poc-hybrid-text/corpus.json` (título+descripción realistas, español rioplatense): 4 pares lost/found (uno por eje, redactados distinto) + 16 distractores plausibles de la misma categoría (incl. billeteras con OTRO DNI y carnets con OTRO nombre, para que el ranking compita de verdad). Harness `poc/PocHybridTextHarness.java` (clientes OpenAI+Weaviate armados a mano, sin `@SpringBootTest`; reusa `TextNormalizer`+`OpenAiEmbeddingModelService`+`WeaviateService`): `content` se persiste NORMALIZADO y el vector denso se calcula sobre ese mismo texto. Verificado por `PocCorpusLoadTest` (se saltea sin Weaviate/OPENAI_SECRET_KEY): 4 ejes con par completo. **Nota:** el corpus creció a **28** en 9.5 (4 "mellizos") y a **48** en 9.6 (caso omisión + 15 billeteras de relleno, ver §8-bis); `PocCorpusLoadTest` espera 48 |
| 9.4 | Soporte `hybrid` en `WeaviateService` | **HECHO** | `hybridQuery(...)` agregado junto a `queryObjects` (nearVector), sin tocar el camino productivo: `hybrid { query, vector, targetVectors, properties, alpha, fusionType }`, pide `score` (no `certainty`). `properties` acota el BM25 a `content`. Parametrizable por `alpha` y fusión. Compila. **Es el código que hereda la #8** |
| 9.5 | Harness de comparación | **HECHO** | `poc/PocHybridTextComparisonTest.java`: por cada eje, query = texto de la publicación "perdida", ranking **filtrado a `role=found`** (escenario real; sin el filtro la gemela idéntica de la query ocupaba el #1 y tapaba la señal). Mide posición del par esperado (#1 = ideal) + quién le gana. Baseline (nearVector denso) vs híbrido con `alpha ∈ {0.1,0.3,0.5,0.7,0.9}` × {relativeScoreFusion, rankedFusion}. Tokenización conmutable por env `TOKENIZATION` (word/trigram) en `create-poc-schema.sh`. **Corrido con las dos tokenizaciones** (ver handoff abajo) |
| 9.6 | Correr, leer, concluir | **HECHO** | Corridas trigram/word + medición inversa del caso omisión (corpus a 48 docs). Conclusión CERRADA en §8-bis: **se adopta `denso + normalización + categoría`** (ya mejor que lo previo); **se descartan híbrido BM25 y trigramas** (no le ganaron al denso). La omisión inversa (identificador = prueba) queda **cajoneada** como mecanismo diferido (keyword exacta, tipo entity resolution / dis_max, piso UX 99%), a decidir por EU-327 con datos reales. Detalle en §8-bis |

**Los 4 casos eje** (de la sección 6): sinónimos ("mochila roja" ≈ "bolsa bermeja") · término raro
compartido ("prince") · identificador con distinto formato ("45.789.654" ≈ "45789654") · typo
("evelin" ≈ "evelyn").

---

## 8-bis. #9.6 — HANDOFF (dónde quedamos, para retomar con contexto limpio)

Estamos **en medio de cerrar la conclusión de la PoC**. 9.1–9.5 están hechas; 9.6 (concluir) quedó
reabierta por un caso que faltaba probar. Este bloque tiene todo para retomar sin el chat.

### Qué se corrió y qué dio

Corpus: **28 publicaciones** (`corpus.json`). En 9.5 se sumaron **4 "mellizos"**: un señuelo casi
idéntico al `found` verdadero de cada eje, que sólo se distingue por el dato clave (DNI, marca,
nombre, o palabras lexicales), para que "salir #1" exija de verdad el dato distintivo y no se gane
gratis por compartir contexto. Grilla ampliada a `alpha ∈ {0.1,0.3,0.5,0.7,0.9}`.

**Métrica:** posición del par correcto en el ranking (ideal **#1**), sólo sobre `role=found`.

| Eje | Denso solo (actual) | Híbrido **trigramas** | Híbrido **palabra (word)** |
|---|---|---|---|
| Identificador (DNI) | #1 | #1 (vía fragmentos) | **#1 en todo alpha, score perfecto** |
| Typo (Evelin/Evelyn) | #1 | #2 con alpha bajo (ruido "Melina"), #1 con alpha≥0.5 | **#1 en todo alpha** (sin ruido; se apoya en "Gómez" compartido + denso) |
| Término raro (Prince) | #1 | #1 | #2 con alpha bajo (se cuela "Wilson" por masa de palabras comunes), #1 con alpha≥0.7 |
| Sinónimos (mochila/bolsa) | #2 (lo gana el mellizo lexical) | #3 | #3 |

**Lecturas firmes de esas dos corridas:**
1. A esta escala (pool chico), el **denso solo ya pone #1** el correcto en los 3 ejes con respuesta
   clara (Prince, DNI, typo). Sólo "falla" sinónimos, y ahí gana un objeto que *literalmente* dice las
   palabras de la query (mellizo "mochila roja de nena") → fallo discutible, no lo tomamos como duro.
2. **Los trigramas se descartan:** su único trabajo (typos) ya lo hacía el denso, y a cambio metían
   ruido (nombre no relacionado "Melina" compite por fragmentos de letras). Con **word**, ese ruido
   desaparece y el DNI queda blindado (token entero, IDF altísimo).
3. **BM25 solo (alpha bajo) es ruidoso con cualquier tokenización** (Melina con trigram, Wilson con
   word). El denso es la señal estable → si se usa híbrido, **alpha alto (~0.7–0.9)**.
4. **Normalización (9.1): ganancia clara y sin riesgo** (blinda formato del DNI), sirve también al
   denso → va a la #8 sí o sí.

### EL PUNTO QUE REABRE LA CONCLUSIÓN (lo próximo a probar)

El usuario señaló un caso **realista que el corpus NO cubrió** y que **da vuelta la recomendación**:
**información asimétrica / omisión de datos.** Ejemplo:

- Objeto **encontrado** (rico): *"billetera roja de cuerina con DNI 40682351"*.
- Búsqueda **A** (sólo apariencia): *"billetera roja de cuerina"*.
- Búsqueda **B** (sólo DNI): *"billetera con DNI 40.682.351"*.

El **denso** puntúa por solapamiento general → le da **más** score a **A** (comparte casi todo el
texto) que a **B** (sólo comparte "billetera" + un número que diluye). Pero **B es casi con certeza
el dueño**: el DNI que puso está *literalmente dentro* de la billetera hallada. **El denso premia al
parecido genérico por sobre la prueba casi unívoca → fallo real y grave.** Es exactamente donde
**BM25 por palabra (IDF alto sobre el DNI) le GANA al denso, no sólo lo empata.**

Encaja con dos cosas del diseño:
- Es el **flujo inverso** (`notifyMatchingSavedSearches`: el hallazgo describe más que la búsqueda →
  asimetría inherente).
- Justifica los **α/β por categoría** ya existentes: **billetera/credenciales** deben apoyarse fuerte
  en la búsqueda por palabras (token raro = casi prueba); **ropa** (sin identificadores) va al denso.

**Decisión tomada (2026-07-21):** la asimetría de información es la **NORMA, no la excepción** —cada
persona destaca los atributos que a ella le impactan al ver el objeto, así que el solapamiento de texto
entre hallazgo y búsqueda es estructuralmente bajo—. En ese régimen típico el **denso solo penaliza la
omisión** (menos texto en común = menos score) aunque compartan la prueba que importa, y el **token raro
compartido** (DNI, apellido, "prince") es a menudo el único puente confiable. Esto motivó parametrizar el
peso denso/BM25 por categoría — **pero la medición de abajo lo refutó**: BM25 (con cualquier `alpha`) NO
rescata al dueño-por-identificador. La intuición correcta (el identificador es prueba) se termina
resolviendo con **keyword exacta**, no con BM25 → ver Conclusión #9.6. El `alpha` por categoría queda como
idea muerta salvo que se reintroduzca BM25 en el futuro.

### Qué dio la medición inversa (RESULTADO — la predicción se refutó a medias)

Se agregó el caso omisión al corpus (found rico con DNI 40682351 + A sólo-apariencia + B sólo-DNI +
distractores) y un segundo método `compararOmisionEnDireccionInversaAvsB` (query = texto del `found`,
ranking filtrado a `role=lost`). Con el corpus chico, B quedaba **#3 en todo alpha** y BM25 la **hundía**
(el gemelo de apariencia mandaba). Sospechando artefacto de escala, se agregaron **15 billeteras de
relleno** (vocabulario descriptivo común, DNIs todos distintos) → corpus **48 docs**. Resultado a escala:

| alpha | A (apariencia) | B (DNI) | Lectura |
|---|---|---|---|
| 0.1 (casi BM25) | #15 | **#12** | con las descriptivas ya no-raras, el DNI desempata: **B supera a A** |
| 0.5 | #13 | #14 | el denso vuelve a mandar → A gana |
| 0.9 (casi denso) | #12 | #15 | A gana |

- **Verdad a medias:** bajar el IDF de las palabras de apariencia (corpus grande) SÍ deja que el DNI
  levante a B por sobre A **con alpha bajo**. La hipótesis de escala era parcialmente correcta.
- **Pero el problema de fondo persiste:** B queda **~#12 en absoluto**, debajo de ~11 look-alikes que
  comparten apariencia pero NO tienen el DNI. **BM25 aditivo no surfacea al dueño-por-identificador:**
  un término único de IDF altísimo no le gana a una multitud de términos comunes, porque BM25 **suma**.
  Es estructural, no del corpus. → Entramos en el "segundo caso" que obligaba a revisar la estrategia.

### Conclusión #9.6 (CERRADA)

**Se ADOPTA: `denso + normalización + categoría`.** Es el entregable de la PoC y ya es **mejor que lo
de antes** (que matcheaba un único vector diluido, con la descripción-IA adentro y sin normalizar):
- **Normalización siempre** (9.1): blinda formato de identificadores, sirve también al denso, cero riesgo.
- **Categoría como filtro duro** (EU-322/323): saca ruido entre categorías, no se compara ni notifica cruzado.
- **Denso** sigue como motor de similitud. En la PoC ya pone **#1** en 3 de 4 ejes (DNI, typo, prince);
  sólo "falla" sinónimos y por un mellizo literal (discutible).

**Se DESCARTA del alcance de la #8 (implementación): el híbrido BM25 y los trigramas.**
- **Trigramas: no** (metían ruido; su trabajo —typos— ya lo hace el denso).
- **Híbrido denso+BM25: NO le ganó claramente al denso** en la dirección directa, y no arregla la inversa.
  No se justifica sumar esa complejidad con la evidencia actual. (El `alpha` por categoría del §6/Pieza 1
  queda como idea asociada, sólo relevante si en el futuro se reintroduce BM25.)

**Caveat honesto:** el corpus es de juguete y *fácil*. Que el denso salga #1 acá **no prueba** que aguante
a escala con términos raros — eso lo valida EU-327 con datos reales.

**CAJONEADO (mecanismo diferido, NO se construye ahora):** *keyword exacta de alta entropía como prueba*
—para el caso **omisión / información asimétrica** (dirección inversa `notifyMatchingSavedSearches`)—.
Medido en la PoC: la similitud (densa **o** BM25 aditivo) **no** surfacea al dueño-por-identificador
(B ~#12, debajo de look-alikes; BM25 **suma** y un término único de IDF altísimo no le gana a la masa de
términos comunes). La solución conocida es **record linkage / entity resolution**: no tratar al
identificador como texto libre, sino como **clave exacta**. Diseño para cuando salga del cajón:
- **Keyword exacta + boost dominante.** Detectar por **estructura** (secuencia larga alfanumérica/numérica,
  alta entropía — NO regex por tipo, respeta el "limpieza ciega" del §6/9.1); si coincide exacto entre
  hallazgo y búsqueda, un boost que **domina** cuando está y **cero** cuando no (la similitud queda de
  desempate de fondo, no plan B binario). Patrón `dis_max`/`tie_breaker` + campo `keyword` de Lucene/ES
  (combinar por **máx**, no por suma). Cutoff **relativo/estructural**, no un IDF fijo.
- **UX:** con keyword exacta el % **no se calcula** del texto (puede ser fino con certeza alta): se **asigna**
  un **piso de 99%** (99 y no 100, porque "100%" se lee como garantía de propiedad). Sin keyword, % = similitud.

**Quién dispara sacarlo del cajón:** **EU-327** sólo *mide* si el problema de omisión/identificador aparece
de verdad con datos reales. **EU-327 NO lo implementa** (es calibración de perillas existentes). Si la
medición lo confirma, construir la keyword exacta entra como **story/subtarea nueva y aparte**.

Prior art: BM25 es un buen baseline; el denso es notoriamente flojo con identificadores/entidades de
cola larga (BEIR) → híbrido + campo exacto para IDs es la receta estándar.

### Cómo correr (con containers arriba: Weaviate 8081, CLIP 8000, y OPENAI_SECRET_KEY en `.env.local`)

```bash
cd Backend
# tokenización: word (recomendada) o trigram
TOKENIZATION=word bash poc-hybrid-text/create-poc-schema.sh --force
export JAVA_HOME="$(ls -d /c/Program\ Files/Java/jdk* | head -1)"
export OPENAI_SECRET_KEY="$(grep -E '^OPENAI_SECRET_KEY=' .env.local | sed 's/^OPENAI_SECRET_KEY=//' | tr -d '\r"'"'"'')"
./mvnw -q -Dtest=PocHybridTextComparisonTest test 2>&1 | sed -n '/PoC EU-142/,/====$/p'
```

**Gotcha:** el índice HNSW fija su dimensión (1536, OpenAI) en el **primer insert**. No hacer smoke
writes con vectores de otra dimensión sobre la clase recién creada, o el load real falla. Ante duda,
`--force` recrea limpio. El harness borra+recarga el corpus solo en cada corrida (idempotente).

### Archivos de la PoC (rama `EU-142-poc-hybrid-text`, TODO SIN COMMITEAR)

- `Backend/src/main/java/com/eurekapp/backend/util/TextNormalizer.java` (+ test) — 9.1, va a la #8.
- `Backend/src/main/java/com/eurekapp/backend/service/client/WeaviateService.java` — `hybridQuery(...)` (9.4), va a la #8.
- `Backend/poc-hybrid-text/create-poc-schema.sh` — esquema PoC (env `TOKENIZATION`).
- `Backend/src/test/resources/poc-hybrid-text/corpus.json` — 48 docs (4 ejes + mellizos + caso omisión + 15 billeteras de relleno de escala).
- `Backend/src/test/java/com/eurekapp/backend/poc/PocHybridTextHarness.java` — infra (load/embed/query).
- `Backend/src/test/java/com/eurekapp/backend/poc/PocCorpusLoadTest.java` — verifica carga (48).
- `Backend/src/test/java/com/eurekapp/backend/poc/PocHybridTextComparisonTest.java` — harness de comparación (directo + inverso/omisión, con volcado de ranking).
