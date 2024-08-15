import React, {useEffect, useState} from "react";
import {ActivityIndicator, Alert, StyleSheet, Text, TextInput, View} from 'react-native';
import axios from "axios";
import Constants from "expo-constants";
import EurekappButton from "../components/Button";
import InstitutePicker from "../components/InstitutePicker";
import AsyncStorage from "@react-native-async-storage/async-storage";


const BACK_URL = Constants.expoConfig.extra.backUrl;

const FindObject = ({ navigation }) => {
    const [selectedInstitute, setSelectedInstitution] = useState(null);
    const [queryObjects, setQueryObjects] = useState("");
    const [loading, setLoading] = useState(false);
    const [buttonWasPressed, setButtonWasPressed] = useState(false);

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
                params: {query: queryObjects},
                headers: {
                    'Authorization': authHeader
                }
            }
            let endpoint = '/found-objects' + (selectedInstitute ? `/organizations/${selectedInstitute.id}` : '');
            let res = await axios.get(BACK_URL + endpoint, //esto es inseguro pero ok...
                config );
            let jsonData = res.data;
            if(jsonData.found_objects.length === 0) {
                navigation.navigate('NotFoundObjects');
            }else{
                navigation.navigate('FoundObjects',
                    {
                        objectsFound: jsonData.found_objects
                    });
            }

        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    return (
        <View style={styles.container}>
            <View style={styles.formContainer}>
                <Text style={styles.labelText}>Descripción del objeto</Text>
                <TextInput
                    style={styles.textArea}
                    placeholder="Escribe una descripción"
                    multiline
                    onChangeText={(text) => setQueryObjects(text)}
                />
                <Text style={styles.labelText}>Establecimiento donde lo perdiste</Text>
                <InstitutePicker setSelected={(institution) => setSelectedInstitution(institution)} />
            </View>
            {buttonWasPressed ? (
                    loading ? (
                            <ActivityIndicator size="large" color="#111818" />
                        ) : (
                            <View></View>
                        )
                ) : (<View />)
            }
            <EurekappButton text="Buscar Objeto" onPress={queryLostObject} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        width: '100%',
        justifyContent: 'center',
        backgroundColor: '#fff',
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        padding: 16,
        paddingBottom: 8,
    },
    headerText: {
        color: '#111818',
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
        flex: 1,
        paddingLeft: 48,
        paddingRight: 48,
        fontFamily: 'PlusJakartaSans-Regular'
    },
    formContainer: {
        flexDirection: 'column',
        flex: 1,
        width: '90%',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
    },
    labelText: {
        color: '#111818',
        fontSize: 16,
        fontWeight: '500',
        paddingBottom: 8,
        width: '100%',
        marginTop: 10,
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
    },
});

export default FindObject;