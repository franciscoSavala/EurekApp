// Utilidades de la tanda R01 (acceso, registro y recuperación de contraseña).
const { execFileSync } = require('child_process');
const { expect } = require('@playwright/test');
const sesion = require('./sesion');
const { ph, registrate } = require('./t01');

const CORREO = process.env.E2E_MAIL_URL || 'http://localhost:8025';
const CLAVE_NUEVA = 'Nueva1234!';

/** Email que no existe todavía: único por corrida. */
const emailNuevo = (prefijo = 'e2e.r01') => `${prefijo}.${Date.now().toString(36)}${Math.floor(Math.random() * 100000)}@mail.com`;

/** Completa el formulario de registro. Un valor `null` deja el campo vacío. No gasta cupo del servidor. */
async function llenarRegistro(page, { nombre = 'Test', apellido = 'Tanda', email = emailNuevo(), clave = 'Eurekapp1!' } = {}) {
    if (nombre !== null) await ph(page, 'Nombre').fill(nombre);
    if (apellido !== null) await ph(page, 'Apellido').fill(apellido);
    if (email !== null) await ph(page, 'Email').fill(email);
    if (clave !== null) await ph(page, 'Contraseña').fill(clave);
}

/** Espera el turno del cupo de /login y /signup: va justo antes de un envío que llega al servidor. */
const turno = () => sesion.esperarCupo();

/** Correos del servidor de prueba (Mailpit) dirigidos a `email`, más nuevos primero. */
async function correosDe(request, email) {
    const r = await request.get(`${CORREO}/api/v1/search`, { params: { query: `to:${email}` } });
    return (await r.json()).messages || [];
}

/** Espera un correo para `email` cuyo asunto cumpla `asunto` y devuelve su texto. Con `excluir` ignora los ya vistos. */
async function esperarCorreo(request, email, asunto, excluir = []) {
    let encontrado = null;
    await expect.poll(async () => {
        const lista = (await correosDe(request, email)).filter((m) => asunto.test(m.Subject) && !excluir.includes(m.ID));
        encontrado = lista[0] || null;
        return encontrado !== null;
    }, { timeout: 30_000, message: `debería llegar un correo "${asunto}" a ${email}` }).toBe(true);
    const detalle = await (await request.get(`${CORREO}/api/v1/message/${encontrado.ID}`)).json();
    return { id: encontrado.ID, asunto: encontrado.Subject, texto: `${detalle.Text || ''} ${detalle.HTML || ''}` };
}

/** Código de 6 dígitos que trae el correo de recuperación. */
function codigoDelCorreo(correo) {
    const m = (correo.texto.match(/(?<![\d])(\d{6})(?![\d])/) || []);
    return m[1];
}

/** Registra un usuario por la API (con cupo) y devuelve sus datos. Ante el límite del servidor, espera y reintenta. */
async function usuarioNuevo(request, prefijo, nombre = 'Recupera') {
    const email = emailNuevo(prefijo);
    for (let intento = 1; ; intento++) {
        try {
            await sesion.registrarUsuario(request, { firstname: nombre, lastname: 'Prueba', username: email });
            return { email, nombre };
        } catch (e) {
            if (intento >= 6 || !/429/.test(String(e.message))) throw e;
            await sesion.pausa(15_000 * intento);
        }
    }
}

/**
 * Hace el envío que dispara `clic` (login o registro) y devuelve la respuesta del servidor.
 * El límite de pedidos por minuto es de toda la máquina y lo comparten otros procesos: si responde 429, espera y repite.
 */
async function enviar(page, ruta, clic, intentos = 8) {
    for (let intento = 1; ; intento++) {
        await turno();
        const respuesta = page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === ruta, { timeout: 30_000 });
        await clic();
        const r = await respuesta;
        if (r.status() !== 429 || intento >= intentos) return r;
        await page.waitForTimeout(10_000 + 5_000 * intento);
    }
}

/** Completa el login y presiona Iniciar sesión (con reintento ante el límite del servidor). */
async function ingresar(page, email, clave) {
    await ph(page, 'Email').fill(email);
    await ph(page, 'Contraseña').fill(clave);
    return enviar(page, '/login', () => page.getByText('Iniciar sesión', { exact: true }).locator('visible=true').last().click());
}

/** Presiona Registrate (con reintento ante el límite del servidor). */
const registrarse = (page) => enviar(page, '/signup', () => registrate(page).click());

/** Pone el vencimiento del código de recuperación de `email` en el año 2000 (no se pueden esperar 30 minutos; la hora de la base y la del servidor difieren). */
function vencerCodigo(email) {
    execFileSync('docker', ['exec', 'eurekapp-mysql', 'mysql', '-ueurekapp', '-peurekapp', 'eurekapp', '-e',
        `UPDATE users SET password_reset_token_expiry = '2000-01-01 00:00:00' WHERE username = '${email.replace(/'/g, '')}'`], { stdio: 'pipe' });
}

/** Desde el login abre Recuperar contraseña, pide el código de `email` y queda en Nueva contraseña. */
async function pedirCodigo(page, email) {
    await page.getByText('¿Olvidaste tu contraseña?').click();
    await expect(page.getByText('Recuperar contraseña', { exact: true })).toBeVisible();
    await ph(page, 'Email').fill(email);
    await page.getByText('Enviar código').click();
    await expect(page.getByText('Nueva contraseña', { exact: true })).toBeVisible();
}

/** Completa Nueva contraseña (código, contraseña y confirmación) y presiona Cambiar contraseña. */
async function cambiarContrasena(page, codigo, nueva, confirmacion = nueva) {
    await ph(page, 'Código (6 dígitos)').fill(codigo);
    await ph(page, 'Nueva contraseña').fill(nueva);
    await ph(page, 'Confirmar contraseña').fill(confirmacion);
    await page.getByText('Cambiar contraseña', { exact: true }).click();
}

module.exports = {
    CLAVE_NUEVA, emailNuevo, llenarRegistro, turno, correosDe, esperarCorreo, codigoDelCorreo,
    usuarioNuevo, enviar, ingresar, registrarse, vencerCodigo, pedirCodigo, cambiarContrasena,
};
