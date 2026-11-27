import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../styles/globalStyles';

/** Aviso de que una consulta falló (distinto de "no hay resultados") con botón para reintentar. */
const ErrorRetry = ({ message, onRetry, style }) => (
    <View style={[styles.container, style]} accessibilityRole="alert">
        <Text style={styles.message}>{message}</Text>
        {onRetry && (
            <TouchableOpacity style={styles.button} onPress={onRetry}>
                <Text style={styles.buttonText}>Reintentar</Text>
            </TouchableOpacity>
        )}
    </View>
);

const styles = StyleSheet.create({
    container: {
        alignSelf: 'stretch',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: '#fdeeee',
    },
    message: {
        color: '#b42318',
        fontSize: 14,
        fontFamily: 'PlusJakartaSans-Regular',
        textAlign: 'center',
        marginBottom: 8,
    },
    button: {
        backgroundColor: '#19e6e6',
        borderRadius: 12,
        paddingVertical: 8,
        paddingHorizontal: 20,
    },
    buttonText: {
        color: colors.text,
        fontSize: 14,
        fontFamily: 'PlusJakartaSans-Bold',
    },
});

export default ErrorRetry;
