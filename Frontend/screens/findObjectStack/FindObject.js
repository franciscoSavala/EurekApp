import React, {useEffect, useState} from "react";
import {ActivityIndicator, Alert, StyleSheet, Text, TextInput, View} from 'react-native';
import axios from "axios";
import Constants from "expo-constants";
import EurekappButton from "../components/Button";
import {Picker} from '@react-native-picker/picker';


const BACK_URL = Constants.expoConfig.extra.backUrl;

const FindObject = ({ navigation }) => {
    const [selectedInstitute, setSelectedInstitution] = useState("");
    const [queryObjects, setQueryObjects] = useState("");
    const [loading, setLoading] = useState(false);
    const [buttonWasPressed, setButtonWasPressed] = useState(false);
    const [pickerFocused, setPickerFocused] = useState(false);
    const [institutionList, setInstitutionList] = useState([]);

    useEffect(() => {
        const fetchInstitutes = async () => {
            try {
                let res = await axios.get(BACK_URL + "/organizations");
                let jsonData = res.data;
                setInstitutionList(jsonData.organizations);
            } catch (error) {
                console.error(error);
            }
        }
        fetchInstitutes();
    }, []);

    const validateInputConstraints = () => {
        if(!selectedInstitute || !queryObjects) {
            Alert.alert("No se seleccionó una institución");
            return false;
        }
        if (queryObjects.length > 255) {
            Alert.alert("La descripción del objeto es muy larga");
            return false;
        }
        return true;
    }

    const queryLostObject = async () => {
        if(!validateInputConstraints()) return;
        setLoading(true);
        setButtonWasPressed(true);
        try {
            let res = await axios.get(BACK_URL + `/found-objects/organizations/${selectedInstitute}`, //esto es inseguro pero ok...
                {params: {query: queryObjects}});
            let jsonData = res.data;
            if(jsonData.found_objects.length === 0) {
                navigation.navigate('NotFoundObjects');
            }else{
                navigation.navigate('FoundObjects',
                    {
                        objectsFound: jsonData.found_objects,
                        institution: institutionList.find(org =>
                            org.id === Number(selectedInstitute))
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
                <Picker
                    selectedValue={selectedInstitute}
                    style={styles.picker}
                    onValueChange={(itemValue, itemIndex) => {
                        setSelectedInstitution(itemValue)}}
                    onFocus={() => setPickerFocused(true)}
                    onBlur={() => setPickerFocused(false)}
                >
                    <Picker.Item label="Selecciona el establecimiento"
                                 value=""
                                 enabled={!pickerFocused}/>
                    {institutionList.map((org) => (
                        <Picker.Item label={org.name} value={org.id} key={org.id} />
                    ))}
                </Picker>
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
        fontFamily: 'PlusJakartaSans-Regular'
    },
    pickerContainer: {
        overflow: 'hidden',
        width: '100%'
    },
    picker: {
        width: '100%',
        borderRadius: 12,
        height: 56,
        color: '#638888',
        fontSize: 16,
        fontWeight: 'normal',
        backgroundColor: '#f0f4f4',
        padding: 16,
        borderWidth: 0,
        fontFamily: 'PlusJakartaSans-Regular'
    },
});

export default FindObject;