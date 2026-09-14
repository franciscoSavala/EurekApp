import React, { useState } from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { Input, Text, Button } from 'react-native-elements';
import useUser from '../../../hooks/useUser';
import SocialAuthButtons from './SocialAuthButtons';
import { PasswordEye } from '../../components/PasswordInput';

/* EU-406: el campo de la contraseña, con el ojo para mostrar lo escrito.
 *
 * Va aparte del `InputLogin` que usan los demás campos porque necesita recordar si la contraseña
 * está a la vista, y `InputLogin` se vuelve a crear en cada dibujado del formulario: una memoria
 * adentro de él se borraría sola. Y va con el `Input` de react-native-elements, como sus vecinos,
 * para no quedar distinto justo en el medio del formulario; el ojo entra por `rightIcon`, que es
 * donde ese componente ubica lo que va a la derecha. */
const PasswordField = ({ text, value, onChangeText }) => {
    const [visible, setVisible] = useState(false);

    return (
        <Input
            placeholder={text}
            placeholderTextColor={'rgba(255,255,255,0.6)'}
            onChangeText={onChangeText}
            value={value}
            secureTextEntry={!visible}
            inputContainerStyle={{
                borderBottomWidth: 1,
                borderBottomColor: 'white',
            }}
            style={{
                color: 'white'
            }}
            rightIcon={
                <PasswordEye visible={visible} onPress={() => setVisible(!visible)} />
            }
        />
    );
};

export default function RegistrationForm(props) {
    const { isLoginLoading, hasLoginError, loginErrorMessage, register } = useUser();
    const { control,
        handleSubmit,
        formState: {errors},
        setValue,
        getValues } = useForm();

    /* EU-406: sin contraseñas. La de este formulario ahora es un PasswordField, y dejar acá la
       opción de ocultar el texto invitaba a volver a poner una sin el ojo. */
    const InputLogin = ({text, valueName, value}) => {
        return (
            <Input
                placeholder={text}
                placeholderTextColor={'rgba(255,255,255,0.6)'}
                onChangeText={(value) => setValue(valueName, value)}
                value={value}
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
                    <PasswordField
                        text='Contraseña'
                        value={value}
                        onChangeText={(text) => setValue('Password', text)}
                    />
                )}
                name='Password'
                rules={{
                    required: { value: true, message: 'La contraseña es obligatoria.' },
                    minLength: { value: 8, message: 'La contraseña debe tener entre 8 y 16 caracteres.' },
                    maxLength: { value: 16, message: 'La contraseña debe tener entre 8 y 16 caracteres.' },
                    pattern: {
                        value: /^(?=.*[0-9])(?=.*[a-zA-Z])(?=.*[@#$%^&+=!]).*$/,
                        message: 'La contraseña debe contener letras, números y al menos un carácter especial (@#$%^&+=!).',
                    },
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
