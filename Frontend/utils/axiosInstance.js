import axios from 'axios';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const BACK_URL = Constants.expoConfig.extra.backUrl;

const axiosInstance = axios.create();

// Cola de requests que esperan a que termine una renovación de token en curso,
// para no disparar múltiples /auth/refresh en paralelo.
let isRefreshing = false;
let pendingRequests = [];

function onTokenRefreshed(newToken) {
    pendingRequests.forEach((cb) => cb(newToken));
    pendingRequests = [];
}

function onRefreshFailed() {
    pendingRequests.forEach((cb) => cb(null));
    pendingRequests = [];
}

async function refreshAccessToken() {
    const refreshToken = await AsyncStorage.getItem('refreshToken');
    if (!refreshToken) return null;

    // Cliente axios "limpio" (sin interceptores) para evitar recursión.
    const res = await axios.post(`${BACK_URL}/auth/refresh`, { refreshToken });
    const { token, refreshToken: newRefreshToken } = res.data;

    await AsyncStorage.setItem('jwt', token);
    if (newRefreshToken) {
        await AsyncStorage.setItem('refreshToken', newRefreshToken);
    }
    return token;
}

// Logout a invocar cuando la renovación falla en flujos que no pasan por el
// interceptor de axios (fetch nativo / ReactNativeBlobUtil). Se registra en
// setupAxiosInterceptors.
let onSessionExpired = () => {};

/**
 * Renueva el JWT de acceso de forma segura para los flujos que usan `fetch`
 * nativo o ReactNativeBlobUtil (subida de imágenes, descarga de PDFs), que no
 * pasan por el interceptor de axios. Comparte la misma cola para no disparar
 * múltiples /auth/refresh en paralelo.
 *
 * @returns {Promise<string|null>} el nuevo JWT, o null si no se pudo renovar.
 */
export async function refreshJwt() {
    if (isRefreshing) {
        return new Promise((resolve) => {
            pendingRequests.push((newToken) => resolve(newToken));
        });
    }

    isRefreshing = true;
    try {
        const newToken = await refreshAccessToken();
        if (!newToken) {
            onRefreshFailed();
            onSessionExpired();
            return null;
        }
        onTokenRefreshed(newToken);
        return newToken;
    } catch (e) {
        onRefreshFailed();
        onSessionExpired();
        return null;
    } finally {
        isRefreshing = false;
    }
}

export function setupAxiosInterceptors(logoutFn) {
    onSessionExpired = logoutFn;
    axiosInstance.interceptors.response.use(
        (response) => response,
        async (error) => {
            const originalRequest = error.config;
            const status = error?.response?.status;

            // Organización desactivada por el administrador: no se renueva, se cierra sesión.
            if (status === 401 && error?.response?.data?.error === 'org_deactivated') {
                Toast.show({
                    type: 'error',
                    text1: 'Organización suspendida',
                    text2: 'Tu organización fue desactivada por el administrador.',
                    visibilityTime: 4000,
                });
                logoutFn();
                return Promise.reject(error);
            }

            // El backend devuelve 403 (y a veces 401) cuando el JWT venció.
            const isAuthError = status === 401 || status === 403;

            if (!isAuthError || !originalRequest || originalRequest._retry) {
                if (isAuthError && originalRequest?._retry) {
                    // El reintento tras renovar también falló: la sesión no se puede recuperar.
                    logoutFn();
                }
                return Promise.reject(error);
            }

            // Si ya hay una renovación en curso, esperamos su resultado y reintentamos.
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    pendingRequests.push((newToken) => {
                        if (!newToken) {
                            reject(error);
                            return;
                        }
                        originalRequest._retry = true;
                        originalRequest.headers.Authorization = `Bearer ${newToken}`;
                        resolve(axiosInstance(originalRequest));
                    });
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const newToken = await refreshAccessToken();
                if (!newToken) {
                    onRefreshFailed();
                    logoutFn();
                    return Promise.reject(error);
                }
                onTokenRefreshed(newToken);
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                return axiosInstance(originalRequest);
            } catch (refreshError) {
                onRefreshFailed();
                logoutFn();
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }
    );
}

export default axiosInstance;
