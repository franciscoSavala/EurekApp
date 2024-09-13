import {ActivityIndicator, Modal, Text, View, StyleSheet} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome6";
import EurekappButton from "../components/Button";
import React, {useState} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import Constants from "expo-constants";

const BACK_URL = Constants.expoConfig.extra.backUrl;

const UploadLostObjectModal = ({ setModalVisible, modalVisible, query }) => {
    const [buttonWasPressed, setButtonWasPressed] = useState(false);
    const [loading, setLoading] = useState(false);
    const [responseOk, setResponseOk] = useState(false);

    const uploadLostObject = async () => {
        setLoading(true);
        setButtonWasPressed(true);
        try {
            let authHeader = 'Bearer ' + await AsyncStorage.getItem('jwt');
            let username = await AsyncStorage.getItem('username');
            let config = {
                headers: {
                    'Authorization': authHeader
                }
            }
            let res = await axios.post(`${BACK_URL}/lost-objects`, //esto es inseguro pero ok...
                {
                    description: query,
                    username: username
                },
                config );
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
        <Modal
            animationType="none"
            transparent={true}
            visible={modalVisible}
            onRequestClose={() => setModalVisible(!modalVisible)}>
            <View style={styles.centeredView}>
                <View style={styles.modalView}>
                    <Icon style={styles.infoIcon} name={'circle-info'} size={32} color={'#111818'}/>
                    <Text style={styles.modalText}>
                        ¿Quieres guardar tu búsqueda? Te avisaremos cuando encontremos un objeto similar
                    </Text>
                    <StatusComponent />
                    <EurekappButton text='Guardar Búsqueda' onPress={uploadLostObject} />
                    <EurekappButton text='Cerrar'
                                    backgroundColor={'#f0f4f4'}
                                    textColor={'#111818'}
                                    onPress={() => setModalVisible(false)}/>
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