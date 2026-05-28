import React, {createContext, useCallback, useContext, useEffect, useState} from 'react';
import {
    CommonActions,
    NavigationContainer,
    StackActions,
    useFocusEffect,
    useNavigation
} from '@react-navigation/native';

import FindObject from './screens/findObjectStack/FindObject';
import SearchByPhoto from './screens/findObjectStack/SearchByPhoto';
import PhotoSearchResults from './screens/findObjectStack/PhotoSearchResults';
import UploadObject from "./screens/uploadFoundObjectStack/UploadObject";
import {createBottomTabNavigator} from "@react-navigation/bottom-tabs";
import {StyleSheet, Text, View} from "react-native";
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
import Profile from "./screens/profileStack/Profile";
import Organization from "./screens/organizationStack/Organization";
import OrganizationPolicy from "./screens/organizationStack/OrganizationPolicy";
import ReclamosList from "./screens/inventoryStack/ReclamosList";
import ReclamoDetail from "./screens/inventoryStack/ReclamoDetail";
import ReturnedObjects from "./screens/returnedObjectsStack/ReturnedObjects";
import ReturnedObjectDetail from "./screens/returnedObjectsStack/ReturnedObjectDetail";
import Achievements from "./screens/AchievementsStack/Achievements";
import FoundObjectDetail from "./screens/inventoryStack/FoundObjectDetail";
import Reports from "./screens/reportsStack/Reports";
import UsabilityFeedbackReport from "./screens/reportsStack/UsabilityFeedbackReport";
import FraudAlerts from "./screens/fraudAlertsStack/FraudAlerts";
import FraudAlertDetail from "./screens/fraudAlertsStack/FraudAlertDetail";
import FraudReport from "./screens/fraudAlertsStack/FraudReport";
import RewardExclusionsList from "./screens/rewardExclusionsStack/RewardExclusionsList";
import MyObjectHistory from "./screens/myObjectsStack/MyObjectHistory";
import MyObjectDetail from "./screens/myObjectsStack/MyObjectDetail";
import MyLostObjectDetail from "./screens/myObjectsStack/MyLostObjectDetail";
import Notifications from "./screens/notificationsStack/Notifications";
import axiosInstance, { setupAxiosInterceptors } from './utils/axiosInstance';
import Constants from 'expo-constants';

const BACK_URL = Constants.expoConfig.extra.backUrl;

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
            <FindObjectStack.Screen options={{ headerShown: false, title: 'EurekApp - Buscar por foto' }}
                                    name="SearchByPhoto" component={SearchByPhoto} />
            <FindObjectStack.Screen options={{ headerShown: false, title: 'EurekApp - Resultados de búsqueda' }}
                                    name="PhotoSearchResults" component={PhotoSearchResults} />
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
            <InventoryStack.Screen
                name='ReclamosList'
                component={ReclamosList}
                options={{headerShown: true, title: 'Reclamos'}} />
            <InventoryStack.Screen
                name='ReclamoDetail'
                component={ReclamoDetail}
                options={{headerShown: true, title: 'Detalle del reclamo'}} />
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
            <ReportsStack.Screen
                name='UsabilityFeedbackReport'
                component={UsabilityFeedbackReport}
                options={{headerShown: false, title: 'EurekApp - Reporte de usabilidad'}} />
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
                name="MyObjectDetail"
                component={MyObjectDetail}
                options={{ headerShown: false, title: 'EurekApp - Detalle de búsqueda' }}
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
                <Text style={styles.infoText}>Contacto: soporte@eurekapp.com</Text>
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
    const navigation = useNavigation();
    const [ isOrgAdmin, setIsOrgAdmin ] = useState(false);
    const { userRole } = useContext(LoginContext);
    const [unreadNotifCount, setUnreadNotifCount] = useState(0);

    useEffect(() => {
        const fetchUnreadCount = async () => {
            try {
                const jwt = await AsyncStorage.getItem('jwt');
                const res = await axiosInstance.get(BACK_URL + '/notifications/unread-count', {
                    headers: { Authorization: 'Bearer ' + jwt },
                });
                setUnreadNotifCount(res.data.count || 0);
            } catch (e) {
                // silently ignore — badge is optional
            }
        };
        fetchUnreadCount();
    }, []);

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
            drawerContent={(props) => <CustomDrawerContent {...props} />} >
            <Drawer.Screen name="FindObjectStackScreen" options={{
                title: 'Buscar un objeto',
                headerTitleAlign: 'center',
                drawerIcon: searchIcon
            }} listeners={{
                drawerItemPress: () => resetAndNavigate(navigation, "FindObject")
            }} component={FindObjectStackScreen}
            />
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
            </>: null
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

            {(userRole === 'ORGANIZATION_OWNER' || userRole === 'ENCARGADO') ?
                <Drawer.Screen name="FraudAlertsStackScreen" options={{
                    title: 'Alertas de fraude',
                    headerTitleAlign: 'center',
                    drawerIcon: shieldIcon
                }} component={FraudAlertsStackScreen}
                /> : null}

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

const App = () => {
    const [user, setUser] = useState('');
    const [userRole, setUserRole] = useState('');
    const [sessionLoading, setSessionLoading] = useState(true);
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
                if (token) {
                    setUser(token);
                    if (raw) setUserRole(JSON.parse(raw).role);
                }
            } catch (e) {
                if (__DEV__) console.warn('restoreSession error:', e);
            } finally {
                setSessionLoading(false);
            }
        };
        restoreSession();
    }, []);

    if (!fontsLoaded || sessionLoading) return (<View></View>);

    return (
        <NavigationContainer>
            <LoginContext.Provider value={{ setUser, user, userRole, setUserRole }}>
                <AxiosSetup />
                {user ? <EurekappTab /> : <AuthStackScreen />}
            </LoginContext.Provider>
        </NavigationContainer>
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


