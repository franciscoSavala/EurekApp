// Utilidades de la tanda R12 (solicitudes de alta y correos al administrador).
const { expect } = require('@playwright/test');

const URL_CORREO = 'http://localhost:8025/api/v1';

/** Correos del servidor de prueba que cumplen la búsqueda (ver la sintaxis de búsqueda de Mailpit). */
async function correosDe(request, consulta) {
    const r = await request.get(`${URL_CORREO}/search`, { params: { query: consulta, limit: '50' } });
    if (!r.ok()) throw new Error(`correo: ${r.status()}`);
    return (await r.json()).messages || [];
}

/** Texto completo de un correo. */
async function textoDeCorreo(request, id) {
    const r = await request.get(`${URL_CORREO}/message/${id}`);
    const j = await r.json();
    return { asunto: j.Subject, para: (j.To || []).map((t) => t.Address), texto: j.Text || '', html: j.HTML || '' };
}

/** Espera el correo del asunto indicado que menciona el texto (por ejemplo, el nombre de la organización). */
async function esperarCorreo(request, { para, asunto, contiene }) {
    let hallado = null;
    await expect.poll(async () => {
        const lista = await correosDe(request, `to:${para} subject:"${asunto}"`);
        for (const m of lista) {
            const c = await textoDeCorreo(request, m.ID);
            if (c.texto.includes(contiene) || c.html.includes(contiene)) { hallado = { id: m.ID, ...c }; return true; }
        }
        return false;
    }, { timeout: 30000, message: `correo "${asunto}" que menciona ${contiene}` }).toBe(true);
    return hallado;
}

/** Cantidad de correos del asunto que mencionan el texto, enviados a la dirección. */
async function contarCorreos(request, { para, asunto, contiene }) {
    const lista = await correosDe(request, `to:${para} subject:"${asunto}"`);
    let n = 0;
    for (const m of lista) {
        const c = await textoDeCorreo(request, m.ID);
        if (c.texto.includes(contiene) || c.html.includes(contiene)) n++;
    }
    return n;
}

/** Arrastra el marcador del mapa (el único que se puede mover; el resto son puntos fijos). */
async function arrastrarMarcador(page, dx, dy) {
    const pin = page.locator('.leaflet-marker-draggable').locator('visible=true').first();
    await pin.scrollIntoViewIfNeeded();
    const caja = await pin.boundingBox();
    const x = caja.x + caja.width / 2;
    const y = caja.y + caja.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 8 });
    await page.mouse.move(x + dx, y + dy, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByText(/📍 -?\d+\.\d+, -?\d+\.\d+/).locator('visible=true')).toBeVisible();
}

/** Completa el formulario de cinco pasos de "Solicitar alta de organización" y lo envía. */
async function enviarSolicitudPorFormulario(page, d) {
    const vis = (t, o) => page.getByText(t, o).locator('visible=true');
    const siguiente = () => vis('Siguiente', { exact: true }).click();
    await page.getByPlaceholder('Nombre', { exact: true }).locator('visible=true').fill(d.nombre);
    await page.locator('select').locator('visible=true').selectOption({ label: 'Club' });
    await siguiente();
    await page.getByPlaceholder('Av. Colón').locator('visible=true').fill('Calle Falsa');
    await page.getByPlaceholder('1234').locator('visible=true').fill('123');
    await page.getByPlaceholder('Córdoba Capital').locator('visible=true').fill('Córdoba');
    await siguiente();
    await expect(vis('Arrastrá el marcador para indicar la ubicación exacta.')).toBeVisible();
    await arrastrarMarcador(page, 40, 30);
    await siguiente();
    await page.getByPlaceholder('Juan').locator('visible=true').fill(d.ownerNombre);
    await page.getByPlaceholder('Pérez').locator('visible=true').fill(d.ownerApellido);
    await page.getByPlaceholder('responsable@org.com').locator('visible=true').fill(d.ownerEmail);
    await page.getByPlaceholder('+54 9 351 000 0000').locator('visible=true').fill('3514000000');
    await siguiente();
    await page.getByPlaceholder('Contanos el motivo de tu solicitud...').locator('visible=true').fill(d.motivo);
    await vis('Enviar solicitud', { exact: true }).click();
    await expect(vis('Tu solicitud fue enviada correctamente. Te notificaremos cuando sea revisada.')).toBeVisible();
}

module.exports = { correosDe, textoDeCorreo, esperarCorreo, contarCorreos, enviarSolicitudPorFormulario };
