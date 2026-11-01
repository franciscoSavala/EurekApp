# Documentación del Producto — EurekApp

Nov 1, 2026 · @Nelson Campos

## Carátula

**Universidad Tecnológica Nacional — Facultad Regional Córdoba**

Ingeniería en Sistemas de Información · Cátedra: Proyecto Final · Grupo N° 9

**Proyecto Final — EurekApp: Documentación del Producto**

Año: 2024

**Docentes**

- Ahumada, Victoria Yamila
- Aquino, Francisco Alejandro
- Arenas, María Silvina
- D'Agostino, José Luis
- Jaime, María Natalia

**Alumnos**

| Alumno | Legajo |
| --- | --- |
| Agüero Piñero, Facundo | 72728 |
| Camargo, Daysi | 84200 |
| Campos, Nelson Ramiro | 58816 |
| Lucero, Cristian | 58785 |
| Manzolido, Evelyn | 76559 |
| Savala, Francisco | 86146 |

## Historial de revisiones

| Fecha | Versión | Autor/es | Descripción / Comentarios |
| --- | --- | --- | --- |
| 2026-11-01 | 0.1 | Equipo del proyecto (Grupo N° 9) | Borrador: estructura, objetivo y roles (EU-417), Product Backlog con 61 historias (EU-418), diagrama de clases (EU-421), DER (EU-422) y estados (EU-423). Se suman la matriz de trazabilidad (EU-419, con requerimientos reconstruidos por falta del Estudio Inicial) y el diseño de interfaz por historia (EU-420, sin capturas de pantalla). |

## Índice

1. Introducción
2. Audiencia
3. Nombre y objetivo del producto
4. Roles del sistema
5. Product Backlog final, épicas e historias de usuario
6. Matriz de trazabilidad
7. Diseño de interfaz por historia de usuario
8. Diagrama de clases
9. Diagrama Entidad-Relación (DER)
10. Diagramas de transición de estados

## 1. Introducción

Este documento reúne la documentación del producto EurekApp que el profesor Aquino pidió para la defensa técnica del Proyecto Final.

Describe qué es el producto y quiénes lo usan, el Product Backlog final con sus épicas e historias de usuario, la trazabilidad contra el alcance del Estudio Inicial, el diseño de interfaz, el diagrama de clases, el DER y los diagramas de transición de estados. El diseño de casos de prueba y sus resultados quedan en la documentación de testing.

## 2. Audiencia

El documento está escrito para quienes evalúan y mantienen el producto; cada lector tiene una sección que le resuelve su pregunta.

| Lector | Qué busca | Secciones |
| --- | --- | --- |
| Docentes de la cátedra (defensa técnica) | Qué se construyó, con qué alcance y cómo se relaciona con el Estudio Inicial | 3, 4, 5, 6 |
| Equipo de desarrollo | Cómo está modelado el sistema y qué historia originó cada comportamiento | 7, 8, 9, 10 |
| Quienes redactan el manual de usuario y la documentación de testing | Roles, historias y pantallas que hay que cubrir | 4, 5, 7 |

## 3. Nombre y objetivo del producto

**EurekApp** es una aplicación móvil y web de objetos perdidos y encontrados, cuyo objetivo es que una persona recupere lo que perdió en una organización (facultad, terminal, aeropuerto u otra) sin recorrer mostradores ni listas en papel.

Las organizaciones registran los objetos que encuentran, con foto y descripción, y actúan como punto de retiro. Quien perdió algo lo busca por texto o subiendo una foto de una pertenencia parecida: el sistema compara imagen y texto con inteligencia artificial, filtra por categoría y ubicación, y muestra las coincidencias con su porcentaje de similitud.

Además de buscar y registrar, el producto:

- guarda las búsquedas y avisa por notificación y correo cuando aparece un objeto que coincide;
- registra la devolución al dueño (nombre, DNI, teléfono y foto de quien retira) y pide después una calificación de la atención;
- detecta devoluciones sospechosas de fraude, bloquea al DNI o usuario involucrado y avisa al administrador;
- ofrece reportes de uso, de precisión de coincidencias y de fraude, y un tablero de estadísticas globales para el administrador.

## 4. Roles del sistema

El sistema tiene cinco roles, no los tres del manual de usuario de 2024 (usuario regular, encargado y administrador de organización): se sumaron el empleado, el responsable de organización y el administrador de EurekApp. Cada usuario tiene un solo rol, que determina las opciones del menú lateral y lo que el backend le permite hacer.

| Rol (nombre en la app · código) | Cómo se obtiene | Qué puede hacer |
| --- | --- | --- |
| **Usuario regular** · `USER` | Es el rol por defecto al registrarse (con mail y contraseña o con Google). | Buscar objetos perdidos por texto o con foto; guardar búsquedas y seguirlas (activa, por retirar, retirada, cerrada); recibir avisos de coincidencias; ver notificaciones y logros; calificar la atención recibida; pedir el alta de una organización; aceptar o rechazar la invitación para ser empleado. Menú: Buscar un objeto, Mis búsquedas, Solicitar alta de organización, Mi solicitud de organización, Logros. |
| **Empleado** · `ORGANIZATION_EMPLOYEE` | Un usuario regular acepta la invitación del responsable de una organización. | Receptar (registrar) objetos encontrados, ver el inventario de su organización, registrar la devolución de un objeto y ver los objetos devueltos. No busca objetos ni ve logros. Menú: Receptar un objeto, Ver inventario, Ver objetos devueltos. |
| **Encargado** · `ENCARGADO` | El responsable convierte a un empleado en encargado y puede revocarlo. | Hoy tiene las mismas pantallas y permisos que el empleado: recepta, ve el inventario y registra devoluciones. El código no le da ninguna función adicional. |
| **Responsable de organización** («Dueño de organización») · `ORGANIZATION_OWNER` | El administrador aprueba la solicitud de alta de su organización; también lo es quien se registra con el mail de una solicitud ya aprobada. | Todo lo del empleado, más: invitar empleados, quitarlos y asignar o revocar encargados; definir las políticas de manejo de objetos de su organización; ver los reportes de uso y de calificación de la atención; ver las exclusiones de recompensa. Menú: se suman Mi organización, Reportes y Exclusiones de recompensa. |
| **Administrador** (dueño de EurekApp) · `ADMIN` | Se da de alta directamente en la base de datos; ningún flujo de la aplicación lo asigna. | Aprobar o rechazar solicitudes de alta de organizaciones; activar y desactivar usuarios y organizaciones; gestionar alertas de fraude (marcar falsas alarmas) y configurar sus parámetros; ver el tablero de estadísticas globales y las opiniones sobre la app. Menú: Dashboard, Solicitudes de alta, Usuarios, Organizaciones, Alertas de fraude, Configuración de fraude, Opiniones sobre la app. |

Todos los roles ven Notificaciones y Mi perfil. Las transiciones entre roles (aceptar una invitación, asignar un encargado, aprobar una organización) y la historia de usuario responsable de cada una están en la sección 10.

## 5. Product Backlog final, épicas e historias de usuario

El backlog final tiene 8 épicas y 61 historias de usuario; 58 están finalizadas y 3 por hacer (EU-365, EU-412 y EU-414). Cada historia se presenta con su estado, su descripción y su criterio de aceptación tal como figuran en Jira. Las pruebas de usuario de cada historia quedan en la documentación de testing.

| Épica | Nombre | Historias | Finalizadas |
| --- | --- | --- | --- |
| EU-5 | Búsqueda de objetos perdidos | 12 | 12 |
| EU-6 | Gestión de organización | 11 | 11 |
| EU-7 | Registro y entrega de objetos encontrados | 4 | 4 |
| EU-9 | Gestión de reportes | 16 | 16 |
| EU-10 | Servicio de notificaciones de matching | 1 | 1 |
| EU-39 | Registro de usuarios | 8 | 8 |
| EU-45 | Servicio de notificaciones de fraude | 1 | 1 |
| EU-53 | Documentación del Proyecto | 1 | 0 |
| — | Historias sin épica asignada | 7 | 5 |

### 5.1 EU-5 · Búsqueda de objetos perdidos

Proceso de búsqueda de objetos perdidos.

#### EU-19 · Búsqueda por descripción textual

Estado: Finalizada

**Descripción.** Como usuario, quiero poder buscar y encontrar objetos brindando una descripción textual del objeto que perdí, para saber dónde fue que lo perdí y poder recuperarlo de manera rápida y eficiente.

**Criterio de aceptación**

- Ingresar una descripción textual con un máximo de 255 caracteres.
- Seleccionar el nombre del establecimiento en donde perdí mi objeto.
- Mostrar las coincidencias identificadas con la foto asociada.
- Mostrar las opciones identificadas con mayor probabilidad de coincidencia, con un máximo de 5 opciones.
- Permitir seleccionar una opción de objeto encontrado.
- Avisar el lugar a donde concurrir para buscar el objeto.
- Avisar que no hubo coincidencia de objeto.
- Permitir corregir la descripción textual para volver a buscar al objeto.

#### EU-24 · Notificación de devolución de objeto encontrado

Estado: Finalizada

**Descripción.** Como usuario que registró un objeto encontrado, quiero saber cuándo el mismo fue devuelto, para saber que estoy sumando puntos de recompensa.

**Criterio de aceptación**

1. Se debe enviar una notificación al usuario que registró el objeto como encontrado cuando el objeto sea devuelto con éxito.
2. La notificación debe incluir la fecha en la que fue devuelto el objeto, la persona que lo encontró y la persona dueña.
3. Se deben actualizar automáticamente los puntos de recompensa del usuario cuando se confirma la devolución del objeto.
4. El usuario que registró el objeto debe poder ver el estado de la devolución del objeto.
5. El sistema debe mantener un registro de las notificaciones enviadas al usuario para futuras consultas.

#### EU-34 · Utilizar filtros avanzados en la búsqueda de objetos

Estado: Finalizada

**Descripción.** Como usuario, quiero utilizar filtros avanzados para refinar los resultados de búsqueda de objetos perdidos, para mejorar las posibilidades de encontrar exactamente el objeto que busco.

**Criterio de aceptación**

- El sistema debe permitir aplicar filtros avanzados sobre los resultados de búsqueda (por ejemplo, categoría del objeto: electrónica, ropa, documentos, llaves, color del objeto, accesorios).
- El sistema debe permitir filtrar por rango de fechas.
- El sistema debe permitir combinar múltiples filtros de forma simultánea (categoría del objeto y color, por ejemplo).
- El sistema debe actualizar los resultados en base a los filtros aplicados.
- El sistema debe mostrar únicamente los resultados que cumplan con los criterios seleccionados.
- El sistema debe permitir limpiar o restablecer los filtros aplicados.
- El sistema debe mostrar un mensaje cuando no se encuentren resultados con los filtros aplicados.

#### EU-40 · Publicación de foto y textual de objeto encontrado (Receptar objeto)

Estado: Finalizada

**Descripción.** Como encargado quiero poder publicar la foto de un objeto encontrado en una organización, para que el propietario pueda dar con su pertenencia.

**Criterio de aceptación**

- Cargar una foto del objeto encontrado, en los formatos .jpg, .png, .jpeg.
- No permitir la carga de una foto de más de 10 MB.
- No permitir la registración de un objeto encontrado sin la foto correspondiente cargada.
- Ingresar una breve descripción del objeto encontrado, con un máximo de 100 caracteres.
- Seleccionar el nombre del establecimiento en donde se encontró el objeto.
- Avisar si la foto se registró con éxito.
- Avisar si la foto no se registró.
- Permitir eliminar la foto antes de cargarla, para volverla a cargar.

#### EU-41 · Buscar objetos perdidos subiendo una foto de mi pertenencia

Estado: Finalizada

**Descripción.** Como usuario quiero poder buscar y encontrar objetos perdidos, subiendo una foto de mi pertenencia, para que el sistema pueda verificar si el objeto ya fue reportado como encontrado, y así poder recuperarlo.

**Criterio de aceptación**

1. Se puede permitir al usuario cargar una foto de su objeto perdido para iniciar la búsqueda.
2. La foto debe tener un formato válido (jpg, png).
3. La foto no debe superar los 5 MB.
4. Se debe mostrar una lista de objetos encontrados que coincidan con la foto cargada, con un máximo de 5 resultados.
5. Para cada objeto en la lista de coincidencias, el sistema debe mostrar detalles como la fecha, el lugar y la foto del objeto encontrado.
6. El usuario debe poder seleccionar uno de los objetos que coinciden para ver más detalles.
7. Si no hay coincidencias, se debe mostrar un mensaje indicando que no se encontraron objetos similares y permitir al usuario cargar otra foto para realizar una nueva búsqueda.
8. Se debe mostrar un mensaje de error si la foto no cumple los requisitos o si hay problemas durante la carga.

#### EU-49 · Brindar feedback sobre la precisión de coincidencias

Estado: Finalizada

**Descripción.** Como usuario, quiero poder dar feedback sobre la precisión de las coincidencias que ofrece el sistema, para que los administradores y/o responsables de la organización puedan mejorar su funcionamiento.

**Criterio de aceptación**

- El sistema debe permitir al usuario brindar feedback luego de visualizar los resultados de una búsqueda.
- El feedback debe poder registrarse mediante un sistema de calificación por estrellas (por ejemplo, de 1 a 5 estrellas).
- El sistema debe permitir al usuario indicar si alguna coincidencia fue útil o no para encontrar su objeto.
- El sistema debe permitir registrar feedback tanto a nivel general de la búsqueda como sobre coincidencias específicas.
- El sistema debe permitir agregar comentarios opcionales sobre la experiencia.
- El sistema debe almacenar el feedback asociado a la búsqueda realizada y a las coincidencias evaluadas.
- El sistema debe permitir enviar el feedback de forma simple y rápida.
- El sistema debe confirmar al usuario que el feedback fue enviado correctamente.
- El sistema no debe obligar al usuario a brindar feedback para continuar utilizando la aplicación.

#### EU-110 · Publicar foto y título textual del objeto encontrado

Estado: Finalizada

**Descripción.** Como usuario quiero poder publicar la foto de un objeto encontrado, para que el propietario pueda dar con su pertenencia.

**Criterio de aceptación**

1. Se debe cargar una foto del objeto encontrado, en los formatos .jpg, .png, .jpeg.
2. No se debe permitir la carga de una foto de más de 10 MB.
3. No se debe permitir el registro de un objeto encontrado sin la foto correspondiente cargada.
4. Se debe ingresar un título del objeto encontrado, con un máximo de 30 caracteres.
5. Se debe seleccionar el nombre del establecimiento en donde se encontró el objeto o seleccionar en un mapa el punto donde se encontró.
6. Se debe avisar si la foto se registró con éxito.
7. Se debe avisar si la foto no se registró.
8. Se debe permitir eliminar la foto antes de cargarla, para volverla a cargar.
9. El título del objeto no debe estar vacío.
10. Se puede ingresar el usuario que encontró el objeto para que sume puntos.
11. Se puede ingresar el email de la persona que encontró el objeto en caso de que no sea un usuario de la organización.
12. Se debe ingresar la fecha y hora en que fue encontrado el objeto.
13. Se puede ingresar información relevante del objeto encontrado.

#### EU-142 · Coincidencia de texto robusta al vocabulario y al formato en la búsqueda

Estado: Finalizada

**Descripción.** La coincidencia entre la descripción de quien busca y la de quien encontró un objeto se apoyaba solo en la similitud de significado, y fallaba cuando ambas personas describían el mismo objeto con otras palabras, con datos que solo una incluía, con identificadores en distinto formato (un DNI escrito "45.789.654" o "45789654") o con errores de tipeo. El objetivo es que esas descripciones coincidan sin sumar llamadas nuevas a servicios de IA, combinando la búsqueda semántica con una búsqueda por palabras que premia los términos poco frecuentes y con una normalización del texto.

**Criterio de aceptación**

- "mochila prince roja" y "bolsa prince bermeja" dan una coincidencia alta.
- "...DNI 45.789.654" y "...dni 45789654" dan una coincidencia alta.
- Una descripción con "evelin" coincide con otra que dice "evelyn".
- Incluir datos extra en una descripción no reduce la coincidencia respecto de no incluirlos.

#### EU-159 · Visualizar historial de búsquedas y devoluciones de objetos

Estado: Finalizada

**Descripción.** Como usuario común, quiero poder visualizar los objetos que estoy buscando y los objetos que ya fueron encontrados o devueltos, para llevar un seguimiento de mis reclamos y recuperaciones dentro de EurekApp.

**Criterio de aceptación**

- El sistema debe permitir al usuario acceder a una sección de historial o seguimiento de objetos.
- El sistema debe mostrar los objetos que el usuario actualmente está buscando.
- El sistema debe mostrar los objetos que fueron encontrados y devueltos al usuario.
- El sistema debe mostrar el estado actual de cada objeto (por ejemplo: pendiente, en revisión, coincidencia encontrada, devuelto).
- El sistema debe mostrar información relevante de cada objeto: nombre o descripción, fecha en la que se hizo el reclamo, fecha en la que se retiró el objeto, imágenes asociadas y estado actual.
- El sistema debe permitir acceder al detalle de cada búsqueda o devolución.
- El sistema debe actualizar automáticamente el estado cuando exista una coincidencia o devolución.
- El sistema debe mostrar un mensaje si el usuario no posee búsquedas o devoluciones registradas.
- El sistema debe garantizar que cada usuario solo pueda visualizar sus propios objetos.

#### EU-275 · Reclamo → búsqueda guardada (quitar ciclo aprobar/rechazar)

Estado: Finalizada

**Descripción.** El reclamo deja de ser una afirmación de propiedad con ciclo aprobar/rechazar y pasa a ser una búsqueda guardada, visible solo para quien la creó, que lo notifica cuando aparece un objeto cuya coincidencia supera el umbral vigente del algoritmo. La organización no puede verificar la propiedad a distancia: el único control real es físico, al momento del retiro, y la organización solo registra quién retira a través del flujo de devolución.

**Criterio de aceptación.** El ticket no los redacta como criterios; define este alcance:

- Se elimina el ciclo aprobar/rechazar y, con él, todo estado de propiedad sobre el objeto.
- La búsqueda guardada es privada de su dueño; la organización ya no gestiona reclamos ni los ve.
- Al cargarse un objeto encontrado, se avisa a quienes tengan búsquedas guardadas que coincidan por encima del umbral, con un único aviso por persona que reúne todas sus búsquedas coincidentes.
- El usuario puede cerrar una búsqueda indicando si recuperó o no el objeto; las búsquedas cerradas dejan de generar avisos y quedan registradas.
- La figura del reclamo se elimina por completo del sistema.
- No incluye la detección de fraude ni el bloqueo de usuarios (EU-277).

Subtareas: EU-278 Desarmar el ciclo aprobar/rechazar; EU-279 Notificación de coincidencia al cargarse un objeto; EU-280 Ajuste de front y reportes; EU-292 Eliminación de la entidad reclamo y cierre de búsquedas guardadas.

#### EU-320 · Nuevo algoritmo de búsqueda: matching visual (imagen→vector) + texto, ponderado por categoría y modulado por geo

Estado: Finalizada

**Descripción.** Reemplazar el algoritmo de matching basado en un único vector derivado de una descripción generada por IA por una búsqueda reversa que combina similitud visual y textual, con filtro duro por categoría y modulación geográfica. El objetivo es mejorar la precisión y, sobre todo, reducir las notificaciones impertinentes de "objeto encontrado" sobre búsquedas guardadas.

**Criterio de aceptación.** El ticket no los redacta como criterios; fija estas decisiones de diseño:

- Cada objeto encontrado y cada búsqueda tienen dos vectores en Weaviate: uno de imagen (modelo tipo CLIP) y uno de texto.
- Se elimina la descripción generada por IA.
- La foto es obligatoria en la búsqueda; si el usuario no la tiene, se lo insta a buscar una imagen representativa en internet.
- El puntaje combina imagen y texto con pesos distintos por categoría (billetera: pesa más el texto; ropa: pesa menos; electrónica y llaves: similar; otros: 50/50).
- Las categorías (ropa, billetera/tarjetas, llaves, celular, otros) las define la IA desde la imagen y actúan como filtro duro: nunca se compara ni notifica entre categorías distintas.
- El radio geográfico y la fecha siguen como filtro duro; la cercanía escala el puntaje dentro del radio.
- Se conserva un umbral mínimo para disparar la notificación de una búsqueda guardada.

#### EU-361 · Estado "Por retirar" en las búsquedas guardadas

Estado: Finalizada

**Descripción.** Yo, como usuario de EurekApp, quiero que mi búsqueda guardada muestre que reconocí un objeto como mío y en qué organización tengo que ir a retirarlo, y poder volver atrás si al verlo en persona no era el mío, para no perder de vista qué objeto me está esperando ni tener que cerrar una búsqueda que en realidad sigue vigente.

**Criterio de aceptación**

- El sistema debe incorporar un estado intermedio "Por retirar" entre "Buscando" y "Cerrada".
- El sistema debe pasar la búsqueda a "Por retirar" cuando el usuario confirma "Este es mi objeto" sobre una coincidencia.
- El sistema debe registrar cuál es el objeto encontrado que el usuario reconoció como suyo.
- El detalle de la búsqueda debe mostrar en qué organización está el objeto y sus datos de contacto.
- El sistema debe ofrecer la opción "No era mi objeto" en las búsquedas "Por retirar".
- Al usar "No era mi objeto", la búsqueda debe volver a "Buscando" y no debe cerrarse.
- Una búsqueda "Por retirar" debe seguir recibiendo avisos de coincidencia.
- El usuario debe poder cerrar la búsqueda directamente desde "Por retirar", sin pasar antes por "Buscando".
- Las búsquedas "Por retirar" deben listarse junto con las activas en "Mis búsquedas", con su estado visible.
- Si el usuario tiene varias búsquedas que coinciden con el mismo objeto, solo debe cambiar de estado una.
- El sistema no debe permitir pasar a "Por retirar" una búsqueda ya cerrada, ni una búsqueda de otro usuario.

### 5.2 EU-6 · Gestión de organización

Proceso de registro de una nueva organización.

#### EU-18 · Búsqueda por ubicación

Estado: Finalizada

**Descripción.** Como usuario de la aplicación, quiero poder buscar y encontrar objetos perdidos por ubicación, seleccionando en el mapa la ubicación donde se perdió el objeto, para poder recuperar mis pertenencias de manera rápida y eficiente.

**Criterio de aceptación**

1. El usuario puede seleccionar un punto en el mapa que represente la ubicación aproximada donde perdió su objeto.
2. Se debe mostrar una lista de objetos encontrados dentro de un radio de 50 km alrededor de la ubicación seleccionada.
3. Se deben mostrar las coincidencias encontradas con una foto asociada.
4. Se debe permitir que el usuario seleccione una coincidencia de objeto y vea sus detalles, como la fecha y hora en la que fue encontrado.
5. Se debe informar al usuario sobre el lugar exacto donde puede recuperar su objeto seleccionado (nombre y dirección del establecimiento).
6. Se debe mostrar un mensaje de error informando al usuario que no se encontró un objeto en el área seleccionada.
7. Se debe ingresar una descripción del objeto.
8. Se puede seleccionar el establecimiento donde se perdió el objeto.
9. Se pueden realizar búsquedas fuera de la organización.
10. Se debe ingresar una fecha y hora aproximada donde se perdió el objeto.

#### EU-21 · Configurar políticas de manejo de objetos perdidos

Estado: Finalizada

**Descripción.** Como responsable de la organización, quiero poder configurar políticas de manejo de objetos perdidos, para ofrecer un mejor servicio a mis clientes y facilitar la devolución de pertenencias.

**Criterio de aceptación**

- El sistema debe permitir al responsable configurar políticas específicas para la gestión de objetos perdidos.
- El sistema debe permitir definir el tiempo máximo de almacenamiento de los objetos encontrados.
- El sistema debe permitir seleccionar el tipo de organización.
- El sistema debe permitir habilitar o deshabilitar el requerimiento de validación de identidad al momento de reclamar un objeto; al habilitarlo, se requerirá DNI y foto de la persona a la hora de recuperar el objeto.
- El sistema debe permitir configurar un texto descriptivo de evidencia adicional que la persona debe presentar al reclamar el objeto (no implica carga de archivos al sistema).
- El sistema debe permitir modificar las políticas configuradas en cualquier momento.
- El sistema debe permitir guardar las políticas configuradas.
- El sistema debe conservar las configuraciones guardadas al volver a ingresar a la pantalla.

#### EU-23 · Registro de devolución de un objeto encontrado

Estado: Finalizada

**Descripción.** Como encargado quiero poder registrar la devolución de un objeto encontrado, proporcionando detalles del propietario y confirmando la entrega, para asegurar que el objeto se ha entregado a su legítimo dueño de manera eficiente y segura.

**Criterio de aceptación.** La historia no tiene criterios de aceptación redactados en Jira (pendiente de completar por el equipo).

#### EU-30 · Mostrar una lista refinada de posibles coincidencias de objetos ya reportados, con su porcentaje de similitud

Estado: Finalizada

**Descripción.** Como usuario, quiero que el sistema me muestre una lista de posibles coincidencias de objetos ya reportados, asignando un porcentaje aceptable de coincidencia, para poder seleccionar la opción correcta.

**Criterio de aceptación**

1. Se debe analizar la información proporcionada por el usuario (descripción o foto) y generar una lista de posibles coincidencias de objetos reportados.
2. Se debe calcular y mostrar un porcentaje de coincidencia, indicando qué tan similar es el objeto encontrado con respecto al objeto perdido que fue reportado por el usuario.
3. Se muestran todos los objetos que presentan coincidencia, ordenados de mayor a menor porcentaje de coincidencia.
4. Se debe mostrar el detalle del objeto, con nombre del objeto, puntaje de coincidencia, foto asociada, fecha y hora de cuando se encontró el objeto.
5. Se debe mostrar un mensaje al usuario indicando que no se encontraron coincidencias si no se encuentran objetos que cumplan con el porcentaje mínimo de coincidencia.
6. El usuario debe tener la opción de guardar la búsqueda si no encuentra su objeto entre las sugerencias.

#### EU-35 · Brindar feedback sobre la usabilidad del sistema

Estado: Finalizada

**Descripción.** Como usuario, quiero poder registrar una retroalimentación sobre la usabilidad del sistema, para contribuir a su mejora continua y facilitar su uso desde mi perfil.

**Criterio de aceptación**

- El sistema debe permitir al usuario brindar feedback sobre la experiencia de uso de la aplicación.
- El feedback debe poder registrarse mediante un sistema de calificación (por ejemplo, de 1 a 5 estrellas).
- El sistema debe permitir agregar comentarios opcionales sobre la usabilidad.
- El sistema debe permitir al usuario indicar aspectos específicos: facilidad de uso, claridad de la interfaz, tiempo de respuesta y navegación dentro de la aplicación.
- El sistema debe permitir brindar feedback desde mi perfil.
- El sistema debe almacenar el feedback asociado al usuario y al contexto en que fue generado.
- El sistema debe permitir enviar el feedback de forma rápida y sencilla.
- El sistema debe confirmar al usuario que la retroalimentación fue registrada correctamente.
- El sistema no debe obligar al usuario a brindar feedback para continuar utilizando la aplicación.

#### EU-43 · Notificación de posible hallazgo de mi objeto perdido

Estado: Finalizada

**Descripción.** Como usuario que registró un reclamo de objeto perdido, quiero saber cuándo se da el matching con un objeto encontrado, para poder recuperar mi pertenencia.

**Criterio de aceptación**

1. Se deben detectar automáticamente las coincidencias entre los objetos encontrados y los reclamos de objetos perdidos.
2. Se debe enviar una notificación al usuario que registró el reclamo cuando se encuentran coincidencias.
3. La notificación debe incluir la descripción del objeto, la fecha de hallazgo y el lugar de hallazgo.
4. El usuario debe acceder a una pantalla con detalles del objeto a partir de la notificación.
5. El usuario debe poder confirmar que el objeto encontrado es el suyo o ignorar la notificación si considera que no es de su pertenencia.
6. Se debe actualizar el estado del reclamo del objeto a en proceso de devolución.
7. Si la notificación no se puede enviar, el sistema debe registrar el error e informar al usuario posteriormente.

#### EU-252 · Mejora → Alta organización

Estado: Finalizada

**Descripción.** Yo, como usuario regular de EurekApp, quiero solicitar el alta de una organización como receptora de objetos perdidos, para que pueda incorporarse a la plataforma y gestionar objetos encontrados.

**Criterio de aceptación**

- El sistema debe permitir que un usuario regular solicite el alta de una organización, y el usuario debe estar autenticado para hacerlo.
- El sistema debe completar automáticamente el correo electrónico del usuario solicitante y solicitar el nombre de la organización.
- El sistema debe permitir seleccionar un tipo de organización (universidad, colegio, hospital, empresa, municipalidad, club, gimnasio, estadio, aeropuerto, terminal de ómnibus, hotel, shopping, restaurante, evento/festival u otro); si se elige "Otro", debe permitir especificar el tipo en un campo adicional.
- El sistema debe solicitar calle, número, ciudad, provincia y país, y permitir seleccionar la ubicación en un mapa; el sistema debe almacenar la latitud y la longitud, y la ubicación es obligatoria.
- El sistema debe solicitar los datos del dueño (responsable de la organización): nombre, apellido, correo electrónico y teléfono.
- El correo electrónico debe corresponder al futuro dueño, tener un formato válido y no estar asociado a otra organización registrada en EurekApp; el teléfono es obligatorio.
- El solicitante debe ingresar un motivo por el cual quiere unirse a EurekApp.
- El usuario debe poder modificar cualquier campo de la solicitud antes de enviarla, y el sistema debe permitir enviarla cuando todos los campos estén completos correctamente.
- Al enviar correctamente la solicitud, el sistema debe mostrar un mensaje de confirmación.
- El sistema debe registrar la solicitud con estado "Pendiente de aprobación" y asociarla al usuario regular que la creó.
- El sistema debe notificar al administrador de EurekApp sobre la existencia de una nueva solicitud pendiente de revisión.

#### EU-259 · Gestionar solicitudes de alta de organizaciones

Estado: Finalizada

**Descripción.** Yo, como administrador de EurekApp, quiero visualizar las solicitudes de alta de nuevas organizaciones y poder aceptarlas o rechazarlas, para controlar qué organizaciones se incorporan a la plataforma como receptoras de objetos perdidos.

**Criterio de aceptación**

- Solo el administrador de EurekApp debe acceder a la sección de solicitudes de alta de organizaciones.
- El sistema debe mostrar un listado de solicitudes de alta pendientes; cada una con nombre y tipo de organización, dirección, ubicación, datos del futuro dueño, motivo de la solicitud, usuario que la creó, fecha de creación y estado.
- El administrador debe poder ingresar al detalle de cada solicitud y aceptar o rechazar una solicitud pendiente.
- Al aceptar, el estado cambia a Aprobada; al rechazar, a Rechazada, y el sistema debe permitir ingresar un motivo de rechazo.
- Al aceptar, el sistema debe crear o habilitar la organización y asociar al futuro dueño como dueño de la organización.
- El sistema debe notificar al usuario solicitante el resultado de la revisión, y al futuro dueño cuando la solicitud sea aprobada.
- El sistema debe impedir aceptar o rechazar una solicitud que ya fue revisada.
- El sistema debe registrar la fecha y hora de revisión y qué administrador realizó la acción.

#### EU-260 · Mejora del sistema de emails — Templates

Estado: Finalizada

**Descripción.** Los 8 correos del backend (bienvenida, recupero de contraseña, asignación de encargado, aprobación y rechazo de solicitud de organización, aviso a administradores, devolución de objeto y alerta de fraude) estaban armados concatenando HTML dentro del código Java, repartidos en cinco servicios, lo que dificultaba mantener un estilo consistente. La mejora los pasa a plantillas HTML con un diseño común.

**Criterio de aceptación.** El ticket no los redacta como criterios; define esta verificación:

- Registrar un usuario y recibir el correo de bienvenida con el nuevo formato.
- Solicitar la recuperación de contraseña y recibir el correo correcto.
- Resolver una solicitud de organización y recibir el correo de resolución correcto.

#### EU-269 · Agregar badge de solicitudes de alta pendientes en el menú lateral

Estado: Finalizada

**Descripción.** Se solicita agregar un indicador visual (badge, contador o punto rojo) junto a la opción "Solicitudes de alta" del menú lateral para mejorar la visibilidad de nuevas solicitudes.

**Criterio de aceptación**

- El sistema debe mostrar un badge junto a "Solicitudes de alta" cuando existan solicitudes pendientes.
- El badge debe indicar la cantidad de solicitudes pendientes de revisión.
- El badge debe actualizarse al aprobar o rechazar solicitudes.
- Cuando no existan solicitudes pendientes, el badge no debe mostrarse.

#### EU-270 · Enviar notificación por correo al Administrador de EurekApp ante nuevas solicitudes de alta

Estado: Finalizada

**Descripción.** Las nuevas solicitudes de alta de organización generaban una notificación dentro de EurekApp pero no un correo al administrador. Se solicita enviar un correo al administrador cada vez que un usuario registre una nueva solicitud de alta.

**Criterio de aceptación**

- El sistema debe enviar un correo al administrador cuando se genere una nueva solicitud de alta.
- El correo debe indicar que existe una nueva solicitud pendiente de revisión.
- El correo debe incluir el nombre de la organización, el nombre o correo del solicitante y la fecha de creación de la solicitud.
- Debe enviarse un correo por cada nueva solicitud registrada.

### 5.3 EU-7 · Registro y entrega de objetos encontrados

Proceso para registración de objetos encontrados.

#### EU-44 · Asignar el rol de encargado a las personas que correspondan

Estado: Finalizada

**Descripción.** Como responsable de la organización quiero poder asignar el rol de encargado a las personas que correspondan, para que puedan gestionar las tareas de confirmación de objeto encontrado y devolución del mismo.

**Criterio de aceptación**

1. Se debe mostrar una lista de usuarios registrados en la organización, para que el responsable pueda seleccionar a las personas que recibirán el rol de encargado.
2. Se debe permitir al responsable seleccionar uno o varios usuarios de la lista para asignarles el rol de encargado.
3. Una vez seleccionado el usuario, se debe mostrar un mensaje de confirmación indicando que se asignó el rol de encargado.
4. Se debe asignar el rol de encargado al usuario seleccionado, actualizando su perfil con el nuevo rol.
5. Se debe notificar al usuario que ha recibido el rol de encargado.
6. Se debe mostrar un mensaje de error si se presenta un error durante la asignación del rol.
7. El responsable debe poder ver en la lista de usuarios quienes tienen asignado el rol de encargado.

#### EU-46 · Detectar registros de objetos encontrados realizados por encargados y empleados para excluir recompensas

Estado: Finalizada

**Descripción.** Como responsable de la organización, quiero que el sistema detecte cuando un encargado o empleado registra objetos encontrados, para que no se le aplique la recompensa de puntos, por incompatibilidad de funciones.

**Criterio de aceptación**

- El sistema debe identificar el rol del usuario que registra un objeto encontrado; si es encargado o empleado, no debe asignarle recompensas de puntos asociadas a la devolución o al hallazgo del objeto.
- El sistema debe aplicar la exclusión de recompensa automáticamente al momento de registrar el objeto.
- El sistema debe dejar constancia de que no se otorgó la recompensa por incompatibilidad de funciones (en Ver devolución, dentro de Ver objetos devueltos).
- El sistema debe permitir al responsable consultar estos casos en caso de auditoría o revisión.
- La regla debe aplicarse solo a usuarios con roles incompatibles; si un usuario sin rol incompatible registra un objeto encontrado, se aplica la política de recompensas normalmente.
- El sistema debe registrar fecha, hora, usuario y rol asociado a cada caso en que no se otorgó recompensa.

#### EU-73 · Búsqueda por fecha

Estado: Finalizada

**Descripción.** Como alguien que perdió un objeto quiero poder buscar mi objeto por el rango de fechas en el cual pienso que lo perdí, para poder mejorar la búsqueda de mi objeto perdido.

**Criterio de aceptación.** El ticket lo incluye sin título de criterios:

- Los objetos tienen que tener una fecha de encontrados posterior o igual a la de pérdida.

#### EU-175 · Eliminar sección "Logros" para usuarios Empleado, Empleado con rol Encargado y Dueño de organización

Estado: Finalizada

**Descripción.** Se solicita eliminar el acceso y la visualización de la sección "Logros" para los usuarios con rol Empleado, Encargado o Dueño de organización. La sección de logros, niveles, insignias y recompensas debe permanecer disponible solo para usuarios comunes, ya que los roles operativos y administrativos no participan del esquema de recompensas: no deben recibir puntos, niveles ni insignias.

**Criterio de aceptación.** La historia no tiene criterios de aceptación redactados en Jira; el requisito está en la descripción.

### 5.4 EU-9 · Gestión de reportes

Proceso para generar y obtener reportes de objetos perdidos. En Jira esta épica también agrupa historias de alta de usuarios y de solicitud de alta de organización.

#### EU-16 · Registrar alta de nuevos usuarios

Estado: Finalizada

**Descripción.** Yo como nuevo solicitante, quiero poder crear y gestionar mi usuario, para poder comenzar a utilizar la plataforma.

**Criterio de aceptación**

- Creación de cuenta exitosa: el solicitante debe poder crear una cuenta proporcionando la información requerida (nombre, apellido, correo electrónico, contraseña) en el formulario de registro.
- Al completar el formulario, el sistema debe registrar al usuario y confirmar que la cuenta ha sido creada con éxito.
- Los campos obligatorios (nombre, apellido, correo electrónico, contraseña) deben estar completos antes de que el usuario pueda enviar el formulario.
- La contraseña debe tener una longitud de entre 8 y 16 caracteres, alfanumérica, y puede tener caracteres especiales.
- Después de crear una cuenta, el usuario debe recibir un correo electrónico de confirmación.
- El usuario registrado debe poder iniciar sesión en la plataforma utilizando su correo electrónico y contraseña.
- El sistema debe mostrar un mensaje de error en caso de contraseñas incorrectas.

#### EU-20 · Registrar solicitud de alta de organización

Estado: Finalizada

**Descripción.** Yo como responsable de la organización, quiero poder registrar la solicitud de alta de mi organización como receptora de objetos perdidos, para gestionar eficientemente la devolución de objetos encontrados.

**Criterio de aceptación**

- El correo electrónico ingresado debe tener un formato válido.
- Si algún campo obligatorio está vacío o contiene un formato incorrecto, el sistema debe mostrar un mensaje de error junto al campo que necesita corrección.
- Al completar el formulario correctamente, el sistema debe mostrar un mensaje de confirmación de que la solicitud ha sido registrada exitosamente.
- El usuario debe poder editar cualquier campo antes de enviar el formulario.

#### EU-25 · Generar reporte de uso del sistema

Estado: Finalizada

**Descripción.** Como responsable de la organización, quiero generar reportes sobre el uso del sistema, para analizar el nivel de adopción, identificar patrones de uso y tomar decisiones de mejora.

**Criterio de aceptación**

- El sistema debe registrar la actividad de los usuarios dentro de la plataforma y permitir generar reportes de uso del sistema.
- Los reportes deben incluir métricas como cantidad de usuarios activos, de búsquedas realizadas, de objetos registrados como perdidos, de objetos registrados como encontrados, de coincidencias generadas, de reclamos iniciados y de objetos efectivamente devueltos.
- El sistema debe permitir visualizar tendencias de uso en el tiempo, por día, semana o mes.
- El sistema debe permitir filtrar los reportes por rango de fechas.
- El sistema debe permitir visualizar la información de forma clara, en gráficos o tablas.
- El sistema debe permitir exportar los reportes en formato PDF o Excel.
- El sistema debe garantizar la privacidad de los datos de los usuarios en los reportes.

#### EU-26 · Generar reporte de feedback sobre la precisión de coincidencias

Estado: Finalizada

**Descripción.** Como responsable de la organización, quiero generar reportes de feedback sobre la precisión de las coincidencias sugeridas por el sistema, para poder ajustar las políticas configuradas y mejorar la calidad de las recomendaciones.

**Criterio de aceptación**

- El sistema debe solicitar al usuario feedback luego de cada búsqueda realizada, mediante calificación por estrellas (por ejemplo, de 1 a 5).
- El sistema debe permitir al usuario indicar si encontró o no su objeto gracias a las coincidencias sugeridas, y almacenar el feedback asociado a cada búsqueda.
- El sistema debe permitir al responsable visualizar reportes agregados de feedback, con métricas como promedio de calificación de coincidencias, cantidad de búsquedas exitosas vs no exitosas y distribución de calificaciones (cantidad de 1, 2, 3, 4 y 5 estrellas).
- El sistema debe permitir filtrar los reportes por rango de fechas y por organización.
- El sistema debe permitir identificar tendencias o caídas en la precisión de coincidencias.
- El sistema debe permitir exportar el reporte (por ejemplo, en formato PDF o Excel).
- El sistema debe utilizar el feedback recolectado para mejorar el algoritmo de coincidencias de forma continua.

#### EU-29 · Visualizar reclamos de objetos perdidos

Estado: Finalizada

**Descripción.** Como encargado, quiero poder ver los reclamos de objetos perdidos registrados en el sistema, para gestionarlos, validarlos y dar seguimiento a cada caso. Esta historia es anterior a EU-275, que eliminó el ciclo de reclamos.

**Criterio de aceptación**

- El sistema debe permitir al encargado visualizar un listado de reclamos de objetos perdidos, con estado del reclamo (Pendiente, En revisión, Aprobado, Rechazado), nombre y categoría del objeto, nombre y email del usuario reclamante, y fecha y hora del reclamo.
- El sistema debe permitir acceder al detalle de cada reclamo, que muestra estado, nivel de confianza, datos del reclamante, imagen, título, categoría y descripción del objeto (incluida la descripción provista por IA), fecha y hora del hallazgo, ubicación por coordenadas, fecha y hora del reclamo, última actualización y puntuación otorgada por el usuario.
- El sistema debe permitir filtrar los reclamos por estado, fecha y tipo de objeto, y ordenarlos por esos mismos criterios.
- El sistema debe permitir identificar fácilmente los reclamos pendientes de revisión y actualizar su estado en tiempo real.
- El sistema debe garantizar que solo los usuarios autorizados puedan acceder a esta información.

#### EU-165 · Agregar exportación de reportes en formato PDF en sección Reportes

Estado: Finalizada

**Descripción.** Como dueño de la organización, quiero poder exportar los reportes generados por el sistema en formato PDF, para descargar, compartir y conservar la información relevante del funcionamiento de EurekApp.

**Criterio de aceptación**

- El sistema debe mostrar un botón de exportación en formato PDF dentro de la sección Reportes, y solo el dueño de la organización podrá exportar reportes en PDF.
- El sistema debe permitir exportar en PDF el reporte de uso del sistema, el reporte de precisión de coincidencias y el reporte de usuarios con fraudes detectados.
- El PDF debe incluir como mínimo ID del registro, organización asociada, nombre del objeto encontrado, puntaje o calificación, indicador de coincidencia encontrada, fecha de creación y comentario del usuario.
- El PDF también debe incluir métricas, gráficos, tablas, filtros aplicados y fecha y hora de generación del reporte, manteniendo la información visual mostrada en pantalla.
- El sistema debe permitir descargar automáticamente el archivo PDF generado.
- El nombre del archivo exportado debe incluir el nombre del reporte y la fecha de generación (por ejemplo, Reporte\_Uso\_2026-05-22.pdf).
- El sistema debe mostrar un mensaje de error si ocurre un problema durante la exportación.

#### EU-219 · Visualizar porcentaje de recuperación de objetos en reporte de uso del sistema

Estado: Finalizada

**Descripción.** Yo, como responsable de la organización, quiero visualizar en un gráfico circular el porcentaje de recuperación de objetos dentro del reporte de uso del sistema, para medir la efectividad del proceso de recuperación.

**Criterio de aceptación**

- El sistema debe mostrar el porcentaje de objetos recuperados y el de no recuperados.
- El cálculo debe considerar objetos devueltos sobre objetos encontrados o registrados.
- El gráfico debe actualizarse según el rango de fechas seleccionado.
- El gráfico debe visualizarse dentro del reporte de uso del sistema.

#### EU-220 · Visualizar categoría de objetos más reportados en reporte de uso del sistema

Estado: Finalizada

**Descripción.** Yo, como responsable de la organización, quiero visualizar en un gráfico de barras horizontales los objetos más reportados dentro del reporte de uso del sistema, para identificar patrones frecuentes de pérdida.

**Criterio de aceptación**

- El sistema debe mostrar los objetos más reportados y la cantidad de reportes por objeto.
- El sistema debe ordenar los objetos de mayor a menor cantidad.
- El gráfico debe actualizarse según el rango de fechas seleccionado.
- El gráfico debe visualizarse dentro del reporte de uso del sistema.

#### EU-221 · Visualizar tiempo promedio de recuperación en reporte de uso del sistema

Estado: Finalizada

**Descripción.** Yo, como responsable de la organización, quiero visualizar el tiempo promedio de recuperación dentro del reporte de uso del sistema, para medir la rapidez con la que se resuelven los reclamos.

**Criterio de aceptación**

- El sistema debe calcular el tiempo promedio de recuperación.
- El cálculo debe considerar la diferencia entre la fecha de registro o hallazgo y la fecha de devolución.
- El sistema debe mostrar el valor promedio en una tarjeta de indicador (KPI).

#### EU-222 · Visualizar distribución de calificaciones en reporte de feedback sobre precisión de coincidencias

Estado: Finalizada

**Descripción.** Yo, como responsable de la organización, quiero visualizar en un gráfico de barras horizontales por estrellas la distribución de calificaciones dentro del reporte de feedback sobre precisión de coincidencias, para analizar la satisfacción de los usuarios con las coincidencias sugeridas.

**Criterio de aceptación**

- El sistema debe mostrar las calificaciones de 1 a 5 estrellas y la cantidad de calificaciones por cada estrella.
- El sistema debe mostrar el promedio entre todas las calificaciones.
- El gráfico debe actualizarse según el rango de fechas seleccionado.
- El gráfico debe visualizarse dentro del reporte de feedback sobre precisión de coincidencias.

#### EU-223 · Visualizar búsquedas exitosas vs no exitosas en reporte de feedback sobre precisión de coincidencias

Estado: Finalizada

**Descripción.** Yo, como responsable de la organización, quiero visualizar en un gráfico circular la relación entre búsquedas exitosas y no exitosas dentro del reporte de feedback sobre precisión de coincidencias, para evaluar si las coincidencias sugeridas ayudan realmente a recuperar objetos.

**Criterio de aceptación**

- El sistema debe mostrar la cantidad de búsquedas exitosas y de no exitosas, y el porcentaje correspondiente a cada grupo.
- El gráfico debe actualizarse según el rango de fechas seleccionado.
- El gráfico debe visualizarse dentro del reporte de feedback sobre precisión de coincidencias.

#### EU-224 · Visualizar tendencias de precisión de coincidencias en el reporte de feedback

Estado: Finalizada

**Descripción.** Yo, como responsable de la organización, quiero visualizar la evolución de las búsquedas exitosas, fallidas y la calificación promedio a lo largo del tiempo, para identificar variaciones en la precisión de coincidencias y evaluar la calidad de las recomendaciones realizadas por EurekApp.

**Criterio de aceptación**

- El sistema debe mostrar la evolución de las búsquedas exitosas, la de las búsquedas fallidas y la calificación promedio, por período.
- El sistema debe considerar únicamente el feedback registrado por los usuarios.
- La información debe actualizarse según el rango de fechas seleccionado y visualizarse dentro del reporte de precisión de coincidencias.
- La tendencia debe mostrarse mediante una tabla cronológica de períodos.

#### EU-225 · Visualizar fraudes confirmados vs falsas alarmas en el Reporte de detecciones de fraude

Estado: Finalizada

**Descripción.** Como administrador de EurekApp, quiero visualizar en un gráfico circular la relación entre fraudes confirmados y falsas alarmas dentro del Reporte de detecciones de fraude, para evaluar la efectividad de las reglas automáticas de detección y determinar si es necesario ajustarlas. Con el modelo actual de fraude toda alerta nace confirmada; el único cambio posible es marcarla como falsa alarma, que además levanta el bloqueo.

**Criterio de aceptación**

- El sistema debe mostrar la cantidad total de fraudes confirmados (alertas activas) y la de alertas marcadas como falsa alarma dentro del rango de fechas seleccionado, con el porcentaje de cada categoría.
- El gráfico debe ser circular, actualizarse según el rango de fechas y visualizarse dentro del Reporte de detecciones de fraude.
- Deben considerarse los tres casos de detección vigentes: retiros repetidos asociados a un mismo documento, acuerdo entre quien deposita y quien retira, y acuerdo entre un empleado y quien retira.
- El reporte debe ser accesible únicamente para el administrador de EurekApp.

#### EU-226 · Visualizar personas con múltiples fraudes en el Reporte de detecciones de fraude

Estado: Finalizada

**Descripción.** Como administrador de EurekApp, quiero visualizar dentro del Reporte de detecciones de fraude a las personas con múltiples casos asociados, ordenadas por cantidad de casos y con las reincidentes destacadas, para identificar a quienes concentran alertas. El reporte se agrupa por usuario registrado o por documento (DNI), porque buena parte de las personas involucradas no tiene cuenta; los conteos corresponden al rango consultado y la reincidencia se informa aparte, como acumulado histórico.

**Criterio de aceptación**

- El reporte debe listar a las personas con casos de fraude asociados, agrupadas por usuario o por documento según lo que elija quien consulta.
- Debe mostrarse la cantidad de casos del período consultado, discriminando alertas activas y falsas alarmas.
- El listado debe poder ordenarse de mayor a menor cantidad de casos.
- Debe destacarse visualmente a las personas reincidentes, es decir, quienes acumulan alertas anteriores al período consultado.
- Debe mostrarse el total histórico acumulado de alertas de cada persona, separado de los números del período.
- Debe poder consultarse el historial completo de cada persona desde su fila del reporte.
- El reporte debe ser accesible únicamente para el administrador de EurekApp.

#### EU-227 · Visualizar la evolución de los casos de fraude en el Reporte de detecciones de fraude

Estado: Finalizada

**Descripción.** Como administrador de EurekApp, quiero visualizar en un gráfico de barras la evolución de los casos de fraude dentro del Reporte de detecciones de fraude, para analizar si los casos aumentan o disminuyen con el tiempo. El reporte es de acceso exclusivo del administrador; las alertas son globales, por lo que no hay filtro por organización, y el gráfico diferencia alertas activas de falsas alarmas.

**Criterio de aceptación**

- El gráfico debe mostrar la cantidad de casos de fraude por período, y permitir agrupar la evolución por día, semana o mes.
- El gráfico debe considerar únicamente las alertas del rango de fechas seleccionado y actualizarse al modificarlo.
- Todos los períodos del rango deben aparecer en el eje, incluidos los que no tienen casos, que se muestran en cero.
- El gráfico debe diferenciar las alertas activas de las marcadas como falsa alarma.
- El gráfico debe ser de barras verticales y visualizarse dentro del Reporte de detecciones de fraude.
- El reporte debe ser accesible únicamente para el administrador de EurekApp.

#### EU-228 · Generar reporte de feedback sobre usabilidad del sistema

Estado: Finalizada

**Descripción.** Yo, como responsable de la organización, quiero generar reportes sobre el feedback de usabilidad del sistema, para identificar problemas de experiencia de usuario y mejorar continuamente la aplicación.

**Criterio de aceptación**

- El sistema debe permitir generar reportes sobre feedback de usabilidad.
- El sistema debe mostrar el promedio general de satisfacción según las calificaciones por estrellas, con indicadores (KPI).
- El sistema debe mostrar la distribución de calificaciones de 1 a 5 estrellas con gráfico de barras horizontales.
- El sistema debe mostrar los aspectos de usabilidad más seleccionados (facilidad de uso, claridad de interfaz, tiempo de respuesta y navegación) con gráfico de barras verticales.
- El sistema debe mostrar la evolución del promedio de satisfacción en el tiempo con gráfico de líneas.
- El sistema debe permitir visualizar los comentarios opcionales de los usuarios en una tabla.
- El sistema debe permitir filtrar el reporte por rango de fechas, y visualizar la información mediante gráficos y tablas.
- El sistema debe permitir exportar el reporte en PDF o Excel.
- El sistema debe garantizar la privacidad de los datos de los usuarios.

### 5.5 EU-10 · Servicio de notificaciones de matching

La épica no tiene descripción en Jira. Hoy agrupa una sola historia, de reportes de fraude.

#### EU-27 · Generar reporte de usuarios con fraude detectado

Estado: Finalizada

**Descripción.** Como encargado de la organización, quiero poder generar un reporte de los usuarios que han cometido fraudes, para poder identificarlos y aplicar sanciones de manera adecuada dentro de mi organización. Esta historia es anterior al modelo actual de fraude (EU-277), en el que el reporte es solo del administrador de EurekApp.

**Criterio de aceptación**

- El sistema debe registrar los casos de fraude confirmados por el encargado y permitir generar un reporte de usuarios con fraude confirmado.
- El reporte debe incluir usuario involucrado, cantidad de casos de fraude asociados, tipo de fraude detectado, fecha de cada incidente y estado del caso (confirmado o en revisión).
- El sistema debe permitir visualizar el historial de fraudes por cada usuario e identificar usuarios reincidentes.
- El sistema debe permitir ordenar los usuarios según cantidad de fraudes o gravedad.
- El sistema debe permitir filtrar el reporte por rango de fechas y por estado del caso (confirmado o en revisión).
- El sistema debe permitir visualizar la información en formato de tabla o gráfico, y exportar el reporte en PDF o Excel.
- El sistema debe garantizar la privacidad y el acceso restringido a esta información.
- El sistema debe sugerir posibles acciones o sanciones en base al historial del usuario: advertencia, suspensión temporal o bloqueo.

### 5.6 EU-39 · Registro de usuarios

Proceso de gestión de usuarios. En Jira esta épica también agrupa historias de fraude, notificaciones y administración de la plataforma.

#### EU-36 · Registrarse utilizando Google

Estado: Finalizada

**Descripción.** Como nuevo solicitante, quiero poder crear mi usuario utilizando mi cuenta de Google para registrarme de forma rápida y sencilla sin necesidad de completar formularios extensos.

**Criterio de aceptación**

- El sistema debe permitir al usuario registrarse utilizando Google y redirigirlo al proveedor de autenticación.
- El usuario debe autorizar el acceso a sus datos básicos (nombre, email, foto de perfil).
- El sistema debe crear una cuenta automáticamente con la información obtenida y validar que el email no esté previamente registrado; si el email ya existe, debe asociar la cuenta de red social al usuario existente.
- El sistema debe iniciar sesión automáticamente luego del registro exitoso.
- El sistema debe permitir al usuario completar o editar sus datos adicionales luego del registro.
- El sistema debe garantizar la seguridad en el proceso de autenticación y mostrar mensajes claros en caso de error durante el registro.

#### EU-47 · Detectar y notificar posibles casos de fraude

Estado: Finalizada

**Descripción.** Como encargado, quiero que el sistema me avise cuando se detecten casos sospechosos de fraude entre usuarios que registran y reclaman objetos perdidos y encontrados, para poder revisar la situación y confirmar si se trata de un caso real o de un falso positivo. EU-277 reemplazó el alcance de esta historia, que quedó como la versión anterior, basada en reclamos.

**Criterio de aceptación**

- El sistema debe analizar las interacciones entre usuarios que registran objetos encontrados y usuarios que los reclaman, y detectar patrones sospechosos (interacciones repetidas entre los mismos usuarios, coincidencias reiteradas entre los mismos perfiles).
- El sistema debe generar una alerta cuando se identifique un caso sospechoso, visible para el encargado responsable (el ticket anota que debe ser para el administrador), con usuarios involucrados, objeto asociado, fecha y hora y motivo de sospecha.
- El sistema debe permitir acceder al detalle del caso y marcarlo como fraude confirmado o falso positivo, y registrar el resultado de la revisión.
- El sistema debe bloquear al usuario la cantidad de días definida en la configuración.
- El sistema debe conservar un historial de alertas y sus resoluciones.

#### EU-161 · Visualizar notificaciones desde el menú lateral

Estado: Finalizada

**Descripción.** Como usuario, quiero contar con una sección de notificaciones en el menú lateral, para poder visualizar avisos importantes del sistema, como solicitudes recibidas, cambios de rol, coincidencias encontradas o recompensas obtenidas.

**Criterio de aceptación**

- El sistema debe mostrar una opción Notificaciones en el menú lateral y permitir acceder a un listado de notificaciones.
- El sistema debe mostrar notificaciones relacionadas con solicitudes recibidas, por ejemplo invitaciones para ser empleado de una organización.
- Cada notificación debe mostrar título, descripción, fecha y hora y estado, y permitir identificar las leídas y las no leídas.
- El sistema debe permitir aceptar o rechazar solicitudes cuando corresponda.
- El sistema debe actualizar el menú o mostrar un indicador cuando existan notificaciones pendientes.
- El sistema debe mostrar un mensaje si el usuario no tiene notificaciones.

#### EU-218 · Recuperar contraseña

Estado: Finalizada

**Descripción.** Yo, como usuario registrado, quiero recuperar mi contraseña en caso de olvidarla, para poder volver a acceder a mi cuenta de EurekApp. El usuario ingresa el email asociado a su cuenta, el sistema le envía un código de verificación y, una vez validado el código en EurekApp, puede establecer una nueva contraseña que cumpla los requisitos mínimos de seguridad.

**Criterio de aceptación**

- El sistema debe mostrar un enlace visible "¿Olvidaste tu contraseña?" en la pantalla de inicio de sesión, que lleve a un formulario de recuperación donde se ingresa el email asociado a la cuenta.
- El sistema debe validar que el email exista; si existe, debe enviar un correo con un código de verificación; si no existe, debe mostrar un mensaje de error claro.
- El usuario debe poder ingresar el código recibido dentro de EurekApp, y el sistema debe validarlo; si es incorrecto, debe mostrar un error y no permitir continuar.
- Si el código es válido, el sistema debe permitir ingresar una nueva contraseña que cumpla los requisitos mínimos de seguridad.
- Una vez cambiada la contraseña, el sistema debe mostrar un mensaje de confirmación y el usuario debe poder iniciar sesión con la nueva contraseña.
- El código de verificación debe tener una fecha de expiración por motivos de seguridad.
- El sistema no debe permitir cambiar la contraseña sin haber validado previamente un código de verificación válido.

#### EU-246 · Enviar mail al usuario al recibir una solicitud de organización y al ser asignado como encargado

Estado: Finalizada

**Descripción.** Yo, como usuario de EurekApp, quiero recibir notificaciones por correo electrónico cuando una organización me invite a unirme como empleado o cuando se me asigne el rol de encargado, para estar informado sobre cambios en mis permisos y accesos dentro de la organización. El título en Jira lleva la nota de hacerlo más claro y dividirlo en dos: envío de la solicitud de empleado y solicitud de encargado.

**Criterio de aceptación**

- El sistema debe enviar un correo cuando una organización envíe una solicitud para incorporar a un usuario como empleado; el mail debe indicar el nombre de la organización, el rol ofrecido y que existe una solicitud pendiente dentro de la aplicación.
- El sistema debe enviar un correo cuando un usuario sea asignado como encargado; el mail debe indicar la organización asociada, el nuevo rol asignado y las nuevas funcionalidades.
- El sistema debe enviar el correo únicamente a usuarios registrados, automáticamente después de la acción correspondiente, y mostrar correctamente el nombre de la organización y del rol asignado.
- El sistema no debe enviar múltiples mails duplicados por una misma acción.

#### EU-261 · Gestión de usuarios del sistema

Estado: Finalizada

**Descripción.** Como administrador de EurekApp, quiero poder visualizar y gestionar las cuentas de los usuarios registrados en la plataforma, para mantener el control sobre quién puede operar en el sistema y tomar acciones ante comportamientos indebidos.

**Criterio de aceptación**

- Solo el administrador debe acceder a la sección de gestión de usuarios.
- El sistema debe mostrar un listado de todos los usuarios registrados, filtrable por rol (USER, ORGANIZATION\_OWNER, ORGANIZATION\_EMPLOYEE, ENCARGADO, ADMIN).
- Cada usuario debe mostrar nombre completo, email, rol, estado (activo o inactivo), XP y objetos devueltos, y el administrador debe poder ver su detalle.
- El administrador debe poder activar o desactivar una cuenta; al desactivarla, el sistema debe impedir que ese usuario inicie sesión.
- El sistema debe impedir que el administrador se desactive a sí mismo.
- El sistema debe registrar quién y cuándo realizó el cambio de estado.

#### EU-262 · Gestión de organizaciones activas

Estado: Finalizada

**Descripción.** Como administrador de EurekApp, quiero poder visualizar y administrar las organizaciones que operan activamente en la plataforma, para poder intervenir ante problemas operativos o conductas indebidas sin necesitar acceso directo a la base de datos.

**Criterio de aceptación**

- Solo el administrador debe acceder a la sección de gestión de organizaciones.
- El sistema debe mostrar un listado de todas las organizaciones activas e inactivas, con nombre, tipo, ciudad, contacto, estado (activa o inactiva) y cantidad de empleados; el administrador debe poder ver el detalle de una organización.
- El administrador debe poder desactivar una organización activa y reactivar una inactiva, y el sistema debe pedir confirmación antes de desactivarla.
- Al desactivar una organización, sus empleados mantienen su rol pero la organización deja de operar: no aparece en la selección de objetos encontrados.

#### EU-263 · Dashboard de estadísticas globales

Estado: Finalizada

**Descripción.** Como administrador de EurekApp, quiero tener una vista general del estado de la plataforma con métricas clave, para tomar decisiones informadas y monitorear el crecimiento y la salud del sistema.

**Criterio de aceptación**

- Solo el administrador debe acceder al dashboard.
- El dashboard debe mostrar, como mínimo, el total de usuarios registrados, de organizaciones activas, de objetos encontrados registrados, de objetos perdidos reportados y de devoluciones exitosas, las solicitudes de alta de organización pendientes y las alertas de fraude pendientes de resolución.
- Los datos deben reflejar el estado actual de la plataforma, sin necesidad de refrescar manualmente.
- El dashboard debe ser la pantalla de inicio del panel de administración.

### 5.7 EU-45 · Servicio de notificaciones de fraude

La épica no tiene descripción en Jira.

#### EU-277 · Detectar y limitar fraude en devoluciones (bloqueo automático)

Estado: Finalizada

**Descripción.** Como dueño de EurekApp, quiero que el sistema me avise cuando las mismas personas aparezcan repetidamente aportando o recuperando objetos, para limitar la acción de quienes defraudan el sistema, o poder marcarlo como falsa alarma. Se buscan dos fraudes: personas que se ponen de acuerdo para entregar y recuperar objetos entre ellas y acumular puntos, y personas con un volumen anómalo de retiros. Reemplaza el alcance de EU-47.

**Criterio de aceptación.** El ticket los expresa como reglas de detección y comportamiento:

- Se dispara una alerta cuando, dentro de una ventana de tiempo, la cantidad de devoluciones de cierto tipo alcanza el umbral configurado. Caso 1: mismo documento de quien retira (bloquea el documento). Caso 2: mismo par de quien aporta el objeto y documento de quien lo retira (bloquea a ambos usuarios y al documento). Caso 3: mismo par de empleado que entrega y documento de quien retira, con objetos aportados por personas distintas (bloquea el documento y al empleado).
- El dueño de EurekApp configura el umbral (único para los tres casos), la ventana de detección y la duración del bloqueo, sin tocar el sistema.
- Si se cumple más de un caso a la vez, se genera una sola alerta que registra todos los casos que aplican.
- La alerta nace activa, es visible solo para el dueño de EurekApp y contiene los casos disparados, las identidades involucradas, la organización, los objetos con sus fechas y la cantidad detectada.
- El sistema bloquea automáticamente a las personas y documentos involucrados por la duración configurada.
- No se generan alertas duplicadas para el mismo documento dentro de la ventana de detección.
- El dueño de EurekApp puede marcar la alerta como falsa alarma, lo que levanta el bloqueo y notifica a quienes quedan liberados; es la única acción humana disponible.
- Quien queda bloqueado recibe un correo con el motivo, la duración y un canal de contacto para apelar; si el bloqueo recae sobre un documento sin cuenta, el aviso aparece en pantalla al usarlo en una devolución.
- Todas las alertas y sus datos quedan en un historial consultable.

### 5.8 EU-53 · Documentación del Proyecto

La épica no tiene descripción en Jira.

#### EU-414 · Documentación del Producto

Estado: Tareas por hacer

**Descripción.** Documento pedido por el profesor Aquino para la defensa técnica. Debe contener, igual que el resto de los documentos, carátula, historial de revisión, índice, introducción y audiencia, y además: nombre y objetivo del producto, Product Backlog final, matriz de trazabilidad contra el Estudio Inicial, roles del sistema, épicas e historias con descripción, criterio de aceptación y diseño de interfaz de cada una, diagrama de clases, DER y diagramas de transición de estados.

**Criterio de aceptación**

- Diagrama de clases.
- DER: claves primarias y foráneas; por cada atributo, longitud, tipo de dato y valores posibles cuando corresponda.
- Diagramas de transición de estados: por cada método, número y nombre de la historia de usuario responsable del cambio de estado; estado inicial y estados finales.

### 5.9 Historias sin épica asignada

Siete historias no tienen épica en Jira.

#### EU-319 · El feedback sobre la aplicación se le pide al usuario final y lo ve el administrador

Estado: Finalizada

**Descripción.** Yo, como administrador de EurekApp, quiero ver la opinión que los usuarios finales tienen sobre la aplicación, para poder corregir los problemas de uso que hoy no me llegan. La aplicación le pregunta por su usabilidad al personal de las organizaciones (al receptar cada objeto) y muestra el resultado al responsable de organización, mientras que las respuestas de los usuarios finales se guardan y no aparecen en ninguna pantalla. La historia corrige ambas cosas sin reescribir EU-228.

**Criterio de aceptación**

1. Un empleado que carga un objeto encontrado no recibe ningún pedido de opinión.
2. Cualquier usuario puede dejar su opinión sobre la aplicación desde su perfil, como hasta ahora.
3. Al cerrar una búsqueda guardada, el dueño recibe el pedido de opinión sobre la aplicación, tanto si indicó que recuperó su objeto como si no.
4. Ese pedido se puede omitir, y omitirlo no impide que la búsqueda se cierre.
5. El administrador de EurekApp accede al reporte y ve todas las respuestas juntas, sin importar de qué organización venga cada usuario ni si pertenece a alguna.
6. La opinión de un usuario final que no pertenece a ninguna organización aparece en ese reporte.
7. El responsable de una organización ya no accede a este reporte.

#### EU-339 · Configurar parámetros globales de detección de fraude

Estado: Finalizada

**Descripción.** Como administrador del sistema quiero configurar los parámetros utilizados por el mecanismo automático de detección de fraude, para ajustar cuándo se genera una alerta y cuánto tiempo se aplica una sanción automática. Los parámetros son el umbral de detección (cantidad de devoluciones sospechosas que dispara una alerta), la ventana de detección en días y la duración del bloqueo en días; el administrador los modifica y guarda con el botón "Guardar cambios".

**Criterio de aceptación**

- El administrador debe poder acceder a la sección Configuración de fraude, y los demás usuarios no.
- El sistema debe mostrar los valores actuales de umbral, ventana y duración del bloqueo, y permitir modificar cada uno y guardar los cambios.
- El sistema debe conservar los valores configurados luego de recargar la pantalla o volver a ingresar.
- El sistema debe validar que los campos obligatorios no queden vacíos, aceptar únicamente enteros válidos, no permitir valores negativos y mostrar un mensaje cuando se ingrese un valor inválido.
- El sistema debe mostrar una confirmación cuando la configuración se guarde y un mensaje de error si ocurre un problema al guardar.
- La configuración debe aplicarse globalmente a todas las organizaciones.
- El sistema debe usar el umbral para decidir cuándo generar una alerta, la ventana para determinar si una persona retiró más de N objetos dentro de esos días y la duración configurada al aplicar una sanción automática.

#### EU-365 · Propagar a todos los entornos el arreglo del esquema de fraude detectado en EU-352

Estado: Tareas por hacer

**Descripción.** Como equipo de desarrollo de EurekApp, queremos que el arreglo del esquema de la tabla `fraud_alert` quede versionado en el repositorio y aplicado en todos los entornos, para que la detección de fraude funcione para todo el equipo y no dependa de parchear cada base a mano. EU-352 reportó que al superar el umbral no se generaba ninguna alerta; la causa no estaba en la lógica de detección sino en el esquema: `ddl-auto: update` no modifica columnas ya existentes, y en las bases anteriores al rediseño de fraude `organization_id` seguía siendo obligatoria y `status` conservaba valores que ya no existen. El arreglo se aplicó solo en un entorno local y no está versionado.

**Criterio de aceptación**

- El arreglo del esquema debe quedar versionado en el repositorio, de modo que cualquier integrante lo reciba sin ejecutar SQL a mano.
- El parche debe seguir el patrón ya usado en `seed-local.sh` para el `ENUM` de `role`: chequear, corregir solo si hace falta e informar por pantalla.
- El parche debe cubrir la nulabilidad de `organization_id`, el tipo de `status` y la limpieza de las filas con status fuera de `ACTIVE` y `FALSE_POSITIVE`.
- El mismo DDL debe aplicarse en la base del ambiente compartido.
- La detección de fraude debe funcionar de punta a punta en un entorno distinto del local donde se verificó el arreglo.
- El cambio va con rama y PR sobre `main`, como el resto.

#### EU-366 · La organización se califica después de la devolución, no antes

Estado: Finalizada

**Descripción.** Yo, como responsable de una organización, quiero conocer la opinión de las personas que efectivamente retiraron su objeto en mi organización, para saber cómo estamos atendiendo y qué corregir. Hasta ahora se calificaba a la organización al ver los resultados de una búsqueda, cuando la persona todavía no había tratado con ella; la calificación pasa a pedirse por correo después de la devolución, con cinco aspectos de 1 a 5 (trato del personal, tiempo de espera, claridad de las indicaciones, estado en que recibió el objeto y seguridad del retiro) y un comentario opcional.

**Criterio de aceptación**

1. Al ver los resultados de una búsqueda ya no se le pide a la persona que califique a la organización.
2. Después de que un empleado asienta la devolución de un objeto, su dueño recibe un correo que lo invita a calificar la atención de esa organización.
3. El enlace del correo lleva a la encuesta dentro de la aplicación; si la sesión venció, el usuario inicia sesión y llega ahí.
4. A esa encuesta no se llega por ningún otro camino: no aparece en menús ni en el perfil.
5. La encuesta pide los cinco aspectos puntuables y un comentario opcional; se puede abandonar sin responder.
6. Si esa devolución ya fue calificada, se le avisa en lugar de dejarla responder de nuevo.
7. Quien retira un objeto sin estar registrado en EurekApp no recibe la invitación, y la devolución se completa igual, sin error.
8. Las respuestas aparecen en el reporte del responsable de la organización donde la persona retiró el objeto, y en el de ninguna otra.
9. Ese reporte muestra un promedio por cada aspecto, no un promedio único.
10. La cantidad de búsquedas que terminaron encontrando el objeto se sigue viendo en ese reporte, como hasta ahora.

#### EU-396 · La búsqueda guardada refleja que el objeto ya fue retirado

Estado: Finalizada

**Descripción.** Yo, como usuario de EurekApp, quiero que mi búsqueda guardada me muestre cuando el objeto que reconocí como mío ya fue entregado, lo haya retirado yo u otra persona, para no quedarme esperando algo que ya no está y saber qué me queda por hacer en cada caso. Los datos de quien retiró el objeto no se le muestran al usuario, y el cierre de la búsqueda lo sigue decidiendo él.

**Criterio de aceptación**

- El sistema debe incorporar dos estados nuevos a la búsqueda guardada: "Retirado" y "Retirado por alguien más".
- Cuando se registra la devolución del objeto al que apunta una búsqueda "Por retirar", el sistema debe pasarla a "Retirado" si quien retiró es el dueño de la búsqueda, y a "Retirado por alguien más" en cualquier otro caso, incluida la entrega a alguien sin cuenta.
- "Retirado" debe mostrarse en verde y "Retirado por alguien más" en naranja, junto al resto de los estados en "Mis búsquedas".
- En "Retirado", la única acción disponible debe ser cerrar la búsqueda: no deben mostrarse "No era mi objeto" ni las indicaciones de dónde retirarlo.
- En "Retirado por alguien más", el sistema debe mostrar el nombre y la dirección de la organización que tenía el objeto, no mostrar los datos de la persona que retiró, y ofrecer como única acción cerrar la búsqueda.
- Al cerrar una búsqueda desde cualquiera de los dos estados, el sistema debe preguntar si recuperó el objeto y pedirle la opinión sobre la aplicación.
- Ninguna de las dos búsquedas debe seguir recibiendo avisos de coincidencia ni poder reclamar otro objeto.
- Ninguno de los dos estados es terminal: la búsqueda se cierra recién cuando el usuario lo decide.

#### EU-406 · Permitir mostrar y ocultar la contraseña

Estado: Finalizada

**Descripción.** Como usuario de EurekApp, quiero poder visualizar temporalmente la contraseña que estoy ingresando, para comprobar que la escribí correctamente antes de continuar. Se propone incorporar un ícono de ojo en los campos de contraseña para alternar entre contraseña visible y oculta.

**Criterio de aceptación**

- Los campos de contraseña deben mostrar un ícono de ojo, y por defecto la contraseña debe permanecer oculta.
- Al presionar el ícono, debe mostrarse la contraseña ingresada; al volver a presionarlo, debe ocultarse nuevamente.
- Mostrar u ocultar la contraseña no debe modificar ni borrar el contenido ingresado.
- El comportamiento debe ser consistente en todos los campos de contraseña de EurekApp, incluyendo, cuando corresponda, inicio de sesión, registro y cambio o restablecimiento de contraseña.

#### EU-412 · Todos los usuarios pueden editar su nombre y apellido desde Mi perfil

Estado: Tareas por hacer

**Descripción.** Como usuario de EurekApp, de cualquier tipo, quiero cambiar mi nombre y mi apellido desde "Mi perfil", para corregir errores o mantener mis datos al día. Hoy el nombre, el apellido y el email se ven en "Mi perfil" pero ninguno se puede modificar.

**Criterio de aceptación**

1. Cualquier tipo de usuario puede editar su nombre y su apellido: usuario regular, dueño, empleado y encargado de organización, y administrador.
2. Hay una acción clara para empezar a editar, y otras para guardar o cancelar.
3. No se puede guardar un nombre o un apellido vacío, ni uno de más de 50 caracteres; en ese caso se muestra un mensaje claro.
4. Al guardar, se confirma el cambio y el nuevo nombre se ve en toda la app sin volver a iniciar sesión.
5. El email no se puede editar, porque es el dato con el que se inicia sesión.

## 6. Matriz de trazabilidad

Las 60 historias funcionales del backlog se reparten en 12 requerimientos, y cada historia trabaja al menos sobre uno; ningún requerimiento tiene menos de 3 historias. EU-414 queda fuera porque es la documentación del producto, no una funcionalidad.

**Origen de los requerimientos.** El Estudio Inicial no estaba disponible al armar este documento: no está en el repositorio, en Jira ni en Confluence. Los 12 requerimientos se reconstruyeron a partir del manual de usuario de 2024 (registro y acceso, búsqueda de objetos perdidos, registro de objetos encontrados, matcheo, devolución y alta de organizaciones) y de las épicas originales del proyecto. Hay que contrastarlos con el Estudio Inicial y, si los nombres difieren, reemplazar la columna "Requerimiento"; las historias asignadas a cada uno se mantienen.

### 6.1 Requerimientos y sus historias

| Req. | Requerimiento | Historias que trabajan sobre él (● principal, ○ secundaria) |
| --- | --- | --- |
| R1 | Registro, autenticación y administración de usuarios | ● EU-16, EU-36, EU-218, EU-261, EU-406, EU-412 |
| R2 | Alta y administración de organizaciones | ● EU-20, EU-252, EU-259, EU-262, EU-269, EU-270 |
| R3 | Políticas, personal y roles de la organización | ● EU-21, EU-44, EU-175, EU-246; ○ EU-46 |
| R4 | Registro de objetos encontrados | ● EU-40, EU-46, EU-110 |
| R5 | Devolución y entrega de objetos | ● EU-23, EU-24; ○ EU-219, EU-221, EU-366, EU-396 |
| R6 | Búsqueda de objetos perdidos | ● EU-18, EU-19, EU-34, EU-41, EU-73; ○ EU-30, EU-142, EU-320 |
| R7 | Coincidencias (matching) y su precisión | ● EU-30, EU-142, EU-320; ○ EU-18, EU-26, EU-41, EU-43, EU-49, EU-222, EU-223, EU-224 |
| R8 | Búsquedas guardadas y avisos de coincidencia | ● EU-29, EU-43, EU-159, EU-275, EU-361, EU-396; ○ EU-320 |
| R9 | Notificaciones al usuario (en la app y por correo) | ● EU-161, EU-260; ○ EU-24, EU-43, EU-44, EU-47, EU-218, EU-246, EU-259, EU-269, EU-270, EU-277, EU-366 |
| R10 | Detección y bloqueo de fraude | ● EU-27, EU-47, EU-225, EU-226, EU-227, EU-277, EU-339, EU-365; ○ EU-23 |
| R11 | Reportes y estadísticas | ● EU-25, EU-26, EU-165, EU-219, EU-220, EU-221, EU-222, EU-223, EU-224, EU-228, EU-263; ○ EU-27, EU-225, EU-226, EU-227, EU-319 |
| R12 | Opinión y calificación (de la aplicación y de las organizaciones) | ● EU-35, EU-49, EU-319, EU-366; ○ EU-26, EU-228 |

### 6.2 Matriz historia por requerimiento

● = la historia trabaja principalmente sobre el requerimiento; ○ = lo toca de forma secundaria.

| Historia | Título | R1 | R2 | R3 | R4 | R5 | R6 | R7 | R8 | R9 | R10 | R11 | R12 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| EU-16 | Registrar alta de nuevos usuarios | ● |  |  |  |  |  |  |  |  |  |  |  |
| EU-18 | Búsqueda por ubicación |  |  |  |  |  | ● | ○ |  |  |  |  |  |
| EU-19 | Búsqueda por descripción textual |  |  |  |  |  | ● |  |  |  |  |  |  |
| EU-20 | Registrar solicitud de alta de organización |  | ● |  |  |  |  |  |  |  |  |  |  |
| EU-21 | Configurar políticas de manejo de objetos |  |  | ● |  |  |  |  |  |  |  |  |  |
| EU-23 | Registro de devolución de un objeto |  |  |  |  | ● |  |  |  |  | ○ |  |  |
| EU-24 | Notificación de devolución a quien registró el objeto |  |  |  |  | ● |  |  |  | ○ |  |  |  |
| EU-25 | Reporte de uso del sistema |  |  |  |  |  |  |  |  |  |  | ● |  |
| EU-26 | Reporte de feedback sobre precisión de coincidencias |  |  |  |  |  |  | ○ |  |  |  | ● | ○ |
| EU-27 | Reporte de usuarios con fraude detectado |  |  |  |  |  |  |  |  |  | ● | ○ |  |
| EU-29 | Visualizar reclamos de objetos perdidos |  |  |  |  |  |  |  | ● |  |  |  |  |
| EU-30 | Lista refinada de coincidencias con % de similitud |  |  |  |  |  | ○ | ● |  |  |  |  |  |
| EU-34 | Filtros avanzados en la búsqueda |  |  |  |  |  | ● |  |  |  |  |  |  |
| EU-35 | Feedback sobre la usabilidad del sistema |  |  |  |  |  |  |  |  |  |  |  | ● |
| EU-36 | Registrarse utilizando Google | ● |  |  |  |  |  |  |  |  |  |  |  |
| EU-40 | Publicación de foto y texto de objeto encontrado |  |  |  | ● |  |  |  |  |  |  |  |  |
| EU-41 | Buscar subiendo una foto de mi pertenencia |  |  |  |  |  | ● | ○ |  |  |  |  |  |
| EU-43 | Notificación de posible hallazgo de mi objeto |  |  |  |  |  |  | ○ | ● | ○ |  |  |  |
| EU-44 | Asignar el rol de encargado |  |  | ● |  |  |  |  |  | ○ |  |  |  |
| EU-46 | Excluir recompensas a encargados y empleados |  |  | ○ | ● |  |  |  |  |  |  |  |  |
| EU-47 | Detectar y notificar posibles casos de fraude |  |  |  |  |  |  |  |  | ○ | ● |  |  |
| EU-49 | Feedback sobre la precisión de coincidencias |  |  |  |  |  |  | ○ |  |  |  |  | ● |
| EU-73 | Búsqueda por fecha |  |  |  |  |  | ● |  |  |  |  |  |  |
| EU-110 | Publicar foto y título del objeto encontrado |  |  |  | ● |  |  |  |  |  |  |  |  |
| EU-142 | Coincidencia de texto robusta al vocabulario y formato |  |  |  |  |  | ○ | ● |  |  |  |  |  |
| EU-159 | Historial de búsquedas y devoluciones |  |  |  |  |  |  |  | ● |  |  |  |  |
| EU-161 | Notificaciones desde el menú lateral |  |  |  |  |  |  |  |  | ● |  |  |  |
| EU-165 | Exportar reportes en PDF |  |  |  |  |  |  |  |  |  |  | ● |  |
| EU-175 | Quitar "Logros" a los roles de organización |  |  | ● |  |  |  |  |  |  |  |  |  |
| EU-218 | Recuperar contraseña | ● |  |  |  |  |  |  |  | ○ |  |  |  |
| EU-219 | Porcentaje de recuperación en el reporte de uso |  |  |  |  | ○ |  |  |  |  |  | ● |  |
| EU-220 | Categorías más reportadas en el reporte de uso |  |  |  |  |  |  |  |  |  |  | ● |  |
| EU-221 | Tiempo promedio de recuperación en el reporte de uso |  |  |  |  | ○ |  |  |  |  |  | ● |  |
| EU-222 | Distribución de calificaciones de coincidencias |  |  |  |  |  |  | ○ |  |  |  | ● |  |
| EU-223 | Búsquedas exitosas vs no exitosas |  |  |  |  |  |  | ○ |  |  |  | ● |  |
| EU-224 | Tendencias de precisión de coincidencias |  |  |  |  |  |  | ○ |  |  |  | ● |  |
| EU-225 | Fraudes confirmados vs falsas alarmas |  |  |  |  |  |  |  |  |  | ● | ○ |  |
| EU-226 | Personas con múltiples fraudes |  |  |  |  |  |  |  |  |  | ● | ○ |  |
| EU-227 | Evolución de los casos de fraude |  |  |  |  |  |  |  |  |  | ● | ○ |  |
| EU-228 | Reporte de feedback sobre usabilidad |  |  |  |  |  |  |  |  |  |  | ● | ○ |
| EU-246 | Correo al recibir invitación y al ser encargado |  |  | ● |  |  |  |  |  | ○ |  |  |  |
| EU-252 | Mejora: alta de organización |  | ● |  |  |  |  |  |  |  |  |  |  |
| EU-259 | Gestionar solicitudes de alta de organizaciones |  | ● |  |  |  |  |  |  | ○ |  |  |  |
| EU-260 | Mejora del sistema de correos (plantillas) |  |  |  |  |  |  |  |  | ● |  |  |  |
| EU-261 | Gestión de usuarios del sistema | ● |  |  |  |  |  |  |  |  |  |  |  |
| EU-262 | Gestión de organizaciones activas |  | ● |  |  |  |  |  |  |  |  |  |  |
| EU-263 | Dashboard de estadísticas globales |  |  |  |  |  |  |  |  |  |  | ● |  |
| EU-269 | Badge de solicitudes de alta pendientes |  | ● |  |  |  |  |  |  | ○ |  |  |  |
| EU-270 | Correo al administrador por nueva solicitud |  | ● |  |  |  |  |  |  | ○ |  |  |  |
| EU-275 | Reclamo → búsqueda guardada |  |  |  |  |  |  |  | ● |  |  |  |  |
| EU-277 | Detectar y limitar fraude en devoluciones |  |  |  |  |  |  |  |  | ○ | ● |  |  |
| EU-319 | El feedback sobre la aplicación lo ve el administrador |  |  |  |  |  |  |  |  |  |  | ○ | ● |
| EU-320 | Nuevo algoritmo de búsqueda visual + texto |  |  |  |  |  | ○ | ● | ○ |  |  |  |  |
| EU-339 | Configurar parámetros de detección de fraude |  |  |  |  |  |  |  |  |  | ● |  |  |
| EU-361 | Estado "Por retirar" en búsquedas guardadas |  |  |  |  |  |  |  | ● |  |  |  |  |
| EU-365 | Propagar el arreglo del esquema de fraude |  |  |  |  |  |  |  |  |  | ● |  |  |
| EU-366 | Calificar la organización después de la devolución |  |  |  |  | ○ |  |  |  | ○ |  |  | ● |
| EU-396 | La búsqueda guardada refleja el retiro del objeto |  |  |  |  | ○ |  |  | ● |  |  |  |  |
| EU-406 | Mostrar y ocultar la contraseña | ● |  |  |  |  |  |  |  |  |  |  |  |
| EU-412 | Editar nombre y apellido desde Mi perfil | ● |  |  |  |  |  |  |  |  |  |  |  |

## 7. Diseño de interfaz por historia de usuario

Cada historia del backlog se apoya en una o más pantallas de la aplicación móvil y web, que son las mismas en ambos medios. Esta sección describe esas pantallas a partir del código del frontend (rama `main`): cómo se llega a cada una y qué elementos tiene.

**Capturas.** Este documento todavía no incluye capturas de pantalla: la descripción sale del código, no de la aplicación corriendo. Las capturas deben tomarse junto con las del manual de usuario, que necesita las mismas pantallas, e insertarse bajo la tabla de cada grupo.

### 7.1 Mapa de navegación por rol

El menú lateral cambia según el rol del usuario. La encuesta "Calificar la atención" no figura en ningún menú: solo se llega desde el enlace del correo que se envía al registrar una devolución.

&#91;image: Mapa de navegación por rol\]

### 7.2 Acceso y cuenta

| Historia | Pantalla y cómo se llega | Elementos de la interfaz |
| --- | --- | --- |
| EU-16 Registrar alta de nuevos usuarios | Regístrate (Bienvenida → Registrate, o "¿No tenés cuenta? Registrate" en el inicio de sesión) | Campos Nombre, Apellido, Email y Contraseña; botón "Registrate"; enlace "Ya tengo cuenta. Iniciar sesión". Validaciones: nombre y apellido obligatorios y no demasiado largos, email válido, contraseña de 8 a 16 caracteres. |
| EU-36 Registrarse utilizando Google | Inicia sesión y Regístrate | Botón "Continuar con Google" bajo el separador "— o continuá con —"; mensaje de error si el ingreso con Google falla. |
| EU-218 Recuperar contraseña | Recuperar contraseña (enlace "¿Olvidaste tu contraseña?") y Nueva contraseña | Recuperar: campo Email, texto explicativo y botón "Enviar código". Nueva contraseña: campos Contraseña y Confirmar contraseña, botón "Cambiar contraseña" y enlace "Volver al inicio de sesión"; mensaje de error si el código venció o es inválido. |
| EU-406 Mostrar y ocultar la contraseña | Campos de contraseña del inicio de sesión, el registro y Nueva contraseña | Ícono para alternar entre "Mostrar contraseña" y "Ocultar contraseña". |
| EU-412 Editar nombre y apellido | Mi perfil | Pendiente de desarrollo: hoy Mi perfil muestra nombre, apellido y email sin posibilidad de editarlos. |
| EU-161 Notificaciones desde el menú lateral | Notificaciones (menú lateral) | Lista de avisos; botones según el tipo (Aceptar y Rechazar una invitación, Ver solicitud, Ver coincidencia, Ver mis logros, Ver alerta); mensaje "No tenés notificaciones."; contador de no leídas sobre el ícono de campana del menú. |
| EU-175 Quitar "Logros" a roles de organización | Menú lateral y Logros | La opción "Logros" aparece solo para el usuario regular. |

### 7.3 Búsqueda de objetos perdidos

La búsqueda se hace desde "Buscar un objeto", y sus resultados se ven en "Coincidencias encontradas".

| Historia | Pantalla y cómo se llega | Elementos de la interfaz |
| --- | --- | --- |
| EU-19 Búsqueda por descripción textual | Buscar un objeto | "Descripción del objeto:" con el texto guía "Proporciona detalles que ayuden a identificarlo"; selector "Establecimiento donde lo perdiste" (con la opción "No lo recuerdo / No lo sé"); botón "Buscar objeto". |
| EU-41 Buscar subiendo una foto | Buscar un objeto | Botón "Seleccionar foto". |
| EU-18 Búsqueda por ubicación | Buscar un objeto | "Ingresa la ubicación donde crees haberlo perdido:" con mapa y marcador, y campo "Escribe la ubicación". |
| EU-73 Búsqueda por fecha | Buscar un objeto | "Fecha y hora en la que crees haberlo perdido:" con selector de fecha. |
| EU-34 Filtros avanzados | Buscar un objeto y Coincidencias encontradas | Sección "Filtros avanzados" y botón "Limpiar filtros". |
| EU-142 Coincidencia de texto robusta | Sin cambio visual | Afecta el orden y el porcentaje de las coincidencias, no la pantalla. |
| EU-320 Nuevo algoritmo de búsqueda | Mismas pantallas de búsqueda y resultados | El cambio es interno (puntaje combinado de imagen y texto, filtro por categoría y ubicación). |
| EU-30 Lista refinada con porcentaje de similitud | Coincidencias encontradas | Lista de resultados; cada uno muestra "Coincidencia: NN%"; botón "Este es mi objeto" y acceso al detalle del objeto. |
| EU-49 Feedback sobre la precisión de coincidencias | Coincidencias encontradas (ventana al volver) | "¿Qué tan útiles fueron las coincidencias?" con calificación por estrellas, "Comentario opcional...", "Omitir" y "Enviar". |

### 7.4 Búsquedas guardadas

| Historia | Pantalla y cómo se llega | Elementos de la interfaz |
| --- | --- | --- |
| EU-275 Reclamo → búsqueda guardada | Sin coincidencias, y ventana "¿Quieres guardar tu búsqueda?" | "No se encontraron coincidencias para tu búsqueda" con "Guardar búsqueda"; en la ventana, "Guardar sin foto" o "Adjuntar foto y guardar"; confirmación "¡Búsqueda guardada correctamente!". |
| EU-159 Historial de búsquedas y devoluciones | Mis búsquedas | Secciones "Búsquedas activas" y "Búsquedas cerradas"; cada búsqueda con su estado (Buscando, Por retirar, Retirado, Retirado por alguien más, Cerrada); mensaje "Sin búsquedas guardadas". |
| EU-361 Estado "Por retirar" | Detalle de búsqueda | "Reconociste un objeto como tuyo" con la organización donde retirarlo; botones "Cerrar búsqueda" y "No era mi objeto", que lleva a "¿El objeto no era tuyo?" y "Seguir buscando". |
| EU-396 Búsqueda refleja el retiro | Detalle de búsqueda | Estados "Retirado" (verde) y "Retirado por alguien más" (naranja); mensaje "El objeto que reconociste ya lo retiró otra persona"; única acción "Cerrar búsqueda", que pregunta "¿Recuperaste tu objeto?". |
| EU-43 Notificación de posible hallazgo | Notificaciones → "Ver coincidencia" → Coincidencia encontrada | Detalle del objeto hallado y botón "Este es mi objeto". |
| EU-29 Visualizar reclamos | Sin pantalla vigente | El ciclo de reclamos se eliminó con EU-275; la aplicación no tiene hoy una pantalla de reclamos. |

### 7.5 Registro, inventario y devolución (personal de la organización)

| Historia | Pantalla y cómo se llega | Elementos de la interfaz |
| --- | --- | --- |
| EU-40 y EU-110 Publicar objeto encontrado | Receptar un objeto | "Titulo de la publicación:"; "Imagen del objeto encontrado:" con "Seleccionar foto" o "Sacar Foto"; descripción; "Ubicación donde fue encontrado:" y "Fecha y hora en la que fue encontrado:"; casilla "El objeto fue encontrado fuera del establecimiento"; email del usuario que lo encontró; botón "Receptar objeto encontrado"; confirmación "El objeto fue cargado al inventario con éxito.". |
| EU-23 Registro de devolución | Ver inventario → "Devolver" | Inventario: lista con "Detalles" y "Devolver", marcas "Por vencer" y "Vencido", y "¡Tu organización no tiene objetos!" cuando está vacío. Formulario de devolución: "Requisitos de entrega", foto de la persona ("Seleccionar foto" o "Sacar Foto"), Nombre, Apellido, DNI, Teléfono, email del usuario; confirmación "La devolución del objeto se registró correctamente.". |
| EU-24 Notificación de devolución | Notificaciones | Aviso de recompensa con el botón "Ver mis logros". |
| EU-46 Excluir recompensas | Ver objetos devueltos → "Ver devolución", y Exclusiones de recompensa | Detalle de devolución con el registrador del objeto y "Puntos otorgados: 10 XP"; la lista de exclusiones (solo responsable) muestra "Sin recompensa · Incompatibilidad de funciones" y "Sin exclusiones registradas" cuando está vacía. |
| EU-44 Asignar el rol de encargado | Mi organización (responsable) | Por cada empleado, acciones "Asignar encargado" y "Eliminar encargado", con la marca del rol. |
| EU-246 Correo de invitación y de encargado | Mi organización → "Agregar un empleado"; Notificaciones y Mi perfil | "Agregar empleado" con campo E-mail; confirmación "¡Solicitud enviada correctamente!"; el invitado ve "quiere que te unas a su organización" con "Aceptar" y "Rechazar". El correo no tiene pantalla. |
| EU-21 Configurar políticas | Mi organización → "Configurar políticas" | "Tipo de organización" (lista de tipos); "Almacenamiento" (días, o "Sin límite"); "Requerir validación de identidad" ("Se solicitará DNI + foto de la persona"); "Requerir evidencia adicional de propiedad" con su detalle; botón "Guardar políticas". |

### 7.6 Alta y administración de organizaciones y usuarios

| Historia | Pantalla y cómo se llega | Elementos de la interfaz |
| --- | --- | --- |
| EU-20 y EU-252 Solicitud de alta de organización | Solicitar alta de organización; seguimiento en Mi solicitud de organización | Formulario por pasos con "Anterior" y "Siguiente": nombre, tipo (con "Especificá el tipo" si es Otro), calle, número, ciudad, provincia, país, mapa con marcador arrastrable, datos del responsable (nombre, apellido, correo, teléfono) y motivo; "Resumen de la solicitud" y "Enviar solicitud"; aviso de que por ahora solo se aceptan organizaciones de Córdoba. En Mi solicitud: estado (Pendiente de aprobación, Aprobada, Rechazada, Cancelada) y "Cancelar solicitud". |
| EU-259 Gestionar solicitudes de alta | Solicitudes de alta → Detalle de solicitud (administrador) | Listado filtrable por estado con "Ver detalle"; detalle con solicitante, organización, dirección, coordenadas, responsable propuesto y motivo; "Nota del administrador"; botones "Aprobar" y "Rechazar". |
| EU-269 Badge de solicitudes pendientes | Menú lateral del administrador | Contador junto a "Solicitudes de alta". |
| EU-260 y EU-270 Correos | Sin pantalla | Son correos; no tienen interfaz propia. |
| EU-262 Gestión de organizaciones | Organizaciones (administrador) | Listado de organizaciones activas e inactivas; acción "Desactivar" con confirmación y reactivación; "No hay organizaciones registradas." cuando está vacío. |
| EU-261 Gestión de usuarios | Usuarios (administrador) | Listado filtrable por rol (Todos, Usuarios, Responsables, Empleados, Encargados, Admins), con insignia de rol y acción de activar o desactivar. |
| EU-263 Dashboard de estadísticas | Dashboard (administrador) | Tarjetas de Plataforma (usuarios totales y activos, organizaciones y activas, objetos encontrados), "Usuarios por rol" y "Solicitudes de alta de org." (pendientes, aprobadas, rechazadas). |

### 7.7 Reportes y opiniones

| Historia | Pantalla y cómo se llega | Elementos de la interfaz |
| --- | --- | --- |
| EU-25 Reporte de uso | Reportes (responsable) | Filtros "Desde" y "Hasta" y "Agrupar por:"; totales de objetos encontrados, búsquedas, objetos devueltos y usuarios activos; tendencias por período; "Exportar CSV" y "Exportar PDF". |
| EU-165 Exportar reportes en PDF | Reportes | Botón "Exportar PDF". |
| EU-219, EU-220 y EU-221 Gráficos del reporte de uso | Reportes → Reporte de uso | "Tasa de recuperación" (gráfico circular), "Objetos más reportados" y "Tiempo promedio de recuperación" con su evolución. |
| EU-26, EU-222, EU-223 y EU-224 Reporte de precisión de coincidencias | Reportes → "Feedback de búsquedas" y "Precisión de coincidencias" | Búsquedas exitosas y fallidas, distribución de calificaciones y "Tendencias de búsquedas" en una tabla por período. |
| EU-366 Calificar la organización después de la devolución | Encuesta "Calificar la atención" (enlace del correo) y Reportes → "Calificación de la atención" | Encuesta: "¿Cómo te atendieron?" con cinco aspectos puntuables (trato del personal, tiempo de espera, claridad de las indicaciones, estado en que recibiste el objeto, seguridad del retiro), comentario opcional, "Enviar calificación" y "Ahora no"; aviso "Ya calificaste esta atención". Reporte: promedio por aspecto y comentarios. |
| EU-35 Feedback sobre la usabilidad | Mi perfil → "Dar feedback de usabilidad de la app" | "¿Cómo fue tu experiencia?" con estrellas, aspectos (facilidad de uso, claridad de interfaz, tiempo de respuesta, navegación), comentario opcional, "Omitir" y "Enviar", y "¡Gracias por tu retroalimentación!". |
| EU-228 y EU-319 Opiniones sobre la app | Opiniones sobre la app (administrador) | "Desde", "Hasta" y "Actualizar reporte"; calificación promedio, total de feedbacks, distribución, aspectos más seleccionados, evolución temporal con "Agrupar por:", tabla de comentarios y "Exportar CSV" y "Exportar PDF". |

### 7.8 Fraude (administrador)

| Historia | Pantalla y cómo se llega | Elementos de la interfaz |
| --- | --- | --- |
| EU-47 y EU-277 Detectar fraude y bloquear | Alertas de fraude → Detalle de alerta (también desde Notificaciones → "Ver alerta") | Lista de alertas ("No hay alertas de fraude" si está vacía) con "Ver reporte"; detalle con motivo, detalle, DNI de quien retira, empleado que entregó, objeto asociado, fecha de detección, resuelto por y fecha de resolución; botón "Marcar falsa alarma" con confirmación. |
| EU-27, EU-225, EU-226 y EU-227 Reporte de fraude | Alertas de fraude → Reporte de fraude | "Configurar reporte" (Desde, Hasta, agrupar "Por usuario" o "Por DNI", Estado, Ordenar por) y "Generar reporte"; "Activas vs. falsas alarmas" (gráfico circular), "Evolución de casos" (barras), listado de personas con la marca "Reincidente", histórico acumulado e historial de incidentes; "Exportar CSV" y "Exportar PDF". |
| EU-339 Configurar parámetros de fraude | Configuración de fraude | Valores de umbral de detección, ventana de detección en días y duración del bloqueo en días; botón "Guardar cambios". |
| EU-365 y EU-414 | Sin pantalla | EU-365 corrige el esquema de la base de datos y EU-414 es esta documentación. |

## 8. Diagrama de clases

El sistema se dibuja en dos vistas del mismo código del backend (estado actual de `main`): el modelo de dominio y las capas de la aplicación.

### 8.1 Modelo de dominio

Muestra las entidades, los enums y los objetos de valor con sus relaciones. `FoundObject` y `LostObject` no son entidades de MySQL: se guardan en la base vectorial Weaviate y se vinculan con el resto por valor (`foundObjectUUID`, `username`, `organizationId`), sin clave foránea.

&#91;image: Diagrama de clases: modelo de dominio\]

### 8.2 Capas

Muestra qué controlador usa qué servicio, y qué repositorios y clientes externos usa cada servicio (OpenAI, `clip-service`, Weaviate, S3 y correo). Se dibujan las dependencias principales; los servicios que envían correo dependen además de `EmailTemplateService` y `NotificationService`, que no se trazan para no saturar el diagrama.

&#91;image: Diagrama de clases: capas\]

## 9. Diagrama Entidad-Relación (DER)

El modelo relacional tiene 18 tablas en MySQL 8, generadas por Hibernate a partir de las entidades JPA (`ddl-auto: update`). Los tipos son los que Hibernate asigna por defecto: `Long` → `BIGINT`, `String` sin longitud → `VARCHAR(255)`, `Integer` → `INT`, `LocalDateTime` → `DATETIME(6)`, `Double` → `DOUBLE`; los enums se guardan como texto. PK = clave primaria, FK = clave foránea, UK = única.

&#91;image: Diagrama Entidad-Relación\]

El diagrama muestra las relaciones; el detalle de cada atributo está en las tablas siguientes. `FoundObject` y `LostObject` no están en MySQL sino en Weaviate (9.4) y se vinculan con estas tablas por valor, sin clave foránea.

### 9.1 Usuarios, organizaciones y solicitudes

**`users`**

| Atributo | Tipo y longitud | Clave | Valores y notas |
| --- | --- | --- | --- |
| id | BIGINT | PK | autoincremental |
| username | VARCHAR(100) | UK | obligatorio; es el correo, de 3 a 100 caracteres |
| password | VARCHAR(255) |  | obligatorio; mínimo 8 caracteres, se guarda cifrada |
| active | BIT |  | cuenta activa o desactivada |
| first\_name | VARCHAR(50) |  | obligatorio |
| last\_name | VARCHAR(50) |  | obligatorio |
| role | VARCHAR(255) |  | obligatorio: `USER`, `ORGANIZATION_OWNER`, `ORGANIZATION_EMPLOYEE`, `ENCARGADO`, `ADMIN` |
| organization\_id | BIGINT | FK → organizations | opcional; solo para roles de organización |
| XP | BIGINT |  | obligatorio, 0 por defecto |
| returnedObjects | BIGINT |  | obligatorio, 0 por defecto |
| provider\_type | VARCHAR(20) |  | opcional: `GOOGLE` o `FACEBOOK` |
| provider\_id | VARCHAR(255) |  | opcional |
| password\_reset\_token | VARCHAR(10) |  | opcional |
| password\_reset\_token\_expiry | DATETIME |  | opcional |
| fraud\_alerts\_seen\_at | DATETIME |  | opcional |

**`organizations`**

| Atributo | Tipo y longitud | Clave | Valores y notas |
| --- | --- | --- | --- |
| id | BIGINT | PK | autoincremental |
| name, contactData, street, streetNumber, city, province, country | VARCHAR(255) |  | texto libre |
| organization\_type | VARCHAR(50) |  | uno de los 32 valores de `OrganizationType` (ver 9.5) |
| latitude, longitude | DOUBLE |  | coordenadas embebidas |
| active | TINYINT(1) |  | obligatorio, 1 por defecto |

**`organization_policies`**

| Atributo | Tipo y longitud | Clave | Valores y notas |
| --- | --- | --- | --- |
| id | BIGINT | PK | autoincremental |
| organization\_id | BIGINT | FK → organizations, UK | una política por organización |
| maxStorageDays | INT |  | días máximos de guarda |
| requiresIdentityValidation | BIT |  |  |
| requiresAdditionalEvidence | BIT |  |  |
| additionalEvidenceDetails | VARCHAR(500) |  |  |
| organizationType | VARCHAR(255) |  | valor de `OrganizationType` |

**`organization_policy_history`**

| Atributo | Tipo y longitud | Clave | Valores y notas |
| --- | --- | --- | --- |
| id | BIGINT | PK | autoincremental |
| organizationId | BIGINT |  | referencia por valor, sin FK declarada |
| changedAt | DATETIME |  |  |
| changed\_by\_id | BIGINT | FK → users |  |
| previousSnapshot | TEXT |  | política anterior serializada |

**`organization_request`**

| Atributo | Tipo y longitud | Clave | Valores y notas |
| --- | --- | --- | --- |
| id | BIGINT | PK | autoincremental |
| requesting\_user\_id | BIGINT | FK → users | obligatorio |
| organization\_name | VARCHAR(200) |  | obligatorio |
| organization\_type | VARCHAR(50) |  | obligatorio; valor de `OrganizationType` |
| custom\_organization\_type | VARCHAR(200) |  | opcional |
| street | VARCHAR(200) |  | obligatorio |
| street\_number | VARCHAR(20) |  | obligatorio |
| city, province, country | VARCHAR(100) |  | obligatorios |
| latitude, longitude | DOUBLE |  | coordenadas embebidas |
| owner\_first\_name, owner\_last\_name | VARCHAR(100) |  | obligatorios |
| owner\_email | VARCHAR(150) |  | obligatorio |
| owner\_phone | VARCHAR(50) |  | obligatorio |
| reason | VARCHAR(1000) |  | obligatorio |
| status | VARCHAR(30) |  | obligatorio: `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `CANCELLED` |
| created\_at | DATETIME |  | obligatorio, por defecto la fecha actual |
| resolved\_at | DATETIME |  | opcional |
| resolved\_by\_user\_id | BIGINT | FK → users | opcional |
| admin\_note | VARCHAR(1000) |  | opcional; obligatoria al rechazar |
| organization\_id | BIGINT | FK → organizations | opcional; se completa al aprobar |

**`add_employee_request`**

| Atributo | Tipo y longitud | Clave | Valores y notas |
| --- | --- | --- | --- |
| id | BIGINT | PK | autoincremental |
| user\_id | BIGINT | FK → users | obligatorio; el invitado |
| org\_id | BIGINT | FK → organizations | obligatorio |
| status | VARCHAR(255) |  | obligatorio: `PENDING`, `ACCEPTED`, `DECLINED` |

### 9.2 Devoluciones, calificaciones y notificaciones

**`return_found_objects`**

| Atributo | Tipo y longitud | Clave | Valores y notas |
| --- | --- | --- | --- |
| id | BIGINT | PK | autoincremental |
| user\_id | BIGINT | FK → users | opcional; quien retira, si tiene cuenta |
| first\_name, last\_name | VARCHAR(100) |  | opcionales en la base (devoluciones anteriores a EU-362); el servicio los exige |
| DNI | VARCHAR(20) |  | obligatorio; texto, no se opera como número |
| phoneNumber | VARCHAR(20) |  | obligatorio |
| foundObjectUUID | VARCHAR(255) | UK | obligatorio; id del objeto en Weaviate |
| person\_photo\_UUID | VARCHAR(255) |  | obligatorio; clave de la foto en S3 |
| datetimeOfReturn | DATETIME |  | obligatorio |
| returned\_by\_employee\_id | BIGINT | FK → users | opcional; quien entrega |
| notification\_sent\_at | DATETIME |  | opcional |
| notification\_recipient | VARCHAR(255) |  | opcional |
| organization\_id | BIGINT |  | opcional (EU-371); referencia por valor, sin FK declarada |
| feedback\_token | VARCHAR(36) | UK | opcional (EU-374); token de la encuesta de atención |

**`organization_feedback`**

| Atributo | Tipo y longitud | Clave | Valores y notas |
| --- | --- | --- | --- |
| id | BIGINT | PK | autoincremental |
| return\_found\_object\_id | BIGINT | FK → return\_found\_objects, UK | obligatorio; una calificación por devolución |
| organization\_id | BIGINT |  | obligatorio; copia de la devolución |
| user\_id | BIGINT | FK → users | opcional |
| staff\_treatment, waiting\_time, instructions\_clarity, object\_condition, pickup\_security | INT |  | obligatorios; de 1 a 5 (lo valida el DTO) |
| comment | VARCHAR(500) |  | opcional |
| created\_at | DATETIME |  | obligatorio |

**`search_feedback`**

| Atributo | Tipo y longitud | Clave | Valores y notas |
| --- | --- | --- | --- |
| id | BIGINT | PK | autoincremental |
| organization\_id | VARCHAR(36) |  | opcional |
| found\_object\_uuid | VARCHAR(36) |  | opcional; vacío si no encontró su objeto |
| star\_rating | INT |  | opcional; solo registros viejos (EU-372) |
| was\_found | BIT |  | obligatorio |
| comment | VARCHAR(500) |  | opcional |
| lost\_object\_text | VARCHAR(500) |  | opcional |
| created\_at | DATETIME |  | obligatorio |
| user\_id | BIGINT | FK → users | opcional |

**`usability_feedback`**

| Atributo | Tipo y longitud | Clave | Valores y notas |
| --- | --- | --- | --- |
| id | BIGINT | PK | autoincremental |
| star\_rating | INT |  | obligatorio; de 1 a 5 |
| aspects | VARCHAR(200) |  | opcional; lista separada por comas |
| comment | VARCHAR(500) |  | opcional |
| context | VARCHAR(100) |  | opcional; pantalla de origen |
| created\_at | DATETIME |  | obligatorio |
| user\_id | BIGINT | FK → users | opcional |

**`in_app_notifications`**

| Atributo | Tipo y longitud | Clave | Valores y notas |
| --- | --- | --- | --- |
| id | BIGINT | PK | autoincremental |
| user\_id | BIGINT | FK → users | obligatorio |
| title | VARCHAR(200) |  | obligatorio |
| description | VARCHAR(500) |  | obligatorio |
| type | VARCHAR(50) |  | obligatorio; por ejemplo `EMPLOYEE_INVITATION`, `ROLE_CHANGED` |
| is\_read | BIT |  | obligatorio, falso por defecto |
| created\_at | DATETIME |  | obligatorio |
| related\_request\_id | BIGINT |  | opcional |
| related\_object\_uuid, related\_lost\_object\_uuid | VARCHAR(36) |  | opcionales |
| match\_score | DOUBLE |  | opcional |

**`reward_exclusions`**

| Atributo | Tipo y longitud | Clave | Valores y notas |
| --- | --- | --- | --- |
| id | BIGINT | PK | autoincremental |
| foundObjectUUID | VARCHAR(255) |  | obligatorio |
| user\_id | BIGINT | FK → users | obligatorio |
| userRole | VARCHAR(255) |  | obligatorio; valor de `Role` |
| reason | VARCHAR(100) |  | obligatorio |
| excludedAt | DATETIME |  | obligatorio |
| organizationId | VARCHAR(255) |  | obligatorio |

### 9.3 Detección de fraude

**`fraud_alert`**

| Atributo | Tipo y longitud | Clave | Valores y notas |
| --- | --- | --- | --- |
| id | BIGINT | PK | autoincremental |
| organization\_id | VARCHAR(36) |  | opcional |
| found\_object\_uuid | VARCHAR(36) |  | opcional |
| dni | VARCHAR(20) |  | opcional |
| returned\_by\_employee\_id | BIGINT | FK → users | opcional; empleado que hizo la devolución |
| reason | VARCHAR(60) |  | obligatorio; lista de casos `CASE_1`, `CASE_2`, `CASE_3` |
| details | VARCHAR(500) |  | opcional |
| status | VARCHAR(20) |  | obligatorio: `ACTIVE` o `FALSE_POSITIVE` |
| created\_at | DATETIME |  | obligatorio |
| resolved\_at | DATETIME |  | opcional |
| resolved\_by\_id | BIGINT | FK → users | opcional |
| dedup\_key | VARCHAR(255) |  | opcional; evita alertas repetidas |

**`fraud_alert_suspect_user`** (intermedia alerta – usuarios sospechosos)

| Atributo | Tipo | Clave |
| --- | --- | --- |
| fraud\_alert\_id | BIGINT | PK y FK → fraud\_alert |
| user\_id | BIGINT | PK y FK → users |

**`fraud_alert_return`** (intermedia alerta – devoluciones que la dispararon)

| Atributo | Tipo | Clave |
| --- | --- | --- |
| fraud\_alert\_id | BIGINT | PK y FK → fraud\_alert |
| return\_found\_object\_id | BIGINT | PK y FK → return\_found\_objects |

**`fraud_alert_case`** (casos detectados por alerta; sin clave primaria propia)

| Atributo | Tipo y longitud | Clave | Valores y notas |
| --- | --- | --- | --- |
| fraud\_alert\_id | BIGINT | FK → fraud\_alert |  |
| case\_type | VARCHAR(20) |  | `CASE_1` retiros repetidos del mismo DNI; `CASE_2` posible acuerdo entre quien registra y quien retira; `CASE_3` posible complicidad de un empleado |
| matched\_count | INT |  | cantidad de coincidencias del caso |

**`fraud_block`**

| Atributo | Tipo y longitud | Clave | Valores y notas |
| --- | --- | --- | --- |
| id | BIGINT | PK | autoincremental |
| target\_dni | VARCHAR(20) |  | opcional; bloqueo por DNI sin cuenta |
| target\_user\_id | BIGINT | FK → users | opcional |
| fraud\_alert\_id | BIGINT | FK → fraud\_alert | obligatorio |
| blocked\_at | DATETIME |  | obligatorio |
| expires\_at | DATETIME |  | obligatorio; el bloqueo vence en esta fecha |

**`fraud_detection_config`** (una sola fila, sin relación con otras tablas)

| Atributo | Tipo | Clave | Valores y notas |
| --- | --- | --- | --- |
| id | BIGINT | PK | no autoincremental |
| fraud\_threshold | INT |  | obligatorio; mínimo 1 |
| fraud\_window\_days | INT |  | obligatorio; mínimo 1 día |
| block\_duration\_days | INT |  | obligatorio; mínimo 1 día |

### 9.4 Clases de Weaviate (base vectorial)

Usan distancia coseno e índice HNSW, con dos vectores por objeto: `image` (CLIP) y `text` (embedding de OpenAI). No tienen claves foráneas; las referencias son por valor.

| Clase | Propiedad | Tipo | Notas |
| --- | --- | --- | --- |
| `FoundObject` | uuid | UUID | identificador |
|  | found\_date | date |  |
|  | title | string |  |
|  | human\_description | string |  |
|  | organization\_id | text | referencia a `organizations.id` |
|  | coordinates | geoCoordinates | latitud y longitud |
|  | was\_returned | boolean | pasa a verdadero al registrar la devolución |
|  | object\_finder\_user\_id | text | referencia a `users.id`; "0" si no hay usuario |
|  | category | text | `ROPA`, `BILLETERA`, `LLAVES`, `ELECTRONICA`, `OTROS` |
| `LostObject` | uuid | UUID | identificador |
|  | lost\_date | date |  |
|  | description | string |  |
|  | username | string | referencia a `users.username` |
|  | organization\_id | text | referencia a `organizations.id` |
|  | coordinates | geoCoordinates |  |
|  | status | text | `ACTIVE`, `PENDING_PICKUP`, `RETRIEVED`, `RETRIEVED_BY_OTHER`, `CLOSED` |
|  | category | text | misma lista que `FoundObject` |
|  | has\_image | boolean | hay foto en S3 con clave igual al uuid |
|  | matched\_object\_uuid | text | uuid del `FoundObject` reclamado; vacío si no hay |
|  | closed\_date | date | solo al cerrar |
|  | recovered | boolean | solo al cerrar |

### 9.5 Valores de los enums

| Columna | Valores posibles |
| --- | --- |
| `users.role`, `reward_exclusions.userRole` | `USER`, `ORGANIZATION_OWNER`, `ORGANIZATION_EMPLOYEE`, `ENCARGADO`, `ADMIN` |
| `organization_request.status` | `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `CANCELLED` |
| `add_employee_request.status` | `PENDING`, `ACCEPTED`, `DECLINED` |
| `fraud_alert.status` | `ACTIVE`, `FALSE_POSITIVE` |
| `fraud_alert_case.case_type` | `CASE_1`, `CASE_2`, `CASE_3` |
| `organizations.organization_type`, `organization_policies.organizationType`, `organization_request.organization_type` | `CLUB`, `AIRPORT`, `SHOPPING`, `OTHER`, `UNIVERSITY`, `SCHOOL`, `HOSPITAL`, `HOTEL`, `RESTAURANT`, `BUS_TERMINAL`, `TRAIN_STATION`, `SPORTS_COMPLEX`, `GYM`, `CORPORATE_OFFICE`, `COWORKING`, `CINEMA`, `THEATER`, `STADIUM`, `EVENT`, `CITY_HALL`, `LIBRARY`, `MUSEUM`, `CASINO`, `RECREATIONAL_PARK`, `CAMPING`, `CRUISE_PORT`, `CHURCH`, `SUPERMARKET`, `SHOPPING_MALL`, `CONVENTION_CENTER`, `AMUSEMENT_PARK`, `PRIVATE_BEACH` |

## 10. Diagramas de transición de estados

Siete entidades tienen ciclo de vida; cada una tiene su diagrama, su estado inicial y finales, y una tabla con la historia de usuario responsable del cambio de estado por cada método. Cuando el cambio lo hizo una subtarea o un error, se cita la historia padre, que es la del Product Backlog.

### 10.1 Búsqueda guardada (`LostObject`)

Estado inicial: `ACTIVE`, o `PENDING_PICKUP` si nace con un objeto reclamado. Estado final: `CLOSED`, que no se reabre. `RETRIEVED` y `RETRIEVED_BY_OTHER` no son finales porque el cierre lo decide el usuario.

&#91;image: Estados de la búsqueda guardada\]

| Método | Transición | Historia responsable |
| --- | --- | --- |
| `LostObjectService.reportLostObject` | inicio → `ACTIVE` | EU-41 Buscar objetos perdidos subiendo una foto de mi pertenencia; EU-19 Búsqueda por descripción textual |
| `LostObjectService.reportLostObject` con objeto reclamado | inicio → `PENDING_PICKUP` | EU-275 Reclamo → búsqueda guardada (quitar ciclo aprobar/rechazar) |
| `LostObjectService.markPendingPickup` | `ACTIVE` → `PENDING_PICKUP` | EU-361 Estado "Por retirar" en las búsquedas guardadas |
| `LostObjectService.reopenLostObject` | `PENDING_PICKUP` → `ACTIVE` | EU-361 (la vuelta atrás es parte del estado "Por retirar") |
| `LostObjectService.onObjectReturned` | `PENDING_PICKUP` → `RETRIEVED` o `RETRIEVED_BY_OTHER` | EU-396 La búsqueda guardada refleja que el objeto ya fue retirado |
| `LostObjectService.closeLostObject` | cualquier estado salvo `CLOSED` → `CLOSED` | EU-275 (cierre lógico, subtarea EU-292) |

### 10.2 Solicitud de alta de organización (`OrganizationRequest`)

Estado inicial: `PENDING_APPROVAL`. Estados finales: `APPROVED`, `REJECTED` y `CANCELLED`. Rechazar exige un motivo; aprobar crea la organización y convierte al responsable en `ORGANIZATION_OWNER`.

&#91;image: Estados de la solicitud de organización\]

| Método | Transición | Historia responsable |
| --- | --- | --- |
| `OrganizationService.signUpOrganization` | inicio → `PENDING_APPROVAL` | EU-20 Registrar solicitud de alta de organización (mejora: EU-252) |
| `OrganizationService.resolveOrganizationRequest` | `PENDING_APPROVAL` → `APPROVED` o `REJECTED` | EU-259 Gestionar solicitudes de alta de organizaciones |
| `OrganizationService.cancelOrganizationRequest` | `PENDING_APPROVAL` → `CANCELLED` | EU-20 (a confirmar: no hay una historia propia de cancelar la solicitud) |

### 10.3 Invitación a empleado (`AddEmployeeRequest`)

Estado inicial: `PENDING`. Estados finales: `ACCEPTED` y `DECLINED`. Al aceptar una invitación, las demás invitaciones pendientes del mismo usuario pasan solas a `DECLINED`.

&#91;image: Estados de la invitación a empleado\]

| Método | Transición | Historia responsable |
| --- | --- | --- |
| `UserService.addEmployeeToOrganization` | inicio → `PENDING` | EU-246 Enviar mail al usuario al recibir una solicitud de organización (a confirmar: EU-246 cubre el aviso por mail) |
| `UserService.acceptAddEmployeeRequest` | `PENDING` → `ACCEPTED`; las otras `PENDING` → `DECLINED` | EU-246 (a confirmar) |
| `UserService.declineAddEmployeeRequest` | `PENDING` → `DECLINED` | EU-246 (a confirmar) |

### 10.4 Alerta de fraude (`FraudAlert`) y bloqueo (`FraudBlock`)

La alerta tiene dos estados: no existe "confirmar fraude", porque la alerta ya bloqueó al crearse. Estado inicial: `ACTIVE`. Estado final: `FALSE_POSITIVE`. El bloqueo no tiene columna de estado: está vigente mientras `expiresAt` sea futuro, y marcar falsa alarma lo borra.

&#91;image: Estados de la alerta de fraude y del bloqueo\]

| Método | Transición | Historia responsable |
| --- | --- | --- |
| `FraudDetectionService.detectFraudForReturn` | inicio → `ACTIVE` y crea los bloqueos | EU-277 Detectar y limitar fraude en devoluciones (bloqueo automático); EU-47 Detectar y notificar posibles casos de fraude |
| `FraudBlockService.createBlocksForAlert` | inicio → bloqueo vigente | EU-277 |
| `FraudDetectionService.markFalseAlarm` | `ACTIVE` → `FALSE_POSITIVE` | EU-277 (subtarea EU-287) |
| `FraudBlockService.liftBlocksForAlert` | bloqueo vigente → levantado | EU-277 (subtarea EU-287) |
| vencimiento de `expiresAt` | bloqueo vigente → expirado | EU-277; la duración la fija EU-339 Configurar parámetros globales de detección de fraude |

### 10.5 Objeto encontrado (`FoundObject`)

Estado inicial: disponible (`was_returned = false`). Estado final: devuelto (`true`); no hay camino de vuelta.

&#91;image: Estados del objeto encontrado\]

| Método | Transición | Historia responsable |
| --- | --- | --- |
| `FoundObjectService.uploadFoundObject` | inicio → disponible | EU-40 Publicación de foto y textual de objeto encontrado; EU-110 Publicar foto y título textual del objeto encontrado |
| `ReturnFoundObjectService.returnFoundObject` | disponible → devuelto | EU-23 Registro de devolución de un objeto encontrado |

### 10.6 Rol del usuario (`UserEurekapp.role`)

Estado inicial: `USER`, o `ORGANIZATION_OWNER` si el mail ya figura en una solicitud aprobada. `ADMIN` no se alcanza por ningún método: se da de alta en la base. Ningún método degrada a un responsable de organización.

&#91;image: Estados del rol de usuario\]

| Método | Transición | Historia responsable |
| --- | --- | --- |
| `AuthService.register` y `AuthService.socialLogin` | inicio → `USER` (u `ORGANIZATION_OWNER`) | EU-16 Registrar alta de nuevos usuarios; EU-36 Registrarse utilizando Google |
| `UserService.acceptAddEmployeeRequest` | `USER` → `ORGANIZATION_EMPLOYEE` | EU-246 (a confirmar) |
| `UserService.removeEmployeeFromOrganization` | `ORGANIZATION_EMPLOYEE` o `ENCARGADO` → `USER` | sin historia identificada (a confirmar) |
| `UserService.assignEncargado` | `ORGANIZATION_EMPLOYEE` → `ENCARGADO` | EU-44 Asignar el rol de encargado a las personas que correspondan |
| `UserService.revokeEncargado` | `ENCARGADO` → `ORGANIZATION_EMPLOYEE` | EU-44 |
| `OrganizationService.resolveOrganizationRequest` | `USER` → `ORGANIZATION_OWNER` | EU-259 Gestionar solicitudes de alta de organizaciones |

### 10.7 Activación de cuentas y organizaciones (`active`)

No tiene estado final: la desactivación es reversible. Un usuario desactivado queda con la cuenta bloqueada y no puede iniciar sesión.

&#91;image: Estados de activación\]

| Método | Transición | Historia responsable |
| --- | --- | --- |
| `AdminService.toggleUserActive` | usuario activo ⇄ desactivado | EU-261 Gestión de usuarios del sistema |
| `AdminService.toggleOrganizationActive` | organización activa ⇄ desactivada | EU-262 Gestión de organizaciones activas |

### Pendientes de confirmar

Cuatro asignaciones no se pudieron atar con certeza a una historia: cancelar la solicitud de organización; invitar, aceptar, rechazar y quitar empleado (EU-246 solo habla del correo); el alta manual del `ADMIN`, que no tiene historia; y `reopenLostObject`, asignado a EU-361 por ser la vuelta atrás de "Por retirar".
