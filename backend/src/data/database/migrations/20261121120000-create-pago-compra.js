'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('pago_compra', {
            id_pago: { type: Sequelize.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
            id_compra: { type: Sequelize.INTEGER, allowNull: false,
                references: { model: 'compra', key: 'id_compra' }, onDelete: 'RESTRICT', onUpdate: 'RESTRICT' },
            id_usuario: { type: Sequelize.INTEGER, allowNull: false,
                references: { model: 'usuario', key: 'id_usuario' }, onDelete: 'RESTRICT', onUpdate: 'RESTRICT' },
            clave_operacion: { type: Sequelize.STRING(64), allowNull: false },
            metodo: { type: Sequelize.ENUM('TARJETA', 'PAYPAL'), allowNull: false },
            importe: { type: Sequelize.DECIMAL(14, 2), allowNull: false },
            moneda: { type: Sequelize.STRING(3), allowNull: false },
            importe_pasarela: { type: Sequelize.DECIMAL(14, 2), allowNull: false },
            moneda_pasarela: { type: Sequelize.STRING(3), allowNull: false },
            referencia_cotizacion: { type: Sequelize.STRING(100), allowNull: true },
            cuenta_destino: { type: Sequelize.STRING(100), allowNull: false },
            estado: { type: Sequelize.ENUM('PENDIENTE', 'PROCESANDO', 'CONFIRMADO', 'RECHAZADO'), allowNull: false },
            id_externo: { type: Sequelize.STRING(100), allowNull: true },
            referencia_externa: { type: Sequelize.STRING(100), allowNull: true },
            url_pago: { type: Sequelize.STRING(2048), allowNull: true },
            url_comprobante: { type: Sequelize.STRING(2048), allowNull: true },
            resultado_proveedor: { type: Sequelize.STRING(60), allowNull: true },
            fecha_registro: { type: Sequelize.DATE, allowNull: false },
            fecha_verificacion: { type: Sequelize.DATE, allowNull: true },
            fecha_confirmacion: { type: Sequelize.DATE, allowNull: true }
        });
        await queryInterface.addIndex('pago_compra', ['clave_operacion'], { unique: true, name: 'uq_pago_clave' });
        await queryInterface.addIndex('pago_compra', ['metodo', 'cuenta_destino', 'id_externo'], { unique: true, name: 'uq_pago_externo' });
        await queryInterface.addIndex('pago_compra', ['metodo', 'cuenta_destino', 'referencia_externa'], { unique: true, name: 'uq_pago_referencia' });
        await queryInterface.addIndex('pago_compra', ['id_compra', 'estado'], { name: 'ix_pago_compra_estado' });
        await queryInterface.sequelize.query('ALTER TABLE pago_compra ADD CONSTRAINT chk_pago_importes CHECK (importe > 0 AND importe_pasarela > 0)');
        await queryInterface.sequelize.query("ALTER TABLE pago_compra ADD CONSTRAINT chk_pago_confirmacion CHECK ((estado = 'CONFIRMADO' AND referencia_externa IS NOT NULL AND fecha_confirmacion IS NOT NULL AND fecha_verificacion IS NOT NULL) OR (estado <> 'CONFIRMADO' AND fecha_confirmacion IS NULL))");
    },
    async down(queryInterface) {
        // Un rollback no está autorizado a destruir historial financiero.
        const [rows] = await queryInterface.sequelize.query('SELECT COUNT(*) AS cantidad FROM pago_compra');
        if (String(rows[0].cantidad) !== '0') throw new Error('No se puede retirar la tabla: contiene historial de pagos');
        await queryInterface.dropTable('pago_compra');
    }
};
