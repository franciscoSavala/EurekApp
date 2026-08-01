# build — índice de trabajos en curso

Este archivo es el punto de entrada de `/build`: dice **cuál es el tracker activo** y dónde retomar.
No lleva contenido propio — el estado vive en los trackers.

## Trabajo activo

| Rama | Tracker | Dónde retomar |
|---|---|---|
| `EU-320-rework-algoritmo-busqueda` | [REWORK-ALGORITMO-BUSQUEDA.md](../REWORK-ALGORITMO-BUSQUEDA.md) | **§11 HANDOFF** (al final del archivo) |

**Leer siempre §11 primero**: tiene el orden de lo próximo, el estado del entorno (contenedores, backend,
qué hay cargado en Weaviate) y la lista de lo que ya está medido para no volver a medirlo.

🚧 **Bloqueante abierto (S3):** la credencial nueva **ya está puesta y verificada**; lo que falta es el
**bucket**. `eurekapp-temp-local` responde `AllAccessDisabled`, que es lo que devuelve AWS cuando la cuenta
dueña del bucket está dada de baja → hay que crearlo en la cuenta nueva (`324859422062`), en `sa-east-1`.
Sin eso no se puede terminar el seed de EU-325. Detalle y verificación en **§11, punto 1**.

## Otros trackers del repo

| Tracker | Estado |
|---|---|
| [REWORK-FRAUDE-RECLAMOS.md](../REWORK-FRAUDE-RECLAMOS.md) | Independiente del rework de búsqueda; leerlo antes de tocar fraude o reclamos. |
