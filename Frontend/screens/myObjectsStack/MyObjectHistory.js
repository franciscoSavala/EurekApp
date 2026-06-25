import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Constants from 'expo-constants';
import useAuthFetch from '../../utils/useAuthFetch';
import { colors } from '../../styles/globalStyles';
import Icon from 'react-native-vector-icons/FontAwesome6';
import EmptyState from '../components/EmptyState';

const BACK_URL = Constants.expoConfig.extra.backUrl;

const STATUS_CONFIG = {
    ACTIVE: { label: 'Buscando', color: '#0d6e6e', bg: '#ccf2f2' },
    CLOSED: { label: 'Cerrada',  color: '#638888', bg: '#e6ecec' },
};

const StatusChip = ({ status }) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.ACTIVE;
    return (
        <View style={[styles.chip, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.chipText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
    );
};

const MyObjectHistory = ({ navigation }) => {
    const { authFetch } = useAuthFetch();
    const [lostObjects, setLostObjects] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const data = await authFetch('get', `${BACK_URL}/lost-objects/my`);
            setLostObjects(data || []);
        } catch (e) {
            console.warn('Error cargando búsquedas:', e);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => { fetchData(); }, []));

    const formatDate = (isoString) => {
        if (!isoString) return '';
        const d = new Date(isoString);
        return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const renderLostObject = ({ item }) => {
        const status = item.status || 'ACTIVE';
        return (
            <TouchableOpacity
                style={styles.card}
                onPress={() => navigation.navigate('MyLostObjectDetail', { lostObject: item })}
            >
                <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                        {item.description || 'Búsqueda guardada'}
                    </Text>
                    <StatusChip status={status} />
                </View>
                <View style={styles.cardFooter}>
                    <Icon name="calendar" size={12} color="#638888" />
                    <Text style={styles.cardDate}> Registrada: {formatDate(item.lostDate)}</Text>
                </View>
                {status === 'CLOSED' && !!item.closedDate && (
                    <View style={styles.cardFooter}>
                        <Icon name="circle-check" size={12} color="#638888" />
                        <Text style={styles.cardDate}> Cerrada: {formatDate(item.closedDate)}</Text>
                    </View>
                )}
                {status === 'CLOSED' && item.recovered != null && (
                    <View style={styles.cardFooter}>
                        <Icon
                            name={item.recovered ? 'circle-check' : 'circle-xmark'}
                            size={12}
                            color={item.recovered ? '#0d9e6e' : '#b04a4a'}
                        />
                        <Text style={[styles.cardDate, { color: item.recovered ? '#0d9e6e' : '#b04a4a' }]}>
                            {item.recovered ? ' Recuperado' : ' No recuperado'}
                        </Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#0d9e9e" />
            </View>
        );
    }

    if (lostObjects.length === 0) {
        return (
            <View style={styles.container}>
                <EmptyState
                    icon="magnifying-glass"
                    title="Sin búsquedas guardadas"
                    description="Cuando guardes una búsqueda, aparecerá acá con su estado actualizado."
                />
            </View>
        );
    }

    const active = lostObjects.filter((lo) => (lo.status || 'ACTIVE') === 'ACTIVE');
    const closed = lostObjects.filter((lo) => lo.status === 'CLOSED');

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            {active.length > 0 && (
                <>
                    <Text style={styles.heading}>Búsquedas activas</Text>
                    <FlatList
                        data={active}
                        keyExtractor={(item) => `lost-${item.uuid}`}
                        renderItem={renderLostObject}
                        scrollEnabled={false}
                        contentContainerStyle={styles.list}
                    />
                </>
            )}

            {closed.length > 0 && (
                <>
                    <Text style={[styles.heading, active.length > 0 && { marginTop: 24 }]}>
                        Búsquedas cerradas
                    </Text>
                    <FlatList
                        data={closed}
                        keyExtractor={(item) => `lost-${item.uuid}`}
                        renderItem={renderLostObject}
                        scrollEnabled={false}
                        contentContainerStyle={styles.list}
                    />
                </>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: 16,
    },
    scrollContent: {
        paddingBottom: 32,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
    },
    heading: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 22,
        color: colors.text,
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    list: {
        paddingHorizontal: 16,
        gap: 12,
    },
    card: {
        backgroundColor: '#f7fafa',
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e0ecec',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    cardTitle: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 15,
        color: colors.text,
        flex: 1,
        marginRight: 8,
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    cardDate: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 12,
        color: colors.textMuted,
    },
    chip: {
        borderRadius: 20,
        paddingVertical: 3,
        paddingHorizontal: 10,
    },
    chipText: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 11,
    },
});

export default MyObjectHistory;
