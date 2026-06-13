import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Constants from 'expo-constants';
import useAuthFetch from '../../utils/useAuthFetch';
import { colors } from '../../styles/globalStyles';
import { useFocusEffect } from '@react-navigation/native';
import EmptyState from '../components/EmptyState';

const BACK_URL = Constants.expoConfig.extra.backUrl;

const CATEGORY_FILTERS = [
    { label: 'Todas', value: null },
    { label: 'Electrónica', value: 'ELECTRONICA' },
    { label: 'Ropa', value: 'ROPA' },
    { label: 'Documentos', value: 'DOCUMENTOS' },
    { label: 'Llaves', value: 'LLAVES' },
    { label: 'Accesorios', value: 'ACCESORIOS' },
    { label: 'Otros', value: 'OTROS' },
];

const SORT_OPTIONS = [
    { label: 'Fecha', value: 'date' },
    { label: 'Prioridad', value: 'priority' },
];

const ReclamosList = ({ navigation }) => {
    const { authFetch } = useAuthFetch();
    const [reclamos, setReclamos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [categoryFilter, setCategoryFilter] = useState(null);
    const [sortBy, setSortBy] = useState('date');

    const fetchReclamos = async (category, sort) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ sortBy: sort });
            if (category) params.append('category', category);
            const data = await authFetch('get', `${BACK_URL}/reclamos?${params.toString()}`);
            setReclamos(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchReclamos(categoryFilter, sortBy);
        }, [categoryFilter, sortBy])
    );

    const renderItem = ({ item }) => {
        const date = item.createdAt ? new Date(item.createdAt) : null;

        return (
            <TouchableOpacity
                style={styles.card}
                onPress={() => navigation.navigate('ReclamoDetail', { reclamoId: item.id })}>

                <View style={styles.cardBody}>
                    {item.b64Json ? (
                        <Image
                            source={{ uri: `data:image/jpeg;base64,${item.b64Json}` }}
                            style={styles.objectImage}
                            resizeMode="cover"
                        />
                    ) : (
                        <View style={[styles.objectImage, styles.objectImagePlaceholder]}>
                            <Text style={styles.objectImagePlaceholderText}>Sin imagen</Text>
                        </View>
                    )}

                    <View style={styles.cardInfo}>
                        <Text style={styles.objectTitle} numberOfLines={2}>
                            {item.foundObjectTitle || 'Objeto sin nombre'}
                        </Text>

                        {item.foundObjectCategory ? (
                            <View style={styles.categoryBadge}>
                                <Text style={styles.categoryBadgeText}>{item.foundObjectCategory}</Text>
                            </View>
                        ) : null}

                        <Text style={styles.userName} numberOfLines={1}>
                            {item.userFullName || 'Usuario desconocido'}
                        </Text>
                        <Text style={styles.userEmail} numberOfLines={1}>{item.userEmail || '-'}</Text>

                        {date ? (
                            <Text style={styles.dateText}>
                                {date.getDate()}/{date.getMonth() + 1}/{date.getFullYear()}{' '}
                                {date.getHours()}:{String(date.getMinutes()).padStart(2, '0')}
                            </Text>
                        ) : null}
                    </View>

                    <Text style={styles.chevron}>›</Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            {/* Filtros */}
            <View style={styles.filtersSection}>
                <Text style={styles.filterLabel}>Categoría</Text>
                <View style={styles.filtersRow}>
                    {CATEGORY_FILTERS.map(f => (
                        <TouchableOpacity
                            key={String(f.value)}
                            style={[styles.filterBtn, categoryFilter === f.value && styles.filterBtnActive]}
                            onPress={() => setCategoryFilter(f.value)}>
                            <Text style={[styles.filterBtnText, categoryFilter === f.value && styles.filterBtnTextActive]}>
                                {f.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <Text style={styles.filterLabel}>Ordenar por</Text>
                <View style={styles.filtersRow}>
                    {SORT_OPTIONS.map(o => (
                        <TouchableOpacity
                            key={o.value}
                            style={[styles.filterBtn, sortBy === o.value && styles.filterBtnActive]}
                            onPress={() => setSortBy(o.value)}>
                            <Text style={[styles.filterBtnText, sortBy === o.value && styles.filterBtnTextActive]}>
                                {o.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#111818" />
                </View>
            ) : (
                <FlatList
                    data={reclamos}
                    keyExtractor={item => String(item.id)}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <EmptyState icon="inbox" title="No hay reclamos registrados" />
                    }
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    filtersSection: {
        paddingHorizontal: 10,
        paddingTop: 8,
        paddingBottom: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f4f4',
    },
    filterLabel: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 11,
        color: colors.textMuted,
        marginBottom: 4,
        marginTop: 6,
    },
    filtersRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 2,
    },
    filterBtn: {
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 16,
        paddingVertical: 4,
        paddingHorizontal: 10,
    },
    filterBtnActive: {
        backgroundColor: colors.text,
        borderColor: '#111818',
    },
    filterBtnText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 12,
        color: colors.text,
    },
    filterBtnTextActive: {
        color: colors.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: 10,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: 14,
        padding: 12,
        marginBottom: 10,
        maxWidth: 800,
        width: '100%',
        alignSelf: 'center',
    },
    cardBody: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    objectImage: {
        width: 72,
        height: 72,
        borderRadius: 10,
        flexShrink: 0,
    },
    objectImagePlaceholder: {
        backgroundColor: '#d1d5db',
        justifyContent: 'center',
        alignItems: 'center',
    },
    objectImagePlaceholderText: {
        fontSize: 10,
        color: '#9ca3af',
        fontFamily: 'PlusJakartaSans-Regular',
    },
    cardInfo: {
        flex: 1,
        gap: 3,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 2,
    },
    statusBadge: {
        borderRadius: 10,
        paddingVertical: 3,
        paddingHorizontal: 10,
    },
    statusBadgeText: {
        color: colors.background,
        fontSize: 12,
        fontFamily: 'PlusJakartaSans-Bold',
    },
    suspiciousIcon: {
        fontSize: 14,
        color: colors.warning,
    },
    objectTitle: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 14,
        color: colors.text,
    },
    categoryBadge: {
        backgroundColor: '#e0f7f7',
        borderRadius: 8,
        paddingVertical: 2,
        paddingHorizontal: 8,
        alignSelf: 'flex-start',
    },
    categoryBadgeText: {
        fontSize: 11,
        fontFamily: 'PlusJakartaSans-Regular',
        color: '#19b8b8',
    },
    userName: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 13,
        color: colors.text,
    },
    userEmail: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 12,
        color: colors.textMuted,
    },
    dateText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 11,
        color: colors.textMuted,
    },
    chevron: {
        fontSize: 24,
        color: '#9ca3af',
        alignSelf: 'center',
    },
    emptyContainer: {
        paddingTop: 60,
        alignItems: 'center',
    },
    emptyText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 16,
        color: colors.textMuted,
    },
});

export default ReclamosList;
