import {
    ActivityIndicator,
    FlatList,
    Image,
    ImageBackground, Platform,
    Pressable, ScrollView,
    StyleSheet,
    TextInput,
    View
} from "react-native";
import {Controller, useForm} from "react-hook-form";
import {Input, Text} from "react-native-elements";
import React, {useState} from "react";
import EurekappButton from "../components/Button";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import Constants from "expo-constants";
import Icon from "react-native-vector-icons/FontAwesome6";
import {Buffer} from "buffer";
import * as ImagePicker from "expo-image-picker";
import alert from "react-native-web/src/exports/Alert";

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
    const [imageUploaded, setImageUploaded ] = useState(false);
    const [image, setImage] = useState({});
    const [imageByte, setImageByte] = useState(new Buffer("something"));
    const [imageRequiredMessage, setImageRequiredMessage] = useState('');

    const validatePhotoUploaded = () => {
        if (!imageUploaded){
            setImageRequiredMessage("La foto es obligatoria.");
            return false;
        }
        return true;
    }

    const onSubmit = async () => {
        if(!validatePhotoUploaded()) return;
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
            /*let config = {
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
                    file: new Blob([imageByte]),
                }, config );*/
            const formData = new FormData();
            formData.append('username', ownerUsername);
            formData.append('dni', dni);
            formData.append('phoneNumber', phone);
            formData.append('found_object_uuid', objectId);
            formData.append("file", new Blob([imageByte]));
            let res = await fetch(`${BACK_URL}/found-objects/return/${institute.id}`, {
                method: 'POST',
                headers: {
                    'Authorization': authHeader,
                },
                body: formData,
            });

            if(res.ok){
                setResponseOk(true);
                console.log("Se ejecutó el if de status 200");
            }else{
                const errorData = await res.json();
                setResponseOk(false);
                setError('ObjectOwnerUsername', {
                    type: 'manual',
                    message: errorData.message
                })
            }
            /*if(res.status === '404'){
                console.log(res);
                if(res.data.error === "user_not_found"){
                    setError('ObjectOwnerUsername', {
                        type: 'manual',
                        message: res.data.message
                    })
                }
            }*/
            console.log("Se ejecutó el try");
        } catch (error) {
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

    const InputForm = ({text, valueName, value , onChange, autoComplete = 'off', keyboardType = 'default'}) => {

        const handleTextChange = (input) => {
            const numericValue = keyboardType === 'numeric' || keyboardType === 'phone-pad' ? input.replace(/[^0-9]/g, '') : input;
            onChange(numericValue);
        };

        return (
            <TextInput
                placeholder={text}
                placeholderTextColor={'#638888'}
                onChangeText={handleTextChange}
                //onChangeText={onChange}
                //onChangeText={(value) => setValue(valueName, value)}
                value={value}
                style={styles.textArea}
                renderErrorMessage={false}
                autoComplete={autoComplete}
                keyboardType={keyboardType}
            />
        );
    }

    const deleteImage = () => {
        setImage({});
        setImageUploaded(false);
    }

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync(imagePickerConfig);
        handleImagePicked(result);
    };

    const imagePickerConfig = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        base64: true,
        aspect: [1,1],
        quality: 1,
    };

    const takePhoto = async () => {
        if (Platform.OS === 'web') {
            // Para web, usamos input file con capture
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.capture = 'environment'; // Intenta abrir la cámara trasera si está disponible
            input.onchange = (event) => {
                const file = event.target.files[0];
                const reader = new FileReader();
                reader.onload = () => {
                    const base64String = reader.result.split(',')[1];
                    setImage({ uri: URL.createObjectURL(file), base64: base64String });
                    setImageByte(Buffer.from(base64String, "base64"));
                    setImageUploaded(true);
                };
                reader.readAsDataURL(file);
            };
            input.click();
            setImageRequiredMessage("");
        } else {
            // En móviles, seguimos usando ImagePicker
            let result = await ImagePicker.launchCameraAsync(imagePickerConfig);
            handleImagePicked(result);
        }
    };

    const handleImagePicked = (result) => {
        if (!result.canceled) {
            setImage(result.assets[0]);
            setImageByte(Buffer.from(result.assets[0].base64, "base64"));
            setImageUploaded(true);
            setImageRequiredMessage("");
        }
    };

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.container}>
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

                <Text style={[styles.label, {
                    fontSize: 13,
                    textAlign: 'left',
                    color: '#939393',
                    marginBottom: 10,
                }]}>{"\n"}Toma una foto de la persona a la que le entregarás el objeto. Es importante tener esto como evidencia.
                </Text>
                <Text style={styles.label}>Foto de la persona que se llevará el objeto:</Text>
                <View style={{width: "65%"}}>
                    { imageUploaded ? (
                        <ImageBackground
                            source={{ uri: image.uri }}
                            style={styles.viewImage}
                            imageStyle={styles.onlyImage} >
                            <Pressable style={styles.iconContainer} onPress={deleteImage}>
                                <Icon name={'trash-can'} size={24} color={'#000000'}/>
                            </Pressable>
                        </ImageBackground>
                    ) : (
                        <Image
                            source={require('../../assets/defaultImage.png')}
                            style={styles.image}
                        />
                    )
                    }
                </View>
                <View style={styles.imageLoadContainer}>
                    <Pressable onPress={pickImage}
                               style={styles.imageLoadPressable}>
                        <Text style={styles.imageLoadText}>Seleccionar foto</Text>
                        <Icon name={'upload'} size={24} color={'#bdc1c1'}/>
                    </Pressable>
                    <View style={{width: 10}}></View>
                    <Pressable onPress={takePhoto}
                               style={styles.imageLoadPressable}>
                        <Text style={styles.imageLoadText}>Sacar Foto</Text>
                        <Icon name={'camera'} size={24} color={'#bdc1c1'}/>
                    </Pressable>
                </View>
                <Text style={styles.textError}>{imageRequiredMessage}</Text>



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
                    //render={({onChange, value}) => (
                    render={({ field: { onChange, value } }) => (
                        <InputForm
                            text='Ingresa el número de documento'
                            valueName='Dni'
                            value={value}
                            onChange={onChange}
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
                    //render={({onChange, value}) => (
                    render={({ field: { onChange, value } }) => (
                        <InputForm
                            text='Ingresa un teléfono de contacto'
                            valueName='Phone'
                            value={value}
                            onChange={onChange}
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



                <Text style={styles.label}>Usuario de Eurekapp (email, opcional):</Text>
                <Controller
                    control={control}
                    //render={({onChange, value}) => (
                    render={({ field: { onChange, value } }) => (
                        <InputForm
                            text='Ingresa el email del usuario'
                            valueName='ObjectOwnerUsername'
                            value={value}
                            onChange={onChange}
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

                <StatusComponent />

            </View>

            </ScrollView>
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
    iconContainer: {
        margin: 10,
        backgroundColor: '#f0f4f4',
        padding: 8,
        borderRadius: 24
    },
    image: {
        height: 'auto',
        width: '100%',
        maxWidth: 500,
        maxHeight: 500,
        aspectRatio: 1,
        borderRadius: 16,
        marginBottom: 10,
    },
    imageLoadContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        alignItems: 'center',
        marginBottom: 10,
        maxWidth: 500,
    },
    imageLoadPressable: {
        flex: 1,
        flexDirection: 'row',
        height: '100%',
        justifyContent: 'space-between',
        alignItems: 'center',
        overflow: 'hidden',
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#bdc1c1',
        backgroundColor: '#fff',
        paddingVertical: 16,
        paddingHorizontal: 12,
    },
    imageLoadText: {
        fontSize: 16,
        fontWeight: 'normal',
        color: '#638888',
        fontFamily: 'PlusJakartaSans-Regular'
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
    },
    onlyImage: {
        borderRadius: 16,
    },
    viewImage: {
        height: 'auto',
        width: '100%',
        maxWidth: 500,
        maxHeight: 500,
        overflow: 'hidden',
        aspectRatio: 1,
        justifyContent: 'flex-end',
        alignItems: 'flex-end',
        marginBottom: 10,
    },
});

export default ReturnObjectForm;