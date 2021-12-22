var express = require('express');
var router = express.Router();
var uniqid = require('uniqid');
var fs = require('fs');

var cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: 'artplusmore',
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET
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
      img: 'https://res.cloudinary.com/artplusmore/image/upload/v1639574934/avatar-icon-design-for-man-vector-id648229964_hd9kza.jpg',
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
});

router.post('/sign-up-google', async function (req, res, next) {

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
  ) {
    error.push('Tous les champs doivent être remplis.')
  }

  if (error.length == 0) {
    var hash = bcrypt.hashSync('google', 10);
    console.log('in sign-up-google');
    var newUser = new UserModel({
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      city: req.body.city,
      birthday: req.body.birthday,
      mediums: JSON.parse(req.body.mediums),
      categories: JSON.parse(req.body.categories),
      img: req.body.img,
      expos: [],
      email: req.body.email,
      artistList: [],
      artworkList: [],
      password: hash,
      token: uid2(32),
      daily: { day: -1, selection: [] }
    })
    console.log('sign-up-google before save', newUser);
    saveUser = await newUser.save()


    if (saveUser) {
      result = true
      token = saveUser.token
    }
  }
  res.json({ result, error, token, artistList, artworkList })
});

router.post('/sign-in-google', async function (req, res, next) {

  var result = false
  var user = null
  var error = []
  var token = null
  var artistList = []
  var artworkList = []
  
  user = await UserModel.findOne({ email: req.body.email,});
    if (user) {
      if (bcrypt.compareSync('google', user.password)) {
        result = true
        token = user.token
        artistList = user.artistList
        artworkList = user.artworkList
      } else {
        result = false
        error.push('Not a GoogleSignIn user. Go back and Signin');
        } 
      } else {
        result=false;
        error.push("user doesn't exist");
    }
  res.json({ result, error, token, artistList, artworkList })
});


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
        if (bcrypt.compareSync('google', user.password)){
          error.push('Go back and Signin via Google');
        } else {
        error.push('Mot de passe incorrect');
        }
      } 
    } else {
        error.push('Mail incorrect')
    }
  }
  console.log(token)
  res.json({ result, error, token, artistList, artworkList })
});

/* Landing Screen - auto-logged in */

router.get('/auto-loggedIn/:token', async function (req, res, next) {

  var token = null
  var artistList = []
  var artworkList = []
  var result = false

  const user = await UserModel.findOne({ token: req.params.token })
  console.log(user)
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
  var data = request('GET', `https://public.opendatasoft.com/api/records/1.0/search/?dataset=evenements-publics-cibul&q=&rows=35&facet=tags&facet=placename&facet=department&facet=region&facet=city&facet=date_start&facet=date_end&facet=pricing_info&facet=updated_at&facet=city_district&refine.date_end=2022&refine.tags=Exposition`)
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

  //pour chaque oeuvre de notre tableau, on récupère l'artiste (j'ai fait sans map() pour le moment histoire de bien comprendre)
  const artist0 = await ArtistModel.findOne({ artistArtwork: { $in: artworkSelections.dailyArray[0]._id } }).populate('artistArtwork')
  const artist1 = await ArtistModel.findOne({ artistArtwork: { $in: artworkSelections.dailyArray[1]._id } }).populate('artistArtwork')
  const artist2 = await ArtistModel.findOne({ artistArtwork: { $in: artworkSelections.dailyArray[2]._id } }).populate('artistArtwork')
  const artist3 = await ArtistModel.findOne({ artistArtwork: { $in: artworkSelections.dailyArray[3]._id } }).populate('artistArtwork')

  let isFav0 = await UserModel.findOne({ token: req.params.token, artworkList: { $in: artworkSelections.dailyArray[0]._id } })
  let isFav1 = await UserModel.findOne({ token: req.params.token, artworkList: { $in: artworkSelections.dailyArray[1]._id } })
  let isFav2 = await UserModel.findOne({ token: req.params.token, artworkList: { $in: artworkSelections.dailyArray[2]._id } })
  let isFav3 = await UserModel.findOne({ token: req.params.token, artworkList: { $in: artworkSelections.dailyArray[3]._id } })

  if (isFav0) {
    isFav0 = true
  } else {
    isFav0 = false
  }

  if (isFav1) {
    isFav1 = true
  } else {
    isFav1 = false
  }

  if (isFav2) {
    isFav2 = true
  } else {
    isFav2 = false
  }

  if (isFav3) {
    isFav3 = true
  } else {
    isFav3 = false
  }


  //on créé le tableau qui sera renvoyé au front, où chaque élément est un objet qui contient l'oeuvre avec l'artiste qui lui correspond
  const artworksWithArtists = [
    { artwork: artworkSelections.dailyArray[0], artist: artist0, isFav: isFav0 },
    { artwork: artworkSelections.dailyArray[1], artist: artist1, isFav: isFav1 },
    { artwork: artworkSelections.dailyArray[2], artist: artist2, isFav: isFav2 },
    { artwork: artworkSelections.dailyArray[3], artist: artist3, isFav: isFav3 }
  ]

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
    { name: 'Abstract', pourcentage: abstractCategoryPourcentage, img: 'https://res.cloudinary.com/artplusmore/image/upload/v1639557979/pexels-photo-2693212_fjvesn.jpg' },
    { name: 'Landscape', pourcentage: landscapePourcentage, img: 'https://res.cloudinary.com/artplusmore/image/upload/v1639558028/pexels-photo-2356059_nonufa.jpg' },
    { name: 'Urban', pourcentage: urbanPourcentage, img: 'https://res.cloudinary.com/artplusmore/image/upload/v1639558306/pexels-photo-417023_oa6nlg.jpg' },
    { name: 'Portrait', pourcentage: portraitPourcentage, img: 'https://res.cloudinary.com/artplusmore/image/upload/v1639558067/pexels-photo-3657140_sb1u6d.jpg' },
    { name: 'Monumental', pourcentage: monumentalPourcentage, img: 'https://res.cloudinary.com/artplusmore/image/upload/v1639558392/pexels-photo-5308359_po3xrh.jpg' },
    { name: 'Animal', pourcentage: animalPourcentage, img: 'https://res.cloudinary.com/artplusmore/image/upload/v1639558110/pexels-photo-1076758_ah9dyf.jpg' },
    { name: 'EverydayLife', pourcentage: everydayLifePourcentage, img: 'https://res.cloudinary.com/artplusmore/image/upload/v1639558134/pexels-photo-6127025_fbi7vr.jpg' },
    { name: 'PopArt', pourcentage: popArtCategoryPourcentage, img: 'https://res.cloudinary.com/artplusmore/image/upload/v1639558186/pop-art-2706464_960_720_s704vd.jpg' },
    { name: 'Nude', pourcentage: nudePourcentage, img: 'https://res.cloudinary.com/artplusmore/image/upload/v1639558246/pexels-photo-230675_smp64w.jpg' },
    { name: 'Nature', pourcentage: naturePourcentage, img: 'https://res.cloudinary.com/artplusmore/image/upload/v1639558276/pexels-photo-3225517_cvgkgg.jpg' },
    { name: 'StillLife', pourcentage: stillLifePourcentage, img: 'https://res.cloudinary.com/artplusmore/image/upload/v1639558361/Nature_morte__28Paul_C_C3_A9zanne_29__283332859798_29_zoil8w.jpg' },
    { name: 'Digital', pourcentage: digitalPourcentage, img: 'https://res.cloudinary.com/artplusmore/image/upload/v1639590336/pexels-photo-2783848_jyddpn.jpg' },
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
    { name: 'OpArt', pourcentage: opArtPourcentage, img: 'https://res.cloudinary.com/artplusmore/image/upload/v1639559291/IMG_5503_cjcsf8_jhbmp6.jpg' },
    { name: 'Contemporary', pourcentage: contemporaryPourcentage, img: 'https://res.cloudinary.com/artplusmore/image/upload/v1639559337/pexels-photo-1269968_tng2ge.jpg' },
    { name: 'Pop Art', pourcentage: popArtMovementPourcentage, img: 'https://res.cloudinary.com/artplusmore/image/upload/v1639559385/pop-art-2706464_960_720_syxkrh.jpg' },
    { name: 'Abstract', pourcentage: abstractMovementPourcentage, img: 'https://res.cloudinary.com/artplusmore/image/upload/v1639559432/pexels-photo-2693212_apxsfz.jpg' },
    { name: 'Impressionism', pourcentage: impressionismPourcentage, img: 'https://res.cloudinary.com/artplusmore/image/upload/v1639560153/Claude_Monet_2C_Impression_2C_soleil_levant_r8st7x.jpg' },
    { name: 'Old Masters', pourcentage: oldMastersPourcentage, img: 'https://res.cloudinary.com/artplusmore/image/upload/v1639560766/Frans_van_MIeris_studio_-_A_shepherdess_standing_near_a_plinth_with_flowers_in_a_Classical_vase_H0027-L05801231_heateu.jpg' },
    { name: 'Modernism', pourcentage: modernismPourcentage, img: 'https://res.cloudinary.com/artplusmore/image/upload/v1639561661/tc5f4dc7_gkdvuk.jpg' },
    { name: 'Bauhaus', pourcentage: bauhausPourcentage, img: 'https://res.cloudinary.com/artplusmore/image/upload/v1639642825/kandinsky_xatso4.jpg' },
    { name: 'Street Art', pourcentage: streetArtPourcentage, img: 'https://res.cloudinary.com/artplusmore/image/upload/v1639561880/pexels-photo-1647121_hpl1fi.jpg' },
  ]

  res.json({ categoriesPourcentage, movementsPourcentage, noArtworksLiked })
})


module.exports = router;
