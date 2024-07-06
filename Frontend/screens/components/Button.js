import React from 'react';
import {Pressable, StyleSheet, Text, TouchableWithoutFeedback, View} from 'react-native';

const EurekappButton = ({ onPress, text = 'Buscar mi objeto', backgroundColor = '#19e6e6', textColor = '#111818' }) => {
    
    return (
        <View style={styles.container}>
            <Pressable
                onPress={onPress}
            >
                <View style={[styles.button, { backgroundColor: backgroundColor }]}>
                    <Text style={[styles.buttonText, { color: textColor}]}>{text}</Text>
                </View>
            </Pressable>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: 'column',
        justifyContent: "flex-end",
        width: '90%',
        marginVertical: 10,
    },
    button: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        borderRadius: 24, // equivalente a rounded-full en tailwind
        maxHeight: 48,
        minHeight: 48,
    },
    buttonText: {
        fontSize: 18,
        fontFamily: 'PlusJakartaSans-Bold'
    }
});

export default EurekappButton;
