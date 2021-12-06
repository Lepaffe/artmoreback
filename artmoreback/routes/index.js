var express = require('express');
var router = express.Router();
/* Require Models*/
var ArtistModel = require('../models/artists')
var ArtworkModel = require('../models/artworks')
//var UserModel = require('../models/users')

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', { title: 'Express' });
});

/* Swipe page. */
router.get('/get-artwork-list', async function (req, res, next) {
  // lire tout le ArtwordkModel 
  var artworks = await ArtworkModel.find()
  console.log(artworks)
  res.json({ artworks });
});

/* Artist Screen */

router.get('/get-artist-detail/:artworkId', async function (req, res, next) {
  // lire le ArtistModel en filtrant avec l'id de l'artiste et populate avec ses oeuvres
  console.log(req.params.artworkId)
  var artist = await ArtistModel.findOne({ artistArtwork: { $elemMatch: { _id: req.params.artworkId } } }).populate('artistArtwork')
  console.log(artist)
  res.json({ artist });
});
module.exports = router;
