import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const BACK_URL = Constants.expoConfig.extra.backUrl;

export default async function submitFeedback({ organizationId, foundObjectUUID, starRating, wasFound, comment }) {
    const jwt = await AsyncStorage.getItem('jwt');
    await axios.post(
        `${BACK_URL}/feedback`,
        { organizationId, foundObjectUUID: foundObjectUUID || null, starRating, wasFound, comment: comment || null },
        { headers: { Authorization: `Bearer ${jwt}` } }
    );
}
