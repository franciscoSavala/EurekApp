import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from 'react-native-elements';
import * as Google from 'expo-auth-session/providers/google';
import * as Facebook from 'expo-auth-session/providers/facebook';
import * as WebBrowser from 'expo-web-browser';
import useUser from '../../../hooks/useUser';

WebBrowser.maybeCompleteAuthSession();

// Reemplazar con las credenciales reales obtenidas en Google Cloud Console y Meta for Developers
const GOOGLE_WEB_CLIENT_ID      = 'YOUR_GOOGLE_WEB_CLIENT_ID';
const GOOGLE_IOS_CLIENT_ID      = 'YOUR_GOOGLE_IOS_CLIENT_ID';
const GOOGLE_ANDROID_CLIENT_ID  = 'YOUR_GOOGLE_ANDROID_CLIENT_ID';
const FACEBOOK_APP_ID           = 'YOUR_FACEBOOK_APP_ID';

export default function SocialAuthButtons() {
    const { loginWithSocial, isLoginLoading } = useUser();

    const [googleRequest, googleResponse, promptGoogle] = Google.useAuthRequest({
        clientId:        GOOGLE_WEB_CLIENT_ID,
        iosClientId:     GOOGLE_IOS_CLIENT_ID,
        androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    });

    React.useEffect(() => {
        if (googleResponse?.type === 'success') {
            const idToken = googleResponse.authentication?.idToken;
            if (idToken) loginWithSocial({ provider: 'GOOGLE', idToken });
        }
    }, [googleResponse]);

    const [fbRequest, fbResponse, promptFacebook] = Facebook.useAuthRequest({
        clientId: FACEBOOK_APP_ID,
    });

    React.useEffect(() => {
        if (fbResponse?.type === 'success') {
            const accessToken = fbResponse.authentication?.accessToken;
            if (accessToken) loginWithSocial({ provider: 'FACEBOOK', idToken: accessToken });
        }
    }, [fbResponse]);

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
            <TouchableOpacity
                style={[styles.btn, styles.facebookBtn]}
                onPress={() => promptFacebook()}
                disabled={!fbRequest || isLoginLoading}
            >
                <Text style={styles.facebookBtnText}>Continuar con Facebook</Text>
            </TouchableOpacity>
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
    facebookBtn: {
        backgroundColor: '#1877F2',
    },
    googleBtnText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 14,
        color: '#017575',
    },
    facebookBtnText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 14,
        color: 'white',
    },
});
