// EU-395: el PDF del reporte de fraude tiene que traer el mismo gráfico de evolución que la
// pantalla, con la agrupación que el administrador tenga elegida al exportar.

// pdfExport toca react-native para compartir el archivo. Nada de eso se ejercita al armar el HTML.
jest.mock('react-native', () => ({ Platform: { OS: 'web' }, Alert: { alert: jest.fn() } }), { virtual: true });

import { buildFraudReportHtml } from '../utils/pdfExport';

const alert = (id, y, m, d, status = 'ACTIVE') => ({
    id,
    status,
    reason: 'CASE_1',
    createdAt: new Date(y, m - 1, d, 12, 0, 0).toISOString(),
});

const person = (...incidents) => ({
    dni: '35283779',
    fullName: 'Ana Pérez',
    email: 'ana@test.com',
    fraudCount: incidents.length,
    activeCount: incidents.length,
    falsePositiveCount: 0,
    historicalCount: incidents.length,
    reasons: ['CASE_1'],
    incidents,
});

const filters = { fromDate: '2026-09-01', toDate: '2026-09-30', statusFilter: '', groupBy: 'DNI' };
const summary = { totalAlerts: 3, activeCount: 2, falsePositiveCount: 1 };
// El gráfico sale de las alertas del período que manda el backend (EU-227), no de las filas.
const summaryOf = (entries) => ({ ...summary, periodAlerts: entries.flatMap(e => e.incidents) });

// Las barras del gráfico de evolución: rojas las activas, verdes las falsas alarmas.
const countBars = (html, color) => (html.match(new RegExp(`<rect[^>]*fill="${color}"`, 'g')) || []).length;
const ACTIVE = '#ED4337';
const FALSE_ALARM = '#4caf50';

describe('gráfico de evolución en el PDF del reporte de fraude', () => {
    test('el PDF incluye la sección de evolución, que antes sólo existía en pantalla', () => {
        const entries = [person(alert(1, 2026, 9, 8), alert(2, 2026, 9, 9, 'FALSE_POSITIVE'))];
        const html = buildFraudReportHtml(entries, filters, summaryOf(entries));
        expect(html).toContain('Evolución de casos');
    });

    test('dibuja una barra por estado con la cantidad de alertas de cada período', () => {
        const entries = [person(
            alert(1, 2026, 9, 8),
            alert(2, 2026, 9, 9),
            alert(3, 2026, 9, 10, 'FALSE_POSITIVE'),
        )];
        // Por día: el 8 y el 9 tienen una activa cada uno, el 10 una falsa alarma.
        const html = buildFraudReportHtml(entries, filters, summaryOf(entries), 'day');
        expect(countBars(html, ACTIVE)).toBe(2);
        expect(countBars(html, FALSE_ALARM)).toBe(1);
    });

    test('exporta con la agrupación elegida en pantalla', () => {
        const entries = [person(alert(1, 2026, 9, 8), alert(2, 2026, 9, 20))];

        const byDay = buildFraudReportHtml(entries, filters, summaryOf(entries), 'day');
        expect(byDay).toContain('Evolución de casos (por día)');
        expect(countBars(byDay, ACTIVE)).toBe(2); // dos días distintos, dos barras

        const byMonth = buildFraudReportHtml(entries, filters, summaryOf(entries), 'month');
        expect(byMonth).toContain('Evolución de casos (por mes)');
        expect(countBars(byMonth, ACTIVE)).toBe(1); // las dos caen en septiembre
    });

    test('las alertas de fuera del período no entran en el gráfico', () => {
        const entries = [person(alert(1, 2026, 8, 15), alert(2, 2026, 9, 8))];
        const html = buildFraudReportHtml(entries, filters, summaryOf(entries), 'day');
        expect(countBars(html, ACTIVE)).toBe(1);
    });

    test('sin alertas en el período avisa en lugar de dibujar barras', () => {
        const entries = [person(alert(1, 2026, 8, 15))];
        const html = buildFraudReportHtml(entries, filters, summaryOf(entries), 'day');
        expect(html).toContain('No hay datos para el período seleccionado');
        expect(countBars(html, ACTIVE)).toBe(0);
    });

    test('por omisión agrupa por mes, como la pantalla al abrirse', () => {
        const entries = [person(alert(1, 2026, 9, 8))];
        expect(buildFraudReportHtml(entries, filters, summaryOf(entries))).toContain('Evolución de casos (por mes)');
    });

    // EU-227: antes el gráfico sumaba el historial de cada fila.
    test('una alerta que señala a dos personas cuenta una sola vez', () => {
        const compartida = alert(1, 2026, 9, 8);
        const entries = [person(compartida), { ...person(compartida), dni: '11111111' }];
        const html = buildFraudReportHtml(entries, filters,
            { ...summary, periodAlerts: [compartida] }, 'day');
        expect(html).toContain('text-anchor="middle">1</text>');
        expect(html).not.toContain('text-anchor="middle">2</text>');
    });

    test('agrupando por usuario dibuja las alertas que no señalan a nadie', () => {
        const html = buildFraudReportHtml([], { ...filters, groupBy: 'USER' },
            { ...summary, periodAlerts: [alert(1, 2026, 9, 8, 'FALSE_POSITIVE')] }, 'day');
        expect(countBars(html, FALSE_ALARM)).toBe(1);
    });
});

// EU-225: agrupando por usuario, un período cuyas alertas no señalan a nadie deja la lista vacía,
// pero la torta de activas vs. falsas alarmas sale del resumen y las tiene que contar igual.
describe('torta de activas vs. falsas alarmas en el PDF', () => {
    test('cuenta las alertas del período aunque ninguna señale a una persona', () => {
        const html = buildFraudReportHtml([], { ...filters, groupBy: 'USER' },
            { totalAlerts: 1, activeCount: 0, falsePositiveCount: 1 });
        expect(html).toContain('Falsas alarmas: <b>1</b> (100%)');
        expect(html).toContain('Activas: <b>0</b> (0%)');
    });

    test('muestra cantidad y porcentaje de cada categoría', () => {
        const html = buildFraudReportHtml([], filters,
            { totalAlerts: 7, activeCount: 4, falsePositiveCount: 3 });
        expect(html).toContain('Activas: <b>4</b> (57%)');
        expect(html).toContain('Falsas alarmas: <b>3</b> (43%)');
    });
});
