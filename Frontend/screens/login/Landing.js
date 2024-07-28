import React, { Component } from 'react';
import {
    Text,
    View,
    StyleSheet,
    ImageBackground,
} from 'react-native';
import {Button, Image} from 'react-native-elements';
const image = {
    uri: 'https://picsum.photos/200/300',
};

const LandingScreen = ({ navigation }) => {
        return (
            <ImageBackground source={image} style={styles.image}>
                <View style={styles.overlay}>
                    <View style={styles.logo}>
                        <Text style={styles.title}>Bienvenido a Eurekapp</Text>
                    </View>
                    <View style={styles.logo}>
                        <Image
                            source={require('../../assets/icon-eurekapp.png')}
                            style={{ width: 100, height: 100 }}
                        />
                    </View>
                    <View style={styles.btn}>
                        <Button
                            buttonStyle={{
                                backgroundColor: 'white',
                                width: 200,
                                borderRadius: 8
                            }}
                            titleStyle={{
                                color: '#017575',
                                fontFamily: 'PlusJakartaSans-Regular'
                            }}
                            onPress={() => navigation.navigate('LoginScreen')}
                            title="Login"
                        />
                        <Button
                            buttonStyle={{
                                color: 'white',
                                width: 200,
                                borderColor: 'white',
                                borderRadius: 8
                            }}
                            titleStyle={{
                                color: 'white',
                                fontFamily: 'PlusJakartaSans-Regular'
                            }}
                            title="Registrate"
                            type="outline"
                        />
                    </View>
                    <View style={styles.footer}>
                        <Text style={styles.footerText}>Terminos y condiciones</Text>
                        <Text style={styles.footerText}>Privacidad</Text>
                    </View>
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
        fontFamily: 'PlusJakartaSans-Bold'
    },
    btn: {
        flexDirection: 'column',
        height: 150,
        justifyContent: 'space-evenly',
        alignSelf: 'center',
        bottom: -50,
    },
    image: {
        flex: 1,
        resizeMode: 'cover',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        bottom: -50,
    },
    footerText: {
        color: 'white',
        fontFamily: 'PlusJakartaSans-Regular'
    },
    overlay: {
        flex: 1,
        height: '100%',
        width: '100%',
        position: 'absolute',
        backgroundColor: 'rgba(25,165,230,0.4)',
        justifyContent: 'space-evenly',
        flexDirection: 'column',
    },
});

export default LandingScreen;