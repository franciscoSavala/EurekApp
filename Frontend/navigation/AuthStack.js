import React from 'react';
import {createStackNavigator} from "@react-navigation/stack";
import LandingScreen from "../screens/login/Landing";
import LoginScreen from "../screens/login/LoginScreen";
import RegistrationScreen from "../screens/login/RegistrationScreen";
import ForgotPasswordScreen from "../screens/login/ForgotPasswordScreen";
import ResetPasswordScreen from "../screens/login/ResetPasswordScreen";

const AuthStack = createStackNavigator();

export const AuthStackScreen = () => {
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
