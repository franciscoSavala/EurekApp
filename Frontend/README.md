# EurekApp — Frontend

App móvil de EurekApp desarrollada con **Expo SDK 51 / React Native 0.74**.

Para instrucciones completas de setup, ver el [README principal](../README.md).

## Requisitos

- Node.js 18+
- Expo Go instalado en el dispositivo (o emulador Android/iOS)

## Setup rápido

```bash
npm install
```

Crear `.env.development` con la URL del backend:

```env
BACK_URL=http://localhost:8080
```

> Si usás un dispositivo físico en la misma red, reemplazá `localhost` por la IP local de tu máquina.

## Iniciar

```bash
npx expo start
```

| Tecla | Acción |
|-------|--------|
| `a` | Abrir en emulador Android |
| `i` | Abrir en simulador iOS (solo macOS) |
| Escanear QR | Abrir en Expo Go (dispositivo físico) |

## Estructura

```
screens/          # Pantallas organizadas por stack de navegación
  findObjectStack/
  myObjectsStack/
  inventoryStack/
  reportsStack/
  fraudAlertsStack/
  notificationsStack/
  components/     # Componentes reutilizables entre pantallas
services/         # Llamadas a la API del backend
hooks/            # Custom hooks (autenticación, contextos)
utils/            # Utilitarios (dateFormatter, etc.)
assets/           # Imágenes, fuentes
```
