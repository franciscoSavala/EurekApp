import React, { useMemo, useState } from 'react';
import Toast from 'react-native-toast-message';
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
import { buildFraudReportHtml, exportPdf } from '../../utils/pdfExport';
import { STATUS_LABELS, humanizeReason } from '../../utils/fraudLabels';
import FraudEvolutionChart from '../components/FraudEvolutionChart';
import DonutChart from '../components/DonutChart';
import WebDateInput from '../components/WebDateInput';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { fetchWithAuth, refreshJwt } from '../../utils/fetchWithAuth';
import useAuthFetch from '../../utils/useAuthFetch';
import { colors } from '../../styles/globalStyles';
import DateTimePicker from '@react-native-community/datetimepicker';
import { isIOS } from '../../utils/platform';
import { formatDateISO } from '../../utils/dateFormatter';

const BACK_URL = Constants.expoConfig.extra.backUrl;

// Modelo de 2 estados (EU-288): activa (bloquea) o falsa alarma (destraba). Ya no hay "en revisión".
const STATUS_OPTIONS = [
    { label: 'Todos', value: '' },
    { label: 'Activa', value: 'ACTIVE' },
    { label: 'Falsa alarma', value: 'FALSE_POSITIVE' },
];

// El reporte se puede ver agrupado por persona registrada o por DNI (mucha gente del fraude no tiene cuenta).
const GROUP_OPTIONS = [
    { label: 'Por usuario', value: 'USER' },
    { label: 'Por DNI', value: 'DNI' },
];

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
    const { authFetch } = useAuthFetch();
    const [fromDate, setFromDate] = useState(defaultFrom());
    const [toDate, setToDate] = useState(new Date());
    const [showFrom, setShowFrom] = useState(false);
    const [showTo, setShowTo] = useState(false);
    const [statusFilter, setStatusFilter] = useState('');
    const [groupBy, setGroupBy] = useState('USER');
    const [entries, setEntries] = useState([]);
    // EU-395: la agrupación del gráfico de evolución vive acá, y no adentro del gráfico, porque el
    // PDF se exporta con la que esté elegida en pantalla (el PDF no tiene los botones).
    const [evolutionGranularity, setEvolutionGranularity] = useState('month');
    // EU-392: los totales del período los calcula el backend sobre las alertas del rango. No se
    // pueden sacar de las filas: una alerta con varios sospechosos cae en la fila de cada uno, y una
    // de Caso 1 puro no cae en ninguna.
    const [summary, setSummary] = useState(null);
    // EU-394: los filtros con los que se trajo lo que está en pantalla. Los controles de arriba
    // cambian en el momento, los datos sólo al generar; el PDF tiene que usar estos y no aquéllos,
    // o sale con el encabezado de un filtro y las filas de otro.
    const [generatedFilters, setGeneratedFilters] = useState(null);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [exportingPdf, setExportingPdf] = useState(false);
    const [expandedKey, setExpandedKey] = useState(null);
    const [sortBy, setSortBy] = useState('activeCount');

    // EU-394: las filas se dibujan según el agrupamiento con el que se TRAJERON los datos, no según
    // el del control. Si no, al cambiar a "Por DNI" sin regenerar la lista pasa a modo DNI con la
    // columna vacía, porque las filas de usuario no tienen ese campo: el mismo cruce que el PDF.
    const isDniMode = (generatedFilters?.groupBy ?? groupBy) === 'DNI';
    const keyOf = (item) => (item.userId != null ? item.userId.toString() : item.dni);

    const sortedEntries = useMemo(() => {
        return [...entries].sort((a, b) => {
            if (sortBy === 'fullName' && !isDniMode) return (a.fullName || '').localeCompare(b.fullName || '');
            return (b[sortBy] || 0) - (a[sortBy] || 0);
        });
    }, [entries, sortBy, isDniMode]);

    const fetchReport = async () => {
        setLoading(true);
        const filters = {
            fromDate: formatDateISO(fromDate),
            toDate: formatDateISO(toDate),
            statusFilter,
            groupBy,
        };
        try {
            const params = `from=${filters.fromDate}&to=${filters.toDate}`
                + `${statusFilter ? `&status=${statusFilter}` : ''}&groupBy=${groupBy}`;
            const data = await authFetch('get', `${BACK_URL}/fraud-alerts/report?${params}`);
            setEntries(data?.entries ?? []);
            setSummary(data?.summary ?? null);
            setGeneratedFilters(filters);
        } catch (error) {
            console.log(error);
        } finally {
            setLoading(false);
        }
    };

    const exportCsv = async () => {
        setExporting(true);
        const params = `from=${formatDateISO(fromDate)}&to=${formatDateISO(toDate)}`
            + `${statusFilter ? `&status=${statusFilter}` : ''}&groupBy=${groupBy}`;
        const url = `${BACK_URL}/fraud-alerts/report/export?${params}`;
        if (Platform.OS === 'web') {
            try {
                const res = await fetchWithAuth(url);
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
                const download = async (jwt) => FileSystem.downloadAsync(url, fileUri, {
                    headers: { Authorization: `Bearer ${jwt}` },
                });
                let jwt = await AsyncStorage.getItem('jwt');
                let downloadRes = await download(jwt);
                if (downloadRes.status === 401 || downloadRes.status === 403) {
                    const newToken = await refreshJwt();
                    if (newToken) downloadRes = await download(newToken);
                }
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
        if (!generatedFilters) return;
        setExportingPdf(true);
        try {
            const html = buildFraudReportHtml(entries, generatedFilters, summary, evolutionGranularity);
            await exportPdf(html, `Reporte_Fraude_${formatDateISO(new Date())}.pdf`);
        } catch (e) {
            console.warn('Error exportando PDF:', e);
            Toast.show({ type: 'error', text1: 'Error', text2: 'No se pudo exportar el PDF. Intentá nuevamente.' });
        } finally {
            setExportingPdf(false);
        }
    };

    const toggleExpand = (key) => {
        setExpandedKey(prev => prev === key ? null : key);
    };

    const renderEntry = ({ item }) => {
        const key = keyOf(item);
        const isExpanded = expandedKey === key;
        // Reincidente = tiene alertas anteriores al período (EU-226). Las posteriores no cuentan.
        const isRepeat = (item.priorCount || 0) > 0;
        return (
            <TouchableOpacity style={styles.card} onPress={() => toggleExpand(key)}>
                <View style={styles.cardHeader}>
                    {isDniMode ? (
                        <View style={styles.dniBadge}><Text style={styles.dniBadgeText}>DNI</Text></View>
                    ) : (
                        <UserAvatar fullName={item.fullName} />
                    )}
                    <View style={[styles.userInfo, { marginLeft: 10 }]}>
                        {isDniMode ? (
                            <Text style={styles.userName}>{item.dni}</Text>
                        ) : (
                            <>
                                <Text style={styles.userName}>{item.fullName}</Text>
                                <Text style={styles.userEmail}>{item.email}</Text>
                            </>
                        )}
                    </View>
                    {isRepeat && (
                        <View style={styles.repeatChip}>
                            <Text style={styles.repeatChipText}>⚠ Reincidente</Text>
                        </View>
                    )}
                </View>

                {/* Números del período consultado */}
                <View style={styles.statsRow}>
                    <Text style={styles.statText}>En el período: <Text style={styles.statValue}>{item.fraudCount}</Text></Text>
                    <Text style={styles.statText}>Activas: <Text style={styles.statValue}>{item.activeCount}</Text></Text>
                    <Text style={styles.statText}>Falsas alarmas: <Text style={styles.statValue}>{item.falsePositiveCount ?? 0}</Text></Text>
                </View>
                <Text style={styles.reasonsText}>
                    {(item.reasons || []).map(humanizeReason).filter(Boolean).join(' · ')}
                </Text>

                {/* Reincidencia: acumulado histórico, separado de los números del período */}
                <View style={styles.historicRow}>
                    <Text style={styles.historicText}>
                        Histórico acumulado: <Text style={styles.statValue}>{item.historicalCount ?? item.fraudCount}</Text> alertas
                    </Text>
                    <Text style={styles.expandHint}>{isExpanded ? 'ocultar historial' : 'ver historial completo'}</Text>
                </View>

                {isExpanded && (
                    <View style={styles.incidentsContainer}>
                        <Text style={styles.incidentsTitle}>Historial de incidentes</Text>
                        {(item.incidents || []).map(inc => (
                            <View key={inc.id} style={styles.incidentRow}>
                                <Text style={styles.incidentDate}>
                                    {inc.createdAt ? new Date(inc.createdAt).toLocaleDateString('es-AR') : '-'}
                                </Text>
                                <Text style={styles.incidentReason}>{humanizeReason(inc.reason)}</Text>
                                <Text style={styles.incidentStatus}>{STATUS_LABELS[inc.status] || inc.status}</Text>
                            </View>
                        ))}
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    // EU-394: los controles se movieron después de generar, así que lo que se ve (y lo que saldría
    // en el PDF) ya no es lo que los filtros dicen. Se avisa en pantalla en vez de dejarlo pasar.
    const filtersOutOfDate = generatedFilters != null && (
        generatedFilters.fromDate !== formatDateISO(fromDate)
        || generatedFilters.toDate !== formatDateISO(toDate)
        || generatedFilters.statusFilter !== statusFilter
        || generatedFilters.groupBy !== groupBy
    );

    // EU-390: los totales del período salen del resumen que arma el backend, igual que en el PDF.
    const activeCount = summary?.activeCount ?? 0;
    const falsePositiveCount = summary?.falsePositiveCount ?? 0;
    const totalAlerts = activeCount + falsePositiveCount;

    // Los gráficos y el aviso viajan como encabezado de la lista, no como bloque fijo entre los
    // filtros y ella: la pantalla ya tiene dos zonas con scroll propio disputándose el alto, y todo
    // lo que crece en el medio se lo come a alguna de las dos.
    const reportHeader = (
        <>
            {filtersOutOfDate && (
                <View style={styles.staleNotice}>
                    <Text style={styles.staleNoticeText}>
                        Estás viendo el reporte generado antes de cambiar los filtros. Generá el
                        reporte de nuevo para aplicarlos, acá y en el PDF.
                    </Text>
                </View>
            )}

            {entries.length > 0 && totalAlerts > 0 && (
                <View style={styles.chartBlock}>
                    <Text style={styles.filterLabel}>Activas vs. falsas alarmas</Text>
                    <DonutChart
                        recovered={activeCount}
                        total={totalAlerts}
                        primaryColor="#ED4337"
                        secondaryColor="#008000"
                        primaryLabel="Activas"
                        secondaryLabel="Falsas alarmas"
                        centerLabel="activas"
                    />
                </View>
            )}

            {entries.length > 0 && (
                <View style={styles.chartBlock}>
                    <Text style={styles.filterLabel}>Evolución de casos</Text>
                    <FraudEvolutionChart
                        entries={entries}
                        fromDate={generatedFilters?.fromDate}
                        toDate={generatedFilters?.toDate}
                        granularity={evolutionGranularity}
                        onGranularityChange={setEvolutionGranularity} />
                </View>
            )}
        </>
    );

    const sortOptions = [
        { label: 'Activas', value: 'activeCount' },
        { label: 'Total del período', value: 'fraudCount' },
        { label: 'Reincidencia', value: 'historicalCount' },
        ...(isDniMode ? [] : [{ label: 'Nombre A-Z', value: 'fullName' }]),
    ];

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.filtersContainer}>
                <View style={styles.dateRow}>
                    <View style={styles.dateBlock}>
                        <Text style={styles.filterLabel}>Desde</Text>
                        <TouchableOpacity style={styles.dateButton} onPress={() => setShowFrom(true)}>
                            <Text style={styles.dateButtonText}>{formatDateISO(fromDate)}</Text>
                        </TouchableOpacity>
                        {showFrom && (
                            Platform.OS === 'web' ? (
                                <WebDateInput
                                    value={fromDate}
                                    onChange={setFromDate}
                                    onClose={() => setShowFrom(false)} />
                            ) : (
                                <DateTimePicker value={fromDate} mode="date" display={isIOS ? 'inline' : 'default'}
                                    onChange={(_, d) => { setShowFrom(false); if (d) setFromDate(d); }} />
                            )
                        )}
                    </View>
                    <View style={styles.dateBlock}>
                        <Text style={styles.filterLabel}>Hasta</Text>
                        <TouchableOpacity style={styles.dateButton} onPress={() => setShowTo(true)}>
                            <Text style={styles.dateButtonText}>{formatDateISO(toDate)}</Text>
                        </TouchableOpacity>
                        {showTo && (
                            Platform.OS === 'web' ? (
                                <WebDateInput
                                    value={toDate}
                                    onChange={setToDate}
                                    onClose={() => setShowTo(false)} />
                            ) : (
                                <DateTimePicker value={toDate} mode="date" display={isIOS ? 'inline' : 'default'}
                                    onChange={(_, d) => { setShowTo(false); if (d) setToDate(d); }} />
                            )
                        )}
                    </View>
                </View>

                <Text style={styles.filterLabel}>Agrupar</Text>
                <View style={styles.statusRow}>
                    {GROUP_OPTIONS.map(opt => (
                        <TouchableOpacity
                            key={opt.value}
                            style={[styles.statusBtn, groupBy === opt.value && styles.statusBtnActive]}
                            onPress={() => { setGroupBy(opt.value); if (opt.value === 'DNI' && sortBy === 'fullName') setSortBy('activeCount'); }}>
                            <Text style={[styles.statusBtnText, groupBy === opt.value && styles.statusBtnTextActive]}>
                                {opt.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
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
                    {sortOptions.map(opt => (
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
                    {loading ? <ActivityIndicator color={colors.background} /> : <Text style={styles.generateBtnText}>Generar reporte</Text>}
                </TouchableOpacity>
            </ScrollView>

            {entries.length > 0 && (
                <View style={styles.exportRow}>
                    <TouchableOpacity style={styles.exportBtn} onPress={exportCsv} disabled={exporting}>
                        {exporting ? <ActivityIndicator color={colors.text} /> : <Text style={styles.exportBtnText}>Exportar CSV</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.exportBtn, styles.exportBtnPdf]} onPress={handleExportPdf} disabled={exportingPdf}>
                        {exportingPdf ? <ActivityIndicator color="white" /> : <Text style={[styles.exportBtnText, { color: 'white' }]}>Exportar PDF</Text>}
                    </TouchableOpacity>
                </View>
            )}

            <FlatList
                data={sortedEntries}
                keyExtractor={keyOf}
                renderItem={renderEntry}
                contentContainerStyle={styles.listContent}
                ListHeaderComponent={reportHeader}
                ListEmptyComponent={
                    !loading ? (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No hay registros de fraude en el período seleccionado</Text>
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
        backgroundColor: colors.background,
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
        color: colors.textMuted,
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
        color: colors.text,
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
        backgroundColor: colors.text,
        borderColor: colors.text,
    },
    statusBtnText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 13,
        color: colors.text,
    },
    statusBtnTextActive: {
        color: colors.background,
    },
    generateBtn: {
        backgroundColor: colors.text,
        borderRadius: 24,
        paddingVertical: 12,
        alignItems: 'center',
    },
    generateBtnText: {
        color: colors.background,
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 14,
    },
    exportRow: {
        flexDirection: 'row',
        gap: 10,
        marginHorizontal: 16,
        marginBottom: 8,
    },
    chartBlock: {
        marginBottom: 12,
    },
    staleNotice: {
        marginHorizontal: 0,
        marginBottom: 8,
        padding: 10,
        borderRadius: 8,
        backgroundColor: '#fff4e5',
        borderWidth: 1,
        borderColor: '#f0a500',
    },
    staleNoticeText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 12,
        color: '#8a5a00',
    },
    exportBtn: {
        flex: 1,
        borderWidth: 1,
        borderColor: colors.text,
        borderRadius: 24,
        paddingVertical: 10,
        alignItems: 'center',
    },
    exportBtnPdf: {
        backgroundColor: colors.warning,
        borderColor: colors.warning,
    },
    exportBtnText: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 14,
        color: colors.text,
    },
    listContent: {
        padding: 16,
        paddingTop: 8,
        flexGrow: 1,
    },
    card: {
        backgroundColor: colors.surface,
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
    dniBadge: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: '#1a3333',
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
    },
    dniBadgeText: {
        color: 'white',
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 12,
    },
    userInfo: {
        flex: 1,
        marginRight: 8,
    },
    userName: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 15,
        color: colors.text,
    },
    userEmail: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 13,
        color: colors.textMuted,
    },
    repeatChip: {
        borderRadius: 12,
        paddingVertical: 4,
        paddingHorizontal: 10,
        backgroundColor: '#b45309',
    },
    repeatChipText: {
        color: '#fff',
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 12,
    },
    statsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 4,
    },
    statText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 13,
        color: colors.textMuted,
    },
    statValue: {
        fontFamily: 'PlusJakartaSans-Bold',
        color: colors.text,
    },
    reasonsText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 13,
        color: colors.textMuted,
    },
    historicRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
    },
    historicText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 13,
        color: colors.textMuted,
    },
    expandHint: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 12,
        color: colors.primary || '#19b8b8',
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
        color: colors.text,
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
        color: colors.textMuted,
    },
    incidentReason: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 12,
        color: colors.text,
        flex: 1,
        textAlign: 'center',
    },
    incidentStatus: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 12,
        color: colors.textMuted,
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
        color: colors.textMuted,
        textAlign: 'center',
    },
});

export default FraudReport;
