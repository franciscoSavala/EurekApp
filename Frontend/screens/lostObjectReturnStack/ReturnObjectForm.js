import {ActivityIndicator, FlatList, StyleSheet, TextInput, View} from "react-native";
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

    const InputForm = ({text, valueName, value , autoComplete = 'off', keyboardType = 'default'}) => {
        return (
            <TextInput
                placeholder={text}
                placeholderTextColor={'#638888'}
                onChangeText={(value) => setValue(valueName, value)}
                value={value}
                style={styles.textArea}
                renderErrorMessage={false}
                autoComplete={autoComplete}
                keyboardType={keyboardType}
            />
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.formContainer}>
                <View style={styles.explanatoryTextContainer}>
                    <Text style={[styles.label, {
                        fontSize: 13,
                        textAlign: 'left',
                        color: '#939393',
                        marginBottom: 10,
                    }]}>{"\n"}Por razones de seguridad, debes ingresar los siguientes datos de la persona a la que le entregarás el objeto. {"\n"}
                    </Text>
                </View>
                <Text style={styles.label}>Usuario de Eurekapp (email, opcional):</Text>
                <Controller
                    control={control}
                    render={({onChange, value}) => (
                        <InputForm
                            text='Ingresa el email del usuario'
                            valueName='ObjectOwnerUsername'
                            value={value}
                             />
                    )}
                    name='ObjectOwnerUsername'
                    rules={{
                        required: {value: false, message: ''}
                    }}
                    defaultValue='' />
                <Text style={styles.textError}>{errors.ObjectOwnerUsername
                    ? errors.ObjectOwnerUsername.message
                    : " "
                }</Text>


                <Text style={[styles.label, {
                    fontSize: 13,
                    textAlign: 'left',
                    color: '#939393',
                    marginBottom: 10,
                    }]}>{"\n"}Pídele a la persona que te deje ver su cédula de identidad.
                </Text>
                <Text style={styles.label}>DNI</Text>
                <Controller
                    control={control}
                    render={({onChange, value}) => (
                        <InputForm
                            text='Ingresa el número de documento'
                            valueName='Dni'
                            value={value}
                            keyboardType={'numeric'} />
                    )}
                    name='Dni'
                    rules={{
                        required: { value: true, message: 'Dato obligatorio.' },
                        pattern: { value: /\d{7,8}/, message: 'Número de documento inválido.'}
                    }}
                    defaultValue='' />
                <Text style={styles.textError}>{errors.Dni ? errors.Dni.message : " "}</Text>

                <Text style={[styles.label, {
                    fontSize: 13,
                    textAlign: 'left',
                    color: '#939393',
                    marginBottom: 10,
                }]}>{"\n"}Corrobora que el teléfono dictado por la persona sea real.
                </Text>
                <Text style={styles.label}>Teléfono</Text>
                <Controller
                    control={control}
                    render={({onChange, value}) => (
                        <InputForm
                            text='Ingresa un teléfono de contacto'
                            valueName='Phone'
                            value={value}
                            autoComplete={'tel'}
                            keyboardType={'phone-pad'}/>
                    )}
                    name='Phone'
                    rules={{
                        required: { value: true, message: 'Dato obligatorio.' },
                        pattern: { value: /\d+/, message: 'Número de teléfono inválido.'}
                    }}
                    defaultValue='' />
                <Text style={styles.textError}>{errors.Phone ? errors.Phone.message : " "}</Text>
                <StatusComponent />

            </View>
            <EurekappButton text={'Registrar devolución'} onPress={handleSubmit(onSubmit)}/>
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
        maxWidth:'1200px',
        width: '100%',
        alignSelf:"center"
    },
    textError: {
        color: '#000',
        alignSelf: 'flex-end',
        marginRight: 10,
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
    explanatoryTextContainer: {
        justifyContent: 'center',
    }
});

export default ReturnObjectForm;