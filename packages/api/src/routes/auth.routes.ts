import { Router } from 'express';
import { register, login, refreshAccessToken } from '../controllers/auth.controller.js';

const router = Router();

/** POST /api/auth/register - Register a new user */
router.post('/register', register);

/** POST /api/auth/login - Login with email & password */
router.post('/login', login);

/** POST /api/auth/refresh - Refresh access token */
router.post('/refresh', refreshAccessToken);

export default router;
