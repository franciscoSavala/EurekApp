# Tests end-to-end (Playwright, versión web)

Recorren la app web como lo haría una persona: inician sesión, receptan objetos, buscan, devuelven y exportan reportes. No reemplazan a los tests unitarios; prueban que las piezas funcionen juntas.

## Qué se necesita levantado

1. Base de datos MySQL, Weaviate (con el esquema y el seed cargados), MinIO y el servicio CLIP (puerto 8000).
2. Backend en el puerto 8080, perfil `local`, apuntando a esos servicios. Ver el yml del perfil: si la base, Weaviate o MinIO no están en sus puertos por defecto, se pisan con las variables `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`, `APPLICATION_WEAVIATE_URL` (sin `http://`) y `S3_ENDPOINT`.
3. La web en el puerto 8082: desde `Frontend/`, `npx expo start --web --port 8082`. La primera carga tarda cerca de 100 segundos.

Los tests usan los usuarios del seed (clave `Eurekapp1!`). Usan una base propia de pruebas: crean objetos y devoluciones reales, así que no deben correr contra datos que importen.

## Cómo correrlos

Desde `Frontend/`:

- Toda la tanda: `npm run test:e2e`
- Un archivo: `npx playwright test busqueda`
- Informe de la última corrida: `npx playwright show-report`

Si la web no está en `http://localhost:8082`, se indica con la variable `E2E_BASE_URL`.

Los tests de `@serie` corren de a uno porque comparten estado; los de `@paralelo` corren de a tres (ver Carriles y etiquetas). Cada test tarda entre 20 y 60 segundos.

## Qué cubre cada archivo

| Archivo | Cubre | Casos | Carril |
|---|---|---|---|
| `admin-dashboard-valores.spec.js` | Dashboard de administración: abre al entrar al panel y sus métricas coinciden con el servidor. | 430 a 438, 441 | @paralelo |
| `admin-desactivar.spec.js` | Desactivar y reactivar usuarios y la organización Terminal, y el contador de usuarios del dashboard. | 417 a 420, 422, 425 a 429, 439 | @serie |
| `admin-organizaciones-lectura.spec.js` | Gestión de organizaciones (solo lectura): listado, datos y detalle. | 421, 423, 424 | @paralelo |
| `admin-usuarios-lectura.spec.js` | Gestión de usuarios (solo lectura): listado, filtro por rol y acceso denegado a quien no es administrador. | 411 a 416 | @paralelo |
| `autenticacion.spec.js` | Pantallas de avisos, administración (contadores, dashboard, usuarios, organizaciones, configuración de fraude, solicitudes de alta, opiniones), solicitud de organización y calificaciones: muestran datos reales y ningún pedido sale sin credencial ni es rechazado por sesión inválida. | sin número de caso | @paralelo y @serie |
| `busqueda.spec.js` | Buscar por texto, por foto con descripción, descripción obligatoria, formato de imagen y sin coincidencias. | sin número de caso | @serie |
| `busqueda-formulario.spec.js` | Pantalla Buscar un objeto: campos, datos mínimos, pin del mapa, filtros avanzados y carga, reemplazo y tamaño de la foto. | 046 a 048, 050 a 052, 054, 063, 064, 069 | @paralelo |
| `busqueda-resultados.spec.js` | Resultados de la búsqueda: solo descripción, fecha y hora, mejora con foto, objetos que no se parecen, palabra clave y filtros. | 049, 062, 065, 066, 359, 360 | @paralelo |
| `busqueda-sin-coincidencias.spec.js` | Búsqueda sin coincidencias: aviso, volver, calificación, comentario y guardar la búsqueda (modal, sin duplicar). | 055 a 059, 070 a 075 | @paralelo |
| `devolucion.spec.js` | Devolver un objeto: formulario, datos obligatorios, DNI inválido y devolución completa. | 114 a 118, 121, 122, 132 | @serie |
| `devolucion-devueltos.spec.js` | Devolución duplicada rechazada y consulta de los objetos devueltos. | 123 a 131 | @serie |
| `devolucion-formulario.spec.js` | Teléfono que solo acepta números y carga de la foto de la persona. | 119, 120 | @serie |
| `exportaciones.spec.js` | Descarga de los CSV de reportes de uso, de fraude y de opiniones de usabilidad. | 259 a 261 | @serie y @paralelo |
| `feedback-app.spec.js` | Opinión sobre la app: modal, controles, omitir y envío completo. | 147 a 157 | @paralelo |
| `feedback-recompensa.spec.js` | Opinión sobre una recompensa recibida. | 300 a 313 | @paralelo |
| `feedback-roles.spec.js` | El botón de opinión sobre la app está en Mi perfil de cada rol. | 293 | @paralelo |
| `fraude-alertas.spec.js` | Alertas de fraude del administrador y del dueño de la organización. | 169 a 172, 179, 180 | @serie |
| `fraude-reporte-filtros.spec.js` | Reporte de fraude: acceso del dueño, filtros por organización, fechas y estados, y generación. | 181 a 195, 298, 299 | @paralelo |
| `fraude-reporte-graficos.spec.js` | Reporte de fraude: torta de activas contra falsas alarmas y gráfico de evolución. | 498 a 508 | @paralelo |
| `fraude-reporte-usuarios.spec.js` | Reporte de fraude: usuarios con fraude, historial, reincidentes y orden. | 294 a 297, 493 a 497 | @paralelo |
| `menu.spec.js` | Menú lateral según el rol: opciones, pantalla de inicio de cada rol y contadores contra el servidor. | sin número de caso | @serie (el administrador y los contadores, @paralelo) |
| `notificaciones-lista.spec.js` | Notificaciones del usuario: listado, detalle, leídas, indicador, coincidencias, recompensas y estado vacío. | 373 a 375, 377, 378, 381, 382, 384, 385 | @paralelo |
| `notificaciones-solicitudes.spec.js` | Notificaciones de solicitudes de rol: recibida, aceptar, rechazar y cambio de rol. | 376, 379, 380, 383 | @paralelo |
| `organizacion-empleados.spec.js` | Datos de la organización, alta de empleados por correo, asignar encargado y eliminar empleados. | 196 a 209, 225 a 234, 364 a 369 | @serie |
| `organizacion-politicas.spec.js` | Políticas de la organización: pantalla, guardado, persistencia, historial y aplicación al devolver. | 210 a 224, 361 a 363 | @serie |
| `recepcion.spec.js` | Receptar un objeto: campos, éxito, título obligatorio, formato y tamaño de imagen. | 076, 077, 079, 089, 092 a 095, 134 | @serie |
| `recepcion-confirmacion-feedback.spec.js` | Recepción: aviso de confirmación y modal de opinión de la experiencia. | 096 a 107 | @paralelo |
| `recepcion-formulario.spec.js` | Recepción: objeto con todos los campos, interruptor de ubicación, datos inválidos y carga o reemplazo de imagen. | 078, 080, 081, 083 a 088, 090, 091 | @paralelo |
| `recepcion-inventario.spec.js` | Inventario y detalle del objeto, y organización sin objetos. | 108 a 113, 133 | @paralelo |
| `reclamos-alertas.spec.js` | Alerta generada por un encargado: detalle, falsa alarma, resolución y listado. | 265 a 270, 370 a 372 | @serie |
| `recompensas-exclusiones.spec.js` | El encargado registra un objeto y no recibe recompensa. | 353 a 358 | @serie |
| `recompensas-hitos.spec.js` | Insignias y puntos al llegar a 5 y 10 devoluciones. | 334, 335, 341 a 343, 346, 347 | @serie |
| `recompensas-logros.spec.js` | Pantalla de Logros de un usuario nuevo y recorrido de un usuario que recibe recompensas. | 135 a 142, 319 a 322, 325 a 328, 330 a 333, 337 a 340, 345, 347 a 352 | @serie |
| `recompensas-perdidas.spec.js` | Registrar una pérdida y recuperar el objeto no dan puntos ni progreso. | 323, 324, 329 | @serie |
| `reportes-coincidencias.spec.js` | El feedback queda asociado a la coincidencia y a la organización. | 281, 282 | @paralelo |
| `reportes-opiniones.spec.js` | Reporte de opiniones: filtro, tendencias, estrellas y búsquedas exitosas contra no exitosas. | 248 a 250, 262 a 264, 386 a 391, 488 a 492 | @paralelo |
| `reportes-recompensas.spec.js` | Reporte de opiniones sobre recompensas. | 285 a 292 | @paralelo |
| `reportes-uso-fechas.spec.js` | Reportes de uso: filtro de fechas y agrupación por día, semana y mes. | 237 a 243 | @paralelo |
| `reportes-uso-graficos.spec.js` | Reportes de uso: porcentaje de recuperación, objetos más reportados y tiempo promedio. | 473 a 487 | @paralelo |
| `reportes-uso-pantalla.spec.js` | Reportes: pantalla, secciones, métricas, estado sin datos y botón Ver reporte de fraude. | 173 a 175, 177, 178, 235, 236 | @paralelo |
| `reportespdf-fraude-permisos.spec.js` | PDF del reporte de fraude: el administrador lo descarga y los demás roles no pueden. | 448, 451, 452 | @paralelo |
| `reportespdf-uso.spec.js` | PDF del reporte de uso: botón, contenido, nombre del archivo, fecha y error de generación. | 283, 448 a 450, 453 a 460 | @paralelo |
| `sesion.spec.js` | Ingreso, credenciales incorrectas, campos vacíos y cierre de sesión. | 001/018, 002, 003, 024 | @serie |
| `solicitudes-alta.spec.js` | Solicitudes de alta de organizaciones: acceso, aprobar y rechazar con motivo. | 392 a 410, 440 | @serie |
| `t01-menu-dueno.spec.js` | Menú del dueño: opciones y navegación a cada pantalla. | 026 a 033, 158 a 168 | @paralelo |
| `t01-menu-empleado.spec.js` | Menú del empleado: opciones y navegación a cada pantalla. | 034 a 040 | @paralelo |
| `t01-menu-usuario.spec.js` | Menú del usuario regular: versión, contacto, opciones y navegación. | 019 a 023, 025, 041 a 045 | @paralelo |
| `t01-perfil.spec.js` | Mi perfil: datos del empleado no editables y persistencia al volver a entrar. | 143 a 146 | @paralelo |
| `t01-registro.spec.js` | Registro y acceso: validaciones, email repetido, contraseña y recuperación de contraseña. | 004 a 014, 017, 461, 462, 464 | @paralelo |

Las fotos de prueba están en `fixtures/`.

## Cosas a tener en cuenta

- Todas las devoluciones usan un DNI distinto en cada corrida (incluso las que deberían fallar: si una validación se rompe, la devolución se registra de verdad). Con el mismo DNI repetido tres veces el sistema detecta fraude y bloquea al empleado, y los tests siguientes ya no pueden iniciar sesión con ese usuario. Si pasa, hay que quitar esa alerta y esos bloqueos de la base.
- Quedan fuera de la tanda el ingreso con Google o Facebook y todo lo que dependa de mails.
- El inventario carga de a 20 objetos y la base de pruebas acumula objetos en cada corrida, por eso los tests bajan por el listado hasta ver el objeto (`bajarHastaVer`) en vez de suponer que está en la primera página.
- Los tests no usan identificadores propios en la interfaz: buscan por texto y por el menú lateral.

## Carriles y etiquetas

Cada test lleva al final de su título una etiqueta de área (por ejemplo `@sesion`, `@recepcion`, `@devolucion`, `@busqueda`, `@fraude`, `@reportes`, `@admin`, `@menu`) y una de carril:

- `@serie`: tests que dependen unos de otros o tocan estado global (configuración de fraude, bloqueos, desactivar usuarios u organizaciones, políticas, empleados, puntos). Corren con un solo worker (`npm run test:e2e:serie`). Usuarios: organización 1 UTN FRC (owner.utn, encargado.utn, emp1.utn, emp2.utn), julia@mail.com y el administrador soporte.eurekapp@gmail.com. Para desactivar una organización o a su dueño se usa la organización 2 Terminal (owner.term).
- `@paralelo`: tests independientes y de solo lectura (o que solo crean datos únicos propios). Corren con 3 workers (`npm run test:e2e:paralelo`). Usuarios: valeria y pedro (@mail.com) y las organizaciones 3 a 6 (@eurekapp.com). El administrador se usa solo para leer. Micaela, emp1.patio y emp1.dino están bloqueados por fraude en el seed a propósito y no se usan. La organización 4 (Shopping Patio Olmos) no recibe objetos y sirve para "sin coincidencias". Las claves con nombre están en `USUARIOS_PARALELO` de `helpers.js`.

Un test `@paralelo` nunca usa usuarios del carril serie (salvo el administrador para leer) ni cambia estado global.

## Regresión completa

`npm run test:e2e:regresion` lanza los dos carriles a la vez (dos procesos de Playwright, porque la versión instalada no reparte workers por proyecto) y los une en un solo informe. Con `-- --grep <patrón>` se corre solo un área, por ejemplo `npm run test:e2e:regresion -- --grep @devolucion`. La cantidad de workers del carril paralelo se cambia con `E2E_WORKERS_PARALELO` (por defecto 3). La regresión activa `E2E_CAPTURAS=on`: guarda una captura de cada test, no solo de los que fallan.

El resultado queda en `Frontend/e2e-resultados/AAAA-MM-DD_HH-mm/` (no se commitea):

- `informe/`: informe html (`npx playwright show-report e2e-resultados/<carpeta>/informe`).
- `resultados.json`: resultado de todos los tests.
- `resumen.txt`: inicio, fin, duración total y por carril, pasados, fallados y salteados.
- `serie.log` y `paralelo.log`: salida de cada carril.

`node e2e/resultados-por-caso.js <resultados.json>` escribe a la salida estándar el estado (PASA o FALLA) de cada caso de la planilla.

## Convención de pasos "caso NNN"

Dentro de un test, cada caso de la planilla es un paso: `await caso(123, 'qué verifica', async () => { ... })` (atajo de `helpers.js` para `test.step('caso 123: ...')`). El resultado de cada caso sale de su paso. El título del test cita todos los casos que cubre, con tres dígitos: `'casos 123, 124 y 125: ... @devolucion @serie'`.

## Sesiones

El servidor limita `/login` y `/signup` a 10 pedidos por minuto por IP, y cuenta también los rechazados. Por eso los tests no inician sesión desde la pantalla de ingreso, salvo los que prueban justamente el ingreso:

- `global-setup.js` abre una sesión por usuario una sola vez, por la API, y la guarda en `Frontend/e2e/.sesiones/` (no se commitea). Los dos carriles de la regresión lo corren a la vez, pero un cerrojo hace que no repitan ingresos.
- `helpers/sesion.js` espacia los pedidos a lo sumo 8 por minuto entre todos los procesos y, ante un 429, espera y reintenta. La cantidad de 429 queda anotada y la muestra el resumen de la regresión.
- Una sesión guardada se reutiliza durante 40 minutos (el token dura 60) y después se renueva.

## Resultados por caso

`e2e/resultados-por-caso.js` convierte el `resultados.json` de una corrida en el estado de cada caso de la planilla, a partir de los pasos "caso NNN". Los pasos que fallan sin cortar el test usan `casoContinuo` o `pasoContinuo` de `helpers/t17.js`: el test sigue y cada caso conserva su propio resultado.
