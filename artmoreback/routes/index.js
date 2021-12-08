var express = require('express');
var router = express.Router();

/* Require Models*/
var ArtistModel = require('../models/artists')
var ArtworkModel = require('../models/artworks')
var UserModel = require('../models/users')

/* sécuriser app*/
var bcrypt = require('bcrypt');
var uid2 = require('uid2');

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', { title: 'Express' });
});

/* Swipe page. */
router.get('/get-artwork-list', async function (req, res, next) {
  // lire tout le ArtwordkModel 
  var artworks = await ArtworkModel.find()
  res.json({ artworks });
});

router.post('/like', async function (req,res,next){
  //si l'oeuvre est deja liké on ne la rajoute pas
  let alreadyIn = await UserModel.findOne({token: req.body.token, artworkLiked:{$in: req.body.artworkId}})
  if (!alreadyIn){
    console.log( req.body.token, req.body.artworkId);
    var result = await UserModel.updateOne({token: req.body.token}, { $push: {artworkLiked:{_id: req.body.artworkId}}})
  } 
  console.log ('result', result, alreadyIn);
  res.json({result})
})

router.post('/dislike', async function (req,res,next){
  //si l'oeuvre est deja dans les Disliked on ne la rajoute pas
  let alreadyIn = await UserModel.findOne({token: req.body.token, artworkDisliked:{$in: req.body.artworkId}})
  
  if (!alreadyIn){
    //on azjoute l'oeuvre aux Disliked
    console.log( 'in ',req.body.token, req.body.artworkId);
    var result = await UserModel.updateOne({token: req.body.token}, { $push: { artworkDisliked:{_id: req.body.artworkId}}})
    //on verifie que l'oeuvre n'etait pas dans les Liked
    let isLiked = await UserModel.findOne({token: req.body.token, artworkLiked:{$in: req.body.artworkId}});
    //on verifie que l'oeuvre n'est pas deja dans les Liked si oui on la retire des liked 
    if (isLiked){
      var result2 = await UserModel.updateOne({token: req.body.token}, { $pull: {artworkLiked:{$in: req.body.artworkId}}})
    }
  } 
  console.log('result', result, 'result2',result2 )
  res.json({result})
})

/* Artist Screen */

router.get('/get-artist-detail/:artworkId', async function (req, res, next) {
  // lire le ArtistModel en filtrant avec l'id de l'artiste et populate avec ses oeuvres
  const artworkId = req.params.artworkId;
  var artist = await ArtistModel.findOne({ artistArtwork: { $in: artworkId } }).populate('artistArtwork')
  res.json({ artist });
});

/* Login Screen */
router.post('/sign-up', async function (req, res, next) {

  var error = []
  var result = false
  var saveUser = null
  var token = null

  const data = await UserModel.findOne({
    email: req.body.email
  })

  if (data != null) {
    error.push('Cet e-mail est déjà utilisé.')
  }

  if (req.body.firstName == ''
    || req.body.lastName == ''
    || req.body.email == ''
    || req.body.city == ''
    || req.body.birthday == ''
    || req.body.password == ''

  ) {
    error.push('Tous les champs doivent être remplis.')
  }

  if (error.length == 0) {

    var hash = bcrypt.hashSync(req.body.password, 10);
    var newUser = new UserModel({
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      city: req.body.city,
      birthday: Date.parse(req.body.birthday),
      mediums: JSON.parse(req.body.mediums),
      movements: JSON.parse(req.body.movements),
      expos: [],
      email: req.body.email,
      artistList: [],
      artworkList: [],
      password: hash,
      token: uid2(32),
    })

    saveUser = await newUser.save()


    if (saveUser) {
      result = true
      token = saveUser.token
    }
  }
  res.json({ result, error, token })
})

router.post('/sign-in', async function (req, res, next) {

  var result = false
  var user = null
  var error = []
  var token = null

  if (req.body.email == ''
    || req.body.password == ''
  ) {
    error.push('Tous les champs doivent être remplis.')
  }

  if (error.length == 0) {
    user = await UserModel.findOne({
      email: req.body.email,
    })


    if (user) {
      if (bcrypt.compareSync(req.body.password, user.password)) {
        result = true
        token = user.token
      } else {
        result = false
        error.push('Mot de passe incorrect')
      }
    } else {
      error.push('Mail incorrect')
    }
  }
  console.log(token)
  res.json({ result, error, token })
})


module.exports = router;
