import React, {useContext, useEffect, useState} from "react";
import { Ionicons } from '@expo/vector-icons';
import UsabilityFeedbackModal from "../components/UsabilityFeedbackModal";

import Toast from 'react-native-toast-message';
import {
    ActivityIndicator,
    DeviceEventEmitter,
    FlatList,
    Image,
    Modal,
    Platform,
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
    const [fieldErrors, setFieldErrors] = useState({});
    const [saving, setSaving] = useState(false);
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

    const renderInput = ({text, valueName, value, editable}) => (
        <TextInput
            placeholder={text}
            placeholderTextColor={colors.textMuted}
            onChangeText={(v) => setValue(valueName, v)}
            value={value}
            style={[styles.textArea, editable && styles.textAreaEditable]}
            autoComplete='off'
            editable={editable}
        />
    );

    const startEditing = () => {
        setValue('FirstName', user.firstName || '');
        setValue('LastName', user.lastName || '');
        setFieldErrors({});
        setEnableModification(true);
    };

    const cancelEditing = () => {
        setValue('FirstName', '');
        setValue('LastName', '');
        setFieldErrors({});
        setEnableModification(false);
    };

    const saveProfile = async () => {
        const first = (getValues('FirstName') || '').trim();
        const last = (getValues('LastName') || '').trim();
        const errs = {};
        if (!first) errs.first = 'El nombre es obligatorio: no puede quedar vacío.';
        else if (first.length > 50) errs.first = 'El nombre no puede superar los 50 caracteres.';
        if (!last) errs.last = 'El apellido es obligatorio: no puede quedar vacío.';
        else if (last.length > 50) errs.last = 'El apellido no puede superar los 50 caracteres.';
        setFieldErrors(errs);
        if (errs.first || errs.last) return;
        setSaving(true);
        try {
            const data = await authFetch('put', `${BACK_URL}/user/profile`, { firstName: first, lastName: last });
            await AsyncStorage.setItem('user.first_name', data.user.firstName.toString());
            await AsyncStorage.setItem('user', JSON.stringify(data.user));
            setUser(data.user);
            DeviceEventEmitter.emit('userNameChanged');
            setValue('FirstName', '');
            setValue('LastName', '');
            setEnableModification(false);
            Toast.show({ type: 'success', text1: '¡Datos actualizados!', text2: 'Tu nombre y apellido se guardaron.' });
        } catch (error) {
            const msg = error?.response?.data?.description || error?.response?.data?.message || 'No se pudieron guardar los cambios. Intentá de nuevo.';
            Toast.show({ type: 'error', text1: 'Error', text2: msg });
        } finally {
            setSaving(false);
        }
    };

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
            if (raw) {
                const updatedUser = JSON.parse(raw);
                setUserRole(updatedUser.role);
                setUser(updatedUser);
            }
            const orgRaw = await AsyncStorage.getItem('organization');
            if (orgRaw) setOrganization(JSON.parse(orgRaw));
            const orgName = result?.organization?.name ?? 'la organización';
            Toast.show({ type: 'success', text1: '¡Solicitud aceptada!', text2: `Ahora formas parte de ${orgName}.` });
            if (Platform.OS === 'web') {
                setTimeout(() => window.location.reload(), 1500);
            }
        } catch (error) {
            console.log(error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'No se pudo aceptar la solicitud. Intentá de nuevo.' });
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
        if(user.role === 'ORGANIZATION_OWNER'){role = 'Dueño de organización';}
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
                    render={() => renderInput({text: user.firstName, valueName: 'FirstName', value: getValues('FirstName'), editable: enableModification})}
                    name='FirstName'
                    defaultValue=''
                />
                {fieldErrors.first ? <Text style={styles.errorText}>{fieldErrors.first}</Text> : null}

                <Text style={styles.label}>{"\n"}Apellido:</Text>
                <Controller
                    control={control}
                    render={() => renderInput({text: user.lastName, valueName: 'LastName', value: getValues('LastName'), editable: enableModification})}
                    name='LastName'
                    defaultValue=''
                />
                {fieldErrors.last ? <Text style={styles.errorText}>{fieldErrors.last}</Text> : null}

                <Text style={styles.label}>{"\n"}Email:</Text>
                <TextInput
                    placeholder={user.username}
                    placeholderTextColor={colors.textMuted}
                    style={styles.textArea}
                    editable={false}
                />
                <View style={styles.editButtonsRow}>
                    {enableModification ? (
                        <>
                            <TouchableOpacity style={[styles.editButton, styles.saveButton]} onPress={saveProfile} disabled={saving}>
                                <Text style={styles.requestButtonText}>Guardar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.editButton, styles.cancelButton]} onPress={cancelEditing} disabled={saving}>
                                <Text style={styles.requestButtonText}>Cancelar</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <TouchableOpacity style={[styles.editButton, styles.saveButton]} onPress={startEditing}>
                            <Text style={styles.requestButtonText}>Editar</Text>
                        </TouchableOpacity>
                    )}
                </View>
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
    textAreaEditable: {
        borderWidth: 1,
        borderColor: colors.textMuted,
    },
    errorText: {
        alignSelf: 'flex-start',
        marginLeft: 10,
        color: 'red',
        fontSize: 14,
        fontFamily: 'PlusJakartaSans-Regular',
    },
    editButtonsRow: {
        flexDirection: 'row',
        alignSelf: 'flex-start',
        marginLeft: 10,
        marginTop: 16,
    },
    editButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
        marginRight: 10,
    },
    saveButton: { backgroundColor: '#0d9e9e' },
    cancelButton: { backgroundColor: 'gray' },
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