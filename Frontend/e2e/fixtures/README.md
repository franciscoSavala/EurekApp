# Fotos para los tests end-to-end

| Archivo | Origen | Para qué |
|---|---|---|
| `cargador_seed.jpg` | Foto del seed | Búsqueda por foto con coincidencia: el cargador está cargado en el seed. |
| `reemplazo_zapatilla.jpg` | Fixtures del backend | Reemplazar una imagen ya cargada. |
| `billetera.png` | `billetera_1.jpg` convertida | Carga de una imagen PNG válida al receptar un objeto. |
| `sin_coincidencias.jpg` | Imagen genérica del seed | Búsqueda sin coincidencias. Hay que confirmarlo al ejecutar el test. |
| `persona_retiro.jpg` | Imagen genérica del seed | Foto de quien retira el objeto. La app no valida rostros. |
| `formato_invalido.gif` | `billetera_1.jpg` convertida | Rechazo de un formato no permitido. |

La imagen que supera el tamaño máximo no se guarda acá para no versionar un archivo pesado. La genera el test al ejecutarse. Los límites son 5 MB en las búsquedas y 10 MB al receptar un objeto.
