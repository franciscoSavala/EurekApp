import Constants from 'expo-constants';
import axios from 'axios';

const BACK_URL = Constants.expoConfig.extra.backUrl;

export default async function socialLogin({ provider, idToken }) {
    const res = await axios.post(`${BACK_URL}/auth/social`, { provider, idToken });
    return res.data;
}
