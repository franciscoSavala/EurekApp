import React, { useRef } from 'react';
import {Animated, Platform, StyleSheet, Text, TouchableWithoutFeedback, View} from 'react-native';
import {useFonts} from "expo-font";

const EurekappButton = ({ onPress, text = 'Buscar mi objeto', backgroundColor = '#19e6e6', textColor = '#111818' }) => {
    const [ fontsLoaded ] = useFonts({
        'PlusJakartaSans-Bold': require('../../assets/fonts/PlusJakartaSans-Bold.ttf')
    })
    return (
        <View style={styles.container}>
            <TouchableWithoutFeedback
                onPress={onPress}
            >
                <View style={[styles.button, { backgroundColor: backgroundColor }]}>
                    <Text style={[styles.buttonText, { color: textColor}]}>{text}</Text>
                </View>
            </TouchableWithoutFeedback>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: 'column',
        justifyContent: "flex-end",
        width: '95%',
        marginVertical: 10,
    },
    button: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        borderRadius: 24, // equivalente a rounded-full en tailwind
        maxHeight: 48,
    },
    buttonText: {
        fontSize: 18,
        fontFamily: 'PlusJakartaSans-Bold'
    }
});

export default EurekappButton;
