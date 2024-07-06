import React, {useEffect, useState} from 'react';
import {View, Text, TextInput, Image, StyleSheet, Pressable, ActivityIndicator} from 'react-native';
import Constants from "expo-constants";
import * as ImagePicker from 'expo-image-picker';
import { Buffer } from "buffer";
import EurekappButton from "../components/Button";
import InstitutePicker from "../components/InstitutePicker";
import Icon from "react-native-vector-icons/FontAwesome6";
import axios from "axios";

const BACK_URL = Constants.expoConfig.extra.backUrl;

const FormData = global.FormData;

const UploadObject = () => {
    const [objectDescription, setObjectDescription] = useState('');
    const [image, setImage] = useState({});
    const [imageByte, setImageByte] = useState(new Buffer("something"));
    const [selectedInstitute, setSelectedInstitute] = useState({});
    const [imageUploaded, setImageUploaded ] = useState(false);
    const [loading, setLoading] = useState(false);
    const [buttonWasPressed, setButtonWasPressed ] = useState(false);
    const [responseOk, setResponseOk] = useState(false);


    const imagePickerConfig = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        base64: true,
        aspect: [1,1],
        quality: 1,
    };

    const handleImagePicked = async (result) => {
        if (!result.canceled) {
            setImage(result.assets[0]);
            setImageByte(Buffer.from(result.assets[0].base64, "base64"));
            setImageUploaded(true);
        }
    };

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync(imagePickerConfig);
        await handleImagePicked(result);
    };

    const takePhoto = async () => {
        let result = await ImagePicker.launchCameraAsync(imagePickerConfig)
        await handleImagePicked(result);
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
        return true;
    }
    const submitData = async () => {
        if(!validateConstraints()) return;
        const blob = new Blob([imageByte]);
        const formData = new FormData();
        formData.append('file', blob);
        formData.append('description', objectDescription);
        setLoading(true);
        setButtonWasPressed(true);

        try {
            let response = await axios.post( BACK_URL + `/found-objects/organizations/${selectedInstitute.id}`, formData,{
                    timeout: 5000,
                });
            if (response.status === 200) {
                setResponseOk(true);
            }else{
                setResponseOk(false);
            }
        } catch (error) {
            console.error(error);
            setResponseOk(false);
        }
    };

    const StatusComponent = () => {
        return(
            <View>
                {buttonWasPressed ? (
                    loading ? (
                        <ActivityIndicator size="large" color="#111818" />
                    ) : (
                        responseOk ? (
                            <Icon name={'circle-check'} size={24} color={'#008000'}/>
                        ) : (
                            <Icon name={'circle-xmark'} size={24} color={'#ED4337'}/>
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
                { imageUploaded ? (
                        <Image
                            source={{ uri: image.uri }}
                            style={styles.image}
                        />
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
                <InstitutePicker setSelected={(institution) => setSelectedInstitute(institution)} />
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
});

export default UploadObject;
