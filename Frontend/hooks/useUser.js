import {useState, useCallback, useContext, createContext} from 'react';
import loginService from '../services/LoginService';
import registerService from '../services/RegisterService';

import AsyncStorage from '@react-native-async-storage/async-storage';

export const LoginContext = createContext();

export default function useUser(callback, deps) {
    // Creamos el contexto de nuestra aplicación
    const { setUser } = useContext(LoginContext);
    //Utilizamos el estado para poder saber si está o no cargando
    const [state, setState] = useState({
        loading: false,
        error: false,
        errorMessage: '',
        logged: true,
    });

    const logout = useCallback(async () => {
        try {
            await AsyncStorage.removeItem('org.name');
            await AsyncStorage.removeItem('org.id');
            await AsyncStorage.removeItem('jwt');
            //await AsyncStorage.removeItem('username');
            setState({loading: false, error: false, logged: false});
            setUser(null);
        } catch (error) {
            console.error('Error al hacer logout:', error);
            setState({loading: false, error: true, logged: true});
        }
    }, [])

    const login = useCallback(
        ({ username, password }) => {
            loginService({ username, password })
                .then(async (userContext) => {
                    try {
                        const organization = userContext.organization;
                        await AsyncStorage.setItem('jwt', userContext.token);
                        await AsyncStorage.setItem('username', username);
                        await AsyncStorage.setItem('user.first_name', userContext.user.firstName.toString());
                        await AsyncStorage.setItem('user', JSON.stringify(userContext.user));
                        if(organization != null) {
                            await AsyncStorage.setItem('org.id', organization.id.toString());
                            await AsyncStorage.setItem('org.name', organization.name);
                            await AsyncStorage.setItem('organization', JSON.stringify(organization));
                        }else{
                            await AsyncStorage.removeItem('org.id');
                            await AsyncStorage.removeItem('org.name');
                            await AsyncStorage.removeItem('organization');
                        }
                        setUser(userContext.token);
                        setState({ loading: false, error: false, logged: true });
                    } catch (e) {
                        console.error('Error guardando sesión:', e);
                    }
                })
                .catch((err) => {
                    setState({ loading: false, error: true, errorMessage: err.message, logged: false });
                });
        },
        [setUser, setState]
    );

    const register = useCallback(
        ({ firstname, lastname, username, password }) => {
            registerService({ firstname, lastname, username, password })
                .then(async (userContext) => {
                    try {
                        const organization = userContext.organization;
                        await AsyncStorage.setItem('jwt', userContext.token);
                        await AsyncStorage.setItem('username', username);
                        await AsyncStorage.setItem('user.first_name', userContext.user.firstName.toString());
                        await AsyncStorage.setItem('user', JSON.stringify(userContext.user));
                        if(organization != null) {
                            await AsyncStorage.setItem('org.id', organization.id.toString());
                            await AsyncStorage.setItem('org.name', organization.name);
                            await AsyncStorage.setItem('organization', JSON.stringify(organization));
                        }else{
                            await AsyncStorage.removeItem('org.id');
                            await AsyncStorage.removeItem('org.name');
                            await AsyncStorage.removeItem('organization');
                        }
                        setUser(userContext.token);
                        setState({ loading: false, error: false, logged: true });
                    } catch (e) {
                        console.error('Error guardando sesión:', e);
                    }
                })
                .catch((err) => {
                    setState({ loading: false, error: true, errorMessage: err.message, logged: false });
                });
        },
        [setUser, setState]
    );

    return {
        isLogged: state.logged,
        isLoginLoading: state.loading,
        hasLoginError: state.error,
        loginErrorMessage: state.errorMessage,
        login,
        logout,
        register
    };
}
