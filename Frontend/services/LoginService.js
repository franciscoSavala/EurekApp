import Constants from "expo-constants";

const BACK_URL = Constants.expoConfig.extra.backUrl;

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
        .then(async (res) => {
            if (!res.ok) {
                let message = 'Usuario o contraseña incorrectos';
                try {
                    const data = await res.json();
                    if (data?.message) message = data.message;
                } catch (_) {}
                throw new Error(message);
            }
            return res.json();
        });
}
