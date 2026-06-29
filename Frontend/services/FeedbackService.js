import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosInstance from '../utils/axiosInstance';

const BACK_URL = Constants.expoConfig.extra.backUrl;

export default async function submitFeedback({ organizationId, foundObjectUUID, starRating, wasFound, comment, lostObjectText }) {
    const jwt = await AsyncStorage.getItem('jwt');
    await axiosInstance.post(
        `${BACK_URL}/feedback`,
        { organizationId, foundObjectUUID: foundObjectUUID || null, starRating, wasFound, comment: comment || null, lostObjectText: lostObjectText || null },
        { headers: { Authorization: `Bearer ${jwt}` } }
    );
}
