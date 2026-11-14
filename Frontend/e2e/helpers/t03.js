// Utilidades de la tanda T03 (recepción, inventario y detalle del objeto, carril paralelo).
const { expect } = require('@playwright/test');
const { foto, irAlMenu } = require('../helpers');

const URL_BACKEND = process.env.E2E_BACK_URL || 'http://localhost:8080';
const MENSAJE_EXITO = 'El objeto fue cargado al inventario con éxito.';
const EMPLEADO_AERO = 'emp1.aero@eurekapp.com';
// Punto que muestra el mapa al activar "fuera del establecimiento" (sin permiso de ubicación del navegador).
const PUNTO_POR_DEFECTO = { latitude: -31.4124, longitude: -64.1867 };

/** Abre Receptar un objeto (si ya está en esa pantalla, no navega). */
async function abrirRecepcion(page) {
    if (await page.getByPlaceholder('Escribe un título').locator('visible=true').count() === 0) {
        await irAlMenu(page, 'Receptar un objeto');
    }
    await expect(page.getByPlaceholder('Escribe un título')).toBeVisible();
}

/** Recarga la app y abre Receptar un objeto con el formulario vacío. */
async function abrirRecepcionLimpia(page) {
    await page.goto('/');
    await expect(page.getByText('Logout')).toBeVisible();
    await irAlMenu(page, 'Receptar un objeto');
    await expect(page.getByPlaceholder('Escribe un título')).toBeVisible();
}

/** Carga el archivo en el campo de archivos de la pantalla de receptar. */
const cargarImagen = (page, archivo) => page.locator('input[type="file"]').first().setInputFiles(archivo);

/** La vista previa de la imagen elegida (en la web es un fondo con la dirección local de la foto). */
const vistaPrevia = (page) => page.locator('[style*="background-image"][style*="blob:"]').locator('visible=true');

/** El interruptor "fuera del establecimiento". */
const interruptor = (page) => page.locator('[role="switch"], input[type="checkbox"]').locator('visible=true').first();

/** Una categoría del formulario, por su texto. */
const categoria = (page, texto) => page.getByText(texto, { exact: true }).locator('visible=true');

/** Elige la hora (múltiplo de 15 minutos, formato "8:15 AM") en el selector de hora. */
async function elegirHora(page, texto) {
    await page.getByText(/^\d{1,2}:\d{2}:\d{2}$/).locator('visible=true').first().click();
    await page.locator('.react-datepicker__time-list-item', { hasText: texto }).click();
}

/** Elige el día de hace `diasAtras` días en el calendario. Devuelve la fecha elegida. */
async function elegirDiaAtras(page, diasAtras) {
    const destino = new Date(Date.now() - diasAtras * 24 * 3600 * 1000);
    await page.getByText(/^\d{1,2}\/\d{1,2}\/\d{4}$/).locator('visible=true').first().click();
    if (destino.getMonth() !== new Date().getMonth()) await page.getByRole('button', { name: 'Previous Month' }).click();
    const dia = String(destino.getDate()).padStart(3, '0');
    await page.locator(`.react-datepicker__day--${dia}:not(.react-datepicker__day--outside-month)`).click();
    return destino;
}

/** Presiona el botón de receptar y espera la respuesta del servidor. */
async function enviarRecepcion(page) {
    const respuesta = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes('/found-objects/organizations/'));
    await page.getByText('Receptar objeto encontrado', { exact: true }).click();
    return respuesta;
}

const auth = async (page) => ({ Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('jwt'))}` });

/** El objeto del inventario de la organización del usuario con ese título, tal como lo guarda el servidor. */
async function objetoGuardado(page, titulo) {
    const headers = await auth(page);
    const org = await page.evaluate(() => localStorage.getItem('org.id'));
    for (let pagina = 0; pagina < 30; pagina++) {
        const r = await page.request.get(`${URL_BACKEND}/found-objects/organizations/all/${org}?page=${pagina}&pageSize=50`, { headers });
        const cuerpo = await r.json();
        const objeto = cuerpo.found_objects.find((o) => o.title === titulo);
        if (objeto) return objeto;
        if (!cuerpo.has_more) break;
    }
    return null;
}

/** Recepta un objeto mínimo (título y foto) y devuelve la respuesta del servidor. */
async function receptarMinimo(page, titulo) {
    await abrirRecepcion(page);
    await page.getByPlaceholder('Escribe un título').fill(titulo);
    await cargarImagen(page, foto('billetera.png'));
    await expect(vistaPrevia(page)).toHaveCount(1);
    return enviarRecepcion(page);
}

module.exports = {
    URL_BACKEND, MENSAJE_EXITO, EMPLEADO_AERO, PUNTO_POR_DEFECTO,
    abrirRecepcion, abrirRecepcionLimpia, cargarImagen, vistaPrevia, interruptor, categoria, elegirHora, elegirDiaAtras,
    enviarRecepcion, objetoGuardado, receptarMinimo,
};
