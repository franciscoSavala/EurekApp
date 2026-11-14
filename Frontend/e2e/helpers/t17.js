// Ayudas de la tanda T17: pasos de caso que no cortan el test cuando fallan.
const { test, expect } = require('@playwright/test');
const { caso } = require('../helpers');

const primeraLinea = (e) => String((e && e.message) || e).replace(/\u001b\[[0-9;]*m/g, '').split('\n').map((l) => l.trim()).find(Boolean) || 'falló';

/**
 * Como `caso`, pero si la verificación lanza un error el paso queda marcado como fallado
 * y el test sigue con los casos siguientes.
 */
const casoContinuo = (numero, descripcion, fn) =>
    caso(numero, descripcion, async () => {
        try {
            await fn();
        } catch (e) {
            expect.soft(false, primeraLinea(e)).toBe(true);
        }
    });

/** Lo mismo que `casoContinuo`, para pasos escritos con `test.step('caso NNN: ...')`. */
const pasoContinuo = (titulo, fn) =>
    test.step(titulo, async () => {
        try {
            await fn();
        } catch (e) {
            expect.soft(false, primeraLinea(e)).toBe(true);
        }
    });

/** Falla el paso actual (sin cortar el test) con el motivo de que no se pudo probar. */
const noSePudoProbar = (motivo) => expect.soft(false, `no se pudo probar: ${motivo}`).toBe(true);

module.exports = { casoContinuo, pasoContinuo, noSePudoProbar, primeraLinea };
