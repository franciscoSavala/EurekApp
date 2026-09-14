import React from 'react';
import {
    View,
    StyleSheet, TextInput, TouchableOpacity
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { Input, Text, Button } from 'react-native-elements';
import useUser from '../../../hooks/useUser';
import SocialAuthButtons from './SocialAuthButtons';
import InfoModal from '../../components/InfoModal';
import PasswordInput from '../../components/PasswordInput';

/* EU-406: el ancho y los márgenes van aparte del resto porque el campo de contraseña los necesita
   en su contenedor, no en el campo: el ojo se para contra el borde derecho del contenedor. */
const FIELD_LAYOUT = { width: '80%', maxWidth: 300, marginHorizontal: 10 };

const INPUT_LOOK = {
    color: 'white',
    borderBottomWidth: 1,
    borderBottomColor: 'white',
    fontSize: 16,
    paddingHorizontal: 5,
    paddingVertical: 10,
};

export default function LoginForm(props) {
    const { isLoginLoading, hasLoginError, loginErrorCode, loginErrorMessage, login, isLogged, clearLoginError, clearLoginErrorDelayed } = useUser();
    const { control,
        handleSubmit,
        formState: {errors},
        setValue,
        getValues } = useForm();

    /* EU-406: sin contraseñas. La única que había en este formulario ahora es un PasswordInput, y
       dejar acá la opción de ocultar el texto invitaba a volver a poner una sin el ojo. */
    const InputLogin = ({text, valueName, value,
                            autoComplete = 'off', keyboardType = 'default'}) => {
        return (
            <TextInput
                placeholder={text}
                placeholderTextColor={'rgba(255,255,255,0.6)'}
                onChangeText={(value) => setValue(valueName, value)}
                value={value}
                autoComplete={autoComplete}
                keyboardType={keyboardType}
                accessibilityLabel={text}
                style={[INPUT_LOOK, FIELD_LAYOUT]}
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
                                keyboardType={'email-address'}/>
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
                    <PasswordInput
                        placeholder='Contraseña'
                        placeholderTextColor={'rgba(255,255,255,0.6)'}
                        onChangeText={(text) => setValue('Password', text)}
                        value={value}
                        accessibilityLabel='Contraseña'
                        containerStyle={FIELD_LAYOUT}
                        style={INPUT_LOOK}
                    />
                )}
                name='Password'
                rules={{ required: { value: true, message: 'Contraseña requerida' } }}
                defaultValue=''
            />
            {errors.Password && (
                <Text style={styles.textError}>{errors.Password.message}</Text>
            )}

            {hasLoginError && loginErrorCode !== 'org_deactivated' && loginErrorCode !== 'user_deactivated' && (
                <Text style={styles.textError}>
                    {loginErrorMessage || 'No se pudo iniciar sesión. Intentá de nuevo.'}
                </Text>
            )}

            <InfoModal
                visible={hasLoginError && loginErrorCode === 'org_deactivated'}
                onClose={clearLoginErrorDelayed}
                type="error"
                title="Organización suspendida"
                message={loginErrorMessage}
                confirmLabel="Entendido"
            />

            <InfoModal
                visible={hasLoginError && loginErrorCode === 'user_deactivated'}
                onClose={clearLoginErrorDelayed}
                type="error"
                title="Cuenta desactivada"
                message={loginErrorMessage}
                confirmLabel="Entendido"
            />

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

            <TouchableOpacity style={styles.linkButton} onPress={() => props.nav.navigate('ForgotPasswordScreen')}>
                <Text style={styles.linkButtonText}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>

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
