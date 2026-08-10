// src/routes/public-property.routes.ts
//
// No authenticateJWT here on purpose -- these endpoints back the public
// customer website (chestoneproperties.com), which has no login. Field
// exposure and area/status scoping are enforced in the controller itself
// via an explicit `select`, not by an auth check.
import { Router } from 'express';
import { listPublicProperties, getPublicProperty } from '../controllers/public-property.controller';

const router = Router();

router.get('/', listPublicProperties);
router.get('/:id', getPublicProperty);

export default router;
