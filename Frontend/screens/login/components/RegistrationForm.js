import React from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { Input, Text, Button } from 'react-native-elements';
import useUser from '../../../hooks/useUser';
import SocialAuthButtons from './SocialAuthButtons';

export default function RegistrationForm(props) {
    const { isLoginLoading, hasLoginError, loginErrorMessage, register } = useUser();
    const { control,
        handleSubmit,
        formState: {errors},
        setValue,
        getValues } = useForm();

    const InputLogin = ({text, valueName, value, secure = false}) => {
        return (
            <Input
                placeholder={text}
                placeholderTextColor={'rgba(255,255,255,0.6)'}
                onChangeText={(value) => setValue(valueName, value)}
                value={value}
                secureTextEntry={secure}
                inputContainerStyle={{
                    borderBottomWidth: 1,
                    borderBottomColor: 'white',
                }}
                style={{
                    color: 'white'
                }}
            />
        );
    }

    const onSubmit = (data) => {
        register({
            firstname: data.FirstName,
            lastname: data.LastName,
            username: data.Username,
            password: data.Password,
        });
    };

    return (
        <View style={styles.loginContainer}>
            <Controller
                control={control}
                render={({ onChange, onBlur, value }) => (
                    <InputLogin text='Nombre'
                                valueName='FirstName'
                                value={value}/>
                )}
                name='FirstName'
                rules={{
                    required: { value: true, message: 'El nombre es obligatorio.' },
                    maxLength: { value: 50, message: 'El nombre es demasiado largo.' },
                }}
                defaultValue=""
            />
            {errors.FirstName && (
                <Text style={styles.textError}>{errors.FirstName.message}</Text>
            )}

            <Controller
                control={control}
                render={({ onChange, onBlur, value }) => (
                    <InputLogin text='Apellido'
                                valueName='LastName'
                                value={value}/>
                )}
                name='LastName'
                rules={{
                    required: { value: true, message: 'El apellido es obligatorio.' },
                    maxLength: { value: 50, message: 'El apellido es demasiado largo.' },
                }}
                defaultValue=""
            />
            {errors.LastName && (
                <Text style={styles.textError}>{errors.LastName.message}</Text>
            )}

            <Controller
                control={control}
                render={({ onChange, onBlur, value }) => (
                    <InputLogin text='Email'
                                valueName='Username'
                                value={value}/>
                )}
                name='Username'
                rules={{
                    required: { value: true, message: 'La dirección de email es obligatoria.' },
                    pattern: {
                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                        message: 'Ingresá un email válido.',
                    },
                }}
                defaultValue=""
            />
            {errors.Username && (
                <Text style={styles.textError}>{errors.Username.message}</Text>
            )}

            <Controller
                control={control}
                render={({ onChange, value }) => (
                    <InputLogin text='Contraseña' valueName='Password' value={value} secure={true}/>
                )}
                name='Password'
                rules={{
                    required: { value: true, message: 'La contraseña es obligatoria.' },
                    minLength: { value: 6, message: 'La contraseña debe tener al menos 6 caracteres.' },
                }}
                defaultValue=''
            />
            {errors.Password && (
                <Text style={styles.textError}>{errors.Password.message}</Text>
            )}

            {hasLoginError && (
                <Text style={styles.textError}>
                    {loginErrorMessage || 'No se pudo crear la cuenta. Intentá de nuevo.'}
                </Text>
            )}

            <View style={styles.button}>
                <Button
                    buttonStyle={{
                        backgroundColor: 'white',
                        width: 200,
                        marginTop: 20,
                        borderRadius: 8
                    }}
                    titleStyle={{
                        color: '#017575',
                        fontFamily: 'PlusJakartaSans-Regular'
                    }}
                    title='Registrate'
                    loading={isLoginLoading}
                    disabled={isLoginLoading}
                    onPress={handleSubmit(onSubmit)}
                />
            </View>

            <SocialAuthButtons />
            <TouchableOpacity style={styles.backButton} onPress={() => props.nav.navigate('LoginScreen')}>
                <Text style={styles.backButtonText}>Ya tengo cuenta. Iniciar sesión</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    loginContainer: {
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 8,
        marginTop: 20,
    },
    textError: {
        color: 'white',
    },
    button: {
        alignItems: 'center',
    },
    backButton: {
        marginTop: 16,
    },
    backButtonText: {
        color: 'white',
        fontFamily: 'PlusJakartaSans-Regular',
        textDecorationLine: 'underline',
        fontSize: 14,
    },
});
