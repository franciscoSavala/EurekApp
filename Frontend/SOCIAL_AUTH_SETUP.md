# Configuración pendiente: Login Social (Google y Facebook)

Antes de que el login social funcione, hay que completar estos pasos externos
y reemplazar los placeholders en el código.

---

## 1. Google OAuth

### Dónde configurar
1. Ir a https://console.cloud.google.com
2. Crear o seleccionar un proyecto
3. Ir a **APIs & Services → OAuth consent screen** → configurar (tipo "External", llenar nombre de app y email)
4. Ir a **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Crear uno de tipo **Web application** → copiar el `Client ID` → es el `GOOGLE_WEB_CLIENT_ID`
   - Crear uno de tipo **iOS** → Bundle ID: `com.eurekapp.frontend` → copiar → es el `GOOGLE_IOS_CLIENT_ID`
   - Crear uno de tipo **Android** → Package: `com.eurekapp.frontend` → copiar → es el `GOOGLE_ANDROID_CLIENT_ID`
5. En el cliente Web, agregar en **Authorized redirect URIs**:
   - `https://auth.expo.io/@TU_USUARIO_EXPO/Frontend`

### Dónde pegar los valores
Archivo: `screens/login/components/SocialAuthButtons.js`, líneas:
```js
const GOOGLE_WEB_CLIENT_ID      = 'YOUR_GOOGLE_WEB_CLIENT_ID';
const GOOGLE_IOS_CLIENT_ID      = 'YOUR_GOOGLE_IOS_CLIENT_ID';
const GOOGLE_ANDROID_CLIENT_ID  = 'YOUR_GOOGLE_ANDROID_CLIENT_ID';
```

---

## 2. Facebook Login

### Dónde configurar
1. Ir a https://developers.facebook.com
2. Crear una app (tipo "Consumer" o "None")
3. En el dashboard de la app, ir a **Add Product → Facebook Login → Web**
4. En **Facebook Login → Settings → Valid OAuth Redirect URIs**, agregar:
   - `https://auth.expo.io/@TU_USUARIO_EXPO/Frontend`
5. Copiar el **App ID** que aparece en el dashboard → es el `FACEBOOK_APP_ID`

### Dónde pegar el valor
Archivo: `screens/login/components/SocialAuthButtons.js`, línea:
```js
const FACEBOOK_APP_ID = 'YOUR_FACEBOOK_APP_ID';
```

---

## 3. Tu usuario de Expo

Para saber cuál es `@TU_USUARIO_EXPO`, ejecutá:
```bash
npx expo whoami
```

La redirect URI queda: `https://auth.expo.io/@<resultado>/Frontend`

---

## Resumen de archivos modificados para esta feature

| Archivo | Cambio |
|---------|--------|
| `screens/login/components/SocialAuthButtons.js` | **Reemplazar los 4 placeholders** |
| `Backend/.../model/UserEurekapp.java` | username max 100, campos providerType/providerId |
| `Backend/.../exception/ValidationError.java` | INVALID_SOCIAL_TOKEN, MISSING_SOCIAL_EMAIL |
| `Backend/.../dto/request/SocialLoginRequestDto.java` | Nuevo DTO |
| `Backend/.../service/AuthService.java` | socialLogin() + helpers Google/Facebook |
| `Backend/.../controller/AuthController.java` | POST /auth/social |
| `Backend/.../security/SecurityConfiguration.java` | /auth/social en permitAll() |
| `Frontend/app.json` | scheme: eurekapp |
| `Frontend/services/SocialAuthService.js` | Nuevo servicio |
| `Frontend/hooks/useUser.js` | loginWithSocial() |
