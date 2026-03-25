import React from 'react';
import {
    View,
    StyleSheet, TextInput, TouchableOpacity
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { Input, Icon, Text, Item, Button } from 'react-native-elements';
import useUser from '../../../hooks/useUser';
import SocialAuthButtons from './SocialAuthButtons';

export default function LoginForm(props) {
    const { isLoginLoading, hasLoginError, loginErrorMessage, login, isLogged } = useUser();
    const { control,
        handleSubmit,
        formState: {errors},
        setValue,
        getValues } = useForm();

    const InputLogin = ({text, valueName, value, secure = true,
                            autoComplete = 'off', keyboardType = 'default'}) => {
        return (
            <TextInput
                placeholder={text}
                placeholderTextColor={'rgba(255,255,255,0.6)'}
                onChangeText={(value) => setValue(valueName, value)}
                value={value}
                secureTextEntry={secure}
                autoComplete={autoComplete}
                keyboardType={keyboardType}
                style={{
                    color: 'white',
                    borderBottomWidth: 1,
                    borderBottomColor: 'white',
                    maxWidth: 300,
                    fontSize: 16,
                    paddingHorizontal: 5,
                    paddingVertical: 10,
                    marginHorizontal: 10,
                    width: '80%',
                }}
            />
        );
    }

    const onSubmit = (data) => {
        login({ username: data.Username, password: data.Password });
    };

    return (
        <View style={styles.loginContainer}>
            <Controller
                control={control}
                render={({ onChange, onBlur, value }) => (
                    <InputLogin text='Email'
                                valueName='Username'
                                value={value}
                                autoComplete={'email'}
                                keyboardType={'email-address'}
                                secure={false}/>
                )}
                name='Username'
                rules={{
                    required: { value: true, message: 'Email requerido' },
                }}
                defaultValue=""
            />
            {errors.Username && (
                <Text style={styles.textError}>{errors.Username.message}</Text>
            )}

            <Controller
                control={control}
                render={({ onChange, value }) => (
                    <InputLogin text='Contraseña' valueName='Password' value={value}/>
                )}
                name='Password'
                rules={{ required: { value: true, message: 'Contraseña requerida' } }}
                defaultValue=''
            />
            {errors.Password && (
                <Text style={styles.textError}>{errors.Password.message}</Text>
            )}

            {hasLoginError && (
                <Text style={styles.textError}>
                    {loginErrorMessage || 'No se pudo iniciar sesión. Intentá de nuevo.'}
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
                    title='Iniciar sesión'
                    loading={isLoginLoading}
                    disabled={isLoginLoading}
                    onPress={handleSubmit(onSubmit)}
                />
            </View>

            <TouchableOpacity style={styles.linkButton} onPress={() => props.nav.navigate('RegistrationScreen')}>
                <Text style={styles.linkButtonText}>¿No tenés cuenta? Registrate</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkButton} onPress={() => props.nav.goBack()}>
                <Text style={styles.linkButtonText}>Volver</Text>
            </TouchableOpacity>
            <SocialAuthButtons />
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
    linkButton: {
        marginTop: 16,
    },
    linkButtonText: {
        color: 'white',
        fontFamily: 'PlusJakartaSans-Regular',
        textDecorationLine: 'underline',
        fontSize: 14,
    },
});
