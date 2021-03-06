const mongoose = require('mongoose');

const Store = mongoose.model('Store');
const User = mongoose.model('User');
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
  req.flash('success', `Successsfully Created ${store.name}. Care to leave a review?`);
  res.redirect(`/store/${store.slug}`);
};

exports.getStores = async (req, res) => {
  const page = req.params.page || 1;
  const limit = 4;
  const skip = page * limit - limit; // to determine how many stores to skip

  // 1. Query the database for a list of all stores
  // populating reviews in storeController using .pre
  const storesPromise = Store.find()
    .skip(skip)
    .limit(limit)
    .sort({ created: 'desc' });

  // Able to query db for just a count of the documents
  const countPromise = Store.count();

  const [stores, count] = await Promise.all([storesPromise, countPromise]);

  const pages = Math.ceil(count / limit); // upper bound round up to handle non clean divison

  // handle if someone goes to a page number that no longer exists (say data changes)
  if (!stores.length && skip) {
    req.flash(
      'info',
      `Hey! You asked for page ${page}. However that page no longer exists. Redirecting to the last available page: page: ${pages}`
    );
    res.redirect(`/stores/page/${pages}`);
    return;
  }
  // sends stores to the template
  res.render('stores', { title: 'Stores', stores, count, page, pages });
};

const confirmOwner = (store, user) => {
  // .equals method comes along, author is type Object with id string
  if (!user || !store.author.equals(user._id)) {
    throw Error('You must own a store in order to edit it.');
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
  // .populate('author') will go off and find document associated with that id on author feild
  const store = await Store.findOne({ slug: req.params.slug }).populate('author reviews');
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
        $maxDistance: 20000 // 10km
      }
    }
  };

  const stores = await Store.find(q)
    .select('slug name description location photo')
    .limit(10); // select only certain fields to bring back and limit on 10 closest stores
  res.json(stores);
};

exports.mapPage = (req, res) => {
  res.render('map', { title: 'Map' });
};

exports.heartStores = async (req, res) => {
  // grab hearts from user and
  const hearts = req.user.hearts.map(obj => obj.toString());
  // find out if we need to add store or remove store based on if its already in hearts
  // there is a $push but we want to remove duplicates so we use addToSet
  const operator = hearts.includes(req.params.id) ? '$pull' : '$addToSet';
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { [operator]: { hearts: req.params.id } },
    { new: true } // return the new user object - without this, it would return the old one
  );
  res.json(user);
};

exports.getHearts = async (req, res) => {
  const stores = await Store.find({
    _id: { $in: req.user.hearts }
  });
  res.render('stores', { title: 'Hearted Stores', stores });
};

exports.getTopStores = async (req, res) => {
  // best to put complex queries on the model - below shell off to function getTopStores
  const stores = await Store.getTopStores();
  res.render('topStores', { stores, title: '⭐️ Top Stores!' });
};
