# Fixtures de imágenes para tests — rework de búsqueda (EU-320)

Subconjunto **curado** de las fotos reales de la PoC (`poc-reverse-search/`), copiado acá porque
la PoC **no se versiona** y los tests corren en CI / en otra máquina. Los tests deben cargar
estas imágenes **desde el classpath** (`src/test/resources/fixtures/…`), nunca desde la ruta de
la PoC.

Sirven para dos cosas: **carga** (usar la imagen como archivo multipart de `searchByPhoto` /
`uploadFoundObject` / guardar búsqueda) y **similitud** (vectorizar con CLIP y comparar coseno).

> Los puntajes/umbrales concretos (coseno CLIP, α/β, rango geo) se fijan en **EU-327**; acá se
> describen los **inputs** y la relación cualitativa esperada, no valores exactos.

## Inventario

| Archivo | Objeto | Categoría dura (rework) | Origen PoC | Para qué |
|---|---|---|---|---|
| `billetera_1.jpg` | Billetera (ángulo 1) | Billetera/tarjetas | images/ | Query de similitud "mismo objeto" |
| `billetera_2.jpg` | Billetera (ángulo 2) | Billetera/tarjetas | images/ | Mismo objeto, otro ángulo → coseno alto vs `billetera_1` |
| `billetera_3.jpg` | Billetera (ángulo 3) | Billetera/tarjetas | images/ | Mismo objeto, otro ángulo → coseno alto |
| `zapatillas_adidas.jpg` | Zapatilla Adidas | Ropa | images2/ | Ropa; base de la gradiente intra-categoría |
| `zapatillas_adidas_spezial.jpg` | Zapatilla Adidas Spezial | Ropa | images2/ | Misma marca/línea → coseno alto-medio vs `zapatillas_adidas` |
| `zapatillas_underarmour.jpg` | Zapatilla Under Armour | Ropa | images2/ | Misma categoría, otra marca → coseno medio-bajo |
| `boligrafo.jpg` | Bolígrafo | Otros | images/ | Objeto distinto (separación / carga) |
| `cargador_redmi.jpg` | Cargador Redmi | Otros | images/ | Objeto distinto (separación / carga) |
| `control_philips.jpg` | Control remoto Philips | Otros | images/ | Objeto distinto (separación / carga) |

**No hay fotos de Llaves ni Celular** (la PoC no las tenía). Si se testean esas categorías,
conseguir imágenes aparte y sumarlas acá.

## Relaciones de similitud esperadas (cualitativas)

- **Mismo objeto:** `billetera_1` ↔ `billetera_2` ↔ `billetera_3` → coseno **alto**. Es el caso
  que dispara el match y la notificación de búsqueda guardada.
- **Misma categoría (Ropa), gradiente:** `zapatillas_adidas` ↔ `zapatillas_adidas_spezial`
  (alto-medio) > `zapatillas_adidas` ↔ `zapatillas_underarmour` (medio-bajo).
- **Distinta categoría:** billetera ↔ zapatillas ↔ cargador → coseno **bajo**, y además el
  **filtro duro de categoría** las separa: nunca deben compararse ni notificarse entre sí.
- **Recorte central (`--crop` en la PoC):** vectorizar recortando un cuadrado central (en Java,
  `BufferedImage.getSubimage`) para restarle peso al fondo. Debería separar mejor "mismo objeto"
  de "objeto distinto".

## Datos que se cargan JUNTO a cada foto

La foto sola no alcanza: cada endpoint lleva metadata. Ejemplos coherentes para armar los
comandos de test (los IDs/coords reales salen del seed — `Backend/seed-local.sh`).

### Como objeto encontrado (`uploadFoundObject`)
Campos: `title`, `detailed_description` (texto humano), `category`, `found_date`, y **o**
`organizationId` **o** `latitude`+`longitude`.

| Foto | title | detailed_description | category | ubicación |
|---|---|---|---|---|
| `billetera_1.jpg` | "Billetera de cuero marrón" | "Billetera de cuero, con tarjetas y un DNI adentro" | Billetera/tarjetas | org del seed (dentro del establecimiento) |
| `zapatillas_adidas.jpg` | "Zapatilla Adidas negra" | "Zapatilla deportiva talle 42, cordón blanco" | Ropa | coords cercanas (ver abajo) |
| `cargador_redmi.jpg` | "Cargador Redmi" | "Cargador de celular blanco, cable USB-C" | Otros | org del seed |

### Como búsqueda por foto (`searchByPhoto`) y búsqueda guardada (`reportLostObject`)
Filtros: `organizationId` **o** `latitude`+`longitude`, rango `lost_date` / `lost_date_to`.
La **categoría la infiere la IA desde la imagen** (EU-322), no la elige el usuario. Al **guardar**
la búsqueda se suma la `description` y se **persiste la foto en S3** (decisión A).

| Foto (query) | description (al guardar) | categoría esperada (IA) | debería matchear |
|---|---|---|---|
| `billetera_2.jpg` | "Perdí mi billetera de cuero marrón" | Billetera/tarjetas | `billetera_1.jpg` (mismo objeto) |
| `zapatillas_underarmour.jpg` | "Perdí una zapatilla deportiva" | Ropa | otras zapatillas, NUNCA billetera/cargador |

### Coordenadas de ejemplo para el modulador geo
- **Organización / punto base (Córdoba):** `-31.4166, -64.1863`
- **Cercano (mismo radio, geoScore alto):** `-31.4170, -64.1865`
- **Lejano (fuera de radio / geoScore bajo):** `-34.6037, -58.3816` (Buenos Aires)

Un objeto encontrado en el punto base debe rankear más alto para una búsqueda desde el punto
cercano que desde el lejano, a igualdad de similitud visual.
