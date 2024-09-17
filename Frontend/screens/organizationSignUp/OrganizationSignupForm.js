import {Controller, useForm} from "react-hook-form";
import React, {useState} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import {ActivityIndicator, StyleSheet, TextInput, View} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome6";
import {Input, Text} from "react-native-elements";
import EurekappButton from "../components/Button";
import Constants from "expo-constants";

const BACK_URL = Constants.expoConfig.extra.backUrl;

const OrganizationSignupForm = () => {
    const { control,
        handleSubmit,
        formState: {errors},
        setValue,
        getValues ,
        setError} = useForm();
    const [ loading, setLoading ] = useState(false);
    const [ responseOk, setResponseOk ] = useState(false);
    const [ buttonWasPressed, setButtonWasPressed ] = useState(false);

    const onSubmit = async () => {
        setButtonWasPressed(true);
        const organizationEmail = getValues('OrganizationEmail');
        const requestData = getValues('RequestData');
        setLoading(true);
        try {
            let authHeader = 'Bearer ' + await AsyncStorage.getItem('jwt');
            let config = {
                headers: {
                    'Authorization': authHeader
                }
            }
            let res = await axios.post(`${BACK_URL}/organizations`,
                {
                    contact_email: organizationEmail,
                    request_data: requestData,
                }, config );
            console.log(res.data);
            setResponseOk(true);
        } catch (error) {
            setResponseOk(false);
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
                            <View style={{alignItems: 'center'}}>
                                <Icon style={{marginVertical: 10}} name={'circle-check'} size={50} color={'#008000'}/>
                                <Text style={{fontSize: 16, fontFamily: 'PlusJakartaSans-Regular', textAlign: 'center'}}>
                                    Te contactaremos cuando validemos tu información</Text>
                            </View>
                        ) : (
                            <Icon style={{marginVertical: 10}} name={'circle-xmark'} size={50} color={'#ED4337'}/>
                        )
                    )
                ) : null
                }
            </View>
        );
    }

    const InputForm = ({text, valueName, value, autoComplete = 'off',
                           keyboardType = 'default', extraStyle = {}}) => {
        return (
            <TextInput
                placeholder={text}
                placeholderTextColor={'#638888'}
                onChangeText={(value) => setValue(valueName, value)}
                value={value}
                style={[styles.textArea, extraStyle]}
                renderErrorMessage={false}
                autoComplete={autoComplete}
                keyboardType={keyboardType}
            />
        );
    }

    return (
        <View style={styles.container}>
            <View style={{marginHorizontal: 10, flex: 1}}>
                <View style={styles.formContainer}>
                    <Text style={styles.label}>Email</Text>
                    <Controller
                        control={control}
                        render={({onChange, value}) => (
                            <InputForm
                                text='Escribe tu email'
                                valueName='OrganizationEmail'
                                value={value}
                                autoComplete={'email'}
                                keyboardType={'email-address'}
                                />
                        )}
                        name='OrganizationEmail'
                        rules={{
                            required: { value: true, message: 'Se requiere el email de contacto'},
                            pattern: { value: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, message: 'El email no es válido'}
                        }}
                        defaultValue='' />
                    <Text style={styles.textError}>{errors.OrganizationEmail
                        ? errors.OrganizationEmail.message
                        : " "
                    }</Text>
                    <Text style={styles.label}>Motivo</Text>
                    <Controller
                        control={control}
                        render={({onChange, value}) => (
                            <InputForm
                                text='Escribe un motivo para tu solicitud'
                                valueName='RequestData'
                                value={value}
                                extraStyle={{height: 200, textAlignVertical: 'top', paddingTop: 10}}/>
                        )}
                        name='RequestData'
                        rules={{
                            required: { value: true, message: 'Se requiere ingresar un motivo' },
                        }}
                        defaultValue='' />
                    <Text style={styles.textError}>{errors.RequestData ? errors.RequestData.message : " "}</Text>
                    <StatusComponent />
                </View>
                <EurekappButton text={'Subir solicitud'} onPress={handleSubmit(onSubmit)}/>
            </View>
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
        alignItems: 'center'
    },
    textError: {
        color: '#000',
    },
    input: {
        textAlignVertical: 'top',
    },
    textArea: {
        resize: 'none',
        overflow: 'hidden',
        alignSelf: 'stretch',
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
        marginHorizontal: 10,
    },
    label: {
        alignSelf: 'flex-start',
        marginLeft: 10,
        color: '#111818',
        fontSize: 16,
        fontWeight: '500',
        fontFamily: 'PlusJakartaSans-Regular'
    },
});
export default OrganizationSignupForm;