const { buildPieSlices, PIE_VIEWBOX, EMPTY_COLOR } = require('../utils/pieChart');

const SIN_MOVIMIENTO = [
    { label: 'Devueltos', value: 0, color: '#4caf50' },
    { label: 'No devueltos', value: 0, color: '#f0a500' },
];

describe('buildPieSlices', () => {
    test('tolera una lista vacía o sin definir', () => {
        expect(buildPieSlices([]).total).toBe(0);
        expect(buildPieSlices(undefined).total).toBe(0);
    });

    // EU-336: un período sin movimiento se dibuja igual, en gris y con la leyenda en cero, en vez de
    // reemplazar el gráfico por un cartel de "sin datos".
    describe('período sin movimiento', () => {
        test('se marca como vacío', () => {
            const { total, empty } = buildPieSlices(SIN_MOVIMIENTO);
            expect(total).toBe(0);
            expect(empty).toBe(true);
        });

        test('devuelve un sector por categoría, todos en cero', () => {
            const { slices } = buildPieSlices(SIN_MOVIMIENTO);
            expect(slices).toHaveLength(2);
            expect(slices.map(s => s.percent)).toEqual([0, 0]);
            expect(slices.map(s => s.value)).toEqual([0, 0]);
        });

        test('conserva las etiquetas para poder armar la leyenda', () => {
            const { slices } = buildPieSlices(SIN_MOVIMIENTO);
            expect(slices.map(s => s.label)).toEqual(['Devueltos', 'No devueltos']);
        });

        test('trae el círculo entero para dibujarlo en gris', () => {
            const { emptyPath } = buildPieSlices(SIN_MOVIMIENTO);
            expect(typeof emptyPath).toBe('string');
            expect(emptyPath.match(/A/g)).toHaveLength(2);
            expect(EMPTY_COLOR).toBe('#d1d5db');
        });

        test('los sectores no traen path propio: el dibujo es el círculo gris', () => {
            const { slices } = buildPieSlices(SIN_MOVIMIENTO);
            slices.forEach(s => expect(s.d).toBeNull());
        });
    });

    test('con datos no se marca como vacío', () => {
        const { empty, emptyPath } = buildPieSlices([
            { label: 'Devueltos', value: 4, color: '#4caf50' },
            { label: 'No devueltos', value: 6, color: '#f0a500' },
        ]);
        expect(empty).toBe(false);
        expect(emptyPath).toBeNull();
    });

    test('suma el total de todos los segmentos', () => {
        const { total } = buildPieSlices([
            { label: 'Devueltos', value: 4, color: '#4caf50' },
            { label: 'No devueltos', value: 6, color: '#f0a500' },
        ]);
        expect(total).toBe(10);
    });

    test('calcula el porcentaje de cada categoría', () => {
        const { slices } = buildPieSlices([
            { label: 'Devueltos', value: 4, color: '#4caf50' },
            { label: 'No devueltos', value: 6, color: '#f0a500' },
        ]);
        expect(slices.map(s => s.percent)).toEqual([40, 60]);
    });

    test('conserva etiqueta, valor y color de cada segmento', () => {
        const { slices } = buildPieSlices([
            { label: 'Exitosas', value: 4, color: '#4caf50' },
            { label: 'Fallidas', value: 1, color: '#e53935' },
        ]);
        expect(slices[0]).toMatchObject({ label: 'Exitosas', value: 4, color: '#4caf50', percent: 80 });
        expect(slices[1]).toMatchObject({ label: 'Fallidas', value: 1, color: '#e53935', percent: 20 });
    });

    test('cada sector trae un path dibujable', () => {
        const { slices } = buildPieSlices([
            { label: 'Devueltos', value: 4, color: '#4caf50' },
            { label: 'No devueltos', value: 6, color: '#f0a500' },
        ]);
        slices.forEach(s => {
            expect(typeof s.d).toBe('string');
            expect(s.d.startsWith('M')).toBe(true);
            expect(s.d).toContain('A');
            expect(s.d.trim().endsWith('Z')).toBe(true);
        });
    });

    test('usa el arco largo cuando el sector pasa la mitad', () => {
        const { slices } = buildPieSlices([
            { label: 'Chico', value: 1, color: '#000' },
            { label: 'Grande', value: 3, color: '#fff' },
        ]);
        expect(slices[0].d).toContain('0,1');  // 25%, arco corto
        expect(slices[1].d).toContain('1,1');  // 75%, arco largo
    });

    // El bug de EU-335: un sector de 360 grados empieza y termina en el mismo punto, y un arco de SVG
    // entre dos puntos iguales no dibuja nada. La torta salía vacía cuando una categoría se llevaba
    // todo, por ejemplo un período con objetos encontrados y ninguno devuelto.
    test('una sola categoría con el 100% se dibuja como círculo completo', () => {
        const { slices } = buildPieSlices([
            { label: 'Devueltos', value: 0, color: '#4caf50' },
            { label: 'No devueltos', value: 8, color: '#f0a500' },
        ]);
        expect(slices[1].percent).toBe(100);
        // Dos medias vueltas, no un arco degenerado que no pinta nada.
        expect(slices[1].d.match(/A/g)).toHaveLength(2);
        expect(slices[1].d).not.toContain('L');
    });

    test('el sector vacío que acompaña al 100% no rompe nada', () => {
        const { slices } = buildPieSlices([
            { label: 'Devueltos', value: 0, color: '#4caf50' },
            { label: 'No devueltos', value: 8, color: '#f0a500' },
        ]);
        expect(slices[0].percent).toBe(0);
        expect(typeof slices[0].d).toBe('string');
    });

    test('el viewBox acompaña a los paths', () => {
        expect(PIE_VIEWBOX).toBe('0 0 200 200');
    });
});
