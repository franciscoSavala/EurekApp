import {
    filterIncidentsInRange,
    buildEvolutionGroups,
} from '../utils/fraudEvolution';

// Una alerta tal como llega en el campo `incidents` de cada fila del reporte. La fecha se construye
// con valores locales: el gráfico agrupa por día local, no por UTC.
const alert = (id, y, m, d, status = 'ACTIVE') => ({
    id,
    status,
    createdAt: new Date(y, m - 1, d, 12, 0, 0).toISOString(),
});

// Una persona del reporte con su historial completo de alertas.
const person = (...incidents) => ({ incidents });

// ─── filterIncidentsInRange (EU-391) ──────────────────────────────────────────

describe('filterIncidentsInRange', () => {
    test('deja fuera las alertas anteriores y posteriores al rango', () => {
        const entries = [person(
            alert(1, 2026, 8, 26),
            alert(2, 2026, 9, 8),
            alert(3, 2026, 9, 20),
        )];
        const ids = filterIncidentsInRange(entries, '2026-09-01', '2026-09-09').map(i => i.id);
        expect(ids).toEqual([2]);
    });

    test('incluye las alertas de los días extremos del rango', () => {
        const entries = [person(alert(1, 2026, 9, 8), alert(2, 2026, 9, 9))];
        const ids = filterIncidentsInRange(entries, '2026-09-08', '2026-09-09').map(i => i.id);
        expect(ids).toEqual([1, 2]);
    });

    test('junta las alertas de todas las personas del reporte', () => {
        const entries = [person(alert(1, 2026, 9, 8)), person(alert(2, 2026, 9, 9))];
        expect(filterIncidentsInRange(entries, '2026-09-01', '2026-09-30')).toHaveLength(2);
    });

    test('descarta las alertas sin fecha', () => {
        const entries = [person({ id: 1, status: 'ACTIVE', createdAt: null })];
        expect(filterIncidentsInRange(entries, '2026-09-01', '2026-09-30')).toEqual([]);
    });

    test('no rompe con un reporte vacío', () => {
        expect(filterIncidentsInRange([], '2026-09-01', '2026-09-30')).toEqual([]);
        expect(filterIncidentsInRange(undefined, '2026-09-01', '2026-09-30')).toEqual([]);
    });
});

// ─── buildEvolutionGroups: rango (EU-391) ─────────────────────────────────────

describe('buildEvolutionGroups — sólo las alertas del período', () => {
    test('el caso del reporte: rango de dos días, una sola alerta dibujada', () => {
        // Historial de la persona: tres alertas del 4/9 y una del 8/9. El reporte se pidió del 8 al
        // 9, así que el gráfico tiene que dibujar una sola.
        const entries = [person(
            alert(13, 2026, 9, 4),
            alert(17, 2026, 9, 4),
            alert(18, 2026, 9, 4),
            alert(19, 2026, 9, 8),
        )];
        const groups = buildEvolutionGroups(entries, 'day', '2026-09-08', '2026-09-09');
        const total = groups.reduce((sum, g) => sum + g.active + g.falseAlarm, 0);
        expect(total).toBe(1);
        expect(groups.find(g => g.key === '2026-09-04')).toBeUndefined();
    });

    test('agrupado por mes tampoco entran los meses de afuera', () => {
        const entries = [person(alert(1, 2026, 1, 15), alert(2, 2026, 8, 10))];
        const groups = buildEvolutionGroups(entries, 'month', '2026-08-01', '2026-08-31');
        expect(groups.map(g => g.key)).toEqual(['2026-08']);
        expect(groups[0].active).toBe(1);
    });

    test('separa activas de falsas alarmas', () => {
        const entries = [person(
            alert(1, 2026, 9, 8, 'ACTIVE'),
            alert(2, 2026, 9, 8, 'FALSE_POSITIVE'),
            alert(3, 2026, 9, 8, 'FALSE_POSITIVE'),
        )];
        const [group] = buildEvolutionGroups(entries, 'day', '2026-09-08', '2026-09-08');
        expect(group.active).toBe(1);
        expect(group.falseAlarm).toBe(2);
    });
});

// ─── buildEvolutionGroups: períodos vacíos (EU-355) ───────────────────────────

describe('buildEvolutionGroups — los períodos sin casos van en cero', () => {
    test('el caso del reporte: enero y marzo con casos, febrero en cero y presente', () => {
        const entries = [person(alert(1, 2026, 1, 10), alert(2, 2026, 3, 20))];
        const groups = buildEvolutionGroups(entries, 'month', '2026-01-01', '2026-03-31');
        expect(groups.map(g => g.key)).toEqual(['2026-01', '2026-02', '2026-03']);
        expect(groups[1]).toMatchObject({ active: 0, falseAlarm: 0 });
    });

    test('agrupado por día se completan todos los días del rango', () => {
        const entries = [person(alert(1, 2026, 9, 8))];
        const groups = buildEvolutionGroups(entries, 'day', '2026-09-06', '2026-09-09');
        expect(groups.map(g => g.key)).toEqual([
            '2026-09-06', '2026-09-07', '2026-09-08', '2026-09-09',
        ]);
        expect(groups.filter(g => g.active > 0)).toHaveLength(1);
    });

    test('agrupado por semana se completan todas las semanas del rango', () => {
        const groups = buildEvolutionGroups([], 'week', '2026-09-01', '2026-09-30');
        expect(groups.length).toBeGreaterThanOrEqual(4);
        expect(groups.every(g => g.active === 0 && g.falseAlarm === 0)).toBe(true);
    });

    test('los períodos salen ordenados de más viejo a más nuevo', () => {
        const groups = buildEvolutionGroups([], 'month', '2025-11-01', '2026-02-28');
        expect(groups.map(g => g.key)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
    });

    test('cada período trae su etiqueta legible', () => {
        const groups = buildEvolutionGroups([], 'month', '2026-01-01', '2026-02-28');
        expect(groups.map(g => g.label)).toEqual(['ene/26', 'feb/26']);
    });

    test('sin rango no inventa períodos: sólo dibuja lo que hay', () => {
        const entries = [person(alert(1, 2026, 9, 8))];
        const groups = buildEvolutionGroups(entries, 'day', undefined, undefined);
        expect(groups.map(g => g.key)).toEqual(['2026-09-08']);
    });
});
