import { Platform, Alert } from 'react-native';

const REASON_LABELS = {
    MULTIPLE_CLAIMERS_SAME_OBJECT: 'Múltiples reclamantes del mismo objeto',
    HIGH_CLAIM_FREQUENCY: 'Alta frecuencia de reclamos',
    FINDER_CLAIMER_COLLUSION: 'Posible acuerdo entre registrador y reclamante',
    REPEATED_REJECTIONS: 'Reclamos rechazados repetidos',
};

const STATUS_LABELS = {
    PENDING: 'Pendiente',
    CONFIRMED_FRAUD: 'Fraude confirmado',
    FALSE_POSITIVE: 'Falso positivo',
};

// SVG pie chart from segments [{label, value, color}]
function makePieChart(segments) {
    const total = segments.reduce((s, seg) => s + (seg.value || 0), 0);
    if (total === 0) return '<p style="color:#888">Sin datos para graficar</p>';

    const cx = 100, cy = 100, r = 80;
    let angle = -Math.PI / 2;
    let paths = '';
    let legend = '';

    for (const seg of segments) {
        const frac = seg.value / total;
        const sweep = frac * 2 * Math.PI;
        const x1 = cx + r * Math.cos(angle);
        const y1 = cy + r * Math.sin(angle);
        const x2 = cx + r * Math.cos(angle + sweep);
        const y2 = cy + r * Math.sin(angle + sweep);
        const largeArc = sweep > Math.PI ? 1 : 0;
        paths += `<path d="M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${largeArc},1 ${x2.toFixed(2)},${y2.toFixed(2)} Z" fill="${seg.color}" stroke="white" stroke-width="1.5"/>`;
        legend += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px"><span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${seg.color}"></span><span style="font-size:13px">${seg.label}: <b>${seg.value}</b> (${Math.round(frac * 100)}%)</span></div>`;
        angle += sweep;
    }

    return `<div style="display:flex;align-items:center;gap:24px;flex-wrap:wrap">
        <svg width="200" height="200" viewBox="0 0 200 200">${paths}</svg>
        <div>${legend}</div>
    </div>`;
}

// SVG horizontal bar chart from rows [{label, value, color}]
function makeBarChart(rows, maxVal) {
    if (!rows || rows.length === 0) return '<p style="color:#888">Sin datos</p>';
    const max = maxVal || Math.max(1, ...rows.map(r => r.value));
    const barWidth = 300;
    const rowHeight = 28;
    const height = rows.length * rowHeight + 10;
    let bars = '';
    rows.forEach((row, i) => {
        const y = i * rowHeight + 5;
        const w = Math.round((row.value / max) * barWidth);
        bars += `<g>
            <text x="0" y="${y + 16}" font-size="12" fill="#333" font-family="sans-serif">${row.label}</text>
            <rect x="130" y="${y + 4}" width="${w}" height="16" rx="4" fill="${row.color || '#19b8b8'}"/>
            <text x="${130 + w + 5}" y="${y + 16}" font-size="12" fill="#333" font-family="sans-serif">${row.value}</text>
        </g>`;
    });
    return `<svg width="480" height="${height}" viewBox="0 0 480 ${height}" font-family="sans-serif">${bars}</svg>`;
}

const baseStyle = `
    body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 24px; font-size: 14px; }
    h1 { font-size: 22px; color: #111818; margin-bottom: 4px; }
    h2 { font-size: 16px; color: #19b8b8; margin-top: 28px; margin-bottom: 8px; border-bottom: 2px solid #e0f0f0; padding-bottom: 4px; }
    h3 { font-size: 14px; color: #111818; margin-top: 16px; margin-bottom: 6px; }
    .meta { font-size: 12px; color: #638888; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #f0f4f4; text-align: left; padding: 7px 10px; font-size: 12px; color: #111818; }
    td { padding: 6px 10px; font-size: 12px; border-bottom: 1px solid #e0e8e8; }
    .chip { display:inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: bold; color: white; }
    @media print { body { margin: 12px; } }
`;

export function buildUsageReportHtml(data, feedbackData, records, filters) {
    const { fromDate, toDate, groupBy, wasFoundFilter } = filters;
    const generatedAt = new Date().toLocaleString('es-AR');
    const groupByLabel = { DAY: 'Día', WEEK: 'Semana', MONTH: 'Mes' }[groupBy] || groupBy;
    const wasFoundLabel = wasFoundFilter === true ? 'Solo encontrados' : wasFoundFilter === false ? 'Solo no encontrados' : 'Todos';

    const recoveryRate = data && data.found_objects > 0
        ? ((data.returned_objects / data.found_objects) * 100).toFixed(1)
        : '0.0';

    const pieRecovery = data ? makePieChart([
        { label: 'Devueltos', value: data.returned_objects || 0, color: '#4caf50' },
        { label: 'No devueltos', value: (data.found_objects || 0) - (data.returned_objects || 0), color: '#f0a500' },
    ]) : '';

    const pieSearches = feedbackData ? makePieChart([
        { label: 'Exitosas', value: feedbackData.successful_searches || 0, color: '#4caf50' },
        { label: 'Fallidas', value: feedbackData.unsuccessful_searches || 0, color: '#e53935' },
    ]) : '';

    const starBars = feedbackData && feedbackData.star_distribution
        ? makeBarChart([5, 4, 3, 2, 1].map(s => ({
            label: '★'.repeat(s),
            value: feedbackData.star_distribution[s] || 0,
            color: '#f0a500',
        })), undefined)
        : '';

    const topCategoriesChart = data && data.top_categories && data.top_categories.length > 0
        ? makeBarChart(
            data.top_categories.map(c => ({ label: c.category, value: c.count, color: '#19b8b8' })),
            undefined
          )
        : '';

    const trendRows = data && data.time_series ? data.time_series.map(p =>
        `<tr><td>${p.label}</td><td>${p.found_objects}</td><td>${p.lost_objects}</td><td>${p.returned_objects}</td></tr>`
    ).join('') : '';

    const fbTrendRows = feedbackData && feedbackData.time_series ? feedbackData.time_series.map(p =>
        `<tr><td>${p.label}</td><td>${(p.avg_rating || 0).toFixed(1)} ★</td><td>${p.successful}</td><td>${p.unsuccessful}</td></tr>`
    ).join('') : '';

    const recordRows = records && records.length > 0 ? records.map(r =>
        `<tr>
            <td>${r.id}</td>
            <td>${r.organizationId || '-'}</td>
            <td style="font-size:11px;color:#638888">${r.foundObjectUUID || '-'}</td>
            <td>${'★'.repeat(r.starRating || 0)}</td>
            <td>${r.wasFound ? 'Sí' : 'No'}</td>
            <td>${r.createdAt ? new Date(r.createdAt).toLocaleString('es-AR') : '-'}</td>
            <td>${(r.comment || '').replace(/</g, '&lt;')}</td>
        </tr>`
    ).join('') : '<tr><td colspan="7" style="text-align:center;color:#888">Sin registros en el período</td></tr>';

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Reporte de Uso</title><style>${baseStyle}</style></head>
<body>
<h1>Reporte de uso del sistema</h1>
<div class="meta">
    Generado: ${generatedAt}<br>
    Período: ${fromDate} — ${toDate} &nbsp;|&nbsp; Agrupado por: ${groupByLabel} &nbsp;|&nbsp; Filtro: ${wasFoundLabel}
</div>

${data ? `
<h2>Métricas generales</h2>
<table>
    <tr><th>Indicador</th><th>Valor</th></tr>
    <tr><td>Objetos encontrados</td><td><b>${data.found_objects}</b></td></tr>
    <tr><td>Búsquedas realizadas (perdidos)</td><td><b>${data.lost_objects}</b></td></tr>
    <tr><td>Objetos devueltos</td><td><b>${data.returned_objects}</b></td></tr>
    <tr><td>Usuarios activos</td><td><b>${data.active_users}</b></td></tr>
    <tr><td>Tasa de recuperación</td><td><b>${recoveryRate}%</b></td></tr>
</table>

<h2>Gráfico: Recuperación de objetos</h2>
${pieRecovery}

${topCategoriesChart ? `<h2>Objetos más reportados</h2>${topCategoriesChart}` : ''}

${data.time_series && data.time_series.length > 0 ? `
<h2>Tendencias de uso</h2>
<table>
    <tr><th>Período</th><th>Encontrados</th><th>Perdidos</th><th>Devueltos</th></tr>
    ${trendRows}
</table>` : ''}
` : ''}

${feedbackData ? `
<h2>Métricas de feedback</h2>
<table>
    <tr><th>Indicador</th><th>Valor</th></tr>
    <tr><td>Calificación promedio</td><td><b>${(feedbackData.average_rating || 0).toFixed(1)} ★</b></td></tr>
    <tr><td>Total de feedbacks</td><td><b>${feedbackData.total_feedback}</b></td></tr>
    <tr><td>Búsquedas exitosas</td><td><b>${feedbackData.successful_searches}</b></td></tr>
    <tr><td>Búsquedas fallidas</td><td><b>${feedbackData.unsuccessful_searches}</b></td></tr>
</table>

<h2>Gráfico: Resultado de búsquedas</h2>
${pieSearches}

<h2>Distribución de calificaciones</h2>
${starBars}

${feedbackData.time_series && feedbackData.time_series.length > 0 ? `
<h2>Tendencias de feedback</h2>
<table>
    <tr><th>Período</th><th>Calif. promedio</th><th>Exitosas</th><th>Fallidas</th></tr>
    ${fbTrendRows}
</table>` : ''}
` : ''}

<h2>Registros individuales de feedback</h2>
<table>
    <tr><th>ID</th><th>Organización</th><th>Objeto (UUID)</th><th>Puntaje</th><th>Encontrado</th><th>Fecha</th><th>Comentario</th></tr>
    ${recordRows}
</table>
</body></html>`;
}

export function buildFraudReportHtml(entries, filters) {
    const { fromDate, toDate, statusFilter } = filters;
    const generatedAt = new Date().toLocaleString('es-AR');
    const statusLabel = { '': 'Todos', PENDING: 'Pendiente', CONFIRMED_FRAUD: 'Fraude confirmado', FALSE_POSITIVE: 'Falso positivo' }[statusFilter] || statusFilter || 'Todos';

    const totalAlerts = entries.reduce((s, e) => s + (e.fraudCount || 0), 0);
    const totalConfirmed = entries.reduce((s, e) => s + (e.confirmedFraudCount || 0), 0);
    const totalFp = entries.reduce((s, e) => s + (e.incidents ? e.incidents.filter(i => i.status === 'FALSE_POSITIVE').length : 0), 0);

    const pieFraud = makePieChart([
        { label: 'Fraude confirmado', value: totalConfirmed, color: '#ED4337' },
        { label: 'Falso positivo', value: totalFp, color: '#4caf50' },
        { label: 'Pendiente', value: totalAlerts - totalConfirmed - totalFp, color: '#f59e0b' },
    ]);

    const topUsers = [...entries]
        .sort((a, b) => b.fraudCount - a.fraudCount)
        .slice(0, 8)
        .map(e => ({ label: e.email || e.fullName, value: e.fraudCount, color: '#b45309' }));
    const barUsers = makeBarChart(topUsers, undefined);

    const ACTION_COLORS = {
        'Advertencia': '#f59e0b',
        'Suspensión temporal': '#b45309',
        'Bloqueo': '#ED4337',
        'Sin acción sugerida': '#aaa',
    };

    const summaryRows = entries.map(e => {
        const color = ACTION_COLORS[e.suggestedAction] || '#aaa';
        return `<tr>
            <td>${e.fullName || '-'}</td>
            <td>${e.email || '-'}</td>
            <td>${e.fraudCount}</td>
            <td>${e.confirmedFraudCount}</td>
            <td><span class="chip" style="background:${color}">${e.suggestedAction}</span></td>
            <td style="font-size:11px">${(e.reasons || []).map(r => REASON_LABELS[r] || r).join(', ')}</td>
        </tr>`;
    }).join('');

    const incidentBlocks = entries.map(e => {
        const rows = (e.incidents || []).map(inc => `<tr>
            <td>${inc.id}</td>
            <td>${REASON_LABELS[inc.reason] || inc.reason}</td>
            <td>${STATUS_LABELS[inc.status] || inc.status}</td>
            <td>${inc.createdAt ? new Date(inc.createdAt).toLocaleString('es-AR') : '-'}</td>
            <td style="font-size:11px;color:#638888">${inc.foundObjectUUID || '-'}</td>
        </tr>`).join('');
        return `<h3>${e.fullName} (${e.email})</h3>
        <table>
            <tr><th>ID alerta</th><th>Motivo</th><th>Estado</th><th>Fecha</th><th>Objeto (UUID)</th></tr>
            ${rows || '<tr><td colspan="5" style="color:#888">Sin incidentes</td></tr>'}
        </table>`;
    }).join('');

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Reporte de Fraude</title><style>${baseStyle}</style></head>
<body>
<h1>Reporte de usuarios con fraudes detectados</h1>
<div class="meta">
    Generado: ${generatedAt}<br>
    Período: ${fromDate} — ${toDate} &nbsp;|&nbsp; Estado: ${statusLabel}
</div>

<h2>Métricas</h2>
<table>
    <tr><th>Indicador</th><th>Valor</th></tr>
    <tr><td>Usuarios con alertas</td><td><b>${entries.length}</b></td></tr>
    <tr><td>Total de alertas</td><td><b>${totalAlerts}</b></td></tr>
    <tr><td>Fraudes confirmados</td><td><b>${totalConfirmed}</b></td></tr>
    <tr><td>Falsos positivos</td><td><b>${totalFp}</b></td></tr>
</table>

<h2>Gráfico: Distribución de alertas por estado</h2>
${pieFraud}

<h2>Gráfico: Usuarios con más alertas</h2>
${barUsers}

<h2>Resumen por usuario</h2>
<table>
    <tr><th>Nombre</th><th>Email</th><th>Total alertas</th><th>Confirmadas</th><th>Acción sugerida</th><th>Motivos</th></tr>
    ${summaryRows || '<tr><td colspan="6" style="text-align:center;color:#888">Sin datos</td></tr>'}
</table>

<h2>Detalle de incidentes por usuario</h2>
${incidentBlocks || '<p style="color:#888">Sin incidentes en el período seleccionado</p>'}
</body></html>`;
}

const ASPECT_LABELS_PDF = {
    FACILIDAD_USO: 'Facilidad de uso',
    CLARIDAD: 'Claridad de interfaz',
    TIEMPO_RESPUESTA: 'Tiempo de respuesta',
    NAVEGACION: 'Navegación',
};
const ASPECT_ORDER_PDF = ['FACILIDAD_USO', 'CLARIDAD', 'TIEMPO_RESPUESTA', 'NAVEGACION'];

export function buildUsabilityFeedbackReportHtml(reportData, records, filters) {
    const { fromDate, toDate, groupBy } = filters;
    const generatedAt = new Date().toLocaleString('es-AR');
    const groupByLabel = { DAY: 'Día', WEEK: 'Semana', MONTH: 'Mes' }[groupBy] || groupBy;

    const starBars = reportData && reportData.star_distribution
        ? makeBarChart([5, 4, 3, 2, 1].map(s => ({
            label: '★'.repeat(s),
            value: reportData.star_distribution[s] || 0,
            color: '#f0a500',
        })), undefined)
        : '';

    const aspectBars = reportData && reportData.aspect_distribution
        ? makeBarChart(ASPECT_ORDER_PDF.map(k => ({
            label: ASPECT_LABELS_PDF[k] || k,
            value: reportData.aspect_distribution[k] || 0,
            color: '#19b8b8',
        })), undefined)
        : '';

    const trendRows = reportData && reportData.time_series ? reportData.time_series.map(p =>
        `<tr><td>${p.label}</td><td>${(p.avg_rating || 0).toFixed(1)} ★</td><td>${p.total}</td></tr>`
    ).join('') : '';

    const commentsWithText = (records || []).filter(r => r.comment && r.comment.trim().length > 0);
    const commentRows = commentsWithText.length > 0 ? commentsWithText.map(r =>
        `<tr>
            <td>${'★'.repeat(r.star_rating || 0)}</td>
            <td style="font-size:11px">${(r.aspects || []).map(a => ASPECT_LABELS_PDF[a] || a).join(', ') || '—'}</td>
            <td>${r.context || '—'}</td>
            <td>${(r.comment || '').replace(/</g, '&lt;')}</td>
            <td>${r.created_at ? new Date(r.created_at).toLocaleDateString('es-AR') : '—'}</td>
        </tr>`
    ).join('') : '<tr><td colspan="5" style="text-align:center;color:#888">Sin comentarios en el período</td></tr>';

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Reporte de Usabilidad</title><style>${baseStyle}</style></head>
<body>
<h1>Reporte de feedback de usabilidad</h1>
<div class="meta">
    Generado: ${generatedAt}<br>
    Período: ${fromDate} — ${toDate} &nbsp;|&nbsp; Agrupado por: ${groupByLabel}
</div>

${reportData ? `
<h2>Métricas generales</h2>
<table>
    <tr><th>Indicador</th><th>Valor</th></tr>
    <tr><td>Calificación promedio</td><td><b>${(reportData.average_rating || 0).toFixed(1)} ★</b></td></tr>
    <tr><td>Total de feedbacks</td><td><b>${reportData.total_feedback}</b></td></tr>
</table>

<h2>Distribución de calificaciones</h2>
${starBars}

<h2>Aspectos más seleccionados</h2>
${aspectBars}

${reportData.time_series && reportData.time_series.length > 0 ? `
<h2>Evolución temporal</h2>
<table>
    <tr><th>Período</th><th>Calif. promedio</th><th>Total</th></tr>
    ${trendRows}
</table>` : ''}
` : ''}

<h2>Comentarios de usuarios</h2>
<table>
    <tr><th>Puntaje</th><th>Aspectos</th><th>Contexto</th><th>Comentario</th><th>Fecha</th></tr>
    ${commentRows}
</table>
</body></html>`;
}

export async function exportPdf(htmlContent, filename) {
    if (Platform.OS === 'web') {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);
        iframe.contentDocument.open();
        iframe.contentDocument.write(htmlContent);
        iframe.contentDocument.close();
        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            setTimeout(() => document.body.removeChild(iframe), 2000);
        }, 500);
    } else {
        const Print = require('expo-print');
        const Sharing = require('expo-sharing');
        const { uri } = await Print.printToFileAsync({ html: htmlContent });
        const dest = uri.replace(/[^/]*$/, filename);
        const FileSystem = require('expo-file-system');
        await FileSystem.moveAsync({ from: uri, to: dest });
        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(dest, { mimeType: 'application/pdf', dialogTitle: filename });
        }
    }
}
