import React, {createContext, useEffect, useState} from 'react';
import { NavigationContainer } from '@react-navigation/native';

import FindObject from './screens/findObjectStack/FindObject';
import UploadObject from "./screens/uploadFoundObjectStack/UploadObject";
import {createBottomTabNavigator} from "@react-navigation/bottom-tabs";
import {StyleSheet, View} from "react-native";
import {useFonts} from "expo-font";
import {createNativeStackNavigator} from "@react-navigation/native-stack";
import FoundObjects from "./screens/findObjectStack/FoundObjects";
import NotFoundObjects from "./screens/findObjectStack/NotFoundObjects";
import {createStackNavigator} from "@react-navigation/stack";
import LandingScreen from "./screens/login/Landing";
import LoginScreen from "./screens/login/LoginScreen";
import {LoginContext} from "./hooks/useUser";
import Icon from "react-native-vector-icons/FontAwesome6";
import {createDrawerNavigator} from "@react-navigation/drawer";
import LostObjectReturn from "./screens/lostObjectReturnStack/LostObjectReturn";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ReturnObjectForm from "./screens/lostObjectReturnStack/ReturnObjectForm";


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

const Drawer = createDrawerNavigator();

const EurekappTab = () => {
    const uploadIcon = () => <Icon name={'upload'} size={20} />
    const searchIcon = () => <Icon name={'magnifying-glass'} size={20} />
    const [ isOrgAdmin, setIsOrgAdmin ] = useState(false);
    useEffect(() => {
        const fetchUserType = async () => {
            const orgId = await AsyncStorage.getItem('org.id');
            setIsOrgAdmin(orgId != null);
        }
        fetchUserType();
    }, []);
    return (
        <Drawer.Navigator>
            <Drawer.Screen name="FindObjectStackScreen" options={{
                title: 'Encontrar Objeto',
                headerTitleAlign: 'center',
                tabBarIcon: searchIcon
            }} component={FindObjectStackScreen} />
            {isOrgAdmin ?
                <>
                    <Drawer.Screen name="UploadObject" options={{
                        title: 'Subir objeto',
                        headerTitleAlign: 'center',
                        tabBarIcon: uploadIcon
                    }} component={UploadObject} />
                    <Drawer.Screen name="LostObjectReturnStackScreen" options={{
                        title: 'Devolver Objeto',
                        headerTitleAlign: 'center'
                    }} component={ReturnObjectStackScreen}/>
                </>
                : null
            }
        </Drawer.Navigator>
    );
}



const App = () => {
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

const style = StyleSheet.create({
    header: {
        height: 80,
        borderWidth: 0,
    },
    headerText: {
        color: '#111818',
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
        fontFamily: 'PlusJakartaSans-Bold'
    },
});

export default App;

