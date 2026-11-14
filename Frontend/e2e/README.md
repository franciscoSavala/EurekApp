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

Los tests corren de a uno porque comparten la base. Cada uno tarda entre 20 y 60 segundos.

## Qué cubre cada archivo

| Archivo | Cubre |
|---|---|
| `sesion.spec.js` | Ingreso, credenciales incorrectas, campos vacíos y cierre de sesión. |
| `recepcion.spec.js` | Receptar un objeto: campos, éxito, título obligatorio, formato y tamaño de imagen. |
| `devolucion.spec.js` | Devolver un objeto: formulario, datos obligatorios, DNI inválido y devolución completa. |
| `busqueda.spec.js` | Buscar por texto, por foto con descripción, descripción obligatoria, formato de imagen y sin coincidencias. |
| `exportaciones.spec.js` | Descarga de los CSV de reportes de uso, de fraude y de opiniones de usabilidad. |
| `autenticacion.spec.js` | Pantallas de avisos, administración (contadores, dashboard, usuarios, organizaciones, configuración de fraude, solicitudes de alta, opiniones), solicitud de organización y calificaciones: muestran datos reales y ningún pedido sale sin credencial ni es rechazado por sesión inválida. |

Las fotos de prueba están en `fixtures/`.

## Cosas a tener en cuenta

- Todas las devoluciones usan un DNI distinto en cada corrida (incluso las que deberían fallar: si una validación se rompe, la devolución se registra de verdad). Con el mismo DNI repetido tres veces el sistema detecta fraude y bloquea al empleado, y los tests siguientes ya no pueden iniciar sesión con ese usuario. Si pasa, hay que quitar esa alerta y esos bloqueos de la base.
- Quedan fuera de la tanda el ingreso con Google o Facebook y todo lo que dependa de mails.
- El inventario carga de a 20 objetos y la base de pruebas acumula objetos en cada corrida, por eso los tests bajan por el listado hasta ver el objeto (`bajarHastaVer`) en vez de suponer que está en la primera página.
- Los tests no usan identificadores propios en la interfaz: buscan por texto y por el menú lateral.

## Carriles y etiquetas

Cada test lleva al final de su título una etiqueta de área (`@sesion`, `@recepcion`, `@devolucion`, `@busqueda`, `@exportaciones`, `@admin`, `@menu`) y una de carril:

- `@serie`: tests que dependen unos de otros o tocan estado global (configuración de fraude, bloqueos, desactivar usuarios u organizaciones, políticas, empleados, puntos). Corren con un solo worker (`npm run test:e2e:serie`). Usuarios: organización 1 UTN FRC (owner.utn, encargado.utn, emp1.utn, emp2.utn), julia@mail.com y el administrador soporte.eurekapp@gmail.com. Si hay que desactivar una organización o a su dueño, se usa la organización 2 Terminal (owner.term).
- `@paralelo`: tests independientes y de solo lectura (o que solo crean datos únicos propios). Corren con 3 workers (`npm run test:e2e:paralelo`). Usuarios: valeria, pedro y micaela (@mail.com); organizaciones 3 a 6 (emp1.aero, owner.patio, emp1.patio, owner.unc, emp1.unc, owner.dino, emp1.dino, todos @eurekapp.com). El administrador se usa solo para leer. Las claves con nombre están en `USUARIOS_PARALELO` de `helpers.js`.

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
