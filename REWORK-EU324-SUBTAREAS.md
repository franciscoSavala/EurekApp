# EU-324 — Algoritmo de scoring (subtareas de trabajo)

> Archivo **temporal** de progreso para partir EU-324 (el "corazón") en subtareas atómicas y poder
> hacer `/clear` entre una y otra sin perder el hilo. Se **borra** cuando EU-324 pase a HECHO y se
> actualice la tabla de estado en [REWORK-ALGORITMO-BUSQUEDA.md](REWORK-ALGORITMO-BUSQUEDA.md).
>
> Contexto completo del rework: **REWORK-ALGORITMO-BUSQUEDA.md**. Leer eso primero.

## Decisión de contrato confirmada (2026-07-05)

**Ubicación OBLIGATORIA en la búsqueda** (organización o coordenadas): sin ella no se puede
circunscribir el radio geográfico. Se valida aguas arriba (en la búsqueda), no en la fórmula de
puntaje —el manejo de coordenadas nulas en `geoModulator` es sólo una red de seguridad—. La
búsqueda por texto ya la exige; **`searchByPhoto` hoy la permite nula → 324-D debe exigirla también.**

**Búsqueda en vivo = foto + texto, ambos obligatorios.** El puntaje combina `α·sim_img + β·sim_txt`
modulado por geografía. La matemática del scoring degrada con elegancia a una sola modalidad
(renormaliza α/β sobre lo presente), así que:
- Si algún día llega una búsqueda sólo-foto o sólo-texto, no rompe (puntúa por la modalidad presente).
- Los endpoints legacy de búsqueda por sólo-texto siguen funcionando sin cambios (usan el scoring viejo).

## Diseño del puntaje (EU-324)

`score = geoModulator(a,b) · ( α·normCos(sim_img) + β·normCos(sim_txt) )`

- **α/β por categoría** (decisión 4). Valores INICIALES (se recalibran en EU-327):
  - BILLETERA → img 0.35 / txt 0.65 (el texto distingue: DNI, nombre)
  - ROPA → img 0.85 / txt 0.15 (el texto ensucia)
  - CELULAR → 0.50 / 0.50 · LLAVES → 0.50 / 0.50 · OTROS → 0.50 / 0.50
- **geoModulator**: remapea `e^{-k·d}` a `[geo-floor, 1]` (geo-floor=0.75). Mismo lugar → 1; lejos → 0.75.
  La geografía **modula** (multiplica), nunca anula.
- **Ponderaciones EXTERNALIZADAS a configuración** (no hardcodeadas): viven en `application.yml` bajo
  `search.scoring` (α/β por categoría + geo-floor), bindeadas por `ScoringProperties`
  (`@ConfigurationProperties`). Se ajustan **sin recompilar** (editar el yml / env var y reiniciar).
  `SearchScoringService` las recibe inyectadas; hay defaults en código por si la config no define nada.
- **Umbral** MIN_SCORE = 0.75 (se conserva; calibrable en EU-327).
- **Dos similitudes** por candidato → dos queries a Weaviate (target `image` + target `text`) fusionadas por UUID.
- **Poda del universo (decisión 2026-07-05):** NO se poda por `limit` ni por umbral de similitud —eso descartaría
  candidatos buenos antes de aplicar el puntaje ponderado—. `queryDual` corre con un **`limit` altísimo, fijado en
  5000** (fusible defensivo, no poda: a la escala real del producto nunca se alcanza; protege de datasets/duplicados
  patológicos). Escala validada con el usuario: uso esporádico, universo ya acotado por categoría + org/zona → decenas
  a cientos de candidatos, ponderar todo en memoria es trivial.
- **Poda dura legítima = geográfica.** El radio de 50 km (`WhereFilter WithinGeoRange`) está **deshabilitado por un
  bug de Weaviate** (ver `buildFilter`). La app **no está en producción**, así que **hay que arreglarlo** (tarea
  aparte, fuera de EU-324): con el radio funcionando, éste recorta el universo en la base y el `limit` alto deja de
  ser siquiera un tema. Mientras siga roto: sin poda por distancia (la geografía sólo modula el puntaje).
- **Backlog de objetos encontrados:** lo que crece con el tiempo no son las búsquedas abiertas sino los objetos
  encontrados no reclamados. Se acota con las **políticas de retención por org** (días que la org retiene objetos) —
  se hará algo al respecto para que el universo candidato no crezca indefinidamente. (Tarea aparte.)

## Subtareas

| # | Subtarea | Estado | Alcance / archivos clave |
|---|----------|--------|--------------------------|
| 324-A | Núcleo de scoring (SearchScoringService) | **HECHO** | `combinedScore(imgCert, txtCert, categoría, a, b)`, α/β + geo-floor **externalizados** a `application.yml` (`search.scoring`) vía `ScoringProperties`, `geoModulator`. **Aditivo**: no toca los métodos viejos (`totalScore`/`normalizeCosineScore`/`isMatch`) → compila y testea aislado. Ubicación es OBLIGATORIA en la búsqueda (ver decisión abajo); `geoModulator` sólo tiene un fallback defensivo para coords nulas, no es un caso de uso real. Tests: `SearchScoringServiceTest` 15 verdes (+ `LostObjectServiceTest` 11 sigue verde). |
| 324-B | Recuperación de dos similitudes (repos) | **HECHO** | `queryDual(imageVector, textVector, …)` en FoundObjectRepository y LostObjectRepository: dos consultas a Weaviate (target `image` + `text`) fusionadas por UUID vía `LinkedHashMap`, exponiendo `imageCertainty`/`textCertainty` por candidato (null si no matcheó por esa modalidad); `score` queda null (lo fija el scoring en 324-D). Filtro extraído a `buildFilter` (reusado por `query` legacy y `queryDual`). Nuevos campos `imageCertainty`/`textCertainty` en modelos FoundObject/LostObject. Sin contrato público. Tests: `FoundObjectRepositoryTest` 6 + `LostObjectRepositoryTest` 4 verdes. |
| 324-C | Cablear CLIP en la escritura (upload + reportLost) | TODO | `uploadFoundObject`: vector imagen CLIP + `classify` → guardar image+text+categoría IA (override del param usuario). `reportLostObject`: pasa a multipart (recibe la foto), CLIP + classify, **sube a S3 sólo al guardar** (key=uuid). Cambia firma de controllers → contrato para EU-326. Tests con mocks. |
| 324-D | Cablear CLIP en la búsqueda + wiring del scoring | TODO | `searchByPhoto` = búsqueda unificada foto+texto: vectoriza imagen **en memoria (sin S3)** + texto + classify, corre 324-B y aplica `combinedScore`. **Exigir ubicación** (org o coords) como la búsqueda por texto (hoy `searchByPhoto` la permite nula). `notifyMatchingSavedSearches` (inverso) idem con ambos vectores. Correr `queryDual` con **`limit` altísimo** (no podar por límite ni umbral; ver "Poda del universo" arriba). Al final: migrar callers y **retirar** métodos viejos de scoring si quedan sin uso. Tests. Depende de A + B (+ C para el contrato). |

Orden: **A → B → C → D**. A y B no tocan contrato; C y D definen el contrato que consume EU-326.

## Reglas del proyecto a respetar
- Tests unitarios verdes **antes** de dar una subtarea por HECHA (correrlos y explicarlos en lenguaje de negocio).
- Rechazos de regla de negocio → `BadRequestException` (400), nunca 403.
- Sin trazas de herramientas/IA en código, commits ni docs.
- Al cerrar EU-324: actualizar la tabla de REWORK-ALGORITMO-BUSQUEDA.md y proponer comentario de Jira.

## Estrategia de testing acordada
- **Por subtarea**: correr sólo las clases de test afectadas (rápido, aísla el problema en el momento).
- **Al cerrar EU-324** (tras 324-D): correr **toda la suite unitaria/mockeada** (sin infraestructura) como
  control de regresión de las 4 subtareas juntas.
- La verificación **end-to-end** (DB + Weaviate + micro CLIP reales) queda para un `/verify` aparte al final;
  las pruebas de integración/contexto necesitan MySQL levantado y no dan señal en el día a día de estas subtareas.
