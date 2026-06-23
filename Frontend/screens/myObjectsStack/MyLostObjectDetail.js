import React from 'react';
import { formatDateTimeLocaleES } from '../../utils/dateFormatter';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome6';

const InfoRow = ({ icon, label, value }) => (
    <View style={styles.infoRow}>
        <Icon name={icon} size={14} color="#638888" style={{ marginTop: 2 }} />
        <View style={{ marginLeft: 8, flex: 1 }}>
            <Text style={styles.infoLabel}>{label}</Text>
            <Text style={styles.infoValue}>{value || '—'}</Text>
        </View>
    </View>
);

const MyLostObjectDetail = ({ route, navigation }) => {
    const { lostObject } = route.params;


    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <Text style={styles.backButtonText}>← Volver</Text>
            </TouchableOpacity>

            <View style={styles.imagePlaceholder}>
                <Icon name="magnifying-glass" size={40} color="#c0d0d0" />
                <Text style={styles.imagePlaceholderText}>Búsqueda abierta</Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.title}>Búsqueda abierta</Text>
                <View style={styles.badge}>
                    <Icon name="clock" size={14} color="#0d6e6e" />
                    <Text style={styles.badgeText}>Buscando</Text>
                </View>
            </View>

            {!!lostObject.description && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Descripción de la búsqueda</Text>
                    <Text style={styles.descText}>{lostObject.description}</Text>
                </View>
            )}

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Información</Text>
                <InfoRow icon="calendar" label="Fecha de registro" value={formatDateTimeLocaleES(lostObject.lostDate)} />
                {!!lostObject.organizationId && (
                    <InfoRow icon="building" label="Organización" value={lostObject.organizationId} />
                )}
            </View>

            <View style={styles.infoBox}>
                <Icon name="bell" size={16} color="#0d6e6e" />
                <Text style={styles.infoBoxText}>
                    Te notificaremos por email cuando encontremos un objeto similar al que describiste.
                </Text>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    content: {
        paddingBottom: 32,
    },
    backButton: {
        padding: 16,
        paddingBottom: 8,
    },
    backButtonText: {
        color: '#638888',
        fontSize: 14,
        fontFamily: 'PlusJakartaSans-Regular',
    },
    imagePlaceholder: {
        width: '100%',
        height: 160,
        backgroundColor: '#f0f4f4',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    imagePlaceholderText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 13,
        color: '#aaa',
    },
    section: {
        paddingHorizontal: 16,
        paddingTop: 16,
        gap: 8,
    },
    title: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 20,
        color: '#111818',
    },
    sectionTitle: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 14,
        color: '#111818',
        marginBottom: 4,
    },
    descText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 14,
        color: '#444',
        lineHeight: 20,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        borderRadius: 20,
        paddingVertical: 5,
        paddingHorizontal: 12,
        gap: 6,
        backgroundColor: '#ccf2f2',
    },
    badgeText: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 13,
        color: '#0d6e6e',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f4f4',
    },
    infoLabel: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 12,
        color: '#638888',
    },
    infoValue: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 14,
        color: '#111818',
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        marginHorizontal: 16,
        marginTop: 20,
        backgroundColor: '#e6fafa',
        borderRadius: 12,
        padding: 14,
    },
    infoBoxText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 13,
        color: '#0d6e6e',
        flex: 1,
        lineHeight: 18,
    },
});

export default MyLostObjectDetail;
