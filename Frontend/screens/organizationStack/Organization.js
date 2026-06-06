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
import EurekappButton from "../components/Button";
import LoadingOverlay from "../components/LoadingOverlay";
import InfoModal from "../components/InfoModal";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import useAuthFetch from "../../utils/useAuthFetch";
import { colors } from "../../styles/globalStyles";
import Icon from "react-native-vector-icons/FontAwesome6";

const BACK_URL = Constants.expoConfig.extra.backUrl;

const InputForm = ({text, valueName, value, autoComplete = 'off', keyboardType = 'default', editable, setValue, clearErrors, onChange}) => (
    <TextInput
        placeholder={text}
        placeholderTextColor={colors.textMuted}
        onChangeText={(v) => {
            clearErrors(valueName);
            onChange?.();
            setValue(valueName, v);
        }}
        value={value}
        style={styles.textArea}
        renderErrorMessage={false}
        autoComplete={autoComplete}
        keyboardType={keyboardType}
        editable={editable}
    />
);

const Organization = ({ route, navigation }) => {
    const { authFetch } = useAuthFetch();

    const { control,
        handleSubmit,
        formState: {errors},
        setValue,
        getValues,
        setError,
        clearErrors} = useForm();
    const [enableModification, setEnableModification] = useState(false);
    const [user, setUser] = useState('');
    const [organization, setOrganization] = useState('');
    const [employees, setEmployees] = useState('');
    const [loading, setLoading] = useState(false);

    const [deleteEmployeeModal, setDeleteEmployeeModal] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);

    const [addEmployeeModal, setAddEmployeeModal] = useState(false);
    const [buttonWasPressed, setButtonWasPressed] = useState(false);
    const [responseOk, setResponseOk] = useState(false);

    const [encargadoConfirmModal, setEncargadoConfirmModal] = useState(false);
    const [encargadoAction, setEncargadoAction] = useState(null); // 'assign' | 'revoke'
    const [encargadoResultModal, setEncargadoResultModal] = useState(false);
    const [encargadoResultOk, setEncargadoResultOk] = useState(false);
    const [encargadoLoading, setEncargadoLoading] = useState(false);

    useEffect(() => {
        const fetchOrganizationData = async () => {
            const organization = await AsyncStorage.getItem('organization');
            if (organization) setOrganization(JSON.parse(organization));
            const raw = await AsyncStorage.getItem('user');
            if (raw) setUser(JSON.parse(raw));
        }
        fetchOrganizationData();
        queryEmployees();
    }, []);

    const queryEmployees = async () => {
        setLoading(true);
        try {
            const jsonData = await authFetch('get', `${BACK_URL}/organizations/employees`);
            setEmployees(jsonData.users);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    const openEncargadoConfirm = (item, action) => {
        setSelectedEmployee(item.id);
        setEncargadoAction(action);
        setEncargadoConfirmModal(true);
    };

    const handleEncargadoAction = async () => {
        setEncargadoConfirmModal(false);
        setEncargadoLoading(true);
        try {
            const endpoint = encargadoAction === 'assign'
                ? '/organizations/assign_encargado'
                : '/organizations/revoke_encargado';
            await authFetch('post', `${BACK_URL}${endpoint}`, { userId: selectedEmployee });
            const newRole = encargadoAction === 'assign' ? 'ENCARGADO' : 'ORGANIZATION_EMPLOYEE';
            setEmployees(prev => prev.map(e => e.id === selectedEmployee ? { ...e, role: newRole } : e));
            setEncargadoResultOk(true);
        } catch (error) {
            console.error(error);
            setEncargadoResultOk(false);
        } finally {
            setEncargadoLoading(false);
            setEncargadoResultModal(true);
        }
    };

    const renderItem = ({ item }) => {
        const isEncargado = item.role === 'ENCARGADO';
        return (
            <View  style={[styles.item]}>
                <View style={styles.itemTextContainer}>
                    <Text style={[styles.itemText, {fontFamily: 'PlusJakartaSans-Bold'}]}>
                        {item.firstName} {item.lastName}
                    </Text>
                    <Text style={styles.itemText}>
                        {item.username}
                    </Text>
                    <View style={[styles.roleBadge, isEncargado ? styles.roleBadgeEncargado : styles.roleBadgeEmpleado]}>
                        <Text style={[styles.roleBadgeText, { color: isEncargado ? '#19b8b8' : '#638888' }]}>
                            {isEncargado ? 'Encargado' : 'Empleado'}
                        </Text>
                    </View>
                </View>
                <View style={styles.actionButtons}>
                    {!isEncargado ? (
                        <TouchableOpacity style={styles.assignButton} onPress={() => openEncargadoConfirm(item, 'assign')}>
                            <Text style={styles.assignButtonText}>Asignar encargado</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity style={styles.revokeButton} onPress={() => openEncargadoConfirm(item, 'revoke')}>
                            <Icon name="user-minus" size={13} color="#fff" style={{ marginRight: 5 }} />
                            <Text style={styles.revokeButtonText}>Eliminar encargado</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.deleteButton} onPress={() => {setDeleteEmployeeModal(true);setSelectedEmployee(item.id);}}>
                        <Text style={styles.deleteButtonText}>Eliminar</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    const closeAddEmployeeModal = () => {
        setAddEmployeeModal(false);
        setButtonWasPressed(false);
        setLoading(false);
        setResponseOk(false);
        clearErrors('employeeUsername');
        setValue('employeeUsername', '');
    };

    const onAddEmployeeFormSubmit = async () => {
        const employeeUsername = getValues('employeeUsername');
        if(employeeUsername === ""){
            setError('employeeUsername', {
                type: 'manual',
                message: "El email es obligatorio.",
            })
            return;
        }
        setButtonWasPressed(true);
        setLoading(true);
        try {
            await authFetch('post', `${BACK_URL}/organizations/add_employee`, { employeeUsername });
            setResponseOk(true);
        } catch (error) {
            setResponseOk(false);
            setError('employeeUsername', {
                type: 'manual',
                message: error.response?.data?.message ?? 'Error al agregar empleado.'
            })
        } finally {
            setLoading(false);
        }
    }

    const StatusComponent = () => {
        return(
            <View>
                {buttonWasPressed ? (
                    loading ? (
                        <ActivityIndicator style={{marginVertical: 10}} size="large" color="#111818" />
                    ) : (
                        responseOk ? (
                            <View style={{alignItems: 'center'}}>
                                <Icon style={{marginVertical: 10}} name={'circle-check'} size={50} color={'#008000'}/>
                                <Text style={{textAlign: 'center', color: '#008000', fontWeight: 'bold', fontSize: 15}}>¡Solicitud enviada correctamente!</Text>
                                <Text style={{textAlign: 'center', color: '#444', marginTop: 4, fontSize: 13}}>El usuario recibirá una notificación para unirse a la organización.</Text>
                            </View>
                        ) : (
                            <Icon style={{marginVertical: 10}} name={'circle-xmark'} size={50} color={'#ED4337'}/>
                        )
                    )
                ) : null
                }
            </View>
        );
    }

    const handleDeleteEmployee = async (id) => {
        try {
            await authFetch('post', `${BACK_URL}/organizations/delete_employee`, { userId: id });
            setEmployees((prevEmployees) => prevEmployees.filter(employee => employee.id !== id));
        } catch (error) {
            console.error(error);
        } finally {
            setDeleteEmployeeModal(false);
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

                <View style={styles.explanatoryTextContainer}>
                    <Text style={[styles.label, {
                        fontSize: 13,
                        textAlign: 'left',
                        color: '#939393',
                        marginBottom: 10,
                    }]}>{"\n"}Para modificar los datos de tu organización, incluyendo su ubicación, envía un correo a soporte@eurekapp.com
                    </Text>
                </View>

                <Text style={styles.label}>{"\n"}Nombre:</Text>
                <Controller
                    control={control}
                    render={({onChange, value}) => (
                        <InputForm
                            text={organization.name}
                            valueName='Name'
                            value={value}
                            editable={enableModification}
                            setValue={setValue}
                            clearErrors={clearErrors}
                        />
                    )}
                    name='Name'
                    rules={{
                        required: { value: true, message: 'No puedes dejar el nombre vacío.' },
                    }}
                    defaultValue=''
                />

                <Text style={styles.label}>{"\n"}Información de contacto:</Text>
                <Controller
                    control={control}
                    render={({onChange, value}) => (
                        <InputForm
                            text={organization.contactData}
                            valueName='ContactData'
                            value={value}
                            editable={enableModification}
                            setValue={setValue}
                            clearErrors={clearErrors}
                        />
                    )}
                    name='ContactData'
                    rules={{
                        required: { value: true, message: 'No puedes dejar este campo vacío.' },
                    }}
                    defaultValue=''
                />

                <Text style={styles.label}>{"\n"}Empleados: </Text>

                <TouchableOpacity style={styles.addEmployeeButton} onPress={() => setAddEmployeeModal(true)}>
                    <Icon name={'plus'} size={24} color={colors.text} style={{paddingHorizontal: 20}} />
                    <Text style={styles.addEmployeeButtonText}>Agregar un empleado</Text>
                </TouchableOpacity>

                {user?.role === 'ORGANIZATION_OWNER' && (
                    <TouchableOpacity
                        style={[styles.addEmployeeButton, {marginTop: 8}]}
                        onPress={() => navigation.navigate('OrganizationPolicy')}>
                        <Icon name={'gear'} size={24} color={colors.text} style={{paddingHorizontal: 20}} />
                        <Text style={styles.addEmployeeButtonText}>Configurar políticas</Text>
                    </TouchableOpacity>
                )}

                <View style={styles.employeesContainer}>
                    { loading ?
                        <View style={{flex: 1, justifyContent: 'center'}}>
                            <ActivityIndicator size="large" style={{alignSelf: 'center'}} color={colors.text} />
                        </View>
                        : <FlatList
                            data={employees}
                            keyExtractor={(item) => item.id}
                            renderItem={renderItem}
                            contentContainerStyle={styles.contentContainer}
                            scrollEnabled={true}
                            //ListEmptyComponent={NotFoundComponent}
                             />
                    }

                </View>
            </View>
            <InfoModal
                visible={deleteEmployeeModal}
                onClose={() => setDeleteEmployeeModal(false)}
                type="warning"
                title="¿Eliminar empleado?"
                message={`Al eliminar este empleado, se desvinculará su usuario de tu organización. Si en el futuro querés volver a agregarlo, deberás enviarle una nueva solicitud.`}
                cancelLabel="Cancelar"
                confirmLabel="Eliminar"
                onConfirm={() => handleDeleteEmployee(selectedEmployee)}
            />

            <InfoModal
                visible={encargadoConfirmModal}
                onClose={() => setEncargadoConfirmModal(false)}
                type="warning"
                title={encargadoAction === 'assign' ? '¿Asignar encargado?' : '¿Revocar encargado?'}
                message={encargadoAction === 'assign'
                    ? 'Este usuario podrá gestionar confirmaciones y devoluciones de objetos.'
                    : '¿Deseas revocar el rol de encargado a este usuario?'}
                cancelLabel="Cancelar"
                confirmLabel={encargadoAction === 'assign' ? 'Asignar' : 'Revocar'}
                onConfirm={handleEncargadoAction}
            />

            <InfoModal
                visible={encargadoResultModal}
                onClose={() => setEncargadoResultModal(false)}
                type={encargadoResultOk ? 'info' : 'error'}
                title={encargadoResultOk
                    ? (encargadoAction === 'assign' ? 'Encargado asignado' : 'Rol revocado')
                    : 'Error'}
                message={encargadoResultOk
                    ? (encargadoAction === 'assign'
                        ? 'El rol de encargado fue asignado correctamente.'
                        : 'El rol de encargado fue revocado correctamente.')
                    : `Error al ${encargadoAction === 'assign' ? 'asignar' : 'revocar'} el rol. Intentá nuevamente.`}
                confirmLabel="Cerrar"
            />

            <LoadingOverlay visible={encargadoLoading} message="Procesando..." />

            <Modal
                animationType="none"
                transparent={true}
                visible={addEmployeeModal}
                onRequestClose={() => setAddEmployeeModal(!setAddEmployeeModal)}>
                <View style={styles.centeredView}>
                    <View style={styles.modalView}>
                        <Text style={styles.modalText}>
                            Para poder agregar un empleado, debes ingresar el correo electrónico asociado a su usuario de EurekApp.
                            {"\n"}Al presionar "Agregar empleado", se enviará una solicitud a dicho usuario.
                            {"\n"}{"\n"}El usuario figurará como empleado solamente luego de haber aceptado la solicitud.
                        </Text>
                        <Controller
                            control={control}
                            render={({ field: { value } }) => (
                                <InputForm
                                    text='E-mail'
                                    valueName='employeeUsername'
                                    value={value}
                                    setValue={setValue}
                                    clearErrors={clearErrors}
                                    onChange={() => {
                                        setButtonWasPressed(false);
                                        setResponseOk(false);
                                    }}
                                />
                            )}
                            name='employeeUsername'
                            rules={{
                                required: { value: true, message: 'El email es obligatorio.' },
                            }}
                            defaultValue=''
                        />
                        <Text style={styles.textError}>{errors.employeeUsername
                            ? errors.employeeUsername.message
                            : " " }
                        </Text>

                        <StatusComponent />

                        <EurekappButton text='Agregar empleado'
                                        onPress={() => onAddEmployeeFormSubmit()}/>
                        <EurekappButton text='Cerrar'
                                        onPress={() => closeAddEmployeeModal()}/>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    addEmployeeButton: {
        width:'100%',
        //backgroundColor: '#f0f4f4',
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        marginVertical: 5,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#000',
    },
    addEmployeeButtonText: {
        alignSelf: 'flex-start',
        color: colors.text,
        fontSize: 16,
        fontWeight: '500',
        fontFamily: 'PlusJakartaSans-Bold'
    },
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    container: {
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'center',
        backgroundColor: colors.background,
    },
    actionButtons: {
        flexDirection: 'column',
        gap: 6,
        alignItems: 'flex-end',
    },
    assignButton: {
        backgroundColor: '#19b8b8',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    assignButtonText: {
        color: 'white',
        fontSize: 12,
        fontFamily: 'PlusJakartaSans-Regular',
    },
    revokeButton: {
        backgroundColor: '#c0392b',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 5,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    revokeButtonText: {
        color: '#fff',
        fontSize: 12,
        fontFamily: 'PlusJakartaSans-Bold',
    },
    roleBadge: {
        marginTop: 4,
        paddingVertical: 2,
        paddingHorizontal: 8,
        borderRadius: 10,
        alignSelf: 'flex-start',
    },
    roleBadgeEncargado: {
        backgroundColor: '#e0f7f7',
    },
    roleBadgeEmpleado: {
        backgroundColor: '#f0f4f4',
    },
    roleBadgeText: {
        fontSize: 11,
        fontFamily: 'PlusJakartaSans-Regular',
    },
    deleteButton: {
        backgroundColor: 'red',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    deleteButtonText: {
        color: 'white',
        fontWeight: 'bold',
    },
    employeesContainer: {
        width:'100%',
        flex: 1,
    },
    explanatoryTextContainer: {
        justifyContent: 'center',
    },
    formContainer: {
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'center',
        maxWidth:'800px',
        width: '100%',
        alignSelf:"center",
        paddingHorizontal: 10,
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
    itemText: {
        color: colors.text,
        fontSize: 14,
        fontFamily: 'PlusJakartaSans-Regular',
    },
    label: {
        alignSelf: 'flex-start',
        marginLeft: 10,
        color: colors.text,
        fontSize: 16,
        fontWeight: '500',
        fontFamily: 'PlusJakartaSans-Regular'
    },
    modalText: {
        marginBottom: 15,
        textAlign: 'left',
        fontFamily: 'PlusJakartaSans-Regular',
    },
    modalView: {
        margin: 20,
        backgroundColor: colors.background,
        borderRadius: 20,
        padding: 35,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
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
});

export default Organization;