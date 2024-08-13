import { useState, useCallback, useContext } from 'react';
import loginService from '../services/LoginService';

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as CONSTANTS from '../App';

export default function useUser() {
    // Creamos el contexto de nuestra aplicación
    const { setUser } = useContext(CONSTANTS.LoginContext);
    //Utilizamos el estado para poder saber si está o no cargando
    const [state, setState] = useState({
        loading: true,
        error: false,
        logged: true,
    });

    const login = useCallback(
        ({ username, password }) => {
            loginService({ username, password })
                .then(async (userContext) => {
                    try {
                        await AsyncStorage.setItem('jwt', userContext.token);
                        const organization = userContext.organization;
                        if(organization != null) {
                            await AsyncStorage.setItem('org.id', organization.id);
                            await AsyncStorage.setItem('org.name', organization.name);
                        }
                        setUser(userContext.token);
                        setState({ loading: true, error: false, logged: true });
                    } catch (e) {
                        alert('error');
                    }
                })
                .catch((err) => {
                    setState({ loading: false, error: true, logged: false });
                    alert(err);
                });
        },
        [setUser, setState]
    );

    return {
        isLogged: state.logged,
        isLoginLoading: state.loading,
        hasLoginError: state.error,
        login,
    };
}
