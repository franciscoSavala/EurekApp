// Utilidades de la tanda R06 (reporte de fraude).
const { panel, abrirConfiguracion, bloqueEvolucion } = require('./t06');

/** Color del texto de una opción del panel de configuración (sirve para saber cuál está resaltada). */
async function colorDe(page, texto) {
    await abrirConfiguracion(page);
    return panel(page).getByText(texto, { exact: true }).first().evaluate((e) => getComputedStyle(e).color);
}

/** Colores de relleno de las barras de activas y de falsas alarmas del gráfico de evolución. */
async function coloresBarras(page) {
    return bloqueEvolucion(page).evaluate((raiz) => {
        const etiqueta = /^(\d{2}\/\d{2}|S\d{2}\/\d{2}|[a-z]{3}\/\d{2})$/;
        const hojas = (e) => [...e.querySelectorAll('div')].filter((d) => d.children.length === 0);
        const salida = { activas: new Set(), falsas: new Set() };
        for (const h of hojas(raiz)) {
            if (!etiqueta.test(h.textContent.trim())) continue;
            const hs = hojas(h.parentElement);
            if (hs[3].getBoundingClientRect().height > 0) salida.activas.add(getComputedStyle(hs[3]).backgroundColor);
            if (hs[5].getBoundingClientRect().height > 0) salida.falsas.add(getComputedStyle(hs[5]).backgroundColor);
        }
        return { activas: [...salida.activas], falsas: [...salida.falsas] };
    });
}

/** Nombres de las tarjetas visibles del reporte agrupado por usuario, en el orden de pantalla. */
async function nombresEnOrden(page) {
    return page.evaluate(() => {
        const visibles = (e) => e.getClientRects().length > 0;
        const mails = [...document.querySelectorAll('div')]
            .filter((d) => d.children.length === 0 && visibles(d) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.textContent.trim()));
        return mails.map((m) => {
            const n = m.previousElementSibling;
            return n ? n.textContent.trim() : '';
        });
    });
}

module.exports = { colorDe, coloresBarras, nombresEnOrden };
