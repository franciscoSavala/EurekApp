import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosInstance from '../utils/axiosInstance';

const BACK_URL = Constants.expoConfig.extra.backUrl;

export default async function submitUsabilityFeedback({ starRating, aspects, comment, context }) {
    const jwt = await AsyncStorage.getItem('jwt');
    await axiosInstance.post(
        `${BACK_URL}/usability-feedback`,
        { starRating, aspects: aspects || [], comment: comment || null, context: context || null },
        { headers: { Authorization: `Bearer ${jwt}` } }
    );
}
