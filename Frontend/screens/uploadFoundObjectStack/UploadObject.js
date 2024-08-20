import React, {useEffect, useState} from 'react';
import {View, Text, TextInput, Image, StyleSheet, Pressable, ActivityIndicator, ImageBackground} from 'react-native';
import Constants from "expo-constants";
import * as ImagePicker from 'expo-image-picker';
import { Buffer } from "buffer";
import EurekappButton from "../components/Button";
import InstitutePicker from "../components/InstitutePicker";
import Icon from "react-native-vector-icons/FontAwesome6";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import RNDateTimePicker from "@react-native-community/datetimepicker";

const BACK_URL = Constants.expoConfig.extra.backUrl;

const FormData = global.FormData;

const UploadObject = () => {
    const [objectDescription, setObjectDescription] = useState('');
    const [image, setImage] = useState({});
    const [imageByte, setImageByte] = useState(new Buffer("something"));
    const [selectedInstitute, setSelectedInstitute] = useState(null);
    const [imageUploaded, setImageUploaded ] = useState(false);
    const [loading, setLoading] = useState(false);
    const [buttonWasPressed, setButtonWasPressed ] = useState(false);
    const [responseOk, setResponseOk] = useState(false);
    const [foundDate, setFoundDate] = useState(new Date());

    useEffect(() => {
        const getContextInstitute = async () => {
            const institute = {
                id: await AsyncStorage.getItem('org.id'),
                name: await AsyncStorage.getItem('org.name')
            };
            if(institute.id == null || institute.name == null) return;
            setSelectedInstitute( institute );
        }
        getContextInstitute();
    }, []);

    const imagePickerConfig = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        base64: true,
        aspect: [1,1],
        quality: 1,
    };

    const handleImagePicked = (result) => {
        if (!result.canceled) {
            console.log(result.assets[0]);
            setImage(result.assets[0]);
            setImageByte(Buffer.from(result.assets[0].base64, "base64"));
            setImageUploaded(true);
        }
    };

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync(imagePickerConfig);
        handleImagePicked(result);
    };

    const takePhoto = async () => {
        let result = await ImagePicker.launchCameraAsync(imagePickerConfig);
        handleImagePicked(result);
    };

    const validateConstraints = () => {
        if (!imageUploaded){
            alert('Por favor sube una imagen');
            return false;
        }
        if (!objectDescription) {
            alert('Por favor escribe una descripción');
            return false;
        }
        if(objectDescription.length > 30){
            alert('Por favor escribe una descripción de menos de 30 caracteres');
            return false;
        }
        if(imageByte.length / 1024 / 1024 > 10){
            alert('Por favor sube una imagen de menos de 10MB');
            return false;
        }
        if(image.mimeType !== 'image/jpeg' && image.mimeType !== 'image/png'){
            alert('Por favor sube una imagen en formato jpg o png');
            return false;
        }
        return true;
    }
    const submitData = async () => {
        if(!validateConstraints()) return;
        const blob = new Blob([imageByte]);
        const formData = new FormData();
        formData.append('file', blob); //posible brecha de seguridad pero no me sale de otra forma jsdaj
        formData.append('description', objectDescription);
        setLoading(true);
        setButtonWasPressed(true);
        try {
            let authHeader = 'Bearer ' + await AsyncStorage.getItem('jwt');
            console.log('HOLA!');
            let config = {
                headers: {
                    'Authorization': authHeader
                }
            }
            let response =
                await axios.post(BACK_URL + `/found-objects/organizations/${selectedInstitute.id}`,
                    formData, config);
            setLoading(false);
            if (response.status >= 200 && response.status < 300) {
                setResponseOk(true);
            }else{
                setResponseOk(false);
            }
        } catch (error) {
            console.error(error);
            setLoading(false);
            setResponseOk(false);
        }
    };

    const deleteImage = () => {
        setImage({});
        setImageUploaded(false);
    }

    const StatusComponent = () => {
        return(
            <View style={{marginTop: 10}}>
                {buttonWasPressed ? (
                    loading ? (
                        <ActivityIndicator size="large" color="#111818" />
                    ) : (
                        responseOk ? (
                            <Icon name={'circle-check'} size={50} color={'#008000'}/>
                        ) : (
                            <Icon name={'circle-xmark'} size={50} color={'#ED4337'}/>
                        )
                    )
                ) : (<View />)
                }
            </View>
        );
    }
    return (
        <View style={styles.container}>
            <View style={styles.formContainer}>
                {selectedInstitute != null ?
                    <View style={styles.headerContainer}>
                        <Text style={styles.headerText}>{selectedInstitute.name}</Text>
                    </View> : null
                }

                { imageUploaded ? (
                        <ImageBackground
                            source={{ uri: image.uri }}
                            style={styles.viewImage}
                            imageStyle={styles.onlyImage} >
                            <Pressable style={{margin: 10}} onPress={deleteImage}>
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
                <View style={styles.imageLoadContainer}>
                    <Pressable onPress={pickImage}
                               style={styles.imageLoadPressable}>
                        <Text style={styles.imageLoadText}>Seleccionar imagen</Text>
                        <Icon name={'upload'} size={24} color={'#bdc1c1'}/>
                    </Pressable>
                    <View style={{width: 10}}></View>
                    <Pressable onPress={takePhoto}
                               style={styles.imageLoadPressable}>
                        <Text style={styles.imageLoadText}>Sacar Foto</Text>
                        <Icon name={'camera'} size={24} color={'#bdc1c1'}/>
                    </Pressable>
                </View>

                <TextInput
                    style={styles.textArea}
                    placeholder="Escribe una descripción"
                    multiline
                    onChangeText={(text) => setObjectDescription(text)}
                />
                <RNDateTimePicker value={foundDate} maximumDate={new Date()} onChange={(e, d) => setFoundDate(d)}/>
                { selectedInstitute == null ?
                    <InstitutePicker setSelected={(institution) => setSelectedInstitute(institution)} />
                    : null
                }
                <StatusComponent />
            </View>

            <EurekappButton text="Reportar objeto encontrado" onPress={submitData} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    formContainer: {
        flexGrow: 1,
        flexDirection: 'column',
        width: '90%',
        alignItems: 'center',
        justifyContent: 'flex-start',
    },
    image: {
        height: 300,
        width: '100%',
        aspectRatio: 1,
        borderRadius: 16,
        marginBottom: 10,
    },
    onlyImage: {
        borderRadius: 16,
    },
    viewImage: {
        maxHeight: 300,
        overflow: 'hidden',
        width: '100%',
        aspectRatio: 1,
        flex: 1,
        justifyContent: 'flex-end',
        alignItems: 'flex-end',
        marginBottom: 10,
    },
    imageLoadContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        alignItems: 'center',
        marginBottom: 10,
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
        padding: 16,
    },
    imageLoadText: {
        fontSize: 16,
        fontWeight: 'normal',
        color: '#638888',
        fontFamily: 'PlusJakartaSans-Regular'
    },
    textArea: {
        width: '100%',
        minHeight: 144,
        resize: 'none',
        overflow: 'hidden',
        borderRadius: 12,
        color: '#111818',
        backgroundColor: '#f0f4f4',
        padding: 16,
        fontSize: 16,
        fontWeight: 'normal',
        placeholderTextColor: '#638888',
        fontFamily: 'PlusJakartaSans-Regular',
        marginBottom: 10,
    },
    headerContainer: {
        height: 50,
        alignItems: 'flex-start'
    },
    headerText: {
        color: '#111818',
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        fontFamily: 'PlusJakartaSans-Bold'
    },
});

export default UploadObject;
