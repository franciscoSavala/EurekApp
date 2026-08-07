---
description: Continuar el rework del algoritmo de búsqueda (EU-320) desde REWORK-ALGORITMO-BUSQUEDA.md
---

Estás implementando el **rework del algoritmo de búsqueda** de EurekApp: matching visual
(imagen→vector CLIP) + texto, ponderado por categoría y modulado por geo. Story **EU-320**.

## Antes de tocar código

1. Leé `REWORK-ALGORITMO-BUSQUEDA.md` (raíz del repo): es el tracker y la fuente de las
   decisiones de diseño ya cerradas. Respetalas; si algo del negocio quedó ambiguo,
   **preguntá inline** antes de asumir.
2. Mirá la tabla de subtareas (sección 4). Retomá desde la primera que no esté HECHA,
   respetando el orden de dependencias: **EU-321 → EU-322 → EU-323 → EU-324 → EU-325 → EU-327**,
   con **EU-326 (frontend) en paralelo** una vez que el contrato del backend esté definido.
3. Apoyate en la PoC `poc-reverse-search/` para lo ya validado (rangos de coseno, foco en el
   objeto central). **Nunca** commitear ni pushear esa carpeta: es un experimento aparte.

## Gate de arranque (OBLIGATORIO — antes de escribir una sola línea)

Identificada la subtarea a retomar, **pará y presentámela para aprobación**. NO toques código
hasta que Facundo confirme. Presentá, en este orden:

1. **Qué necesito de vos**: material, datos, decisiones o accesos que dependan de Facundo y sin
   los cuales la subtarea no puede completarse (p. ej. fotos/datos reales para el seed EU-325,
   contrato del back para el frontend EU-326, criterios de calibración para EU-327). Si no
   necesito nada, decilo explícitamente.
2. **Qué planeo hacer**, en **alto nivel y lenguaje de negocio** (sin jerga técnica, sin nombres
   de clases/librerías/archivos): el comportamiento que va a cambiar para el usuario final y por
   qué, para que Facundo valide que **mi entendimiento del negocio es correcto** antes de proceder.

Recién con su OK (o sus correcciones incorporadas) arrancás la implementación. Si a mitad de
camino aparece una decisión de negocio no cerrada, volvé a parar y preguntá inline.

## Reglas de la tarea (no negociables)

- **Toda subtarea de backend lleva tests unitarios** antes de darse por HECHA. Sin tests, no
  está terminada.
- **Fotos para tests:** reutilizar las de la PoC (`poc-reverse-search/images*/`: billetera,
  boligrafo, cargador_redmi, control_philips, zapatillas_*), pero **copiando** un subconjunto
  curado a `Backend/src/test/resources/fixtures/` y cargándolo desde el classpath. La PoC NO se
  versiona: un test que lea de esa ruta rompe en CI/otra máquina.
- **Rechazos de regla de negocio → `BadRequestException` (400), nunca 403.** El front trata el
  403 como JWT vencido y desloguea.
- **El esquema de Weaviate es manual** (`Backend/start-local.sh`, auto-schema OFF). Cambios de
  clase/propiedad se hacen ahí; pedir una propiedad inexistente en la query devuelve lista
  vacía sin error.
- **Foto de la búsqueda: se persiste sólo al guardar** (decisión A). `searchByPhoto` vectoriza
  en memoria y NO sube a S3; `reportLostObject` sube a S3 (key = uuid del LostObject) recién al
  guardar. El front reenvía la imagen al guardar.
- **Sin rastros de "Claude"** en commits, PRs, código, archivos ni docs.
- **No escribir archivos de plan** en disco: los planes van explicados en la consola.

## Al avanzar

- Actualizá el estado de la subtarea en la tabla de `REWORK-ALGORITMO-BUSQUEDA.md` (TODO →
  EN CURSO → HECHA) a medida que progresás.
- Compilá antes de dar por cerrada una integración (un merge "limpio" puede romper la
  compilación).
- Cuando una subtarea de backend tenga superficie ejecutable, verificá el flujo real con
  `/verify` (no sólo tests).
