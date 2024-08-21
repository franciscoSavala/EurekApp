import React from 'react';
import {
    View,
    StyleSheet
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { Input, Icon, Text, Item, Button } from 'react-native-elements';
import useUser from '../../../hooks/useUser';

export default function LoginForm(props) {
    const { isLoginLoading, hasLoginError, login, isLogged } = useUser();
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
        const username = getValues('Username');
        const password = getValues('Password');

        login({ username, password });
    };

    return (
        <View style={styles.loginContainer}>
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
