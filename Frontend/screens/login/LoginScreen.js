import React from 'react';
import { View, StyleSheet, ImageBackground} from 'react-native';
import {Text, Image } from 'react-native-elements';
import LoginForm from './components/LoginForm'
const image = {
    uri: 'https://picsum.photos/200/300',
};
const LoginScreen = ({navigation}) => {
    return (
        <ImageBackground source={image} style={styles.image}>
            <View style={styles.overlay}>
                {/*
                TODO: LOGO EUREKAPP
                    <View style={styles.logo}>
                        <Image
                            source={require('../../assets/logo.png')}
                            style={{ width: 100, height: 100 }}
                        />
                    </View>
                */}
                <View><Text style={styles.title}>Inicia sesión</Text></View>
                <LoginForm nav={navigation}/>

            </View>
        </ImageBackground>
    );

}

const styles = StyleSheet.create({
    logo: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 20,
        textAlign:"center"
    },
    image: {
        flex: 1,
        resizeMode: 'cover',
    },
    overlay: {
        flex: 1,
        height: '100%',
        width: '100%',
        position: 'absolute',
        backgroundColor: '#054a4a',
        justifyContent: 'space-evenly',
        flexDirection: 'column',
    },
});

export default LoginScreen;