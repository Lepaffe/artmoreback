var express = require('express');
var router = express.Router();
var uniqid = require('uniqid');
var fs = require('fs');

var cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: 'cloudcapsule',
  api_key: '441832217349769',
  api_secret: '_V8FyVznkjQyNY3EApQmumUVK2Q'
});

/* Appel API*/
var request = require('sync-request');

/* Require Models*/
var ArtistModel = require('../models/artists')
var ArtworkModel = require('../models/artworks')
var UserModel = require('../models/users')

// import du module de reommandation
var Recommend = require('../mymodules/recommend');

/* sécuriser app*/
var bcrypt = require('bcrypt');
var uid2 = require('uid2');

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', { title: 'Express' });
});

/* Swipe page. */
router.get('/get-artwork-list/:token', async function (req, res, next) {
  // appel de l'algo de selection 
  var artworkSelections = await Recommend(req.params.token);
  console.log('result', artworkSelections);

  res.json({ artworks: artworkSelections.swipeArray });
});

/* Artwork Screen */

router.post('/add-artworklist', async function (req, res, next) {
  // update le tableau "artworkList" dans le model user afin d'ajouter l'object ID d'une oeuvre dans la base de donnée
  let alreadyAdded = await UserModel.findOne({ token: req.body.token, artworkList: { $in: req.body.artworkId } })
  console.log("already", alreadyAdded)
  if (!alreadyAdded) {
    var result = await UserModel.updateOne({ token: req.body.token }, { $push: { artworkList: { _id: req.body.artworkId } } })
  }
  console.log(result)
  res.json({ artwordSaved: true });
});

router.post('/delete-artworklist', async function (req, res, next) {

  // supprime un element de l'array artworkList du ModelUser dans la base de donnée
  var result3 = await UserModel.updateOne({ token: req.body.token }, { $pull: { artworkList: { $in: req.body.artworkId } } })
  console.log(result3)
  res.json({ artworkDeleted: true });
});



/* Collection Screen */

router.get('/get-collection/:token', async function (req, res, next) {
  // Récuperer la clé étrangère artworkList du UserModel en filtrant avec son token
  var collection = await UserModel.findOne({ token: req.params.token }).populate('artworkList')
  res.json({ collection });
});

/* Collection Artist Screen */

router.get('/get-artist-collection/:token', async function (req, res, next) {
  // Récuperer la clé étrangère artistList du UserModel en filtrant avec son token
  var artistCollection = await UserModel.findOne({ token: req.params.token }).populate('artistList')
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
  let alreadyAdded = await UserModel.findOne({ token: req.body.token, artistList: { $in: req.body.artworkId } })
  if (!alreadyAdded) {
    // update le tableau "artist" dans le model user afin d'ajouter l'object ID d'une oeuvre dans la base de donnée
    var result2 = await UserModel.updateOne({ token: req.body.token }, { $push: { artistList: { _id: req.body.artistId } } })
  }
  console.log(result2)
  res.json({ artistSaved: true });
});

router.post('/delete-artistlist', async function (req, res, next) {

  // supprime un element de l'array artistList du ModelUser dans la base de donnée
  var result3 = await UserModel.updateOne({ token: req.body.token }, { $pull: { artistList: { $in: req.body.artistId } } })
  console.log(result3)
  res.json({ artistDeleted: true });
});

/* Login Screen */
router.post('/sign-up', async function (req, res, next) {

  var error = []
  var result = false
  var saveUser = null
  var token = null
  var artistList = []
  var artworkList = []


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
      categories: JSON.parse(req.body.categories),
      img: 'https://media.istockphoto.com/vectors/avatar-icon-design-for-man-vector-id648229964?k=20&m=648229964&s=170667a&w=0&h=Rsy2ka_Mb6xutzNLNgCyWjAHuLw4K8F_JjeTcFOHdfQ=',
      expos: [],
      email: req.body.email,
      artistList: [],
      artworkList: [],
      password: hash,
      token: uid2(32),
      daily: { day: -1, selection: [] }
    })

    saveUser = await newUser.save()


    if (saveUser) {
      result = true
      token = saveUser.token
    }
  }
  res.json({ result, error, token, artistList, artworkList })
})

router.post('/sign-in', async function (req, res, next) {

  var result = false
  var user = null
  var error = []
  var token = null
  var artistList = []
  var artworkList = []

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
        artistList = user.artistList
        artworkList = user.artworkList
      } else {
        result = false
        error.push('Mot de passe incorrect')
      }
    } else {
      error.push('Mail incorrect')
    }
  }
  console.log(token)
  res.json({ result, error, token, artistList, artworkList })
})

/* Get exhibitions list Screen */

router.get('/get-exhibitions/:token', async function (req, res, next) {

  //on récupère le token pour filtrer par la suite les résultats selon la ville du user
  let user = await UserModel.findOne({ token: req.params.token })
  const userCity = user.city
  console.log(userCity)

  // on récupère toutes les expositions
  var data = request('GET', `https://public.opendatasoft.com/api/records/1.0/search/?dataset=evenements-publics-cibul&q=&rows=105&facet=tags&facet=placename&facet=department&facet=region&facet=city&facet=date_start&facet=date_end&facet=pricing_info&facet=updated_at&facet=city_district&refine.tags=exposition&refine.date_end=2022`)
  var dataParse = JSON.parse(data.body)

  // fonction pour reformater la date
  var dateFormat = function (date) {
    var newDate = new Date(date)
    var format = (newDate.getMonth() + 1) + "." + newDate.getDate() + "." + newDate.getFullYear()
    return format;
  };

  // on map pour récupérer que les infos nécessaires
  let listExpoBack = dataParse.records.map(el => {
    return {
      img: el.fields.image,
      title: el.fields.title,
      city: el.fields.city,
      place: el.fields.placename,
      address: el.fields.address,
      date_start: dateFormat(el.fields.date_start),
      date_end: dateFormat(el.fields.date_end)
    }
  })

  res.json({ listExpoBack, userCity })
})

router.post('/add-exhibitions/:token', async function (req, res, next) {

  let result = false;

  result = await UserModel.updateOne({ token: req.body.token }, { $push: { expos: { title: req.body.title, place: req.body.place, address: req.body.address, date_start: req.body.date_start, date_end: req.body.date_end, city: req.body.city, img: req.body.img } } })

  if (result.modifiedCount != 0) {
    result = true
  };

  const user = await UserModel.findOne({ token: req.body.token })
  const addedExpo = user.expos[user.expos.length - 1]

  res.json({ result, addedExpo });
});

router.delete('/delete-exhibitions/:token/:title', async function (req, res, next) {

  let result = false;

  result = await UserModel.updateOne({ token: req.params.token }, { $pull: { expos: { title: req.params.title } } })

  if (result.modifiedCount != 0) {
    result = true
  };

  res.json({ result });
});

router.get('/get-my-exhibitions/:token', async function (req, res, next) {
  // Récuperer la clé étrangère artistList du UserModel en filtrant avec son token
  var user = await UserModel.findOne({ token: req.params.token })
  var userExpoList = user.expos
  res.json({ userExpoList });
});


//Daily selection

router.get('/get-daily-selection/:token', async function (req, res, next) {

  // appel de l'algo de selection 
  var artworkSelections = await Recommend(req.params.token);

  //const user = await UserModel.findOne({ token: req.params.token })

  //on récupère les mouvements favoris de l'user
  //const userCategories = user.categories;

  //on récupère toutes les oeuvres qui possèdent un des mouvements pref de l'user (par exemple toutes les oeuvres Abstract)
  //let artworks = await ArtworkModel.find({ category: userCategories[0] })

  //on modifie l'ordre des éléments dans le tableau artworks pour avoir des artists différents
  // const shuffleArray = array => {
  //   for (let i = array.length - 1; i > 0; i--) {
  //     const j = Math.floor(Math.random() * (i + 1));
  //     const temp = array[i];
  //     array[i] = array[j];
  //     array[j] = temp;
  //   }
  //   return array;
  // }

  //artworks = shuffleArray(artworks)

  //on n'en prend que 4 (à essayer avec un user qui a seulement Abstract dans ses mouvements pref pour le moment)
  //artworks.splice(4)

  //pour chaque oeuvre de notre tableau, on récupère l'artiste (j'ai fait sans map() pour le moment histoire de bien comprendre)
  const artist0 = await ArtistModel.findOne({ artistArtwork: { $in: artworkSelections.dailyArray[0]._id } }).populate('artistArtwork')
  const artist1 = await ArtistModel.findOne({ artistArtwork: { $in: artworkSelections.dailyArray[1]._id } }).populate('artistArtwork')
  const artist2 = await ArtistModel.findOne({ artistArtwork: { $in: artworkSelections.dailyArray[2]._id } }).populate('artistArtwork')
  const artist3 = await ArtistModel.findOne({ artistArtwork: { $in: artworkSelections.dailyArray[3]._id } }).populate('artistArtwork')

  //on créé le tableau qui sera renvoyé au front, où chaque élément est un objet qui contient l'oeuvre avec l'artiste qui lui correspond
  const artworksWithArtists = [{ artwork: artworkSelections.dailyArray[0], artist: artist0 }, { artwork: artworkSelections.dailyArray[1], artist: artist1 },
  { artwork: artworkSelections.dailyArray[2], artist: artist2 }, { artwork: artworkSelections.dailyArray[3], artist: artist3 }]

  res.json({ artworksWithArtists });
});

// Profile screen

router.get('/get-username/:token', async function (req, res, next) {

  const user = await UserModel.findOne({ token: req.params.token })

  const firstName = user.firstName;
  const lastName = user.lastName;
  const img = user.img

  res.json({ firstName, lastName, img })
})

//Settings screen
router.get('/get-user-info/:token', async function (req, res, next) {

  const user = await UserModel.findOne({ token: req.params.token })

  const city = user.city;
  const email = user.email
  const mediums = user.mediums;
  const categories = user.categories;

  res.json({ city, email, mediums, categories })
})

router.put('/update-city/:token', async function (req, res, next) {

  await UserModel.updateOne({ token: req.params.token }, { city: req.body.city })
  const user = await UserModel.findOne({ token: req.params.token });
  const city = user.city

  res.json({ city })
})

router.put('/update-email/:token', async function (req, res, next) {

  await UserModel.updateOne({ token: req.params.token }, { email: req.body.email })
  const user = await UserModel.findOne({ token: req.params.token });
  const email = user.email

  res.json({ email })
})

router.put('/update-password/:token', async function (req, res, next) {

  let result = false;

  var hash = bcrypt.hashSync(req.body.password, 10);

  await UserModel.updateOne({ token: req.params.token }, { password: hash })
  const user = await UserModel.findOne({ token: req.params.token });

  if (user.password) {
    result = true
  }
  res.json({ result })
})

router.put('/update-categories/:token', async function (req, res, next) {

  await UserModel.updateOne({ token: req.params.token }, { categories: JSON.parse(req.body.categories) })
  const user = await UserModel.findOne({ token: req.params.token });
  const categories = user.categories
  res.json({ categories })
})

router.put('/update-mediums/:token', async function (req, res, next) {

  await UserModel.updateOne({ token: req.params.token }, { mediums: JSON.parse(req.body.mediums) })
  const user = await UserModel.findOne({ token: req.params.token });
  const mediums = user.mediums
  res.json({ mediums })
})

router.post('/update-avatar/:token', async function (req, res, next) {

  var pictureName = './tmp/' + uniqid() + '.jpg';
  var resultCopy = await req.files.avatar.mv(pictureName);

  if (!resultCopy) {
    var resultCloudinary = await cloudinary.uploader.upload(pictureName);
    await UserModel.updateOne({ token: req.params.token }, { img: resultCloudinary.url })
  }

  fs.unlinkSync(pictureName);

  const user = await UserModel.findOne({ token: req.params.token });
  const img = user.img

  res.json({ img })
})

module.exports = router;
