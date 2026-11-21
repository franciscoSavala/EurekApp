// Utilidades de la tanda R05 (alertas de fraude).
const fs = require('fs');
const { expect } = require('@playwright/test');
const { foto } = require('../helpers');
const { URL_BACK } = require('./t08');
const { receptarApi, devolverApi } = require('./t07');
const { receptarConFinder } = require('./t12');

const MAILPIT = process.env.E2E_MAILPIT_URL || 'http://localhost:8025';
const auth = (token) => ({ Authorization: `Bearer ${token}` });

/** Configuración de fraude vigente (solo administrador). */
async function configFraudeApi(request, tokenAdmin) {
    const r = await request.get(`${URL_BACK}/admin/fraud/config`, { headers: auth(tokenAdmin) });
    if (!r.ok()) throw new Error(`leer configuración de fraude: ${r.status()}`);
    return r.json();
}

/** Guarda la configuración de fraude por la API (se usa para dejarla como estaba). */
async function guardarConfigFraudeApi(request, tokenAdmin, config) {
    const r = await request.put(`${URL_BACK}/admin/fraud/config`, {
        headers: auth(tokenAdmin),
        data: {
            fraudThreshold: config.fraudThreshold,
            fraudWindowDays: config.fraudWindowDays,
            blockDurationDays: config.blockDurationDays,
        },
    });
    if (!r.ok()) throw new Error(`guardar configuración de fraude: ${r.status()}`);
}

/** Recepta y devuelve `veces` objetos al mismo DNI (con quien encontró, si se indica). */
async function devolverVarias(request, sesion, dni, veces, finderEmail) {
    for (let i = 0; i < veces; i++) {
        const titulo = `Objeto fraude ${Date.now().toString(36)}${i}`;
        const uuid = finderEmail
            ? await receptarConFinder(request, sesion.token, sesion.orgId, titulo, finderEmail)
            : await receptarApi(request, sesion.token, sesion.orgId, titulo);
        await devolverApi(request, sesion.token, sesion.orgId, uuid, dni);
    }
}

/** Intenta devolver un objeto a ese DNI y devuelve el estado HTTP y el cuerpo (sin lanzar error). */
async function intentarDevolverApi(request, sesion, dni) {
    const uuid = await receptarApi(request, sesion.token, sesion.orgId, `Objeto bloqueo ${Date.now().toString(36)}`);
    const r = await request.post(`${URL_BACK}/found-objects/return/${sesion.orgId}`, {
        headers: auth(sesion.token),
        multipart: {
            firstName: 'Ana', lastName: 'Prueba', dni, phoneNumber: '3514000000', found_object_uuid: uuid,
            file: { name: 'persona_retiro.jpg', mimeType: 'image/jpeg', buffer: fs.readFileSync(foto('persona_retiro.jpg')) },
        },
    });
    return { status: r.status(), cuerpo: await r.text() };
}

/** Intenta iniciar sesión por la API respetando el cupo del servidor; devuelve estado y cuerpo. */
async function intentarLoginApi(request, email, clave) {
    const sesion = require('./sesion');
    const r = await sesion.pedirConCupo(() => request.post(`${URL_BACK}/login`, { data: { username: email, password: clave } }), `login ${email}`);
    return { status: r.status(), cuerpo: await r.text() };
}

/** Correos del servidor de prueba (Mailpit) para esa dirección con ese asunto, con el texto de cada uno. */
async function correosDe(request, destino, asunto) {
    const q = encodeURIComponent(`to:${destino} subject:"${asunto}"`);
    const r = await request.get(`${MAILPIT}/api/v1/search?query=${q}&limit=50`);
    if (!r.ok()) throw new Error(`Mailpit: ${r.status()}`);
    const lista = (await r.json()).messages || [];
    const salida = [];
    for (const m of lista) {
        const d = await request.get(`${MAILPIT}/api/v1/message/${m.ID}`);
        const j = await d.json();
        salida.push({ asunto: m.Subject, creado: Date.parse(m.Created), texto: `${j.Text || ''} ${j.HTML || ''}` });
    }
    return salida;
}

/**
 * Espera (hasta 60 s) a que llegue, después de `desdeMs`, un correo con ese asunto cuyo texto contenga todo
 * lo pedido (textos) y coincida con cada expresión (patrones). Devuelve el correo.
 */
async function esperarCorreo(request, destino, asunto, desdeMs, textos = [], patrones = []) {
    let hallado = null;
    await expect.poll(async () => {
        const correos = await correosDe(request, destino, asunto);
        hallado = correos.find((c) => c.creado >= desdeMs
            && textos.every((t) => c.texto.includes(t))
            && patrones.every((p) => p.test(c.texto))) || null;
        return !!hallado;
    }, { timeout: 60_000, intervals: [1000, 2000, 3000], message: `no llegó el correo "${asunto}" a ${destino}` }).toBe(true);
    return hallado;
}

module.exports = {
    configFraudeApi, guardarConfigFraudeApi, devolverVarias, intentarDevolverApi, intentarLoginApi, correosDe, esperarCorreo,
};
