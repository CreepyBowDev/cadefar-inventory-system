import { bitacoraAuditoriaService } from '../../src/business/services/bitacora-auditoria.service.js';
import { prepararEventoAuditoria } from '../../src/business/validators/auditoria.validator.js';
import { crearContextoAuditoriaConexion } from '../../src/shared/utils/auditoria-contexto.js';

// Estas regresiones verifican el SQL del negocio con un transporte que solo
// conoce sus tablas. Validar los eventos transversales sin enviarlos a ese
// transporte. Persistencia y fallos del auditor se verifican en auditoria.*.
export const simularAuditoriaTransversal = t => {
    t.mock.method(bitacoraAuditoriaService, 'intentarRegistrar', async entrada => {
        for (const evento of Array.isArray(entrada) ? entrada : [entrada]) prepararEventoAuditoria(evento);
        return { registrado: true, estado: 'CONFIRMADO', ids: [] };
    });
};

// Regresiones de negocio con transacciones/mutex propios simulados. Proveer
// un actor sintético del fixture, validar el contrato y aislar persistencia.
// La atomicidad del auditor real se verifica en auditoria.*.test.js.
export const simularAuditoriaNegocio = (t, responsable = { idUsuario: 1, idRol: 1, nombreUsuario: 'adminFixture' }) => {
    simularAuditoriaTransversal(t);
    const ejecutar = bitacoraAuditoriaService.ejecutarCambio;
    t.mock.method(bitacoraAuditoriaService, 'ejecutarCambio', function (tipo, auditoria, registro, operacion) {
        return ejecutar.call(this, tipo, { contexto: crearContextoAuditoriaConexion(),
            responsable, ...auditoria }, registro, operacion);
    });
    t.mock.method(bitacoraAuditoriaService, 'registrar', async (evento, { transaction }) => {
        if (!transaction) throw new Error('La regresión requiere la transacción de negocio');
        prepararEventoAuditoria(evento);
        return 1;
    });
};

export const simularAuditoriaCatalogo = t => simularAuditoriaNegocio(t,
    { idUsuario: 2, idRol: 2, nombreUsuario: 'regenteFixture' });
