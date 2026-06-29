import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from 'react-native-elements';
import Toast from 'react-native-toast-message';
import * as Google from 'expo-auth-session/providers/google';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import useUser from '../../../hooks/useUser';
import InfoModal from '../../components/InfoModal';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID      = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const GOOGLE_IOS_CLIENT_ID      = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const GOOGLE_ANDROID_CLIENT_ID  = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;

export default function SocialAuthButtons() {
    const { loginWithSocial, isLoginLoading, hasLoginError, loginErrorCode, loginErrorMessage, clearLoginError } = useUser();
    const [modalVisible, setModalVisible] = useState(false);

    const [googleRequest, googleResponse, promptGoogle] = Google.useAuthRequest({
        clientId:        GOOGLE_WEB_CLIENT_ID,
        iosClientId:     GOOGLE_IOS_CLIENT_ID,
        androidClientId: GOOGLE_ANDROID_CLIENT_ID,
        redirectUri:     AuthSession.makeRedirectUri({ useProxy: true }),
    });

    React.useEffect(() => {
        if (googleResponse?.type === 'success') {
            const accessToken = googleResponse.authentication?.accessToken;
            if (accessToken) loginWithSocial({ provider: 'GOOGLE', idToken: accessToken });
        }
    }, [googleResponse]);

    React.useEffect(() => {
        if (!hasLoginError) return;
        if (loginErrorCode === 'user_deactivated' || loginErrorCode === 'org_deactivated') {
            setModalVisible(true);
        } else {
            Toast.show({ type: 'error', text1: 'Error', text2: loginErrorMessage || 'No se pudo iniciar sesión con Google.' });
            clearLoginError();
        }
    }, [hasLoginError]);

    const handleModalClose = () => {
        setModalVisible(false);
        clearLoginError();
    };

    const modalTitle = loginErrorCode === 'org_deactivated' ? 'Organización suspendida' : 'Cuenta desactivada';

    return (
        <View style={styles.container}>
            <Text style={styles.divider}>— o continuá con —</Text>
            <TouchableOpacity
                style={[styles.btn, styles.googleBtn]}
                onPress={() => promptGoogle()}
                disabled={!googleRequest || isLoginLoading}
            >
                <Text style={styles.googleBtnText}>Continuar con Google</Text>
            </TouchableOpacity>
            <InfoModal
                visible={modalVisible}
                onClose={handleModalClose}
                type="error"
                title={modalTitle}
                message={loginErrorMessage}
                confirmLabel="Entendido"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        marginTop: 16,
        width: '100%',
    },
    divider: {
        color: 'rgba(255,255,255,0.7)',
        marginBottom: 12,
        fontFamily: 'PlusJakartaSans-Regular',
    },
    btn: {
        width: 200,
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 10,
    },
    googleBtn: {
        backgroundColor: 'white',
    },
    googleBtnText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 14,
        color: '#017575',
    },
});
