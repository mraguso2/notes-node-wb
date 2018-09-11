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
  }
});

// run function before save
storeSchema.pre('save', function slugIt(next) {
  // don't want to run this everytime - check if name is modified
  if (!this.isModified('name')) {
    next(); // skip it
    return; // stop this function from running
  }
  this.slug = slug(this.name);
  next();
  // TODO make more resilient so slugs are unique
});

module.exports = mongoose.model('Store', storeSchema);