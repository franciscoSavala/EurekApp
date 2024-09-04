import {ActivityIndicator, FlatList, StyleSheet, View} from "react-native";
import {Controller, useForm} from "react-hook-form";
import {Input, Text} from "react-native-elements";
import React, {useState} from "react";
import EurekappButton from "../components/Button";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import Constants from "expo-constants";
import Icon from "react-native-vector-icons/FontAwesome6";

const BACK_URL = Constants.expoConfig.extra.backUrl;

const ReturnObjectForm = ({ route, navigation}) => {
    const { control,
        handleSubmit,
        formState: {errors},
        setValue,
        getValues ,
        setError} = useForm();
    const [ loading, setLoading ] = useState(false);
    const [ responseOk, setResponseOk ] = useState(false);
    const [ buttonWasPressed, setButtonWasPressed ] = useState(false);
    const { objectId } = route.params;

    const onSubmit = async () => {
        setButtonWasPressed(true);
        const ownerUsername = getValues('ObjectOwnerUsername');
        const dni = getValues('Dni');
        const phone = getValues('Phone');
        setLoading(true);
        const institute = {
            id: await AsyncStorage.getItem('org.id')
        };
        if(institute.id == null) return;
        try {
            let authHeader = 'Bearer ' + await AsyncStorage.getItem('jwt');
            let config = {
                headers: {
                    'Authorization': authHeader
                }
            }
            let res = await axios.post(`${BACK_URL}/found-objects/return/${institute.id}`,
                {
                    username: ownerUsername,
                    dni: dni,
                    phone_number: phone,
                    found_object_uuid: objectId,
                }, config );
            console.log(res.data);
            setResponseOk(true);
        } catch (error) {
            setResponseOk(false);
            setError('ObjectOwnerUsername', {
                type: 'manual',
                message: error.response.data.message
            })
        } finally {
            setLoading(false);
        }
    }

    const StatusComponent = () => {
        return(
            <View>
                {buttonWasPressed ? (
                    loading ? (
                        <ActivityIndicator style={{marginVertical: 10}} size="large" color="#111818" />
                    ) : (
                        responseOk ? (
                            <Icon style={{marginVertical: 10}} name={'circle-check'} size={50} color={'#008000'}/>
                        ) : (
                            <Icon style={{marginVertical: 10}} name={'circle-xmark'} size={50} color={'#ED4337'}/>
                        )
                    )
                ) : null
                }
            </View>
        );
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
                        required: {value: true, message: 'Se requiere el nombre del usuario'}
                    }}
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
                <StatusComponent />

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