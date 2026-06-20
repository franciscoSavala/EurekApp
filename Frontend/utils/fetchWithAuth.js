import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { refreshJwt } from './axiosInstance';

export { refreshJwt };

function isAuthError(status) {
    // El backend devuelve 403 (y a veces 401) cuando el JWT venció.
    return status === 401 || status === 403;
}

function withAuthHeader(headers, jwt) {
    return { ...(headers || {}), Authorization: `Bearer ${jwt}` };
}

/**
 * Equivalente a `fetch` para requests autenticadas que no pasan por el
 * interceptor de axios. Inyecta el JWT actual y, si la respuesta es 401/403
 * por token vencido, lo renueva con refreshJwt() y reintenta una sola vez.
 *
 * @param {string} url
 * @param {RequestInit} options - se respetan headers/method/body del caller.
 * @returns {Promise<Response>}
 */
export async function fetchWithAuth(url, options = {}) {
    let jwt = await AsyncStorage.getItem('jwt');
    let res = await fetch(url, { ...options, headers: withAuthHeader(options.headers, jwt) });

    if (isAuthError(res.status)) {
        const newToken = await refreshJwt();
        if (!newToken) return res;
        res = await fetch(url, { ...options, headers: withAuthHeader(options.headers, newToken) });
    }
    return res;
}

/**
 * Variante de ReactNativeBlobUtil.fetch (usado para subir multipart/imágenes)
 * con renovación automática de JWT ante 401/403.
 *
 * @param {string} method
 * @param {string} url
 * @param {object} headers - headers SIN Authorization; se inyecta acá.
 * @param {*} body - el mismo body que se le pasaría a ReactNativeBlobUtil.fetch.
 * @returns {Promise} la respuesta de ReactNativeBlobUtil.
 */
export async function blobFetchWithAuth(method, url, headers, body) {
    let jwt = await AsyncStorage.getItem('jwt');
    let res = await ReactNativeBlobUtil.fetch(method, url, withAuthHeader(headers, jwt), body);

    if (isAuthError(res.info().status)) {
        const newToken = await refreshJwt();
        if (!newToken) return res;
        res = await ReactNativeBlobUtil.fetch(method, url, withAuthHeader(headers, newToken), body);
    }
    return res;
}
