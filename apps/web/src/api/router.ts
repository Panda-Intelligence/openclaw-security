import { Hono } from 'hono';
import type { Env } from '../worker.js';
import { scanRoutes } from './scans.js';
import { reportRoutes } from './reports.js';
import { communityRoutes } from './community.js';

export const router = new Hono<{ Bindings: Env }>();

router.route('/scans', scanRoutes);
router.route('/reports', reportRoutes);
router.route('/community', communityRoutes);
