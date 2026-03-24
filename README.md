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
11. [Notas para producción](#notas-para-producción)

---

## Arquitectura general

```
┌─────────────────┐     HTTP      ┌──────────────────────┐
│  React Native   │ ──────────── │  Spring Boot 3 API   │
│  (Expo)         │              │  :8080               │
└─────────────────┘              └──────────┬───────────┘
                                            │
                    ┌───────────────────────┼────────────────────────┐
                    │                       │                        │
             ┌──────▼──────┐      ┌─────────▼──────┐     ┌─────────▼──────┐
             │  MySQL 8.0  │      │  Weaviate 1.24 │     │   AWS S3       │
             │  :3306      │      │  :8081         │     │  (imágenes)    │
             └─────────────┘      └────────────────┘     └────────────────┘
                                            │
                                   ┌────────▼────────┐
                                   │   OpenAI API    │
                                   │ (embeddings +   │
                                   │  vision)        │
                                   └─────────────────┘
```

---

## Prerequisitos

Instalá todo esto antes de comenzar:

| Herramienta | Versión mínima | Para qué | Descarga |
|-------------|---------------|----------|----------|
| **Java (JDK)** | 21 | Correr el backend | [adoptium.net](https://adoptium.net) |
| **Docker Desktop** | Cualquiera reciente | MySQL + Weaviate | [docker.com](https://www.docker.com/products/docker-desktop) |
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

Necesitás cuentas en estos tres servicios. Todos tienen **tier gratuito** suficiente para desarrollo:

### 1. OpenAI
- Crear cuenta en [platform.openai.com](https://platform.openai.com)
- Ir a **API Keys** → **Create new secret key**
- Guardar la clave (empieza con `sk-`)
- Se usa para: analizar imágenes de objetos (Vision) y generar embeddings para búsqueda semántica

### 2. AWS (S3)
- Crear cuenta en [aws.amazon.com](https://aws.amazon.com)
- Ir a **IAM** → **Users** → **Create user**
- Asignar política: `AmazonS3FullAccess`
- Ir a **Security credentials** → **Create access key** → elegir *Application running outside AWS*
- Guardar `Access key ID` y `Secret access key`
- Crear el bucket `eurekapp-temp` en la región `sa-east-1` (São Paulo)

### 3. Mailtrap
- Crear cuenta gratuita en [mailtrap.io](https://mailtrap.io)
- Ir a **Email Testing** → **Inboxes** → tu inbox → **SMTP Settings**
- Copiar el **Password** (es la API key para SMTP)
- Se usa para envío de notificaciones por email

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

# Mailtrap
MAILTRAP_KEY=tu-password-de-smtp-de-mailtrap

# AWS
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

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
4. Levanta **MySQL** y **Weaviate** con `docker compose up -d`
5. Espera a que ambos estén saludables (healthcheck)
6. Crea las clases `FoundObject` y `LostObject` en Weaviate (idempotente — si ya existen, las saltea)
7. Inicia el backend Spring Boot en el puerto `8080`

```
╔══════════════════════════════════╗
║      EurekApp — Local Setup      ║
╚══════════════════════════════════╝

[OK]    Prerequisitos OK
[OK]    Variables de entorno cargadas
[INFO]  Levantando MySQL y Weaviate con Docker Compose...
[OK]    MySQL listo
[OK]    Weaviate listo
[OK]    Clase 'FoundObject' creada
[OK]    Clase 'LostObject' creada
[INFO]  Iniciando backend Spring Boot (perfil: local)...
```

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

**MySQL:**

| Tabla | Registros |
|-------|-----------|
| `organizations` | 3 (UTN FRC · Terminal de Ómnibus · Aeropuerto Córdoba) |
| `users` | 8 (ver tabla abajo) |
| `return_found_objects` | 2 retornos de ejemplo |

**Weaviate:**

| Clase | Registros |
|-------|-----------|
| `FoundObject` | 5 objetos con vectores de embedding |
| `LostObject` | 3 búsquedas abiertas |

### Usuarios disponibles tras el seed

Todos usan la misma contraseña: **`Eurekapp1!`**

| Email | Rol | Organización | XP |
|-------|-----|-------------|-----|
| `admin@eurekapp.com` | ADMIN | — | 500 |
| `owner.utn@eurekapp.com` | ORGANIZATION_OWNER | UTN FRC | 150 |
| `owner.term@eurekapp.com` | ORGANIZATION_OWNER | Terminal de Ómnibus | 80 |
| `emp1.utn@eurekapp.com` | ORGANIZATION_EMPLOYEE | UTN FRC | 30 |
| `emp2.utn@eurekapp.com` | ORGANIZATION_EMPLOYEE | UTN FRC | 20 |
| `julia@mail.com` | USER | — | 20 |
| `pedro@mail.com` | USER | — | 10 |
| `valeria@mail.com` | USER | — | 0 |

> Si `python3` no está disponible, el script lo avisa y usa un hash de fallback. La contraseña en ese caso será `password`.

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
     "username": "admin@eurekapp.com",
     "password": "Eurekapp1!"
   }
   ```
3. Copiar el valor del campo `token` de la respuesta
4. Hacer clic en el botón **Authorize** (arriba a la derecha)
5. Pegar el token y confirmar — todos los endpoints quedan autenticados

### Grupos de endpoints

| Tag | Endpoints |
|-----|-----------|
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
```

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
│   │   ├── controller/             # REST controllers (6)
│   │   ├── service/                # Lógica de negocio
│   │   ├── repository/             # JPA + Weaviate + S3
│   │   ├── model/                  # Entidades JPA y POJOs
│   │   ├── dto/                    # DTOs de request/response
│   │   └── configuration/          # Security, Swagger, beans
│   ├── src/main/resources/
│   │   ├── application.yml         # Config base (usa env vars)
│   │   ├── application-local.yml   # Config local (DB hardcodeada)
│   │   └── application-test.yml    # Config tests (H2 en memoria)
│   ├── docker-compose.yml          # MySQL 8 + Weaviate 1.24.1
│   ├── start-local.sh              # Levanta todo el entorno local
│   ├── seed-local.sh               # Pobla la BD con datos de prueba
│   ├── .env.local                  # Secrets locales (NO commitear)
│   └── .env.local.example          # Plantilla de secrets
│
├── Frontend/                       # React Native — Expo SDK 51
│   ├── screens/                    # Pantallas de la app
│   ├── services/                   # Llamadas a la API
│   ├── hooks/                      # Custom hooks
│   └── .env.development            # URL del backend
│
└── mock-server/                    # Servidor Express para testing frontend
    └── server.js
```

---

## Notas para producción

> Esta sección aplica cuando se quiera desplegar en la nube. Por ahora el foco es desarrollo local.

- Reemplazar **Mailtrap** por AWS SES o Resend para envío real de emails
- Usar **AWS RDS** (MySQL 8.0) en lugar del contenedor Docker
- Usar **Weaviate Cloud** o una instancia EC2 dedicada para Weaviate
- Migrar el esquema de `ddl-auto: update` a **Flyway** para migraciones controladas
- Configurar HTTPS con un load balancer (ALB) o Nginx reverse proxy
- El workflow de GitHub Actions para deploy automático a AWS se agregará próximamente
