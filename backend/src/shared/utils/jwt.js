import jwt from 'jsonwebtoken';

export const generarToken = ({ idUsuario, idRol }) => {

    return jwt.sign(
        {
            idUsuario,
            idRol
        },
        process.env.JWT_SECRET,
        {
            expiresIn: '8h'
        }
    );

};

export const verificarToken = (token) => {
    return jwt.verify(
        token,
        process.env.JWT_SECRET
    );
};
