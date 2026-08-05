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
   - Electrónica y llaves → ~50/50.
   - Otros → 50/50 por defecto.
5. **Categorías duras pero abarcativas como filtro previo** (definidas por IA desde la
   imagen, NO elegidas por el usuario, fronteras 0-ambiguas). Nunca se compara ni notifica
   entre categorías distintas:
   - **Ropa:** todo lo que se usa para vestirse (zapatillas y sweater sí; anteojos no).
   - **Billetera/tarjetas:** billetera + lo importante que se guarda (DNI, licencia, boleto
     estudiantil; no un papelito de recuerdo).
   - **Llaves.**
   - **Electrónica:** todo lo que tiene batería o se enchufa (celular, notebook, tablet, auriculares,
     cargador). *Era **Celular** hasta 2026-08-01; ver §10.*
   - **Otros / misceláneos.**

   **Son pocas y anchas a propósito, y esa es una decisión medida, no una intuición** (§10): el filtro
   es duro, así que si los dos lados caen distinto el par se vuelve **invisible** —fallo silencioso e
   irrecuperable—. Un esquema fino de 12 categorías partió 2 de los 5 pares del seed. Regla para
   agregar una: sólo si es **inconfundible respecto de TODAS** las existentes, y midiéndolo antes.
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
| 2 | Clasificación por IA en categorías duras | EU-322 | 5 | **HECHO** | **Local, sin OpenAI**: CLIP zero-shot en el micro (`/classify`, nubes de prompts + fallback OTROS por MARGEN top1-top2, no umbral absoluto). Abstraído en Java: `ImageClassificationService` + `ClipImageClassificationService` + enum `ObjectCategory`. Smoke 9/9 sobre fixtures + tests unitarios (12 verdes). Cableado en EU-324. **Revisado el 2026-08-01 (§10): `CELULAR` → `ELECTRONICA` y OTROS pasa a tener nube de prompts propia** (antes era sólo el fallback del empate, y eso forzaba a los objetos ajenos a las 4 categorías dentro de la más cercana). 12/12 fotos del seed bien clasificadas y márgenes de 0.003-0.042 → 0.034-0.086. Se descartó, con medición, un esquema de categorías finas |
| 3 | Weaviate: dos vectores + categoría; quitar descripción IA | EU-323 | 4 | **HECHO** | **Named vectors** (`image`+`text`, vectorizer none, coseno) en FoundObject y LostObject (schema manual `start-local.sh`); `category` agregada a LostObject; `ai_description` eliminada del schema+modelo+repo. `WeaviateService` soporta create con vectores nombrados y `targetVectors` en la query; las búsquedas textuales actuales apuntan a `"text"`. El vector `image` se **cablea al flujo en EU-324** (por ahora queda null y no se persiste). Tests unitarios de repositorio (6 verdes) + suite existente verde. **OJO:** cambio de schema incompatible con el vector único previo → hay que recrear las clases (borrar volumen Weaviate) y regenerar el seed (EU-325) |
| 4 | Algoritmo de scoring (α/β por categoría, geo modulador, umbral) | EU-324 | 8 | **HECHO** | Corazón. Partido en 4 subtareas (A núcleo scoring · B recuperación de dos similitudes · C cablear CLIP en la escritura · D cablear CLIP en la búsqueda + wiring). `combinedScore = geoModulator·(α·sim_img + β·sim_txt)` con α/β por categoría externalizados a `application.yml`. `searchByPhoto` = búsqueda en vivo foto+texto (ambos obligatorios) + ubicación obligatoria, vectoriza imagen en memoria (sin S3), clasifica categoría por IA y la devuelve read-only; `notifyMatchingSavedSearches` (inverso) idem con ambos vectores + filtro duro por categoría. `queryDual` con limit alto (5000, fusible no poda). `reportLostObject` sube la foto a S3 sólo al guardar; `searchByPhoto` no sube. Suite unitaria/mockeada verde (138; los 4 rojos son los tests de contexto que necesitan MySQL, ambiental) |
| 5 | Regenerar el seed con dos vectores + categoría | EU-325 | 4 | **RESEED CORRIDO Y VALIDADO (2026-08-01) · BLOQUEADO por credenciales AWS vencidas · falta el shellscript definitivo** — ver el bloque **(B-bis)** al final de §9-quinquies | Parte A **cerrada**: el `certainty`→`distance` + geo nativo ya eran correctos; el E2E que "seguía vacío" corría contra un **backend viejo en el 8080**. Con el backend actual, `search-by-photo` devuelve el par correcto (foto propia score 0.950; búsqueda de julia 0.849; umbral 0.75). **Parte B: los 15 objetos están cargados por API real** (10 FO / 5 LO, named vectors image512/text1536, categorías por IA). Script en `Backend/seed-data/reseed_via_api.sh`. **Replanteo §9-quinquies en curso (2026-07-27):** (2) org/coordenadas **corregido** en `reseed_via_api.sh`; (1) fotos: el par de la billetera ya usa **dos tomas reales distintas** (+ un near-miss), los otros 4 pares **siguen con foto idéntica** por falta de material. Falta correr el reseed, re-validar matches y escribir el shellscript definitivo. |
| 6 | Frontend: foto obligatoria, quitar descripción IA | EU-326 | 5 | TODO | En paralelo una vez definido el contrato del back. Al guardar, reenviar la foto; mostrar imageUrl en detalle de búsqueda guardada. **Mostrar la categoría clasificada por IA (read-only)** al usuario: si la ve mal elegida, el recurso es **reintentar con otra foto** (NO se habilita override manual —ver decisión abajo—). Requiere que el back devuelva la categoría en la respuesta de la búsqueda (324-D) |
| 7 | Calibración (coseno CLIP, α/β, rango geo) | EU-327 | 4 | **HECHO** — umbral calibrado (0.5320) + curva de presentación que lo muestra como 75%; verificado E2E 5/5 pares en #1 y ≥75%. Mean-centering DESCARTADO con medición. α/β, rango geo y consistencia de categorización **diferidos** (son parámetros, no código). Todo en §12 | Empírica; aislada de la implementación. **Revisar la tasa de error de categorización con datos reales**: si la IA confunde categorías CONCRETAS (no el caso ambiguo→OTROS, que es el esperado) más de lo tolerable, reconsiderar habilitar override manual de categoría (hoy descartado, ver decisión abajo) |
| 8 | Coincidencia de texto robusta al vocabulario/formato | EU-142 | — | **HECHO** | Se cableó `TextNormalizer.normalize(...)` en los **4 puntos productivos** donde se vectoriza texto: escritura (`uploadFoundObject` título+descripción, `reportLostObject` descripción) y lectura (`getFoundObjectByTextDescription`, `searchByPhoto`). **Misma limpieza en ambos lados** de toda comparación. Se normaliza **sólo el texto que alimenta el vector**; título/descripción se **persisten y muestran tal cual** los escribió el usuario (decisión Facundo 2026-07-22). **Híbrido BM25 y trigramas quedan fuera** (descartados en §8-bis); **keyword-exacta cajoneada**. Tests unitarios nuevos (3, verdes): escritura FoundObject + escritura LostObject + query `searchByPhoto`, cada uno verificando el texto normalizado que va al vector y (en LostObject) que lo persistido queda crudo. Suite `FoundObjectServiceTest`+`LostObjectServiceTest` verde (22). **Va ANTES del seed** (EU-325): el corpus se regenera con la normalización aplicada, se planta una sola vez |
| 9 | **PoC: apilamiento de algoritmos de texto (híbrido) vs coseno solo** | EU-142 (PoC) | — | **HECHO** (concluida; ver §8-bis) | **Es lo próximo que ejecuta `/build`.** Objetivo: comprobar empíricamente **cuánto mejora apilar denso + BM25 + normalización** (sección 6) por sobre **usar solo distancia coseno densa** (lo actual), sobre los 4 casos eje (sinónimos, término raro tipo "prince", identificador con distinto formato, typo). **PoC que EVOLUCIONA a la implementación real** (no descartable): el código que rinda queda como base de la #8. **Trabajar en una rama colgada del rework**: `git switch -c EU-142-poc-hybrid-text` desde `EU-320-rework-algoritmo-busqueda`. Entregable: comparación híbrido vs coseno en los casos eje + `alpha`/estrategia de fusión (`relativeScoreFusion` vs `rankedFusion`)/normalización tentativos, para cerrar sobre esos valores en #8 y calibrar fino en #7. **Desglose ejecutable en subtareas 9.1–9.6: ver sección 8** |

Orden sugerido: **1 → 2 → 3 → 4 → 9 → 8 → 5 → 7**, con **6** en paralelo desde que el contrato del back esté claro. **1–4, 9 y 8 están HECHAS.** Lo **próximo que corre `/build` es la #5 (regenerar el seed)**, ahora que el esquema de texto quedó cerrado (con la normalización de EU-142 aplicada); la calibración fina se cierra en la #7. El híbrido BM25/trigramas se descartó (§8-bis), así que **no** hubo cambio de tokenización de esquema.

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

---

## 9-ter. EU-325 — HANDOFF (retomar en chat limpio)

> Escrito para que **otra instancia de Claude retome sin este chat**. Orden: **(A) arreglar el BUG de carga
> por API (tarea aparte) → (B) recién ahí seguir el reseed**.
>
> 🛑 **PARAR AL TERMINAR (A). NO seguir de largo con (B) en el mismo chat.** Una vez arreglado y verificado el
> bug, **frená y devolvé el control a Facundo**: el reseed (B) se hace en un chat nuevo/aparte. Motivo: si un
> solo chat encadena A+B el contexto se vuelve larguísimo y consume la quota. (B) queda acá documentado sólo
> como contexto de por qué se arregla A, no para ejecutarlo a continuación.
>
> La rama `EU-142-poc-hybrid-text` ya se
> **mergeó al tronco** `EU-320-rework-algoritmo-busqueda` (fast-forward, incluye la normalización de EU-142
> cableada en producción). Todo lo de abajo es sobre el tronco.

### Estado del entorno al cerrar

- Contenedores arriba: `eurekapp-mysql` (:3306), `eurekapp-weaviate` (:8081, **1.24.1**), `eurekapp-clip` (:8000). MySQL con el seed de usuarios/orgs de `seed-local.sh` (password `Eurekapp1!`).
- **Weaviate: clases `FoundObject` y `LostObject` recreadas y VACÍAS (0/0)**, esquema named vectors (`image`+`text`). `PocTextObject` sigue existiendo.
- Backend **apagado**. Comando para levantarlo: memoria `project-run-backend-local` (PowerShell, perfil `local`, carga `.env.local`).
- `.env.local` tiene `OPENAI_SECRET_KEY` (con crédito), `AWS_ACCESS_KEY_ID/SECRET`. Working tree limpio.

### (A) ✅ RESUELTO (2026-07-25) — carga por API no persistía (moría en CLIP)

**Causa raíz:** el `RestClient` del `clipClient` usa por debajo el `HttpClient` del JDK 21, que por
defecto intenta un **upgrade a HTTP/2 en claro (h2c)** agregando `Connection: Upgrade` / `Upgrade: h2c`.
El micro **uvicorn/FastAPI no soporta h2c**: ante un POST multipart con esos headers, no reconoce el
campo `file` y responde **422 "field required"**. Esa 422 se propagaba como excepción no capturada y el
endpoint terminaba en 200 con body vacío sin persistir. (El multipart en sí estaba perfecto: boundary,
`name="file"; filename="image.jpg"`, JPEG válido — se confirmó capturando los bytes crudos.) `curl -F`
funcionaba porque usa HTTP/1.1 puro.

**Fix (mínimo, quirúrgico):** en `RestClientConfiguration.clipClient(...)` se construye el `RestClient`
con un `JdkClientHttpRequestFactory` sobre un `HttpClient` fijado a **`Version.HTTP_1_1`**. Sólo afecta al
`clipClient` (los clientes de OpenAI siguen igual: OpenAI sí soporta HTTP/2). Sin dependencias nuevas.

**Verificado end-to-end (micro CLIP real):** `POST /found-objects/organizations/1` → 200 con body real y
FoundObject en Weaviate (embed 512-dim + categoría BILLETERA + named vectors); `POST /lost-objects` → LostObject
persistido; `POST /found-objects/search-by-photo` → 200 clasificando BILLETERA. Tests unitarios de los servicios
CLIP verdes (10). **Nota:** los tests unitarios NO cazan esta clase de bug (mockean el `RestClient`/transporte);
la verificación válida es el flujo real. Quedó 1 FoundObject + 1 LostObject de prueba en Weaviate (la parte B
limpia con drop+recreate de todos modos).

<details><summary>Descripción original del bug (histórico)</summary>


**Síntoma:** `POST /found-objects/organizations/{org}` (multipart) responde **HTTP 200 con body vacío
(Content-Length 0, sin Content-Type)** pero **no crea nada en Weaviate** (`Aggregate` sigue en 0). Igual para
`POST /lost-objects`. Los tests unitarios NO lo cachan porque mockean CLIP/Weaviate — sólo aparece en el flujo real.

**Dónde muere (rastreado):** en `FoundObjectService.uploadFoundObject` la ejecución llega y completa:
subida a **S3 (OK, log "Object uploaded")** y **embedding de texto OpenAI (OK)** — y se corta **justo en el
paso siguiente: la vectorización de imagen con CLIP** (`imageEmbeddingService.getImageVectorRepresentation`,
~línea 206, y `imageClassificationService.classify`, 207). El log de éxito de CLIP (`Imagen vectorizada: dim=`)
**nunca aparece**, el `add` al repositorio (`FoundObjectRepository.add` loguea `Uploading FoundObject with named
vectors`) **nunca corre**, y **no salta ninguna excepción** en el log (ni de Spring ni de Tomcat).

**Verificado (para ahorrar tiempo, ya descartado):**
- El bytecode compilado que corre **sí** tiene el cableado CLIP (javap: offsets 359 `getImageVectorRepresentation`, 372 `classify`) — no es build viejo. La normalización EU-142 también está viva (el texto va normalizado al OpenAI).
- **CLIP responde perfecto** llamado directo: `POST localhost:8000/embed/image` da vector 512-dim; `/classify` da categoría. Responde por IPv4 y IPv6.
- `clipClient` tiene `baseUrl` seteado (`application.clip.url` = `http://localhost:8000`, default). No es URL mala.
- Sólo hay UNA impl de cada servicio (`ClipImageEmbeddingService`, `ClipImageClassificationService`), sin stub por perfil.
- **Thread dump:** ningún hilo `http-nio-8080-exec` queda colgado (todos idle) → la request **completa y vuelve al pool**, no se cuelga en CLIP. No hay hilos parados en código eurekapp/clip/weaviate.
- No hay config de logback custom; con `DispatcherServlet` en TRACE tampoco aparece "Completed 200" ni excepción.

**La contradicción central a resolver:** la request completa (hilo vuelve al pool) y responde **200 vacío**,
la ejecución NO llega a CLIP en la red (el micro no registra el POST — ojo: los `docker logs eurekapp-clip`
salen **corruptos con `\x00`** en este Windows; verificar de otra forma, p. ej. contador en el micro o tcpdump),
y **no se loguea ninguna excepción**. Un 200-vacío-sin-Content-Type **no** lo produce el `return
ResponseEntity.ok(dto)` del controller (ese DTO no es nulo, línea ~280) → algo corta entre el OpenAI (201) y
el CLIP (206) devolviendo 200 vacío sin log. **Próximo paso sugerido:** instrumentar temporalmente
`ClipImageEmbeddingService.getImageVectorRepresentation` (log al entrar / antes y después del `clipClient.post`)
para ver si entra y dónde para; o envolver 206-207 en try/catch con log; o correr el backend con
`logging.level.org.springframework.web.client=TRACE` para ver la request saliente del RestClient a CLIP.
Sospecha viva: la serialización multipart del `ByteArrayResource` por el `RestClient` (converters) puede estar
fallando de forma que no se ve. **Es un bug de producción del rework, no del seed.**

</details>

🛑 **Al arreglar y verificar este bug: PARAR y devolver el control a Facundo. NO arrancar el reseed (B) acá.**
(Cumplido: el bug se arregló y se paró acá; el reseed B va en un chat nuevo.)

### Aprendizaje operativo — NO limpiar Weaviate con batch-delete

Borrar **todos** los objetos de una clase con `DELETE /v1/batch/objects` (filtro match-all) **crashea Weaviate
1.24.1**: `panic: findNewLocalEntrypoint called on an empty hnsw graph` (al vaciar el grafo HNSW). **Limpiar
dropeando y recreando la clase** (`DELETE /v1/schema/<Clase>` + re-`POST /v1/schema` con el JSON de
`start-local.sh` §158-195). Esto va también al shellscript final del seed.

### (B) Reseed — flujo redefinido por Facundo (hacer DESPUÉS de arreglar A)

1. **Limpiar** FoundObject/LostObject (dropear+recrear clases, ver arriba). Mantener usuarios/orgs de MySQL.
2. **Inventario ya APROBADO** (abajo). No re-preguntar salvo cambio.
3. **Cargar por API real** (no NDJSON): así pasa por normalización + CLIP + clasificación + S3. Cuentas
   (password `Eurekapp1!`): encontrados con `owner.utn@eurekapp.com` (org 1), `owner.term@eurekapp.com` (org 2),
   `emp1.aero@eurekapp.com` (org 3); búsquedas con `julia@/pedro@/valeria@mail.com`.
   Endpoints: login `POST /login` (JSON→`token`); encontrado `POST /found-objects/organizations/{org}` (multipart
   `file,title,detailed_description,found_date,latitude,longitude` — **sin** `category`, la pone la IA);
   búsqueda `POST /lost-objects` (multipart `file,description,lost_date,latitude,longitude,organization_id`).
   Fotos fuente en `seed-data/photos/<uuid>.jpg` (la API sube a S3 con UUID nuevo propio; el uuid del archivo
   es sólo para mapear foto↔objeto). **La categoría la decide la IA** (aunque le pifie, pifia igual en carga y
   búsqueda: misma vara — decisión 8bis). **El script de carga era descartable y vivía en el scratchpad de la
   sesión (ya no existe); reconstruirlo desde esta tabla + endpoints.**
4. **Validar:** conteos (10 FO / 5 LO), categorías asignadas, y que cada búsqueda matchea su par.
5. **Recién ahí** escribir el **shellscript definitivo** del seed (con la limpieza por drop+recreate).

**Nota generador:** `generate_seed_vectors.py` replica el texto del backend pero **sin normalizar** (embebe crudo);
en el flujo por API esto es irrelevante (el backend normaliza). Sólo alinear (portar `TextNormalizer`) si el
shellscript final decide usar el generador en vez de la API.

#### Inventario APROBADO (datos ficticios de demo; se persiste tal cual, sólo se normaliza lo que va al vector)

> ⚠️ **Actualizado por §9-quinquies (2026-07-27):** el par de la billetera pasó de "negra" a **marrón** (se
> reasignaron las fotos reales de la PoC), y las coordenadas/organización de las tablas de abajo ya no valen tal
> cual (hallazgos dentro de sede van sin coordenadas; mochila y auriculares son de vía pública). La fuente de
> verdad operativa es `Backend/seed-data/reseed_via_api.sh`.

Encontrados **con par** (el dato distintivo se repite en la búsqueda):

| Foto uuid | Org | Título | Descripción |
|---|---|---|---|
| 7ea43eba-7343-4cd8-b5d0-b736e3d575a3 | 1 | Billetera negra de cuero | Billetera negra de cuero. Adentro tiene el DNI 40.682.351 a nombre de Martín Gómez, una tarjeta de débito Visa del Banco Nación y algo de efectivo |
| 25e71dcb-9d0d-4b75-96f2-df60b7d99261 | 2 | Auriculares inalambricos blancos | Auriculares over-ear inalámbricos blancos, marca Sony modelo WH-1000XM4, sin cables |
| 494ddbc4-b4d8-4935-a77c-1d3e7363b67d | 1 | Mochila azul con libros | Mochila azul mediana marca Jansport, con varios libros de ingeniería y un estuche adentro |
| 4b43a1d8-1491-4077-9c1c-463e5906cdeb | 1 | Paraguas negro plegable | Paraguas negro plegable compacto, sin marca visible |
| 85c55156-216f-4b6c-aa65-782e066567b6 | 2 | Notebook Dell gris | Notebook Dell Inspiron 15 gris, con stickers en la tapa |

Encontrados **distractores** (sin par; datos propios distintos para que compitan sin matchear):

| Foto uuid | Org | Título | Descripción |
|---|---|---|---|
| df2aa6a0-d15c-46e8-902a-e5394538a43e | 1 | Llave con llavero azul | Llave tipo Yale suelta con llavero de goma azul |
| 18da5796-50dc-4383-8b1f-27e524b04b5d | 3 | Celular Samsung negro | Celular Samsung Galaxy S21 negro con pantalla rota y funda gris |
| ebaa9336-e9fd-4556-a96e-9c1538d165cb | 2 | Billetera marron con DNI | Billetera marrón de cuero con DNI 33.145.892 a nombre de Laura Fernández y tarjetas bancarias |
| 498d742e-49e6-4c88-bf8d-f0313581dfaa | 3 | Cargador USB-C blanco | Cargador USB-C blanco de 20W marca Samsung con cable incluido |
| a1047f2f-0fcd-41b1-92ad-485dd04cb5d8 | 1 | Anteojos de sol negros | Anteojos de sol Ray-Ban con montura negra y lentes espejados |

Búsquedas guardadas (comparten el dato distintivo, **formato distinto a propósito** para probar la normalización):

| Foto uuid | Usuario | Org | Descripción | Matchea |
|---|---|---|---|---|
| ea9f4057-4f1d-4daf-aeca-c6162fe9aeb6 | julia@mail.com | 1 | Perdí mi billetera negra de cuero cerca de la facultad. Adentro está mi DNI 40682351 a nombre de Martín Gómez y una tarjeta de débito Visa | Billetera negra |
| 771c2c2b-4dd2-45e4-977b-3a2186e86b6e | pedro@mail.com | 2 | Se me cayeron unos auriculares inalámbricos blancos Sony WH-1000XM4 en la terminal | Auriculares |
| 8ec5ebe1-5b65-412a-9cda-576f42401e35 | valeria@mail.com | 1 | Perdí una mochila azul Jansport con libros de ingeniería en la UTN | Mochila azul |
| 26f82583-f553-40a1-a1b8-3775c384971f | julia@mail.com | 1 | Se me olvidó mi paraguas negro plegable en el aula magna de la UTN | Paraguas |
| 56d511e3-899b-41cf-9f2c-a811437b0b28 | valeria@mail.com | 2 | Olvidé mi notebook Dell Inspiron 15 gris en la sala de espera de la terminal | Notebook |

Coordenadas/fechas por objeto: reusar las del inventario en `Backend/seed-data/generate_seed_vectors.py`
(`FOUND_OBJECTS`/`LOST_OBJECTS`, mismos uuid). **Pruebas plantadas:** DNI de la billetera #1 con puntos en el
hallazgo (`40.682.351`) y sin puntos en la búsqueda (`40682351`) → prueba la normalización; billetera marrón
(Laura Fernández) compite con la búsqueda de julia pero debe perder contra la negra (comparten nombre+DNI).
El clasificador puso los anteojos en ROPA en corridas previas: es la salida real del modelo, se mide en EU-327.

---

## 9-quater. EU-325 parte B — HANDOFF (datos cargados; bug productivo bloquea la validación)

> Escrito 2026-07-25 para que **otra instancia de Claude retome sin este chat**. Resumen: **el reseed de datos
> ESTÁ HECHO y validado**; al validar "cada búsqueda matchea su par" se destapó un **bug productivo bloqueante**
> en la query dual (EU-324). Orden para retomar: **(A) arreglar el bug → (B) re-validar matches → (C) escribir el
> shellscript definitivo del seed**. El trabajo de carga NO se pierde: está el script y los datos están en Weaviate.

### Lo que YA quedó hecho (no rehacer)

1. **Fix de carga CLIP (parte A)** commiteado: `13841ca fix(EU-325): corregir la carga multipart al micro CLIP`
   (fuerza HTTP/1.1 en `clipClient` + `MultipartBodyBuilder` con filename/boundary correctos). Va sobre el tronco.
2. **15 objetos cargados por API real y validados** (2026-07-25, backend perfil local :8080):
   - Conteos **10 FoundObject / 5 LostObject**.
   - **Ambos named vectors presentes** en cada objeto: `image` (512) + `text` (1536).
   - **Categorías por IA**: billetera negra + billetera marrón → `BILLETERA`; celular → `CELULAR`; llave → `LLAVES`;
     anteojos → `ROPA` (el caso EU-327 conocido); resto → `OTROS`.
   - DNI de la billetera negra plantado con puntos en el found (`40.682.351`) y sin puntos en la search (`40682351`).
3. **Script de carga preservado y funcional:** `Backend/seed-data/reseed_via_api.sh` (login de las 6 cuentas +
   POST multipart de los 15 objetos con el inventario aprobado §9-ter). Gotchas documentados en su cabecera
   (git-bash manglea `;type=` en curl -F; descripciones sin tildes para evitar mojibake).

**Cómo dejar Weaviate limpio antes de recargar** (NO usar batch-delete: crashea 1.24.1 — ver §9-ter). Dropear+
recrear las clases con el JSON de named vectors de `start-local.sh` §158-195, p.ej.:

```bash
W=http://localhost:8081
for C in FoundObject LostObject; do curl -s -X DELETE "$W/v1/schema/$C"; done
# luego POST /v1/schema con el payload de cada clase (vectorConfig image+text, vectorizer none, cosine)
```

Después: backend arriba (memoria `project-run-backend-local`) + `bash Backend/seed-data/reseed_via_api.sh`.

### (A) ✅ CERRADO Y VERIFICADO E2E (2026-07-25)

**No había un segundo bug de código.** El fix de abajo (certainty→distance + geo nativo) **ya era correcto**.
Lo que invalidó la corrida E2E anterior es que **el proceso Java que escuchaba en el 8080 era una instancia
vieja** (levantada horas antes, sin ese código compilado): por eso respondía 200, clasificaba bien la categoría
y devolvía la lista vacía — era literalmente la versión con el bug.

**Descartado antes de reiniciar:** se ejecutó a mano contra Weaviate 1.24.1 la **query exacta que arma el Java**
(filtro compuesto `WithinGeoRange` + `organization_id` + `was_returned` + `category`, más `nearVector` sobre el
named vector `image` con `certainty: 0.0` y `_additional { id distance }`) → devuelve el resultado correcto.
Ni el serializador del filtro ni el `WithinGeoRange` del string-builder estaban rotos.

**RESULTADO E2E con el backend actual (bajando la instancia vieja y levantando la de ahora):**

| Caso (julia, org 1) | Resultado | score | umbral |
|---|---|---|---|
| Foto propia del hallazgo | Billetera negra ✅ | 0.950 | 0.75 |
| Búsqueda real de julia (DNI sin puntos) | Billetera negra ✅ | 0.849 | 0.75 |

Categoría bien clasificada (BILLETERA), sin cruce de categorías, y **la normalización EU-142 queda probada de
paso**: el hallazgo dice `40.682.351` y la búsqueda `40682351` → similitud de texto 0.884. No hizo falta bajar
`MIN_SCORE`.

> ⚠️ **Aprendizaje operativo:** antes de dar por fallida una verificación E2E, **confirmar que el proceso del 8080
> es el que acabás de compilar** (`Get-NetTCPConnection -LocalPort 8080` + `StartTime` del proceso). Una instancia
> zombi de una sesión anterior hace pasar un fix correcto por roto.

**Instrumentación agregada (en disco, sin commitear):** `WeaviateService.queryObjects` loguea la query GraphQL
generada y `FoundObjectService.searchByPhoto` loguea candidatos recuperados + `simImg`/`simTxt`/`score` de cada
uno. Ambas en nivel **debug** (apagadas por defecto; encender con `-Dlogging.level.com.eurekapp.backend=DEBUG`).

**Fix aplicado (cambios en disco, NO commiteados aún):**
- **`WeaviateService.queryObjects`**: pide `_additional { id distance }` en vez de `certainty` (que rompe sobre
  named vectors en 1.24.1). Al parsear (`convertToWeaviateObject`) reconstruye la certeza con el helper estático
  `cosineCertaintyFromDistance(d) = 1 − d/2` y la guarda en `additional.certainty`, así el scoring aguas arriba
  (`normalizeCosineScore`, `MIN_SCORE`) queda **idéntico**. El camino `hybrid` (que trae `score`) no se toca.
- **Radio geográfico NATIVO reactivado** (el "bug de Weaviate" era en realidad el `certainty`, no el geo):
  `FoundObjectRepository.buildFilter` descomenta el `WithinGeoRange`; se extrajo `geoRangeToGraphQL(...)` en
  `WeaviateService` y se lo cablea también en la rama de **filtro hoja** (por si el geo queda solo).
- **Flujo inverso** (`LostObjectRepository.queryDual`/`buildFilter` ahora reciben `GeoCoordinates`;
  `LostObjectService.notifyMatchingSavedSearches` pasa las coordenadas del objeto encontrado): las notificaciones
  de búsquedas guardadas se acotan por radio duro (cross-org pero circunscrito). Era el TODO histórico.

**Verificado:** (1) raw GraphQL contra Weaviate real 1.24.1 con los 15 objetos → `distance`+`WithinGeoRange`
devuelve resultados y poda por radio (10→5 dentro de 2 km); `certainty` rompe. (2) Tests unitarios verdes (39):
`WeaviateServiceTest` (conversión 0→1/1→0.5/2→0), `FoundObjectRepositoryTest`/`LostObjectRepositoryTest`
(el `WhereFilter` arma el `WithinGeoRange` con coordenadas y lo omite sin ellas, en ambos flujos),
`FoundObjectServiceTest`/`LostObjectServiceTest` (firmas actualizadas). (3) **E2E contra el backend real**
(ver tabla arriba). **Falta correr la suite completa y commitear.**

<details><summary>Descripción original del bug A (histórico, ya resuelto)</summary>

**Síntoma:** `POST /found-objects/search-by-photo` devuelve `found_objects: []` **siempre**, incluso buscando con
la **misma foto** de un objeto cargado (que debería dar distancia 0 = match perfecto). La categoría sí se clasifica
bien (BILLETERA), pero la lista sale vacía.

**Causa raíz (aislada con GraphQL directo contra Weaviate 1.24.1):** en una query `nearVector` sobre **named
vectors** (`targetVectors:["image"|"text"]`), **pedir el campo `_additional { certainty }` ROMPE la query**:
Weaviate responde `errors: [{ message: "vector config not found for target vector: " }]` (nombre vacío) y
`data.Get.<Clase> = null`. Pedir **`distance`** en su lugar funciona perfecto. Verificado:
- `_additional { certainty }` → error, null.
- `_additional { distance }` → OK: misma foto → `distance 0`; billetera marrón → `0.226`; anteojos → `0.251`.
- El **parámetro** `certainty: 0.0` dentro de `nearVector` es inocuo; lo que rompe es **el campo** `certainty`.

**Por qué nunca se cazó antes:** los tests de EU-324/323 **mockean** Weaviate; ésta es la **primera** corrida de la
query dual contra un índice named-vector real con datos. Los tests unitarios no cubren esta clase de bug (transporte).

**Dónde está el código:** `Backend/src/main/java/com/eurekapp/backend/service/client/WeaviateService.java`,
método `queryObjects(...)`:
- línea ~143: arma `nearVector: { vector ..., targetVectors ..., certainty: 0.0 }` (el param es inocuo, se puede dejar o quitar).
- línea ~161: `queryBuilder.append("_additional { id certainty } ");` ← **ESTO es lo que rompe.**
- El parseo en `convertToWeaviateObject`/`convertToFoundObject` (~línea 292-312) lee `_additional.certainty` y lo
  guarda en `score`. `queryDual` (`FoundObjectRepository`) copia ese `score` a `imageCertainty`/`textCertainty`, y
  `SearchScoringService.combinedScore` los normaliza con `normalizeCosineScore(certainty) = (c-0.5)*2` (c∈[0.5,1]→[0,1]).

**Fix propuesto (quirúrgico, preserva la semántica del scoring):**
- En `queryObjects`, para named vectors pedir `_additional { id distance }` en vez de `certainty`.
- Al parsear, convertir con la relación coseno de Weaviate: **`certainty = 1 − distance/2`** (distance∈[0,2]→certainty∈[0,1]),
  y guardar ESE valor en `score`. Así `normalizeCosineScore`, `MIN_SCORE=0.75` y todo el scoring quedan igual que hoy
  (no hay que recalibrar por este cambio; la calibración fina sigue siendo EU-327).
- **OJO alcance:** `queryObjects` es compartido — lo usa también la **búsqueda textual legacy** (`getFoundObjectByTextDescription`,
  `FoundObjectService.java:362`, que llama a `totalScore(fo.getScore(), ...)`). El cambio debe mantener `score`
  con la MISMA semántica (certainty 0..1) para no romper ese camino. Con la conversión de arriba se mantiene.
- **Tests:** agregar un test que verifique que `queryObjects`/`queryDual` mapea `distance`→`score` correctamente
  (mockeando la respuesta Weaviate con `_additional.distance`), y —idealmente— un smoke opcional (se saltea sin
  Weaviate) que corra una nearVector named-vector real y compruebe que devuelve candidatos. Regla del rework:
  toda tarea de backend lleva tests unitarios antes de darse por hecha.

</details>

### (B) Re-validar después del fix (con los datos ya cargados)

Con el fix aplicado y los 15 objetos en Weaviate, `searchByPhoto` debería devolver el par correcto. Casos a chequear:
- **Billetera negra** (search de julia, foto `ea9f4057`, org 1): debe surfacear la billetera negra found (`7ea43eba`).
  Ojo: found y search son **fotos distintas** del par → sim de imagen moderada; en BILLETERA pesa el texto
  (α=0.35/β=0.65, `application.yml`). Si aun así queda por debajo de `MIN_SCORE=0.75`, **eso ya es calibración (EU-327)**,
  no el bug. Para separar bug de calibración: buscar con la **propia foto** del found (distance 0) — con el fix debe
  matchear sí o sí.
- Auriculares (pedro), mochila (valeria), paraguas (julia), notebook (valeria): cada uno contra su found.
- Verificar que el **filtro duro por categoría** no cruza (una search BILLETERA no trae ROPA/OTROS).

---

## 9-quinquies. EU-325 — REPLANTEO del seed (aprobado por Facundo 2026-07-25/27)

> Sale de validar el seed con el bug A ya cerrado. **Va ANTES del shellscript definitivo (paso C).** El texto,
> la metadata y el inventario de §9-ter **no cambian**; cambian las **fotos** y el uso de **organización/coordenadas**.

### Hallazgo 1 — las 5 fotos de búsqueda son IDÉNTICAS a las de su hallazgo

Verificado por hash: los 5 pares comparten el archivo byte a byte
(`7ea43eba`≡`ea9f4057`, `25e71dcb`≡`771c2c2b`, `494ddbc4`≡`8ec5ebe1`, `4b43a1d8`≡`26f82583`, `85c55156`≡`56d511e3`).

**Consecuencia:** la similitud visual da **1.0 exacto siempre** → el seed **no puede validar la parte visual del
algoritmo** (compara una foto contra sí misma) ni sirve para calibrar el coseno de CLIP en EU-327. No es un bug
de código, es una limitación del material.

**Qué hacer:** conseguir una **segunda toma** de cada objeto (otro ángulo/iluminación) para las 5 búsquedas.
Es exactamente el escenario real: el que busca no tiene la foto del que encontró.

**Estado (2026-07-27): RESUELTO para el par de la billetera; los otros 4 pares SIGUEN con foto idéntica.**

Material revisado: `Desktop\imagenesEurekapp\lostObjects` duplica `foundObjects`; `poc-reverse-search\images2`
duplica casi todo `images`. **El único objeto con más de una toma real es la billetera de la PoC**:
`billetera_1` y `billetera_3` son **la misma** billetera marrón (costura zigzag + banda símil cocodrilo) en dos
tomas (superficie clara / en la mano, otra luz y fondo), y `billetera_2` es **otra** billetera marrón (costura
recta) → competidor parecido-pero-no-igual.

**Reasignación aplicada** (fotos copiadas a `Backend/seed-data/photos/`, textos ajustados en `reseed_via_api.sh`):

| Objeto | Foto nueva | Para qué |
|---|---|---|
| Hallazgo billetera del par (`7ea43eba`) | `images/billetera_1.jpg` | la toma "del que encontró" |
| Búsqueda de julia (`ea9f4057`) | `images/billetera_3.jpg` | **otra toma del MISMO objeto** → primer test visual real del seed |
| Distractor billetera (`ebaa9336`) | `images/billetera_2.jpg` | billetera **distinta** pero muy parecida → near-miss real |

Ambas billeteras quedan ahora **marrones**: el color ya no separa, así que el desempate lo tienen que dar el DNI y
el nombre (texto) y la similitud visual fina — es el escenario más exigente y el que interesa medir. El par pasa de
"negra" a "de cuero marrón" en título y descripción (found y búsqueda); el distractor de Laura Fernández no cambia
de texto.

**Los otros 4 pares: RESUELTOS (2026-07-27)** con fotos que aportó Facundo (buzón `Backend/seed-data/photos-nuevas/`
+ su `LEEME.md`). **Verificado por hash: los 5 pares tienen ahora fotos distintas.** No son el mismo objeto (salvo
la billetera): son objetos distintos del mismo tipo/color → la similitud visual va a dar valores **medios**, no
altísimos. Si alguno queda bajo `MIN_SCORE`, es insumo de **EU-327**, no un bug.

| Par | Hallazgo | Búsqueda | Qué ejercita |
|---|---|---|---|
| Billetera | `billetera_1` (PoC) | `billetera_3` (PoC) | **mismo objeto, 2 tomas** + near-miss (`billetera_2`) |
| Auriculares | catálogo Motorola blanco | foto real en banco de plaza | mismo tipo/color, catálogo vs escena real |
| Mochila | **Jansport real** (foto nueva) | catálogo azul (con marca de agua) | dos mochilas azules distintas |
| Paraguas | catálogo fondo blanco | calle bajo la lluvia | robustez al fondo |
| Notebook | catálogo abierta 3/4 | tapa cerrada, foto casera | mismo modelo/color, otra pose |

**Textos ajustados para que no contradigan las fotos nuevas:** notebook sin "stickers en la tapa"; auriculares sin
"inalámbricos/sin cables" (la foto nueva muestra cable).

**Deuda menor (no bloquea):** la foto de búsqueda de la mochila tiene **marca de agua de Dreamstime** — reemplazar
antes de una demo.

**Caso límite plantado a propósito (decidido 2026-07-27):** el modelo de los auriculares va como `WH-1000XM4` en el
hallazgo y `WH 1000XM4` en la búsqueda (separador distinto entre letra y número). **La normalización NO lo unifica
a propósito**: sólo pega separadores *entre dígitos*, porque pegar letra+número también uniría `DNI 40682351` en un
bloque y perderíamos el identificador como token suelto. Se espera que lo absorba el vector semántico (comparte los
fragmentos `wh`/`1000`/`xm`/`4`); con búsqueda por palabras exactas —el híbrido descartado— se habría roto. **Medir
la similitud de texto de ese par al validar** → insumo de EU-327. **Decisión: NO se agrega un "tip" en el front
pidiéndole al usuario que copie el modelo tal cual la etiqueta** (el que perdió el objeto muchas veces no lo sabe;
todo el rework parte de aceptar que cada lado describe distinto). Sí es válido un consejo genérico del tipo "contá
marca, color y cualquier número o nombre".

### Hallazgo 2 — organización y coordenadas: qué significa cada una

**Modelo correcto (aclarado por Facundo):**
- **Organización:** SIEMPRE presente en un hallazgo. Es quién **recepta y custodia** el objeto.
- **Coordenadas:** OPCIONALES, y **su presencia o ausencia es la señal** de dónde se encontró realmente:
  - **con** coordenadas → se encontró en **otro punto del mapa** (vía pública),
  - **sin** coordenadas → se encontró **dentro de la organización** que lo recepta (hereda las de la sede).

Esto ya está implementado (`FoundObjectService.uploadFoundObject`: si vienen lat/lon usa esas, si no toma las de
la org). Del lado de la **búsqueda guardada** la organización **sí puede ir vacía** (no se valida).

**El seed actual usa mal esa señal:** le manda a TODOS los hallazgos las coordenadas exactas de la sede, o sea
declara "se encontró en otro punto del mapa" y después da el punto de la sede.

**Corrección aprobada:** los hallazgos dentro del establecimiento van **sin coordenadas**; sólo los de vía
pública las llevan. Dos pares pasan a vía pública (mochila y auriculares):

| Hallazgo | Org que recepta | Coordenadas del hallazgo |
|---|---|---|
| Billetera negra · Paraguas · Llave · Anteojos | UTN FRC | — (dentro de la sede) |
| Notebook Dell · Billetera marrón | Terminal de Ómnibus | — |
| Celular Samsung · Cargador USB-C | Aeropuerto | — |
| **Mochila azul** | UTN FRC | **-31.43943, -64.18451** (vereda de Vélez Sarsfield, frente a UTN) |
| **Auriculares** | Terminal de Ómnibus | **-31.42118, -64.18760** (plazoleta junto a la terminal) |

Sus dos búsquedas van **sin organización**, sólo con las coordenadas del punto de pérdida:

| Búsqueda | Coordenadas de pérdida | Separación del hallazgo |
|---|---|---|
| Mochila azul (valeria) | -31.43910, -64.18450 | 36 m |
| Auriculares (pedro) | -31.42160, -64.18700 | 74 m |

**Cómo se generaron:** desplazando el punto de pérdida una distancia aleatoria de **25–120 m** en una dirección
aleatoria (fórmula de desplazamiento sobre esfera, semilla fija → reproducible). Simula el caso real: dos personas
marcando el mismo lugar aproximado en el mapa sin clickear el mismo punto. **No usar los 50 km del radio duro**:
eso es el filtro de recuperación, no la dispersión del dato.

**Ojo con el texto:** las descripciones de esos dos pares mencionan la sede ("en la terminal", "en la UTN").
Al replantear, ajustarlas para que sean coherentes con el hallazgo en vía pública.

**Estado (2026-07-27): HECHO en `Backend/seed-data/reseed_via_api.sh`.** `post_found`/`post_lost` aceptan `-` en
lat/lon (y en org, para las búsquedas) y omiten esos campos del multipart —ambos endpoints ya los tienen
`required=false`—. Los 8 hallazgos dentro de sede van sin coordenadas; mochila y auriculares llevan las de vía
pública; sus dos búsquedas van sin organización y con el punto de pérdida desplazado (36 m / 74 m). Los textos de
esos dos pares se reescribieron para hablar de la vereda/plazoleta en vez de la sede. Falta correrlo (depende de
las fotos del Hallazgo 1).

**Fuera de alcance (NO se hace acá):** permitir cargar un hallazgo **sin** organización. No hace falta —el modelo
de arriba ya cubre el caso— y sería un cambio de alcance real (afecta inventario de la org, devoluciones y
recompensas, que asumen que todo objeto pertenece a una). Si alguna vez se quiere, es story aparte.

---

### (B-bis) Reseed CORRIDO y VALIDADO con el material nuevo (2026-08-01)

Clases dropeadas+recreadas (0/0), backend local levantado, `reseed_via_api.sh` corrido. **En Weaviate quedaron
los 15 objetos correctos** (10 FO / 5 LO), ambos named vectors (`image` 512 / `text` 1536), categorías por IA y
el modelo org/coordenadas de §9-quinquies aplicado (8 hallazgos sin coordenadas → heredan la sede; mochila y
auriculares con las de vía pública).

**🚧 BLOQUEANTE ABIERTO — las credenciales AWS de `.env.local` ya no sirven.** Los 10 POST de hallazgo
respondieron **500** con `S3Exception: The AWS Access Key Id you provided does not exist in our records` (403).
El formato de las claves es correcto (`AKIA…` de 20 + secret de 40), así que **la clave fue borrada/rotada en
AWS**, no es un problema de carga del `.env`. Como la subida a S3 es **asíncrona** (`executorService.submit`
en `FoundObjectService:181`), el objeto **igual se persistió en Weaviate** y el 500 salta al esperar el future
→ por eso hay datos pero **las fotos NO están en S3** (los `imageUrl` presignados no van a resolver).
**Para cerrar EU-325 hace falta una IAM key válida y volver a correr el reseed** (los vectores están bien; lo
único que falta es el objeto en el bucket).

**Validación de matches (`search-by-photo`, uno por par, con la foto y el texto de cada búsqueda):**

| Par | Categoría (búsqueda) | sim imagen (norm) | sim texto (norm) | score combinado | ¿Matchea? |
|---|---|---|---|---|---|
| Billetera (julia, org 1) | BILLETERA | **#1** 0.906 | **#1** 0.748 | **0.803** | ✅ |
| Auriculares (pedro, geo) | OTROS | **#1** 0.819 | **#1** 0.769 | **0.793** | ✅ |
| Mochila (valeria, geo) | OTROS | #3 0.673 | **#1** 0.728 | 0.700 | ❌ bajo umbral |
| Paraguas (julia, org 1) | OTROS | **#1** 0.617 | **#1** 0.547 | 0.582 | ❌ bajo umbral |
| Notebook (valeria, org 2) | **CELULAR** ⚠️ | **#1** 0.769 | **#1** 0.680 | 0.724 | ❌ filtro de categoría |

**Lecturas:**
1. **El algoritmo no tiene bug:** los scores observados reproducen exactamente `α·img + β·txt` de
   `application.yml` (billetera 0.35/0.65 → 0.803; el resto OTROS 0.5/0.5), el filtro duro de categoría no
   cruza y el geo no poda de más (geoModulator=1 en los pares cercanos).
2. **El par correcto sale #1 por texto en los 5 casos** y #1 por imagen en 4 de 5 (la mochila cae a #3: son
   dos mochilas azules **distintas** y la foto de búsqueda tiene marca de agua). **El ranking está bien; lo
   que falla es el umbral absoluto** `MIN_SCORE = 0.75` → **insumo directo de EU-327**.
3. **La normalización EU-142 queda probada otra vez**: el hallazgo dice `40.682.351` y la búsqueda `40682351`
   → texto #1 con 0.874 de certeza.
4. **⚠️ Error de categoría CONCRETO (no ambiguo→OTROS):** la foto de búsqueda de la notebook (tapa cerrada,
   casera) se clasificó **CELULAR**, mientras el hallazgo quedó en OTROS → el filtro duro los separa y el par
   **nunca se compara**, pese a ser el mejor candidato por imagen y por texto. Es exactamente el fallo que la
   decisión 8bis daba por improbable. **Va a EU-327 como caso testigo**: si se repite con datos reales,
   reabrir la discusión del override manual (o de fusionar CELULAR dentro de una categoría más abarcativa).
   **→ RESUELTO el 2026-08-01 (§10):** era un defecto estructural del clasificador, no mala suerte.
   Con `ELECTRONICA` + nube propia de OTROS, las dos fotos de la notebook caen del mismo lado y los
   anteojos dejan de irse a ROPA. Falta recargar el seed para re-validar el match.
5. **Rango del coseno de CLIP con material realista** (dos tomas/objetos distintos del mismo tipo): par
   correcto **0.81–0.95** de certeza, distractores **0.74–0.86** → **la zona gris se solapa**. Confirma que el
   umbral no se puede subir sin perder pares, y que el filtro duro por categoría es el que hace el trabajo
   pesado de separación. Insumo de EU-327.

---

## 10. Rework de las categorías duras (2026-08-01) — CELULAR → ELECTRONICA + nube propia para OTROS

Sale de investigar por qué la notebook del seed no matcheaba (§9-quinquies B-bis, punto 4). **Dos
defectos estructurales del clasificador, los dos medidos sobre las 12 fotos del seed.**

### Defecto 1 — OTROS no tenía descripciones propias

`CATEGORY_PROMPTS` sólo definía las **cuatro categorías concretas**; OTROS era únicamente el fallback
del empate. O sea que al modelo se le preguntaba *"¿esto es ropa, billetera, llaves o celular?"* **sin
ofrecerle "ninguna de las anteriores"**: un objeto fuera de esas cuatro quedaba forzado en la más
cercana salvo que las cuatro empataran. Por eso una notebook caía en CELULAR y unos anteojos en ROPA.

Los márgenes top1-top2 iban de **0.003 a 0.042** contra un corte de 0.03 → un acierto legítimo (celular
real, 0.034) y un error (notebook, 0.031) separados por tres milésimas. Decisión casi al azar.

**Fix:** OTROS tiene ahora nube propia (paraguas, mochila, botella, libro, anteojos, taza…) y sigue
siendo además el fallback del empate.

### Defecto 2 — la frontera "celular" obligaba a decidir cuán parecida a un celular es una notebook

**Fix (idea de Facundo):** `CELULAR` → `ELECTRONICA` (batería o enchufe: celular, notebook, tablet,
auriculares, cargador). La frontera pasa a ser física y se responde sola.

### Resultado medido (las 15 fotos del seed)

**15/15 bien clasificadas** y los márgenes pasan de **0.003-0.042** a **0.034-0.086**. Desaparecen los
dos errores conocidos: la notebook (que partía su par) y los anteojos→ROPA (deuda anotada para EU-327).
Los 5 pares caen **del mismo lado** en sus dos fotos, que es lo único que el filtro duro necesita.

**Consecuencia sobre los matches** (α/β no cambian: ELECTRONICA hereda el 0.50/0.50 de CELULAR, así que
los scores de los otros 4 pares quedan idénticos):

| Par | Antes | Ahora |
|---|---|---|
| Billetera | ✅ 0.803 | ✅ 0.803 |
| Auriculares | ✅ 0.793 | ✅ 0.793 |
| Notebook | ❌ **invisible** (categorías distintas) | ❌ **0.724** — ya se compara y sale #1, pero no llega a 0.75 |
| Mochila | ❌ 0.700 | ❌ 0.700 |
| Paraguas | ❌ 0.582 | ❌ 0.582 |

O sea: **el arreglo convirtió un fallo silencioso en un casi-acierto visible**, que es exactamente lo que
tenía que hacer. Los 3 pares que faltan quedan todos por umbral, con el par correcto **#1 en su ranking**
→ es un único problema de calibración (EU-327), no tres problemas distintos.

**Punto frágil restante:** la foto de búsqueda de la mochila queda en OTROS por **0.006** sobre
ELECTRONICA. Cae bien, pero si se diera vuelta partiría el par. Es la foto con marca de agua que ya
estaba anotada para reemplazar.

### Por qué NO muchas categorías finas (probado, no opinado)

Se midió un esquema de **12 categorías** (teléfono / computadora / audio / cargadores / bolsos /
paraguas / anteojos / botellas / libros + las 3 restantes):

| Foto | 5 categorías | 12 categorías |
|---|---|---|
| Notebook búsqueda | ELECTRONICA | **OTROS** ❌ (le ganó "cargadores" por 0.017) → **par partido** |
| Mochila búsqueda | OTROS | **OTROS** por empate 0.003 (bolsos 0.317 / computadora 0.315) → **par partido** |
| Celular limpio | ELECTRONICA ✅ | **OTROS** ❌ |
| Cargador | ELECTRONICA ✅ | **OTROS** ❌ |
| Paraguas · anteojos · auriculares | OTROS / OTROS / ELECTRONICA | **PARAGUAS ✅ · ANTEOJOS ✅ · AUDIO ✅** (márgenes 0.08 / 0.06 / 0.08) |

**El mecanismo:** una categoría no compite contra el objeto, compite contra **sus vecinas**. Agregar
"cargadores" no hace que el celular se reconozca mejor: le pone al lado una opción casi idéntica y el
margen —que es el mecanismo de seguridad— se evapora. Las tres categorías finas que **sí** funcionaron
son justamente las que **no tienen vecina parecida**.

**El límite no lo pone el catálogo de objetos perdibles** (que es chico), sino **cuánto varía el mismo
objeto entre dos fotos sacadas por dos personas distintas**: los dos paraguas del seed, casi idénticos
a ojo, dan 0.62 de similitud. Esa dispersión es mayor que la distancia entre dos categorías finas → las
fronteras tienen que ser **más anchas que el ruido de las fotos**.

**Y el costo es asimétrico:** categoría muy amplia → se comparan objetos de más, el puntaje los ordena
igual (recuperable y visible). Categoría muy fina → el par se parte, el objeto queda **invisible** para
su dueño y **nadie se entera** (no hay notificación que reclamar).

#### Segunda prueba: una categoría BOLSOS (mochilas / bolsos / carteras) — también DESCARTADA

Propuesta de Facundo, y a priori la mejor candidata: un bolso es visualmente distinto de todo lo demás.
Se midió un esquema de **6 categorías** (las 5 actuales + `BOLSOS`: backpack, school bag, handbag, purse,
tote, duffel, suitcase, shoulder bag), moviendo `a purse` fuera de BILLETERA —una cartera se parece mucho
más a un bolso que a una billetera—. **Falló por dos lados:**

| | 5 categorías | 6 con BOLSOS |
|---|---|---|
| Mochila hallazgo | OTROS | BOLSOS (margen 0.053) |
| **Mochila búsqueda** | OTROS | **OTROS** ❌ (BOLSOS 0.317 vs ELECTRONICA 0.311, empate 0.006) → **par partido** |
| Billetera hallazgo / búsqueda | 0.076 / 0.074 | **0.044 / 0.034** ← al borde del corte de 0.03 |

1. **Parte el par de la mochila**: la foto de búsqueda (la de la marca de agua) es ambigua para el modelo,
   y con BOLSOS disponible el hallazgo la elige y la búsqueda no. **Con OTROS ancho esa misma foto cae
   OTROS de los DOS lados y el par sobrevive** → una categoría ancha **absorbe el ruido de una foto mala**;
   una fina lo convierte en una discrepancia.
2. **Desestabiliza BILLETERA**: las carteras son vecinas visuales de las billeteras, así que BOLSOS le come
   el margen (0.076→0.044 y 0.074→0.034). Ese efecto es **estructural**, no culpa de la foto mala.

Y "cartera" expone que la frontera **no es 0-ambigua** (decisión 5): una cartera chica de mano es
simultáneamente candidata a BILLETERA y a BOLSOS, y el usuario que busca no sabe cuál eligió el modelo.

**Decisión: quedan 5.** La vara para una sexta pasa a ser más exigente que "es inconfundible": hay que
verificar además que **los dos lados de un par la elijan aun con fotos malas**. *Salvedad: son 15 fotos;
alcanza para ver que el mecanismo se degrada, no para fijar el número óptimo. Eso es EU-327 —y ahí vale
reintentar BOLSOS con fotos mejores, porque la intuición visual es razonable y lo que la tumbó acá fue una
foto ambigua más el solapamiento cartera/billetera.*

### Rango real del coseno de CLIP — matriz completa del seed (insumo duro para EU-327)

Las 15 fotos, todas contra todas (5 pares verdaderos + 100 combinaciones de objetos distintos):

| | mínimo | máximo | media |
|---|---|---|---|
| **Pares verdaderos** (5) | 0.617 (paraguas) | 0.906 (billetera) | 0.757 |
| **Objetos distintos** (100) | **0.405** | **0.946** | 0.618 |

**Los dos rangos se solapan casi por completo, y el peor caso es contraintuitivo:** las **dos billeteras
distintas** (hallazgo vs distractor de Laura Fernández) dan **0.946** — más que **cualquier** par
verdadero, incluido el de la billetera (0.906). Objetos de la misma clase y color son visualmente más
parecidos entre sí que el mismo objeto fotografiado dos veces en contextos distintos.

Con el umbral actual de 0.75 sobre la parte visual: **5 de 100 combinaciones no relacionadas quedan por
encima** y **2 de 5 pares verdaderos por debajo**. O sea que **la similitud visual sola no separa**: no
hay ningún corte que deje los pares de un lado y el resto del otro. Lo que sostiene la precisión es la
combinación —filtro duro de categoría + texto con su α/β— y no el coseno de la imagen.

Sólo el **10%** de los objetos distintos baja de 0.5, y el mínimo absoluto es **0.405**: el coseno no
llega ni cerca de 0 entre objetos sin relación. Toda la señal vive en una franja angosta y alta
(~0.4-0.95, centrada en 0.62), mientras `normalizeCosineScore` la mapea como si ocupara 0-1.
**Ahí está la recalibración de EU-327:** reescalar sobre el rango real en vez de asumir que 0.5 es el piso.

### Umbral de clasificación: se expresa en CONFIANZA, no en margen de coseno (2026-08-01)

**El rango angosto del coseno no es una rareza nuestra: es el diseño de CLIP.** Por el *modality gap*,
imágenes y textos ocupan dos conos separados del espacio, así que el coseno imagen-texto nunca se acerca
a 1 (la media documentada del par correcto es **~0.22**, unos 78°). Para compensarlo CLIP **aprende** un
`logit_scale` —topeado en 100 por el paper— que es el factor con el que hay que leer esos cosenos.
Verificado sobre el modelo que corremos: **`logit_scale = 100.0`**.

Leídos así, los márgenes que parecían milésimas son enormes:

| Margen de coseno | En logits | Ventaja |
|---|---|---|
| 0.006 (mochila búsqueda) | 0.6 | 1.8 : 1 — duda real |
| 0.030 (el corte viejo) | 3.0 | 20 : 1 (~95%) |
| 0.051 (notebook búsqueda) | 5.1 | 164 : 1 |
| 0.086 (auriculares) | 8.6 | 5432 : 1 |

**Corrección a la lectura anterior de §10:** decir que 0.031 vs 0.034 era "una moneda al aire" estaba MAL
—ambos son ~97%—. La notebook **no** se clasificaba mal por dudar: se clasificaba **con seguridad y mal**,
porque la opción correcta no estaba en el menú. Refuerza el fix (nube propia de OTROS), pero por otro
motivo. Las monedas al aire de verdad eran los márgenes de 0.003-0.007 del esquema viejo (1.03 : 1).

**Implementado:** `classify_image` hace softmax de los cosenos escalados por el `logit_scale` del modelo y
corta por `CLASSIFY_MIN_CONFIDENCE` (0.90, elegido para replicar el corte anterior). `/classify` devuelve
`confidence` y `confidences`; el DTO Java lo mapea y `ClipImageClassificationService` lo loguea, para poder
**medir en producción qué porcentaje de las clasificaciones reales es dudoso** (insumo de EU-327).
`CLASSIFY_MIN_SIM` (0.22) queda como piso absoluto. **Las 15 fotos clasifican igual**, y ahora se ve que
**14 de 15 están entre 95% y 100%**; la única dudosa es la mochila con marca de agua (**63.6%**), que cae
en OTROS —la categoría ancha— que es donde debe caer una duda.

### Similitud entre imágenes: el problema es el ESPACIO, no la métrica (2026-08-01)

Pregunta de Facundo: ¿es el coseno la métrica adecuada? Respuestas de la literatura, ambas verificadas acá:

**1. CLIP es un modelo SEMÁNTICO, no de identidad de instancia.** Está entrenado para alinear imagen con
texto, así que codifica *"una billetera marrón"*, no *"ESTA billetera"*. Por eso dos billeteras marrones
**distintas** dan 0.946, más que cualquier par verdadero. Para "¿es el mismo objeto?" el estado del arte es
**DINOv2** (auto-supervisado, entrenado para detalle visual fino: distingue dos sillas de distinto color
donde CLIP no). Cambiar de modelo es una story aparte y grande —hay que re-vectorizar todo—, pero es la
respuesta correcta al problema de fondo. **Nota:** se perdería la clasificación zero-shot, que necesita el
lado texto de CLIP → convivirían los dos modelos (DINOv2 para similitud, CLIP para categoría).

**2. Mean-centering: barato, estándar y MEDIDO acá.** Los embeddings de CLIP viven en un cono (de ahí que
todo dé 0.4-0.95). Restar la media del corpus y re-normalizar recentra el espacio en 0. **No es monótono
→ SÍ cambia el ranking**, a diferencia del reescalado lineal:

| | pares verdaderos | objetos distintos | distintos por encima del peor par | pares en #1 |
|---|---|---|---|---|
| Crudo (hoy) | 0.617-0.906 | 0.405-0.946 | **50 de 100** | **4 de 5** |
| Centrado (media de las mismas 15) | 0.120-0.700 | −0.367-0.801 | **9 de 100** | **5 de 5** |
| Centrado (media independiente, 12 fotos ajenas) | 0.387-0.870 | 0.094-0.918 | 70 de 100 | **5 de 5** |

**El par de la mochila pasa de #4 a #1 con las DOS medias** → el arreglo del ranking es robusto, no un
artefacto de haber calculado la media sobre las mismas fotos. Lo que sí depende de la media es la
*magnitud* de la separación: con una media del dominio correcto (fotos de objetos perdidos) mejora mucho;
con una media ajena (paisajes/retratos) mejora poco. **Para implementarlo:** calcular la media sobre un
corpus representativo de fotos reales, **congelarla** como constante del servicio (si cambia, hay que
re-vectorizar todo) y **recalibrar los umbrales**, porque la escala se mueve entera. **No resuelve** el
problema de las dos billeteras parecidas —eso es el punto 1—, pero es mucho más barato.

**Sobre el reescalado lineal** (0.4→0, etc.) que se propuso antes: es monótono, así que **no cambia ningún
ranking ni mejora la precisión**. Sirve para que el % que ve el usuario signifique algo y para que el umbral
sea una perilla manejable. El centrado hace las dos cosas *y además* mejora el ranking → **si se hace uno
solo, que sea el centrado.**

### Qué se tocó

- `clip-service/app.py` — `CATEGORY_PROMPTS` (ELECTRONICA + nube de OTROS) y el comentario con el porqué.
- `clip-service/README.md`, `Backend/src/test/resources/fixtures/README.md` — documentación.
- `ObjectCategory.java` — `CELULAR` → `ELECTRONICA` (+ javadoc con el criterio y la medición).
- `ScoringProperties.java` y `application.yml` — la fila de pesos α/β pasa a `ELECTRONICA` (sigue 0.50/0.50).
- `ObjectCategoryTest` — test nuevo: la etiqueta vieja `CELULAR` cae en OTROS por el camino defensivo y
  **no rompe** el backend. Suite completa verde (164; los 4 rojos son los tests de contexto que necesitan
  MySQL, ambiental).
- `clip-service/app.py` — `classify_image` corta por **confianza** (softmax con el `logit_scale` del modelo)
  en vez de margen de coseno; `/classify` devuelve `confidence` y `confidences`.
- `ClipClassificationResponse.java` (+ campo `confidence`) y `ClipImageClassificationService` (lo loguea).
- `a purse` → `a coin purse` en BILLETERA: "purse" es CARTERA en inglés y arrastraba bolsos de mano a la
  categoría text-heavy. Medido: los scores de las 3 billeteras del seed no se mueven.

**⚠️ Pendiente:** los 15 objetos que están hoy en Weaviate se cargaron **antes** de este cambio, así que
tienen las categorías viejas (la notebook con `CELULAR`, los anteojos con `ROPA`). **Hay que recargar el
seed** —cosa que ya había que hacer igual por las credenciales de AWS—; recién ahí se re-valida el match
de la notebook.

---

### (C) Shellscript definitivo del seed (paso final de EU-325)

**HECHO (2026-08-02).** El seed definitivo **inyecta directo a Weaviate**, no por API. Ver §11 punto 4 para el
detalle, el porqué y la receta de regeneración.

<details><summary>Decisión anterior (revertida el 2026-08-02)</summary>

Se había anotado "cargar **por API real**, no inyectar NDJSON". Facundo lo corrigió: la carga por API es
sólo el **bootstrap**, porque **resubiría las 15 fotos a S3 en cada corrida de cada máquina** (el nombre del
archivo en S3 es el UUID que Weaviate le asigna al objeto, y cambia en cada carga). El seed de todos los días
inyecta el snapshot con los UUIDs congelados.

</details>

---

## 11. HANDOFF — retomar acá (escrito 2026-08-01, para chat limpio)

> **EU-325 CERRADA.** Los cinco puntos de abajo quedaron cerrados el 2026-08-01; están con el detalle de lo
> verificado, pero no hay que rehacerlos. **No hay bloqueantes abiertos.** Lo próximo del rework es
> **EU-327 (calibración de umbrales + mean-centering)** — ver el punto 5.
> El entorno puede estar apagado: si es así, levantar contenedores y correr **un solo comando**:
> `bash Backend/seed-data/seed.sh` (inyecta el snapshot directo a Weaviate, sin backend y sin tocar S3).

### Lo próximo, en orden

1. ✅ **RESUELTO (2026-08-01 tarde) — S3 era el nombre del bucket.** El compañero que administra AWS avisó
   que el bucket correcto es **`eurekapp-temp`** (el mismo de `application.yml`), no `eurekapp-temp-local`.
   Cambiado en `application-local.yml:18` y `seed-local.sh:527`. Verificado de punta a punta: **los 15 POST
   del reseed dan 200** (antes los 10 de FOUND daban 500) y la URL presignada que devuelve la búsqueda
   **descarga la foto real (HTTP 200, 43 KB)**. La región sigue siendo `sa-east-1`, que es la hardcodeada
   en `S3Service.java:54`, así que no hubo que tocar nada más.
   - *Señal para diagnosticar a futuro:* `AllAccessDisabled` = la cuenta dueña del bucket está de baja;
     `AccessDenied` = la cuenta vive y es permisos. `eurekapp-temp-local` daba lo primero y `eurekapp-temp`
     lo segundo — ahí se vio cuál era el bucket sano antes de tocar la config.
   - ⚠️ **Nota:** el perfil local ahora escribe en el **mismo bucket que el perfil por defecto**. Las fotos
     del seed conviven con las demás. No molesta para esto, pero conviene saberlo.

<details><summary>Historial del bloqueante (ya resuelto)</summary>

**🚧 BLOQUEANTE — S3: falta el BUCKET, ya no la credencial.**
   - **Credencial nueva: YA PUESTA en `Backend/.env.local` y verificada.** Autentica bien contra AWS como
     `arn:aws:iam::324859422062:user/eurekapp-user`. (El archivo está gitignoreado — `Backend/.gitignore:37`—
     así que las claves NO están en el repo ni en este tracker; si hace falta, pedírselas a Facundo.)
   - **Lo que falla ahora es el bucket:** `eurekapp-temp-local` (sa-east-1) responde **`AllAccessDisabled`**
     a PUT/GET/DELETE. Ese error NO es de permisos (eso sería `AccessDenied`, que es lo que devuelve el
     `ListAllMyBuckets` y es esperable por privilegio mínimo): AWS lo devuelve cuando **la cuenta dueña del
     bucket está suspendida/dada de baja**. La lectura más probable: el bucket vive en la **cuenta vieja**
     —la misma cuya access key había desaparecido— y la credencial nueva es de **otra cuenta**, que todavía
     no tiene ese bucket.
   - **Qué falta hacer (lo tiene que hacer Facundo en la consola de AWS):** (a) crear el bucket en la cuenta
     nueva, preferentemente con el mismo nombre `eurekapp-temp-local` y **en `sa-east-1`**, porque la región
     está HARDCODEADA en `S3Service.java:54` (`Region.SA_EAST_1`) —si va en otra región hay que tocar esa
     línea—; (b) darle a `eurekapp-user` `s3:PutObject`/`s3:GetObject`/`s3:DeleteObject` sobre él; (c) si el
     nombre cambia, actualizar `application-local.yml:17`.
   - **Cómo verificar antes de correr el reseed** (evita otra corrida a medias): un PUT+GET+DELETE firmado
     contra el bucket. Ojo con la región: `https://<bucket>.s3.<region>.amazonaws.com`; con la región
     equivocada AWS devuelve `301 PermanentRedirect` (y `curl -I` sobre el bucket revela la región real en
     el header `x-amz-bucket-region`).
   - **Por qué bloquea:** sin S3 el reseed carga los vectores igual pero **las fotos no llegan al bucket**
     (la subida es asíncrona: el objeto se persiste, y el POST devuelve 500 al esperar el future). Los
     `imageUrl` presignados no resuelven → sirve para medir matching, no para demo.

</details>
2. ~~**Recargar el seed**~~ **HECHO (2026-08-01 tarde).** Reset + reseed corridos **dos veces**: la primera
   con S3 roto (los 10 FOUND en 500, pero vectores y categoría persistidos igual) y la segunda ya con el
   bucket arreglado, **15/15 en 200 y las fotos en S3**. **15/15 objetos con las categorías nuevas de §10**
   y los 5 pares del mismo lado. El seed actual en Weaviate es el bueno, con fotos.
3. ~~**Re-validar los 5 pares**~~ **HECHO — reproduce §10 exactamente**, ejercitando el endpoint real
   `POST /found-objects/search-by-photo`: billetera ✅ **0.8032** #1 · auriculares ✅ **0.7925** #1 ·
   notebook / mochila / paraguas por debajo de 0.75 (no se devuelven). Sin sorpresas: lo pendiente sigue
   siendo puro umbral (EU-327).

   ⚠️ **Bug de DATOS del seed encontrado y corregido en el camino** (`reseed_via_api.sh`): las 5 fechas de
   pérdida estaban **un día DESPUÉS** del hallazgo de su par (billetera perdida el 29, encontrada el 28).
   El filtro de Weaviate es `found_date >= lostDate` (`FoundObjectRepository.java:169`) y es **correcto**
   —si lo perdí el 29, un hallazgo del 28 no puede ser mío—, así que **las 5 búsquedas devolvían lista
   vacía** aunque los vectores y las categorías estuvieran perfectos. Corregidas a un `lost_date` dos horas
   ANTES del `found_date` de su par. **Lección para futuras corridas: una lista vacía con categoría
   correcta es sospecha de filtro de fecha, no de matching.**
4. ✅ **HECHO (2026-08-02) — `Backend/seed-data/seed.sh` es el seed definitivo, y carga DIRECTO A WEAVIATE.**
   Un solo comando (`bash Backend/seed-data/seed.sh`), **sin backend, sin CLIP y sin tocar S3**: preflight de
   Weaviate + snapshot, drop+recreate de clases, POST a `/v1/objects` con `id` + propiedades + los dos named
   vectors, y validación final (conteos 10/5, 15/15 con categoría, vectores 512/1536).

   **Por qué NO va por API** (corrección de Facundo, 2026-08-02): el nombre del archivo en S3 **es el UUID
   que Weaviate le asigna al objeto** (`S3Service.putObject(bytes, foundObjectId)`, y la URL presignada usa
   `foundObject.getUuid()` — `FoundObjectService.java:181,413`). Ese UUID **cambia en cada carga por API**, así
   que un seed por API resubiría las 15 fotos y dejaría las anteriores huérfanas, en cada máquina y en cada
   corrida. Con el snapshot los UUIDs quedan **congelados** y las fotos ya subidas siguen sirviendo.

   **Los objetos encontrados/perdidos NO están en MySQL**: viven sólo en Weaviate (MySQL tiene usuarios,
   organizaciones, devoluciones, fraude, etc., y eso lo siembra `start-local.sh`). Por eso el seed toca una
   sola base.

   **Piezas y roles:**
   - `seed.sh` — **lo que se corre siempre.** Carga `snapshot/{FoundObject,LostObject}.ndjson`. Segundos, sin cuota.
   - `dump_seed.sh` — **bootstrap, casi nunca.** Vuelca lo que hay en Weaviate (id + propiedades + vectores) al snapshot.
   - `reseed_via_api.sh` — **bootstrap, casi nunca.** Carga por API real (reglas de negocio + CLIP + clasificación
     + subida a S3). Es el único que sube fotos.
   - **Receta para regenerar** (si cambian fotos, textos, objetos o esquema): backend arriba →
     `reset_weaviate_classes.sh` → `reseed_via_api.sh` → validar matches → `dump_seed.sh` → commitear `snapshot/`.
   - `generate_seed_vectors.py` queda como alternativa histórica, no se usa.

   **Verificado de punta a punta con el snapshot cargado:** 10/5 objetos, 15/15 con categoría, vectores
   512/1536, y `search-by-photo` devuelve el par de la billetera **#1 con 0.7852** — idéntico a la carga por
   API — con la **URL presignada bajando la foto real (HTTP 200, 43 KB)**, que es la prueba de que los UUIDs
   congelados siguen apuntando a S3.

   - *Hallazgo del camino:* la respuesta del POST de alta **no trae `category`** (el DTO no la expone), así que
     el `grep` que `reseed_via_api.sh` hacía sobre la respuesta nunca matcheaba — parecía "sin categoría"
     cuando estaba bien clasificado. Las categorías se validan **contra Weaviate**; el grep muerto se sacó.
   - *Firma de `search-by-photo` para probar a mano:* `file` + `query` (ambos obligatorios) +
     `organizationId`/`lostDate`/`latitude`/`longitude` — **en camelCase**, no snake_case.
5. ✅ **DECIDIDO (Facundo, 2026-08-01): el mean-centering va a EU-327, NO ahora.**
   Es el único cambio medido que mejora el RANKING (mochila de #4 a #1), pero al restar la media todos los
   puntajes cambian de escala: el umbral de 0.75 deja de significar lo mismo y hay que recalibrarlo. Como
   EU-327 **es** la tarea de calibración, meterlo antes obligaría a calibrar dos veces.
   **Requisitos para cuando se implemente:** (a) la media tiene que quedar **congelada** —si se recalculara
   con cada objeto nuevo, los puntajes de ayer y los de hoy dejarían de ser comparables—; (b) recalibrar los
   umbrales con mediciones nuevas; (c) está medido que funciona con dos medias distintas (ver §10).

### Estado del entorno al cerrar

- Contenedores arriba: `eurekapp-mysql` (:3306), `eurekapp-weaviate` (:8081, 1.24.1), `eurekapp-clip` (:8000,
  **rebuildeado con las categorías y el umbral de confianza nuevos**).
- **Backend arriba** (:8080, perfil local). **Weaviate con los 15 objetos NUEVOS** (categorías de §10,
  fechas corregidas) → no hace falta recargar.
- ✅ **S3 funcionando** con el bucket `eurekapp-temp`. Ya no hay bloqueantes abiertos.
- Rama `EU-320-rework-algoritmo-busqueda`. Todo lo de §10 **commiteado**.

### Qué NO hace falta rehacer (ya está medido y documentado en §10)

- El rango real del coseno de CLIP (matriz completa del seed + piso con fotos diversas: **0.358**).
- Que las categorías finas rompen (probado con 12 categorías y con BOLSOS).
- Que el `logit_scale` del modelo es **100.0** y cómo se leen los márgenes.
- Que el mean-centering arregla el ranking de la mochila con dos medias distintas.
- Que la resolución **no** explica el par flojo del paraguas (una foto a 32px se parece a sí misma en 0.75-0.81).

### Fotos del seed que parecen defectuosas pero NO hay que reemplazar

Las dos "rarezas" del seed son en realidad los casos más realistas que tiene, y le ponen un piso honesto
a la calibración. **No reemplazarlas.**

- **El par del paraguas** (catálogo vs calle) queda bajo por encuadre, no por defecto. Es el peor par
  verdadero y por eso mismo es el que fija el umbral en §12.
- **La foto de búsqueda de la mochila tiene marca de agua de Dreamstime** y es la de clasificación más
  dudosa (63.6%). Se había anotado como deuda "a reemplazar antes de una demo"; **reencuadrado el
  2026-08-05 (Facundo): no es un defecto.** Un usuario no técnico que busca su mochila perfectamente
  puede agarrar una foto de catálogo de Google, con marca de agua incluida — es exactamente el material
  que va a llegar en producción. Sacarla del seed haría la medición más linda y menos representativa.

---

## 12. EU-327 — Calibración del umbral y curva de presentación (2026-08-03)

### El criterio (decisión de Facundo)

> El umbral debe ser **el más alto posible que aún devuelva los 5 pares verdaderos**, menos **0.05**
> de margen. Y a partir de ahí, una **función no lineal sobre el puntaje final** que haga que ese
> umbral se le muestre al usuario como **75%** — el profesor pidió que una coincidencia verdadera
> aparezca con al menos 75%.

Las dos mitades son independientes a propósito: **el umbral decide qué se muestra** (lo fijan los datos)
y **la curva decide con qué número se muestra** (lo fija el criterio de producto). La curva es monótona,
así que no toca el ranking ni cambia qué candidatos pasan el corte.

### Mediciones (sobre el snapshot del seed, sin levantar backend)

Puntajes **crudos** de `combinedScore` para los 5 pares verdaderos, con el filtro duro por categoría
y el modulador geográfico ya aplicados:

| par | puntaje crudo | mostrado (curva) |
|---|---|---|
| paraguas (catálogo vs calle) | **0.5820** ← el piso | 78% |
| mochila | 0.7001 | 85% |
| notebook | 0.7248 | 86% |
| auriculares | 0.7925 | 90% |
| billetera | 0.8032 | 90% |

**Umbral crudo = 0.5820 − 0.05 = 0.5320.** Los 5 pares entran y los 5 se muestran por encima de 75%.

### El mean-centering se DESCARTA (revierte lo previsto en §11 punto 5)

§10 lo había medido como el único cambio que mejoraba el ranking (la mochila de #4 a #1). Con el criterio
de umbral de arriba, **deja de convenir**, y el ranking ya no lo necesita:

| variante | peor par | umbral (−0.05) | mejor falso | margen |
|---|---|---|---|---|
| **sin centrar (elegida)** | 0.5820 | **0.5320** | 0.6736 | **−0.0916** |
| centrar imagen | 0.3640 | 0.3140 | 0.5932 | −0.2293 |
| centrar imagen y texto | 0.2190 | 0.1690 | 0.4105 | −0.1915 |

**Por qué empeora:** el centrado remueve la componente común a todos los embeddings de CLIP. Eso castiga
más a las coincidencias *flojas* —que es de lo genérico ("un paraguas negro") de lo que dependen— que a
los falsos *fuertes*, que comparten algo más específico que el promedio del corpus. El peor par pierde
0.218 y el mejor falso sólo 0.080. Y como el umbral se fija en el par más débil, empeora justo donde duele.

**El beneficio de ranking ya lo da gratis el filtro duro por categoría:** los 5 pares salen #1 en su
categoría sin centrar nada. **No re-proponer** sin datos nuevos que contradigan esta tabla.

### Dos correcciones de diagnóstico anotadas en el camino

1. **`normalizeCosineScore` no es un reescalado arbitrario.** Weaviate devuelve `certainty = (coseno+1)/2`,
   y `(certainty − 0.5) × 2` es exactamente su **inversa**: recupera el coseno crudo. No hay nada que
   arreglar ahí, y explica por qué los números coinciden con los ya medidos en §11.
2. **El falso positivo de las dos billeteras marrones NO es falta de datos identificatorios.** El seed ya
   trae DNI y nombre en `human_description` de ambas (`40.682.351 / Martin Gomez` vs `33.145.892 /
   Laura Fernandez`) — el campo se llama `human_description`, no `description`. El mecanismo se prueba y
   funciona: en texto el par verdadero gana 0.7478 a 0.6080.

### El único falso positivo que sobrevive

Consulta de la billetera contra "Billetera marron con DNI" (otra billetera marrón, de otra persona):

| | imagen | texto | combinado (α=0.35 / β=0.65) |
|---|---|---|---|
| par verdadero | 0.9060 | 0.7478 | **0.8032** ← #1 |
| falso | 0.8906 | 0.6080 | 0.7069 ← #2 |

**No es un error de ranking:** en su propia consulta el algoritmo acierta y el falso queda #2. Se cuela por
encima del umbral sólo porque el corte lo fija el paraguas, que es una consulta distinta y mucho más débil.
El margen en **imagen** es de apenas 0.0154 — ése sí es el techo de CLIP descrito en §10 (codifica *"una
billetera marrón"*, no *"esta billetera"*); lo que salva el caso es el texto. **Salida de fondo: DINOv2**,
story aparte. **Aceptado y documentado como limitación conocida.**

### Qué se tocó

- `ScoringProperties.java` — propiedad nueva `matchThreshold` (0.5320) + getters/setters.
- `application.yml` — `search.scoring.match-threshold: 0.5320`, con el porqué del número.
- `SearchScoringService.java` — `isCombinedMatch(crudo)`, `displayScore(crudo)` y `matchThreshold()`.
  El exponente de la curva se **deriva** del umbral (`k = ln(0.75)/ln(umbral)`) en vez de ser una segunda
  constante suelta: si se recalibra el umbral, el piso mostrado sigue cayendo en 75% solo.
  El `MIN_SCORE = 0.75` legacy **queda intacto** — lo usa la búsqueda textual vieja (MOORA 95/5), que es
  otra escala y no se calibró acá.
- `FoundObjectService.java` — `searchByPhoto` filtra por el umbral **crudo** y recién después remapea a la
  escala de presentación.
- `LostObjectService.java` — la búsqueda inversa (notificaciones) usa el mismo corte y la misma curva.
- Tests: 6 nuevos en `SearchScoringServiceTest` (21 verdes) — el corte en el umbral, que el umbral mapea a
  exactamente 75%, que la curva es estrictamente creciente y respeta los extremos, que los 5 pares del seed
  se muestran ≥75%, que el exponente sigue al umbral si se recalibra, y el borde degenerado.
  `FoundObjectServiceTest` actualizado al contrato nuevo. **Suite: 170 tests, Failures: 0**; los 4 errores
  restantes son los tests de contexto que necesitan MySQL (ambiental, ver memoria).

### Verificación de punta a punta (endpoint real `POST /found-objects/search-by-photo`)

Los 5 pares, contra el backend levantado con el código nuevo y el seed cargado:

| consulta | resultado | mostrado |
|---|---|---|
| billetera | **#1** Billetera de cuero marron | **90.5%** |
| auriculares | **#1** Auriculares inalambricos blancos | **89.9%** |
| mochila | **#1** Mochila azul con libros | **85.0%** |
| paraguas | **#1** Paraguas negro plegable | **78.1%** |
| notebook | **#1** Notebook Dell gris | **86.4%** |

**5/5 devueltos, 5/5 en primer lugar, 5/5 por encima del 75%.** Antes de EU-327 sólo volvían dos
(billetera y auriculares); mochila, notebook y paraguas quedaban por debajo del corte. Los porcentajes
coinciden exactamente con los predichos offline sobre el snapshot, lo que valida que la medición del
snapshot y el camino productivo dan lo mismo.

*Nota:* en la consulta de la billetera el falso positivo conocido **no aparece**, porque vive en la
organización 2 y la búsqueda se hizo sobre la 1: el filtro por organización lo excluye antes del scoring.

<details><summary>Trampas al probar a mano (costaron un rato)</summary>

- La respuesta usa **`found_objects` en snake_case**, no `foundObjects`. Un parser que busque camelCase
  ve "sin resultados" cuando en realidad el match volvió perfecto.
- Los parámetros del form-data sí van en **camelCase** (`organizationId`, `lostDate`, `latitude`,
  `longitude`) — al revés que el cuerpo de la respuesta.
- `organizationId` es **opcional**: mandarlo restringe la búsqueda a esa organización.
- Para ver los puntajes hay que levantar el backend con
  `-Dspring-boot.run.jvmArguments=-Dlogging.level.com.eurekapp.backend=DEBUG`; el log imprime
  `simImg`/`simTxt`/`score` y el umbral por candidato.
- En ese log **`simImg` es la *certainty* de Weaviate**, no el coseno: `certainty = (coseno+1)/2`. Un
  `simImg=0.9530` es un coseno de 0.9060.

</details>

### Lo que queda de EU-327 se DIFIERE (decisión de Facundo, 2026-08-05)

Los tres puntos abiertos quedan para otro momento. **La lógica ya está implementada y los valores son
parámetros de configuración**: retomar esto es cambiar números, no escribir código.

- **α/β por categoría** — calibrarlo en serio exige un dataset bastante más grande que los 5 pares del
  seed. Con lo que hay, cualquier número que saliera sería ruido con apariencia de medición. Siguen los
  valores puestos a criterio en EU-324 (`application.yml`).
- **Rango del modulador geo** — **no es calibrable por experimento: es una decisión de negocio.** Cuánto
  debe penalizar la distancia lo define el producto, no los datos; un experimento sólo diría en qué punto
  el modulador empieza a tirar matches por debajo del umbral, y eso se deduce de la fórmula.
- **Tasa de error de categorización** — reformulada, y la reformulación importa: **lo que hay que medir no
  es la exactitud absoluta sino la CONSISTENCIA entre las dos fotos del mismo objeto.** Que la IA le ponga
  a un paraguas una categoría discutible es inofensivo si le pone la misma al objeto encontrado y a la
  búsqueda perdida; lo grave —y lo que tiene que ser excepcionalmente raro— es que caigan de lados
  distintos, porque el filtro duro los separa y el match se pierde **en silencio**. Medido hasta acá:
  **los 5 pares del seed caen del mismo lado, 5/5.** Muestra chica, pero es la métrica correcta.

### Hallazgo lateral: los "4 tests ambientales" son en realidad DOS problemas

Con MySQL levantado (2026-08-05) se separó lo que hasta ahora se anotaba como un solo bloque ambiental:

- **`BackendApplicationTests.contextLoads`** — era falta de variables de entorno, no de base. Corriendo
  con MySQL arriba **y** exportando `DATABASE_URL` / `DATABASE_USER` / **`DATABASE_PASS`** (ojo: `PASS`,
  no `PASSWORD`) más las de `Backend/.env.local`, **pasa**.
- **`EndpointSecurityTest`** (3 tests) — **no usan MySQL**, usan H2 en memoria, y fallan por un **bug de
  configuración real**: `application.yml` define `spring.datasource.hikari.connection-init-sql:
  "SET NAMES utf8mb4"`, sintaxis exclusiva de MySQL que H2 rechaza. **Ningún contenedor los arregla.**
  Pendiente aparte, ajeno al rework: overridear esa propiedad para el perfil `test`.

**A ARREGLAR — `EndpointSecurityTest` (3 tests).** Es un bug de configuración real, chico y ajeno al
rework, pero deja la suite en rojo permanente y eso entrena a ignorar el resultado. `application.yml`
define `spring.datasource.hikari.connection-init-sql: "SET NAMES utf8mb4"` para forzar el charset en
MySQL; el perfil `test` levanta **H2 en memoria**, que no entiende esa sentencia y aborta el contexto.
Arreglo: overridear la propiedad a vacío para el perfil `test` (hoy no hay `application-test.yml` en
`src/test/resources/`, hay que crearlo). Ojo al hacerlo: la propiedad tiene que quedar **vacía, no
borrada del `application.yml`** — en MySQL sigue haciendo falta.

Comando que deja la suite en 170 tests / 0 failures / 3 errores (sólo los de H2), desde `Backend/`:

```bash
export DATABASE_URL='jdbc:mysql://localhost:3306/eurekapp?useUnicode=true&characterEncoding=UTF-8'
export DATABASE_USER=eurekapp DATABASE_PASS=eurekapp
# + cargar Backend/.env.local (JWT_SIGN_KEY, OPENAI_SECRET_KEY, MAIL_*)
./mvnw test
```
