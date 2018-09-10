const express = require('express');

const router = express.Router();
const storeController = require('../controllers/storeController');

// fn composition to handle errors with asnyc/await
const { catchErrors } = require('../handlers/errorHandlers');

// Do work here - shell off work to controllers folder. Just put routes in here
router.get('/', catchErrors(storeController.getStores));
router.get('/stores', catchErrors(storeController.getStores));
router.get('/add', storeController.addStore);
router.post('/add', catchErrors(storeController.createStore));
router.post('/add/:id', catchErrors(storeController.updateStore));
router.get('/stores/:id/edit', catchErrors(storeController.editStore));

module.exports = router;
