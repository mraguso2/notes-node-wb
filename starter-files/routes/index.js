const express = require('express');

const router = express.Router();
const storeController = require('../controllers/storeController');

// fn composition to handle errors with asnyc/await
const { catchErrors } = require('../handlers/errorHandlers');

// Do work here - shell off work to controllers folder. Just put routes in here
router.get('/', catchErrors(storeController.getStores));
router.get('/stores', catchErrors(storeController.getStores));
router.get('/add', storeController.addStore);

router.post('/add',
  storeController.upload,
  catchErrors(storeController.resize),
  catchErrors(storeController.createStore)
);

router.post('/add/:id',
  storeController.upload,
  catchErrors(storeController.resize),
  catchErrors(storeController.updateStore)
);

router.get('/stores/:id/edit', catchErrors(storeController.editStore));

router.get('/store/:slug', catchErrors(storeController.getStoreBySlug));

module.exports = router;
