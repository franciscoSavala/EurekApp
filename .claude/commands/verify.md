---
description: Verificar de punta a punta un cambio del rework de búsqueda (EU-320), ejercitando el flujo real
---

Verificá que el cambio del **rework del algoritmo de búsqueda** realmente hace lo que debe,
**ejercitando el flujo afectado** — no alcanza con tests y typecheck. Manejá el flujo, observá
el comportamiento real.

No lo invoques sobre diffs que sólo tocan tests o docs (no hay runtime que observar).

## 1. Levantar el stack local

```powershell
# Contenedores (MySQL + Weaviate). El schema de Weaviate se crea acá (manual, auto-schema OFF).
cd "C:\Users\Facundo\Documents\Repositorios\Eurekapp\Backend"; bash start-local.sh
# Seed con embeddings reales (canónico).
bash seed-local.sh
```

Backend en perfil local (carga `.env.local` con las claves reales antes de arrancar mvnw):

```powershell
cd "C:\Users\Facundo\Documents\Repositorios\Eurekapp\Backend"; $env:JAVA_HOME = "C:\Program Files\Java\jdk-21"; Get-Content .env.local | Where-Object { $_ -match '=' -and $_ -notmatch '^\s*#' } | ForEach-Object { $k,$v = $_ -split '=',2; Set-Item "env:$($k.Trim())" $v.Trim() }; .\mvnw spring-boot:run "-Dspring-boot.run.profiles=local"
```

## 2. Ejercitar según lo que tocó el cambio

- **Schema (EU-323):** confirmá en Weaviate que `FoundObject` y `LostObject` tienen los dos
  vectores (imagen + texto) y la categoría, y que ya no se usa la descripción por IA.
- **Vectorización de imagen (EU-321):** una foto conocida produce un vector coherente; dos
  fotos del mismo objeto dan similitud alta (baseline PoC: coseno ≥ 0.895).
- **Clasificación (EU-322):** una imagen cae en la categoría dura esperada (Ropa,
  Billetera/tarjetas, Llaves, Celular, Otros).
- **Scoring (EU-324):** hacé una búsqueda por foto (`POST /found-objects/search-by-photo`) y
  verificá: ranking por `score = α·sim_imagen + β·sim_texto`, filtro DURO de categoría (no
  mezcla ni notifica entre categorías), modulación geo dentro del radio, y umbral
  (MIN_SCORE) para el corte.
- **Persistencia de foto (decisión A):** guardá una búsqueda → la imagen aparece en S3 con key
  = uuid del LostObject y se ve en `getMyLostObjects` (imageUrl). Una búsqueda que **no** se
  guarda **no** sube nada a S3.
- **Frontend (EU-326):** foto obligatoria en búsqueda y alta; sin descripción por IA; al
  guardar, se reenvía la foto.

## 3. Tests

```powershell
cd "C:\Users\Facundo\Documents\Repositorios\Eurekapp\Backend"; .\mvnw test
```

Los ~94 tests unitarios puros deben pasar. Si SÓLO fallan los 4 `@SpringBootTest` de
context-load (`BackendApplicationTests.contextLoads`, `EndpointSecurityTest` ×3) con
`Driver ... claims to not accept jdbcUrl ${DATABASE_URL}`, es **ambiental** (falta MySQL/entorno),
no una regresión. Para correrlos de verdad hay que levantar Docker + cargar el entorno (paso 1).

## Reportá

Qué flujo ejercitaste, con qué input, qué observaste y si coincide con lo esperado. Si algo
falla, mostrá la salida real; no lo des por verificado si no lo manejaste de punta a punta.
