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
  var artistCollection = await UserModel.findOne({ token: req.params.token })
    .populate({
      path: 'artistList',      //on populate dans userModel la artisList
      populate: {             // on lui dit de faire un deuxieme populate avec le path ArtistAtwork 
        path: 'artistArtwork'   // permet de faire un "populate de populate"
      }
    })
    .exec();

  console.log('artistCollection', artistCollection.artistList[0])
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
    //console.log('birthday', new Date(req.body.birthday));
    var hash = bcrypt.hashSync(req.body.password, 10);
    var newUser = new UserModel({
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      city: req.body.city,
      birthday: req.body.birthday,
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

/* Landing Screen - auto-logged in */

router.get('/auto-loggedIn/:token', async function (req, res, next) {

  var token = null
  var artistList = []
  var artworkList = []
  var result = false

  const user = await UserModel.findOne({ token: req.params.token })

  if (user) {
    token = user.token
    artistList = user.artistList
    artworkList = user.artworkList
    result = true
  }
  res.json({ result, token, artistList, artworkList })
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

router.get('/get-statistics/:token', async function (req, res, next) {

  const user = await UserModel.findOne({ token: req.params.token }).populate('artworkLiked').populate('artworkList')
  let noArtworksLiked = false;

  //on crée un tableau qui regroupe les oeuvres likées et les oeuvres mises en favoris
  const artworksLikedFav = user.artworkLiked.concat(user.artworkList)

  if (artworksLikedFav.length === 0) {
    noArtworksLiked = true;
  }

  //on filtre le tableau des oeuvres likées/fav qu'on vient de créer pour ne garder que ceux qui ont la catégorie souhaitée, 
  //puis on divise par la longueur du tableau d'oeuvres likées/fav pour avoir un pourcentage 

  const abstractCategoryPourcentage = Math.round(artworksLikedFav.filter(obj => obj.category === 'Abstract').length / artworksLikedFav.length * 100)
  const landscapePourcentage = Math.round(artworksLikedFav.filter(obj => obj.category === 'Landscape').length / artworksLikedFav.length * 100)
  const urbanPourcentage = Math.round(artworksLikedFav.filter(obj => obj.category === 'Urban').length / artworksLikedFav.length * 100)
  const portraitPourcentage = Math.round(artworksLikedFav.filter(obj => obj.category === 'Portrait').length / artworksLikedFav.length * 100)
  const monumentalPourcentage = Math.round(artworksLikedFav.filter(obj => obj.category === 'Monumental').length / artworksLikedFav.length * 100)
  const animalPourcentage = Math.round(artworksLikedFav.filter(obj => obj.category === 'Animal').length / artworksLikedFav.length * 100)
  const everydayLifePourcentage = Math.round(artworksLikedFav.filter(obj => obj.category === 'EverydayLife').length / artworksLikedFav.length * 100)
  const popArtCategoryPourcentage = Math.round(artworksLikedFav.filter(obj => obj.category === 'PopArt').length / artworksLikedFav.length * 100)
  const nudePourcentage = Math.round(artworksLikedFav.filter(obj => obj.category === 'Nude').length / artworksLikedFav.length * 100)
  const naturePourcentage = Math.round(artworksLikedFav.filter(obj => obj.category === 'Nature').length / artworksLikedFav.length * 100)
  const stillLifePourcentage = Math.round(artworksLikedFav.filter(obj => obj.category === 'StillLife').length / artworksLikedFav.length * 100)
  const digitalPourcentage = Math.round(artworksLikedFav.filter(obj => obj.category === 'Digital').length / artworksLikedFav.length * 100)

  const categoriesPourcentage = [
    { name: 'Abstract', pourcentage: abstractCategoryPourcentage, img: 'https://images.pexels.com/photos/2693212/pexels-photo-2693212.png?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940' },
    { name: 'Landscape', pourcentage: landscapePourcentage, img: 'https://images.pexels.com/photos/2356059/pexels-photo-2356059.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940' },
    { name: 'Urban', pourcentage: urbanPourcentage, img: 'https://images.pexels.com/photos/417023/pexels-photo-417023.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940' },
    { name: 'Portrait', pourcentage: portraitPourcentage, img: 'https://images.pexels.com/photos/3657140/pexels-photo-3657140.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940' },
    { name: 'Monumental', pourcentage: monumentalPourcentage, img: 'https://images.pexels.com/photos/5308359/pexels-photo-5308359.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940' },
    { name: 'Animal', pourcentage: animalPourcentage, img: 'https://images.pexels.com/photos/1076758/pexels-photo-1076758.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940' },
    { name: 'EverydayLife', pourcentage: everydayLifePourcentage, img: 'https://images.pexels.com/photos/6127025/pexels-photo-6127025.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940' },
    { name: 'PopArt', pourcentage: popArtCategoryPourcentage, img: 'https://cdn.pixabay.com/photo/2017/09/02/06/26/pop-art-2706464_960_720.jpg' },
    { name: 'Nude', pourcentage: nudePourcentage, img: 'https://images.pexels.com/photos/230675/pexels-photo-230675.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940' },
    { name: 'Nature', pourcentage: naturePourcentage, img: 'https://images.pexels.com/photos/3225517/pexels-photo-3225517.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940' },
    { name: 'StillLife', pourcentage: stillLifePourcentage, img: 'https://upload.wikimedia.org/wikipedia/commons/1/1a/Nature_morte_%28Paul_C%C3%A9zanne%29_%283332859798%29.jpg' },
    { name: 'Digital', pourcentage: digitalPourcentage, img: 'https://images.pexels.com/photos/7859782/pexels-photo-7859782.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940' },
  ]

  const opArtPourcentage = Math.round(artworksLikedFav.filter(obj => obj.movement === 'OpArt').length / artworksLikedFav.length * 100)
  const contemporaryPourcentage = Math.round(artworksLikedFav.filter(obj => obj.movement === 'Contemporary').length / artworksLikedFav.length * 100)
  const popArtMovementPourcentage = Math.round(artworksLikedFav.filter(obj => obj.movement === 'Pop Art').length / artworksLikedFav.length * 100)
  const abstractMovementPourcentage = Math.round(artworksLikedFav.filter(obj => obj.movement === 'Abstract').length / artworksLikedFav.length * 100)
  const impressionismPourcentage = Math.round(artworksLikedFav.filter(obj => obj.movement === 'Impressionism').length / artworksLikedFav.length * 100)
  const oldMastersPourcentage = Math.round(artworksLikedFav.filter(obj => obj.movement === 'Old Masters').length / artworksLikedFav.length * 100)
  const modernismPourcentage = Math.round(artworksLikedFav.filter(obj => obj.movement === 'Modernism').length / artworksLikedFav.length * 100)
  const bauhausPourcentage = Math.round(artworksLikedFav.filter(obj => obj.movement === 'Bauhaus').length / artworksLikedFav.length * 100)
  const streetArtPourcentage = Math.round(artworksLikedFav.filter(obj => obj.movement === 'Street Art').length / artworksLikedFav.length * 100)

  const movementsPourcentage = [
    { name: 'OpArt', pourcentage: opArtPourcentage, img: 'https://res.cloudinary.com/lepaffe/image/upload/v1638785260/Artmore/IMG_5503_cjcsf8.jpg' },
    { name: 'Contemporary', pourcentage: contemporaryPourcentage, img: 'https://images.pexels.com/photos/1269968/pexels-photo-1269968.jpeg?auto=compress&cs=tinysrgb&dpr=3&h=750&w=1260' },
    { name: 'Pop Art', pourcentage: popArtMovementPourcentage, img: 'https://cdn.pixabay.com/photo/2017/09/02/06/26/pop-art-2706464_960_720.jpg' },
    { name: 'Abstract', pourcentage: abstractMovementPourcentage, img: 'https://images.pexels.com/photos/2693212/pexels-photo-2693212.png?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940' },
    { name: 'Impressionism', pourcentage: impressionismPourcentage, img: 'https://t4.ftcdn.net/jpg/01/09/03/05/240_F_109030536_P0V5jYftELYNOr5GRvinHSS3Huz1PELe.jpg' },
    { name: 'Old Masters', pourcentage: oldMastersPourcentage, img: 'https://news.artnet.com/app/news-upload/2020/01/susanna-819x1024-819x1024.jpg' },
    { name: 'Modernism', pourcentage: modernismPourcentage, img: 'https://i2.wp.com/www.hisour.com/wp-content/uploads/2017/02/American-modernism-1910-1935.jpg?fit=960%2C640&ssl=1&w=640' },
    { name: 'Bauhaus', pourcentage: bauhausPourcentage, img: 'https://mir-s3-cdn-cf.behance.net/project_modules/max_1200/8e24d9102448777.5f369d863ee60.jpg' },
    { name: 'Street Art', pourcentage: streetArtPourcentage, img: 'https://images.pexels.com/photos/1647121/pexels-photo-1647121.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940' },
  ]

  res.json({ categoriesPourcentage, movementsPourcentage, noArtworksLiked })
})


module.exports = router;
