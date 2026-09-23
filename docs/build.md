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
cerrar nada por su cuenta. Con EU-396 entregada, EU-382 quedó cerrado.

En la tanda del 2026-09-17 salieron los tres ítems que había dejado anotados la tanda del 16/9:
**EU-407** (Día/Semana/Mes del reporte de uso salió del bloque de fechas y quedó en su propia
tarjeta, rotulado "Agrupar por:" y con la aclaración de que sólo cambia cómo se agrupan los cuadros;
acá son tres los cuadros que agrupa, por eso el selector no se metió adentro de uno solo como en
EU-358), **EU-408** (la devolución dejó de hacer sus tres pasos en paralelo: ahora van en orden y la
marca de "devuelto" es el último, así que lo que falle antes deshace el registro y el objeto sigue
disponible para entregarse) y **EU-409** (el correo de coincidencia dice que el objeto se ve y se
reclama desde "Notificaciones", con la opción "Este es mi objeto"). Verificados con pruebas unitarias
y con la app levantada.

De paso se arregló el esquema de pruebas: **EU-388** (de otra persona) agregó una columna al modelo
de usuario y no al esquema de H2, y desde entonces fallaban dos pruebas de seguridad de endpoints.

**EU-275 cerrada el 2026-09-18.** Estaba EN TESTING esperando a EU-382, EU-383 y EU-389, y los tres
ya estaban resueltos. Quedó en Done con el comentario que lo explica.

## Juego de datos rehecho (2026-09-22) — el trabajo está hecho; falta la última verificación

### RETOMAR ACÁ (lo primero que hay que hacer)

El chat anterior se cortó por tamaño, en el medio de la verificación final. **El código y los datos
están completos y commiteados**; lo que quedó a medias es dejar el entorno local usable.

**Cómo quedó la máquina de Facundo:**

1. **La base y el buscador están vacíos.** Se borraron a propósito, para probar el seed contra un
   entorno recién creado, y el seed no llegó a correr.
2. **El backend quedó levantado** contra esa base vacía (perfil local, puerto 8080). Si hace falta
   rearrancarlo, primero hay que bajar el que está corriendo o el puerto va a estar ocupado.
3. **`Backend/.env.local` está tocado a propósito y hay que devolverlo.** Las dos líneas de
   credenciales de AWS están comentadas con el prefijo `#EU410-TMP-`, para que las fotos fueran al
   almacenamiento local en vez de a la cuenta real. **Sacar ese prefijo cuando Facundo lo pida**, y
   avisarle de la consecuencia que está más abajo.

**Los tres pasos que faltan:**

1. `bash Backend/seed-local.sh --force` y mirar que no aparezca ningún aviso ni error. Tiene que
   decir: 31 objetos encontrados, 5 búsquedas guardadas, 24 devoluciones, "Las 24 devoluciones
   apuntan a un objeto que existe y figura como devuelto", 7 alertas, 7 bloqueos y 60 imágenes.
2. Comprobar contra la aplicación levantada: que la búsqueda encuentre su objeto, que las
   devoluciones muestren el suyo y que las pantallas de fraude tengan datos. **Ojo con el límite de
   10 intentos de inicio de sesión por minuto**: si se pasa, contesta "demasiados intentos" y es
   fácil confundirlo con un bloqueo por fraude.
3. Proponerle a Facundo el comentario para el ítem de Jira y, si lo aprueba, publicarlo.

**Todo esto ya se verificó una vez**, con el entorno levantado y el juego de datos nuevo cargado: la
búsqueda encontró su objeto en las seis pruebas, las devoluciones mostraron su objeto y su foto, y
las pantallas de fraude mostraron las siete alertas, los reportes por persona y por documento, y el
indicador del menú. Lo que falta es repetirlo sobre una base recién creada, que es la única parte
que todavía no se probó.

### Una decisión pendiente que Facundo tiene que tomar

Con las credenciales de AWS puestas, la aplicación busca las fotos en la cuenta real, donde **las de
los objetos nuevos no existen**. O se deja el almacenamiento local para trabajar (las líneas
comentadas), o hay que correr el seed una vez con las credenciales puestas, lo que sube 60 archivos
a la cuenta real. Es de Facundo la decisión.

### El trabajo en sí

**Reemplaza al plan del 19/09 en la parte de "cargar por API".** Facundo decidió que nada se carga
por la aplicación: todo se escribe directamente en el juego de datos, y las alertas de fraude se
escriben a mano en vez de dejar que las genere la detección. Lo que sí tiene que ser consistente son
las devoluciones: cada una apunta a un objeto que existe y ninguna comparte objeto con otra.

**Rama:** `EU-410-rehacer-juego-de-datos`. **No pushear ni mergear sin autorización.**

### Qué quedó

- **Un solo juego de objetos.** El seed de la base carga el del rework de búsqueda. Los archivos del
  juego viejo siguen en el repositorio pero ya no los lee nadie (ver "material sin uso").
- **31 objetos encontrados** (los 10 del rework + 21 agregados) y las 5 búsquedas guardadas. Los
  agregados reusan las fotos existentes, cada uno con su propia copia y con fecha, sede y texto
  propios; el vector de imagen se copia del objeto de origen y el de texto se calcula de nuevo.
- **24 devoluciones**, cada una sobre su propio objeto. Siete objetos quedan sin devolver: los cinco
  que forman pareja con una búsqueda guardada y dos de los agregados.
- **7 alertas de fraude** repartidas de abril a septiembre: 4 vigentes y 3 falsas alarmas, dos
  documentos y una persona con dos alertas cada uno, y 7 bloqueos vigentes.
- **Los parámetros de detección** pasan a "3 retiros en 30 días" con bloqueo de 90 días. Los de
  fábrica ("5 retiros en 1 día", bloqueo de 7 días) hacían que ningún foco fuera detectable y que
  los bloqueos se vencieran a los pocos días de sembrar.
- **Quién encontró cada objeto y cuáles se devolvieron viven en el juego de datos**, no se parchean
  después. El seed ahora sólo comprueba que los dos lados digan lo mismo, y aborta si no.

### Cosas del seed que estaban rotas y se arreglaron de paso

- Los objetos se mandaban al buscador como argumento de línea de comandos. Con dos vectores por
  objeto, la línea supera lo que el sistema operativo acepta: los objetos no entraban y el único
  rastro era un contador más bajo. Ahora van por archivo, y el seed aborta si falta alguno.
- Sin el cliente de línea de comandos de AWS instalado, el paso de fotos se salteaba con un aviso y
  la aplicación quedaba sin una sola imagen. Contra el almacenamiento local ya no hace falta.
- El seed avisaba de fallos inexistentes al marcar objetos, porque esperaba una respuesta y el
  buscador devuelve otra igual de correcta.

### Material que quedó sin uso (nadie lo borró: decide Facundo)

- `Backend/seed-data/FoundObject.ndjson` y `LostObject.ndjson`: el juego viejo.
- `Backend/seed-data/generate_seed_vectors.py`: genera el juego viejo, con los identificadores
  viejos. Su reemplazo es `build_dataset.py`.
- `Backend/seed-data/reseed_via_api.sh`: la carga por la aplicación, que ya no se usa.
- `Backend/seed-data/photos-nuevas/`: las cuatro fotos de segunda toma que se habían pedido, que
  nunca se incorporaron.
- Las 15 fotos de `photos/` con el nombre viejo **sí siguen haciendo falta**: son el material de
  origen del que salen todas las copias.

### Lo único que quedó afuera

Los reclamos siguen sin sembrarse. No es una omisión de este trabajo: la entidad se extirpó del
sistema y no hay nada que sembrar.

### Cómo está armado el juego de fraude (para no tener que releerlo del seed)

Cinco focos de sospecha, cada uno un mismo documento retirando tres veces en pocas semanas, más tres
devoluciones normales y aisladas. Sale de ahí una alerta por mes, de abril a septiembre, con dos en
septiembre:

| Mes | Documento | Persona | Qué la dispara | Estado |
|---|---|---|---|---|
| Abril | 42111222 | Julia Morales | retiros repetidos | falsa alarma |
| Mayo | 27998877 | Nahuel Ibarra | retiros repetidos + siempre el mismo empleado de la UTN | falsa alarma |
| Junio | 28123456 | Ramiro Otero | retiros repetidos | falsa alarma |
| Julio | 39456789 | Micaela Ledesma | retiros repetidos + siempre objetos registrados por la misma persona | vigente |
| Agosto | 31555444 | Brenda Sosa | retiros repetidos + siempre la misma empleada del shopping | vigente |
| Septiembre | 39456789 | Micaela Ledesma | igual que la de julio, dos meses después | vigente |
| Septiembre | 28123456 | Ramiro Otero | igual que la de junio | vigente |

**Quiénes quedan señalados y bloqueados:** sólo personal de organizaciones, nunca las tres cuentas
de usuario final. Una alerta vigente **impide iniciar sesión**, y si cayeran ahí Julia, Pedro o
Valeria no se podría probar la búsqueda, porque las búsquedas guardadas son de ellos. Quedan
bloqueadas `emp1.patio@eurekapp.com` (en dos alertas) y `emp1.dino@eurekapp.com`; cada una de esas
sedes conserva su cuenta de responsable. **Que esas dos no entren es lo esperado, no una falla.**

## Plan acordado (2026-09-19): rehacer el juego de datos entero por bootstrap

**Reemplaza al plan anterior de sembrar sólo las alertas.** Facundo decidió arrancar de cero en vez
de ir reparando referencias sueltas.

### Por qué se llegó acá

**El juego de datos viejo no debe existir: el del rework de búsqueda es el definitivo.** Eso cierra
EU-399 por la opción de unificar.

Pero unificar no es sólo borrar. Se comprobó contra la base real: **ninguna de las 5 devoluciones que
siembra el seed apunta a un objeto del juego nuevo; las 5 referencian identificadores del viejo.** El
entorno reconstruido el 18/09 tiene esas cinco devoluciones colgando de objetos que no existen en el
buscador.

**No lo rompió nadie después.** Esos identificadores entraron en el commit original del seed
(`1eaab1e`, 31/05, de Facundo) y quedaron así cuando en agosto el rework (EU-325) rehizo los objetos
con identificadores nuevos: se cambió un lado y el otro quedó igual. Evelyn tocó el seed después
(EU-362 y EU-378) pero sólo para sumar nombre y apellido de quien retira; no tocó identificadores.

### El plan

1. **Borrar todo**: base y buscador. S3 se deja como está.
2. **Arreglar `reseed_via_api.sh`** (vive sólo en la máquina de Facundo, salió del repo en `29085d0`)
   para que plante todo lo que tenga endpoint: objetos, devoluciones, y las devoluciones repetidas
   que disparan las alertas.
3. **Correrlo.** Las alertas las genera el detector solo, con sus casos, sospechosos y bloqueos bien
   armados. Nada de alertas fabricadas a mano —ese fue el origen de EU-393.
4. **Una pasada de UPDATE directo a la base**, sólo para correr fechas hacia atrás. **La regla: no se
   fabrican filas en la base, sólo se mueven fechas de filas que creó la API.** Así la consistencia
   se mantiene. Acá se resuelve también lo que no tenga endpoint (experiencia, exclusiones de
   recompensa, marcas de notificación enviada).
5. **`dump_seed.sh`** para volcar el resultado al seed.
6. **Borrar el juego viejo**: los `.ndjson` sueltos en `Backend/seed-data/` y la carpeta `photos/`
   (15 archivos; el juego nuevo vive en `snapshot/` + `photos-nuevas/`, 5 archivos).

**Primera tarea del chat nuevo:** relevar **qué se puede crear por API y qué no**, antes de tocar
nada. Si algo no tiene endpoint hay que saberlo de entrada, no a mitad de camino.

**Por qué el paso 4 es inevitable:** EU-227 necesita ver la evolución de los casos a lo largo de
meses, y la detección mira una ventana de pocos días. Por API todo nace con fecha de hoy.

**Lo que este plan cierra de arrastre:** EU-399 (queda un solo juego), la inconsistencia de las 5
devoluciones, y EU-410 (las alertas salen del mismo bootstrap). Los reclamos siguen apagados en el
seed; no bloquean nada hoy —las cuatro stories EN TESTING son todas de fraude— pero es el mismo
agujero y conviene resolverlo en la misma pasada.

## Próximo paso pedido (2026-09-18): sembrar datos de fraude consistentes

**Estado: diseño sin empezar.** Se cortó acá para arrancar en un chat limpio.

**El problema.** Aun con la base rehecha (EU-365), las pantallas de fraude y de reclamos arrancan
**vacías**: el seed planta 0 alertas y 0 reclamos desde el rediseño. Así no se pueden validar las
cuatro stories EN TESTING.

**El criterio que fijó Facundo:** las alertas no se fabrican. Si una alerta dice que alguien retiró
muchos objetos, **tienen que existir las devoluciones que la provocaron**. El seed viejo las
insertaba a mano y por eso quedó inconsistente (EU-393: sospechosos apuntando a usuarios borrados).

**El patrón a seguir** (ya establecido, no inventar otro): cargar **una sola vez por la API** para
que las reglas de negocio armen las estructuras válidas, después volcar el resultado al snapshot
como INSERT literales. Nadie más vuelve a tocar la API ni S3. El script de carga por API
**salió del repo** (commit `29085d0`): es de uso exclusivo de Facundo porque resube las 15 fotos.
`dump_seed.sh` es la mitad que sí sirve al equipo.

### Lo que ya se averiguó (no volver a investigarlo)

**Las tres reglas de detección** agrupan todas **por DNI**:

- `CASE_1` — retiros repetidos del mismo DNI.
- `CASE_2` — mismo par (quien registró el objeto, DNI): acuerdo entre ambos.
- `CASE_3` — mismo par (empleado que entrega, DNI): complicidad del empleado.

Una alerta puede marcar varios casos a la vez. La config tiene umbral, ventana en días y duración
del bloqueo (`FraudDetectionConfig`).

**Identidad en una devolución:** el DNI es **obligatorio**; el vínculo al usuario (`user_id`) es
**opcional** y es una clave foránea, no el mail. Por eso el bloqueo tiene dos blancos separados y
ambos opcionales: `target_dni` y `target_user`. **Consecuencia útil: se puede armar un foco de
fraude con un DNI que no corresponda a ningún usuario del seed.**

**Qué necesita ver cada story:** EU-225, alertas activas **y** falsas alarmas (es una comparación);
EU-226, alguien con 2+ alertas; EU-227, alertas repartidas **en el tiempo**; EU-277, bloqueos
vigentes.

**La tensión del diseño:** EU-227 pide meses de historia, pero la ventana de detección es de días.
No se puede generar de una sentada algo que se vea como evolución. **Propuesta:** generar todo por
API (así los casos, sospechosos y bloqueos salen bien armados) y al volcar al snapshot **correr las
fechas hacia atrás**. Mismas filas y mismas referencias; sólo cambian los timestamps.

### Lo que falta decidir antes de diseñar

1. **EU-399 primero, y es bloqueante de verdad.** Su descripción dice que las devoluciones y alertas
   de prueba **cuelgan de los identificadores de los objetos**. Si se unifican los dos juegos de
   datos, cambian esos identificadores y las devoluciones que diseñemos hay que rehacerlas.
2. Cuántos focos de fraude (sugerido: 4 o 5, uno por combinación de casos).
3. Qué personajes: reutilizar de los 16 usuarios del seed, o DNIs nuevos sin usuario.
4. Sobre qué ventana de tiempo va la evolución (¿tres meses, seis?).

**No tiene ítem de Jira.** Ninguno de los abiertos lo cubre: EU-365 es rehacer la base y EU-399 es
la decisión sobre los objetos. Hay que crear uno nuevo.

### Otro pendiente chico

El título de **EU-365** sigue diciendo "propagar el arreglo" cuando ya no hay arreglo que propagar.
Falta decidir si se le cambia.

## Prioridad de los ítems abiertos por poder de desbloqueo (2026-09-18)

Hecho. Se leyeron los vínculos "blocks" / "is blocked by" de los **24 ítems abiertos**. Resultado:
entre lo abierto **hay un solo ítem que destraba a otros**. Los catorce bloqueos restantes que
figuran en las cuatro stories EN TESTING ya están en Done (EU-335, EU-352, EU-354, EU-355, EU-363,
EU-379, EU-381, EU-384, EU-388, EU-390, EU-391, EU-392, EU-393, EU-395). Las cuatro stories no
esperan un pelotón de arreglos: esperan uno solo.

### Antes de la lista: una decisión que la reordena entera

**Facundo confirmó que en los entornos compartidos no hay nada que valga la pena conservar** — ni
datos de personas reales ni nada que no se pueda regenerar. Se puede hacer borrón y cuenta nueva.

Eso cambia EU-365 de raíz y quedó anotado en su ticket. El propio diagnóstico dice que *el problema
sólo aparece en bases creadas antes del rediseño; una base nueva sale bien sola*. Entonces no hace
falta el parche en `seed-local.sh` ni las tres sentencias de corrección: **se rehace la base y listo**.
EU-365 pasó de ser trabajo de código a ser trabajo de acceso.

Encima de todo esto hay una decisión abierta que no es un ítem de Jira: **mudar el ambiente
compartido a Railway**. Hoy es una única EC2 que aloja backend, MySQL y Weaviate; el frontend web
vive aparte en S3+CloudFront y las fotos en otro bucket. Estimación: medio día a un día, casi todo
configuración. El enganche real es que `seed-local.sh` llega a la base con `docker exec` sobre un
contenedor local (línea 12) y hardcodea Weaviate (línea 13) — pero ambas cosas están centralizadas en
una variable cada una, así que son dos líneas. `init-weaviate.sh` ya acepta `WEAVIATE_URL` por
entorno. Las fotos se quedan en S3 sin tocar código. **Si se hace, se lleva puestos el bloqueo de
acceso de EU-365 y probablemente EU-360.** Sin decidir.

Dato pendiente de verificar: **no se sabe dónde corre MySQL en la EC2**. `setup-ec2.sh` instala Java,
Docker, Weaviate y nginx, pero MySQL no, y `DATABASE_URL` es un secret que podría apuntar a cualquier
lado. Hay que entrar a mirar antes de planificar la mudanza.

### Orden propuesto (reevaluado tras crear EU-410)

**Cambió el grafo:** ya no hay una sola arista. **EU-399 pasó a bloquear a EU-410**, así que dejó
de ser un ítem suelto y se convirtió en el arranque de una cadena.

**Actualización 19/09:** EU-399 se cerró (decidido: queda el juego del rework) y su ejecución se
absorbió en **EU-410**, que pasó a ser la tarea única de rehacer los datos de prueba. La lista queda
sin el puesto 2 anterior: ahora es EU-365, EU-410, EU-360, EU-364, EU-338, EU-359, epics.

1. **EU-365 — desbloquea 4, y es barato.** Libera EU-225, EU-226, EU-227 y EU-277, y es lo único que
   separa a **EU-226** de cerrarse. Ya no es escribir código: es rehacer la base del ambiente
   compartido, recargar los datos de prueba y avisarle al equipo. Sólo falta el acceso.
2. **EU-399 — desbloquea 1, y es el ítem más barato de toda la lista.** Es una **decisión**, no
   código: cuál de los dos juegos de datos queda. Subió del puesto 4 al 2 porque ahora bloquea a
   EU-410, y porque decidirlo tarde obliga a rehacer las devoluciones que se diseñen.
3. **EU-410 — desbloquea 0 por vínculos, pero es lo que hace verificables a las cuatro stories.**
   Sembrar alertas de fraude consistentes. Ver la nota de abajo: para EU-227 es un bloqueo real.
4. **EU-360 — desbloquea 0, condiciona todo lo demás.** Los deploys fallan desde el 7/8. Si se
   decide la mudanza a Railway, conviene no tocarlo: se arreglaría de arrastre.
5. **EU-364 — desbloquea 0, única red de contención.** Migraciones versionadas. Al caerse el parche
   intermedio de EU-365, es lo único que impide que el esquema se vuelva a desincronizar.
6. **EU-338 — desbloquea 0.** Único bug suelto que no depende de accesos externos.
7. **EU-359 — desbloquea 0, bloqueado por acceso.** Cerrar el bucket de fotos. **La mudanza a
   Railway no lo resuelve**: las fotos se quedan en S3.
8. **Los 8 epics viejos y los spykes de documentación.** Cierre administrativo, no trabajo.

### Una duda honesta sobre EU-410

No se lo vinculó como bloqueante de las cuatro stories, y vale explicar por qué. Con EU-365 hecho se
pueden generar alertas **a mano**, como hizo Evelyn, y validar. Así que en general EU-410 no bloquea:
hace que la validación sea repetible en lugar de artesanal.

**La excepción es EU-227.** Pide ver la evolución de los casos a lo largo del tiempo, y la detección
mira una ventana de pocos días: no hay forma manual de fabricar meses de historia. Para esa story,
EU-410 **sí** es un bloqueo real. Falta decidir si se lo vincula como tal.

### Lo que dice este orden

Los tres primeros puestos son, en conjunto, **muy baratos**: uno es rehacer una base, otro es tomar
una decisión, y recién el tercero es trabajo de verdad. Entre los tres se destraban las cuatro
stories EN TESTING, que es lo único que queda entre el proyecto y cerrar el circuito de fraude.

Y sigue en pie lo de la versión anterior: el cuello de botella es **de acceso**, no técnico. EU-365 y
EU-359 esperan credenciales, no código. Por eso la decisión sobre Railway pesa más que cualquier
reordenamiento.

**El botón de cerrar sesión funciona**, aunque la prueba de interfaz de esta tanda lo reportó como
roto: se comprobó a mano que saca de la pantalla y lleva al login sin recargar. Fue cosa del entorno
de prueba, no de la aplicación.

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
