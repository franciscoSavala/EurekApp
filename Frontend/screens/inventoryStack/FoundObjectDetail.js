import React, {useEffect, useRef, useState} from 'react';
import {
    View,
    Text,
    TextInput,
    Image,
    StyleSheet,
    Pressable,
    ActivityIndicator,
    ImageBackground,
    ScrollView,
    Platform, KeyboardAvoidingView, Switch, Modal
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Buffer } from "buffer";
import EurekappButton from "../components/Button";
import Icon from "react-native-vector-icons/FontAwesome6";
import AsyncStorage from "@react-native-async-storage/async-storage";
import EurekappDateComponent from "../components/EurekappDateComponent";
import Constants from "expo-constants";
import ReactNativeBlobUtil from "react-native-blob-util";
import {CommonActions, useNavigation} from "@react-navigation/native";
import axios from "axios";
import MapViewComponent from "../components/MapViewComponent";

const BACK_URL = Constants.expoConfig.extra.backUrl;

const FormData = global.FormData;

const FoundObjectDetail = ({route}) => {
    // FoundObject data (fo)
    const [fo, setFo] = useState('');
    const [objectMarker, setObjectMarker] = useState({
        latitude: -31.4124,
        longitude: -64.1867
    });
    const [isLoading, setIsLoading] = useState(true);
    const navigation = useNavigation();
    const { foundObjectUUID } = route.params


    const [successModal, setSuccessModal] = useState(false);

    useEffect(() => {
        console.log(route.params.foundObjectUUID.toString());
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            let authHeader = 'Bearer ' + await AsyncStorage.getItem('jwt');
            if (Platform.OS === 'web') {
                // Enviar datos como JSON en la web
                let config = {
                    headers: {
                        'Authorization': authHeader
                    }
                }
                let response = await axios.post(`${BACK_URL}/found-objects/getDetail`, {
                    foundObjectUUID: route.params.foundObjectUUID.toString(),
                }, config);

                if (response.status === 200) {
                    setFo(response.data)
                    setObjectMarker({latitude:response.data.latitude, longitude:response.data.longitude} )
                    setIsLoading(false);
                } else {
                }
            } else {
                // Enviar datos usando react-native-blob-util en móviles

            }
        } catch (error) {
            console.log(error);
        }
    };

    const formatDate = (date) => {

    }

    const handleClose = () => {
        navigation.goBack();
    }
    const foundDateTime = new Date(fo.found_date);
    return (
        <View style={{flex: 1, backgroundColor: '#fff'}}>
            <ScrollView contentContainerStyle={styles.formContainer}>
                <View style={styles.textAreaContainer}>
                    <Text style={styles.title}>Datos del objeto</Text>
                </View>

                <View style={styles.textAreaContainer}>
                    <Text style={styles.label}>Título: </Text>
                    <Text style={styles.label}>{fo.title}</Text>
                </View>

                <View style={styles.textAreaContainer}>
                    <Text style={styles.label}>Foto: </Text>
                </View>
                <Image
                    source={ fo.b64Json
                        ? { uri: `data:image/jpeg;base64,${fo.b64Json}` }
                        : require('../../assets/defaultImage.png') }
                    style={styles.image}
                    resizeMode="cover"
                />
                <View style={styles.textAreaContainer}>
                    <Text style={styles.label}>Descripción: {fo.humanDescription}</Text>
                    <Text style={styles.label}></Text>
                </View>

                <View style={styles.textAreaContainer}>
                    <Text style={styles.label}>Descripción provista por la IA: {fo.aiDescription}</Text>
                    <Text style={styles.label}></Text>
                </View>

                <View style={styles.textAreaContainer}>
                    <Text style={styles.label}>Encontrado el {foundDateTime.getDate()}/{foundDateTime.getMonth() + 1}/{foundDateTime.getFullYear()} a las {foundDateTime.toLocaleTimeString()}</Text>
                </View>

                <View style={styles.mapContainer}>
                    <Text style={styles.label}>Lugar donde fue encontrado: </Text>
                    {isLoading?
                        <>
                            <View style={{flex: 1, justifyContent: 'center'}}>
                                <ActivityIndicator size="large" style={{alignSelf: 'center'}} color="#111818" />
                            </View>
                        </>
                        :
                        <MapViewComponent
                            objectMarker={objectMarker}
                            setObjectMarker={setObjectMarker}
                            markerIsDraggable={false}
                            labelText={""}/>
                    }
                </View>

            </ScrollView>
            <EurekappButton text="Volver" onPress={handleClose} />

        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
    },
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
        textAlign: 'left',
        fontFamily: 'PlusJakartaSans-Regular',
    },
    formContainer: {
        flexGrow: 1,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingHorizontal: 10,
        maxWidth:'1000px',
        width: '100%',
        alignSelf:"center"
    },
    formView: {
        marginHorizontal: 10
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
    imageAndMapsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
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
        fontFamily: 'PlusJakartaSans-Regular'
    },
    mapContainer: {
        alignSelf: 'stretch',
        flexDirection: 'column',
        alignItems: 'left',
        padding: 10,
    },
    textAreaContainer: {
        alignSelf: 'stretch',
        flexDirection: 'row', // Asegura que los elementos estén en una fila
        alignItems: 'left',
        padding: 10,
    },
    textArea: {
        minHeight: 30,
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
    },
    label: {
        color: '#111818',
        fontSize: 16,
        fontWeight: '500',
        fontFamily: 'PlusJakartaSans-Regular'
    },
    switchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
    },
    switch: {
        marginRight: 10,
    },
    title: {
        color: '#111818',
        fontSize: 16,
        fontWeight: '500',
        fontFamily: 'PlusJakartaSans-Bold',
    }

});

export default FoundObjectDetail;
