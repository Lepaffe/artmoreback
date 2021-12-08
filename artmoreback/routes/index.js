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

/* Artwork Screen */

router.post('/add-artworklist', async function (req, res, next) {
  // update le tableau "artworkList" dans le model user afin d'ajouter l'object ID d'une oeuvre dans la base de donnée
  var result = await UserModel.updateOne({ token: req.body.token }, { $push: { artworkList: { _id: req.body.artworkId } } })
  console.log(result)
  res.json({ artwordSaved: true });
});

/* Collection Screen */

router.get('/get-collection', async function (req, res, next) {
  // lire tout le ArtwordkModel 
  var collection = await UserModel.findOne({ token: "qUCUV4u7XabXzg5VX3pfZOAMazHD9ZDV" }).populate('artworkList')
  res.json({ collection });
});

/* Collection Screen */

router.get('/get-artist-collection', async function (req, res, next) {
  // lire tout le ArtwordkModel 
  var artistCollection = await UserModel.findOne({ token: "qUCUV4u7XabXzg5VX3pfZOAMazHD9ZDV" }).populate('artistList')
  res.json({ artistCollection });
});

router.post('/like', async function (req, res, next) {
  //si l'oeuvre est deja liké on ne la rajoute pas
  let alreadyIn = await UserModel.findOne({ token: req.body.token, artworkLiked: { $in: req.body.artworkId } })
  if (!alreadyIn) {
    console.log(req.body.token, req.body.artworkId);
    var result = await UserModel.updateOne({ token: req.body.token }, { $push: { artworkLiked: { _id: req.body.artworkId } } })
  }
  console.log('result', result, alreadyIn);
  res.json({ result })
})

router.post('/dislike', async function (req, res, next) {
  //si l'oeuvre est deja dans les Disliked on ne la rajoute pas
  let alreadyIn = await UserModel.findOne({ token: req.body.token, artworkDisliked: { $in: req.body.artworkId } })

  if (!alreadyIn) {
    //on azjoute l'oeuvre aux Disliked
    console.log('in ', req.body.token, req.body.artworkId);
    var result = await UserModel.updateOne({ token: req.body.token }, { $push: { artworkDisliked: { _id: req.body.artworkId } } })
    //on verifie que l'oeuvre n'etait pas dans les Liked
    let isLiked = await UserModel.findOne({ token: req.body.token, artworkLiked: { $in: req.body.artworkId } });
    //on verifie que l'oeuvre n'est pas deja dans les Liked si oui on la retire des liked 
    if (isLiked) {
      var result2 = await UserModel.updateOne({ token: req.body.token }, { $pull: { artworkLiked: { $in: req.body.artworkId } } })
    }
  }
  console.log('result', result, 'result2', result2)
  res.json({ result })
})

/* Artist Screen */

router.get('/get-artist-detail/:artworkId', async function (req, res, next) {
  // lire le ArtistModel en filtrant avec l'id de l'artiste et populate avec ses oeuvres
  const artworkId = req.params.artworkId;
  var artist = await ArtistModel.findOne({ artistArtwork: { $in: artworkId } }).populate('artistArtwork')
  res.json({ artist });
});

router.post('/add-artistlist', async function (req, res, next) {
  console.log("coucou")
  // update le tableau "artworkList" dans le model user afin d'ajouter l'object ID d'une oeuvre dans la base de donnée
  var result2 = await UserModel.updateOne({ token: req.body.token }, { $push: { artistList: { _id: req.body.artistId } } })
  console.log(result2)
  res.json({ artistSaved: true });
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

//Daily selection

router.get('/get-daily-selection/:token', async function (req, res, next) {

  const user = await UserModel.findOne({ token: req.params.token })

  //on récupère les mouvements favoris de l'user
  const userMovements = user.movements;

  //on récupère toutes les oeuvres qui possèdent un des mouvements pref de l'user (par exemple toutes les oeuvres Abstract)
  let artworks = await ArtworkModel.find({ category: userMovements[0] })

  //on modifie l'ordre des éléments dans le tableau artworks pour avoir des artists différents
  const shuffleArray = array => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = array[i];
      array[i] = array[j];
      array[j] = temp;
    }
    return array;
  }

  artworks = shuffleArray(artworks)

  //on n'en prend que 4 (à essayer avec un user qui a seulement Abstract dans ses mouvements pref pour le moment)
  artworks.splice(4)

  //pour chaque oeuvre de notre tableau, on récupère l'artiste (j'ai fait sans map() pour le moment histoire de bien comprendre)
  const artist0 = await ArtistModel.findOne({ artistArtwork: { $in: artworks[0]._id } }).populate('artistArtwork')
  const artist1 = await ArtistModel.findOne({ artistArtwork: { $in: artworks[1]._id } }).populate('artistArtwork')
  const artist2 = await ArtistModel.findOne({ artistArtwork: { $in: artworks[2]._id } }).populate('artistArtwork')
  const artist3 = await ArtistModel.findOne({ artistArtwork: { $in: artworks[3]._id } }).populate('artistArtwork')

  //on créé le tableau qui sera renvoyé au front, où chaque élément est un objet qui contient l'oeuvre avec l'artiste qui lui correspond
  const artworksWithArtists = [{ artwork: artworks[0], artist: artist0 }, { artwork: artworks[1], artist: artist1 },
  { artwork: artworks[2], artist: artist2 }, { artwork: artworks[3], artist: artist3 }]

  res.json({ artworksWithArtists });
});

module.exports = router;
