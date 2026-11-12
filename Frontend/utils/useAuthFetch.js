import { useCallback, useState } from 'react';
import axiosInstance from './axiosInstance';

const useAuthFetch = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const authFetch = useCallback(async (method, url, data = null) => {
        setLoading(true);
        setError(null);
        try {
            const res = method === 'get'
                ? await axiosInstance.get(url)
                : method === 'put'
                ? await axiosInstance.put(url, data)
                : await axiosInstance.post(url, data);
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
