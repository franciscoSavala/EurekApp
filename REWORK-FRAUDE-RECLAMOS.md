# Rework: Fraude + Reclamos

Documento de contexto y seguimiento para el rediseño del sistema de reclamos y de
detección de fraude en EurekApp. Pensado para que cualquier sesión de trabajo retome
desde acá sin re-explicar el contexto.

> **Cómo usar este archivo:** antes de empezar, leer las secciones 1–4. Al terminar una
> tarea, actualizar su fila en la tabla de la sección 5 (estado + nota breve).
>
> **Chequeo de setting (hacer SIEMPRE al arrancar):** identificá la próxima tarea no HECHA
> (sección 5) y compará su "Setting sugerido" con tu configuración actual:
> 1. Tu modelo: lo sabés por tu propio ID (Opus = `claude-opus-4-*`, Sonnet = `claude-sonnet-4-*`).
> 2. Si extended thinking está activo o no.
>
> El setting tiene que ser **exactamente** el sugerido: ni más, ni menos. Si tu config
> actual **no coincide** con la sugerida —en cualquiera de los tres ejes (modelo, thinking,
> esfuerzo)— **FRENÁ antes de tocar nada** y pedile al usuario que la ajuste:
> - **Por debajo** (modelo menor, falta thinking, o menos esfuerzo) → el trabajo se hace mal.
> - **Por encima** (modelo mayor, thinking de más, o más esfuerzo) → gasta quota al pedo.
>
> En ambos casos frená y avisá qué hay que cambiar. No arranques la tarea hasta que el
> setting sea el exacto.

---

## 1. Decisiones de negocio (cerradas)

- **El "reclamo de propiedad" desaparece.** La organización no puede verificar propiedad
  a la distancia; el único control real es físico, al momento del retiro, cuando se le pide
  evidencia a quien se presenta. La org no adjudica propiedad: solo registra quién retira
  (flujo de devolución existente).
- **El reclamo pasa a ser una "búsqueda guardada":** visible solo para el usuario que la
  creó, que lo notifica cuando aparece un objeto con coincidencia ≥ umbral. Sin ciclo
  aprobar/rechazar, sin estados de propiedad.
- **El fraude se detecta sobre devoluciones físicas** (`ReturnFoundObject`: DNI + foto +
  empleado que entrega), no sobre reclamos.
- **Bloqueo automático:** al dispararse una regla, el sistema bloquea a los usuarios/DNIs
  involucrados por X días, sin validación humana previa. El dueño puede marcar
  `FALSA_ALARMA` para levantarlo.

## 2. Reglas de detección (resumen)

Conteos sobre devoluciones dentro de una ventana deslizante `T`; disparan al alcanzar `N`:

- **Caso 1:** agrupa por DNI de quien retira → bloquea ese DNI.
- **Caso 2:** agrupa por par (object finder, DNI), solo con finder no nulo → bloquea finder
  + DNI + usuario retirador.
- **Caso 3:** agrupa por par (empleado, DNI) con objetos de finders distintos → bloquea DNI
  + usuario del empleado.

- `N` y `T` configurables por el **dueño de Eurekapp** (no el de la organización), sin
  recompilar. Default: **N = 5, T = 1 día**.
- **N es global a los tres casos** (decisión tomada: un único umbral, solo cambia la clave
  de agrupación). Consecuencia asumida: Casos 2 y 3 son de hecho más estrictos que el 1.
- Si se cumplen varios casos a la vez → **una sola alerta** con todos los casos.
- Detección corre al **dar de alta** un objeto y al **registrar una devolución**.
- Dedup: si ya hay alerta para la misma (regla, clave) en los últimos X días, no se crea
  otra. X días = duración del bloqueo = `T`.
- El detalle de negocio completo (con criterios de aceptación) está en la story Jira
  **EU-277**, que reproduce el comentario de redefinición original.

## 3. Restricciones del proyecto

- **No dejar marcas de herramientas/asistentes externos** en commits, PRs, código ni
  archivos.
- Solo backend, salvo las tareas de front explícitas (EU-280, EU-288) y el bug EU-276.
- **Una sola rama de larga duración** para todo el rework (las modificaciones son un todo;
  mergear parcial dejaría `main` roto). Merge a `main` una sola vez al final.
- El bug EU-276 es independiente: puede ir en su propia rama y mergear antes.

## 4. Orden de implementación

Datos → lógica; borrar antes de construir; detectar antes de bloquear.

1. EU-281 — persistir empleado
2. EU-282 — refactor FraudAlert
3. EU-283 — entidad de bloqueo + N/T
4. EU-278 — desarmar aprobar/rechazar
5. EU-284 — las 3 reglas
6. EU-285 — enganchar detección
7. EU-286 — validar bloqueo
8. EU-287 — FALSA_ALARMA + limpieza
9. EU-279 — notificar match ≥ 0.75
10. EU-288 — front fraude
11. EU-280 — front reclamos
12. EU-276 — bug estrellas (cuando haya hueco)

## 5. Tabla de trabajo y estado

Estados: `TODO` · `EN CURSO` · `HECHO` · `BLOQUEADA`

Setting sugerido = modelo · thinking · esfuerzo. Es **exacto**, ni más ni menos: por debajo
el trabajo sale mal, por encima gasta quota al pedo. Si no coincide, frená y pedí el ajuste
(ver "Chequeo de setting" arriba).

| Orden | Jira | Tarea | Capa | Setting sugerido | Estado | Nota |
|------:|------|-------|------|------------------|--------|------|
| 1 | EU-281 | Persistir empleado que entrega (`returnedByEmployeeId`) | Back + BD | Sonnet · sin thinking · medio | HECHO | Campo `returnedByEmployee` en entidad + seteo en service |
| 2 | EU-282 | Refactor `FraudAlert` (DNI + varios usuarios + empleado) | Back + BD | **Opus · thinking · alto** | HECHO | `suspectUsers` (M2M) + `dni` + `returnedByEmployee` + `dedupKey`. Dedup → (regla, clave, ventana). `FraudClaimantDto`→`FraudUserDto`; `relatedClaimants` eliminado. Seed sec.16 deshabilitado. Tests en `FraudDetectionServiceTest`. **Deuda diferida (no olvidar):** el flag `isSuspicious` sigue vivo (ver notas EU-278/EU-280/EU-286) |
| 3 | EU-283 | Entidad de bloqueo + parámetros N/T configurables | Back + BD | Sonnet · thinking · medio | TODO | N=5, T=1d default |
| 4 | EU-278 | Desarmar ciclo aprobar/rechazar del reclamo | Back | Sonnet · sin thinking · medio | TODO | Recorta ClaimStatus, borra ReclamoHistory. **Pendiente EU-282:** quitar `isSuspicious` de `ReclamoDto` + la query `existsBy...SuspectUsers_IdAndStatus` en `ReclamoService.toDto` (el reclamo pasa a búsqueda guardada: no aplica "sospechoso") |
| 5 | EU-284 | Implementar las 3 reglas (ventana deslizante) | Back | **Opus · thinking · alto** | TODO | Reemplaza reglas viejas (ver EU-253) |
| 6 | EU-285 | Enganchar detección en devolución y alta | Back | Sonnet · sin thinking · medio | TODO | Quitar checkForFraud de reclamo |
| 7 | EU-286 | Validar bloqueo en retiro y alta | Back | Sonnet · thinking leve · medio | TODO | Aviso en pantalla para DNI sin usuario. **Pendiente EU-282:** la advertencia `isSuspicious` en `ReturnObjectForm.js` es protección provisoria; reemplazarla por el bloqueo real al retirar |
| 8 | EU-287 | FALSA_ALARMA: desbloqueo + limpieza reporte | Back | Sonnet · sin thinking · medio | TODO | validateAccess solo dueño; quitar gravityLevel/CSV |
| 9 | EU-279 | Notificar match ≥ 0.75 en alta (búsqueda guardada) | Back | Sonnet · thinking leve · medio | TODO | Net-new; reusa MIN_SCORE 0.75 |
| 10 | EU-288 | Ajustar front de fraude | Front | Sonnet · sin thinking · medio | TODO | FraudReport/Alerts/Detail/EvolutionChart/pdfExport |
| 11 | EU-280 | Ajustar front y reportes de reclamo | Front | Sonnet · sin thinking · medio | TODO | ReclamosList, ReclamoDetail, Inventory. **Pendiente EU-282:** quitar el badge "⚠ Sospechoso" (`isSuspicious`) de `ReclamosList.js` y `ReclamoDetail.js` |
| 12 | EU-276 | Bug: reporte de uso no muestra el promedio (estrellas) | Front + Back | Sonnet · sin thinking · medio | TODO | Independiente; rama propia |
| — | EU-253 | Eliminar tipos de alerta viejos (High Claim Freq / Múltiples / Rechazos) | Back | Sonnet · sin thinking · medio | TODO | Ya existía en Jira; lo cubre EU-284 |

## 6. Stories padre y referencias

- **EU-275** — Story "Reclamo → búsqueda guardada" (subtareas: EU-278, EU-279, EU-280).
- **EU-277** — Story "Detectar y limitar fraude en devoluciones" (subtareas: EU-281 a
  EU-288). Contiene la definición de negocio completa.
- **EU-47** — versión **vieja** de la story de fraude (sobre reclamos). **No se toca**;
  queda como histórico. EU-277 la reemplaza en alcance.
- **EU-276** — Bug del reporte de estrellas.

## 7. Puntos de enganche en el código (referencia rápida)

- `ReturnFoundObjectService.returnFoundObject()` — persistir empleado, enganchar detección
  y validar bloqueo en retiro. El `caller` hoy se valida pero no se guarda.
- `FoundObjectService.uploadFoundObject()` — enganchar detección y validar bloqueo en alta;
  gancho de la notificación de match (junto a `lostObjectService.findSimilarLostObject`).
- `FraudDetectionService` — reescribir las 4 reglas viejas por las 3 nuevas.
- `FraudAlert` — hoy un solo `suspectUser`; ampliar.
- `ReclamoService` / `ReclamoController` / `ClaimStatus` / `ReclamoHistory` — desarme del
  ciclo de estados.
- `MIN_SCORE`: `FoundObjectService` = 0.75 (constante hardcodeada, se reusa);
  `LostObjectService` = 0.0 (este flujo debe filtrar a 0.75).
