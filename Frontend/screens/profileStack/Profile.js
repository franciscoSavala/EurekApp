import React, {useEffect, useState} from "react";

import {
    FlatList,
    Image,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from "react-native";
import {Controller, useForm} from "react-hook-form";
import EurekappButton from "../components/Button";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";



const Profile = ({ route, navigation }) => {

    const { control,
        handleSubmit,
        formState: {errors},
        setValue,
        getValues ,
        setError} = useForm();
    const [enableModification, setEnableModification] = useState(false);
    const [user, setUser] = useState('');
    const [organization, setOrganization] = useState('');

    useEffect(() => {
        const fetchUserData = async () => {
            const user = JSON.parse(await AsyncStorage.getItem('user'));
            setUser(user);
            if (user.role === 'ORGANIZATION_OWNER' || user.role === 'ORGANIZATION_EMPLOYEE') {
                const organization = await AsyncStorage.getItem('organization');
                setOrganization(JSON.parse(organization));
            }
        }
        fetchUserData();
    }, []);

    const InputForm = ({text, valueName, value , autoComplete = 'off', keyboardType = 'default', editable}) => {
        return (
            <TextInput
                placeholder={text}
                placeholderTextColor={'#638888'}
                onChangeText={(value) => setValue(valueName, value)}
                value={value}
                style={styles.textArea}
                renderErrorMessage={false}
                autoComplete={autoComplete}
                keyboardType={keyboardType}
                editable={editable}
            />
        );
    }

    const hasOrganizationRole = () => {
        return user?.role === 'ORGANIZATION_OWNER' || user?.role === 'ORGANIZATION_EMPLOYEE';
    };

    const translateRole = () => {
        var role = '';
        if(user.role === 'ORGANIZATION_OWNER'){role = 'Administrador de organización';}
        if(user.role === 'ORGANIZATION_EMPLOYEE'){role = 'Empleado de organización';}
        if(user.role === 'USER'){role = 'Usuario regular';}
        return role;
    };

    return (
        <View style={styles.container}>
            <View style={styles.formContainer}>
                <Text style={styles.label}>{"\n"}Nombre:</Text>
                <Controller
                    control={control}
                    render={({onChange, value}) => (
                        <InputForm
                            text={user.firstName}
                            valueName='FirstName'
                            value={value}
                            editable={enableModification} // Pasamos la variable enableModification
                            style={{
                                backgroundColor: enableModification ? 'white' : 'gray', // Color de fondo en función de enableModification
                                color: enableModification ? 'black' : 'lightgray'       // Color del texto
                            }}
                        />
                    )}
                    name='FirstName'
                    rules={{
                        required: { value: true, message: 'No puedes dejar el nombre vacío.' },
                    }}
                    defaultValue=''
                />

                <Text style={styles.label}>{"\n"}Apellido:</Text>
                <Controller
                    control={control}
                    render={({onChange, value}) => (
                        <InputForm
                            text={user.lastName}
                            valueName='LastName'
                            value={value}
                            editable={enableModification} // Pasamos la variable enableModification
                            style={{
                                backgroundColor: enableModification ? 'white' : 'gray', // Color de fondo en función de enableModification
                                color: enableModification ? 'black' : 'lightgray'       // Color del texto
                            }}
                        />
                    )}
                    name='LastName'
                    rules={{
                        required: { value: true, message: 'No puedes dejar el apellido vacío.' },
                    }}
                    defaultValue=''
                />

                <Text style={styles.label}>{"\n"}Email:</Text>
                <Controller
                    control={control}
                    render={({onChange, value}) => (
                        <InputForm
                            text={user.username}
                            valueName='username'
                            value={value}
                            editable={enableModification} // Pasamos la variable enableModification
                            style={{
                                backgroundColor: enableModification ? 'white' : 'gray', // Color de fondo en función de enableModification
                                color: enableModification ? 'black' : 'lightgray'       // Color del texto
                            }}
                        />
                    )}
                    name='LastName'
                    rules={{
                        required: { value: true, message: 'EL email es obligatorio.' },
                    }}
                    defaultValue=''
                />
                <Text style={styles.label}>{"\n"}Tipo de usuario: <Text style={{ fontWeight: 'bold' }}>{translateRole()}</Text></Text>
                {hasOrganizationRole() &&(
                    <>
                        <Text style={styles.label}>{"\n"}Organización: <Text style={{ fontWeight: 'bold' }}>{organization.name}</Text></Text>
                    </>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'center',
        backgroundColor: '#fff',
    },
    formContainer: {
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'center',
        maxWidth:'800px',
        width: '100%',
        alignSelf:"center"
    },
    label: {
        alignSelf: 'flex-start',
        marginLeft: 10,
        color: '#111818',
        fontSize: 16,
        fontWeight: '500',
        fontFamily: 'PlusJakartaSans-Regular'
    },
    textArea: {
        resize: 'none',
        overflow: 'hidden',
        alignSelf: 'stretch',
        borderRadius: 12,
        color: '#111818',
        backgroundColor: '#f0f4f4',
        fontSize: 16,
        fontWeight: 'normal',
        placeholderTextColor: '#638888',
        fontFamily: 'PlusJakartaSans-Regular',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderBottomWidth: 0,
        marginHorizontal: 10,
    },
});

export default Profile;