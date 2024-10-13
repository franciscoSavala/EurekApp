import React, {useEffect, useState} from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from 'react-native';
import axios from "axios";
import Constants from "expo-constants";
import EurekappButton from "../components/Button";
import InstitutePicker from "../components/InstitutePicker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import EurekappDateComponent from "../components/EurekappDateComponent";
import {useFocusEffect} from "@react-navigation/native";
import MapViewComponent from "../components/MapViewComponent";


const BACK_URL = Constants.expoConfig.extra.backUrl;

const FindObject = ({ navigation, route }) => {
    const [selectedInstitute, setSelectedInstitution] = useState(null);
    const [queryObjects, setQueryObjects] = useState("");
    const [loading, setLoading] = useState(false);
    const [buttonWasPressed, setButtonWasPressed] = useState(false);
    const [lostDate, setLostDate] = useState(() => {
        let curDate = new Date(Date.now() - (3 * 60 * 60 * 1000));
        curDate.setMinutes(0,0,0);
        return curDate;
    });
    const [objectMarker, setObjectMarker] = useState({
        // Si no seteamos un valor por defecto, en web nunca se cargará el marcador porque latitude siempre tendrá un
        // valor inicial igual a Number.MAX_VALUE.
        latitude: -31.4124,
        longitude: -64.1867
    /*latitude: Number.MAX_VALUE,
        longitude: Number.MAX_VALUE,*/
    });
    const [isMapVisible, setIsMapVisible] = useState(true);

    // Efecto que se ejecuta cuando la pantalla recibe el parámetro 'reset'
    useFocusEffect(
        React.useCallback(() => {
            if (route.params?.reset) {
                // Reseteamos todos los estados al recibir el parámetro 'reset'
                setSelectedInstitution(null);
                setQueryObjects("");
                setLoading(false);
                setButtonWasPressed(false);
                setLostDate(new Date());
                setIsMapVisible(false);
            }
        }, [route.params?.reset]) // Dependencia en el parámetro 'reset'
    );

    const validateInputConstraints = () => {
        if(!queryObjects){
            alert("No se ingresó una descripción del objeto");
            console.log("No se ingresó una descripción del objeto");
            return false;
        }
        if (queryObjects.length > 255) {
            alert("La descripción del objeto es muy larga");
            console.log("La descripción del objeto es muy larga");
            return false;
        }
        return true;
    }

    const queryLostObject = async () => {
        if(!validateInputConstraints()) return;
        setLoading(true);
        setButtonWasPressed(true);
        try {
            let authHeader = 'Bearer ' + await AsyncStorage.getItem('jwt');
            let config = {
                params: {
                    query: queryObjects,
                    'lost_date': lostDate.toISOString().split('.')[0],
                },
                headers: {
                    'Authorization': authHeader
                }
            }
            // Incluimos las coordenadas solo si se seleccionó una organización.
            if (!selectedInstitute) {
                config.params.latitude = objectMarker.latitude;  // Incluye latitud
                config.params.longitude = objectMarker.longitude; // Incluye longitud
            }
            let endpoint = '/found-objects' + (selectedInstitute ? `/organizations/${selectedInstitute.id}` : '');
            let res = await axios.get(BACK_URL + endpoint, //esto es inseguro pero ok...
                config );
            let jsonData = res.data;
            const routeParams = {
                objectsFound: jsonData.found_objects,
                query: queryObjects,
                lostDate: lostDate,
                coordinates: {
                    latitude: objectMarker.latitude,
                    longitude: objectMarker.longitude
                }
            }

            if(jsonData.found_objects.length === 0) {
                navigation.navigate('NotFoundObjects', routeParams);
            }else{
                navigation.navigate('FoundObjects', routeParams);
            }

        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.formContainer}>
                <View style={styles.textDescriptionContainer}>
                    <Text style={styles.labelText}>Descripción del objeto:</Text>
                    <TextInput
                        style={styles.textArea}
                        placeholder="Proporciona detalles que ayuden a identificarlo"
                        multiline
                        onChangeText={(text) => setQueryObjects(text)}
                    />
                </View>
                <InstitutePicker setSelected={(institution) => {setSelectedInstitution(institution);
                                                                        setIsMapVisible(institution === undefined);} } />
                    <MapViewComponent
                        objectMarker={objectMarker}
                        setObjectMarker={setObjectMarker}
                        labelText={"Ingresa la ubicación donde crees haberlo perdido: "}
                        style={{ display: isMapVisible ? 'flex' : 'none' }} />
                <EurekappDateComponent labelText={'Fecha y hora en la que crees haberlo perdido: '}
                                       date={lostDate} setDate={setLostDate}/>
                {buttonWasPressed ? (
                    loading ? <ActivityIndicator size="large" color="#111818" />: null
                ) : null
                }
            </ScrollView>
            <EurekappButton text="Buscar objeto" onPress={queryLostObject} />
        </View>
    );
}

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
        maxWidth:'1000px',
        width: '100%',
        alignSelf:"center"
    },
    input: {
        width: '100%',
        height: 40,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 5,
        paddingLeft: 10,
        marginVertical: 10,
    },
    labelText: {
        color: '#111818',
        fontSize: 16,
        fontWeight: '500',
        fontFamily: 'PlusJakartaSans-Regular'
    },
    labelContainer: {
        width: '100%',
    },
    textAreaContainer: {
        flex: 1,
        alignSelf: 'stretch'
    },
    textArea: {
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
    textDescriptionContainer: {
        justifyContent: 'flex-start',
        alignSelf: 'stretch',
    }
});

export default FindObject;