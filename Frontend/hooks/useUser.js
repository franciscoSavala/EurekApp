import {useState, useCallback, useContext, createContext} from 'react';
import loginService from '../services/LoginService';

import AsyncStorage from '@react-native-async-storage/async-storage';

export const LoginContext = createContext();

export default function useUser() {
    // Creamos el contexto de nuestra aplicación
    const { setUser } = useContext(LoginContext);
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
                        const organization = userContext.organization;
                        await AsyncStorage.setItem('jwt', userContext.token);
                        if(organization != null) {
                            await AsyncStorage.setItem('org.id', organization.id.toString());
                            await AsyncStorage.setItem('org.name', organization.name);
                        }else{
                            await AsyncStorage.removeItem('org.id');
                            await AsyncStorage.removeItem('org.name');
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
