import React, {useContext, useEffect, useState} from "react";
import { Ionicons } from '@expo/vector-icons';
import UsabilityFeedbackModal from "../components/UsabilityFeedbackModal";

import {
    ActivityIndicator,
    Alert,
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
import Constants from "expo-constants";
import useAuthFetch from "../../utils/useAuthFetch";
import { colors } from "../../styles/globalStyles";
import {LoginContext} from "../../hooks/useUser";

const BACK_URL = Constants.expoConfig.extra.backUrl;

const Profile = ({ route, navigation }) => {
    const { authFetch } = useAuthFetch();

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
    const [usabilityModalVisible, setUsabilityModalVisible] = useState(false);
    const { setUserRole } = useContext(LoginContext);

    useEffect(() => {
        const fetchUserData = async () => {
            const raw = await AsyncStorage.getItem('user');
            if (!raw) return;
            const user = JSON.parse(raw);
            setUser(user);
            if (user.role === 'ORGANIZATION_OWNER' || user.role === 'ORGANIZATION_EMPLOYEE' || user.role === 'ENCARGADO') {
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
                placeholderTextColor={colors.textMuted}
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
            const jsonData = await authFetch('get', `${BACK_URL}/organizations/getPendingAddEmployeeRequests`);
            setAddEmployeeRequests(jsonData.requests);
        } catch (error) {
            console.log(error);
        } finally {
            setLoading(false);
        }
    }


    const renderItem = ({ item }) => {
        return (
            <View  style={[styles.item]}>
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
            const result = await authFetch('post', `${BACK_URL}/organizations/acceptAddEmployeeRequest`, { requestId: id });
            setAddEmployeeRequests('');
            await refreshUserDetails();
            const raw = await AsyncStorage.getItem('user');
            if (raw) setUserRole(JSON.parse(raw).role);
            const orgName = result?.organization?.name ?? 'la organización';
            Alert.alert('¡Solicitud aceptada!', `Ahora formas parte de ${orgName}.`);
            navigation.replace("Profile");
        } catch (error) {
            console.log(error);
            Alert.alert('Error', 'No se pudo aceptar la solicitud. Intentá de nuevo.');
        }
    }

    const handleDeclineAddEmployeeRequest = async (id) => {
        try {
            await authFetch('post', `${BACK_URL}/organizations/declineAddEmployeeRequest`, { requestId: id });
            setAddEmployeeRequests((prevRequests) => prevRequests.filter(request => request.id !== id));
        } catch (error) {
            console.log(error);
        }
    }

    const refreshUserDetails = async () => {
        try {
            const data = await authFetch('get', `${BACK_URL}/user/refreshUserDetails`);
            await AsyncStorage.setItem('username', data.user.username.toString());
            await AsyncStorage.setItem('user.first_name', data.user.firstName.toString());
            await AsyncStorage.setItem('user', JSON.stringify(data.user));
            if (data.organization != null) {
                await AsyncStorage.setItem('org.id', data.organization.id.toString());
                await AsyncStorage.setItem('org.name', data.organization.name);
                await AsyncStorage.setItem('organization', JSON.stringify(data.organization));
            }
        } catch (error) {
            console.log(error);
        }
    }

    const hasOrganizationRole = () => {
        return user?.role === 'ORGANIZATION_OWNER' || user?.role === 'ORGANIZATION_EMPLOYEE' || user?.role === 'ENCARGADO';
    };

    const translateRole = () => {
        var role = '';
        if(user.role === 'ORGANIZATION_OWNER'){role = 'Administrador de organización';}
        if(user.role === 'ORGANIZATION_EMPLOYEE'){role = 'Empleado de organización';}
        if(user.role === 'ENCARGADO'){role = 'Encargado';}
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
                    name='username'
                    rules={{
                        required: { value: true, message: 'EL email es obligatorio.' },
                    }}
                    defaultValue=''
                />
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
                             <ActivityIndicator size="large" style={{alignSelf: 'center'}} color={colors.text} />
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
            <TouchableOpacity
                style={styles.feedbackButton}
                onPress={() => setUsabilityModalVisible(true)}>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.feedbackButtonText}>Dar feedback de usabilidad de la app</Text>
            </TouchableOpacity>
            <UsabilityFeedbackModal
                visible={usabilityModalVisible}
                onClose={() => setUsabilityModalVisible(false)}
                context="profile"
            />
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
        backgroundColor: colors.background,
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
        backgroundColor: colors.surface,
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
        color: colors.text,
        fontSize: 16,
        fontWeight: '500',
        fontFamily: 'PlusJakartaSans-Regular'
    },
    requestButtonText: {
        color: 'white',
        fontWeight: 'bold',
    },
    textArea: {
        resize: 'none',
        overflow: 'hidden',
        alignSelf: 'stretch',
        borderRadius: 12,
        color: colors.text,
        backgroundColor: colors.surface,
        fontSize: 16,
        fontWeight: 'normal',
        placeholderTextColor: colors.textMuted,
        fontFamily: 'PlusJakartaSans-Regular',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderBottomWidth: 0,
        marginHorizontal: 10,
    },
    feedbackButton: {
        marginBottom: 24,
        marginHorizontal: 16,
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 12,
        backgroundColor: '#0d9e9e',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '90%',
        alignSelf: 'center',
        shadowColor: '#0d9e9e',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
        elevation: 6,
    },
    feedbackButtonText: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 16,
        color: '#fff',
    },
});

export default Profile;