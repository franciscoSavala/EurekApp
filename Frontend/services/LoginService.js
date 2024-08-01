import Constants from "expo-constants";
import {HttpStatusCode} from "axios";

const BACK_URL = Constants.expoConfig.extra.backUrl;
//SITIO WEB DE LA API https://reqres.in/
//Recibe por parametro un objeto con el username y nuestro password
export default function login({ username, password }) {
    return fetch(`${BACK_URL}/login`, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: username, password: password }),
        redirect: 'follow',
    })
        .then((res) => {
            console.log(res.status)
            if (res.status < 500 && res >= 400) throw new Error('Usuario o contraseña incorrectos');
            else if (!res.ok) throw new Error('Ha ocurrido un error, intente de nuevo más tarde');
            return res.json();
        })
        .then((response) => {
            //Recibimos un JWT
            const { token } = response;
            return token;
        });
}
