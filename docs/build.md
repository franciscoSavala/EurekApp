# build — índice de trabajos en curso

Este archivo es el punto de entrada de `/build`: dice **cuál es el tracker activo** y dónde retomar.
No lleva contenido propio — el estado vive en los trackers.

## Trabajo activo

| Rama | Tracker | Dónde retomar |
|---|---|---|
| `EU-320-rework-algoritmo-busqueda` | [REWORK-ALGORITMO-BUSQUEDA.md](../REWORK-ALGORITMO-BUSQUEDA.md) | **§11 HANDOFF** (al final del archivo) |

**Leer siempre §11 primero**: tiene el orden de lo próximo, el estado del entorno (contenedores, backend,
qué hay cargado en Weaviate) y la lista de lo que ya está medido para no volver a medirlo.

✅ **Sin bloqueantes abiertos.** El de S3 se resolvió el 2026-08-01: el bucket correcto es `eurekapp-temp`
(no `eurekapp-temp-local`). Seed recargado y verificado de punta a punta. Detalle en **§11, punto 1**.

## Otros trackers del repo

| Tracker | Estado |
|---|---|
| [REWORK-FRAUDE-RECLAMOS.md](../REWORK-FRAUDE-RECLAMOS.md) | Independiente del rework de búsqueda; leerlo antes de tocar fraude o reclamos. |
