import Constants from "expo-constants";

const BACK_URL = Constants.expoConfig.extra.backUrl;

export default function register({ username, password }) {
    return fetch(`${BACK_URL}/signup`, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: username, password: password }),
        redirect: 'follow',
    })
        .then((res) => {
            if (res.status < 500 && res >= 400) throw new Error('Usuario o contraseña incorrectos');
            else if (!res.ok) throw new Error('Ha ocurrido un error, intente de nuevo más tarde');
            return res.json();
        })
        .then((response) => {
            //Recibimos un JWT Dto con info de más
            return response;
        }).catch((e) => {
            console.error(e);
        });
}
