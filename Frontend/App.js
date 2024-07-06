import React from 'react';
import { NavigationContainer } from '@react-navigation/native';

import FindObject from './screens/findObjectStack/FindObject';
import UploadObject from "./screens/UploadObject";
import {createBottomTabNavigator} from "@react-navigation/bottom-tabs";
import {StyleSheet} from "react-native";
import {useFonts} from "expo-font";
import {createNativeStackNavigator} from "@react-navigation/native-stack";
import FoundObjects from "./screens/findObjectStack/FoundObjects";
import NotFoundObjects from "./screens/findObjectStack/NotFoundObjects";

const Tab = createBottomTabNavigator();

const FindObjectStack = createNativeStackNavigator();

function FindObjectStackScreen() {
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

const App = () => {
    const [ fontsLoaded ] = useFonts({
        'PlusJakartaSans-Bold': require('./assets/fonts/PlusJakartaSans-Bold.ttf'),
        'PlusJakartaSans-Regular': require('./assets/fonts/PlusJakartaSans-Regular.ttf')
    });

    return (
        <NavigationContainer>
            <Tab.Navigator>
                <Tab.Screen name="Subir Objeto" options={{
                    title: 'Subir objeto',
                    headerTitleStyle: style.headerText,
                    headerTitleAlign: 'center',
                    headerStyle: style.header
                }} component={UploadObject} />
                <Tab.Screen name="Encontrar Objeto" options={{
                    headerShown: false,
                }} component={FindObjectStackScreen} />
            </Tab.Navigator>
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

