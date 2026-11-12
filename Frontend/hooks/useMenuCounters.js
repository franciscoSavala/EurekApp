import {useCallback, useEffect, useRef, useState} from 'react';
import Toast from 'react-native-toast-message';
import Constants from 'expo-constants';
import axiosInstance from '../utils/axiosInstance';

const BACK_URL = Constants.expoConfig.extra.backUrl;

/* Contadores del menú lateral: avisos sin leer (todos los roles), solicitudes de alta pendientes y
 * alertas de fraude no vistas (solo ADMIN). Se refrescan cada 30 segundos. */
export const useMenuCounters = (userRole) => {
    const [unreadNotifCount, setUnreadNotifCount] = useState(0);
    const [pendingOrgRequestCount, setPendingOrgRequestCount] = useState(0);
    const [unseenFraudAlertCount, setUnseenFraudAlertCount] = useState(0);
    const prevCountRef = useRef(0);
    const isFirstFetchRef = useRef(true);

    useEffect(() => {
        const fetchUnreadCount = async () => {
            try {
                const res = await axiosInstance.get(BACK_URL + '/notifications/unread-count');
                const newCount = res.data.count || 0;
                if (!isFirstFetchRef.current && newCount > prevCountRef.current) {
                    Toast.show({
                        type: 'info',
                        text1: 'Nueva notificación',
                        text2: 'Tenés notificaciones sin leer.',
                    });
                }
                prevCountRef.current = newCount;
                isFirstFetchRef.current = false;
                setUnreadNotifCount(newCount);
            } catch (e) {
                // silently ignore — badge is optional
            }
        };
        fetchUnreadCount();
        const interval = setInterval(fetchUnreadCount, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchPendingCount = useCallback(async () => {
        if (userRole !== 'ADMIN') return;
        try {
            const res = await axiosInstance.get(BACK_URL + '/organizations/requests/pending-count');
            setPendingOrgRequestCount(res.data.count || 0);
        } catch (e) {
            // silently ignore — badge es opcional
        }
    }, [userRole]);

    useEffect(() => {
        if (userRole !== 'ADMIN') return;
        fetchPendingCount();
        const interval = setInterval(fetchPendingCount, 30000);
        return () => clearInterval(interval);
    }, [fetchPendingCount]);

    /* EU-388: hasta ahora, con la aplicación abierta, el dueño de Eurekapp no tenía ninguna señal
     * de que se hubiera generado una alerta de fraude: la alerta se creaba, bloqueaba, y esperaba a
     * que alguien entrara al panel. El único aviso salía por correo (EU-353), fuera de la
     * aplicación. El número cuenta las alertas creadas desde la última visita, así que se enciende
     * con cada alerta nueva y se apaga al entrar a mirarlas. */
    const fetchUnseenFraudAlertCount = useCallback(async () => {
        if (userRole !== 'ADMIN') return;
        try {
            const res = await axiosInstance.get(BACK_URL + '/fraud-alerts/unseen-count');
            setUnseenFraudAlertCount(res.data.count || 0);
        } catch (e) {
            // silently ignore — badge es opcional
        }
    }, [userRole]);

    useEffect(() => {
        if (userRole !== 'ADMIN') return;
        fetchUnseenFraudAlertCount();
        const interval = setInterval(fetchUnseenFraudAlertCount, 30000);
        return () => clearInterval(interval);
    }, [fetchUnseenFraudAlertCount]);

    /* El número se apaga en la pantalla ANTES de que conteste el servidor: entrar a la sección es
     * el gesto de "ya las vi", y esperar medio segundo a que vuelva la respuesta se ve como que el
     * indicador quedó pegado. Si el guardado falla, el refresco de los 30 segundos lo vuelve a
     * encender, que es lo correcto —no se vio lo que no se pudo registrar—.
     *
     * Va acá y no en la pantalla de alertas para que valga por cualquier camino: el botón del menú,
     * pero también el enlace desde una notificación. */
    const markFraudAlertsSeen = useCallback(async () => {
        if (userRole !== 'ADMIN') return;
        setUnseenFraudAlertCount(0);
        try {
            await axiosInstance.post(BACK_URL + '/fraud-alerts/seen', {});
        } catch (e) {
            // silently ignore — lo recupera el próximo refresco
        }
    }, [userRole]);

    return {
        unreadNotifCount, setUnreadNotifCount,
        pendingOrgRequestCount, fetchPendingCount,
        unseenFraudAlertCount, markFraudAlertsSeen,
    };
};
