import { Hono } from 'hono';
import type { Env } from '../worker';
import { communityRoutes } from './community';
import { reportRoutes } from './reports';
import { scanRoutes } from './scans';

export const router = new Hono<{ Bindings: Env }>();

router.route('/scans', scanRoutes);
router.route('/reports', reportRoutes);
router.route('/community', communityRoutes);
