const mongoose = require('mongoose');

const Store = mongoose.model('Store');
// multer handle photo upload request
const multer = require('multer');
const jimp = require('jimp');
const uuid = require('uuid');

// read photo into storage and check that allowed type of file to be uploaded
const multerOptions = {
  storage: multer.memoryStorage(),
  fileFilter(req, file, next) {
    const isPhoto = file.mimetype.startsWith('image/');
    if (isPhoto) {
      next(null, true);
    } else {
      next({ message: "That filetype isn't allowed!" }, false);
    }
  }
};

exports.homePage = (req, res) => {
  console.log(req.name);
  res.render('index');
};

exports.addStore = (req, res) => {
  res.render('editStore', { title: 'Add Store' });
};

// middleware that reads photo into memory
exports.upload = multer(multerOptions).single('photo');

// save image, recording file name and passing along to createStore
exports.resize = async (req, res, next) => {
  // check if no new file to resize (multer will add new file to the req)
  if (!req.file) {
    next(); // skip to the next middleware
    return;
  }
  const extension = req.file.mimetype.split('/')[1];
  // add photo name to req.body
  req.body.photo = `${uuid.v4()}.${extension}`;
  // now we resize
  const photo = await jimp.read(req.file.buffer);
  await photo.resize(800, jimp.AUTO);
  await photo.write(`./public/uploads/${req.body.photo}`);
  // once we have written the photo to our filesystem, keep going!
  next();
};

exports.createStore = async (req, res) => {
  // take id of currently logged in user and put in author field
  req.body.author = req.user._id;

  const store = await new Store(req.body).save(); // so we get back the slug
  req.flash(
    'success',
    `Successsfully Created ${store.name}. Care to leave a review?`
  );
  res.redirect(`/store/${store.slug}`);
};

exports.getStores = async (req, res) => {
  // 1. Query the database for a list of all stores
  const stores = await Store.find();
  // sends stores to the template
  res.render('stores', { title: 'Stores', stores });
};

const confirmOwner = (store, user) => {
  // .equals method comes along, author is type Object with id string
  if (!store.author.equals(user._id)) {
    throw Error('You must own a store in order to edit it');
  }
};

exports.editStore = async (req, res) => {
  // 1. Find the store given the ID
  const store = await Store.findOne({ _id: req.params.id });
  // 2. confirm they are the owner of the store
  confirmOwner(store, req.user);
  // 3. render out the edit form so the user can update their store
  res.render('editStore', { title: `Edit ${store.name}`, store });
};

exports.updateStore = async (req, res) => {
  // need to set the location data to be a point when updating
  // using findOneAndUpdate, the defaults do not kick in
  req.body.location.type = 'Point';
  // find and update the store
  const store = await Store.findOneAndUpdate({ _id: req.params.id }, req.body, {
    new: true, // return the new store instead of the old one
    runValidators: true
    // setDefaultsOnInsert: true - this line would allow us to remove setting the location type above
  }).exec();
  // redirect them to the store and tell them it worked
  req.flash(
    'success',
    `Successfully updated <strong>${store.name}</strong>. <a href="/store/${
      store.slug
    }">View Store ➔</a>`
  );
  res.redirect(`/stores/${store._id}/edit`);
};

exports.getStoreBySlug = async (req, res, next) => {
  // 1. query DB and find store by slug
  // .populate('author') will go off an find document associated with that id on author feild
  const store = await Store.findOne({ slug: req.params.slug }).populate(
    'author'
  );
  // 2. check if no store - render out a 404 using middleware
  if (!store) return next();
  // 3. render out store template
  res.render('store', { title: `${store.name}`, store });
};

exports.getStoresByTags = async (req, res, next) => {
  const { tag } = req.params;

  // if no tag fallback is a query that would return any store that has a tag property on it
  const tagQuery = tag || { $exists: true };

  // run static function living on Store model, defined in Store model
  const tagsPromise = Store.getTagsList();
  const storePromise = Store.find({ tags: tagQuery });

  // can now wait for multiple independent promises to come back
  const [tags, stores] = await Promise.all([tagsPromise, storePromise]);

  res.render('tag', { tags, title: 'Tags', tag, stores });
};

exports.searchStores = async (req, res) => {
  const stores = await Store
    // first find the stores that match
    .find(
      {
        $text: {
          $search: req.query.q
        }
      },
      {
        score: { $meta: 'textScore' } // add meta data: text score based on search
      }
    )
    // sort them
    .sort({
      score: { $meta: 'textScore' } // sort based on that meta data score
    })
    // limit to only 5 results
    .limit(5);
  res.json(stores);
};

exports.mapStores = async (req, res) => {
  const coordinates = [req.query.lng, req.query.lat].map(parseFloat);
  const q = {
    location: {
      // operator in mongodb that will search for near
      $near: {
        $geometry: {
          type: 'Point',
          coordinates
        },
        $maxDistance: 10000 // 10km
      }
    }
  };

  const stores = await Store.find(q)
    .select('slug name description location')
    .limit(10); // select only certain fields to bring back and limit on 10 closest stores
  res.json(stores);
};
