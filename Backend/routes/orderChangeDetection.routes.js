const express = require('express');
const router = express.Router();
const controller = require('../controllers/orderChangeDetection.controller');

router.get('/summary', controller.getChangeSummary);
router.get('/:pc', controller.getOrderChanges);
router.post('/:pc/acknowledge', controller.acknowledgeOrderChanges);

module.exports = router;
