import Constants from 'expo-constants';
import axiosInstance from '../utils/axiosInstance';

const BACK_URL = Constants.expoConfig.extra.backUrl;

export default async function submitFeedback({ organizationId, foundObjectUUID, starRating, wasFound, comment, lostObjectText }) {
    await axiosInstance.post(
        `${BACK_URL}/feedback`,
        { organizationId, foundObjectUUID: foundObjectUUID || null, starRating, wasFound, comment: comment || null, lostObjectText: lostObjectText || null });
}
