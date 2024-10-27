import React, {createContext, useContext, useEffect, useState} from 'react';
import {CommonActions, NavigationContainer, StackActions, useNavigation} from '@react-navigation/native';

import FindObject from './screens/findObjectStack/FindObject';
import UploadObject from "./screens/uploadFoundObjectStack/UploadObject";
import {createBottomTabNavigator} from "@react-navigation/bottom-tabs";
import {LogBox, StyleSheet, Text, View} from "react-native";
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
import LostObjectReturn from "./screens/lostObjectReturnStack/LostObjectReturn";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ReturnObjectForm from "./screens/lostObjectReturnStack/ReturnObjectForm";
import RegistrationScreen from "./screens/login/RegistrationScreen";
import OrganizationSignupForm from "./screens/organizationSignUp/OrganizationSignupForm";
import Profile from "./screens/profileStack/Profile";
import Organization from "./screens/organizationStack/Organization";


const FindObjectStack = createNativeStackNavigator();

const FindObjectStackScreen = () => {
    return (
        <FindObjectStack.Navigator>
            <FindObjectStack.Screen options={{ headerShown: false }}
                                    name="FindObject" component={FindObject} />
            <FindObjectStack.Screen options={{ headerShown: false }}
                                    name="FoundObjects" component={FoundObjects} />
            <FindObjectStack.Screen options={{ headerShown: false }}
                                    name="NotFoundObjects" component={NotFoundObjects} />
        </FindObjectStack.Navigator>
    );
}

const AuthStack = createStackNavigator();

const AuthStackScreen = () => {
    return (
        <AuthStack.Navigator>
            <AuthStack.Screen
                name="LandingScreen"
                component={LandingScreen}
                options={{ headerShown: false }}
            />
            <AuthStack.Screen
                name="LoginScreen"
                component={LoginScreen}
                options={{ headerShown: false }}
            />
            <AuthStack.Screen
                name="RegistrationScreen"
                component={RegistrationScreen}
                options={{ headerShown: false }}
            />
        </AuthStack.Navigator>
    );
}

const ReturnStack = createStackNavigator();

const ReturnObjectStackScreen = () => {
    return (
        <ReturnStack.Navigator>
            <ReturnStack.Screen
                name='ReturnObjectList'
                component={LostObjectReturn}
                options={{headerShown: false}} />
            <ReturnStack.Screen
                name='ReturnObjectForm'
                component={ReturnObjectForm}
                options={{headerShown: false}} />
        </ReturnStack.Navigator>
    );
}

const ProfileStack = createStackNavigator();

const ProfileStackScreen = () => {
    return (
        <ProfileStack.Navigator>
            <ProfileStack.Screen
                name='Profile'
                component={Profile}
                options={{headerShown: false}} />
        </ProfileStack.Navigator>
    );
}

const OrganizationStack = createStackNavigator();

const OrganizationStackScreen = () => {
    return (
        <OrganizationStack.Navigator>
            <OrganizationStack.Screen
                name='Organization'
                component={Organization}
                options={{headerShown: false}} />
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
        await AsyncStorage.removeItem('org.name');
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
    const uploadIcon = () => <Icon name={'upload'} size={20} />
    const searchIcon = () => <Icon name={'magnifying-glass'} size={20} />
    const returnIcon = () => <Icon name={'retweet'} size={20} />
    const userIcon = () => <Icon name={'user'} size={20}/>
    const organizationIcon = () => <Icon name={'sitemap'} size={20}/>

    const [ isOrgAdmin, setIsOrgAdmin ] = useState(false);
    const [ userRole, setUserRole ] = useState('');
    useEffect(() => {
        const fetchUserRole = async () => {
            const user = JSON.parse(await AsyncStorage.getItem('user'));
            setUserRole(user.role);
        }
        fetchUserRole();
    }, []);
    return (
        <Drawer.Navigator drawerContent={(props) => <CustomDrawerContent {...props} />}>
            <Drawer.Screen name="FindObjectStackScreen" options={{
                title: 'Buscar un objeto',
                headerTitleAlign: 'center',
                drawerIcon: searchIcon
            }} component={FindObjectStackScreen}
            />
            {userRole === 'ORGANIZATION_OWNER' || userRole === 'ORGANIZATION_EMPLOYEE' ?
                <>
                    <Drawer.Screen name="UploadObject" options={{
                        title: 'Receptar un objeto',
                        headerTitleAlign: 'center',
                        drawerIcon: uploadIcon
                    }} component={UploadObject}
                    />
                    <Drawer.Screen name="LostObjectReturnStackScreen" options={{
                        title: 'Devolver un objeto',
                        headerTitleAlign: 'center',
                        drawerIcon: returnIcon
                    }} component={ReturnObjectStackScreen}
                    />
                </>
                : null
            }

            {userRole === 'USER' ?
            <>
                <Drawer.Screen name="OrganizationSignupForm" options={{
                    title: 'Solicitar alta de organización',
                    headerTitleAlign: 'center',
                    drawerIcon: uploadIcon
                }} component={OrganizationSignupForm} />
            </>: null
            }

            <Drawer.Screen name="ProfileStackScreen" options={{
                title: 'Mi perfil',
                headerTitleAlign: 'center',
                drawerIcon: userIcon
            }} component={ProfileStackScreen}
            />

            {userRole === 'ORGANIZATION_OWNER' ?
                <>
                    <Drawer.Screen name="OrganizationStackScreen" options={{
                        title: 'Mi organización',
                        headerTitleAlign: 'center',
                        drawerIcon: organizationIcon
                    }} component={OrganizationStackScreen}
                    />
                </>: null}
        </Drawer.Navigator>
    );
}

const App = () => {
    LogBox.ignoreAllLogs();
    const [user, setUser] = useState('');
    const [ fontsLoaded ] = useFonts({
        'PlusJakartaSans-Bold': require('./assets/fonts/PlusJakartaSans-Bold.ttf'),
        'PlusJakartaSans-Regular': require('./assets/fonts/PlusJakartaSans-Regular.ttf')
    });
    if(!fontsLoaded) return (<View></View>);

    return (
        <NavigationContainer>
            <LoginContext.Provider value={{ setUser: setUser, user }}>
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

