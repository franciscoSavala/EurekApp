// Utilidades de la tanda T14 (solicitudes de alta de organizaciones, carril serie).
const { URL_BACK, auth } = require('./t08');
const { registrarUsuario, loginConOrg, abrirComo, pausa } = require('./t12');

/** Crea una solicitud de alta de organización por la API en nombre del usuario. Devuelve el id. */
async function crearSolicitudApi(request, token, { nombre, ownerEmail, ownerNombre = 'Dueno', ownerApellido = 'Futuro' }) {
    const r = await request.post(`${URL_BACK}/organizations`, {
        headers: auth(token),
        data: {
            organizationName: nombre, organizationType: 'CLUB', street: 'Calle Falsa', streetNumber: '123',
            city: 'Cordoba', province: 'Córdoba', country: 'Argentina', latitude: -31.4201, longitude: -64.1888,
            ownerFirstName: ownerNombre, ownerLastName: ownerApellido, ownerEmail, ownerPhone: '3514000000',
            reason: `Motivo de prueba ${nombre}`,
        },
    });
    if (!r.ok()) throw new Error(`solicitud ${nombre}: ${r.status()} ${await r.text()}`);
    return (await r.json()).requestId;
}

/** Detalle de la solicitud tal como lo ve el administrador. */
async function detalleApi(request, tokenAdmin, id) {
    const r = await request.get(`${URL_BACK}/organizations/requests/${id}`, { headers: auth(tokenAdmin) });
    return { status: r.status(), cuerpo: r.ok() ? await r.json() : null };
}

/** Intenta resolver una solicitud por la API y devuelve el estado HTTP. */
async function resolverApi(request, tokenAdmin, id, resolucion, nota) {
    const r = await request.put(`${URL_BACK}/organizations/requests/${id}/resolve`, {
        headers: auth(tokenAdmin), data: { resolution: resolucion, adminNote: nota || null },
    });
    return r.status();
}

/** Organización por nombre, desde el listado del administrador. */
async function organizacionPorNombre(request, tokenAdmin, nombre) {
    const r = await request.get(`${URL_BACK}/admin/organizations`, { headers: auth(tokenAdmin) });
    return (await r.json()).find((o) => o.name === nombre);
}

/** Desactiva una organización por la API del administrador. */
async function desactivarOrganizacion(request, tokenAdmin, id) {
    await request.put(`${URL_BACK}/admin/organizations/${id}/active`, { headers: auth(tokenAdmin), data: { active: false } });
}

module.exports = { registrarUsuario, loginConOrg, abrirComo, pausa, crearSolicitudApi, detalleApi, resolverApi, organizacionPorNombre, desactivarOrganizacion };
