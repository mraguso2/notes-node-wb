const mongoose = require('mongoose');
const slug = require('slugs');

mongoose.Promise = global.Promise;

// do all data normalization as close to model as possible (ex trim)
const storeSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
    required: 'Please enter a store name!' // instead of Boolean, set the error message if not filled out
  },
  slug: String,
  description: {
    type: String,
    trim: true
  },
  tags: [String], // array of Strings
  created: {
    type: Date,
    default: Date.now
  },
  location: {
    type: {
      type: String,
      default: 'Point'
    },
    coordinates: [{
      type: Number,
      required: 'You must supply coordinates!'
    }],
    address: {
      type: String,
      required: 'You must supply an address, bitch!'
    }
  },
  photo: String
});

// run function before save
storeSchema.pre('save', async function slugIt(next) {
  // don't want to run this everytime - check if name is modified
  if (!this.isModified('name')) {
    next(); // skip it
    return; // stop this function from running
  }
  this.slug = slug(this.name);

  // find other stores that have same slugs mike, mike-1, mike-2
  const slugRegEx = new RegExp(`^(${this.slug})((-[0-9]*$)?)$`, 'i');
  const storesWithSlug = await this.constructor.find({ slug: slugRegEx });

  if (storesWithSlug.length) {
    this.slug = `${this.slug}-${storesWithSlug.length + 1}`;
  }

  next();
});

storeSchema.statics.getTagsList = function getTags() {
  // $ means it is a field
  return this.aggregate([
    { $unwind: '$tags' },
    { $group: { _id: '$tags', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
};

module.exports = mongoose.model('Store', storeSchema);