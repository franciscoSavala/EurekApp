import {ActivityIndicator, Image, Modal, Pressable, Text, View, StyleSheet} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome6";
import EurekappButton from "../components/Button";
import React, {useState} from "react";
import Constants from "expo-constants";
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { Buffer } from 'buffer';
import { fetchWithAuth, blobFetchWithAuth } from "../../utils/fetchWithAuth";
import { isWeb } from "../../utils/platform";
import {CommonActions, useNavigation} from '@react-navigation/native';


const BACK_URL = Constants.expoConfig.extra.backUrl;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
const MAX_SIZE_MB = 5;

const FormData = global.FormData;

const toLocalISO = (date) => {
    const d = date instanceof Date ? date : new Date(date);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

/**
 * EU-326: guarda la búsqueda contra `POST /lost-objects`, que es multipart. La foto es OPCIONAL, pero
 * es lo que más ayuda a que después matchee, así que si la búsqueda no traía una se la ofrece acá.
 */
const UploadLostObjectModal = ({ setModalVisible, modalVisible, query, lostDate, coordinates, organizationId, photo }) => {
    const [buttonWasPressed, setButtonWasPressed] = useState(false);
    const [loading, setLoading] = useState(false);
    const [responseOk, setResponseOk] = useState(false);
    const [extraPhoto, setExtraPhoto] = useState(null);
    const navigation = useNavigation();
    const effectivePhoto = photo ?? extraPhoto;

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            base64: true,
            aspect: [1, 1],
            quality: 1,
        });
        if (result.canceled) return;
        const asset = result.assets[0];
        if (!ALLOWED_MIME_TYPES.includes(asset.mimeType)) {
            Toast.show({ type: 'error', text1: 'Formato no permitido', text2: 'Solo se permiten imágenes .jpg, .jpeg o .png' });
            return;
        }
        if (Buffer.from(asset.base64, 'base64').length / 1024 / 1024 > MAX_SIZE_MB) {
            Toast.show({ type: 'error', text1: 'Imagen muy grande', text2: `La foto no debe superar los ${MAX_SIZE_MB} MB` });
            return;
        }
        setExtraPhoto({ base64: asset.base64, mimeType: asset.mimeType, uri: asset.uri });
    };

    const uploadLostObject = async () => {
        setButtonWasPressed(true);
        if (!query || query.trim() === '') {
            setResponseOk(false);
            return;
        }
        setLoading(true);
        try {
            const params = new URLSearchParams({ description: query });
            if (lostDate) params.append('lost_date', toLocalISO(lostDate));
            if (coordinates?.latitude != null && coordinates?.longitude != null) {
                params.append('latitude', coordinates.latitude);
                params.append('longitude', coordinates.longitude);
            }
            if (organizationId != null) params.append('organization_id', String(organizationId));
            const url = `${BACK_URL}/lost-objects?${params.toString()}`;

            if (isWeb) {
                const formData = new FormData();
                if (effectivePhoto) {
                    formData.append('file', new Blob([Buffer.from(effectivePhoto.base64, 'base64')]), 'lost_photo.jpg');
                }
                const response = await fetchWithAuth(url, { method: 'POST', body: formData });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
            } else {
                const parts = effectivePhoto
                    ? [{ name: 'file', filename: 'lost_photo.jpg', type: effectivePhoto.mimeType || 'image/jpeg',
                         data: 'RNFetchBlob-base64://' + String(effectivePhoto.base64) }]
                    : [];
                const response = await blobFetchWithAuth('POST', url,
                    { 'Content-Type': 'multipart/form-data' }, parts);
                const status = response.info().status;
                if (status < 200 || status >= 300) throw new Error(`HTTP ${status}`);
            }
            setResponseOk(true);
            setTimeout(() => {
                setModalVisible(false);
                navigation.navigate('MyObjectsStackScreen', { screen: 'MyObjectHistory' });
            }, 1500);
        } catch (error) {
            console.error(error);
            setResponseOk(false);
        } finally {
            setLoading(false);
        }
    }

    const StatusComponent = () => {
        return(
            <View style={{ alignItems: 'center' }}>
                {buttonWasPressed ? (
                    loading ? (
                        <ActivityIndicator style={{marginVertical: 10}} size="large" color="#111818" />
                    ) : (
                        responseOk ? (
                            <>
                                <Icon style={{marginVertical: 10}} name={'circle-check'} size={50} color={'#008000'}/>
                                <Text style={[styles.modalText, { color: '#008000', fontFamily: 'PlusJakartaSans-Bold' }]}>
                                    ¡Búsqueda guardada correctamente!
                                </Text>
                                <Text style={[styles.modalText, { color: '#638888', fontSize: 13 }]}>
                                    Te avisaremos cuando encontremos un objeto similar.
                                </Text>
                            </>
                        ) : (
                            <>
                                <Icon style={{marginVertical: 10}} name={'circle-exclamation'} size={50} color={'#f59e0b'}/>
                                <Text style={[styles.modalText, { color: '#b45309', fontFamily: 'PlusJakartaSans-Bold' }]}>
                                    No se pudo guardar la búsqueda
                                </Text>
                                <Text style={[styles.modalText, { color: '#638888', fontSize: 13 }]}>
                                    Por favor, intentá de nuevo más tarde.
                                </Text>
                            </>
                        )
                    )
                ) : null
                }
            </View>
        );
    }
    const handleClose = () => {
        setButtonWasPressed(false);
        setLoading(false);
        setResponseOk(false);
        setExtraPhoto(null);
        // Reiniciar la pantalla inicial de la stack y enviar el parámetro 'reset' para que borre el contenido.
        navigation.dispatch(
            CommonActions.reset({
                index: 0,
                routes: [{ name: 'FindObject', params: { reset: true } }] // Enviamos el parámetro 'reset'
            })
        );
    };
    return (
        <Modal
            animationType="none"
            transparent={true}
            visible={modalVisible}
            onRequestClose={() => setModalVisible(!modalVisible)}>
            <View style={styles.centeredView}>
                <View style={styles.modalView}>
                    <Icon style={styles.infoIcon} name={'circle-info'} size={32} color={'#111818'}/>
                    <Text style={styles.modalText}>
                        ¿Quieres guardar tu búsqueda? Te avisaremos cuando encontremos un objeto similar.
                    </Text>
                    {!buttonWasPressed && !effectivePhoto && (
                        // Sin foto la búsqueda se guarda igual, pero avisa con menos precisión: se compara
                        // sólo por texto. Por eso el camino fácil es adjuntar y guardar sin foto queda
                        // como salida secundaria, deliberadamente menos prominente.
                        <Text style={styles.recommendText}>
                            Te recomendamos adjuntar una foto: sin ella sólo podemos comparar tu búsqueda
                            por la descripción y es mucho más fácil que se nos pase. Si no tenés una del
                            objeto, sirve igual una parecida sacada de internet.
                        </Text>
                    )}
                    {!buttonWasPressed && effectivePhoto && (
                        <Image source={{ uri: effectivePhoto.uri }} style={styles.photoPreview} />
                    )}
                    <StatusComponent />
                    {!buttonWasPressed && (
                        effectivePhoto ? (
                            <EurekappButton text='Guardar búsqueda' onPress={uploadLostObject} />
                        ) : (
                            <>
                                <EurekappButton text='Adjuntar foto y guardar' onPress={pickImage} />
                                <Pressable onPress={uploadLostObject} style={styles.saveWithoutPhoto}>
                                    <Text style={styles.saveWithoutPhotoText}>Guardar sin foto</Text>
                                </Pressable>
                            </>
                        )
                    )}
                    <EurekappButton text='Cerrar'
                                    backgroundColor={'#f0f4f4'}
                                    textColor={'#111818'}
                                    onPress={() => {setModalVisible(false); handleClose()}}/>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalView: {
        margin: 20,
        // En pantalla ancha el modal se estiraba de punta a punta y el texto quedaba ilegible.
        width: '100%',
        maxWidth: 460,
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 28,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    modalText: {
        marginBottom: 15,
        textAlign: 'center',
        fontFamily: 'PlusJakartaSans-Regular',
    },
    modalButton: {
        width: '100%',
        backgroundColor: '#f0f4f4',
        fontWeight: 'bold',
        textAlign: 'center',
    },
    recommendText: {
        fontSize: 15,
        lineHeight: 22,
        color: '#111818',
        textAlign: 'center',
        marginBottom: 20,
        fontFamily: 'PlusJakartaSans-Regular',
    },
    saveWithoutPhoto: {
        marginTop: 4,
        paddingVertical: 8,
        paddingHorizontal: 14,
    },
    saveWithoutPhotoText: {
        fontSize: 13,
        color: '#8a9a9a',
        textDecorationLine: 'underline',
        fontFamily: 'PlusJakartaSans-Regular',
    },
    photoPreview: {
        width: 120,
        height: 120,
        borderRadius: 12,
        marginBottom: 15,
    },
});

export default UploadLostObjectModal;
