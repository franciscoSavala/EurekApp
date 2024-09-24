import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

const EurekappButton = ({ onPress, text = 'Buscar mi objeto',
                            backgroundColor = '#19e6e6',
                            textColor = '#111818',
                            style }) => {
    // Ref para la animación
    const rippleAnim = useRef(new Animated.Value(0)).current;
    const opacityAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        // Iniciar la animación de expansión del círculo
        rippleAnim.setValue(0);
        opacityAnim.setValue(1);
        Animated.timing(rippleAnim, {
            toValue: 1,
            duration: 500, // Duración de la animación
            useNativeDriver: true,
        }).start(() => {
            // Animar la desaparición del círculo
            Animated.timing(opacityAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }).start();
        });
    };

    return (
        <View style={style ? style : styles.container}>
            <Pressable
                onPressIn={handlePressIn}
                onPress={onPress}
                style={({ pressed }) => [
                    { opacity: pressed ? 0.8 : 1 },
                ]}
            >
                <View style={[styles.button, { backgroundColor: backgroundColor }]}>
                    <Text style={[styles.buttonText, { color: textColor }]}>{text}</Text>
                </View>
            </Pressable>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: 10,
        maxWidth: 600,
        alignSelf: 'center',
        width: '100%',
    },
    button: {
        alignSelf: 100,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        borderRadius: 24,
        height: 48,
        minHeight: 48,
        position: 'relative',
    },
    buttonText: {
        fontSize: 18,
        fontFamily: 'PlusJakartaSans-Bold'
    },
    ripple: {
        position: 'absolute',
        backgroundColor: 'rgba(0, 0, 0, 0.1)', // Color del círculo con opacidad
        width: 48,
        height: 48,
        borderRadius: 24, // Para hacer que el círculo sea redondo
    }
});

export default EurekappButton;
