import { crearContextoAuditoria } from '../../shared/utils/auditoria-contexto.js';

// Se montará al integrar Fase 2, antes del parser y de los controles de acceso.
// No registra eventos por recibir una solicitud ni depende de MySQL.
export const auditoriaContextoMiddleware = (req, res, next) => {
    req.contextoAuditoria = crearContextoAuditoria(req);
    next();
};
