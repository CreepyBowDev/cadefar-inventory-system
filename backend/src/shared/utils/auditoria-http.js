// Adaptación HTTP reutilizada por los Controllers. Solo se transmite contexto
// validado; los Services nunca reciben req/res ni copian identidad del body.
export const ejecutarConAuditoria = async (req, operacion) => {
    const auditoria = { contexto: req.contextoAuditoria, responsable: {
        idUsuario: req.usuario.idUsuario, idRol: req.usuario.idRol, nombreUsuario: req.usuario.nombreUsuario
    } };
    const resultado = await operacion(auditoria);
    req.resultadoAuditoriaAuth = { ...auditoria.resultado, etapa: 'RESPUESTA' };
    return resultado;
};
