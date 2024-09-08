import React from 'react';
import { View, StyleSheet, ImageBackground} from 'react-native';
import {Text, Image } from 'react-native-elements';
import RegistrationForm from "./components/RegistrationForm";
const image = {
    uri: 'https://picsum.photos/200/300',
};
const RegistrationScreen = ({navigation}) => {
    return (
        <ImageBackground source={image} style={styles.image}>
            <View style={styles.overlay}>
                <View>
                    <Text style={styles.title}>Regístrate</Text>
                </View>
                <View style={styles.logo}>
                    <Image
                        source={require('../../assets/icon-eurekapp.png')}
                        style={{ width: 100, height: 100 }}
                    />
                </View>
                <RegistrationForm nav={navigation}/>
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
        textAlign:"center",
        fontFamily: 'PlusJakartaSans-Bold'
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
        backgroundColor: 'rgba(25,165,230,0.5)',
        justifyContent: 'space-evenly',
        flexDirection: 'column',
    },
});

export default RegistrationScreen;