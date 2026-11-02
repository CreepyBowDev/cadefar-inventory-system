const toPlain = registro => registro.get ? registro.get({ plain: true }) : registro;
const usuarioPublico = usuario => usuario ? {
    idUsuario: usuario.id_usuario, nombreUsuario: usuario.nombre_usuario
} : null;

export const toResumenVenta = registro => {
    const venta = toPlain(registro);
    return {
        idVenta: venta.id_venta, idUsuario: venta.id_usuario,
        estadoOperacion: venta.estado_operacion, claveOperacion: venta.clave_operacion,
        fechaRegistro: venta.fecha_registro, fechaVenta: venta.fecha_venta,
        total: venta.total, fechaAnulacion: venta.fecha_anulacion,
        motivoAnulacion: venta.motivo_anulacion, idUsuarioAnulador: venta.id_usuario_anulador,
        usuarioRegistrador: usuarioPublico(venta.usuarioRegistrador),
        usuarioAnulador: usuarioPublico(venta.usuarioAnulador)
    };
};

export const toDetalleVenta = registro => {
    const venta = toPlain(registro);
    return { ...toResumenVenta(venta),
        detalles: venta.detallesVenta.map(detalle => {
            const existencia = detalle.existencia;
            const medicamento = existencia?.medicamento;
            return {
                idDetalleVenta: detalle.id_detalle_venta, idVenta: detalle.id_venta,
                idExistencia: detalle.id_existencia, idReceta: detalle.id_receta,
                cantidad: detalle.cantidad, precioUnitario: detalle.precio_unitario,
                subtotal: detalle.subtotal,
                existencia: existencia ? {
                    idExistencia: existencia.id_existencia, idMedicamento: existencia.id_medicamento,
                    codigoExistencia: existencia.codigo_existencia,
                    fechaVencimiento: existencia.fecha_vencimiento,
                    precisionVencimiento: existencia.precision_vencimiento,
                    medicamento: medicamento ? {
                        idMedicamento: medicamento.id_medicamento,
                        codigoMedicamento: medicamento.codigo_medicamento,
                        nombreComercial: medicamento.nombre_comercial,
                        formaFarmaceutica: medicamento.forma_farmaceutica,
                        presentacion: medicamento.presentacion,
                        unidadInventario: medicamento.unidad_inventario,
                        estado: Boolean(medicamento.estado)
                    } : null
                } : null
            };
        }),
        recetas: venta.recetas.map(receta => ({ idReceta: receta.id_receta,
            idVenta: receta.id_venta, resultadoRevision: receta.resultado_revision }))
    };
};
