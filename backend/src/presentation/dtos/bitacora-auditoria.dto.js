const identidad = (data, sufijo) => data[`id_usuario_${sufijo}`] == null ? null : {
    idUsuario: data[`id_usuario_${sufijo}`], nombreUsuario: data[`nombre_usuario_${sufijo}`],
    idRol: data[`id_rol_${sufijo}`]
};

// Proyección explícita de la información histórica, sin JOIN al estado actual
// ni copia de atributos extra. Los JSON fueron sanitizados al persistirse.
export const toResumenBitacora = data => ({
    idEvento: data.id_evento, tipoEvento: data.tipo_evento,
    modulo: data.modulo, accion: data.accion, resultado: data.resultado, causa: data.causa,
    fechaRegistro: data.fecha_registro, fechaEvento: data.fecha_evento,
    responsable: identidad(data, 'responsable'), cuentaObjetivo: identidad(data, 'objetivo'),
    nombreIngresado: data.nombre_ingresado, direccionIp: data.direccion_ip,
    procedenciaIp: data.procedencia_ip,
    registro: data.tipo_registro == null ? null : { tipo: data.tipo_registro, id: data.id_registro },
    correlacion: data.correlacion, idEventoRelacionado: data.id_evento_relacionado,
    versionFormato: data.version_formato
});

export const toDetalleBitacora = data => ({ ...toResumenBitacora(data),
    antes: data.antes, despues: data.despues, metadatos: data.metadatos, referencias: data.referencias
});
