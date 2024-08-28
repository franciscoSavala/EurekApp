import React, {useEffect, useState} from "react";
import {Picker} from "@react-native-picker/picker";
import axios from "axios";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {View} from "react-native";

const BACK_URL = Constants.expoConfig.extra.backUrl;

const InstitutePicker = ({ setSelected }) => {
    const [institutionList, setInstitutionList] = useState([]);
    const [pickerFocused, setPickerFocused] = useState(false);
    const [selectedInstitute, setSelectedInstitution] = useState("");
    useEffect(() => {
        const fetchInstitutes = async () => {
            try {
                let authHeader = 'Bearer ' + await AsyncStorage.getItem('jwt');
                let config = {
                    headers: {
                        'Authorization': authHeader
                    }
                }
                let res = await axios.get(BACK_URL + "/organizations", config);
                let jsonData = res.data;
                setInstitutionList(jsonData.organizations);
            } catch (error) {
                console.error(error);
            }
        }
        fetchInstitutes();
    }, []);

    const onValueChange = (itemValue, itemIndex) => {
        setSelectedInstitution(itemValue);
        setSelected(institutionList.find(org => org.id === Number(itemValue)))
    }
    return (
        <View style={styles.pickerContainer}>
            <Picker
                selectedValue={selectedInstitute}
                style={styles.picker}
                onValueChange={onValueChange}
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
    );
}

const styles = {
    pickerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignSelf: 'stretch',
        marginBottom: 10,
    },
    picker: {
        borderRadius: 12,
        color: '#638888',
        fontSize: 16,
        backgroundColor: '#f0f4f4',
        padding: 16,
        borderWidth: 0,
        fontFamily: 'PlusJakartaSans-Regular',
    },
}

export default InstitutePicker;