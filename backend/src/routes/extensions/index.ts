import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import investmentRoutes from './investment';
import physicalAssetRoutes from './physicalAsset';
import infrastructureRoutes from './infrastructure';
import fixedAssetRoutes from './fixedAsset';
import itAssetRoutes from './itAsset';
import digitalAssetRoutes from './digitalAsset';
import realEstateRoutes from './realEstate';
import governmentRoutes from './government';
import wealthRoutes from './wealth';
import naturalResourceRoutes from './naturalResource';

const router = Router();
router.use(authenticate);

router.use('/investment', investmentRoutes);
router.use('/physical', physicalAssetRoutes);
router.use('/infrastructure', infrastructureRoutes);
router.use('/fixed-asset', fixedAssetRoutes);
router.use('/it', itAssetRoutes);
router.use('/digital', digitalAssetRoutes);
router.use('/real-estate', realEstateRoutes);
router.use('/government', governmentRoutes);
router.use('/wealth', wealthRoutes);
router.use('/natural-resource', naturalResourceRoutes);

export default router;
