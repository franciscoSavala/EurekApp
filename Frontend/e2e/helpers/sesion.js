// Sesiones compartidas por todas las tandas.
// El servidor limita /login y /signup a 10 pedidos por minuto por IP (y cuenta también los rechazados).
// Por eso todos los ingresos y registros pasan por acá: se espacian a lo sumo 8 por minuto entre todos los
// procesos (carriles y workers, con un archivo de turnos), se reintenta ante un 429 y se cuentan los 429.
// La sesión de cada usuario se guarda en e2e/.sesiones/ y la reutilizan todos.
const fs = require('fs');
const path = require('path');
const { request: apiRequest, expect } = require('@playwright/test');

const CLAVE = 'Eurekapp1!';
const URL_BACK = process.env.E2E_BACK_URL || 'http://localhost:8080';
const BASE = process.env.E2E_BASE_URL || 'http://localhost:8082';
const OPCIONES_CONTEXTO = { baseURL: BASE, viewport: { width: 1280, height: 900 } };

const CARPETA = path.join(__dirname, '..', '.sesiones');
const ARCHIVO_CUPO = path.join(CARPETA, 'cupo.json');
const ARCHIVO_429 = path.join(CARPETA, '429.txt');
const MAX_POR_MINUTO = 8;
// El token de acceso dura 60 minutos: se renueva el estado guardado antes de que venza.
const VIGENCIA_MS = 40 * 60 * 1000;

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const nombreArchivo = (email) => path.join(CARPETA, `${email.replace(/[^a-z0-9.@_-]/gi, '_')}.json`);

/** Exclusión entre procesos con un directorio: quien lo crea tiene el turno. */
async function conCerrojo(nombre, fn, vencimientoMs = 10 * 60 * 1000) {
    fs.mkdirSync(CARPETA, { recursive: true });
    const dir = path.join(CARPETA, `${nombre}.lock`);
    for (;;) {
        try {
            fs.mkdirSync(dir);
            break;
        } catch (e) {
            if (e.code !== 'EEXIST') throw e;
            try { if (Date.now() - fs.statSync(dir).mtimeMs > vencimientoMs) fs.rmdirSync(dir); } catch { /* otro lo sacó */ }
            await pausa(100 + Math.floor(Math.random() * 150));
        }
    }
    try {
        return await fn();
    } finally {
        try { fs.rmdirSync(dir); } catch { /* ya no está */ }
    }
}

/** Espera su turno: no deja pasar más de MAX_POR_MINUTO pedidos de ingreso o registro por minuto en total. */
async function esperarCupo() {
    await conCerrojo('cupo', async () => {
        for (;;) {
            let marcas = [];
            try { marcas = JSON.parse(fs.readFileSync(ARCHIVO_CUPO, 'utf8')); } catch { /* sin marcas */ }
            const ahora = Date.now();
            marcas = marcas.filter((t) => ahora - t < 60_000);
            if (marcas.length < MAX_POR_MINUTO) {
                marcas.push(ahora);
                fs.writeFileSync(ARCHIVO_CUPO, JSON.stringify(marcas));
                return;
            }
            await pausa(Math.max(200, marcas[0] + 60_000 - ahora + 200));
        }
    }, 120_000);
}

/** Anota un 429 (lo cuenta el resumen de la regresión). */
function contar429(origen) {
    try {
        fs.mkdirSync(CARPETA, { recursive: true });
        fs.appendFileSync(ARCHIVO_429, `${new Date().toISOString()} ${origen}\n`);
    } catch { /* el conteo no debe romper un test */ }
}

/** Cantidad de 429 anotados hasta ahora. */
function cantidad429() {
    try { return fs.readFileSync(ARCHIVO_429, 'utf8').split('\n').filter(Boolean).length; } catch { return 0; }
}

/** Hace un pedido de ingreso o registro respetando el cupo; si el servidor contesta 429, espera y reintenta. */
async function pedirConCupo(pedir, origen, intentos = 12) {
    let r;
    for (let i = 0; i < intentos; i++) {
        await esperarCupo();
        r = await pedir();
        if (r.status() !== 429) return r;
        contar429(origen);
        // El servidor también cuenta los rechazados: se espera a que la ventana se vacíe un poco.
        await pausa(10_000 + Math.floor(Math.random() * 10_000));
    }
    return r;
}

/** Cuerpo del ingreso o registro, con el que la app web arma su almacenamiento local. */
function estadoDeNavegador(cuerpo, email) {
    const items = { jwt: cuerpo.token, username: email };
    if (cuerpo.refreshToken) items.refreshToken = cuerpo.refreshToken;
    if (cuerpo.user) {
        items['user.first_name'] = String(cuerpo.user.firstName);
        items.user = JSON.stringify(cuerpo.user);
    }
    if (cuerpo.organization) {
        items['org.id'] = String(cuerpo.organization.id);
        items['org.name'] = cuerpo.organization.name;
        items.organization = JSON.stringify(cuerpo.organization);
    }
    return { cookies: [], origins: [{ origin: new URL(BASE).origin, localStorage: Object.entries(items).map(([name, value]) => ({ name, value })) }] };
}

/** Guarda la sesión en disco (token y estado del navegador). */
function guardarSesion(email, cuerpo) {
    fs.mkdirSync(CARPETA, { recursive: true });
    const registro = { email, guardadoEn: Date.now(), token: cuerpo.token, orgId: cuerpo.organization ? cuerpo.organization.id : null, storageState: estadoDeNavegador(cuerpo, email) };
    const temporal = `${nombreArchivo(email)}.${process.pid}.tmp`;
    fs.writeFileSync(temporal, JSON.stringify(registro));
    fs.renameSync(temporal, nombreArchivo(email));
    return registro;
}

function sesionVigente(email) {
    try {
        const r = JSON.parse(fs.readFileSync(nombreArchivo(email), 'utf8'));
        if (Date.now() - r.guardadoEn < VIGENCIA_MS) return r;
    } catch { /* no hay o está dañada */ }
    return null;
}

const olvidarSesion = (email) => { try { fs.unlinkSync(nombreArchivo(email)); } catch { /* ya no está */ } };

async function conRequest(request, fn) {
    if (request) return fn(request);
    const propio = await apiRequest.newContext();
    try {
        return await fn(propio);
    } finally {
        await propio.dispose();
    }
}

/** Inicia sesión por la API (con cupo y reintento). Devuelve el cuerpo completo de la respuesta; falla si no es 2xx. */
async function loginApi(request, email, clave = CLAVE) {
    return conRequest(request, async (req) => {
        const r = await pedirConCupo(() => req.post(`${URL_BACK}/login`, { data: { username: email, password: clave } }), `login ${email}`);
        if (!r.ok()) throw new Error(`login ${email}: ${r.status()} ${await r.text()}`);
        return r.json();
    });
}

/** Registra un usuario por la API (con cupo y reintento). `datos`: { firstname, lastname, username, password }. Devuelve el cuerpo de la respuesta. */
async function registrarUsuario(request, datos) {
    const pedido = { password: CLAVE, ...datos };
    return conRequest(request, async (req) => {
        const r = await pedirConCupo(() => req.post(`${URL_BACK}/signup`, { data: pedido }), `signup ${pedido.username}`);
        if (!r.ok()) throw new Error(`signup ${pedido.username}: ${r.status()} ${await r.text()}`);
        const cuerpo = await r.json();
        if (cuerpo.token && pedido.password === CLAVE) guardarSesion(pedido.username, cuerpo);
        return cuerpo;
    });
}

/** Sesión guardada del usuario; si no existe o venció, inicia sesión por la API y la guarda. */
async function sesionDe(email, { renovar = false } = {}) {
    if (!renovar) {
        const guardada = sesionVigente(email);
        if (guardada) return guardada;
    }
    return conCerrojo('ingreso', async () => {
        if (!renovar) {
            const guardada = sesionVigente(email);
            if (guardada) return guardada;
        }
        return guardarSesion(email, await loginApi(null, email));
    });
}

/** Token de acceso del usuario del seed (o registrado en la corrida), de la sesión guardada. */
async function tokenDe(email) {
    return (await sesionDe(email)).token;
}

/** Abre una pestaña nueva con la sesión de `email` ya iniciada (el menú disponible). */
async function abrirComo(browser, email) {
    for (let intento = 0; intento < 2; intento++) {
        const sesion = await sesionDe(email, { renovar: intento > 0 });
        const context = await browser.newContext({ ...OPCIONES_CONTEXTO, storageState: sesion.storageState });
        const page = await context.newPage();
        try {
            await page.goto('/');
            await expect(page.getByText('Logout')).toBeVisible();
            return { context, page };
        } catch (e) {
            await context.close();
            if (intento > 0) throw e;
            // El estado guardado no sirvió (venció o la cuenta cambió): se descarta y se inicia sesión de nuevo.
            olvidarSesion(email);
        }
    }
}

module.exports = {
    CLAVE, URL_BACK, CARPETA, VIGENCIA_MS,
    abrirComo, tokenDe, registrarUsuario, loginApi, sesionDe, guardarSesion, sesionVigente,
    esperarCupo, pedirConCupo, contar429, cantidad429, pausa, conCerrojo,
};
