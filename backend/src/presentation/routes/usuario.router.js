import { Router } from "express";
import { usuarioController } from "../controllers/usuario.controller.js";

export const usuarioRouter = Router();

usuarioRouter.post('/', usuarioController.createUsuario);