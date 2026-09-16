# build — índice de trabajos en curso

Este archivo es el punto de entrada de `/build`: dice **cuál es el tracker activo** y dónde retomar.
No lleva contenido propio — el estado vive en los trackers.

## Trabajo activo

**Tanda de bugs sueltos** (vía `/bugs`): se toman de a tres bugs de Jira, se resuelven, se validan
con pruebas unitarias + pruebas de interfaz, y recién ahí van a Done. No tiene tracker propio: el
estado de cada bug vive en su ítem de Jira.

Ya salieron a `main` en esta tanda: **EU-385** (foto de la devolución desalineada), **EU-386** (el
aviso de recompensa lleva a Logros), **EU-392** (los totales del reporte de fraude contaban
sospechosos en vez de alertas), **EU-379** (el aviso de fraude le llegaba al propio dueño),
**EU-390** (la torta de activas vs. falsas alarmas ahora también se ve en pantalla), **EU-394** (el
PDF del reporte de fraude mezclaba el encabezado de un filtro con los datos de otro) y **EU-337**,
que resultó estar ya implementada. A eso se suman **EU-391** y **EU-355** (el gráfico de evolución
del reporte de fraude se recortaba mal: mostraba el historial completo en vez del período y salteaba
los períodos sin casos) y **EU-276** (las estrellas del reporte de opiniones se partían en dos
renglones). El arreglo de EU-391 cerró además **EU-354**, que describía el mismo defecto del
gráfico. Todos están en Done en Jira.

En la tanda del 2026-09-11 salieron tres más: **EU-393** y **EU-381** (el seed no limpiaba las
alertas de fraude, así que sobrevivían apuntando a usuarios borrados), **EU-395** (el PDF del
reporte de fraude no traía el gráfico de evolución, que sólo existía en pantalla) y **EU-363** (las
fallas no previstas respondían "todo salió bien" con el cuerpo vacío, que es lo que escondió EU-352
durante meses). Todos en Done, verificados con pruebas unitarias y con la aplicación levantada.

En la tanda del 2026-09-12 salieron otros tres: **EU-397** (el rango de fechas de los reportes no se
podía escribir a mano; de paso, "Opiniones sobre la app" dejó de recargarse sola en cada tecla y pasó
a tener botón), **EU-387** (reclamar un objeto no avisaba que se estaba procesando, y volver a tocar
guardaba la búsqueda de nuevo) y **EU-384** (el bloqueo por sospecha de fraude se anunciaba pero no
impedía usar la aplicación). Los tres verificados con pruebas unitarias y con la app levantada.
Después salió **EU-380** (las coincidencias se muestran desde 80 %), y se cerraron sin cambios
**EU-383** (la descripción completa del objeto es visible a propósito) y **EU-389** (una devolución
no crea una búsqueda; "Mis objetos recuperados" sería alcance nuevo).

**EU-388 no lo hicimos nosotros**: lo resolvió y mergeó otra persona del equipo; ya está en Done.

El 2026-09-14 Evelyn subió a `main` EU-398, EU-342, EU-400, EU-401, EU-403, EU-406 y EU-302 (este
último asignado a Nelson). Todos en Done.

En la tanda del 2026-09-16 salieron **EU-402** (reclamar un objeto con toques repetidos guardaba la
búsqueda varias veces), **EU-396** (la búsqueda pasa a "Retirado" o "Retirado por alguien más" cuando
la organización entrega el objeto; cierra también **EU-382**) y **EU-358** (Día/Semana/Mes del
reporte de opiniones se movió a "Evolución temporal"). En EU-396 se definió además que "Retirado por
alguien más" no recibe avisos y sólo se puede cerrar, y que de la organización se muestran nombre y
dirección, nunca el correo del dueño. Verificados con pruebas unitarias y con la app levantada.

**Para probar la búsqueda desde la pantalla**, la fecha de pérdida tiene que ser anterior a mayo de
2026: los objetos de prueba se encontraron en abril y mayo, y la búsqueda sólo muestra objetos
encontrados después de esa fecha. Con la fecha de hoy no aparece nada. El front web se levanta en
un puerto que el backend acepte (8082); en 19006 el login falla por origen no permitido.

**Ojo con el entorno local (EU-399):** hay dos juegos de datos de prueba distintos y el que carga
`seed-local.sh` quedó de antes del rework de búsqueda, así que deja una aplicación donde **ninguna
búsqueda encuentra nada**, sin ningún aviso. Para probar búsqueda, sembrar con
`bash Backend/seed-data/seed.sh`. El ítem tiene el detalle y las dos opciones para resolverlo.

**EU-382 no era un error**: la búsqueda se queda en "Por retirar" después de la devolución porque
nunca se definió qué pasa cuando el objeto se entrega, ni cuando lo retira una persona distinta de
la que guardó la búsqueda. EU-361, que introdujo el estado, sólo cubre el camino feliz. Las
definiciones que faltaban se tomaron en la story nueva **EU-396**: la búsqueda pasa a "Retirado" si
la retiró su dueño, o a "Retirado por alguien más" si fue otro, sin mostrar datos de terceros y sin
cerrar nada por su cuenta. EU-382 queda abierto, bloqueado por EU-396.

El rework del feedback cerró el 2026-09-04; el de búsqueda, el 2026-08-07. Ninguno tiene trabajo
pendiente.

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
