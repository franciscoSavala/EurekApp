// Utilidades de la tanda de organización y empleados.
const { CLAVE } = require('../helpers');

const URL_BACK = process.env.E2E_BACK_URL || 'http://localhost:8080';
const auth = (token) => ({ Authorization: `Bearer ${token}` });

/** El servidor limita /login y /signup a 10 por minuto por IP: si responde 429 se espera y se reintenta. */
async function conReintento(pedir) {
    let r;
    for (let i = 0; i < 8; i++) {
        r = await pedir();
        if (r.status() !== 429) return r;
        await new Promise((ok) => setTimeout(ok, 15000));
    }
    return r;
}

/** Inicia sesión por la API y devuelve el token. */
async function loginApi(request, email, clave = CLAVE) {
    const r = await conReintento(() => request.post(`${URL_BACK}/login`, { data: { username: email, password: clave } }));
    if (!r.ok()) throw new Error(`login ${email}: ${r.status()}`);
    return (await r.json()).token;
}

/** Registra un usuario nuevo con email único. Devuelve { email, nombre, apellido }. */
async function registrarUsuario(request, sufijo) {
    const id = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
    const email = `t08.${sufijo}.${id}@eurekapp.com`;
    const nombre = 'Prueba';
    const apellido = `T08${sufijo}${id}`;
    const r = await conReintento(() => request.post(`${URL_BACK}/signup`, { data: { firstname: nombre, lastname: apellido, username: email, password: CLAVE } }));
    if (!r.ok()) throw new Error(`signup ${email}: ${r.status()} ${await r.text()}`);
    return { email, nombre, apellido, token: (await r.json()).token };
}

/** El invitado acepta por la API la solicitud pendiente de la organización. */
async function aceptarInvitacionApi(request, usuario) {
    const { email, token } = usuario;
    const r = await request.get(`${URL_BACK}/organizations/getPendingAddEmployeeRequests`, { headers: auth(token) });
    const pendientes = (await r.json()).requests;
    if (!pendientes.length) throw new Error(`sin solicitudes pendientes para ${email}`);
    const a = await request.post(`${URL_BACK}/organizations/acceptAddEmployeeRequest`, { headers: auth(token), data: { requestId: pendientes[0].id } });
    if (!a.ok()) throw new Error(`aceptar ${email}: ${a.status()}`);
}

/** Lista de empleados de la organización del dueño: [{ id, username, role }]. */
async function empleadosApi(request, tokenDueno) {
    const r = await request.get(`${URL_BACK}/organizations/employees`, { headers: auth(tokenDueno) });
    return (await r.json()).users;
}

/** Desvincula por la API a quien siga en la organización (limpieza). */
async function desvincularApi(request, tokenDueno, email) {
    const u = (await empleadosApi(request, tokenDueno)).find((e) => e.username === email);
    if (u) await request.post(`${URL_BACK}/organizations/delete_employee`, { headers: auth(tokenDueno), data: { userId: u.id } });
}

/** Tarjeta (fila) del empleado con ese email en la lista visible de "Mi organización". */
function filaEmpleado(page, email) {
    return page.locator('div')
        .filter({ has: page.getByText(email, { exact: true }) })
        .filter({ has: page.getByText('Eliminar', { exact: true }) })
        .locator('visible=true').last();
}

module.exports = { URL_BACK, auth, loginApi, registrarUsuario, aceptarInvitacionApi, empleadosApi, desvincularApi, filaEmpleado };
