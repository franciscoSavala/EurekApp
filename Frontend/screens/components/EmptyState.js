import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome6';
import { colors } from '../../styles/globalStyles';

const EmptyState = ({ icon, title, description }) => (
    <View style={styles.container}>
        {icon && <Icon name={icon} size={40} color={colors.textMuted} style={styles.icon} />}
        <Text style={styles.title}>{title}</Text>
        {description && <Text style={styles.description}>{description}</Text>}
    </View>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 40,
    },
    icon: {
        marginBottom: 16,
    },
    title: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '500',
        fontFamily: 'PlusJakartaSans-Bold',
        textAlign: 'center',
        marginBottom: 8,
    },
    description: {
        color: colors.textMuted,
        fontSize: 14,
        fontFamily: 'PlusJakartaSans-Regular',
        textAlign: 'center',
    },
});

export default EmptyState;
