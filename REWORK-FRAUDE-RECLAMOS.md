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
  involucrados, sin validación humana previa. El dueño puede marcar `FALSA_ALARMA` para
  levantarlo. La **duración del bloqueo** es un parámetro propio, configurable por el dueño de
  Eurekapp (política de la app), **distinto del período de detección `T`** (ver sección 2).
- **Endgame (decisión pendiente, para EU-279/EU-280):** hoy una búsqueda guardada se
  duplica como `LostObject` (Weaviate) **y** un `Reclamo` con `foundObjectUUID=null`
  (`reportLostObject` escribe ambos → aparece dos veces en "Mis búsquedas"). Una vez sacado
  el ciclo de propiedad (EU-278) y movido el fraude a devoluciones (EU-284/285), el
  `Reclamo` queda sin función propia. Dirección acordada: **`LostObject` como única entidad
  de búsqueda guardada y eliminar `Reclamo`**. La org no necesita ver búsquedas guardadas
  (son privadas del usuario); si en algún momento lo necesitara, se resuelve con una query
  org-scoped sobre `LostObject` (ya tiene `organizationId`), sin `Reclamo`. Antes de ejecutar
  el borrado: definir el camino de `FeedbackService` (qué hace al marcar "lo encontré").
  Blast radius medido: back = `FraudDetectionService`, `FeedbackService`, `LostObjectService`
  (+ maquinaria de `Reclamo`); front = ReclamosList, ReclamoDetail, Inventory, MyObjectHistory,
  MyObjectDetail, navegación.

## 2. Reglas de detección (resumen)

Conteos sobre devoluciones dentro de una ventana deslizante `T`; disparan al alcanzar `N`:

- **Caso 1:** agrupa por DNI de quien retira → bloquea ese DNI.
- **Caso 2:** agrupa por par (object finder, DNI), solo con finder no nulo → bloquea finder
  + DNI + usuario retirador.
- **Caso 3:** agrupa por par (empleado, DNI) con objetos de finders distintos → bloquea DNI
  + usuario del empleado.

- `N` (umbral), `T` (ventana de detección) y la **duración del bloqueo** (días) son
  configurables por el **dueño de Eurekapp** (no el de la organización), sin recompilar.
  Default: **N = 5, T = 1 día**. La duración del bloqueo es un parámetro **independiente** de
  `T`: `T` define cuánto tiempo atrás se cuentan devoluciones; la duración del bloqueo define
  cuánto dura la sanción. (El campo de config y el endpoint admin para la duración los agrega
  EU-286, sobre el `FraudDetectionConfig` que creó EU-283.)
- **N es global a los tres casos** (decisión tomada: un único umbral, solo cambia la clave
  de agrupación). Consecuencia asumida: Casos 2 y 3 son de hecho más estrictos que el 1.
- **El que DEPOSITA no se castiga por volumen.** Las tres reglas se calculan sobre el DNI de
  quien **retira** (se lleva el objeto). El **finder** —quien encuentra y deposita objetos en
  la organización— nunca es señal de fraude por su volumen de depósitos: solo se lo bloquea
  cuando hay **colusión** (mismo finder + mismo DNI retirador, Caso 2). Un buen samaritano que
  trae muchos objetos retirados por personas distintas no dispara nada.
- Si se cumplen varios casos a la vez → **una sola alerta** con todos los casos.
- Detección corre al **registrar una devolución**. **No** corre al dar de alta un objeto: en el
  alta no hay DNI ni retiro, así que ninguna de las tres reglas puede evaluar nada (y contar ahí
  castigaría al depositante). Decisión cerrada en EU-285.
- Dedup: si ya hay alerta para la misma clave (DNI) dentro de la **ventana de detección `T`**,
  no se crea otra (así lo implementa EU-284: `existsByDedupKeyAndCreatedAtAfter(dedupKey, now-T)`).
  **Ojo:** el dedup usa `T`, **no** la duración del bloqueo (que ahora es un parámetro aparte). Si
  se quisiera que el dedup siga la duración del bloqueo en vez de `T`, es una decisión a tomar en
  EU-286/EU-287 (hoy no asumida).
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
12. EU-292 — extirpar entidad Reclamo (back + front + BD)
13. EU-276 — bug estrellas (cuando haya hueco)

## 5. Tabla de trabajo y estado

Estados: `TODO` · `EN CURSO` · `HECHO` · `BLOQUEADA`

Setting sugerido = modelo · thinking · esfuerzo. Es **exacto**, ni más ni menos: por debajo
el trabajo sale mal, por encima gasta quota al pedo. Si no coincide, frená y pedí el ajuste
(ver "Chequeo de setting" arriba).

| Orden | Jira | Tarea | Capa | Setting sugerido | Estado | Nota |
|------:|------|-------|------|------------------|--------|------|
| 1 | EU-281 | Persistir empleado que entrega (`returnedByEmployeeId`) | Back + BD | Sonnet · sin thinking · medio | HECHO | Campo `returnedByEmployee` en entidad + seteo en service |
| 2 | EU-282 | Refactor `FraudAlert` (DNI + varios usuarios + empleado) | Back + BD | **Opus · thinking · alto** | HECHO | `suspectUsers` (M2M) + `dni` + `returnedByEmployee` + `dedupKey`. Dedup → (regla, clave, ventana). `FraudClaimantDto`→`FraudUserDto`; `relatedClaimants` eliminado. Seed sec.16 deshabilitado. Tests en `FraudDetectionServiceTest`. **Deuda diferida (no olvidar):** el flag `isSuspicious` sigue vivo (ver notas EU-278/EU-280/EU-286) |
| 3 | EU-283 | Entidad de bloqueo + parámetros N/T configurables | Back + BD | Sonnet · thinking · medio | HECHO | `FraudBlock` + `FraudDetectionConfig` (singleton N=5/T=1). Repos + service + controller `/admin/fraud/config`. 8 tests unitarios. |
| 4 | EU-278 | Desarmar ciclo aprobar/rechazar del reclamo | Back + Front | Sonnet · sin thinking · medio | HECHO | Borrado `ClaimStatus`, `ReclamoHistory`, `ReclamoHistoryDto`, `IReclamoHistoryRepository`, `UpdateClaimStatusCommand`. Sacado `status` de `Reclamo`/`ReclamoDto`, `updateStatus` + endpoint, sort por status, y `isSuspicious` + query `existsBy...SuspectUsers` (deuda EU-282 saldada). **Desacople total reclamo↔returnFoundObject** (ambas direcciones): quitado `hasPriorClaim` y el bloque DEVUELTO del retiro, y `datetimeOfReturn`/`takerDNI`/`takerEmail` del DTO. `checkRepeatedRejections` eliminado (dependía de `RECHAZADO`). Front: limpieza en ReclamosList, ReclamoDetail, ReturnObjectForm, MyObjectHistory, MyObjectDetail. Unitarios verdes. **Smoke test local (MySQL+Weaviate):** arranque OK + `POST/GET /reclamos` 200. **Corrección a "cero migraciones":** la columna `reclamos.status` quedó huérfana **NOT NULL** (ddl-auto=update no la dropea); no rompe inserts porque MySQL rellena el ENUM con `'APROBADO'`, pero conviene `DROP COLUMN status` (lo cubre EU-292). |
| 5 | EU-284 | Implementar las 3 reglas (ventana deslizante) | Back | **Opus · thinking · alto** | HECHO | Detección **global (cross-org)** pero **acotada al DNI** que dispara: un solo fetch `findByDniInWindow(dni, now-T)` + partición en memoria para los 3 casos (el finder vive en Weaviate, se resuelve por `getByUuid`). `N`/`T` desde `FraudDetectionConfig`; **conteo puro ≥N**. Caso 1=DNI, Caso 2=(finder≠null,DNI), Caso 3=(empleado,DNI). Como `N` es global, Caso 2/3 implican Caso 1. **Una alerta por DNI** con todos los casos; dedup por `dedupKey="dni:"+DNI` vía `existsByDedupKeyAndCreatedAtAfter`. **Multi-caso registrado explícito**: enum `FraudCaseType` + `@ElementCollection<FraudCaseMatch>{caseType,matchedCount}` (tabla `fraud_alert_case` autocreada), expuesto en `FraudAlertDto.caseMatches` (`FraudCaseMatchDto`). Alerta **global del ADMIN** → `FraudAlert.organizationId` ahora `nullable=true`. Borradas reglas legacy + `checkForFraud` + props `fraud.*` + deps `feedback/reclamo` repos; sacadas las llamadas en `FeedbackService`/`ReclamoService` (adelanta parte de "quitar checkForFraud de reclamo" de EU-285). 8 tests unitarios verdes (caso 1/2/3, bajo-umbral, dedup, multi-caso, +mapeo DTO). **ALTER manual** (ddl-auto no quita NOT NULL) `ALTER TABLE fraud_alert MODIFY organization_id VARCHAR(36) NULL` — **ya aplicado en la BD local**; requerido en cualquier otra BD preexistente. Install desde cero la crea nullable sola; la tabla `fraud_alert_case` la autocrea ddl-auto. **Diferido:** NO cableado a alta/retiro (EU-285); NO crea `FraudBlock` (EU-286); notif. al ADMIN + visibilidad (`getAlerts`/`getFraudUserReport` siguen org-scoped legacy) → EU-287/288. |
| 6 | EU-285 | Enganchar detección en devolución y alta | Back | Sonnet · sin thinking · medio | HECHO | `ReturnFoundObjectService` inyecta `FraudDetectionService` y llama `detectFraudForReturn(rfo)` tras persistir la devolución (sección 6). **Control OBLIGATORIO:** si la detección falla, el error se propaga y la devolución NO se completa (sin try/catch que lo silencie). **Front:** en `ReturnObjectForm.js`, ante una devolución no permitida se muestra un **toast** de error + la **"X" en círculo** (`circle-xmark`, ya existente) al pie del form. **Gancho de alta NO implementado**: sin DNI/retiro ninguna regla evalúa nada y contar ahí castigaría al depositante (finder) → decisión cerrada (ver sec. 2). `checkForFraud` ya había sido removido de `Reclamo`/`Feedback` en EU-284 (verificado, nada que tocar). **Caso 1 intacto** (quien retira mucho SÍ dispara; lo que no se castiga es depositar). Test nuevo `detectFraud_isInvoked_withSavedReturn` en `ReturnFoundObjectServiceTest`; `FraudDetectionServiceTest` sin cambios. Sin migraciones. |
| 7 | EU-286 | Validar bloqueo en retiro y alta | Back | Sonnet · thinking leve · medio | HECHO | Nuevo **`FraudBlockService`** centraliza crear/consultar bloqueos. **(1) Creación:** `FraudDetectionService`, al persistir la alerta, llama `createBlocksForAlert(alert, blockDurationDays)` → 1 fila por DNI + 1 por cada `suspectUser` (finder/retirador/empleado), todas `expiresAt = now + duración`. **(2) Validación pre-persist:** en **retiro** (`returnFoundObject`) se rechaza si el **DNI** o el **usuario retirador** están bloqueados; en **alta** (`uploadFoundObject`) se rechaza si el **finder** está bloqueado. **Corrección de negocio (vs plan inicial):** el **finder bloqueado NO frena el retiro** —la devolución del dueño legítimo se permite igual—; el efecto es **no otorgarle puntos** + notificación in-app `REWARD_BLOCKED` (sección 7). **(3) Parámetro nuevo** `blockDurationDays` (default **7**, ≠ `T`) en `FraudDetectionConfig`, expuesto en el endpoint admin existente `/admin/fraud/config` (GET/PUT) + `FraudDetectionConfigDto`/`UpdateFraudDetectionConfigRequest` (validación ≥1). **Decisión técnica:** los rechazos son **`BadRequestException` (400), NO 403** — `Frontend/utils/fetchWithAuth.js` trata 403 como JWT vencido (refresh+retry); un 400 lo muestra directo en el toast que dejó EU-285. **Front:** 1 línea (label `REWARD_BLOCKED` en `Notifications.js`). **Tests:** 28 verdes en 5 clases (nuevos `FraudBlockServiceTest` ×4 y `FoundObjectServiceTest` ×1; `FraudDetectionConfigServiceTest` 9, `FraudDetectionServiceTest` 9, `ReturnFoundObjectServiceTest` 5). **Migración:** ddl-auto agrega `block_duration_days`; la tabla local estaba **vacía**, así que la columna se agregó sin problema (smoke test: arranque OK + `alter table ... add column block_duration_days`) y el singleton se crea con 7 al primer uso → **NO** hizo falta UPDATE manual local. **`ALTER`/UPDATE manual solo en DBs con fila preexistente:** `UPDATE fraud_detection_config SET block_duration_days = 7 WHERE id = 1`. Los 2 `@SpringBootTest` (`contextLoads`/`EndpointSecurityTest`) fallan sin env local (`${DATABASE_URL}`), ambiental/pre-existente. **Diferido:** FALSA_ALARMA/desbloqueo → EU-287. |
| 8 | EU-287 | FALSA_ALARMA: desbloqueo + limpieza reporte | Back | Sonnet · sin thinking · medio | TODO | validateAccess solo dueño; quitar gravityLevel/CSV |
| 9 | EU-279 | Notificar match ≥ 0.75 en alta (búsqueda guardada) | Back | Sonnet · thinking leve · medio | TODO | Net-new; reusa MIN_SCORE 0.75 |
| 10 | EU-288 | Ajustar front de fraude | Front | Sonnet · sin thinking · medio | TODO | FraudReport/Alerts/Detail/EvolutionChart/pdfExport |
| 10b | EU-300 | Front: pantalla de configuración de detección de fraude (ADMIN) | Front | Sonnet · sin thinking · medio | TODO | **Net-new (creada al cerrar EU-286).** Backend **ya listo** (endpoint `/admin/fraud/config` GET/PUT, rol ADMIN: EU-283 + EU-286). Agrega una entrada al Drawer ADMIN ya existente (`App.js`, junto a Dashboard/Usuarios/Organizaciones; patrón `screens/adminStack/`) con los 3 campos N/T/duración-de-bloqueo, validación ≥1. Hoy esos parámetros solo se tocan por API. Fuera de alcance: visibilidad de alertas globales del ADMIN (EU-287/288). Subtarea de EU-277. |
| 11 | EU-280 | Ajustar front y reportes de reclamo | Front | Sonnet · sin thinking · medio | TODO | ReclamosList, ReclamoDetail, Inventory. El badge "⚠ Sospechoso" (`isSuspicious`) ya fue **eliminado en EU-278** de `ReclamosList.js` y `ReclamoDetail.js`. Pendiente el rediseño "búsqueda guardada". **La eliminación de `Reclamo` se trasladó a EU-292** (back+front+BD); revisar si EU-280 se reduce o se absorbe en EU-292 (solapan en `ReclamosList`/`ReclamoDetail`/`Inventory`). |
| 12 | EU-292 | Extirpar entidad `Reclamo` (back + front + BD) | Back + Front + BD | Sonnet · thinking · medio | TODO | **Depende de EU-284 + EU-285** (cortar fraude→Reclamo). Borra la capa `Reclamo` (model/DTO/repo/controller/service); redefine `FeedbackService.wasFound`; saca el reclamo-espejo de `reportLostObject`; front: elimina `ReclamosList`/`ReclamoDetail`/pestaña `Inventory` + rework `MyObjectHistory`/`MyObjectDetail`; BD: `DROP COLUMN status` + `DROP TABLE reclamo_history` + `DROP TABLE reclamos`. **Reportes NO afectados** (`SearchFeedback`/`UsabilityFeedback`/`LostObject`). Solapa con EU-280 (ver nota). |
| 13 | EU-276 | Bug: reporte de uso no muestra el promedio (estrellas) | Front + Back | Sonnet · sin thinking · medio | TODO | Independiente; rama propia |
| — | EU-253 | Eliminar tipos de alerta viejos (High Claim Freq / Múltiples / Rechazos) | Back | Sonnet · sin thinking · medio | TODO | Ya existía en Jira; lo cubre EU-284 |

## 6. Stories padre y referencias

- **EU-275** — Story "Reclamo → búsqueda guardada" (subtareas: EU-278, EU-279, EU-280, EU-292).
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

## 8. Mapa `Reclamo` vs `LostObject` (referencia para EU-292)

Quién interviene en cada entidad (relevado sobre el código post-EU-278).

`Reclamo` (MySQL) — 🔴 se elimina en EU-292:

```
Reclamo (model) · ReclamoDto · IReclamoRepository (JPA/MySQL)
└─ ReclamoService  ← ReclamoController (POST/GET /reclamos, GET /reclamos/{id}, /reclamos/my[/{id}])
   ├─ FeedbackService.submitFeedback()      → createReclamo()   [caso "wasFound"]
   ├─ LostObjectService.reportLostObject()  → save(UUID=null)   ⚠ reclamo-ESPEJO (duplicación)
   └─ FraudDetectionService (reglas legacy) → reclamoRepository [se corta en EU-284/285]
Front: ReclamosList, ReclamoDetail, Inventory (tab), MyObjectHistory (/reclamos/my),
       MyObjectDetail (/reclamos/my/{id}), App.js (nav)
```

`LostObject` (Weaviate) — 🟢 entidad única que queda:

```
LostObject (model) · LostObjectRepository (Weaviate)
└─ LostObjectService
   ├─ reportLostObject()      ← LostObjectController POST /lost-objects   (+ hoy crea el espejo)
   ├─ findSimilarLostObject() ← FoundObjectService.uploadFoundObject()    [match + notificación]
   └─ getMyLostObjects()      ← LostObjectController GET /lost-objects/my
   └─ ReportsService          → lostObjectRepository.query()   ✅ los reportes usan LostObject
Front: UploadLostObjectModal (POST), MyObjectHistory (/lost-objects/my), MyLostObjectDetail
```

Cruce/nudo: `reportLostObject` escribe en las DOS (de ahí la duplicación en "Mis búsquedas");
`MyObjectHistory` lee las dos. Reportes ⇒ `LostObject`/`SearchFeedback`/`UsabilityFeedback`,
nunca `Reclamo`.

## 9. Ideas futuras (fuera del alcance del rework)

> No planificadas ni con story en Jira. Anotadas para refinar más adelante y, llegado el caso,
> crear los ítems. **No** son parte de EU-278…EU-288 / EU-292.

### 9.1 Sanción en dos capas: bloqueo temporal (automático) + baneo permanente (humano)

Idea: el bloqueo automático de EU-286 es **temporal y reversible** (contención inmediata de bajo
riesgo). Sobre el **historial confirmado** (el reporte de fraude per-usuario, EU-27 + EU-225/226/227),
el dueño/encargado puede ver reincidencia y escalar a un **baneo permanente** del usuario. Es
coherente con EU-27, que ya sugiere sanciones escalonadas: "advertencia, suspensión temporal o
bloqueo".

Principio de diseño: nunca automatizar lo irreversible. El bloqueo (auto, temporal) lo decide la
máquina; el baneo (permanente) lo decide un humano.

A definir antes de construirlo:
- **¿A quién se banea?** Solo aplica a **usuarios registrados** (tienen cuenta). Para **DNIs sin
  cuenta** no hay cuenta que banear: la única palanca sigue siendo el bloqueo re-aplicado/extendido.
- **Reincidencia = confirmada, no detectada.** Escalar a baneo contando **fraudes confirmados por
  humano**, no alertas automáticas crudas (evita banear por una racha de falsos positivos). El
  reporte ya distingue confirmado vs. en revisión.
- **¿Alcance org o global?** Detección y bloqueo son **globales (cross-org)**; el reporte hoy es
  **por organización**. El reincidente entre varias orgs solo se ve completo a nivel Eurekapp →
  el baneo probablemente debería ser **decisión global del dueño de Eurekapp**, no de cada org.

Nota relacionada (EU-288): el reporte per-usuario (EU-27) se escribió para el modelo viejo y asume
"usuario"; con el modelo nuevo, parte de los involucrados son **DNIs sin cuenta** que no encajan en
"usuario reincidente". Reconciliar eso es parte del ajuste de front de fraude (EU-288).
