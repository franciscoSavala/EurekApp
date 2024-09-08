import React, {useEffect, useState} from "react";
import {ActivityIndicator, Alert, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import axios from "axios";
import Constants from "expo-constants";
import EurekappButton from "../components/Button";
import InstitutePicker from "../components/InstitutePicker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import EurekappDateComponent from "../components/EurekappDateComponent";


const BACK_URL = Constants.expoConfig.extra.backUrl;

const FindObject = ({ navigation }) => {
    const [selectedInstitute, setSelectedInstitution] = useState(null);
    const [queryObjects, setQueryObjects] = useState("");
    const [loading, setLoading] = useState(false);
    const [buttonWasPressed, setButtonWasPressed] = useState(false);
    const [lostDate, setLostDate] = useState(new Date());

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
                    'lost_date': lostDate.toISOString().split('.')[0]
                },
                headers: {
                    'Authorization': authHeader
                }
            }
            let endpoint = '/found-objects' + (selectedInstitute ? `/organizations/${selectedInstitute.id}` : '');
            let res = await axios.get(BACK_URL + endpoint, //esto es inseguro pero ok...
                config );
            let jsonData = res.data;
            if(jsonData.found_objects.length === 0) {
                navigation.navigate('NotFoundObjects', {
                    query: queryObjects,
                });
            }else{
                navigation.navigate('FoundObjects',
                    {
                        objectsFound: jsonData.found_objects,
                        query: queryObjects,
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
            <View style={{flex: 1, marginHorizontal: 10, justifyContent: 'space-between'}}>
                <View style={styles.formContainer}>
                    <Text style={styles.labelText}>Descripción del objeto</Text>
                    <TextInput
                        style={styles.textArea}
                        placeholder="Escribe una descripción"
                        multiline
                        onChangeText={(text) => setQueryObjects(text)}
                    />
                    <InstitutePicker setSelected={(institution) => setSelectedInstitution(institution)} />
                    <EurekappDateComponent labelText={'Fecha de pérdida de objeto: '}
                                           date={lostDate} setDate={setLostDate}/>
                </View>
                {buttonWasPressed ? (
                    loading ? <ActivityIndicator size="large" color="#111818" /> : null
                ) : null
                }
                <EurekappButton text="Buscar Objeto" onPress={queryLostObject} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    formContainer: {
        flex: 1,
        flexDirection: 'column',
        alignContent: 'center',
        justifyContent: 'flex-start',
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
});

export default FindObject;