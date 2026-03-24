import Constants from "expo-constants";

const BACK_URL = Constants.expoConfig.extra.backUrl;

export default function register({ firstname, lastname, username, password }) {
    return fetch(`${BACK_URL}/signup`, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ firstname, lastname, username, password }),
        redirect: 'follow',
    })
        .then(async (res) => {
            if (!res.ok) {
                let message = 'Ha ocurrido un error, intente de nuevo más tarde';
                try {
                    const data = await res.json();
                    if (data?.message) message = data.message;
                } catch (_) {}
                throw new Error(message);
            }
            return res.json();
        });
}
