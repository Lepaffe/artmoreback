var express = require('express');
var router = express.Router();
/* Require Models*/
var ArtistModel = require('../models/artists')
var ArtworkModel = require('../models/artworks')
//var UserModel = require('../models/users')

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

/* Swipe page. */
router.get('/get-artwork-list/', async function(req, res, next) {
  // lire tout le ArtwordkModel 
var artworks = await ArtworkModel.find()
console.log(artworks)
  res.json({artworks});
});

/* Artist Screen */

router.get('/get-artist-detail', async function(req, res, next) {
  // lire le ArtistModel en filtrant avec l'id de l'artiste et populate avec ses oeuvres
  var artists = await ArtistModel.findById("61ade677b037517d8f9ae8b7").populate('artistArtwork')
    res.json({ artists });
  });
module.exports = router;
