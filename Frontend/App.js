import React from 'react';
import { NavigationContainer } from '@react-navigation/native';

import FindObject from './screens/FindObject';
import UpdateObject from "./screens/UpdateObject";
import {createBottomTabNavigator} from "@react-navigation/bottom-tabs";
import {createStackNavigator} from "@react-navigation/stack";

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const App = () => {
    return (
        <NavigationContainer>
            <Tab.Navigator>
                <Tab.Screen name="UpdateObject" component={UpdateObject} />
                <Tab.Screen name="FindObject" component={FindObject} />
            </Tab.Navigator>
        </NavigationContainer>
    );
}

export default App;
