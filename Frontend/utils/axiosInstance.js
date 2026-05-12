import axios from 'axios';

const axiosInstance = axios.create();

export function setupAxiosInterceptors(logoutFn) {
    axiosInstance.interceptors.response.use(
        (response) => response,
        (error) => {
            if (error?.response?.status === 401) {
                logoutFn();
            }
            return Promise.reject(error);
        }
    );
}

export default axiosInstance;
