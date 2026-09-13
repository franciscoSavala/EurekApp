import { dateToCommit, parseDateInputValue, toDateInputValue } from '../utils/dateInput';

// ─── EU-397: escribir la fecha a mano en el campo de la web ───────────────────
//
// El navegador avisa de cada cambio tecla por tecla y, mientras la fecha está incompleta, manda el
// valor vacío. El campo tiene que distinguir "todavía está escribiendo" de "la fecha está lista":
// antes tomaba cualquier aviso como final, se cerraba al primer dígito y descartaba lo tipeado.

describe('parseDateInputValue', () => {
    test('toma la fecha cuando está completa', () => {
        expect(toDateInputValue(parseDateInputValue('2026-08-01'))).toBe('2026-08-01');
    });

    test('no toma nada mientras la fecha está a medio escribir', () => {
        // Lo que manda el navegador tecla por tecla hasta que la fecha queda completa.
        ['', '2', '20', '2026', '2026-0', '2026-08'].forEach(parcial => {
            expect(parseDateInputValue(parcial)).toBeNull();
        });
    });

    test('no toma un día que no existe', () => {
        expect(parseDateInputValue('2026-02-31')).toBeNull();
        expect(parseDateInputValue('2026-13-01')).toBeNull();
    });

    test('no toma texto que no sea una fecha', () => {
        expect(parseDateInputValue('01/08/2026')).toBeNull();
        expect(parseDateInputValue(undefined)).toBeNull();
    });
});

describe('la fecha elegida es la que se muestra y se envía', () => {
    test('el ida y vuelta no corre el día', () => {
        // El defecto clásico de este campo: leerlo en la zona horaria local y mostrarlo en UTC
        // (o al revés) muestra el día anterior al elegido. Acá se maneja todo en UTC.
        expect(toDateInputValue(parseDateInputValue('2026-09-11'))).toBe('2026-09-11');
        expect(toDateInputValue(parseDateInputValue('2026-01-01'))).toBe('2026-01-01');
    });

    test('la fecha que ya tenía el filtro se muestra tal cual en el campo', () => {
        expect(toDateInputValue(new Date('2026-08-01T00:00:00.000Z'))).toBe('2026-08-01');
    });
});

// La fecha se confirma UNA vez, al terminar de editar. El navegador avisa tramo por tramo y un campo
// que arranca con fecha cargada queda completo después de cada tramo: confirmar cada aviso
// intermedio significaba, en las pantallas que recargan solas, una consulta al servidor por tecla.

describe('dateToCommit', () => {
    test('confirma la fecha nueva cuando se terminó de escribirla', () => {
        const date = dateToCommit('2026-08-01', '2026-09-12');
        expect(toDateInputValue(date)).toBe('2026-08-01');
    });

    test('no confirma nada si la edición terminó en la fecha que ya estaba', () => {
        expect(dateToCommit('2026-09-12', '2026-09-12')).toBeNull();
    });

    test('no confirma nada si quedó a medio escribir', () => {
        expect(dateToCommit('2026-08', '2026-09-12')).toBeNull();
        expect(dateToCommit('', '2026-09-12')).toBeNull();
    });

    test('no confirma una fecha que no existe', () => {
        expect(dateToCommit('2026-02-31', '2026-09-12')).toBeNull();
    });

    test('confirma la primera fecha de un campo que arrancó vacío', () => {
        const date = dateToCommit('2026-08-01', '');
        expect(toDateInputValue(date)).toBe('2026-08-01');
    });
});
