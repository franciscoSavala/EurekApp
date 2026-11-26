import Constants from 'expo-constants';
import axiosInstance from '../utils/axiosInstance';

const BACK_URL = Constants.expoConfig.extra.backUrl;

// La organización viaja siempre como número (id), o null si no hay.
const organizationIdNumerico = (valor) => {
    if (valor === null || valor === undefined || valor === '') return null;
    const n = Number(valor);
    return Number.isFinite(n) ? n : null;
};

export default async function submitFeedback({ organizationId, foundObjectUUID, starRating, wasFound, comment, lostObjectText }) {
    await axiosInstance.post(
        `${BACK_URL}/feedback`,
        { organizationId: organizationIdNumerico(organizationId), foundObjectUUID: foundObjectUUID || null, starRating, wasFound, comment: comment || null, lostObjectText: lostObjectText || null });
}
