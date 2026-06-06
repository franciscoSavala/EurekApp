import axios from 'axios';
import Toast from 'react-native-toast-message';

const axiosInstance = axios.create();

export function setupAxiosInterceptors(logoutFn) {
    axiosInstance.interceptors.response.use(
        (response) => response,
        (error) => {
            if (error?.response?.status === 401) {
                const errorCode = error?.response?.data?.error;
                if (errorCode === 'org_deactivated') {
                    Toast.show({
                        type: 'error',
                        text1: 'Organización suspendida',
                        text2: 'Tu organización fue desactivada por el administrador.',
                        visibilityTime: 4000,
                    });
                }
                logoutFn();
            }
            return Promise.reject(error);
        }
    );
}

export default axiosInstance;
