const toPlain = registro => registro.get ? registro.get({ plain: true }) : registro;

export const toResumenReceta = registro => {
    const receta = toPlain(registro);
    return {
        idReceta: receta.id_receta, idVenta: receta.id_venta,
        fechaReceta: receta.fecha_receta, modalidad: receta.modalidad,
        resultadoRevision: receta.resultado_revision,
        idUsuarioValidador: receta.id_usuario_validador,
        fechaRegistro: receta.fecha_registro, fechaValidacion: receta.fecha_validacion
    };
};

// Datos de formulario para registro autorizado y consulta/revisión del Regente.
// No incluir referencias históricas de archivo ni datos de usuario adicionales.
export const toDetalleReceta = registro => {
    const receta = toPlain(registro);
    return { ...toResumenReceta(receta), numeroReceta: receta.numero_receta,
        nombrePaciente: receta.nombre_paciente, documentoPaciente: receta.documento_paciente,
        nombreMedico: receta.nombre_medico, observacion: receta.observacion };
};
