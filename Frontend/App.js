import React, {useEffect, useState} from 'react';
import {NavigationContainer, useNavigationContainerRef} from '@react-navigation/native';
import {Linking, View} from "react-native";
import {useFonts} from "expo-font";
import {LoginContext} from "./hooks/useUser";
import useUser from "./hooks/useUser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from 'react-native-toast-message';
import {setupAxiosInterceptors} from './utils/axiosInstance';
import {isJwtValid} from './utils/jwt';
import {toastConfig} from './utils/toastConfig';
import {AuthStackScreen} from './navigation/AuthStack';
import {EurekappTab} from './navigation/EurekappTab';

async function clearSession() {
    await AsyncStorage.multiRemove([
        'jwt', 'refreshToken', 'user', 'username',
        'user.first_name', 'org.id', 'org.name', 'organization',
    ]);
}

const AxiosSetup = () => {
    const { logout } = useUser();
    useEffect(() => {
        setupAxiosInterceptors(logout);
    }, [logout]);
    return null;
};

// Sin esta configuración el NavigationContainer no sincroniza la URL con la navegación:
// en web la barra de direcciones queda siempre en "/", así que al refrescar la app vuelve a
// montarse en el initialRouteName del Drawer (para ADMIN, el Dashboard) y se pierde la pantalla
// en la que estaba el usuario.
//
// No lleva `config`: cuando no se especifica uno, React Navigation usa el nombre de la ruta como
// segmento de la URL en ambas direcciones (getPathFromState y getStateFromPath), que es
// justo lo que necesitamos para que el refresh conserve la pantalla.
//
// `prefixes` sólo se usa en apps nativas para reconocer los deep links; en web useLinking lee
// location.pathname directamente y lo ignora. Se declara el scheme de app.json para que el día
// que se abran deep links en el celular ya esté puesto.
const linking = {
    prefixes: ['eurekapp://'],
};

/* EU-374: el enlace del correo apunta a la encuesta de atención, y puede abrirse con la sesión
 * vencida. En ese caso la app arranca en el login y, cuando el NavigationContainer ya está montado,
 * el árbol de pantallas cambia entero: la ruta que traía la URL se pierde. Por eso el destino se
 * recuerda al arrancar y se navega recién cuando hay sesión. */
const parseSurveyToken = (url) => {
    if (!url) return null;
    const match = /OrganizationFeedbackSurvey\?.*token=([A-Za-z0-9-]+)/.exec(url);
    return match ? match[1] : null;
};

const App = () => {
    const [user, setUser] = useState('');
    const [userRole, setUserRole] = useState('');
    const [sessionLoading, setSessionLoading] = useState(true);
    const navigationRef = useNavigationContainerRef();
    const [navigationReady, setNavigationReady] = useState(false);
    const [pendingSurveyToken, setPendingSurveyToken] = useState(null);
    const [ fontsLoaded ] = useFonts({
        'PlusJakartaSans-Bold': require('./assets/fonts/PlusJakartaSans-Bold.ttf'),
        'PlusJakartaSans-Regular': require('./assets/fonts/PlusJakartaSans-Regular.ttf')
    });

    useEffect(() => {
        const restoreSession = async () => {
            try {
                const [token, raw] = await Promise.all([
                    AsyncStorage.getItem('jwt'),
                    AsyncStorage.getItem('user'),
                ]);
                if (token && isJwtValid(token)) {
                    setUser(token);
                    if (raw) setUserRole(JSON.parse(raw).role);
                } else if (token) {
                    await clearSession();
                }
            } catch (e) {
                if (__DEV__) console.warn('restoreSession error:', e);
            } finally {
                setSessionLoading(false);
            }
        };
        restoreSession();
    }, []);

    /* EU-374: se anota a qué encuesta apuntaba el enlace, antes de saber si hay sesión.
     *
     * Son DOS caminos, no uno. `getInitialURL` devuelve la URL con la que se ABRIÓ la app, y sirve
     * sólo si estaba cerrada. Si ya estaba abierta —lo más común en el celular: se toca el enlace
     * del correo con la app en segundo plano— la URL llega por el evento `url` y `getInitialURL`
     * devuelve null. En web no se nota, porque ahí cada apertura es una carga de página nueva. */
    useEffect(() => {
        let cancelled = false;
        Linking.getInitialURL()
            .then((url) => {
                const token = parseSurveyToken(url);
                if (!cancelled && token) setPendingSurveyToken(token);
            })
            .catch(() => {});
        const subscription = Linking.addEventListener('url', ({ url }) => {
            const token = parseSurveyToken(url);
            if (token) setPendingSurveyToken(token);
        });
        return () => {
            cancelled = true;
            subscription?.remove?.();
        };
    }, []);

    // Con sesión iniciada y la navegación montada, se cae directamente en la encuesta. Si la persona
    // ya estaba logueada, React Navigation la lleva sola y esto no cambia nada.
    useEffect(() => {
        if (!user || !pendingSurveyToken || !navigationReady) return;
        navigationRef.navigate('OrganizationFeedbackSurvey', { token: pendingSurveyToken });
        setPendingSurveyToken(null);
    }, [user, pendingSurveyToken, navigationReady, navigationRef]);

    if (!fontsLoaded || sessionLoading) return (<View></View>);

    return (
        <>
            <NavigationContainer ref={navigationRef} linking={linking} onReady={() => setNavigationReady(true)}>
                <LoginContext.Provider value={{ setUser, user, userRole, setUserRole }}>
                    <AxiosSetup />
                    {user ? <EurekappTab /> : <AuthStackScreen />}
                </LoginContext.Provider>
            </NavigationContainer>
            <Toast config={toastConfig} />
        </>
    );
}

export default App;
