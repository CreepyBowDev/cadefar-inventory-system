import db from '../models/index.js';

const { Usuario, Rol } = db;

const usuarioPublicAttributes = [
    'id_usuario',
    'id_rol',
    'nombre_usuario',
    'correo',
    'estado'
];

const rolInclude = {
    model: Rol,
    as: 'rol',
    attributes: ['id_rol', 'nombre', 'descripcion', 'estado']
};

export class usuarioRepository {
    static async findByNombreUsuario({
        nombreUsuario,
        transaction = undefined,
        lock = false
    }) {
        const options = {
            where: {
                nombre_usuario: nombreUsuario
            },
            transaction
        };

        if (transaction && lock) {
            options.lock = transaction.LOCK.UPDATE;
        }

        return Usuario.findOne(options);
    }

    static async findAllUsuarios() {
        return Usuario.findAll({
            attributes: usuarioPublicAttributes,
            include: [rolInclude],
            order: [['id_usuario', 'ASC']]
        });
    }

    static async findById({ idUsuario, transaction = undefined }) {
        return Usuario.findByPk(idUsuario, {
            attributes: usuarioPublicAttributes,
            include: [rolInclude],
            transaction
        });
    }

    static async findByIdForUpdate({ idUsuario, transaction }) {
        // Bloquear solo Usuario, sin incluir Rol ni otras asociaciones.
        return Usuario.findByPk(idUsuario, {
            attributes: [...usuarioPublicAttributes, 'version_credenciales'],
            transaction,
            lock: transaction.LOCK.UPDATE
        });
    }

    static async findByCorreo({ correo, transaction = undefined }) {
        return Usuario.findOne({
            attributes: ['id_usuario'],
            where: { correo },
            transaction
        });
    }

    static async findByIdForRecovery({ idUsuario, transaction }) {
        return Usuario.findByPk(idUsuario, {
            attributes: ['id_usuario', 'correo', 'estado', 'version_credenciales'],
            transaction,
            lock: transaction.LOCK.UPDATE,
            logging: false
        });
    }

    static async findByIdForSession({ idUsuario }) {
        return Usuario.findByPk(idUsuario, {
            attributes: ['id_usuario', 'id_rol', 'nombre_usuario', 'estado', 'version_credenciales']
        });
    }

    static async findByIdWithPassword({ idUsuario, transaction = undefined, lock = false }) {
        const options = {
            attributes: [
                'id_usuario',
                'id_rol',
                'estado',
                'password_hash',
                'version_credenciales'
            ],
            transaction
        };
        if (transaction && lock) options.lock = transaction.LOCK.UPDATE;
        return Usuario.findByPk(idUsuario, options);
    }

    static async findRolById({ idRol, transaction = undefined }) {
        return Rol.findByPk(idRol, { transaction });
    }

    static async createUsuario({ idRol, nombreUsuario, passwordHash, correo = null }) {
        return Usuario.create({
            id_rol: idRol,
            nombre_usuario: nombreUsuario,
            password_hash: passwordHash,
            correo
        });
    }

    static async updateUsuario({ idUsuario, idRol, nombreUsuario, correo, transaction = undefined }) {
        const values = {};

        if (idRol !== undefined) {
            values.id_rol = idRol;
        }

        if (nombreUsuario !== undefined) {
            values.nombre_usuario = nombreUsuario;
        }

        if (correo !== undefined) {
            values.correo = correo;
        }

        return Usuario.update(values, {
            where: { id_usuario: idUsuario },
            transaction
        });
    }

    static async updateEstado({ idUsuario, estado }) {
        return Usuario.update(
            { estado },
            { where: { id_usuario: idUsuario } }
        );
    }

    static async updatePassword({ idUsuario, passwordHash, versionCredenciales, transaction }) {
        return Usuario.update(
            {
                password_hash: passwordHash,
                version_credenciales: versionCredenciales,
                intentos_fallidos_login: 0,
                bloqueado_hasta: null
            },
            { where: { id_usuario: idUsuario }, transaction, logging: false }
        );
    }

    static async updateLoginSecurity({
        idUsuario,
        intentosFallidosLogin,
        bloqueadoHasta,
        transaction
    }) {
        return Usuario.update(
            {
                intentos_fallidos_login: intentosFallidosLogin,
                bloqueado_hasta: bloqueadoHasta
            },
            {
                where: { id_usuario: idUsuario },
                transaction
            }
        );
    }
}
