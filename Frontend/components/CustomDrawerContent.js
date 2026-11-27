import React, {useEffect, useState} from 'react';
import {DeviceEventEmitter, StyleSheet, Text, View} from "react-native";
import {useNavigation} from '@react-navigation/native';
import {DrawerContentScrollView, DrawerItem, DrawerItemList} from "@react-navigation/drawer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import useUser from "../hooks/useUser";
import { SUPPORT_EMAIL } from '../utils/contact';

export const CustomDrawerContent = (props) => {
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
        const sub = DeviceEventEmitter.addListener('userNameChanged', fetchUserFirstName);
        return () => sub.remove();
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
        // EU-461: flexGrow y no flex. Con flex el contenido queda clavado al alto de la pantalla y,
        // cuando las opciones no entran (el administrador tiene más), el pie se dibuja encima de
        // las últimas. Con flexGrow el pie sigue abajo si sobra lugar y, si no, el menú se desplaza.
        <DrawerContentScrollView {...props} contentContainerStyle={{flexGrow: 1}}>
            <View style={{flexGrow: 1}}>
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

const styles = StyleSheet.create({
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
