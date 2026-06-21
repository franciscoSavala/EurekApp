import { Platform, Alert } from 'react-native';
import { STATUS_LABELS, humanizeReason } from './fraudLabels';

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

// SVG line chart from time series points [{label, avg_recovery_hours}]
function makeLineChart(points, color = '#7c4dff') {
    const pts = (points || []).filter(p => p.avg_recovery_hours > 0);
    if (!pts || pts.length < 2) return '<p style="color:#888">Sin datos suficientes</p>';
    const W = 480, H = 140, padL = 48, padB = 24, padR = 16, padT = 10;
    const vals = pts.map(p => p.avg_recovery_hours);
    const maxVal = Math.max(...vals, 1);
    const xs = pts.map((_, i) => padL + (i / (pts.length - 1)) * (W - padL - padR));
    const ys = vals.map(v => padT + (1 - v / maxVal) * (H - padT - padB));
    const polyline = xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
    const dots = xs.map((x, i) => `<circle cx="${x.toFixed(1)}" cy="${ys[i].toFixed(1)}" r="4" fill="${color}"/>`).join('');
    const step = Math.ceil(pts.length / 6);
    const xlabels = pts
        .filter((_, i) => i % step === 0 || i === pts.length - 1)
        .map((p, _, arr) => {
            const idx = pts.indexOf(p);
            return `<text x="${xs[idx].toFixed(1)}" y="${H}" text-anchor="middle" font-size="9" fill="#638888">${p.label}</text>`;
        }).join('');
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="sans-serif">
        <polyline points="${polyline}" fill="none" stroke="${color}" stroke-width="2"/>
        ${dots}${xlabels}
    </svg>`;
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

function formatHoursHtml(h) {
    if (h == null) return '—';
    if (h >= 24) return `${(h / 24).toFixed(1)} días`;
    return `${h.toFixed(1)} hs`;
}

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

    const lineChart = data && data.time_series ? makeLineChart(data.time_series) : '';

    const trendRows = data && data.time_series ? data.time_series.map(p =>
        `<tr><td>${p.label}</td><td>${p.found_objects}</td><td>${p.lost_objects}</td><td>${p.returned_objects}</td><td>${p.avg_recovery_hours > 0 ? formatHoursHtml(p.avg_recovery_hours) : '—'}</td></tr>`
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
    ${data.avg_recovery_hours != null ? `<tr><td>Tiempo prom. de recuperación</td><td><b>${formatHoursHtml(data.avg_recovery_hours)}</b> &nbsp;(mín: ${formatHoursHtml(data.min_recovery_hours)}, máx: ${formatHoursHtml(data.max_recovery_hours)})</td></tr>` : ''}
</table>

<h2>Gráfico: Recuperación de objetos</h2>
${pieRecovery}

${topCategoriesChart ? `<h2>Objetos más reportados</h2>${topCategoriesChart}` : ''}

${data.time_series && data.time_series.length > 0 ? `
<h2>Tendencias de uso</h2>
<table>
    <tr><th>Período</th><th>Encontrados</th><th>Perdidos</th><th>Devueltos</th><th>T. Recup.</th></tr>
    ${trendRows}
</table>` : ''}

${lineChart ? `<h2>Evolución del tiempo de recuperación</h2>${lineChart}` : ''}
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
    const { fromDate, toDate, statusFilter, groupBy } = filters;
    const generatedAt = new Date().toLocaleString('es-AR');
    const statusLabel = { '': 'Todos', ACTIVE: 'Activa', FALSE_POSITIVE: 'Falsa alarma' }[statusFilter] || statusFilter || 'Todos';
    const isDni = groupBy === 'DNI';
    const groupLabel = isDni ? 'DNI' : 'Usuario';

    // Los conteos son del período consultado (EU-288); el histórico va aparte como reincidencia.
    const totalAlerts = entries.reduce((s, e) => s + (e.fraudCount || 0), 0);
    const totalActive = entries.reduce((s, e) => s + (e.activeCount || 0), 0);
    const totalFalse = entries.reduce((s, e) => s + (e.falsePositiveCount || 0), 0);

    const pieFraud = makePieChart([
        { label: 'Activas', value: totalActive, color: '#ED4337' },
        { label: 'Falsas alarmas', value: totalFalse, color: '#4caf50' },
    ]);

    const topRows = [...entries]
        .sort((a, b) => b.fraudCount - a.fraudCount)
        .slice(0, 8)
        .map(e => ({ label: isDni ? e.dni : (e.email || e.fullName), value: e.fraudCount, color: '#b45309' }));
    const barTop = makeBarChart(topRows, undefined);

    const summaryRows = entries.map(e => {
        const reasons = (e.reasons || []).map(humanizeReason).filter(Boolean).join(', ');
        if (isDni) {
            return `<tr>
                <td>${e.dni || '-'}</td>
                <td>${e.fraudCount}</td>
                <td>${e.activeCount}</td>
                <td>${e.falsePositiveCount}</td>
                <td>${e.historicalCount}</td>
                <td style="font-size:11px">${reasons}</td>
            </tr>`;
        }
        return `<tr>
            <td>${e.fullName || '-'}</td>
            <td>${e.email || '-'}</td>
            <td>${e.fraudCount}</td>
            <td>${e.activeCount}</td>
            <td>${e.falsePositiveCount}</td>
            <td>${e.historicalCount}</td>
            <td style="font-size:11px">${reasons}</td>
        </tr>`;
    }).join('');

    const summaryHead = isDni
        ? '<tr><th>DNI</th><th>En período</th><th>Activas</th><th>Falsas alarmas</th><th>Histórico</th><th>Motivos</th></tr>'
        : '<tr><th>Nombre</th><th>Email</th><th>En período</th><th>Activas</th><th>Falsas alarmas</th><th>Histórico</th><th>Motivos</th></tr>';
    const summaryCols = isDni ? 6 : 7;

    const incidentBlocks = entries.map(e => {
        const header = isDni ? `DNI ${e.dni}` : `${e.fullName} (${e.email})`;
        const rows = (e.incidents || []).map(inc => `<tr>
            <td>${inc.id}</td>
            <td>${humanizeReason(inc.reason)}</td>
            <td>${STATUS_LABELS[inc.status] || inc.status}</td>
            <td>${inc.createdAt ? new Date(inc.createdAt).toLocaleString('es-AR') : '-'}</td>
        </tr>`).join('');
        return `<h3>${header}</h3>
        <table>
            <tr><th>ID alerta</th><th>Motivo</th><th>Estado</th><th>Fecha</th></tr>
            ${rows || '<tr><td colspan="4" style="color:#888">Sin incidentes</td></tr>'}
        </table>`;
    }).join('');

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Reporte de Fraude</title><style>${baseStyle}</style></head>
<body>
<h1>Reporte de fraude</h1>
<div class="meta">
    Generado: ${generatedAt}<br>
    Período: ${fromDate} — ${toDate} &nbsp;|&nbsp; Estado: ${statusLabel} &nbsp;|&nbsp; Agrupado por: ${groupLabel}
</div>

<h2>Métricas del período</h2>
<table>
    <tr><th>Indicador</th><th>Valor</th></tr>
    <tr><td>${isDni ? 'DNIs' : 'Usuarios'} con alertas</td><td><b>${entries.length}</b></td></tr>
    <tr><td>Alertas en el período</td><td><b>${totalAlerts}</b></td></tr>
    <tr><td>Activas</td><td><b>${totalActive}</b></td></tr>
    <tr><td>Falsas alarmas</td><td><b>${totalFalse}</b></td></tr>
</table>

<h2>Gráfico: Activas vs. falsas alarmas</h2>
${pieFraud}

<h2>Gráfico: ${isDni ? 'DNIs' : 'Usuarios'} con más alertas</h2>
${barTop}

<h2>Resumen por ${groupLabel.toLowerCase()}</h2>
<table>
    ${summaryHead}
    ${summaryRows || `<tr><td colspan="${summaryCols}" style="text-align:center;color:#888">Sin datos</td></tr>`}
</table>

<h2>Detalle de incidentes</h2>
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
