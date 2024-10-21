import React from 'react';
import {
    View,
    StyleSheet
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { Input, Icon, Text, Item, Button } from 'react-native-elements';
import useUser from '../../../hooks/useUser';

export default function RegistrationForm(props) {
    const { isLoginLoading, hasLoginError, register, isLogged } = useUser();
    const { control,
        handleSubmit,
        formState: {errors},
        setValue,
        getValues } = useForm();

    const InputLogin = ({text, valueName, value, secure = true}) => {
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

    const onSubmit = async (data) => {
        const firstname = getValues('FirstName');
        const lastname = getValues('LastName');
        const username = getValues('Username');
        const password = getValues('Password');

        register({ firstname, lastname, username, password });
    };

    return (
        <View style={styles.loginContainer}>
            <Controller
                control={control}
                render={({ onChange, onBlur, value }) => (
                    <InputLogin text='Nombre'
                                valueName='FirstName'
                                value={value}
                                secure={false}/>
                )}
                name='FirstName'
                rules={{
                    required: { value: true, message: 'El nombre es obligatorio.' },
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
                                value={value}
                                secure={false}/>
                )}
                name='LastName'
                rules={{
                    required: { value: true, message: 'El apellido es obligatorio.' },
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
                                value={value}
                                secure={false}/>
                )}
                name='Username'
                rules={{
                    required: { value: true, message: 'La dirección de email es obligatoria.' },
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
                rules={{ required: { value: true, message: 'La contraseña es obligatoria.' } }}
                defaultValue=''
            />
            {errors.Password && (
                <Text style={styles.textError}>{errors.Password.message}</Text>
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
                    onPress={handleSubmit(onSubmit)}
                />
            </View>
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
});
