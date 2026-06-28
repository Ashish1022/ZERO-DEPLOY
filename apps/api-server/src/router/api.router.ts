import express, { Router } from 'express';

import { deployProject, getLogs } from '../controller/api.controller';

const router: Router = express.Router()

router.post('/deploy-project', deployProject);
router.get('/get-logs/:id', getLogs);

export default router