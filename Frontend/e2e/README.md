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
| `exportaciones.spec.js` | Descarga de los CSV de reportes de uso y de fraude. |

Las fotos de prueba están en `fixtures/`.

## Cosas a tener en cuenta

- Todas las devoluciones usan un DNI distinto en cada corrida (incluso las que deberían fallar: si una validación se rompe, la devolución se registra de verdad). Con el mismo DNI repetido tres veces el sistema detecta fraude y bloquea al empleado, y los tests siguientes ya no pueden iniciar sesión con ese usuario. Si pasa, hay que quitar esa alerta y esos bloqueos de la base.
- Quedan fuera de la tanda el ingreso con Google o Facebook y todo lo que dependa de mails.
- El inventario carga de a 20 objetos y la base de pruebas acumula objetos en cada corrida, por eso los tests bajan por el listado hasta ver el objeto (`bajarHastaVer`) en vez de suponer que está en la primera página.
- Los tests no usan identificadores propios en la interfaz: buscan por texto y por el menú lateral.
