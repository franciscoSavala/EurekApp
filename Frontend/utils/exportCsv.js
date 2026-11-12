import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchWithAuth, refreshJwt } from './fetchWithAuth';
import { isWeb } from './platform';

/**
 * Descarga un CSV que el backend genera en `url` y se lo entrega a la persona.
 *
 * En web baja el archivo con el nombre `fileName`. En el celular lo guarda en la caché y abre el
 * diálogo de compartir; si el servidor responde 401 o 403 renueva la sesión y reintenta una vez.
 * Los errores no se propagan: se avisan por consola, como hacían las tres pantallas.
 *
 * @param {string} url - dirección completa del reporte a exportar.
 * @param {string} fileName - nombre del archivo descargado (ej. 'fraud-report.csv').
 * @param {string} [dialogTitle] - título del diálogo de compartir en el celular; si falta, el diálogo
 *   se abre sin título ni tipo de archivo.
 */
export async function exportCsv({ url, fileName, dialogTitle }) {
    if (isWeb) {
        // En web el JWT no se puede pasar por la URL: se baja con fetch y se dispara la descarga.
        try {
            const res = await fetchWithAuth(url);
            const blob = await res.blob();
            const objectUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = objectUrl;
            a.download = fileName;
            a.click();
            URL.revokeObjectURL(objectUrl);
        } catch (e) {
            console.warn('Error exportando CSV:', e);
        }
        return;
    }

    try {
        const FileSystem = require('expo-file-system');
        const Sharing = require('expo-sharing');
        const fileUri = FileSystem.cacheDirectory + fileName;
        const download = async (jwt) => FileSystem.downloadAsync(url, fileUri, {
            headers: { Authorization: `Bearer ${jwt}` },
        });
        const jwt = await AsyncStorage.getItem('jwt');
        let downloadRes = await download(jwt);
        if (downloadRes.status === 401 || downloadRes.status === 403) {
            const newToken = await refreshJwt();
            if (newToken) downloadRes = await download(newToken);
        }
        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(downloadRes.uri, dialogTitle ? { mimeType: 'text/csv', dialogTitle } : undefined);
        }
    } catch (e) {
        console.warn('Error exportando CSV en native:', e);
    }
}
