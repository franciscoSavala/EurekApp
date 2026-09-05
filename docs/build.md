# build — índice de trabajos en curso

Este archivo es el punto de entrada de `/build`: dice **cuál es el tracker activo** y dónde retomar.
No lleva contenido propio — el estado vive en los trackers.

## Trabajo activo

**Ninguno.** El rework del feedback cerró el 2026-09-04.

## Cómo cerró el rework del feedback (2026-09-04)

**EU-319 + EU-366, con sus nueve subtareas, todas en Done y mergeadas a `main`** (merge `a6a2635`).
El estado completo vive en [REWORK-FEEDBACK.md](../REWORK-FEEDBACK.md).

Separó **la opinión sobre la aplicación** (se le pide al usuario final al cerrar una búsqueda
guardada, la ve el administrador de EurekApp) de **la opinión sobre la organización** (se le pide a
quien retiró un objeto, después de retirarlo, y la ve el responsable de esa organización).

- **Suite: 255 tests, 0 failures** después del merge y antes de pushear. El único error es
  `BackendApplicationTests.contextLoads` (`Driver ... claims to not accept jdbcUrl, ${DATABASE_URL}`),
  **ambiental y conocido**. Front bundleado sin errores.
- **Un conflicto en el merge**, resuelto sumando y no eligiendo: `main` y la rama habían creado cada
  una su `EmailTemplateServiceTest`. El archivo final conserva los cuatro tests de EU-353 y los
  cuatro de EU-373.
- Además de los tests unitarios, se ejercitó la API real por HTTP (42 verificaciones) y se probó la
  app entera a mano. **De las pruebas manuales salieron cuatro arreglos**, el más importante en
  `eb5c086`: el enlace del correo llevaba el id de la devolución, que era secuencial y se podía
  tantear; ahora lleva un token opaco.

### Cambios de entorno que dejó

- **`seed-local.sh` cambió el esquema**: agrega `organization_id` y `feedback_token` a
  `return_found_objects`, y afloja el `NOT NULL` de `search_feedback.star_rating`, que Hibernate no
  relaja solo con `ddl-auto: update`. Si venís de una base vieja, **hay que resembrar**.
- **Nueva configuración `FRONT_URL`** (por defecto `http://localhost:8082`): es la base de los
  enlaces que viajan en los correos. Hasta ahora ningún correo llevaba enlaces a la app.

### Lo que quedó abierto

- **Los correos dicen que EurekApp es "la red de objetos perdidos de Córdoba"**, en el encabezado
  común, en el pie (que además dice 2025) y en el de bienvenida. Nada ata la aplicación a una
  ciudad. Viene de EU-260, no de este rework. **Se decidió no crear la tarea (2026-09-04).**
- **El enlace del correo no abre la app en un celular**, abre el navegador. Necesita un dominio
  propio con Universal Links / App Links. Excede al rework.

## Trackers anteriores (terminados)

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
