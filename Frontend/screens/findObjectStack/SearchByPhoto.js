import React, { useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
    View,
    Text,
    Image,
    StyleSheet,
    Pressable,
    ActivityIndicator,
    ImageBackground,
    ScrollView,
} from 'react-native';
import Toast from 'react-native-toast-message';
import * as ImagePicker from 'expo-image-picker';
import { Buffer } from 'buffer';
import EurekappButton from '../components/Button';
import Icon from 'react-native-vector-icons/FontAwesome6';
import InstitutePicker from '../components/InstitutePicker';
import Constants from 'expo-constants';
import { fetchWithAuth, blobFetchWithAuth } from '../../utils/fetchWithAuth';
import { isWeb } from '../../utils/platform';

const BACK_URL = Constants.expoConfig.extra.backUrl;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
const MAX_SIZE_MB = 5;

const FormData = global.FormData;

const toLocalISO = (date) => {
    const d = date instanceof Date ? date : new Date(date);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const SearchByPhoto = ({ navigation, route }) => {
    const params = route?.params ?? {};
    const [image, setImage] = useState({});
    const [imageByte, setImageByte] = useState(new Buffer('something'));
    const [imageUploaded, setImageUploaded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [selectedInstitute, setSelectedInstitute] = useState(params.selectedInstitute ?? null);

    useFocusEffect(
        React.useCallback(() => {
            setImage({});
            setImageByte(new Buffer('something'));
            setImageUploaded(false);
            setLoading(false);
            setSelectedInstitute(params.selectedInstitute ?? null);
        }, [])
    );

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
                Toast.show({ type: 'error', text1: 'Formato no permitido', text2: 'Solo se permiten imágenes .jpg, .jpeg o .png' });
                return;
            }
            const bytes = Buffer.from(asset.base64, 'base64');
            if (bytes.length / 1024 / 1024 > MAX_SIZE_MB) {
                Toast.show({ type: 'error', text1: 'Imagen muy grande', text2: `La foto no debe superar los ${MAX_SIZE_MB} MB` });
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

    const deleteImage = () => {
        setImage({});
        setImageUploaded(false);
    };

    const searchByPhoto = async () => {
        if (!imageUploaded) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Por favor seleccioná una foto para buscar' });
            return;
        }
        setLoading(true);
        try {
            const orgId = selectedInstitute?.id ?? null;

            const queryParams = new URLSearchParams();
            if (orgId) queryParams.append('organizationId', orgId);
            if (params.lostDate) queryParams.append('lostDate', toLocalISO(params.lostDate));
            if (params.filterLostDateTo) queryParams.append('lostDateTo', toLocalISO(params.filterLostDateTo));
            if (!orgId && params.latitude != null) queryParams.append('latitude', params.latitude);
            if (!orgId && params.longitude != null) queryParams.append('longitude', params.longitude);
            if (params.filterCategory) queryParams.append('category', params.filterCategory);
            const qs = queryParams.toString();
            const url = `${BACK_URL}/found-objects/search-by-photo${qs ? `?${qs}` : ''}`;

            let objectsFound;
            let generatedDescription;

            if (isWeb) {
                const formData = new FormData();
                formData.append('file', new Blob([imageByte]));
                const response = await fetchWithAuth(url, {
                    method: 'POST',
                    body: formData,
                });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                const json = await response.json();
                objectsFound = json.found_objects;
                generatedDescription = json.generated_description;
            } else {
                const response = await blobFetchWithAuth(
                    'POST',
                    url,
                    {
                        'Content-Type': 'multipart/form-data',
                    },
                    [{ name: 'file', filename: 'search_photo.jpg', data: String(image.base64) }]
                );
                if (response.info().status < 200 || response.info().status >= 300) {
                    throw new Error(`HTTP ${response.info().status}`);
                }
                const json = response.json();
                objectsFound = json.found_objects;
                generatedDescription = json.generated_description;
            }

            navigation.navigate('PhotoSearchResults', { objectsFound, generatedDescription, organizationId: orgId });
        } catch (error) {
            console.error(error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Hubo un problema al cargar la foto. Intenta de nuevo.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.formContainer}>
                <Text style={styles.label}>¿En qué organización perdiste el objeto?</Text>
                <InstitutePicker
                    selectedValue={selectedInstitute?.id?.toString() ?? ''}
                    setSelected={setSelectedInstitute}
                />
                {(params.lostDate || params.filterCategory || params.filterColor) && (
                    <View style={styles.filtersInfo}>
                        <Text style={styles.filtersInfoTitle}>Filtros aplicados desde la búsqueda anterior:</Text>
                        {params.lostDate && (
                            <Text style={styles.filtersInfoText}>• Fecha desde: {new Date(params.lostDate).toLocaleDateString('es-AR')}</Text>
                        )}
                        {params.filterLostDateTo && (
                            <Text style={styles.filtersInfoText}>• Fecha hasta: {new Date(params.filterLostDateTo).toLocaleDateString('es-AR')}</Text>
                        )}
                        {params.filterCategory && (
                            <Text style={styles.filtersInfoText}>• Categoría: {params.filterCategory}</Text>
                        )}
                        {params.filterColor && (
                            <Text style={styles.filtersInfoText}>• Color: {params.filterColor}</Text>
                        )}
                    </View>
                )}
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
    filtersInfo: {
        alignSelf: 'stretch',
        backgroundColor: '#f0f4f4',
        borderRadius: 10,
        padding: 12,
        marginTop: 10,
        gap: 4,
    },
    filtersInfoTitle: {
        fontSize: 13,
        fontFamily: 'PlusJakartaSans-Bold',
        color: '#638888',
        marginBottom: 4,
    },
    filtersInfoText: {
        fontSize: 13,
        fontFamily: 'PlusJakartaSans-Regular',
        color: '#111818',
    },
});

export default SearchByPhoto;
