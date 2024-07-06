import React, {useEffect, useState} from "react";
import {Picker} from "@react-native-picker/picker";
import axios from "axios";
import Constants from "expo-constants";

const BACK_URL = Constants.expoConfig.extra.backUrl;

const InstitutePicker = ({ setSelected }) => {
    const [institutionList, setInstitutionList] = useState([]);
    const [pickerFocused, setPickerFocused] = useState(false);
    const [selectedInstitute, setSelectedInstitution] = useState("");
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

    const onValueChange = (itemValue, itemIndex) => {
        setSelectedInstitution(itemValue);
        setSelected(institutionList.find(org => org.id === Number(itemValue)))
    }
    return (
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
    );
}

const styles = {
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
        fontFamily: 'PlusJakartaSans-Regular',
        marginBottom: 10,
    },
}

export default InstitutePicker;