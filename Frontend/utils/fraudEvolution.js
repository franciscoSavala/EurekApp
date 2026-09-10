// Armado de la serie del gráfico "Evolución de casos" del Reporte de detecciones de fraude.
// Vive aparte de la pantalla para poder probarse sin montar el componente.

const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function getISOWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

export function getPeriodKey(date, granularity) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    if (granularity === 'day') return `${year}-${month}-${day}`;
    if (granularity === 'week') {
        const week = String(getISOWeek(date)).padStart(2, '0');
        return `${year}-S${week}`;
    }
    return `${year}-${month}`;
}

export function getPeriodLabel(key, granularity) {
    if (granularity === 'day') {
        const [, month, day] = key.split('-');
        return `${day}/${month}`;
    }
    if (granularity === 'week') {
        const [year, weekPart] = key.split('-S');
        return `S${weekPart}/${String(year).slice(2)}`;
    }
    // month
    const [year, month] = key.split('-');
    return `${MONTH_SHORT[parseInt(month, 10) - 1]}/${String(year).slice(2)}`;
}

// 'YYYY-MM-DD' → Date en horario local. new Date('YYYY-MM-DD') lo interpretaría en UTC y, con el
// huso de Argentina, caería el día anterior.
function parseLocalDate(value) {
    if (!value) return null;
    const [year, month, day] = String(value).split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
}

// EU-391: el campo `incidents` de cada fila trae el historial COMPLETO de la persona, porque de ahí
// salen la marca de "Reincidente" y el histórico acumulado. El gráfico, en cambio, tiene que
// mostrar sólo lo que cae dentro del rango consultado.
export function filterIncidentsInRange(entries, fromDate, toDate) {
    const all = (entries || []).flatMap(e => e.incidents || []);
    return all.filter(inc => {
        if (!inc.createdAt) return false;
        const dayKey = getPeriodKey(new Date(inc.createdAt), 'day');
        if (fromDate && dayKey < fromDate) return false;
        if (toDate && dayKey > toDate) return false;
        return true;
    });
}

// EU-355: el eje tiene que recorrer todos los períodos del rango, incluidos los que no tuvieron
// casos, que van en cero. Si se omiten, dos barras contiguas pueden estar meses separadas y
// aparentar un crecimiento sostenido donde en realidad no hubo actividad.
function buildEmptySeries(granularity, fromDate, toDate) {
    const start = parseLocalDate(fromDate);
    const end = parseLocalDate(toDate);
    if (!start || !end || start > end) return {};

    const map = {};
    const cursor = new Date(start);
    while (cursor <= end) {
        const key = getPeriodKey(cursor, granularity);
        if (!map[key]) map[key] = { key, label: getPeriodLabel(key, granularity), active: 0, falseAlarm: 0 };
        cursor.setDate(cursor.getDate() + 1);
    }
    return map;
}

export function buildEvolutionGroups(entries, granularity, fromDate, toDate) {
    const map = buildEmptySeries(granularity, fromDate, toDate);

    for (const inc of filterIncidentsInRange(entries, fromDate, toDate)) {
        // Las barras apilan los dos estados del modelo (EU-288); cualquier otro no tiene lugar.
        if (inc.status !== 'ACTIVE' && inc.status !== 'FALSE_POSITIVE') continue;
        const key = getPeriodKey(new Date(inc.createdAt), granularity);
        if (!map[key]) map[key] = { key, label: getPeriodLabel(key, granularity), active: 0, falseAlarm: 0 };
        if (inc.status === 'ACTIVE') map[key].active++;
        else map[key].falseAlarm++;
    }

    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
}
