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
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import Constants from "expo-constants";
import Icon from "react-native-vector-icons/FontAwesome6";

const BACK_URL = Constants.expoConfig.extra.backUrl;

const Organization = ({ route, navigation }) => {

    const { control,
        handleSubmit,
        formState: {errors},
        setValue,
        getValues ,
        setError} = useForm();
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

    useEffect(() => {
        const fetchOrganizationData = async () => {
            const organization = await AsyncStorage.getItem('organization');
            setOrganization(JSON.parse(organization));
        }
        fetchOrganizationData();
        queryEmployees();
    }, []);

    const queryEmployees = async () => {
        setLoading(true);
        try {
            let authHeader = 'Bearer ' + await AsyncStorage.getItem('jwt');
            let config = {
                params: {
                },
                headers: {
                    'Authorization': authHeader
                }
            }
            let endpoint = "/organizations/employees";
            let res = await axios.get( BACK_URL + endpoint, //esto es inseguro pero ok...
                config );
            let jsonData = res.data;
            setEmployees(jsonData.users);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    const renderItem = ({ item }) => {
        return (
            <View  style={[styles.item]}
                       onPress={() => setObjectSelectedId(item.id)}>
                <View style={styles.itemTextContainer}>
                    <Text style={[styles.itemText, {fontFamily: 'PlusJakartaSans-Bold'}]}>
                        {item.firstName} {item.lastName}
                    </Text>
                    <Text style={styles.itemText}>
                        {item.username}
                    </Text>
                </View>
                <View>
                    <TouchableOpacity style={styles.deleteButton} onPress={() => {setDeleteEmployeeModal(true);setSelectedEmployee(item.id);}}>
                        <Text style={styles.deleteButtonText}>Eliminar</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

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

    const closeAddEmployeeModal = () => {
        setAddEmployeeModal(false);
        setButtonWasPressed(false);
        setLoading(false);
        errors.employeeUsername.message = "";
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
            let authHeader = 'Bearer ' + await AsyncStorage.getItem('jwt');
            let config = {
                headers: {
                    'Authorization': authHeader
                }
            }
            let res = await axios.post(`${BACK_URL}/organizations/add_employee`,
                {
                    employeeUsername: employeeUsername,
                }, config );
            console.log(res.data);
            if(res.status === 200) {
                setResponseOk(true);
            }
        } catch (error) {
            setResponseOk(false);
            setError('employeeUsername', {
                type: 'manual',
                message: error.response.data.message
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
                            <Icon style={{marginVertical: 10}} name={'circle-check'} size={50} color={'#008000'}/>
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
        console.log("Eliminar empleado: " + id);
        try {
            let authHeader = 'Bearer ' + await AsyncStorage.getItem('jwt');
            let config = {
                headers: {
                    'Authorization': authHeader
                }
            }
            let res = await axios.post(`${BACK_URL}/organizations/delete_employee`,
                {
                    userId: id
                }, config );
            if (res.status === 200) {
                setEmployees((prevEmployees) => prevEmployees.filter(employee => employee.id !== id));
            }
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
                            editable={enableModification} // Pasamos la variable enableModification
                            style={{
                                backgroundColor: enableModification ? 'white' : 'gray', // Color de fondo en función de enableModification
                                color: enableModification ? 'black' : 'lightgray'       // Color del texto
                            }}
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
                            valueName='Name'
                            value={value}
                            editable={enableModification} // Pasamos la variable enableModification
                            style={{
                                backgroundColor: enableModification ? 'white' : 'gray', // Color de fondo en función de enableModification
                                color: enableModification ? 'black' : 'lightgray'       // Color del texto
                            }}
                        />
                    )}
                    name='Name'
                    rules={{
                        required: { value: true, message: 'No puedes dejar el nombre vacío.' },
                    }}
                    defaultValue=''
                />

                <Text style={styles.label}>{"\n"}Empleados: </Text>

                <TouchableOpacity style={styles.addEmployeeButton} onPress={() => setAddEmployeeModal(true)}>
                    <Icon name={'plus'} size={24} color={'#111818'} style={{paddingHorizontal: 20}} />
                    <Text style={styles.addEmployeeButtonText}>Agregar un empleado</Text>
                </TouchableOpacity>

                <View style={styles.employeesContainer}>
                    { loading ?
                        <View style={{flex: 1, justifyContent: 'center'}}>
                            <ActivityIndicator size="large" style={{alignSelf: 'center'}} color="#111818" />
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
            <Modal
                animationType="none"
                transparent={true}
                visible={deleteEmployeeModal}
                onRequestClose={() => setDeleteEmployeeModal(!setDeleteEmployeeModal)}>
                <View style={styles.centeredView}>
                    <View style={styles.modalView}>
                        <Text style={styles.modalText}>
                            Al eliminar un empleado, se desvinculará su usuario de tu organización.
                            {"\n"}Si en el futuro deseas volver a agregarlo, deberás volver a enviarle una solicitud.
                            {"\n"}{"\n"}¿Deseas continuar?
                        </Text>
                        <EurekappButton text='Eliminar'
                                        onPress={() => handleDeleteEmployee(selectedEmployee)}/>
                        <EurekappButton text='Cancelar'
                                        onPress={() => setDeleteEmployeeModal(false)}/>
                    </View>
                </View>
            </Modal>

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
                            render={({onChange, value}) => (
                                <InputForm
                                    text='E-mail'
                                    valueName='employeeUsername'
                                    value={value}
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
        color: '#111818',
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
        backgroundColor: '#fff',
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
    modalText: {
        marginBottom: 15,
        textAlign: 'left',
        fontFamily: 'PlusJakartaSans-Regular',
    },
    modalView: {
        margin: 20,
        backgroundColor: 'white',
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

export default Organization;