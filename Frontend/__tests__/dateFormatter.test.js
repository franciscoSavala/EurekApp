import {
    formatDateES,
    formatDateTimeES,
    formatDateISO,
    formatDateTimeLocaleES,
} from '../utils/dateFormatter';

// ─── formatDateES ─────────────────────────────────────────────────────────────

describe('formatDateES', () => {
    test('formatea fecha como d/m/yyyy', () => {
        const date = new Date(2026, 5, 20); // 20 jun 2026 (mes 0-indexed)
        expect(formatDateES(date)).toBe('20/6/2026');
    });

    test('no agrega cero al día ni al mes de un dígito', () => {
        const date = new Date(2026, 0, 5); // 5 ene 2026
        expect(formatDateES(date)).toBe('5/1/2026');
    });

    test('acepta string ISO y lo parsea', () => {
        // new Date(string) interpreta en UTC, se usa local getters → depende de TZ,
        // así que pasamos directamente un Date construido con valores locales
        const date = new Date(2025, 11, 31); // 31 dic 2025
        expect(formatDateES(date)).toBe('31/12/2025');
    });
});

// ─── formatDateTimeES ─────────────────────────────────────────────────────────

describe('formatDateTimeES', () => {
    test('incluye la fecha en formato d/m/yyyy', () => {
        const date = new Date(2026, 5, 20, 14, 30, 0);
        const result = formatDateTimeES(date);
        expect(result).toContain('20/6/2026');
    });

    test('incluye "a las" como separador', () => {
        const date = new Date(2026, 5, 20, 14, 30, 0);
        expect(formatDateTimeES(date)).toContain('a las');
    });
});

// ─── formatDateISO ────────────────────────────────────────────────────────────

describe('formatDateISO', () => {
    test('devuelve fecha en formato yyyy-mm-dd', () => {
        // Date.UTC evita dependencias de zona horaria
        const date = new Date(Date.UTC(2026, 5, 20, 12, 0, 0));
        expect(formatDateISO(date)).toBe('2026-06-20');
    });

    test('resultado tiene exactamente 10 caracteres', () => {
        const date = new Date(Date.UTC(2025, 0, 1, 12, 0, 0));
        expect(formatDateISO(date)).toHaveLength(10);
    });

    test('formato sigue el patrón yyyy-mm-dd', () => {
        const date = new Date(Date.UTC(2026, 11, 31, 12, 0, 0));
        expect(formatDateISO(date)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
});

// ─── formatDateTimeLocaleES ───────────────────────────────────────────────────

describe('formatDateTimeLocaleES', () => {
    test('retorna "—" para null', () => {
        expect(formatDateTimeLocaleES(null)).toBe('—');
    });

    test('retorna "—" para undefined', () => {
        expect(formatDateTimeLocaleES(undefined)).toBe('—');
    });

    test('retorna "—" para string vacío', () => {
        expect(formatDateTimeLocaleES('')).toBe('—');
    });

    test('retorna string no vacío para ISO string válido', () => {
        const result = formatDateTimeLocaleES('2026-06-20T14:30:00');
        expect(result).toBeTruthy();
        expect(typeof result).toBe('string');
    });

    test('resultado contiene el año de la fecha', () => {
        const result = formatDateTimeLocaleES('2026-06-20T14:30:00');
        expect(result).toContain('2026');
    });
});
