const express = require('express');
const router = express.Router();
const controller = require('../controllers/index')

router.get('/photobook/preview', controller.createPreview);
router.get('/photobook/render', controller.renderBook);
router.get('/health/status', controller.healthStatus);

module.exports = router;