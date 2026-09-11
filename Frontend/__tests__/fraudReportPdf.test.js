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

// Las barras del gráfico de evolución: rojas las activas, verdes las falsas alarmas.
const countBars = (html, color) => (html.match(new RegExp(`<rect[^>]*fill="${color}"`, 'g')) || []).length;
const ACTIVE = '#ED4337';
const FALSE_ALARM = '#4caf50';

describe('gráfico de evolución en el PDF del reporte de fraude', () => {
    test('el PDF incluye la sección de evolución, que antes sólo existía en pantalla', () => {
        const entries = [person(alert(1, 2026, 9, 8), alert(2, 2026, 9, 9, 'FALSE_POSITIVE'))];
        const html = buildFraudReportHtml(entries, filters, summary);
        expect(html).toContain('Evolución de casos');
    });

    test('dibuja una barra por estado con la cantidad de alertas de cada período', () => {
        const entries = [person(
            alert(1, 2026, 9, 8),
            alert(2, 2026, 9, 9),
            alert(3, 2026, 9, 10, 'FALSE_POSITIVE'),
        )];
        // Por día: el 8 y el 9 tienen una activa cada uno, el 10 una falsa alarma.
        const html = buildFraudReportHtml(entries, filters, summary, 'day');
        expect(countBars(html, ACTIVE)).toBe(2);
        expect(countBars(html, FALSE_ALARM)).toBe(1);
    });

    test('exporta con la agrupación elegida en pantalla', () => {
        const entries = [person(alert(1, 2026, 9, 8), alert(2, 2026, 9, 20))];

        const byDay = buildFraudReportHtml(entries, filters, summary, 'day');
        expect(byDay).toContain('Evolución de casos (por día)');
        expect(countBars(byDay, ACTIVE)).toBe(2); // dos días distintos, dos barras

        const byMonth = buildFraudReportHtml(entries, filters, summary, 'month');
        expect(byMonth).toContain('Evolución de casos (por mes)');
        expect(countBars(byMonth, ACTIVE)).toBe(1); // las dos caen en septiembre
    });

    test('las alertas de fuera del período no entran en el gráfico', () => {
        const entries = [person(alert(1, 2026, 8, 15), alert(2, 2026, 9, 8))];
        const html = buildFraudReportHtml(entries, filters, summary, 'day');
        expect(countBars(html, ACTIVE)).toBe(1);
    });

    test('sin alertas en el período avisa en lugar de dibujar barras', () => {
        const entries = [person(alert(1, 2026, 8, 15))];
        const html = buildFraudReportHtml(entries, filters, summary, 'day');
        expect(html).toContain('No hay datos para el período seleccionado');
        expect(countBars(html, ACTIVE)).toBe(0);
    });

    test('por omisión agrupa por mes, como la pantalla al abrirse', () => {
        const entries = [person(alert(1, 2026, 9, 8))];
        expect(buildFraudReportHtml(entries, filters, summary)).toContain('Evolución de casos (por mes)');
    });
});
