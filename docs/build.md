# build — índice de trabajos en curso

Este archivo es el punto de entrada de `/build`: dice **cuál es el tracker activo** y dónde retomar.
No lleva contenido propio — el estado vive en los trackers.

## Trabajo activo

| Rama | Tracker | Dónde retomar |
|---|---|---|
| `EU-320-rework-algoritmo-busqueda` | [REWORK-ALGORITMO-BUSQUEDA.md](../REWORK-ALGORITMO-BUSQUEDA.md) | **§13** — **EU-326 HECHA y VERIFICADA en la app** (2026-08-06). Sigue **EU-337**, y su punto 3 (categoría inferida del texto) quedó **desarrollado en §13**: es lo que reemplaza al selector manual que se eliminó. Ojo §12: tiene una corrección importante sobre el par de la billetera |

**Leer siempre §11 primero**: tiene el orden de lo próximo, el estado del entorno (contenedores, backend,
qué hay cargado en Weaviate) y la lista de lo que ya está medido para no volver a medirlo.

Para dejar el entorno cargado desde cero: contenedores (`bash Backend/start-local.sh`) +
**`bash Backend/seed-data/seed.sh`**. El seed inyecta **directo a Weaviate** desde un snapshot commiteado
(no hace falta el backend, y no resube las fotos a S3). Si alguna vez cambian los datos del seed, la receta
para regenerar el snapshot está en §11 punto 4 del tracker.

✅ **Sin bloqueantes abiertos.** El de S3 se resolvió el 2026-08-01: el bucket correcto es `eurekapp-temp`
(no `eurekapp-temp-local`). Seed recargado y verificado de punta a punta. Detalle en **§11, punto 1**.

## Otros trackers del repo

| Tracker | Estado |
|---|---|
| [REWORK-FRAUDE-RECLAMOS.md](../REWORK-FRAUDE-RECLAMOS.md) | Independiente del rework de búsqueda; leerlo antes de tocar fraude o reclamos. |
