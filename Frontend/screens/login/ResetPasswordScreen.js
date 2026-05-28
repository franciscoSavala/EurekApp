import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ImageBackground,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Image } from 'react-native-elements';
import axiosInstance from '../../utils/axiosInstance';
import Constants from 'expo-constants';

const BACK_URL = Constants.expoConfig.extra.backUrl;

const PASSWORD_REGEX = /^(?=.*[0-9])(?=.*[a-zA-Z])(?=.*[@#$%^&+=!]).*$/;

const ResetPasswordScreen = ({ navigation, route }) => {
    const email = route?.params?.email || '';
    const [token, setToken] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const showAlert = (msg) => {
        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert('', msg);
    };

    const validate = () => {
        if (!token.trim() || token.trim().length !== 6) {
            setErrorMessage('El código debe tener 6 dígitos.');
            return false;
        }
        if (newPassword.length < 8) {
            setErrorMessage('La contraseña debe tener al menos 8 caracteres.');
            return false;
        }
        if (!PASSWORD_REGEX.test(newPassword)) {
            setErrorMessage('La contraseña debe contener letras, números y al menos un carácter especial (@#$%^&+=!).');
            return false;
        }
        if (newPassword !== confirmPassword) {
            setErrorMessage('Las contraseñas no coinciden.');
            return false;
        }
        return true;
    };

    const handleReset = async () => {
        setErrorMessage('');
        setSuccessMessage('');
        if (!validate()) return;

        setLoading(true);
        try {
            await axiosInstance.post(`${BACK_URL}/reset-password`, {
                email,
                token: token.trim(),
                newPassword,
            });
            setSuccessMessage('¡Contraseña cambiada exitosamente!');
            setTimeout(() => navigation.navigate('LoginScreen'), 2000);
        } catch (error) {
            const code = error?.response?.data?.code;
            if (code === 'password_reset_token_expired') {
                setErrorMessage('El código expiró. Solicitá uno nuevo.');
            } else if (code === 'password_reset_token_invalid') {
                setErrorMessage('El código es incorrecto. Verificá y volvé a intentarlo.');
            } else {
                setErrorMessage(error?.response?.data?.message || 'No se pudo cambiar la contraseña. Intentá de nuevo.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        setResending(true);
        setErrorMessage('');
        try {
            await axiosInstance.post(`${BACK_URL}/forgot-password`, { email });
            showAlert('Código reenviado. Revisá tu correo.');
        } catch (e) {
            setErrorMessage('No se pudo reenviar el código.');
        } finally {
            setResending(false);
        }
    };

    return (
        <ImageBackground source={{ uri: 'https://picsum.photos/200/300' }} style={styles.image}>
            <View style={styles.overlay}>
                <View style={styles.logoContainer}>
                    <Image
                        source={require('../../assets/icon-eurekapp.png')}
                        style={{ width: 70, height: 70 }}
                    />
                </View>

                <View style={styles.formContainer}>
                    <Text style={styles.title}>Nueva contraseña</Text>
                    <Text style={styles.subtitle}>
                        Ingresá el código de 6 dígitos enviado a {'\n'}
                        <Text style={{ fontWeight: 'bold' }}>{email}</Text>
                    </Text>

                    <TextInput
                        placeholder="Código (6 dígitos)"
                        placeholderTextColor="rgba(255,255,255,0.6)"
                        value={token}
                        onChangeText={setToken}
                        keyboardType="numeric"
                        maxLength={6}
                        style={styles.input}
                    />
                    <TextInput
                        placeholder="Nueva contraseña"
                        placeholderTextColor="rgba(255,255,255,0.6)"
                        value={newPassword}
                        onChangeText={setNewPassword}
                        secureTextEntry
                        style={styles.input}
                    />
                    <TextInput
                        placeholder="Confirmar contraseña"
                        placeholderTextColor="rgba(255,255,255,0.6)"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry
                        style={styles.input}
                    />

                    {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
                    {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}

                    <TouchableOpacity style={styles.button} onPress={handleReset} disabled={loading}>
                        {loading
                            ? <ActivityIndicator color="#017575" />
                            : <Text style={styles.buttonText}>Cambiar contraseña</Text>}
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.linkButton} onPress={handleResend} disabled={resending}>
                        <Text style={styles.linkText}>
                            {resending ? 'Reenviando...' : 'Reenviar código'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.linkButton} onPress={() => navigation.navigate('LoginScreen')}>
                        <Text style={styles.linkText}>Volver al inicio de sesión</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </ImageBackground>
    );
};

const styles = StyleSheet.create({
    image: { flex: 1, resizeMode: 'cover' },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(25,165,230,0.5)',
        justifyContent: 'space-evenly',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    logoContainer: { alignItems: 'center' },
    formContainer: { width: '100%', maxWidth: 360, alignItems: 'center' },
    title: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 22,
        textAlign: 'center',
        fontFamily: 'PlusJakartaSans-Bold',
        marginBottom: 8,
    },
    subtitle: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 14,
        textAlign: 'center',
        fontFamily: 'PlusJakartaSans-Regular',
        marginBottom: 16,
    },
    input: {
        color: 'white',
        borderBottomWidth: 1,
        borderBottomColor: 'white',
        width: '80%',
        fontSize: 16,
        paddingHorizontal: 5,
        paddingVertical: 10,
        marginHorizontal: 10,
        marginBottom: 8,
    },
    errorText: { color: 'white', marginBottom: 8, textAlign: 'center' },
    successText: { color: '#b9f6ca', marginBottom: 8, textAlign: 'center', fontWeight: 'bold' },
    button: {
        backgroundColor: 'white',
        width: 200,
        marginTop: 16,
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
    },
    buttonText: {
        color: '#017575',
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 16,
    },
    linkButton: { marginTop: 14 },
    linkText: {
        color: 'white',
        fontFamily: 'PlusJakartaSans-Regular',
        textDecorationLine: 'underline',
        fontSize: 14,
    },
});

export default ResetPasswordScreen;
