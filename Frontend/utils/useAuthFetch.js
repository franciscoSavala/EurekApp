import { useCallback, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosInstance from './axiosInstance';

const useAuthFetch = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const authFetch = useCallback(async (method, url, data = null) => {
        setLoading(true);
        setError(null);
        try {
            const jwt = await AsyncStorage.getItem('jwt');
            const config = { headers: { Authorization: `Bearer ${jwt}` } };
            const res = method === 'get'
                ? await axiosInstance.get(url, config)
                : method === 'put'
                ? await axiosInstance.put(url, data, config)
                : await axiosInstance.post(url, data, config);
            return res.data;
        } catch (e) {
            setError(e);
            throw e;
        } finally {
            setLoading(false);
        }
    }, []);

    return { authFetch, loading, error };
};

export default useAuthFetch;
