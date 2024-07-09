import React, {createContext, useState} from 'react';
import { NavigationContainer } from '@react-navigation/native';

import FindObject from './screens/findObjectStack/FindObject';
import UploadObject from "./screens/uploadFoundObjectStack/UploadObject";
import {createBottomTabNavigator} from "@react-navigation/bottom-tabs";
import {StyleSheet} from "react-native";
import {useFonts} from "expo-font";
import {createNativeStackNavigator} from "@react-navigation/native-stack";
import FoundObjects from "./screens/findObjectStack/FoundObjects";
import NotFoundObjects from "./screens/findObjectStack/NotFoundObjects";
import {createStackNavigator} from "@react-navigation/stack";
import LandingScreen from "./screens/login/Landing";
import LoginScreen from "./screens/login/LoginScreen";

const Tab = createBottomTabNavigator();

const FindObjectStack = createNativeStackNavigator();

const FindObjectStackScreen = () => {
    return (
        <FindObjectStack.Navigator>
            <FindObjectStack.Screen options={{
                title: 'Buscar un objeto',
                headerTitleStyle: style.headerText,
                headerTitleAlign: 'center',
                headerStyle: style.header
            }} name="FindObject" component={FindObject} />
            <FindObjectStack.Screen options={{
                title: 'Objetos Encontrados',
                headerTitleStyle: style.headerText,
                headerTitleAlign: 'center',
                headerStyle: style.header
            }} name="FoundObjects" component={FoundObjects} />
            <FindObjectStack.Screen options={{
                title: 'Objetos Encontrados',
                headerTitleStyle: style.headerText,
                headerTitleAlign: 'center',
                headerStyle: style.header
            }} name="NotFoundObjects" component={NotFoundObjects} />
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

const EurekappTab = () => {
    return (
        <Tab.Navigator>
            <Tab.Screen name="UploadObject" options={{
                title: 'Subir objeto',
                headerTitleStyle: style.headerText,
                headerTitleAlign: 'center',
                headerStyle: style.header
            }} component={UploadObject} />
            <Tab.Screen name="FindObjectStackScreen" options={{
                title: 'Encontrar Objecto',
                headerShown: false,
            }} component={FindObjectStackScreen} />
        </Tab.Navigator>
    );
}

export const LoginContext = createContext();

const App = () => {
    const [user, setUser] = useState('');
    const [ fontsLoaded ] = useFonts({
        'PlusJakartaSans-Bold': require('./assets/fonts/PlusJakartaSans-Bold.ttf'),
        'PlusJakartaSans-Regular': require('./assets/fonts/PlusJakartaSans-Regular.ttf')
    });

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
        height: 50,
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

