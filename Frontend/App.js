import React from 'react';
import { NavigationContainer } from '@react-navigation/native';

import FindObject from './screens/FindObject';
import UploadObject from "./screens/UploadObject";
import {createBottomTabNavigator} from "@react-navigation/bottom-tabs";
import {StyleSheet} from "react-native";
import {useFonts} from "expo-font";

const Tab = createBottomTabNavigator();

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
                    title: 'Buscar un objeto',
                    headerTitleStyle: style.headerText,
                    headerTitleAlign: 'center',
                    headerStyle: style.header
                }} component={FindObject} />
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

