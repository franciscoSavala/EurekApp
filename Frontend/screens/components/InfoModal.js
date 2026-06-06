import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome6';
import BaseModal from './BaseModal';

const TYPE_CONFIG = {
    error:   { icon: 'circle-xmark',      color: '#CC4444', bg: '#fee2e2' },
    warning: { icon: 'triangle-exclamation', color: '#b45309', bg: '#fef9c3' },
    info:    { icon: 'circle-info',        color: '#2E86AB', bg: '#e0f2fe' },
};

const InfoModal = ({
    visible,
    onClose,
    title,
    message,
    type = 'info',
    confirmLabel = 'Entendido',
    onConfirm = null,
    cancelLabel = null,
    onCancel = null,
}) => {
    const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.info;
    const handleConfirm = () => {
        if (onConfirm) onConfirm();
        onClose();
    };
    const handleCancel = () => {
        if (onCancel) onCancel();
        onClose();
    };

    return (
        <BaseModal visible={visible} onClose={onClose}>
            <View style={[styles.iconContainer, { backgroundColor: cfg.bg }]}>
                <Icon name={cfg.icon} size={28} color={cfg.color} />
            </View>

            {title ? (
                <Text style={styles.title}>{title}</Text>
            ) : null}

            {message ? (
                <Text style={styles.message}>{message}</Text>
            ) : null}

            <View style={styles.actions}>
                {cancelLabel ? (
                    <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
                        <Text style={styles.cancelBtnText}>{cancelLabel}</Text>
                    </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                    style={[styles.confirmBtn, { backgroundColor: cfg.color }]}
                    onPress={handleConfirm}
                >
                    <Text style={styles.confirmBtnText}>{confirmLabel}</Text>
                </TouchableOpacity>
            </View>
        </BaseModal>
    );
};

const styles = StyleSheet.create({
    iconContainer: {
        width: 60, height: 60, borderRadius: 30,
        justifyContent: 'center', alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 17,
        fontFamily: 'PlusJakartaSans-Bold',
        color: '#1A3434',
        textAlign: 'center',
        marginBottom: 10,
    },
    message: {
        fontSize: 14,
        fontFamily: 'PlusJakartaSans-Regular',
        color: '#555',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
    },
    actions: {
        flexDirection: 'row',
        gap: 10,
        width: '100%',
        justifyContent: 'center',
    },
    cancelBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#dde8e8',
        backgroundColor: '#f0f4f4',
        alignItems: 'center',
    },
    cancelBtnText: {
        fontSize: 14,
        fontFamily: 'PlusJakartaSans-Bold',
        color: '#555',
    },
    confirmBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
    },
    confirmBtnText: {
        fontSize: 14,
        fontFamily: 'PlusJakartaSans-Bold',
        color: '#fff',
    },
});

export default InfoModal;
