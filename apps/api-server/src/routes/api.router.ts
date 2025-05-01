import express, { Router } from 'express';
import { createProject, deployProject } from '../controller/api.controller';

const router: Router = express.Router();

// POST Requests
router.post('/create-project', createProject);
router.post('/deploy-project', deployProject);

export default router;