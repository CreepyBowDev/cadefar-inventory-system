import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { usuarioRouter } from './presentation/routes/usuario.router.js';
import { authRouter } from './presentation/routes/auth.router.js';
import { proveedorLaboratorioRouter } from './presentation/routes/proveedor-laboratorio.router.js';
import { medicamentoRouter } from './presentation/routes/medicamento.router.js';
import { principioActivoRouter } from './presentation/routes/principio-activo.router.js';
import { inventarioRouter } from './presentation/routes/inventario.router.js';
import { compraRouter } from './presentation/routes/compra.router.js';
import { ventaRouter } from './presentation/routes/venta.router.js';
import { reporteRouter } from './presentation/routes/reporte.router.js';
import { bitacoraAuditoriaRouter } from './presentation/routes/bitacora-auditoria.router.js';
import { errorHandler } from './presentation/middlewares/error.middleware.js';
import { auditoriaContextoMiddleware } from './presentation/middlewares/auditoria-contexto.middleware.js';
import { auditoriaAuthErrorMiddleware } from './presentation/middlewares/auditoria-auth-error.middleware.js';
import entorno from './shared/utils/pagos-entorno.cjs';
import { conexionLocal } from './presentation/middlewares/pagos-local.middleware.js';
import { AppError } from './shared/errors/app-error.js';

export const app = express();

app.use((req, res, next) => {
    if (entorno.esPruebaLocal() && !conexionLocal(req.socket.remoteAddress)) return res.sendStatus(403);
    next();
});

app.use(auditoriaContextoMiddleware);
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
    exposedHeaders: ['Content-Disposition', 'Retry-After']
}));

app.use(express.json());
app.use(cookieParser());
app.use((req, res, next) => {
    if (entorno.esPruebaLocal() && ((/^\/api\/usuarios(?:\/|$)/i.test(req.path) && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) ||
        /^\/api\/auth\/recuperacion(?:\/|$)/i.test(req.path))) {
        return next(new AppError('El entorno de pruebas no permite modificar cuentas ni contraseñas.', 409));
    }
    if (entorno.esPruebaLocal() && /^\/api\/auth\/login\/?$/i.test(req.path) && req.method === 'POST' &&
        req.get('Origin') !== process.env.FRONTEND_URL) {
        return next(new AppError('Origen de autenticación no permitido', 403));
    }
    next();
});

app.use('/api/usuarios', usuarioRouter);
app.use('/api/auth', authRouter);
app.use('/api/proveedores-laboratorios', proveedorLaboratorioRouter);
app.use('/api/medicamentos', medicamentoRouter);
app.use('/api/principios-activos', principioActivoRouter);
app.use('/api/inventario', inventarioRouter);
app.use('/api/compras', compraRouter);
app.use('/api/ventas', ventaRouter);
app.use('/api/reportes', reporteRouter);
app.use('/api/bitacora', bitacoraAuditoriaRouter);

app.use(auditoriaAuthErrorMiddleware);
app.use(errorHandler);
