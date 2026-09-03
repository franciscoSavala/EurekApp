import React, {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';
import {
    CommonActions,
    NavigationContainer,
    StackActions,
    useFocusEffect,
    useNavigation,
    useNavigationContainerRef
} from '@react-navigation/native';

import FindObject from './screens/findObjectStack/FindObject';
import UploadObject from "./screens/uploadFoundObjectStack/UploadObject";
import {createBottomTabNavigator} from "@react-navigation/bottom-tabs";
import {Linking, StyleSheet, Text, View} from "react-native";
import {useFonts} from "expo-font";
import {createNativeStackNavigator} from "@react-navigation/native-stack";
import FoundObjects from "./screens/findObjectStack/FoundObjects";
import NotFoundObjects from "./screens/findObjectStack/NotFoundObjects";
import {createStackNavigator} from "@react-navigation/stack";
import LandingScreen from "./screens/login/Landing";
import LoginScreen from "./screens/login/LoginScreen";
import useUser, {LoginContext} from "./hooks/useUser";
import Icon from "react-native-vector-icons/FontAwesome6";
import {createDrawerNavigator, DrawerContentScrollView, DrawerItem, DrawerItemList} from "@react-navigation/drawer";
import Inventory from "./screens/inventoryStack/Inventory";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ReturnObjectForm from "./screens/inventoryStack/ReturnObjectForm";
import RegistrationScreen from "./screens/login/RegistrationScreen";
import ForgotPasswordScreen from "./screens/login/ForgotPasswordScreen";
import ResetPasswordScreen from "./screens/login/ResetPasswordScreen";
import OrganizationSignupForm from "./screens/organizationSignUp/OrganizationSignupForm";
import MyOrganizationRequest from "./screens/organizationSignUp/MyOrganizationRequest";
import OrganizationRequestsAdmin from "./screens/organizationSignUp/OrganizationRequestsAdmin";
import OrganizationRequestDetail from "./screens/organizationSignUp/OrganizationRequestDetail";
import Profile from "./screens/profileStack/Profile";
import Organization from "./screens/organizationStack/Organization";
import OrganizationPolicy from "./screens/organizationStack/OrganizationPolicy";
import ReturnedObjects from "./screens/returnedObjectsStack/ReturnedObjects";
import ReturnedObjectDetail from "./screens/returnedObjectsStack/ReturnedObjectDetail";
import Achievements from "./screens/AchievementsStack/Achievements";
import FoundObjectDetail from "./screens/inventoryStack/FoundObjectDetail";
import Reports from "./screens/reportsStack/Reports";
import UsabilityFeedbackReport from "./screens/adminStack/UsabilityFeedbackReport";
import OrganizationFeedbackSurvey from "./screens/myObjectsStack/OrganizationFeedbackSurvey";
import FraudAlerts from "./screens/fraudAlertsStack/FraudAlerts";
import FraudAlertDetail from "./screens/fraudAlertsStack/FraudAlertDetail";
import FraudReport from "./screens/fraudAlertsStack/FraudReport";
import RewardExclusionsList from "./screens/rewardExclusionsStack/RewardExclusionsList";
import MyObjectHistory from "./screens/myObjectsStack/MyObjectHistory";
import MyLostObjectDetail from "./screens/myObjectsStack/MyLostObjectDetail";
import Notifications from "./screens/notificationsStack/Notifications";
import UserManagement from "./screens/adminStack/UserManagement";
import OrganizationManagement from "./screens/adminStack/OrganizationManagement";
import GlobalStatisticsDashboard from "./screens/adminStack/GlobalStatisticsDashboard";
import FraudDetectionConfig from "./screens/adminStack/FraudDetectionConfig";
import { SUPPORT_EMAIL } from './utils/contact';
import Toast, { BaseToast } from 'react-native-toast-message';
import axiosInstance, { setupAxiosInterceptors } from './utils/axiosInstance';
import Constants from 'expo-constants';

const BACK_URL = Constants.expoConfig.extra.backUrl;

function isJwtValid(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return false;
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
        const payload = JSON.parse(atob(padded));
        return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now();
    } catch {
        return false;
    }
}

async function clearSession() {
    await AsyncStorage.multiRemove([
        'jwt', 'refreshToken', 'user', 'username',
        'user.first_name', 'org.id', 'org.name', 'organization',
    ]);
}

// Los toasts que trae la librería recortan el texto a una sola línea
// (text1NumberOfLines = 1 + ellipsizeMode 'tail') y tienen alto fijo de 60px, así que
// los mensajes largos —como los de validación de Configuración de fraude— se ven
// cortados. Acá dejamos que el texto ocupe las líneas que necesite y que la caja
// crezca con él. Los colores del borde son los que usa cada toast por defecto.
const expandableToastStyle = { height: 'auto', minHeight: 60, paddingVertical: 10 };

const renderExpandableToast = (borderLeftColor) => (props) => (
    <BaseToast
        {...props}
        style={[expandableToastStyle, { borderLeftColor }]}
        text1NumberOfLines={0}
        text2NumberOfLines={0}
    />
);

const toastConfig = {
    success: renderExpandableToast('#69C779'),
    error: renderExpandableToast('#FE6301'),
    info: renderExpandableToast('#87CEFA'),
};

const AuthStack = createStackNavigator();

const AuthStackScreen = () => {
    return (
        <AuthStack.Navigator>
            <AuthStack.Screen
                name="LandingScreen"
                component={LandingScreen}
                options={{ headerShown: false, title: 'EurekApp - Inicio' }}
            />
            <AuthStack.Screen
                name="LoginScreen"
                component={LoginScreen}
                options={{ headerShown: false, title: 'EurekApp - Iniciar sesión' }}
            />
            <AuthStack.Screen
                name="RegistrationScreen"
                component={RegistrationScreen}
                options={{ headerShown: false , title: 'EurekApp - Registro'}}
            />
            <AuthStack.Screen
                name="ForgotPasswordScreen"
                component={ForgotPasswordScreen}
                options={{ headerShown: false, title: 'EurekApp - Recuperar contraseña' }}
            />
            <AuthStack.Screen
                name="ResetPasswordScreen"
                component={ResetPasswordScreen}
                options={{ headerShown: false, title: 'EurekApp - Nueva contraseña' }}
            />
        </AuthStack.Navigator>
    );
}

const FindObjectStack = createNativeStackNavigator();

const FindObjectStackScreen = () => {
    return (
        <FindObjectStack.Navigator>
            <FindObjectStack.Screen options={{ headerShown: false , title: 'EurekApp - Buscar un objeto'}}
                                    name="FindObject" component={FindObject} />
            <FindObjectStack.Screen options={{ headerShown: false, title: 'EurekApp - Resultados de búsqueda' }}
                                    name="FoundObjects" component={FoundObjects} />
            <FindObjectStack.Screen options={{ headerShown: false, title: 'EurekApp - Resultados de búsqueda' }}
                                    name="NotFoundObjects" component={NotFoundObjects} />
            <FindObjectStack.Screen options={{ headerShown: false, title: 'EurekApp - Ver objeto' }}
                                    name="FoundObjectDetail" component={FoundObjectDetail} />
        </FindObjectStack.Navigator>
    );
}

const ReturnedObjectsStack = createStackNavigator();

const ReturnedObjectsStackScreen = () => {
    return (
        <ReturnedObjectsStack.Navigator>
            <ReturnedObjectsStack.Screen
                name="ReturnedObjects"
                component = {ReturnedObjects}
                options={{headerShown:false, title: 'EurekApp - Ver objetos devueltos'}} />
            <ReturnedObjectsStack.Screen
                name="ReturnedObjectDetail"
                component = {ReturnedObjectDetail}
                options={{headerShown:false, title: 'EurekApp - Ver devolución'}} />
            <ReturnedObjectsStack.Screen
                name="FoundObjectDetail"
                component = {FoundObjectDetail}
                options={{headerShown:false, title: 'EurekApp - Ver objeto'}} />
        </ReturnedObjectsStack.Navigator>
    );
}

const InventoryStack = createStackNavigator();

const InventoryStackScreen = () => {
    return (
        <InventoryStack.Navigator>
            <InventoryStack.Screen
                name='ReturnObjectList'
                component={Inventory}
                options={{headerShown: false, title: 'EurekApp - Ver inventario'}} />
            <InventoryStack.Screen
                name='FoundObjectDetail'
                component={FoundObjectDetail}
                options={{headerShown: false, title: 'EurekApp - Ver objeto'}} />
            <InventoryStack.Screen
                name='ReturnObjectForm'
                component={ReturnObjectForm}
                options={{headerShown: true, title: 'Devolver objeto'}} />
        </InventoryStack.Navigator>
    );
}

const AchievementsStack = createStackNavigator();

const AchievementsStackScreen = () => {
    return (
        <AchievementsStack.Navigator>
            <AchievementsStack.Screen
                name='Achievements'
                component={Achievements}
                options={{headerShown:false, title: 'EurekApp - Logros'}} />
        </AchievementsStack.Navigator>

    );
}

const ProfileStack = createStackNavigator();

const ProfileStackScreen = () => {
    return (
        <ProfileStack.Navigator>
            <ProfileStack.Screen
                name='Profile'
                component={Profile}
                options={{headerShown: false, title: 'EurekApp - Mi perfil'}} />
        </ProfileStack.Navigator>
    );
}

const ReportsStack = createStackNavigator();

const ReportsStackScreen = () => {
    return (
        <ReportsStack.Navigator>
            <ReportsStack.Screen
                name='Reports'
                component={Reports}
                options={{headerShown: false, title: 'EurekApp - Reportes'}} />
        </ReportsStack.Navigator>
    );
}

const FraudAlertsStack = createStackNavigator();

const FraudAlertsStackScreen = () => {
    return (
        <FraudAlertsStack.Navigator>
            <FraudAlertsStack.Screen
                name='FraudAlerts'
                component={FraudAlerts}
                options={{headerShown: false, title: 'EurekApp - Alertas de fraude'}} />
            <FraudAlertsStack.Screen
                name='FraudAlertDetail'
                component={FraudAlertDetail}
                options={{headerShown: true, title: 'Detalle de alerta'}} />
            <FraudAlertsStack.Screen
                name='FraudReport'
                component={FraudReport}
                options={{headerShown: true, title: 'Reporte de fraude'}} />
        </FraudAlertsStack.Navigator>
    );
}

const RewardExclusionsStack = createStackNavigator();

const RewardExclusionsStackScreen = () => (
    <RewardExclusionsStack.Navigator>
        <RewardExclusionsStack.Screen
            name="RewardExclusionsList"
            component={RewardExclusionsList}
            options={{ headerShown: false, title: 'Exclusiones de recompensa' }}
        />
    </RewardExclusionsStack.Navigator>
);

const MyObjectsStack = createStackNavigator();

const MyObjectsStackScreen = () => {
    return (
        <MyObjectsStack.Navigator>
            <MyObjectsStack.Screen
                name="MyObjectHistory"
                component={MyObjectHistory}
                options={{ headerShown: false, title: 'EurekApp - Mis búsquedas' }}
            />
            <MyObjectsStack.Screen
                name="MyLostObjectDetail"
                component={MyLostObjectDetail}
                options={{ headerShown: false, title: 'EurekApp - Detalle de búsqueda abierta' }}
            />
        </MyObjectsStack.Navigator>
    );
}

const NotificationsStack = createStackNavigator();

const NotificationsStackScreen = () => {
    return (
        <NotificationsStack.Navigator>
            <NotificationsStack.Screen
                name="Notifications"
                component={Notifications}
                options={{ headerShown: false, title: 'EurekApp - Notificaciones' }}
            />
            {/* EU-345: la pantalla de coincidencias se monta TAMBIÉN acá para que el aviso de
                "coincidencia encontrada" abra el objeto sin salirse del stack de notificaciones.
                Si se navegara al stack de búsqueda, "← Volver" caería en FindObject —su ruta
                inicial— y dejaría al usuario en la pantalla de buscar, no en sus notificaciones.
                Es el mismo componente, montado en los dos lugares. */}
            <NotificationsStack.Screen
                name="FoundObjects"
                component={FoundObjects}
                options={{ headerShown: false, title: 'EurekApp - Coincidencia encontrada' }}
            />
        </NotificationsStack.Navigator>
    );
}

const OrganizationStack = createStackNavigator();

const OrganizationStackScreen = () => {
    return (
        <OrganizationStack.Navigator>
            <OrganizationStack.Screen
                name='Organization'
                component={Organization}
                options={{headerShown: false, title: 'EurekApp - Mi organización'}} />
            <OrganizationStack.Screen
                name='OrganizationPolicy'
                component={OrganizationPolicy}
                options={{headerShown: true, title: 'Políticas de la organización'}} />
        </OrganizationStack.Navigator>
    );
}

const OrgRequestsAdminStack = createStackNavigator();

const OrgRequestsAdminStackScreen = () => (
    <OrgRequestsAdminStack.Navigator>
        <OrgRequestsAdminStack.Screen
            name="OrganizationRequestsAdmin"
            component={OrganizationRequestsAdmin}
            options={{ headerShown: false, title: 'EurekApp - Solicitudes de alta' }}
        />
        <OrgRequestsAdminStack.Screen
            name="OrganizationRequestDetail"
            component={OrganizationRequestDetail}
            options={{ headerShown: true, title: 'Detalle de solicitud' }}
        />
    </OrgRequestsAdminStack.Navigator>
);

const CustomDrawerContent = (props) => {
    const [userName, setUserName] = useState('');
    const [userFirstName, setUserFirstName] = useState('');
    const navigation = useNavigation();
    const { logout } = useUser();
    useEffect(() => {
        const fetchUserName = async () => {
            let user = await AsyncStorage.getItem('org.name');
            if(user == null){
                user = await AsyncStorage.getItem('username')
            }
            setUserName(user);
        }
        fetchUserName();
    }, []);

    useEffect(() => {
        const fetchUserFirstName = async () => {
            let user = await AsyncStorage.getItem('user.first_name');
            setUserFirstName(user);
        }
        fetchUserFirstName();
    }, []);

    const handleLogout = async () => {
        // Limpiar los datos del usuario
        await AsyncStorage.removeItem('org.name');
        await AsyncStorage.removeItem('username');
        await AsyncStorage.removeItem('user.first_name');
        await AsyncStorage.removeItem('user');
        await AsyncStorage.removeItem('org.id');
        await AsyncStorage.removeItem('organization');
        logout();
    }

    return (
        <DrawerContentScrollView {...props} contentContainerStyle={{flex: 1}}>
            <View style={{flex: 1}}>
                <View style={styles.drawerHeader}>
                    <Text style={styles.headerText}>¡Bienvenido, {userFirstName}!</Text>
                </View>
                <DrawerItemList {...props} />

            </View>
            <View style={styles.infoContainer}>
                <Text style={styles.infoText}>Versión de la app: 0.0.1</Text>
                <Text style={styles.infoText}>Contacto: {SUPPORT_EMAIL}</Text>
            </View>
            <DrawerItem
                label="Logout"
                onPress={handleLogout}
            />
        </DrawerContentScrollView>

    );
}

const Drawer = createDrawerNavigator();

const EurekappTab = () => {
    const searchIcon = () => <Icon name={'magnifying-glass'} size={20} />
    const uploadIcon = () => <Icon name={'upload'} size={20} />
    const historyIcon = () => <Icon name={'clock-rotate-left'} size={20} />
    const boxesIcon = () => <Icon name={'boxes-stacked'} size={20} />
    const trophyIcon = () => <Icon name={'trophy'} size={20} />
    const userIcon = () => <Icon name={'user'} size={20}/>
    const organizationIcon = () => <Icon name={'sitemap'} size={20}/>
    const chartIcon = () => <Icon name={'chart-bar'} size={20}/>
    const shieldIcon = () => <Icon name={'shield-halved'} size={20}/>
    const slidersIcon = () => <Icon name={'sliders'} size={20}/>
    const commentIcon = () => <Icon name={'comment-dots'} size={20}/>
    const navigation = useNavigation();
    const [ isOrgAdmin, setIsOrgAdmin ] = useState(false);
    const { userRole } = useContext(LoginContext);
    const [unreadNotifCount, setUnreadNotifCount] = useState(0);
    const [pendingOrgRequestCount, setPendingOrgRequestCount] = useState(0);
    const prevCountRef = useRef(0);
    const isFirstFetchRef = useRef(true);

    useEffect(() => {
        const fetchUnreadCount = async () => {
            try {
                const jwt = await AsyncStorage.getItem('jwt');
                const res = await axiosInstance.get(BACK_URL + '/notifications/unread-count', {
                    headers: { Authorization: 'Bearer ' + jwt },
                });
                const newCount = res.data.count || 0;
                if (!isFirstFetchRef.current && newCount > prevCountRef.current) {
                    Toast.show({
                        type: 'info',
                        text1: 'Nueva notificación',
                        text2: 'Tenés notificaciones sin leer.',
                    });
                }
                prevCountRef.current = newCount;
                isFirstFetchRef.current = false;
                setUnreadNotifCount(newCount);
            } catch (e) {
                // silently ignore — badge is optional
            }
        };
        fetchUnreadCount();
        const interval = setInterval(fetchUnreadCount, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchPendingCount = useCallback(async () => {
        if (userRole !== 'ADMIN') return;
        try {
            const jwt = await AsyncStorage.getItem('jwt');
            const res = await axiosInstance.get(BACK_URL + '/organizations/requests/pending-count', {
                headers: { Authorization: 'Bearer ' + jwt },
            });
            setPendingOrgRequestCount(res.data.count || 0);
        } catch (e) {
            // silently ignore — badge es opcional
        }
    }, [userRole]);

    useEffect(() => {
        if (userRole !== 'ADMIN') return;
        fetchPendingCount();
        const interval = setInterval(fetchPendingCount, 30000);
        return () => clearInterval(interval);
    }, [fetchPendingCount]);

    const orgRequestsIcon = () => (
        <View style={{ position: 'relative' }}>
            <Icon name={'sitemap'} size={20} />
            {pendingOrgRequestCount > 0 && (
                <View style={{
                    position: 'absolute', top: -5, right: -8,
                    backgroundColor: '#CC4444', borderRadius: 8,
                    minWidth: 16, height: 16,
                    justifyContent: 'center', alignItems: 'center',
                    paddingHorizontal: 2,
                }}>
                    <Text style={{ color: '#FFF', fontSize: 9, fontWeight: 'bold' }}>
                        {pendingOrgRequestCount > 99 ? '99+' : pendingOrgRequestCount}
                    </Text>
                </View>
            )}
        </View>
    );

    const bellIcon = () => (
        <View style={{ position: 'relative' }}>
            <Icon name={'bell'} size={20} />
            {unreadNotifCount > 0 && (
                <View style={{
                    position: 'absolute', top: -5, right: -8,
                    backgroundColor: '#CC4444', borderRadius: 8,
                    minWidth: 16, height: 16,
                    justifyContent: 'center', alignItems: 'center',
                    paddingHorizontal: 2,
                }}>
                    <Text style={{ color: '#FFF', fontSize: 9, fontWeight: 'bold' }}>
                        {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
                    </Text>
                </View>
            )}
        </View>
    );

    const resetAndNavigate = (navigation, screenName) => {
        navigation.dispatch(
            CommonActions.reset({
                index: 0,
                routes: [{ name: screenName }],
            })
        );
    };

    return (
        <Drawer.Navigator
            key={userRole}
            initialRouteName={
                (userRole === 'ORGANIZATION_OWNER' || userRole === 'ORGANIZATION_EMPLOYEE' || userRole === 'ENCARGADO')
                    ? 'LostObjectReturnStackScreen'
                    : userRole === 'ADMIN'
                        ? 'GlobalStatisticsDashboard'
                        : 'FindObjectStackScreen'
            }
            drawerContent={(props) => <CustomDrawerContent {...props} />} >
            {userRole !== 'ORGANIZATION_OWNER' && userRole !== 'ORGANIZATION_EMPLOYEE' && userRole !== 'ENCARGADO' ? (
                <Drawer.Screen name="FindObjectStackScreen" options={{
                    title: 'Buscar un objeto',
                    headerTitleAlign: 'center',
                    drawerIcon: searchIcon
                }} listeners={{
                    drawerItemPress: () => resetAndNavigate(navigation, "FindObject")
                }} component={FindObjectStackScreen}
                />
            ) : null}
            {userRole === 'ORGANIZATION_OWNER' || userRole === 'ORGANIZATION_EMPLOYEE' || userRole === 'ENCARGADO' ?
                <>
                    <Drawer.Screen name="UploadObject" options={{
                        title: 'Receptar un objeto',
                        headerTitleAlign: 'center',
                        drawerIcon: uploadIcon
                    }} component={UploadObject}
                    />
                    <Drawer.Screen name="LostObjectReturnStackScreen" options={{
                        title: 'Ver inventario',
                        headerTitleAlign: 'center',
                        drawerIcon: boxesIcon
                    }} listeners={{
                        drawerItemPress: () => resetAndNavigate(navigation,"LostObjectReturnStackScreen")
                    }} component={InventoryStackScreen}
                    />
                    <Drawer.Screen name="ReturnedObjectsStackScreen" options={{
                        title: 'Ver objetos devueltos',
                        headerTitleAlign: 'center',
                        drawerIcon: historyIcon
                    }} listeners={{
                        drawerItemPress: () => resetAndNavigate(navigation,"ReturnedObjectsStackScreen")
                    }} component={ReturnedObjectsStackScreen}
                    />
                </>
                : null
            }

            {userRole === 'REGULAR_USER' || userRole === 'USER' ?
            <>
                <Drawer.Screen name="MyObjectsStackScreen" options={{
                    title: 'Mis búsquedas',
                    headerTitleAlign: 'center',
                    drawerIcon: historyIcon
                }} listeners={{
                    drawerItemPress: () => resetAndNavigate(navigation, 'MyObjectsStackScreen')
                }} component={MyObjectsStackScreen} />
                <Drawer.Screen name="OrganizationSignupForm" options={{
                    title: 'Solicitar alta de organización',
                    headerTitleAlign: 'center',
                    drawerIcon: uploadIcon
                }} component={OrganizationSignupForm} />
                <Drawer.Screen name="MyOrganizationRequest" options={{
                    title: 'Mi solicitud de organización',
                    headerTitleAlign: 'center',
                    drawerIcon: organizationIcon
                }} component={MyOrganizationRequest} />
            </>: null
            }

            {userRole === 'ADMIN' ?
            <>
                <Drawer.Screen name="GlobalStatisticsDashboard" options={{
                    title: 'Dashboard',
                    headerTitleAlign: 'center',
                    drawerIcon: chartIcon
                }} component={GlobalStatisticsDashboard} />
                <Drawer.Screen name="OrgRequestsAdminStackScreen" options={{
                    title: 'Solicitudes de alta',
                    headerTitleAlign: 'center',
                    drawerIcon: orgRequestsIcon
                }} listeners={{
                    focus: () => fetchPendingCount()
                }} component={OrgRequestsAdminStackScreen} />
                <Drawer.Screen name="UserManagement" options={{
                    title: 'Usuarios',
                    headerTitleAlign: 'center',
                    drawerIcon: userIcon
                }} component={UserManagement} />
                <Drawer.Screen name="OrganizationManagement" options={{
                    title: 'Organizaciones',
                    headerTitleAlign: 'center',
                    drawerIcon: organizationIcon
                }} component={OrganizationManagement} />
                <Drawer.Screen name="FraudAlertsStackScreen" options={{
                    title: 'Alertas de fraude',
                    headerTitleAlign: 'center',
                    drawerIcon: shieldIcon
                }} component={FraudAlertsStackScreen} />
                <Drawer.Screen name="FraudDetectionConfigStackScreen" options={{
                    title: 'Configuración de fraude',
                    headerTitleAlign: 'center',
                    drawerIcon: slidersIcon
                }} component={FraudDetectionConfig} />
                {/* EU-370: la opinión sobre la aplicación la lee quien puede corregir la
                    aplicación. Antes colgaba del menú de reportes del responsable de organización,
                    que no puede accionarla. */}
                <Drawer.Screen name="UsabilityFeedbackReport" options={{
                    title: 'Opiniones sobre la app',
                    headerTitleAlign: 'center',
                    drawerIcon: commentIcon
                }} component={UsabilityFeedbackReport} />
            </> : null
            }

            {(userRole === 'USER' || userRole === 'REGULAR_USER') ?
                <Drawer.Screen name="AchievementsStackScreen" options={{
                    title: 'Logros',
                    headerTitleAlign: 'center',
                    drawerIcon: trophyIcon
                }} listeners={{
                    drawerItemPress: () => resetAndNavigate(navigation,"AchievementsStackScreen")
                }} component={AchievementsStackScreen}
                />
            : null}

            <Drawer.Screen name="NotificationsStackScreen" options={{
                title: 'Notificaciones',
                headerTitleAlign: 'center',
                drawerIcon: bellIcon
            }} listeners={{
                drawerItemPress: () => {
                    setUnreadNotifCount(0);
                    resetAndNavigate(navigation, 'NotificationsStackScreen');
                }
            }} component={NotificationsStackScreen}
            />

            <Drawer.Screen name="ProfileStackScreen" options={{
                title: 'Mi perfil',
                headerTitleAlign: 'center',
                drawerIcon: userIcon
            }} component={ProfileStackScreen}
            />

            {/* EU-374: a la encuesta de atención se llega ÚNICAMENTE por el enlace del correo. La
                ruta tiene que existir para que el enlace resuelva, pero no se lista en el menú:
                fuera de ese correo no hay ningún camino que lleve acá. Quién puede responderla lo
                decide el backend, que verifica que la devolución sea de quien la está abriendo. */}
            <Drawer.Screen name="OrganizationFeedbackSurvey" options={{
                title: 'Calificar la atención',
                headerTitleAlign: 'center',
                drawerItemStyle: { display: 'none' }
            }} component={OrganizationFeedbackSurvey}
            />

            {userRole === 'ORGANIZATION_OWNER' ?
                <>
                    <Drawer.Screen name="ReportsStackScreen" options={{
                        title: 'Reportes',
                        headerTitleAlign: 'center',
                        drawerIcon: chartIcon
                    }} component={ReportsStackScreen}
                    />
                    <Drawer.Screen name="RewardExclusionsStackScreen" options={{
                        title: 'Exclusiones de recompensa',
                        headerTitleAlign: 'center',
                        drawerIcon: () => <Icon name={'ban'} size={20} />,
                    }} component={RewardExclusionsStackScreen}
                    />
                    <Drawer.Screen name="OrganizationStackScreen" options={{
                        title: 'Mi organización',
                        headerTitleAlign: 'center',
                        drawerIcon: organizationIcon
                    }} component={OrganizationStackScreen}
                    listeners={({ navigation }) => ({
                        drawerItemPress: e => {
                            e.preventDefault();
                            navigation.navigate('OrganizationStackScreen', { screen: 'Organization' });
                        },
                    })}
                    />
                    <Drawer.Screen name="MyOrganizationRequestOwner" options={{
                        title: 'Mi solicitud de organización',
                        headerTitleAlign: 'center',
                        drawerIcon: historyIcon
                    }} component={MyOrganizationRequest}
                    />
                </>: null}
        </Drawer.Navigator>
    );
}

const AxiosSetup = () => {
    const { logout } = useUser();
    useEffect(() => {
        setupAxiosInterceptors(logout);
    }, [logout]);
    return null;
};

// Sin esta configuración el NavigationContainer no sincroniza la URL con la navegación:
// en web la barra de direcciones queda siempre en "/", así que al refrescar la app vuelve a
// montarse en el initialRouteName del Drawer (para ADMIN, el Dashboard) y se pierde la pantalla
// en la que estaba el usuario.
//
// No lleva `config`: cuando no se especifica uno, React Navigation usa el nombre de la ruta como
// segmento de la URL en ambas direcciones (getPathFromState y getStateFromPath), que es
// justo lo que necesitamos para que el refresh conserve la pantalla.
//
// `prefixes` sólo se usa en apps nativas para reconocer los deep links; en web useLinking lee
// location.pathname directamente y lo ignora. Se declara el scheme de app.json para que el día
// que se abran deep links en el celular ya esté puesto.
const linking = {
    prefixes: ['eurekapp://'],
};

/* EU-374: el enlace del correo apunta a la encuesta de atención, y puede abrirse con la sesión
 * vencida. En ese caso la app arranca en el login y, cuando el NavigationContainer ya está montado,
 * el árbol de pantallas cambia entero: la ruta que traía la URL se pierde. Por eso el destino se
 * recuerda al arrancar y se navega recién cuando hay sesión. */
const parseSurveyReturnId = (url) => {
    if (!url) return null;
    const match = /OrganizationFeedbackSurvey\?.*returnId=(\d+)/.exec(url);
    return match ? Number(match[1]) : null;
};

const App = () => {
    const [user, setUser] = useState('');
    const [userRole, setUserRole] = useState('');
    const [sessionLoading, setSessionLoading] = useState(true);
    const navigationRef = useNavigationContainerRef();
    const [navigationReady, setNavigationReady] = useState(false);
    const [pendingSurveyReturnId, setPendingSurveyReturnId] = useState(null);
    const [ fontsLoaded ] = useFonts({
        'PlusJakartaSans-Bold': require('./assets/fonts/PlusJakartaSans-Bold.ttf'),
        'PlusJakartaSans-Regular': require('./assets/fonts/PlusJakartaSans-Regular.ttf')
    });

    useEffect(() => {
        const restoreSession = async () => {
            try {
                const [token, raw] = await Promise.all([
                    AsyncStorage.getItem('jwt'),
                    AsyncStorage.getItem('user'),
                ]);
                if (token && isJwtValid(token)) {
                    setUser(token);
                    if (raw) setUserRole(JSON.parse(raw).role);
                } else if (token) {
                    await clearSession();
                }
            } catch (e) {
                if (__DEV__) console.warn('restoreSession error:', e);
            } finally {
                setSessionLoading(false);
            }
        };
        restoreSession();
    }, []);

    // EU-374: se anota a qué encuesta apuntaba el enlace con el que se abrió la app, antes de saber
    // si hay sesión.
    useEffect(() => {
        let cancelled = false;
        Linking.getInitialURL()
            .then((url) => { if (!cancelled) setPendingSurveyReturnId(parseSurveyReturnId(url)); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, []);

    // Con sesión iniciada y la navegación montada, se cae directamente en la encuesta. Si la persona
    // ya estaba logueada, React Navigation la lleva sola y esto no cambia nada.
    useEffect(() => {
        if (!user || !pendingSurveyReturnId || !navigationReady) return;
        navigationRef.navigate('OrganizationFeedbackSurvey', { returnId: pendingSurveyReturnId });
        setPendingSurveyReturnId(null);
    }, [user, pendingSurveyReturnId, navigationReady, navigationRef]);

    if (!fontsLoaded || sessionLoading) return (<View></View>);

    return (
        <>
            <NavigationContainer ref={navigationRef} linking={linking} onReady={() => setNavigationReady(true)}>
                <LoginContext.Provider value={{ setUser, user, userRole, setUserRole }}>
                    <AxiosSetup />
                    {user ? <EurekappTab /> : <AuthStackScreen />}
                </LoginContext.Provider>
            </NavigationContainer>
            <Toast config={toastConfig} />
        </>
    );
}

const styles = StyleSheet.create({
    header: {
        height: 80,
        borderWidth: 0,
    },
    drawerHeader: {
        padding: 20,
        backgroundColor: '#f4f4f4',
    },
    headerText: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    infoContainer: {
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#ccc',
    },
    infoText: {
        fontSize: 14,
        marginVertical: 2,
    },
});

export default App;


