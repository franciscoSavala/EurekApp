import React, {useEffect, useState} from "react";

import {
    ActivityIndicator,
    FlatList,
    Image,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput, TouchableOpacity,
    View
} from "react-native";
import {Controller, useForm} from "react-hook-form";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import Constants from "expo-constants";

const BACK_URL = Constants.expoConfig.extra.backUrl;

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
    const [addEmployeeRequests, setAddEmployeeRequests] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchUserData = async () => {
            const user = JSON.parse(await AsyncStorage.getItem('user'));
            setUser(user);
            if (user.role === 'ORGANIZATION_OWNER' || user.role === 'ORGANIZATION_EMPLOYEE') {
                const organization = await AsyncStorage.getItem('organization');
                setOrganization(JSON.parse(organization));
            }else{
                getPendingAddEmployeeRequests()
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

    const getPendingAddEmployeeRequests = async () => {
        setLoading(true);
        try {
            let authHeader = 'Bearer ' + await AsyncStorage.getItem('jwt');
            let config = {
                headers: {
                    'Authorization': authHeader
                }
            }
            let res = await axios.get(BACK_URL + `/organizations/getPendingAddEmployeeRequests`, config );
            let jsonData = res.data;
            setAddEmployeeRequests(jsonData.requests);
            console.log(res.data);
            setLoading(false);
        } catch (error) {
            console.log(error)
        }
    }


    const renderItem = ({ item }) => {
        return (
            <View  style={[styles.item]}
                   onPress={() => setObjectSelectedId(item.id)}>
                <View style={styles.itemTextContainer}>
                    <Text style={[styles.itemText, {fontFamily: 'PlusJakartaSans-Bold'}]}>
                        {item.organizationName}
                    </Text>
                    <Text style={styles.itemText}>quiere que te unas a su organización.
                    </Text>
                </View>
                <View>
                    <TouchableOpacity style={styles.acceptButton} onPress={() => handleAcceptAddEmployeeRequest(item.id)}>
                        <Text style={styles.requestButtonText}>Aceptar</Text>
                    </TouchableOpacity>
                </View>
                <View>
                    <TouchableOpacity style={styles.rejectButton} onPress={() => handleDeclineAddEmployeeRequest(item.id)}>
                        <Text style={styles.requestButtonText}>Rechazar</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    const handleAcceptAddEmployeeRequest = async (id) => {
        try {
            let authHeader = 'Bearer ' + await AsyncStorage.getItem('jwt');
            let config = {
                headers: {
                    'Authorization': authHeader
                }
            }
            let res = await axios.post(BACK_URL + `/organizations/acceptAddEmployeeRequest`,
                {requestId: id} ,config );
            console.log(res.data);
            setAddEmployeeRequests('');
            await refreshUserDetails();
            navigation.replace("Profile");
        } catch (error) {
            console.log(error)
        }
    }

    const handleDeclineAddEmployeeRequest = async (id) => {
        try {
            let authHeader = 'Bearer ' + await AsyncStorage.getItem('jwt');
            let config = {
                headers: {
                    'Authorization': authHeader
                }
            }
            let res = await axios.post(BACK_URL + `/organizations/declineAddEmployeeRequest`,
                {requestId: id} ,config );
            console.log(res.data);
            if (res.status === 200) {
                setAddEmployeeRequests((prevRequests) => prevRequests.filter(request => request.id !== id));

            }
        } catch (error) {
            console.log(error)
        }
    }

    const refreshUserDetails = async () => {
        try {
            let authHeader = 'Bearer ' + await AsyncStorage.getItem('jwt');
            let config = {
                headers: {
                    'Authorization': authHeader
                }
            }
            let res = await axios.get(BACK_URL + `/user/refreshUserDetails`,config );
            console.log(res.data);
            if (res.status === 200) {
                await AsyncStorage.setItem('username', res.data.user.username.toString());
                await AsyncStorage.setItem('user.first_name', res.data.user.firstName.toString());
                await AsyncStorage.setItem('user', JSON.stringify(res.data.user));
                if(res.data.organization != null) {
                    await AsyncStorage.setItem('org.id', res.data.organization.id.toString());
                    await AsyncStorage.setItem('org.name', res.data.organization.name);
                    await AsyncStorage.setItem('organization', JSON.stringify(res.data.organization));
                }
            }
        } catch (error) {
            console.log(error)
        }
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
                <TouchableOpacity style={styles.modifyButton} onPress={() => {}}>
                    <Text style={styles.buttonText}>Modificar datos</Text>
                </TouchableOpacity>
                <View style={{flexDirection: "row", alignSelf: 'flex-start'}}>
                    <Text style={[styles.label, {maxWidth: '50%'}]}>{"\n"}Tipo de usuario: </Text>
                    <Text style={[styles.label, {fontWeight: 'bold', marginLeft:'0px' } ]}>{"\n"}{translateRole()}</Text>
                </View>
                {hasOrganizationRole() &&(
                    <>
                        <Text style={styles.label}>{"\n"}Organización: <Text style={{ fontWeight: 'bold' }}>{organization.name}</Text></Text>
                    </>
                )}
                {!hasOrganizationRole() &&(
                    <>
                    <View style={styles.addEmployeeRequestsContainer}>
                    { loading ?(
                         <View style={{flex: 1, justifyContent: 'center'}}>
                             <ActivityIndicator size="large" style={{alignSelf: 'center'}} color="#111818" />
                         </View>

                    ) : addEmployeeRequests.length>0 ? (
                            <>
                                <Text style={styles.label}>{"\n"}Solicitudes: </Text>
                                <FlatList
                                  data={addEmployeeRequests}
                                  keyExtractor={(request) => request.id}
                                   renderItem={renderItem}
                                 contentContainerStyle={styles.contentContainer}
                                 scrollEnabled={true}
                                    //ListEmptyComponent={NotFoundComponent}
                               />
                            </>
                        ): null
                    }
                    </View>
                    </>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    addEmployeeRequestsContainer: {
        width:'100%',
        flex: 1,
    },
    acceptButton: {
        backgroundColor: 'green',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'center',
        backgroundColor: '#fff',
    },
    rejectButton: {
        backgroundColor: 'red',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    formContainer: {
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'center',
        maxWidth:'800px',
        width: '100%',
        alignSelf:"center",
        paddingHorizontal: 10
    },
    item: {
        width:'100%',
        backgroundColor: '#f0f4f4',
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        marginVertical: 5,
        borderRadius: 16,
    },
    itemTextContainer: {
        flex: 2,
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
    },
    label: {
        alignSelf: 'flex-start',
        marginLeft: 10,
        color: '#111818',
        fontSize: 16,
        fontWeight: '500',
        fontFamily: 'PlusJakartaSans-Regular'
    },
    requestButtonText: {
        color: 'white',
        fontWeight: 'bold',
    },
    buttonText: {
        color: '#111818',
        fontWeight: 'bold',
        fontSize: 14,
        fontFamily: 'PlusJakartaSans-Bold',
        textAlign: "center",
    },
    modifyButton: {
        backgroundColor: '#19e6e6',
        paddingVertical: 8,
        paddingHorizontal: 5,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'center',
        margin: 2,
        width:"175px",
        maxWidth:"59%"
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