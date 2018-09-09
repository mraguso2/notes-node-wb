const express = require('express');
const router = express.Router();
const storeController = require('../controllers/storeController');

// Do work here - shell off work to controllers folder. Just put routes in here
router.get('/', storeController.myMiddleware, storeController.homePage);

module.exports = router;
