import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as contactController from './contact.controller.js';
import { createContactSchema, validate } from './contact.validator.js';

const router: Router = Router();

const contactLimiter = rateLimit({
	windowMs: 60 * 60 * 1000,
	max: 3,
	standardHeaders: true,
	legacyHeaders: false,
	message: {
		success: false,
		error: 'Too many contact requests from this IP. Please try again later.',
	},
});

router.post('/', contactLimiter, validate(createContactSchema), contactController.submitContact);

export default router;
