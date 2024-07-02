import React, { useState } from "react";
import {Picker, StyleSheet, Text, TextInput, View} from 'react-native';
import axios from "axios";
import Constants from "expo-constants";
import EurekappButton from "./components/Button";


const BACK_URL = Constants.expoConfig.extra.backUrl;

const FindObject = ({ navigation }) => {
    const [selectedValue, setSelectedValue] = React.useState("one");
    const [queryObjects, setQueryObjects] = useState("");
    const [loading, setLoading] = useState(false);
    const [buttonWasPressed, setButtonWasPressed] = useState(false);

    const queryLostObject = async () => {
        setLoading(true);
        setButtonWasPressed(true);
        console.log(BACK_URL)
        try {
            let res = await axios.get(BACK_URL + "/found-objects",
                {params: {query: queryObjects}});
            let jsonData = res.data;
            console.log(jsonData)
            navigation.navigate('FoundObjects', jsonData.found_objects)
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
                />
                <Text style={styles.labelText}>Establecimiento donde lo perdiste</Text>
                <View style={styles.pickerContainer}>
                    <Picker
                        selectedValue={selectedValue}
                        style={styles.picker}
                        onValueChange={(itemValue) => setSelectedValue(itemValue)}
                    >
                        <Picker.Item label="Selecciona el establecimiento" value="one" />
                        <Picker.Item label="two" value="two" />
                        <Picker.Item label="three" value="three" />
                    </Picker>
                </View>
            </View>
            {/*{buttonWasPressed ? (
                    loading ? (
                            <Text style={styles.loadingText}>Cargando...</Text>
                        ) : (
                            <Text>PASAR A LA OTRA SCREEN</Text>
                        )
                ) : (<View />)
            }*/}
            <EurekappButton title="Buscar Objeto" onPress={queryLostObject} />
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