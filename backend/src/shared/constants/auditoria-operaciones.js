// Plantillas acotadas de endpoints existentes. Nunca conservar URL, query,
// parámetros o cabeceras crudos como metadatos del error.
const rutas = [
    ['POST', '/auth/login', 'AUTENTICACION.LOGIN'],
    ['POST', '/auth/logout', 'AUTENTICACION.LOGOUT'],
    ['GET', '/auth/me', 'AUTENTICACION.CONSULTAR_SESION'],
    ['POST', '/auth/recuperacion/solicitar', 'AUTENTICACION.SOLICITAR_RECUPERACION'],
    ['POST', '/auth/recuperacion/restablecer', 'AUTENTICACION.RESTABLECER_PASSWORD'],
    ['PATCH', '/usuarios/me/password', 'USUARIOS.CAMBIAR_PASSWORD'],
    ['PATCH', '/usuarios/:id/password', 'USUARIOS.RESTABLECER_PASSWORD'],
    ['GET', '/usuarios', 'USUARIOS.CONSULTAR'], ['GET', '/usuarios/:id', 'USUARIOS.CONSULTAR'],
    ['POST', '/usuarios', 'USUARIOS.CREAR'], ['PATCH', '/usuarios/:id', 'USUARIOS.MODIFICAR'],
    ['PATCH', '/usuarios/:id/estado', 'USUARIOS.CAMBIAR_ESTADO'],
    ['GET', '/bitacora', 'BITACORA.CONSULTAR'],
    ['GET', '/bitacora/:id', 'BITACORA.CONSULTAR_DETALLE'],
    ...['proveedores-laboratorios', 'principios-activos', 'medicamentos'].flatMap((path, i) => {
        const modulo = ['PROVEEDORES_LABORATORIOS', 'PRINCIPIOS_ACTIVOS', 'MEDICAMENTOS'][i];
        return [['GET', `/${path}`, `${modulo}.CONSULTAR`], ['GET', `/${path}/:id`, `${modulo}.CONSULTAR`],
            ['POST', `/${path}`, `${modulo}.CREAR`], ['PATCH', `/${path}/:id`, `${modulo}.MODIFICAR`],
            ['PATCH', `/${path}/:id/estado`, `${modulo}.CAMBIAR_ESTADO`]];
    }),
    ['GET', '/medicamentos/:id/composicion', 'COMPOSICION.CONSULTAR'],
    ['POST', '/medicamentos/:id/composicion', 'COMPOSICION.AGREGAR'],
    ['PATCH', '/medicamentos/:id/composicion/:id', 'COMPOSICION.MODIFICAR'],
    ['DELETE', '/medicamentos/:id/composicion/:id', 'COMPOSICION.RETIRAR'],
    ['GET', '/compras', 'COMPRAS.CONSULTAR'], ['GET', '/compras/:id', 'COMPRAS.CONSULTAR'],
    ['POST', '/compras', 'COMPRAS.REGISTRAR'], ['POST', '/compras/:id/anular', 'COMPRAS.ANULAR'],
    ['POST', '/inventario/ajustes', 'INVENTARIO.AJUSTAR'],
    ['POST', '/inventario/retiros/vencimiento', 'INVENTARIO.RETIRAR_VENCIMIENTO'],
    ['POST', '/inventario/retiros/dano', 'INVENTARIO.RETIRAR_DANO'],
    ...['', '/medicamentos/:id/existencias', '/movimientos', '/proximos-a-vencer', '/vencidos', '/stock-bajo']
        .map(path => ['GET', `/inventario${path}`, 'INVENTARIO.CONSULTAR'])
];

export const OPERACIONES_HTTP_AUDITORIA = Object.freeze(rutas.map(([metodo, ruta, operacion]) =>
    Object.freeze({ metodo, ruta: `/api${ruta}`, operacion,
        patron: new RegExp(`^/api${ruta.replaceAll(':id', '[^/]+')}/?$`, 'i') })));

export const identificarOperacionAuditoria = (metodo, path) =>
    OPERACIONES_HTTP_AUDITORIA.find(ruta => ruta.metodo === (metodo === 'HEAD' ? 'GET' : metodo) && ruta.patron.test(path))?.operacion;
