import Constants from 'expo-constants';
import axiosInstance from '../utils/axiosInstance';

const BACK_URL = Constants.expoConfig.extra.backUrl;

export default async function submitUsabilityFeedback({ starRating, aspects, comment, context }) {
    await axiosInstance.post(
        `${BACK_URL}/usability-feedback`,
        { starRating, aspects: aspects || [], comment: comment || null, context: context || null });
}
