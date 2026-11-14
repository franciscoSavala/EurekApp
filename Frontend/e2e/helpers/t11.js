// Utilidades de la tanda T11 (reportes de opiniones sobre coincidencias y exportación a PDF).
const { expect } = require('@playwright/test');
const { USUARIOS_PARALELO, irAlMenu, nombreUnico } = require('../helpers');
const { abrirComo } = require('./t02');
const { receptarApi } = require('./t07');

const URL_BACK = process.env.E2E_BACK_URL || 'http://localhost:8080';
const ORG_UNC = 5;
const visible = (loc) => loc.locator('visible=true');
const texto = (page, t) => visible(page.getByText(t, { exact: true })).first();
const auth = (token) => ({ Authorization: `Bearer ${token}` });

/** Token de la sesión abierta en la pestaña. */
const tokenDe = (page) => page.evaluate(() => localStorage.getItem('jwt'));

/**
 * En la web, "Exportar PDF" escribe el reporte en un iframe oculto y llama a print(). Se guarda el HTML
 * del iframe y se reemplaza print() para que no abra el diálogo de impresión.
 */
async function instalarCapturaPdf(page, { fallar = false } = {}) {
    await page.evaluate((fallar) => {
        window.__pdf = { html: null, impresiones: 0 };
        const agregar = Node.prototype.appendChild;
        Node.prototype.appendChild = function (nodo) {
            const r = agregar.call(this, nodo);
            if (nodo && nodo.tagName === 'IFRAME' && nodo.contentDocument) {
                // El documento del iframe es de otro contexto: se parchea la instancia, no el prototipo.
                const doc = nodo.contentDocument;
                const cerrar = doc.close.bind(doc);
                if (fallar) doc.write = () => { throw new Error('falla simulada'); };
                doc.close = () => {
                    const res = cerrar();
                    window.__pdf.html = doc.documentElement.outerHTML;
                    nodo.contentWindow.print = () => { window.__pdf.impresiones += 1; };
                    return res;
                };
            }
            return r;
        };
    }, fallar);
}

/** Espera a que la app genere el PDF y devuelve su HTML y el texto que contiene. */
async function leerPdf(page) {
    await expect.poll(() => page.evaluate(() => window.__pdf.html !== null && window.__pdf.impresiones > 0), { timeout: 15000 }).toBe(true);
    return page.evaluate(() => {
        const html = window.__pdf.html;
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return { html, texto: doc.body.innerText || doc.body.textContent, impresiones: window.__pdf.impresiones };
    });
}

/** Aprieta Exportar PDF y dice si el navegador descargó un archivo (en la web el PDF sale por el diálogo de impresión). */
async function descargaAlExportar(page, boton) {
    const espera = page.waitForEvent('download', { timeout: 6000 }).catch(() => null);
    await boton.click();
    return espera;
}

/** Entra al reporte de uso del dueño (menú Reportes) y espera que cargue el feedback. */
async function abrirReporteUso(browser, email = USUARIOS_PARALELO.duenoUnc) {
    const { context, page } = await abrirComo(browser, email);
    await irAlMenu(page, 'Reportes');
    await expect(texto(page, 'Exportar PDF')).toBeVisible();
    return { context, page };
}

/**
 * Prepara en la organización UNC un objeto receptado por el empleado y feedback de búsqueda de Valeria
 * sobre ese objeto (uno que lo encontró y otro que no). Devuelve los títulos.
 */
async function sembrarFeedback(browser) {
    const titulo = nombreUnico('Billetera reporte');
    const emp = await abrirComo(browser, USUARIOS_PARALELO.empleadoUnc);
    const val = await abrirComo(browser, USUARIOS_PARALELO.usuarioValeria);
    try {
        const uuid = await receptarApi(emp.page.request, await tokenDe(emp.page), ORG_UNC, titulo);
        const tokenVal = await tokenDe(val.page);
        const enviar = async (data) => {
            const r = await val.page.request.post(`${URL_BACK}/feedback`, { headers: auth(tokenVal), data });
            if (!r.ok()) throw new Error(`feedback: ${r.status()} ${await r.text()}`);
        };
        await enviar({ organizationId: String(ORG_UNC), foundObjectUUID: uuid, starRating: 0, wasFound: true, lostObjectText: `busqueda ${titulo}` });
        await enviar({ organizationId: String(ORG_UNC), starRating: 0, wasFound: false, lostObjectText: `sin hallazgo ${titulo}` });
        return { titulo, uuid };
    } finally {
        await emp.context.close();
        await val.context.close();
    }
}

module.exports = { URL_BACK, ORG_UNC, visible, texto, auth, tokenDe, instalarCapturaPdf, leerPdf, descargaAlExportar, abrirReporteUso, sembrarFeedback };
