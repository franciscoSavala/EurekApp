// Utilidades de la tanda T02 (búsqueda de objetos perdidos, carril paralelo).
const { expect } = require('@playwright/test');
const { irAlMenu, perderlo, receptarObjeto } = require('../helpers');

const DESCRIPCION = 'Proporciona detalles que ayuden a identificarlo';

// Organización donde se receptan los objetos propios (la usa emp1.aero) y organización sin objetos
// (el empleado de Patio Olmos está bloqueado en el seed, así que nadie le carga objetos).
const ORG_CON_OBJETOS = 'Aeropuerto Internacional Cordoba';
const ORG_SIN_OBJETOS = 'Shopping Patio Olmos';

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

/** Abre una pestaña nueva con la sesión de `email` iniciada (ver helpers/sesion.js). */
const abrirComo = (browser, email) => require('./sesion').abrirComo(browser, email);

/** Un empleado recepta una billetera con título único; devuelve el título. */
async function receptarComoEmpleado(browser, email, titulo) {
    const { context, page } = await abrirComo(browser, email);
    try {
        await receptarObjeto(page, titulo);
    } finally {
        await context.close();
    }
    return titulo;
}

/** Entra a Buscar un objeto, sin elegir establecimiento ni cambiar la fecha. */
async function irABuscar(page) {
    await irAlMenu(page, 'Buscar un objeto');
    await expect(page.getByPlaceholder(DESCRIPCION)).toBeVisible();
}

/** Entra a Buscar un objeto, elige el establecimiento y pone la fecha de pérdida unos días atrás. */
async function prepararBusqueda(page, organizacion, diasAtras = 2) {
    await irABuscar(page);
    await page.locator('select').first().selectOption({ label: organizacion });
    await perderlo(page, diasAtras);
}

const botonBuscar = (page) => page.getByText('Buscar objeto', { exact: true });
const descripcion = (page) => page.getByPlaceholder(DESCRIPCION);

/** Elige una foto en el selector de la búsqueda (acepta una ruta o un archivo en memoria). */
async function cargarFoto(page, archivo) {
    const [selector] = await Promise.all([page.waitForEvent('filechooser'), page.getByText('Seleccionar foto').click()]);
    await selector.setFiles(archivo);
}

/** Abre Filtros avanzados. */
async function abrirFiltros(page) {
    await page.getByText('Filtros avanzados', { exact: true }).click();
    await expect(page.getByText('Color (opcional):')).toBeVisible();
}

/** Porcentaje de coincidencia que se muestra para el objeto de título `titulo`, o null si no está. */
async function porcentajeDe(page, titulo) {
    const tarjeta = page.locator('div', { has: page.getByText(titulo, { exact: true }) }).filter({ hasText: /Coincidencia:\s*\d+%/ }).last();
    if (await tarjeta.count() === 0) return null;
    const texto = await tarjeta.innerText();
    return Number(/Coincidencia:\s*(\d+)%/.exec(texto)[1]);
}

/** Pone una fecha en un campo de fecha de la web (el de "hasta" de los filtros avanzados). */
async function elegirFechaLimite(page, anio, mes, dia) {
    await page.getByText('Sin límite', { exact: true }).click();
    const campo = page.locator('input[type="date"]');
    await campo.fill(`${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`);
    // Elegido el día, el campo se cierra solo; si sigue abierto se confirma con Enter.
    await page.waitForTimeout(300);
    if (await campo.count() > 0) await campo.press('Enter');
}

/** Arrastra el pin del mapa `dx` píxeles a la derecha y `dy` hacia abajo (como una persona con el mouse). */
async function arrastrarPin(page, dx, dy) {
    const pin = page.locator('.leaflet-marker-icon').first();
    await pin.scrollIntoViewIfNeeded();
    const caja = await pin.boundingBox();
    const x = caja.x + caja.width / 2;
    const y = caja.y + caja.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 8 });
    await page.mouse.move(x + dx, y + dy, { steps: 8 });
    await page.mouse.up();
    await expect.poll(async () => (await pin.boundingBox()).x).not.toBe(caja.x);
}

/** Lo que muestra la pantalla de resultados o de "sin coincidencias" después de buscar. */
async function esperarResultado(page) {
    await expect(page.getByText('Coincidencias encontradas').or(page.getByText('No se encontraron coincidencias para tu búsqueda.'))).toBeVisible({ timeout: 30000 });
}

/** Hace una búsqueda que no trae nada (establecimiento sin objetos) y espera la pantalla de "sin coincidencias". */
async function buscarSinResultados(page, texto, archivoFoto = null) {
    await prepararBusqueda(page, ORG_SIN_OBJETOS);
    await descripcion(page).fill(texto);
    if (archivoFoto) await cargarFoto(page, archivoFoto);
    await botonBuscar(page).click();
    await expect(page.getByText('No se encontraron coincidencias para tu búsqueda.')).toBeVisible({ timeout: 30000 });
}

/** El cuadro de diálogo abierto (el modal de guardar la búsqueda). */
const modal = (page) => page.locator('[aria-modal="true"]');

module.exports = {
    buscarSinResultados, modal,
    arrastrarPin, esperarResultado,
    DESCRIPCION, ORG_CON_OBJETOS, ORG_SIN_OBJETOS,
    abrirComo, receptarComoEmpleado, irABuscar, prepararBusqueda, botonBuscar, descripcion, cargarFoto,
    abrirFiltros, porcentajeDe, elegirFechaLimite,
};
