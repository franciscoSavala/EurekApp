import Constants from "expo-constants";
import { Buffer } from 'buffer';
import { fetchWithAuth, blobFetchWithAuth } from "../utils/fetchWithAuth";
import { isWeb } from "../utils/platform";

const BACK_URL = Constants.expoConfig.extra.backUrl;

const FormData = global.FormData;

const toLocalISO = (date) => {
    const d = date instanceof Date ? date : new Date(date);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

/**
 * EU-326: guarda una búsqueda contra `POST /lost-objects`. Es multipart, con los datos en la query
 * string y la foto —OPCIONAL— en el cuerpo.
 *
 * EU-347: estaba adentro de UploadLostObjectModal. Se extrajo porque ahora la búsqueda se guarda
 * desde dos lugares: ese modal y la confirmación de "Este es mi objeto" en la búsqueda en vivo. Lo
 * delicado acá es el multipart, que tiene una implementación para web y otra para nativo; dos copias
 * de eso es como se desincronizan.
 *
 * @param matchedObjectUuid EU-347, y lo único que no comparten los dos llamadores: si viene, la
 *        búsqueda nace "Por retirar" apuntando a ese objeto encontrado, en lugar de "Buscando".
 */
export async function saveLostObject({ description, lostDate, coordinates, organizationId, photo, matchedObjectUuid }) {
    const params = new URLSearchParams({ description });
    if (lostDate) params.append('lost_date', toLocalISO(lostDate));
    if (coordinates?.latitude != null && coordinates?.longitude != null) {
        params.append('latitude', coordinates.latitude);
        params.append('longitude', coordinates.longitude);
    }
    if (organizationId != null) params.append('organization_id', String(organizationId));
    if (matchedObjectUuid) params.append('matched_object_uuid', matchedObjectUuid);
    const url = `${BACK_URL}/lost-objects?${params.toString()}`;

    if (isWeb) {
        const formData = new FormData();
        if (photo) {
            formData.append('file', new Blob([Buffer.from(photo.base64, 'base64')]), 'lost_photo.jpg');
        }
        const response = await fetchWithAuth(url, { method: 'POST', body: formData });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return;
    }
    const parts = photo
        ? [{ name: 'file', filename: 'lost_photo.jpg', type: photo.mimeType || 'image/jpeg',
             data: 'RNFetchBlob-base64://' + String(photo.base64) }]
        : [];
    const response = await blobFetchWithAuth('POST', url,
        { 'Content-Type': 'multipart/form-data' }, parts);
    const status = response.info().status;
    if (status < 200 || status >= 300) throw new Error(`HTTP ${status}`);
}
