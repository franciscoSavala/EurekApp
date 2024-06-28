import React from 'react';
import { NavigationContainer } from '@react-navigation/native';

import FindObject from './screens/FindObject';
import UploadObject from "./screens/UploadObject";
import {createBottomTabNavigator} from "@react-navigation/bottom-tabs";
import {useFonts} from "expo-font";

const Tab = createBottomTabNavigator();

const App = () => {
    return (
        <NavigationContainer>
            <Tab.Navigator>
                <Tab.Screen name="Subir Objeto" component={UploadObject} />
                <Tab.Screen name="Encontrar Objeto" component={FindObject} />
            </Tab.Navigator>
        </NavigationContainer>
    );
}

export default App;

