import {ActivityIndicator, Modal, Text, View, StyleSheet} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome6";
import EurekappButton from "../components/Button";
import React, {useState} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import useAuthFetch from "../../utils/useAuthFetch";
import {CommonActions, useNavigation} from '@react-navigation/native';


const BACK_URL = Constants.expoConfig.extra.backUrl;

const UploadLostObjectModal = ({ setModalVisible, modalVisible, query, lostDate, coordinates, organizationId }) => {
    const { authFetch } = useAuthFetch();
    const [buttonWasPressed, setButtonWasPressed] = useState(false);
    const [loading, setLoading] = useState(false);
    const [responseOk, setResponseOk] = useState(false);
    const navigation = useNavigation();

    const uploadLostObject = async () => {
        setButtonWasPressed(true);
        if (!query || query.trim() === '') {
            setResponseOk(false);
            return;
        }
        setLoading(true);
        try {
            const username = await AsyncStorage.getItem('username');
            await authFetch('post', `${BACK_URL}/lost-objects`, {
                description: query,
                username: username,
                lost_date: lostDate,
                coordinates: coordinates,
                organization_id: organizationId != null ? String(organizationId) : null
            });
            setResponseOk(true);
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
                    <StatusComponent />
                    {!buttonWasPressed && ( // El botón solo se muestra si aún no ha sido presionado
                        <EurekappButton text='Guardar búsqueda' onPress={uploadLostObject} />
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
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 35,
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
});

export default UploadLostObjectModal;
