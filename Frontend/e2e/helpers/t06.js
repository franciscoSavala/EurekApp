// Utilidades de la tanda T06 (reportes de fraude, carril paralelo, solo lectura).
const { expect } = require('@playwright/test');
const { irAlMenu } = require('../helpers');

const ADMIN = 'soporte.eurekapp@gmail.com';
const URL_BACK = process.env.E2E_BACK_URL || 'http://localhost:8080';
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const visible = (loc) => loc.locator('visible=true');

/** Guarda el token que la app manda al servidor, para consultar la API sin iniciar sesión de nuevo. */
function vigilarToken(page) {
    page.on('request', (r) => {
        const a = r.headers()['authorization'];
        if (a && r.url().startsWith(URL_BACK)) page.tokenApi = a;
    });
}

/** Administrador: menú Alertas de fraude y botón Ver reporte. */
async function irAlReporte(page) {
    vigilarToken(page);
    await irAlMenu(page, 'Alertas de fraude');
    await visible(page.getByText('Ver reporte', { exact: true })).click();
    await expect(visible(page.getByText('Generar reporte', { exact: true }))).toBeVisible();
}

/** Panel de configuración del reporte (el que tiene Desde, Hasta, Estado y Generar reporte). */
const panel = (page) => visible(page.locator('div')
    .filter({ has: page.getByText('Configurar reporte', { exact: true }) })
    .filter({ has: page.getByText('Generar reporte', { exact: true }) })
    .last());

async function abrirConfiguracion(page) {
    if (await visible(page.getByText('Generar reporte', { exact: true })).count() > 0) return;
    await visible(page.getByText('Configurar reporte', { exact: true })).first().click();
    await expect(visible(page.getByText('Generar reporte', { exact: true }))).toBeVisible();
}

/** Escribe una fecha (AAAA-MM-DD) en Desde (0) o Hasta (1). */
async function fijarFecha(page, cual, iso) {
    await abrirConfiguracion(page);
    await visible(page.getByText(/^\d{4}-\d{2}-\d{2}$/)).nth(cual === 'Desde' ? 0 : 1).click();
    const campo = page.locator('input[type=date]');
    await campo.fill(iso);
    await campo.press('Enter');
    await expect(visible(page.getByText(iso, { exact: true })).first()).toBeVisible();
}

const elegir = async (page, texto) => {
    await abrirConfiguracion(page);
    await panel(page).getByText(texto, { exact: true }).click();
};

/** Aprieta Generar reporte y devuelve lo que respondió el servidor. */
async function generar(page) {
    await abrirConfiguracion(page);
    const [resp] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/fraud-alerts/report?') && r.request().method() === 'GET'),
        visible(page.getByText('Generar reporte', { exact: true })).click(),
    ]);
    const datos = await resp.json();
    // El panel se cierra con un desvanecido: hasta que no desaparece, parece abierto.
    await expect(page.getByText('Generar reporte', { exact: true })).toHaveCount(0);
    await expect(visible(page.getByText('Exportar CSV', { exact: true })).or(visible(page.getByText(/^No hay registros de fraude/)))).toBeVisible();
    return datos;
}

/** Fija el rango, el estado (opcional) y genera. */
async function generarRango(page, desde, hasta, estado) {
    await fijarFecha(page, 'Desde', desde);
    await fijarFecha(page, 'Hasta', hasta);
    if (estado) await elegir(page, estado);
    return generar(page);
}

/** Tarjeta de un usuario del reporte (por su email). */
const tarjeta = (page, email) => visible(page.locator('div')
    .filter({ has: page.getByText(email, { exact: true }) })
    .filter({ has: page.getByText(/^Histórico acumulado/) })
    .last());

/** Lista global de alertas (la ve solo el administrador). */
async function alertasApi(page, request) {
    const r = await request.get(`${URL_BACK}/fraud-alerts`, { headers: { Authorization: page.tokenApi } });
    if (!r.ok()) throw new Error(`alertas: ${r.status()}`);
    return r.json();
}

const dia = (alerta) => String(alerta.createdAt).slice(0, 10);
const enRango = (alertas, desde, hasta) => alertas.filter((a) => dia(a) >= desde && dia(a) <= hasta);

/** Números de un renglón de la tarjeta, por ejemplo "Activas: 2". */
async function numeroDe(loc, etiqueta) {
    const t = await loc.innerText();
    const m = t.match(new RegExp(`${etiqueta}:\\s*(\\d+)`));
    return m ? Number(m[1]) : null;
}

/** Lee la leyenda de la torta: { activas, falsas }. */
async function leyendaTorta(page) {
    const t = await visible(page.getByText(/^Activas: \d+/)).first().innerText();
    const f = await visible(page.getByText(/^Falsas alarmas: \d+/)).first().innerText();
    const tom = (s, re) => { const m = s.match(re); return m ? { n: Number(m[1]), pct: Number(m[2]) } : null; };
    return {
        activas: tom(t, /Activas:\s*(\d+)\s*\((\d+)%\)/),
        falsas: tom(f, /Falsas alarmas:\s*(\d+)\s*\((\d+)%\)/),
    };
}

/** Bloque del gráfico de evolución. */
const bloqueEvolucion = (page) => visible(page.locator('div')
    .filter({ has: page.getByText('Evolución de casos', { exact: true }) })
    .filter({ has: page.getByText('Falsa alarma', { exact: true }) })
    .last());

/** Lee las barras del gráfico: [{ etiqueta, activas, falsas, altoActiva, altoFalsa }]. */
async function leerEvolucion(page) {
    return bloqueEvolucion(page).evaluate((raiz) => {
        const etiqueta = /^(\d{2}\/\d{2}|S\d{2}\/\d{2}|[a-z]{3}\/\d{2})$/;
        const hojas = (e) => [...e.querySelectorAll('div')].filter((d) => d.children.length === 0);
        const salida = [];
        for (const h of hojas(raiz)) {
            if (!etiqueta.test(h.textContent.trim())) continue;
            const grupo = h.parentElement;
            const hs = hojas(grupo);
            const num = (x) => (x.textContent.trim() === '' ? 0 : Number(x.textContent.trim()));
            salida.push({
                etiqueta: h.textContent.trim(), n: hs.length,
                activas: num(hs[0]), falsas: num(hs[2]),
                altoActiva: hs[3].getBoundingClientRect().height, altoFalsa: hs[5].getBoundingClientRect().height,
            });
        }
        return salida;
    });
}

const etiquetaMes = (iso) => `${MESES[Number(iso.slice(5, 7)) - 1]}/${iso.slice(2, 4)}`;

module.exports = {
    ADMIN, URL_BACK, visible, vigilarToken, irAlReporte, panel, abrirConfiguracion, fijarFecha, elegir, generar,
    generarRango, tarjeta, alertasApi, dia, enRango, numeroDe, leyendaTorta, bloqueEvolucion, leerEvolucion, etiquetaMes,
};
