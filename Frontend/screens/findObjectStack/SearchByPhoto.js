import React, { useState } from 'react';
import {
    View,
    Text,
    Image,
    StyleSheet,
    Pressable,
    ActivityIndicator,
    ImageBackground,
    ScrollView,
    Platform,
    Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Buffer } from 'buffer';
import EurekappButton from '../components/Button';
import Icon from 'react-native-vector-icons/FontAwesome6';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import ReactNativeBlobUtil from 'react-native-blob-util';

const BACK_URL = Constants.expoConfig.extra.backUrl;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
const MAX_SIZE_MB = 5;

const FormData = global.FormData;

const SearchByPhoto = ({ navigation }) => {
    const [image, setImage] = useState({});
    const [imageByte, setImageByte] = useState(new Buffer('something'));
    const [imageUploaded, setImageUploaded] = useState(false);
    const [loading, setLoading] = useState(false);

    const imagePickerConfig = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        base64: true,
        aspect: [1, 1],
        quality: 1,
    };

    const handleImagePicked = (result) => {
        if (!result.canceled) {
            const asset = result.assets[0];
            if (!ALLOWED_MIME_TYPES.includes(asset.mimeType)) {
                Alert.alert('Formato no permitido', 'Solo se permiten imágenes .jpg, .jpeg o .png');
                return;
            }
            const bytes = Buffer.from(asset.base64, 'base64');
            if (bytes.length / 1024 / 1024 > MAX_SIZE_MB) {
                Alert.alert('Imagen muy grande', `La foto no debe superar los ${MAX_SIZE_MB} MB`);
                return;
            }
            setImage(asset);
            setImageByte(bytes);
            setImageUploaded(true);
        }
    };

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync(imagePickerConfig);
        handleImagePicked(result);
    };

    const takePhoto = async () => {
        if (Platform.OS === 'web') {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/jpeg,image/png';
            input.capture = 'environment';
            input.onchange = (event) => {
                const file = event.target.files[0];
                if (!file) return;
                if (!ALLOWED_MIME_TYPES.includes(file.type)) {
                    Alert.alert('Formato no permitido', 'Solo se permiten imágenes .jpg, .jpeg o .png');
                    return;
                }
                const reader = new FileReader();
                reader.onload = () => {
                    const base64String = reader.result.split(',')[1];
                    const bytes = Buffer.from(base64String, 'base64');
                    if (bytes.length / 1024 / 1024 > MAX_SIZE_MB) {
                        Alert.alert('Imagen muy grande', `La foto no debe superar los ${MAX_SIZE_MB} MB`);
                        return;
                    }
                    setImage({ uri: URL.createObjectURL(file), base64: base64String });
                    setImageByte(bytes);
                    setImageUploaded(true);
                };
                reader.readAsDataURL(file);
            };
            input.click();
        } else {
            let result = await ImagePicker.launchCameraAsync(imagePickerConfig);
            handleImagePicked(result);
        }
    };

    const deleteImage = () => {
        setImage({});
        setImageUploaded(false);
    };

    const searchByPhoto = async () => {
        if (!imageUploaded) {
            Alert.alert('Error', 'Por favor seleccioná una foto para buscar');
            return;
        }
        setLoading(true);
        try {
            let authHeader = 'Bearer ' + await AsyncStorage.getItem('jwt');
            let objectsFound;

            if (Platform.OS === 'web') {
                const formData = new FormData();
                formData.append('file', new Blob([imageByte]));
                const response = await fetch(`${BACK_URL}/found-objects/search-by-photo`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader },
                    body: formData,
                });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                const json = await response.json();
                objectsFound = json.found_objects;
            } else {
                const response = await ReactNativeBlobUtil.fetch(
                    'POST',
                    `${BACK_URL}/found-objects/search-by-photo`,
                    {
                        'Authorization': authHeader,
                        'Content-Type': 'multipart/form-data',
                    },
                    [{ name: 'file', filename: 'search_photo.jpg', data: String(image.base64) }]
                );
                if (response.respInfo.status < 200 || response.respInfo.status >= 300) {
                    throw new Error(`HTTP ${response.respInfo.status}`);
                }
                const json = response.json();
                objectsFound = json.found_objects;
            }

            navigation.navigate('PhotoSearchResults', { objectsFound });
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Hubo un problema al cargar la foto. Intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.formContainer}>
                <Text style={styles.label}>Foto de tu objeto perdido:</Text>
                <View style={{ width: '100%', alignItems: 'center' }}>
                    {imageUploaded ? (
                        <ImageBackground
                            source={{ uri: image.uri }}
                            style={styles.viewImage}
                            imageStyle={styles.onlyImage}>
                            <Pressable style={styles.iconContainer} onPress={deleteImage}>
                                <Icon name={'trash-can'} size={24} color={'#000000'} />
                            </Pressable>
                        </ImageBackground>
                    ) : (
                        <Image
                            source={require('../../assets/defaultImage.png')}
                            style={styles.image}
                        />
                    )}
                </View>
                <View style={styles.imageLoadContainer}>
                    <Pressable onPress={pickImage} style={styles.imageLoadPressable}>
                        <Text style={styles.imageLoadText}>Seleccionar foto</Text>
                        <Icon name={'upload'} size={24} color={'#bdc1c1'} />
                    </Pressable>
                    <View style={{ width: 10 }} />
                    <Pressable onPress={takePhoto} style={styles.imageLoadPressable}>
                        <Text style={styles.imageLoadText}>Sacar Foto</Text>
                        <Icon name={'camera'} size={24} color={'#bdc1c1'} />
                    </Pressable>
                </View>
                {loading && (
                    <ActivityIndicator style={{ marginVertical: 10 }} size="large" color="#111818" />
                )}
            </ScrollView>
            <EurekappButton text="Buscar objeto" onPress={searchByPhoto} />
            <EurekappButton
                text="Volver"
                onPress={() => navigation.goBack()}
                backgroundColor={'#f0f4f4'}
                textColor={'#111818'}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    formContainer: {
        flexGrow: 1,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingHorizontal: 10,
        maxWidth: '1000px',
        width: '100%',
        alignSelf: 'center',
    },
    label: {
        alignSelf: 'stretch',
        color: '#111818',
        fontSize: 16,
        fontWeight: '500',
        fontFamily: 'PlusJakartaSans-Regular',
        marginTop: 10,
        marginBottom: 6,
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
        fontFamily: 'PlusJakartaSans-Regular',
    },
    iconContainer: {
        margin: 10,
        backgroundColor: '#f0f4f4',
        padding: 8,
        borderRadius: 24,
    },
});

export default SearchByPhoto;
