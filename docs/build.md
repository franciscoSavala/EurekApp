# build — índice de trabajos en curso

Este archivo es el punto de entrada de `/build`: dice **cuál es el tracker activo** y dónde retomar.
No lleva contenido propio — el estado vive en los trackers.

## Trabajo activo

**Rework del feedback — EU-319 + EU-366.** Arrancado el 2026-09-03. El estado vive en
[REWORK-FEEDBACK.md](../REWORK-FEEDBACK.md): leerlo antes de tocar nada.

Separa **la opinión sobre la aplicación** (se la pide al usuario final, la ve el administrador de
EurekApp) de **la opinión sobre la organización** (se la pide a quien retiró un objeto, después de
retirarlo, y la ve el responsable de esa organización).

**Rama de trabajo: `EU-319-rework-feedback`.** No trabajar sobre `main`.

**Estado al 2026-09-03: las nueve subtareas están implementadas** (8 commits, suite de 241 tests
sin fallas, front bundleado). **Nada mergeado a `main` y nada publicado en Jira.**
Lo que queda es **ejecutar las pruebas de usuario**: la tabla está en la sección 8 del tracker.
Antes de probar hay que correr `bash Backend/seed-local.sh` — cambió el esquema.

## Tracker del rework anterior (terminado)

### Cómo cerró el rework de búsqueda (2026-08-07)

- Merge sin conflictos. `main` había avanzado 6 commits con fixes ajenos al rework (EU-330, EU-315,
  EU-332); ninguno tocaba archivos de búsqueda.
- **Suite: 184 tests, 0 failures**, y compilación verde después del merge y antes del push.
  El único error es `BackendApplicationTests.contextLoads`
  (`Driver ... claims to not accept jdbcUrl, ${DATABASE_URL}`), **ambiental y conocido** — no expande
  la variable en ese test. No es regresión.
- Front bundleado sin errores (Metro, 1308 módulos) y ejercitado a mano en toda la verificación.

### Salió en el mismo merge (no es del rework)

**Sesión vencida que fallaba en silencio.** El filtro de JWT atrapaba la expiración del token junto
con cualquier otro error y dejaba pasar la petición sin autenticar, así que Spring respondía **403**.
El front sólo renueva el token ante un **401**, de modo que la sesión vencida no se renovaba ni se
cerraba: cada pantalla fallaba sola y sin aviso (se detectó porque el desplegable de establecimientos
aparecía vacío). Ahora la expiración responde 401 con el código `token_expired` y el mecanismo de
renovación que ya existía en el front se activa solo. Commit `5f23760`, con tests del filtro.


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
