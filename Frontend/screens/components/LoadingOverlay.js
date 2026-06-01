import React from 'react';
import { Modal, View, ActivityIndicator, Text, StyleSheet } from 'react-native';

export default function LoadingOverlay({ visible, message }) {
    return (
        <Modal transparent animationType="fade" visible={!!visible}>
            <View style={styles.overlay}>
                <View style={styles.box}>
                    <ActivityIndicator size="large" color="#111818" />
                    {message ? <Text style={styles.message}>{message}</Text> : null}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    box: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 32,
        alignItems: 'center',
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    message: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 14,
        color: '#333',
        textAlign: 'center',
    },
});
