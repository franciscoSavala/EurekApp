import {StyleSheet, View} from "react-native";
import {Controller, useForm} from "react-hook-form";
import {Input, Text} from "react-native-elements";
import React from "react";
import EurekappButton from "../components/Button";


const ReturnObjectForm = () => {
    const { control,
        handleSubmit,
        formState: {errors},
        setValue,
        getValues } = useForm();

    const onSubmit = () => {
        const ownerUsername = getValues('ObjectOwnerUsername');
        const dni = getValues('Dni');
        const phone = getValues('Phone');

        console.log(ownerUsername);
        console.log(dni);
        console.log(phone);
    }

    const InputForm = ({text, valueName, value }) => {
        return (
            <Input
                placeholder={text}
                placeholderTextColor={'#638888'}
                onChangeText={(value) => setValue(valueName, value)}
                value={value}
                inputContainerStyle={styles.textArea}
                labelStyle={{color: '#000'}}
                renderErrorMessage={false}
            />
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.formContainer}>
                <Controller
                    control={control}
                    render={({onChange, value}) => (
                        <InputForm
                            text='Nombre de usuario de dueño'
                            valueName='ObjectOwnerUsername'
                            value={value} />
                    )}
                    name='ObjectOwnerUsername'
                    rules={{
                        required: {value: true, message: 'Se requiere el nombre del usuario'}}}
                    defaultValue='' />
                <Text style={styles.textError}>{errors.ObjectOwnerUsername
                    ? errors.ObjectOwnerUsername.message
                    : " "
                }</Text>
                <Controller
                    control={control}
                    render={({onChange, value}) => (
                        <InputForm
                            text='DNI'
                            valueName='Dni'
                            value={value} />
                    )}
                    name='Dni'
                    rules={{
                        required: { value: true, message: 'Se requiere el documento' },
                        pattern: { value: /\d{7,8}/, message: 'Número de documento no válido'}
                    }}
                    defaultValue='' />
                <Text style={styles.textError}>{errors.Dni ? errors.Dni.message : " "}</Text>
                <Controller
                    control={control}
                    render={({onChange, value}) => (
                        <InputForm
                            text='Teléfono'
                            valueName='Phone'
                            value={value} />
                    )}
                    name='Phone'
                    rules={{pattern: { value: /\d+/, message: 'No es un número de teléfono'}}}
                    defaultValue='' />
                <Text style={styles.textError}>{errors.Phone ? errors.Phone.message : " "}</Text>
            </View>
            <EurekappButton text={'Registrar encuentro'} onPress={handleSubmit(onSubmit)}/>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'center',
        backgroundColor: '#fff',
    },
    formContainer: {
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'center',
    },
    textError: {
        color: '#000',
        marginBottom: 10,
    },
    textArea: {
        resize: 'none',
        overflow: 'hidden',
        borderRadius: 12,
        color: '#111818',
        backgroundColor: '#f0f4f4',
        fontSize: 16,
        fontWeight: 'normal',
        placeholderTextColor: '#638888',
        fontFamily: 'PlusJakartaSans-Regular',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderBottomWidth: 0,
    }
});

export default ReturnObjectForm;