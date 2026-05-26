import React, { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { buildFraudReportHtml, exportPdf } from '../../utils/pdfExport';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosInstance from "../../utils/axiosInstance";
import Constants from 'expo-constants';
import DateTimePicker from '@react-native-community/datetimepicker';

const BACK_URL = Constants.expoConfig.extra.backUrl;

const REASON_LABELS = {
    MULTIPLE_CLAIMERS_SAME_OBJECT: 'Múltiples reclamantes',
    HIGH_CLAIM_FREQUENCY: 'Alta frecuencia de reclamos',
    FINDER_CLAIMER_COLLUSION: 'Acuerdo registrador/reclamante',
    REPEATED_REJECTIONS: 'Reclamos rechazados repetidos',
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

const AVATAR_COLORS = ['#19b8b8', '#b45309', '#4caf50', '#7c4dff', '#e53935', '#f0a500'];

const UserAvatar = ({ fullName }) => {
    const initials = (fullName || '?')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map(w => w[0].toUpperCase())
        .join('');
    const idx = (fullName || '').charCodeAt(0) % AVATAR_COLORS.length;
    return (
        <View style={[styles.avatar, { backgroundColor: AVATAR_COLORS[idx] }]}>
            <Text style={styles.avatarText}>{initials}</Text>
        </View>
    );
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
    const [exportingPdf, setExportingPdf] = useState(false);
    const [expandedUser, setExpandedUser] = useState(null);
    const [sortBy, setSortBy] = useState('confirmedFraudCount');

    const sortedEntries = useMemo(() => {
        return [...entries].sort((a, b) => {
            if (sortBy === 'fullName') return (a.fullName || '').localeCompare(b.fullName || '');
            return (b[sortBy] || 0) - (a[sortBy] || 0);
        });
    }, [entries, sortBy]);

    const fetchReport = async () => {
        setLoading(true);
        try {
            const jwt = await AsyncStorage.getItem('jwt');
            const params = `from=${formatDate(fromDate)}&to=${formatDate(toDate)}${statusFilter ? `&status=${statusFilter}` : ''}`;
            const res = await axiosInstance.get(`${BACK_URL}/fraud-alerts/report?${params}`, {
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

    const handleExportPdf = async () => {
        setExportingPdf(true);
        try {
            const html = buildFraudReportHtml(entries, {
                fromDate: formatDate(fromDate),
                toDate: formatDate(toDate),
                statusFilter,
            });
            await exportPdf(html, `Reporte_Fraude_${formatDate(new Date())}.pdf`);
        } catch (e) {
            console.warn('Error exportando PDF:', e);
            Alert.alert('Error', 'No se pudo exportar el PDF. Intentá nuevamente.');
        } finally {
            setExportingPdf(false);
        }
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
                    <UserAvatar fullName={item.fullName} />
                    <View style={[styles.userInfo, { marginLeft: 10 }]}>
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
                            Platform.OS === 'web' ? (
                                <input
                                    type="date"
                                    defaultValue={formatDate(fromDate)}
                                    style={{ padding: 8, borderRadius: 8, border: '1px solid #ccc', fontSize: 14, marginTop: 4 }}
                                    onChange={(e) => { setShowFrom(false); if (e.target.value) setFromDate(new Date(e.target.value)); }}
                                    onBlur={() => setShowFrom(false)}
                                    autoFocus
                                />
                            ) : (
                                <DateTimePicker value={fromDate} mode="date" display="default"
                                    onChange={(_, d) => { setShowFrom(false); if (d) setFromDate(d); }} />
                            )
                        )}
                    </View>
                    <View style={styles.dateBlock}>
                        <Text style={styles.filterLabel}>Hasta</Text>
                        <TouchableOpacity style={styles.dateButton} onPress={() => setShowTo(true)}>
                            <Text style={styles.dateButtonText}>{formatDate(toDate)}</Text>
                        </TouchableOpacity>
                        {showTo && (
                            Platform.OS === 'web' ? (
                                <input
                                    type="date"
                                    defaultValue={formatDate(toDate)}
                                    style={{ padding: 8, borderRadius: 8, border: '1px solid #ccc', fontSize: 14, marginTop: 4 }}
                                    onChange={(e) => { setShowTo(false); if (e.target.value) setToDate(new Date(e.target.value)); }}
                                    onBlur={() => setShowTo(false)}
                                    autoFocus
                                />
                            ) : (
                                <DateTimePicker value={toDate} mode="date" display="default"
                                    onChange={(_, d) => { setShowTo(false); if (d) setToDate(d); }} />
                            )
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

                <Text style={styles.filterLabel}>Ordenar por</Text>
                <View style={styles.statusRow}>
                    {[
                        { label: 'Fraudes confirmados', value: 'confirmedFraudCount' },
                        { label: 'Total alertas', value: 'fraudCount' },
                        { label: 'Nombre A-Z', value: 'fullName' },
                    ].map(opt => (
                        <TouchableOpacity
                            key={opt.value}
                            style={[styles.statusBtn, sortBy === opt.value && styles.statusBtnActive]}
                            onPress={() => setSortBy(opt.value)}>
                            <Text style={[styles.statusBtnText, sortBy === opt.value && styles.statusBtnTextActive]}>
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
                <View style={styles.exportRow}>
                    <TouchableOpacity style={styles.exportBtn} onPress={exportCsv} disabled={exporting}>
                        {exporting ? <ActivityIndicator color="#111818" /> : <Text style={styles.exportBtnText}>Exportar CSV</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.exportBtn, styles.exportBtnPdf]} onPress={handleExportPdf} disabled={exportingPdf}>
                        {exportingPdf ? <ActivityIndicator color="white" /> : <Text style={[styles.exportBtnText, { color: 'white' }]}>Exportar PDF</Text>}
                    </TouchableOpacity>
                </View>
            )}

            <FlatList
                data={sortedEntries}
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
    exportRow: {
        flexDirection: 'row',
        gap: 10,
        marginHorizontal: 16,
        marginBottom: 8,
    },
    exportBtn: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#111818',
        borderRadius: 24,
        paddingVertical: 10,
        alignItems: 'center',
    },
    exportBtnPdf: {
        backgroundColor: '#b45309',
        borderColor: '#b45309',
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
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
    },
    avatarText: {
        color: 'white',
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 15,
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
