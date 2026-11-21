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
| `admin-dashboard-valores.spec.js` | Dashboard de administración: acceso rechazado a quien no es administrador, métricas contra el servidor, usuarios por rol y solicitudes aprobadas y rechazadas. | 305 a 312, 315 a 317 | @paralelo |
| `admin-desactivar.spec.js` | Desactivar y reactivar usuarios y organizaciones, registro del cambio y aviso al usuario desactivado. | 291 a 296, 298, 301 a 304, 313 | @serie |
| `admin-organizaciones-lectura.spec.js` | Gestión de organizaciones (solo lectura): listado, datos y detalle. | 297, 299, 300 | @paralelo |
| `admin-usuarios-lectura.spec.js` | Gestión de usuarios (solo lectura): listado, filtro por rol y acceso denegado a quien no es administrador. | 285 a 290 | @paralelo |
| `autenticacion.spec.js` | Pantallas de avisos, administración (contadores, dashboard, usuarios, organizaciones, configuración de fraude, solicitudes de alta, opiniones), solicitud de organización y calificaciones: muestran datos reales y ningún pedido sale sin credencial ni es rechazado por sesión inválida. | sin número de caso | @paralelo y @serie |
| `busqueda.spec.js` | Buscar por texto, por foto con descripción, descripción obligatoria, formato de imagen y sin coincidencias. | sin número de caso | @serie |
| `busqueda-formulario.spec.js` | Pantalla Buscar un objeto: campos, datos mínimos, pin del mapa, filtros avanzados y carga, reemplazo y tamaño de la foto. | 033, 034, 036, 039, 045, 046, 049, 050 | @paralelo |
| `busqueda-guardadas.spec.js` | Mis búsquedas: cierre, opinión, estados Por retirar y Retirado, "No era mi objeto" y calificar coincidencias. | 043, 056 a 062 | @paralelo |
| `busqueda-resultados.spec.js` | Resultados de la búsqueda: solo descripción, fecha y hora, mejora con foto, objetos que no se parecen, palabra clave y filtros. | 035, 037, 038, 044, 047, 048, 051 | @paralelo |
| `busqueda-sin-coincidencias.spec.js` | Búsqueda sin coincidencias: aviso, volver, calificación, comentario y guardar la búsqueda (modal, sin duplicar). | 040 a 042, 052 a 055, 063 | @paralelo |
| `devolucion.spec.js` | Devolver un objeto: formulario, datos obligatorios, DNI inválido, documento bloqueado por fraude, requisitos de entrega y devolución completa. | 090 a 093, 096 a 099, 110, 111 | @serie |
| `devolucion-confirmacion.spec.js` | Avisos y estado del usuario cuando se devuelve su objeto. | 100 a 102 | @serie |
| `devolucion-devueltos.spec.js` | Devolución duplicada rechazada y consulta de los objetos devueltos. | 103 a 109 | @serie |
| `devolucion-formulario.spec.js` | Teléfono que solo acepta números y carga de la foto de la persona. | 094, 095 | @serie |
| `exportaciones.spec.js` | Descarga de los CSV de reportes de uso, de fraude y de opiniones de usabilidad (dos tests sin número de caso). | 195 a 197 y dos sin caso | @serie y @paralelo |
| `feedback-app.spec.js` | Opinión sobre la app: modal, controles, omitir y envío completo. | 125 a 132 | @paralelo |
| `feedback-roles.spec.js` | El botón de opinión sobre la app está en Mi perfil de cada rol (usa al encargado de la organización 1). | 265 | @serie |
| `fraude-alertas.spec.js` | Alertas de fraude del administrador y del dueño de la organización. | 134 a 137, 141, 142, 202, 207, 209 | @serie |
| `fraude-reporte-filtros.spec.js` | Reporte de fraude: acceso del dueño, filtros por organización, fechas y estados, y generación. | 144 a 153, 215, 216 | @paralelo |
| `fraude-reporte-graficos.spec.js` | Reporte de fraude: torta de activas contra falsas alarmas y gráfico de evolución. | 356 a 361 | @paralelo |
| `fraude-reporte-usuarios.spec.js` | Reporte de fraude: usuarios con fraude, historial, reincidentes y orden. | 212 a 214, 217, 218, 354, 355 | @paralelo |
| `menu.spec.js` | Menú lateral según el rol: opciones, pantalla de inicio de cada rol y contadores contra el servidor. | sin número de caso | @serie (el administrador y los contadores, @paralelo) |
| `notificaciones-fraude.spec.js` | Aviso de fraude del dueño de la organización (depende de un aviso ya existente). | 261 | @paralelo |
| `notificaciones-lista.spec.js` | Notificaciones del usuario: listado, detalle, leídas, indicador, coincidencias, recompensas y estado vacío. | 249, 250, 252, 253, 256, 257, 259, 260 | @paralelo |
| `notificaciones-solicitudes.spec.js` | Notificaciones de solicitudes de rol: recibida, aceptar, rechazar y cambio de rol. | 251, 254, 255, 258, 262, 263 | @paralelo |
| `organizacion-empleados.spec.js` | Datos de la organización, alta de empleados por correo, asignar encargado y eliminar empleados. | 154 a 164, 174 a 178, 245 a 248 | @serie |
| `organizacion-politicas.spec.js` | Políticas de la organización: pantalla, guardado, persistencia, historial y aplicación al devolver. | 165 a 173, 243, 244 | @serie |
| `recepcion.spec.js` | Receptar un objeto: campos, éxito, título e imagen obligatorios, formato, tamaño y largo del título. | 064, 065, 067, 075 a 077, 079, 080, 113 | @paralelo |
| `recepcion-confirmacion-feedback.spec.js` | Recepción: aviso de confirmación y que no aparezca pedido de opinión. | 081, 082 | @paralelo |
| `recepcion-formulario.spec.js` | Recepción: objeto con todos los campos, interruptor de ubicación, usuarios inválidos y carga o reemplazo de imagen. | 066, 068 a 069, 071 a 074, 078 | @paralelo |
| `recepcion-inventario.spec.js` | Inventario y detalle del objeto, vencimientos, error de conexión y organización sin objetos. | 083 a 089, 112 | @paralelo |
| `reclamos-alertas.spec.js` | Alerta generada por un encargado: detalle, falsa alarma, resolución y listado. | 143, 203 a 206, 208 | @serie |
| `recompensas-exclusiones.spec.js` | El encargado registra un objeto y no recibe recompensa. | 238 a 241 | @serie |
| `recompensas-hitos.spec.js` | Insignias y puntos al llegar a 5 y 10 devoluciones. | 115, 232, 233 | @serie |
| `recompensas-logros.spec.js` | Pantalla de Logros de un usuario nuevo y recorrido de un usuario que recibe recompensas. | 114, 116 a 118, 224, 225, 227, 229, 231, 234 a 237 | @serie |
| `recompensas-perdidas.spec.js` | Registrar una pérdida y recuperar el objeto no dan puntos ni progreso. | 226, 228, 230 | @serie |
| `reportes-coincidencias.spec.js` | El feedback queda asociado a la coincidencia y a la organización. | 210, 211 | @paralelo |
| `reportes-opiniones.spec.js` | Reporte de opiniones: filtro, tendencias, estrellas y búsquedas exitosas contra no exitosas. | 190 a 194, 264, 352, 353 | @paralelo |
| `reportes-usabilidad.spec.js` | Reporte de opiniones de usabilidad. | 266 a 268 | @paralelo |
| `reportes-uso-fechas.spec.js` | Reportes de uso: filtro de fechas y agrupación por día, semana y mes. | 180 a 184 | @paralelo |
| `reportes-uso-graficos.spec.js` | Reportes de uso: porcentaje de recuperación, objetos más reportados y tiempo promedio. | 341 a 351 | @paralelo |
| `reportes-uso-pantalla.spec.js` | Reportes: pantalla, secciones, métricas, estado sin datos y comparación con el servidor. | 138 a 140, 179, 185 a 189, 201 | @paralelo |
| `reportes-uso-tendencias.spec.js` | Reportes de uso: precisión y tendencias. | 198 a 200 | @paralelo |
| `reportespdf-fraude-permisos.spec.js` | PDF del reporte de fraude: el administrador lo descarga y los demás roles no pueden. | 324, 325 | @paralelo |
| `reportespdf-uso.spec.js` | PDF del reporte de uso: botón, contenido, cifras contra la pantalla y error de generación. | 322, 323, 326 a 330 | @paralelo |
| `sesion.spec.js` | Ingreso, credenciales incorrectas, campos vacíos, pantalla de inicio de cada rol y cierre de sesión. | 001 a 003, 015, 017 | @paralelo (el 015, @serie) |
| `sesion-acceso.spec.js` | Ojo de la contraseña y rechazo de usuario desactivado u organización suspendida. | 005, 006 | @paralelo |
| `sesion-google.spec.js` | Ingreso con Google: se abre el selector de cuentas y, si se cierra, se puede reintentar. | 219, 223 | @paralelo |
| `sesion-recuperacion.spec.js` | Recuperación de contraseña: pedir el código, validarlo, reenviarlo, que expire y cambiar la contraseña (el correo se lee en Mailpit). | 332, 334 a 340 | @paralelo |
| `solicitudes-alta.spec.js` | Solicitudes de alta de organizaciones: acceso, aprobar y rechazar con motivo, dashboard y correos al administrador (Mailpit). | 269 a 284, 314, 318 a 321 | @serie |
| `t01-menu-admin.spec.js` | Menú del administrador: inicio, opciones e indicadores (el 030, @serie). | 015 a 017, 029 a 031 | @paralelo (el 030, @serie) |
| `t01-menu-dueno.spec.js` | Menú del dueño: opciones y navegación a cada pantalla. | 015 a 017, 019 a 024, 032, 119, 120, 133 | @paralelo |
| `t01-menu-empleado.spec.js` | Menú del empleado: opciones y navegación a cada pantalla. | 015 a 017, 020 a 022, 025, 032, 119, 120, 133 | @paralelo |
| `t01-menu-encargado.spec.js` | Menú del encargado: inicio, menú, perfil y cierre de sesión (solo lectura). | 015 a 017, 025, 032, 119, 120, 133 | @serie |
| `t01-menu-usuario.spec.js` | Menú del usuario regular: versión, contacto, opciones y navegación. | 015 a 018, 026 a 028, 119, 120, 133 | @paralelo |
| `t01-perfil.spec.js` | Mi perfil: datos del empleado no editables y persistencia al volver a entrar. | 121 a 124 | @paralelo |
| `t01-registro.spec.js` | Registro: validaciones, email repetido y contraseña. | 004, 007 a 014, 331, 333 | @paralelo |

Los números son los de la planilla depurada. Los pasos y utilidades de cada tanda están en `helpers/r01.js` a `r15.js` (existen r01 a r06, r08 a r10, r12 y r15).

Las fotos de prueba están en `fixtures/`.

## Cosas a tener en cuenta

- Todas las devoluciones usan un DNI distinto en cada corrida (incluso las que deberían fallar: si una validación se rompe, la devolución se registra de verdad). Con el mismo DNI repetido tres veces el sistema detecta fraude y bloquea al empleado, y los tests siguientes ya no pueden iniciar sesión con ese usuario. Si pasa, hay que quitar esa alerta y esos bloqueos de la base.
- El ingreso con Google se prueba hasta abrir el selector de cuentas y cancelarlo. Los correos (recuperación de contraseña, solicitudes de alta, avisos al administrador: casos 318 a 321, 337 y otros) se leen en Mailpit (SMTP 1025, web 8025), que tiene que estar levantado con el backend apuntando a él.
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
