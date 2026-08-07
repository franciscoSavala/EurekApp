# build — índice de trabajos en curso

Este archivo es el punto de entrada de `/build`: dice **cuál es el tracker activo** y dónde retomar.
No lleva contenido propio — el estado vive en los trackers.

## Trabajo activo

**Sólo queda el MERGE de `EU-320-rework-algoritmo-busqueda` a `main`.** El rework en sí se terminó el
**2026-08-07**: no queda nada por implementar.

### Retomar acá — el merge

Estado al cerrar la sesión del 2026-08-07:

- Rama **sincronizada con el remoto**, working tree **limpio**, nada suelto sin commitear.
- **Build limpio (`mvnw clean test`) + suite: 181 tests, 0 failures.** El único error es
  `BackendApplicationTests.contextLoads` (`Driver ... claims to not accept jdbcUrl, ${DATABASE_URL}`),
  **ambiental y conocido** — no expande la variable en ese test. No es regresión.
- Front bundleado sin errores (Metro, 1308 módulos) y ejercitado a mano en toda la verificación.

⚠️ **La rama está 43 commits por delante de `main`**, así que el merge NO es trivial. Antes de
ejecutarlo conviene mirar el panorama: cuántos archivos toca, si `main` avanzó por su cuenta y si hay
conflictos. **Y compilar DESPUÉS de mergear y ANTES de pushear a main**: ya pasó en este repo que un
merge "limpio" rompiera la compilación.

## Tracker del rework

| Tracker | Estado |
|---|---|
| [REWORK-ALGORITMO-BUSQUEDA.md](../REWORK-ALGORITMO-BUSQUEDA.md) | ✅ **TERMINADO (2026-08-07).** EU-337 verificada en la app y cerrada; EU-320 y sus 8 subtareas en Done. **No queda nada por implementar: lo único abierto es el merge de `EU-320-rework-algoritmo-busqueda` a `main`.** Queda como registro: §13 lo último, §12 la calibración, §11 el entorno. Lo que salió del rework y NO es del rework: **EU-338** (la búsqueda dice "no hay coincidencias" cuando en realidad falló) |

### Levantar el entorno de búsqueda (si hay que retomarlo)

Contenedores (`bash Backend/start-local.sh`) + **`bash Backend/seed-data/seed.sh`**. El seed inyecta
**directo a Weaviate** desde un snapshot commiteado (no hace falta el backend, y no resube las fotos a
S3). La receta para regenerar el snapshot está en §11 punto 4 del tracker.

⚠️ **Weaviate ocupa el 8081, que es el puerto por defecto de Expo**: el front hay que levantarlo en
otro (`npx expo start --web --port 8082`).

## Otros trackers del repo

| Tracker | Estado |
|---|---|
| [REWORK-FRAUDE-RECLAMOS.md](../REWORK-FRAUDE-RECLAMOS.md) | Independiente del rework de búsqueda; leerlo antes de tocar fraude o reclamos. |
