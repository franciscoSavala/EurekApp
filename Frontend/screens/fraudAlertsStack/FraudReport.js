import React, { useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Constants from 'expo-constants';
import DateTimePicker from '@react-native-community/datetimepicker';

const BACK_URL = Constants.expoConfig.extra.backUrl;

const REASON_LABELS = {
    MULTIPLE_CLAIMERS_SAME_OBJECT: 'Múltiples reclamantes',
    HIGH_CLAIM_FREQUENCY: 'Alta frecuencia de reclamos',
};

const STATUS_OPTIONS = [
    { label: 'Todos', value: '' },
    { label: 'Pendiente', value: 'PENDING' },
    { label: 'Confirmado', value: 'CONFIRMED_FRAUD' },
    { label: 'Falso positivo', value: 'FALSE_POSITIVE' },
];

const ACTION_COLORS = {
    'Advertencia': '#f59e0b',
    'Suspensión temporal': '#b45309',
    'Bloqueo': '#ED4337',
    'Sin acción sugerida': '#aaa',
};

const formatDate = (d) => d.toISOString().split('T')[0];

const defaultFrom = () => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
};

const FraudReport = () => {
    const [fromDate, setFromDate] = useState(defaultFrom());
    const [toDate, setToDate] = useState(new Date());
    const [showFrom, setShowFrom] = useState(false);
    const [showTo, setShowTo] = useState(false);
    const [statusFilter, setStatusFilter] = useState('');
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [expandedUser, setExpandedUser] = useState(null);

    const fetchReport = async () => {
        setLoading(true);
        try {
            const jwt = await AsyncStorage.getItem('jwt');
            const params = `from=${formatDate(fromDate)}&to=${formatDate(toDate)}${statusFilter ? `&status=${statusFilter}` : ''}`;
            const res = await axios.get(`${BACK_URL}/fraud-alerts/report?${params}`, {
                headers: { Authorization: `Bearer ${jwt}` },
            });
            setEntries(res.data);
        } catch (error) {
            console.log(error);
        } finally {
            setLoading(false);
        }
    };

    const exportCsv = async () => {
        setExporting(true);
        const jwt = await AsyncStorage.getItem('jwt');
        const params = `from=${formatDate(fromDate)}&to=${formatDate(toDate)}${statusFilter ? `&status=${statusFilter}` : ''}`;
        const url = `${BACK_URL}/fraud-alerts/report/export?${params}`;
        if (Platform.OS === 'web') {
            try {
                const res = await fetch(url, { headers: { Authorization: `Bearer ${jwt}` } });
                const blob = await res.blob();
                const objectUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = objectUrl;
                a.download = 'fraud-report.csv';
                a.click();
                URL.revokeObjectURL(objectUrl);
            } catch (e) {
                console.warn('Error exportando CSV:', e);
            }
        } else {
            try {
                const FileSystem = require('expo-file-system');
                const Sharing = require('expo-sharing');
                const fileUri = FileSystem.cacheDirectory + 'fraud-report.csv';
                const downloadRes = await FileSystem.downloadAsync(url, fileUri, {
                    headers: { Authorization: `Bearer ${jwt}` },
                });
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(downloadRes.uri);
                }
            } catch (e) {
                console.warn('Error exportando CSV:', e);
            }
        }
        setExporting(false);
    };

    const toggleExpand = (userId) => {
        setExpandedUser(prev => prev === userId ? null : userId);
    };

    const renderEntry = ({ item }) => {
        const isExpanded = expandedUser === item.userId;
        const actionColor = ACTION_COLORS[item.suggestedAction] || '#aaa';
        return (
            <TouchableOpacity style={styles.card} onPress={() => toggleExpand(item.userId)}>
                <View style={styles.cardHeader}>
                    <View style={styles.userInfo}>
                        <Text style={styles.userName}>{item.fullName}</Text>
                        <Text style={styles.userEmail}>{item.email}</Text>
                    </View>
                    <View style={[styles.actionChip, { backgroundColor: actionColor }]}>
                        <Text style={styles.actionChipText}>{item.suggestedAction}</Text>
                    </View>
                </View>
                <View style={styles.statsRow}>
                    <Text style={styles.statText}>Total alertas: <Text style={styles.statValue}>{item.fraudCount}</Text></Text>
                    <Text style={styles.statText}>Confirmadas: <Text style={styles.statValue}>{item.confirmedFraudCount}</Text></Text>
                </View>
                <Text style={styles.reasonsText}>
                    {item.reasons.map(r => REASON_LABELS[r] || r).join(', ')}
                </Text>
                {isExpanded && (
                    <View style={styles.incidentsContainer}>
                        <Text style={styles.incidentsTitle}>Incidentes</Text>
                        {item.incidents.map(inc => (
                            <View key={inc.id} style={styles.incidentRow}>
                                <Text style={styles.incidentDate}>
                                    {inc.createdAt ? new Date(inc.createdAt).toLocaleString('es-AR') : '-'}
                                </Text>
                                <Text style={styles.incidentReason}>{REASON_LABELS[inc.reason] || inc.reason}</Text>
                                <Text style={styles.incidentStatus}>{inc.status}</Text>
                            </View>
                        ))}
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.filtersContainer}>
                <View style={styles.dateRow}>
                    <View style={styles.dateBlock}>
                        <Text style={styles.filterLabel}>Desde</Text>
                        <TouchableOpacity style={styles.dateButton} onPress={() => setShowFrom(true)}>
                            <Text style={styles.dateButtonText}>{formatDate(fromDate)}</Text>
                        </TouchableOpacity>
                        {showFrom && (
                            <DateTimePicker value={fromDate} mode="date" display="default"
                                onChange={(_, d) => { setShowFrom(false); if (d) setFromDate(d); }} />
                        )}
                    </View>
                    <View style={styles.dateBlock}>
                        <Text style={styles.filterLabel}>Hasta</Text>
                        <TouchableOpacity style={styles.dateButton} onPress={() => setShowTo(true)}>
                            <Text style={styles.dateButtonText}>{formatDate(toDate)}</Text>
                        </TouchableOpacity>
                        {showTo && (
                            <DateTimePicker value={toDate} mode="date" display="default"
                                onChange={(_, d) => { setShowTo(false); if (d) setToDate(d); }} />
                        )}
                    </View>
                </View>

                <Text style={styles.filterLabel}>Estado</Text>
                <View style={styles.statusRow}>
                    {STATUS_OPTIONS.map(opt => (
                        <TouchableOpacity
                            key={opt.value}
                            style={[styles.statusBtn, statusFilter === opt.value && styles.statusBtnActive]}
                            onPress={() => setStatusFilter(opt.value)}>
                            <Text style={[styles.statusBtnText, statusFilter === opt.value && styles.statusBtnTextActive]}>
                                {opt.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <TouchableOpacity style={styles.generateBtn} onPress={fetchReport} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.generateBtnText}>Generar reporte</Text>}
                </TouchableOpacity>
            </ScrollView>

            {entries.length > 0 && (
                <TouchableOpacity style={styles.exportBtn} onPress={exportCsv} disabled={exporting}>
                    {exporting ? <ActivityIndicator color="#111818" /> : <Text style={styles.exportBtnText}>Exportar CSV</Text>}
                </TouchableOpacity>
            )}

            <FlatList
                data={entries}
                keyExtractor={(item) => item.userId.toString()}
                renderItem={renderEntry}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    !loading ? (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No hay usuarios con fraude en el período seleccionado</Text>
                        </View>
                    ) : null
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    filtersContainer: {
        padding: 16,
        paddingBottom: 8,
    },
    dateRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
    },
    dateBlock: {
        flex: 1,
    },
    filterLabel: {
        fontSize: 13,
        fontFamily: 'PlusJakartaSans-Regular',
        color: '#638888',
        marginBottom: 4,
    },
    dateButton: {
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 8,
        padding: 8,
        alignItems: 'center',
    },
    dateButtonText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 14,
        color: '#111818',
    },
    statusRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
    },
    statusBtn: {
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 20,
        paddingVertical: 5,
        paddingHorizontal: 12,
    },
    statusBtnActive: {
        backgroundColor: '#111818',
        borderColor: '#111818',
    },
    statusBtnText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 13,
        color: '#111818',
    },
    statusBtnTextActive: {
        color: '#fff',
    },
    generateBtn: {
        backgroundColor: '#111818',
        borderRadius: 24,
        paddingVertical: 12,
        alignItems: 'center',
    },
    generateBtnText: {
        color: '#fff',
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 14,
    },
    exportBtn: {
        marginHorizontal: 16,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#111818',
        borderRadius: 24,
        paddingVertical: 10,
        alignItems: 'center',
    },
    exportBtnText: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 14,
        color: '#111818',
    },
    listContent: {
        padding: 16,
        paddingTop: 8,
        flexGrow: 1,
    },
    card: {
        backgroundColor: '#f0f4f4',
        borderRadius: 16,
        padding: 16,
        marginBottom: 10,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    userInfo: {
        flex: 1,
        marginRight: 8,
    },
    userName: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 15,
        color: '#111818',
    },
    userEmail: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 13,
        color: '#638888',
    },
    actionChip: {
        borderRadius: 12,
        paddingVertical: 4,
        paddingHorizontal: 10,
    },
    actionChipText: {
        color: '#fff',
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 12,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 4,
    },
    statText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 13,
        color: '#638888',
    },
    statValue: {
        fontFamily: 'PlusJakartaSans-Bold',
        color: '#111818',
    },
    reasonsText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 13,
        color: '#638888',
    },
    incidentsContainer: {
        marginTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#d1d5db',
        paddingTop: 10,
    },
    incidentsTitle: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 13,
        color: '#111818',
        marginBottom: 6,
    },
    incidentRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
        flexWrap: 'wrap',
        gap: 4,
    },
    incidentDate: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 12,
        color: '#638888',
    },
    incidentReason: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 12,
        color: '#111818',
        flex: 1,
        textAlign: 'center',
    },
    incidentStatus: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 12,
        color: '#638888',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 40,
    },
    emptyText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 15,
        color: '#638888',
        textAlign: 'center',
    },
});

export default FraudReport;
