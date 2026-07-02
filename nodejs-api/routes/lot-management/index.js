/**
 * Lot Management module router. Mounted (with authMiddleware) at /api/lot-management.
 */
const express = require("express");
const router = express.Router();

router.use(require("./registries"));
router.use(require("./lots"));
router.use(require("./coas"));
router.use(require("./labelTemplates"));
router.use(require("./labelPublish"));
router.use(require("./dashboard"));

module.exports = router;
