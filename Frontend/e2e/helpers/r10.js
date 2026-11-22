// Utilidades de la tanda R10 (logros, puntos, niveles, insignias y exclusiones de puntos).
const { expect } = require('@playwright/test');
const t = require('./t13');

const MAIL = process.env.E2E_MAIL_URL || 'http://localhost:8025';

/** Notificaciones del usuario por la API. */
async function notificaciones(request, token) {
    return (await t.notificacionesApi(request, token)) || [];
}

/** Cantidad de notificaciones de recompensa ("¡Sumaste puntos!") del usuario. */
async function cuantasRecompensas(request, token) {
    return (await notificaciones(request, token)).filter((n) => n.type === 'REWARD_EARNED').length;
}

/** Espera (hasta 30 s) un correo para `email` cuyo asunto contenga `asunto`. Devuelve el texto del correo o null. */
async function correoPara(request, email, asunto) {
    let texto = null;
    await expect.poll(async () => {
        const r = await request.get(`${MAIL}/api/v1/search`, { params: { query: `to:${email}` } });
        if (!r.ok()) return false;
        const m = ((await r.json()).messages || []).find((x) => (x.Subject || '').includes(asunto));
        if (!m) return false;
        const d = await request.get(`${MAIL}/api/v1/message/${m.ID}`);
        texto = (await d.json()).Text || '';
        return true;
    }, { timeout: 30_000, intervals: [1000, 2000] }).toBe(true).catch(() => {});
    return texto;
}

/** Recepta y devuelve por la API `n` objetos cuyo finder es `finder`. */
async function devolverVarios(request, tokenEmp, finder, n, prefijo) {
    for (let i = 0; i < n; i++) {
        const uuid = await t.receptarApi(request, tokenEmp, `${prefijo} ${i + 1} ${Date.now().toString(36)}${i}`, finder);
        const r = await t.devolverApi(request, tokenEmp, uuid);
        expect(r.ok(), `devolución ${i + 1} de ${finder}`).toBeTruthy();
    }
}

module.exports = { notificaciones, cuantasRecompensas, correoPara, devolverVarios };
