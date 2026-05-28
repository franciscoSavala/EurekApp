import React, { useState } from 'react';
import {
    ActivityIndicator,
    ImageBackground,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    Alert,
} from 'react-native';
import { Image } from 'react-native-elements';
import axiosInstance from '../../utils/axiosInstance';
import Constants from 'expo-constants';

const BACK_URL = Constants.expoConfig.extra.backUrl;

const ForgotPasswordScreen = ({ navigation }) => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const showAlert = (msg) => {
        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert('', msg);
    };

    const handleSend = async () => {
        if (!email.trim()) {
            setErrorMessage('Ingresá tu email.');
            return;
        }
        setLoading(true);
        setErrorMessage('');
        try {
            await axiosInstance.post(`${BACK_URL}/forgot-password`, { email: email.trim() });
            navigation.navigate('ResetPasswordScreen', { email: email.trim() });
        } catch (error) {
            const msg = error?.response?.data?.message || 'No se encontró una cuenta con ese email.';
            setErrorMessage(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ImageBackground source={{ uri: 'https://picsum.photos/200/300' }} style={styles.image}>
            <View style={styles.overlay}>
                <View style={styles.logoContainer}>
                    <Image
                        source={require('../../assets/icon-eurekapp.png')}
                        style={{ width: 80, height: 80 }}
                    />
                </View>

                <View style={styles.formContainer}>
                    <Text style={styles.title}>Recuperar contraseña</Text>
                    <Text style={styles.subtitle}>
                        Ingresá el email de tu cuenta y te enviaremos un código para restablecer tu contraseña.
                    </Text>

                    <TextInput
                        placeholder="Email"
                        placeholderTextColor="rgba(255,255,255,0.6)"
                        value={email}
                        onChangeText={setEmail}
                        autoComplete="email"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        style={styles.input}
                    />

                    {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

                    <TouchableOpacity
                        style={styles.button}
                        onPress={handleSend}
                        disabled={loading}
                    >
                        {loading
                            ? <ActivityIndicator color="#017575" />
                            : <Text style={styles.buttonText}>Enviar código</Text>}
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.linkButton} onPress={() => navigation.goBack()}>
                        <Text style={styles.linkText}>Volver</Text>
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
        marginBottom: 20,
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
    linkButton: { marginTop: 16 },
    linkText: {
        color: 'white',
        fontFamily: 'PlusJakartaSans-Regular',
        textDecorationLine: 'underline',
        fontSize: 14,
    },
});

export default ForgotPasswordScreen;
