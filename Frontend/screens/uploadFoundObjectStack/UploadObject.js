import React, {useEffect, useState} from 'react';
import {
    View,
    Text,
    TextInput,
    Image,
    StyleSheet,
    Pressable,
    ActivityIndicator,
    ImageBackground,
    ScrollView
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Buffer } from "buffer";
import EurekappButton from "../components/Button";
import Icon from "react-native-vector-icons/FontAwesome6";
import AsyncStorage from "@react-native-async-storage/async-storage";
import EurekappDateComponent from "../components/EurekappDateComponent";
import Constants from "expo-constants";
import ReactNativeBlobUtil from "react-native-blob-util";

const BACK_URL = Constants.expoConfig.extra.backUrl;

const FormData = global.FormData;

const UploadObject = () => {
    const [objectTitle, setObjectTitle] = useState('');
    const [detailedDescription, setDetailedDescription] = useState('');
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
        //let result = await ImagePicker.launchCameraAsync(imagePickerConfig);
        //handleImagePicked(result);
    };

    const validateConstraints = () => {
        if (!imageUploaded){
            alert('Por favor sube una imagen');
            return false;
        }
        if (!objectTitle) {
            alert('Por favor escribe una descripción');
            return false;
        }
        if(objectTitle.length > 30){
            alert('Por favor escribe una descripción de menos de 30 caracteres');
            return false;
        }
        if(imageByte.length / 1024 / 1024 > 10){
            alert('Por favor sube una imagen de menos de 10MB');
            return false;
        }
        return true;
    }
    const submitData = async () => {
        if(!validateConstraints()) return;
        setLoading(true);
        setButtonWasPressed(true);
        try {
            let authHeader = 'Bearer ' + await AsyncStorage.getItem('jwt');

            let response =
                await ReactNativeBlobUtil.fetch('POST',
                    `${BACK_URL}/found-objects/organizations/${selectedInstitute.id}`,{
                        'Authorization': authHeader,
                        'Content-Type': 'multipart/form-data'
                    },[{name: 'title', data: objectTitle},
                        {name: 'found_date', data: foundDate.toISOString().split('.')[0]},
                        {name: 'detailed_description', data: detailedDescription},
                        {name: 'file', filename: 'found_object.jpg',
                            data: String(image.base64)}]);
            setLoading(false);
            if (response.respInfo.status >= 200 && response.respInfo.status < 300) {
                setResponseOk(true);
            }else{
                setResponseOk(false);
            }
        } catch (error) {
            console.error(error);
            setResponseOk(false);
        } finally {
            setLoading(false);
        }
    };

    const deleteImage = () => {
        setImage({});
        setImageUploaded(false);
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
    return (
        <View style={{flex: 1, backgroundColor: '#fff'}}>
            <View style={styles.container}>
                <ScrollView contentContainerStyle={styles.formContainer}>
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
                    <View style={styles.textAreaContainer}>
                        <Text style={{
                            color: '#111818',
                            fontSize: 16,
                            fontWeight: '500',
                            fontFamily: 'PlusJakartaSans-Regular'
                        }}>Titulo de la publicación: </Text>
                        <TextInput
                            maxLength={30}
                            style={styles.textArea}
                            placeholder="Escribe un título"
                            multiline
                            onChangeText={(text) => setObjectTitle(text)}
                        />
                    </View>
                    <View style={styles.textAreaContainer}>
                        <Text style={{
                            color: '#111818',
                            fontSize: 16,
                            fontWeight: '500',
                            fontFamily: 'PlusJakartaSans-Regular'
                        }}>Información relevante (opcional): </Text>
                        <TextInput
                            maxLength={250}
                            style={[styles.textArea, {minHeight: 200}]}
                            placeholder="Agrega una descripción"
                            multiline
                            onChangeText={(text) => setDetailedDescription(text)}
                        />
                    </View>
                    <EurekappDateComponent labelText={"Fecha de encuentro del objeto: "}
                                           setDate={setFoundDate} date={foundDate}/>
                    <StatusComponent />
                </ScrollView>
                <EurekappButton text="Reportar objeto encontrado" onPress={submitData} />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
    },
    formContainer: {
        flexGrow: 1,
        width: '100%',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingHorizontal: 10,
    },
    formView: {
        marginHorizontal: 10
    },
    image: {
        height: 'auto',
        width: '100%',
        aspectRatio: 1,
        borderRadius: 16,
        marginBottom: 10,
    },
    onlyImage: {
        borderRadius: 16,
    },
    viewImage: {
        height: 'auto',
        overflow: 'hidden',
        width: '100%',
        aspectRatio: 1,
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
        paddingVertical: 16,
        paddingHorizontal: 12,
    },
    imageLoadText: {
        fontSize: 16,
        fontWeight: 'normal',
        color: '#638888',
        fontFamily: 'PlusJakartaSans-Regular'
    },
    textAreaContainer: {
        alignSelf: 'stretch'
    },
    textArea: {
        minHeight: 80,
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
        textAlignVertical: 'top',
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
    iconContainer: {
        margin: 10,
        backgroundColor: '#f0f4f4',
        padding: 8,
        borderRadius: 24

    }

});

export default UploadObject;
