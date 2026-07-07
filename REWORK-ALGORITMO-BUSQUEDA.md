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
| 5 | Regenerar el seed con dos vectores + categoría | EU-325 | 4 | TODO | **Manual**: requiere datos reales de Facundo. Depende de 3 **y de 4** (necesita la huella visual CLIP cableada). Cubre `seed-local.sh` COMPLETO: (a) el bloque que recrea el esquema (líneas ~159-196, hoy copia duplicada en formato viejo → pasarlo a named vectors image+text, +category en LostObject, −ai_description) **y** (b) los NDJSON `seed-data/{FoundObject,LostObject}.ndjson` (hoy `vector` único → `vectors:{image,text}` + category + sin ai_description). Van acoplados: el seed recrea el esquema e inserta los NDJSON, así que tocar uno sin el otro rompe la inserción. **Ojo:** mientras EU-325 no se haga, correr `seed-local.sh` revierte el esquema de EU-323 (recrea las clases en formato de vector único) |
| 6 | Frontend: foto obligatoria, quitar descripción IA | EU-326 | 5 | TODO | En paralelo una vez definido el contrato del back. Al guardar, reenviar la foto; mostrar imageUrl en detalle de búsqueda guardada. **Mostrar la categoría clasificada por IA (read-only)** al usuario: si la ve mal elegida, el recurso es **reintentar con otra foto** (NO se habilita override manual —ver decisión abajo—). Requiere que el back devuelva la categoría en la respuesta de la búsqueda (324-D) |
| 7 | Calibración (coseno CLIP, α/β, rango geo) | EU-327 | 4 | TODO | Empírica; aislada de la implementación. **Revisar la tasa de error de categorización con datos reales**: si la IA confunde categorías CONCRETAS (no el caso ambiguo→OTROS, que es el esperado) más de lo tolerable, reconsiderar habilitar override manual de categoría (hoy descartado, ver decisión abajo) |

Orden sugerido: **1 → 2 → 3 → 4 → 5 → 7**, con **6** en paralelo desde que el contrato del back esté claro.

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
