# EurekApp

Aplicación móvil de objetos perdidos y encontrados — Proyecto Final UTN FRC 2024.

Permite a organizaciones (facultades, terminales, aeropuertos) registrar objetos encontrados, y a usuarios buscarlos mediante **búsqueda semántica por IA**.

---

## Tabla de contenidos

1. [Arquitectura general](#arquitectura-general)
2. [Prerequisitos](#prerequisitos)
3. [Servicios externos necesarios](#servicios-externos-necesarios)
4. [Configuración inicial (primera vez)](#configuración-inicial-primera-vez)
5. [Levantar el entorno local](#levantar-el-entorno-local)
6. [Poblar la base de datos con datos de prueba](#poblar-la-base-de-datos-con-datos-de-prueba)
7. [Swagger / Documentación de la API](#swagger--documentación-de-la-api)
8. [Levantar el frontend](#levantar-el-frontend)
9. [Comandos útiles](#comandos-útiles)
10. [Estructura del proyecto](#estructura-del-proyecto)
11. [Despliegue](#despliegue)

---

## Arquitectura general

```
┌─────────────────┐     HTTP      ┌──────────────────────┐
│  React Native   │ ────────────▶ │  Spring Boot 3 API   │
│  (Expo, web y   │               │  :8080               │
│   móvil)        │               └──────────┬───────────┘
└─────────────────┘                          │
        ┌──────────────┬─────────────────────┼──────────────┬──────────────┐
        │              │                     │              │              │
 ┌──────▼──────┐ ┌─────▼──────────┐ ┌────────▼───────┐ ┌────▼─────────┐ ┌──▼──────────┐
 │  MySQL 8.0  │ │ Weaviate 1.24  │ │  clip-service  │ │ S3 / MinIO   │ │ OpenAI API  │
 │  :3306      │ │ :8081          │ │  :8000         │ │ :9000 (local)│ │ (embeddings │
 │  datos del  │ │ vectores de    │ │ vector de la   │ │ fotos de los │ │  de texto + │
 │  negocio    │ │ texto e imagen │ │ foto (CLIP)    │ │ objetos      │ │  GPT-4o)    │
 └─────────────┘ └────────────────┘ └────────────────┘ └──────────────┘ └─────────────┘
```

- **MySQL** guarda usuarios, organizaciones, devoluciones, feedback, alertas de fraude y reclamos.
- **Weaviate** guarda los objetos encontrados (`FoundObject`) y las búsquedas abiertas (`LostObject`). Cada objeto tiene dos vectores: uno de la foto y otro del texto.
- **clip-service** es un microservicio propio en Python que corre el modelo CLIP. Genera el vector de cada foto y la categoría sugerida. No llama a ningún servicio externo.
- **OpenAI** genera los vectores de texto (`text-embedding-3-small`) y analiza los objetos con GPT-4o.
- **S3** guarda las fotos. En local se usa **MinIO**, que imita a S3 dentro de Docker, así que no hace falta una cuenta de AWS.
- Los correos (invitaciones, alertas de fraude, bloqueos, recuperación de contraseña) salen por **Gmail SMTP**.

---

## Prerequisitos

Instalá todo esto antes de comenzar:

| Herramienta | Versión mínima | Para qué | Descarga |
|-------------|---------------|----------|----------|
| **Java (JDK)** | 21 | Correr el backend | [adoptium.net](https://adoptium.net) |
| **Docker Desktop** | Cualquiera reciente | MySQL, Weaviate, MinIO y clip-service | [docker.com](https://www.docker.com/products/docker-desktop) |
| **Git Bash** o **WSL** | — | Ejecutar los scripts `.sh` | Incluido con Git para Windows |
| **Python 3** | 3.8+ | Script de seed (genera hashes BCrypt y vectores) | [python.org](https://www.python.org/downloads) |
| **Node.js** | 18+ | Frontend con Expo | [nodejs.org](https://nodejs.org) |
| **curl** | — | Usado internamente por los scripts | Incluido en Git Bash y WSL |

> **Windows:** todos los scripts `.sh` deben ejecutarse desde **Git Bash** o **WSL**, no desde CMD ni PowerShell.

### Verificar que todo esté instalado

```bash
java -version        # debe mostrar 21.x
docker --version
python3 --version    # debe mostrar 3.x
node --version       # debe mostrar 18.x o superior
curl --version
```

### Librería Python necesaria para el seed

El script `seed-local.sh` instala `bcrypt` automáticamente si no está presente. Si preferís instalarlo a mano:

```bash
pip install bcrypt
```

---

## Servicios externos necesarios

Para desarrollo local alcanza con OpenAI y Gmail. AWS es opcional.

### 1. OpenAI
- Crear cuenta en [platform.openai.com](https://platform.openai.com)
- Ir a **API Keys** → **Create new secret key**
- Guardar la clave (empieza con `sk-`)
- Se usa para generar los vectores de texto de la búsqueda semántica y para el análisis con GPT-4o

### 2. Gmail SMTP
- Necesitás una cuenta de Google
- Ir a [myaccount.google.com](https://myaccount.google.com) → **Seguridad** → **Contraseñas de aplicaciones**
- Generar una contraseña de aplicación para "Correo"
- Guardar el código de 16 caracteres (sin espacios)
- Se usa para envío de notificaciones por email (invitaciones, alertas de fraude, bloqueos, etc.)

### 3. AWS S3 (opcional)
- En local las fotos van a **MinIO**, que se levanta solo con Docker y ya crea el bucket `eurekapp-temp`.
- Solo hace falta una cuenta de AWS para apuntar el backend local al S3 real. En ese caso se completan `S3_ENDPOINT`, `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY` en `.env.local` (ver `.env.local.example`).

---

## Configuración inicial (primera vez)

### 1. Clonar el repositorio

```bash
git clone <url-del-repo>
cd EurekApp/Backend
```

### 2. Crear el archivo de secrets locales

```bash
cp .env.local.example .env.local
```

Editá `.env.local` y completá con tus claves reales:

```bash
# OpenAI
OPENAI_SECRET_KEY=sk-proj-xxxxxxxxxxxxx

# JWT — generá un string random con: openssl rand -base64 32
JWT_SIGN_KEY=un-string-muy-largo-y-aleatorio-de-al-menos-32-chars

# Gmail SMTP — contraseña de aplicación (myaccount.google.com → Seguridad → Contraseñas de aplicaciones)
MAIL_USER=tu-cuenta@gmail.com
MAIL_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

> Las variables de AWS quedan comentadas: sin ellas, el backend local usa MinIO.

> `.env.local` está en `.gitignore` — nunca se sube al repositorio.

---

## Levantar el entorno local

Una vez completado `.env.local`, todo se levanta con **un solo comando**:

```bash
bash start-local.sh
```

El script hace esto en orden:

1. Verifica que Docker, Java y curl estén instalados
2. Verifica que Docker Desktop esté corriendo
3. Carga y valida las variables de `.env.local`
4. Levanta **MySQL**, **Weaviate**, **MinIO** y **clip-service** con `docker compose up -d`
5. Espera a que MySQL, Weaviate y MinIO estén saludables (healthcheck)
6. Crea las clases `FoundObject` y `LostObject` en Weaviate, cada una con dos vectores con nombre: `image` y `text` (idempotente — si ya existen, las saltea)
7. Inicia el backend Spring Boot en el puerto `8080`

```
╔══════════════════════════════════╗
║      EurekApp — Local Setup      ║
╚══════════════════════════════════╝

[OK]    Prerequisitos OK
[OK]    Variables de entorno cargadas
[INFO]  Levantando MySQL, Weaviate y MinIO con Docker Compose...
[OK]    MySQL listo
[OK]    Weaviate listo
[OK]    MinIO listo (bucket eurekapp-temp asegurado por minio-init)
[OK]    Clase 'FoundObject' creada
[OK]    Clase 'LostObject' creada
[INFO]  Iniciando backend Spring Boot (perfil: local)...
```

> La primera vez, **clip-service** descarga el modelo CLIP y tarda unos minutos en responder. Después queda guardado en un volumen de Docker.

> El esquema de Weaviate se crea a mano desde este script. Si una clase ya existe con un esquema viejo, hay que borrarla y volver a correr el script.

Para detener el backend: `Ctrl+C`

Para bajar los contenedores Docker:

```bash
docker compose down
```

---

## Poblar la base de datos con datos de prueba

Con los contenedores ya corriendo (no es necesario que el backend esté levantado):

```bash
bash seed-local.sh
```

El script te pedirá confirmación antes de borrar los datos actuales. Para saltear la confirmación:

```bash
bash seed-local.sh --force
```

### Qué inserta el seed

El juego de datos vive en `Backend/seed-data/snapshot/`. Los objetos ya traen sus vectores reales, así que el seed no llama a OpenAI ni a CLIP.

**MySQL:**

| Datos | Registros |
|-------|-----------|
| Organizaciones | 6 (UTN FRC · Terminal de Ómnibus · Aeropuerto · Patio Olmos · UNC · Dinosaurio Mall) |
| Usuarios | 17 (ver tabla abajo) |
| Devoluciones | Devoluciones de ejemplo, consistentes con los objetos de Weaviate |
| Feedback | De búsquedas, de organizaciones y de usabilidad |
| Fraude | Configuración, alertas, casos y un bloqueo activo |
| Reclamos | Reclamos con su historial |
| Solicitudes de alta | Pedidos de alta de organización |

**Weaviate:**

| Clase | Registros |
|-------|-----------|
| `FoundObject` | 31 objetos encontrados, con foto y vectores |
| `LostObject` | 6 búsquedas abiertas |

### Usuarios disponibles tras el seed

Todos usan la misma contraseña: **`Eurekapp1!`**

| Email | Rol | Organización |
|-------|-----|-------------|
| `soporte.eurekapp@gmail.com` | ADMIN | — |
| `owner.utn@eurekapp.com` | ORGANIZATION_OWNER | UTN FRC |
| `encargado.utn@eurekapp.com` | ENCARGADO | UTN FRC |
| `emp1.utn@eurekapp.com` | ORGANIZATION_EMPLOYEE | UTN FRC |
| `emp2.utn@eurekapp.com` | ORGANIZATION_EMPLOYEE | UTN FRC |
| `owner.term@eurekapp.com` | ORGANIZATION_OWNER | Terminal de Ómnibus |
| `emp1.aero@eurekapp.com` | ORGANIZATION_EMPLOYEE | Aeropuerto |
| `owner.patio@eurekapp.com` | ORGANIZATION_OWNER | Patio Olmos |
| `emp1.patio@eurekapp.com` | ORGANIZATION_EMPLOYEE | Patio Olmos |
| `owner.unc@eurekapp.com` | ORGANIZATION_OWNER | UNC |
| `emp1.unc@eurekapp.com` | ORGANIZATION_EMPLOYEE | UNC |
| `owner.dino@eurekapp.com` | ORGANIZATION_OWNER | Dinosaurio Mall |
| `emp1.dino@eurekapp.com` | ORGANIZATION_EMPLOYEE | Dinosaurio Mall |
| `julia@mail.com` | USER | — |
| `pedro@mail.com` | USER | — |
| `valeria@mail.com` | USER | — |
| `micaela@mail.com` | USER (bloqueada por fraude) | — |

> Si Python o `bcrypt` no están disponibles, el script lo avisa y usa un hash precalculado. La contraseña sigue siendo `Eurekapp1!`.

---

## Swagger / Documentación de la API

Con el backend corriendo, abrí en el navegador:

```
http://localhost:8080/swagger-ui/index.html
```

### Autenticarse en Swagger

1. Expandir **Autenticación** → `POST /login`
2. Hacer clic en **Try it out** y enviar con tus credenciales:
   ```json
   {
     "username": "soporte.eurekapp@gmail.com",
     "password": "Eurekapp1!"
   }
   ```
3. Copiar el valor del campo `token` de la respuesta
4. Hacer clic en el botón **Authorize** (arriba a la derecha)
5. Pegar el token y confirmar — todos los endpoints quedan autenticados

### Grupos de endpoints

| Tag | Endpoints |
|-----|-----------|
| **Autenticación** | Login, registro y recuperación de contraseña — públicos |
| **Objetos Encontrados** | Cargar, buscar por texto o por foto, devolver, ver inventario |
| **Objetos Perdidos** | Reportar y gestionar búsquedas abiertas |
| **Organizaciones** | CRUD de orgs, solicitudes de alta, invitar/desvincular empleados |
| **Usuario** | Perfil, logros y XP del usuario autenticado |
| **Administración** | Gestión global del administrador |
| **Estadísticas** | Métricas generales |
| **Reportes** | Reportes de uso y de fraude |
| **Fraud Alerts** | Alertas de fraude, bloqueos y su revisión |
| **Notifications** | Notificaciones del usuario |
| **Feedback** | Opinión sobre los resultados de búsqueda |
| **Organization Feedback** | Opinión sobre la atención de la organización |
| **Usability Feedback** | Opinión sobre la app |

-----|-----------|
| **Autenticación** | `POST /login`, `POST /signup` — públicos |
| **Objetos Encontrados** | Cargar, buscar por org/coordenadas, devolver, ver inventario |
| **Objetos Perdidos** | Reportar búsqueda abierta |
| **Organizaciones** | CRUD de orgs, invitar/desvincular empleados |
| **Usuario** | Perfil, logros y XP del usuario autenticado |
| **Estadísticas** | Métricas generales — público |

---

## Levantar el frontend

```bash
cd Frontend
npm install        # solo la primera vez
npx expo start
```

La URL del backend se configura en `Frontend/.env.development`:

```bash
BACK_URL=http://localhost:8080
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...   # login con Google, ver Frontend/SOCIAL_AUTH_SETUP.md
```

> En local la versión web de Expo corre en el puerto `8082`, porque Weaviate ocupa el `8081`.

> Para probar en un dispositivo físico en la misma red WiFi, reemplazá `localhost` por la IP local de tu máquina (ej: `192.168.1.100`).

---

## Comandos útiles

```bash
# Levantar todo el entorno local
bash Backend/start-local.sh

# Poblar la BD con datos de prueba
bash Backend/seed-local.sh

# Ver logs de MySQL
docker logs eurekapp-mysql

# Ver logs de Weaviate
docker logs eurekapp-weaviate

# Ver logs de clip-service (útil la primera vez, mientras baja el modelo)
docker logs eurekapp-clip

# Conectarse a MySQL desde la terminal
docker exec -it eurekapp-mysql mysql -u eurekapp -peurekapp eurekapp

# Ver el schema de Weaviate
curl http://localhost:8081/v1/schema

# Bajar los contenedores (preserva los datos en volúmenes)
docker compose -f Backend/docker-compose.yml down

# Bajar los contenedores Y borrar los volúmenes (reset total de BD)
docker compose -f Backend/docker-compose.yml down -v

# Generar un JWT_SIGN_KEY random
openssl rand -base64 32
```

---

## Estructura del proyecto

```
EurekApp/
├── Backend/                        # Spring Boot 3 — Java 21
│   ├── src/main/java/.../
│   │   ├── controller/             # REST controllers (15)
│   │   ├── service/                # Lógica de negocio
│   │   ├── repository/             # JPA + Weaviate + S3
│   │   ├── model/                  # Entidades JPA y POJOs
│   │   ├── dto/                    # DTOs de request/response
│   │   ├── exception/              # Excepciones y su manejo
│   │   ├── util/                   # Utilidades
│   │   └── configuration/          # Security, Swagger, beans
│   ├── src/main/resources/
│   │   ├── application.yml         # Config base (usa env vars)
│   │   ├── application-local.yml   # Config local (DB y MinIO)
│   │   ├── application-prod.yml    # Config del despliegue en AWS
│   │   ├── application-test.yml    # Config tests (H2 en memoria)
│   │   └── templates/              # Plantillas de los correos
│   ├── seed-data/                  # Juego de datos de prueba (snapshot/) y sus fotos
│   ├── docker-compose.yml          # MySQL 8 + Weaviate 1.24.1 + MinIO + clip-service
│   ├── docker-compose.prod.yml     # Servicios del despliegue en AWS
│   ├── start-local.sh              # Levanta todo el entorno local
│   ├── seed-local.sh               # Pobla la BD con datos de prueba
│   ├── setup-ec2.sh                # Prepara la instancia EC2
│   ├── .env.local                  # Secrets locales (NO commitear)
│   └── .env.local.example          # Plantilla de secrets
│
├── clip-service/                   # Microservicio Python con CLIP (vector y categoría de la foto)
│
├── Frontend/                       # React Native — Expo SDK 51
│   ├── screens/                    # Pantallas de la app
│   ├── services/                   # Llamadas a la API
│   ├── hooks/                      # Custom hooks
│   ├── styles/                     # Estilos compartidos
│   ├── utils/                      # Utilidades
│   ├── __tests__/                  # Tests
│   └── .env.development            # URL del backend
│
└── .github/workflows/              # Despliegue automático del backend y del frontend
```

---

## Despliegue

El despliegue en AWS es automático con GitHub Actions:

- **Backend** (`deploy-backend.yml`): compila el JAR, lo copia a una instancia EC2 y reinicia el servicio.
- **Frontend** (`deploy-frontend.yml`): compila la versión web y la sube a S3.

Las credenciales se cargan como secrets del repositorio en GitHub. La instancia se prepara una sola vez con `Backend/setup-ec2.sh`.
