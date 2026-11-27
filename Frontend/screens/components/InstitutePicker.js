import React, {useEffect, useState} from "react";
import {Picker} from "@react-native-picker/picker";
import Constants from "expo-constants";
import {Text, View} from "react-native";
import useAuthFetch from "../../utils/useAuthFetch";
import ErrorRetry from "./ErrorRetry";

const BACK_URL = Constants.expoConfig.extra.backUrl;

const InstitutePicker = ({ setSelected, selectedValue = "" }) => {
    const { authFetch } = useAuthFetch();
    const [institutionList, setInstitutionList] = useState([]);
    const [pickerFocused, setPickerFocused] = useState(false);
    const [loadFailed, setLoadFailed] = useState(false);

    const fetchInstitutes = async () => {
        try {
            const data = await authFetch('get', `${BACK_URL}/organizations`);
            setInstitutionList(data.organizations);
            setLoadFailed(false);
        } catch (error) {
            if (__DEV__) console.error(error);
            setLoadFailed(true);
        }
    };

    useEffect(() => {
        fetchInstitutes();
    }, []);

    const onValueChange = (itemValue) => {
        setSelected(institutionList.find(org => org.id === Number(itemValue)));
    };
    return (
        <View style={styles.pickerContainer}>
            <Text style={styles.labelText}>Establecimiento donde lo perdiste</Text>
            <Picker
                selectedValue={selectedValue}
                style={styles.picker}
                onValueChange={onValueChange}
                onFocus={() => setPickerFocused(true)}
                onBlur={() => setPickerFocused(false)}
            >
                <Picker.Item label="No lo recuerdo / No lo sé"
                             value="" />
                {institutionList.map((org) => (
                    <Picker.Item label={org.name} value={org.id} key={org.id} />
                ))}
            </Picker>
            {loadFailed && (
                <ErrorRetry message="No pudimos cargar los establecimientos." onRetry={fetchInstitutes} />
            )}
        </View>
    );
}

const styles = {
    pickerContainer: {
        alignSelf: 'stretch',
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
    labelText: {
        color: '#111818',
        fontSize: 16,
        fontFamily: 'PlusJakartaSans-Regular'
    },
}

export default InstitutePicker;