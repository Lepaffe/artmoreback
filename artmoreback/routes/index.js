var express = require('express');
var router = express.Router();

var bcrypt = require('bcrypt');
var uid2 = require('uid2');

var request = require('sync-request');

var uniqid = require('uniqid');
var fs = require('fs');
var cloudinary = require('cloudinary').v2;

var ArtistModel = require('../models/artists')
var UserModel = require('../models/users')

// import du module de recommandation
var Recommend = require('../mymodules/recommend');

cloudinary.config({
  cloud_name: 'artplusmore',
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET
});


/* SwipeScreen */

router.get('/get-artwork-list/:token', async function (req, res, next) {
  // appel de l'algo de selection 
  var artworkSelections = await Recommend(req.params.token);
  res.json({ artworks: artworkSelections.swipeArray });
});


router.post('/like', async function (req, res, next) {
  //si l'oeuvre est deja likée on ne la rajoute pas
  let alreadyIn = await UserModel.findOne({ token: req.body.token, artworkLiked: { $in: req.body.artworkId } })
  if (!alreadyIn) {
    var result = await UserModel.updateOne({ token: req.body.token }, { $push: { artworkLiked: { _id: req.body.artworkId } } })
  }
  res.json({ result })
})


router.post('/dislike', async function (req, res, next) {
  //si l'oeuvre est deja dans les Disliked on ne la rajoute pas
  let alreadyIn = await UserModel.findOne({ token: req.body.token, artworkDisliked: { $in: req.body.artworkId } })

  if (!alreadyIn) {
    //on ajoute l'oeuvre aux Disliked
    var result = await UserModel.updateOne({ token: req.body.token }, { $push: { artworkDisliked: { _id: req.body.artworkId } } })

    //on verifie que l'oeuvre n'etait pas dans les Liked  ////////// 
    let isLiked = await UserModel.findOne({ token: req.body.token, artworkLiked: { $in: req.body.artworkId } });
    //on verifie que l'oeuvre n'est pas deja dans les Liked si oui on la retire des liked 
    if (isLiked) {
      var result2 = await UserModel.updateOne({ token: req.body.token }, { $pull: { artworkLiked: { $in: req.body.artworkId } } })
    }
  }

  res.json({ result })
})

/* Ajout et suppression d'une oeuvre à la collection */

router.post('/add-artworklist', async function (req, res, next) {
  // update le tableau "artworkList" dans le model user afin d'ajouter l'object ID d'une oeuvre dans la base de donnée
  let alreadyAdded = await UserModel.findOne({ token: req.body.token, artworkList: { $in: req.body.artworkId } })

  if (!alreadyAdded) {
    var result = await UserModel.updateOne({ token: req.body.token }, { $push: { artworkList: { _id: req.body.artworkId } } })
  }

  if (result.modifiedCount === 1) {
    result = true;
  } else {
    result = false;
  }

  res.json({ result });
});

router.delete('/delete-artworklist', async function (req, res, next) {

  // supprime un element de l'array artworkList du ModelUser dans la base de donnée
  var result = await UserModel.updateOne({ token: req.body.token }, { $pull: { artworkList: { $in: req.body.artworkId } } })

  if (result.modifiedCount === 1) {
    result = true;
  } else {
    result = false;
  }

  res.json({ result });
});



/* CollectionScreen */

router.get('/get-collection/:token', async function (req, res, next) {
  // Récuperer la clé étrangère artworkList du UserModel en filtrant avec son token
  var user = await UserModel.findOne({ token: req.params.token }).populate('artworkList')
  res.json({ collection: user.artworkList });
});

/* MyArtistsScreen */

router.get('/get-artist-collection/:token', async function (req, res, next) {
  // Récuperer la clé étrangère artistList du UserModel en filtrant avec son token
  var user = await UserModel.findOne({ token: req.params.token })
    .populate({
      path: 'artistList',      //on populate dans userModel la artisList
      populate: {             // on lui dit de faire un deuxieme populate avec le path ArtistAtwork 
        path: 'artistArtwork'   // permet de faire un "populate de populate"
      }
    })
    .exec();

  res.json({ artistCollection: user.artistList });
});

/* Artist Screen */

router.get('/get-artist-detail/:artworkId', async function (req, res, next) {

  var artist = await ArtistModel.findOne({ artistArtwork: { $in: req.params.artworkId } }).populate('artistArtwork')

  res.json({ artist });
});

router.post('/add-artistlist', async function (req, res, next) {

  let alreadyAdded = await UserModel.findOne({ token: req.body.token, artistList: { $in: req.body.artworkId } })

  if (!alreadyAdded) {
    // update le tableau "artist" dans le model user afin d'ajouter l'object ID d'une oeuvre dans la base de donnée
    var result = await UserModel.updateOne({ token: req.body.token }, { $push: { artistList: { _id: req.body.artistId } } })
  }

  if (result.modifiedCount === 1) {
    result = true;
  } else {
    result = false;
  }

  res.json({ result });
});

router.delete('/delete-artistlist', async function (req, res, next) {

  // supprime un element de l'array artistList du ModelUser dans la base de donnée
  var result = await UserModel.updateOne({ token: req.body.token }, { $pull: { artistList: { $in: req.body.artistId } } })

  if (result.modifiedCount === 1) {
    result = true;
  } else {
    result = false;
  }

  res.json({ result });
});

/* Sign-in - Sign-up */

router.post('/sign-up', async function (req, res, next) {

  var error = []
  var result = false
  var saveUser = null
  var token = null

  const data = await UserModel.findOne({
    email: req.body.email
  })

  if (data != null) {
    error.push('This email is already taken.')
  }

  if (req.body.firstName == ''
    || req.body.lastName == ''
    || req.body.email == ''
    || req.body.city == ''
    || req.body.birthday == ''
    || req.body.password == ''

  ) {
    error.push('All fields must be completed.')
  }

  if (error.length == 0) {

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
      daily: { day: -1, selection: [] } ////pourquoi -1 ?
    })

    saveUser = await newUser.save()

    if (saveUser) {
      result = true
      token = saveUser.token
    }
  }
  res.json({ result, error, token })
});

router.post('/sign-up-google', async function (req, res, next) {

  var error = []
  var result = false
  var saveUser = null
  var token = null

  const data = await UserModel.findOne({
    email: req.body.email
  })

  if (data != null) {
    error.push('This email is already taken.')
  }

  if (req.body.firstName == ''
    || req.body.lastName == ''
    || req.body.email == ''
    || req.body.city == ''
    || req.body.birthday == ''
  ) {
    error.push('All fields must be completed.')
  }

  if (error.length == 0) {

    /* pour les user google plutot que de creer un champ pour indiquer que c un user gglesignin 
    j'ai opté pour mettre un password 'google' dans la bdd (pwd impossible pour un autre user vu qu'il y a la regex) 
    et je redirige si pas gglesign in vers le signin classique
    et je redirige aussi en sign in classique si user ggle vers le sign in via ggle
    comme ça si notre base est hackée personne ne pourra savoir qui est userggle ou pas.*/
    var hash = bcrypt.hashSync('google', 10);

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

    saveUser = await newUser.save()

    if (saveUser) {
      result = true
      token = saveUser.token
    }
  }
  res.json({ result, error, token })
});

router.post('/sign-in-google', async function (req, res, next) {

  var result = false
  var user = null
  var error = []
  var token = null
  var artistList = []
  var artworkList = []

  user = await UserModel.findOne({ email: req.body.email });

  if (user) {
    if (bcrypt.compareSync('google', user.password)) {
      result = true
      token = user.token
      artistList = user.artistList
      artworkList = user.artworkList
    } else {
      error.push('Not a GoogleSignIn user. Go back and Signin');
    }
  } else {
    error.push("User doesn't exist");
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
    error.push('All fields must be completed.')
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

        if (bcrypt.compareSync('google', user.password)) {
          error.push('Go back and Signin via Google');
        } else {
          error.push('Incorrect password');
        }
      }

    } else {
      error.push('Incorrect email')
    }
  }

  res.json({ result, error, token, artistList, artworkList })
});

/* Landing Screen */

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


/* ExhibitionScreen */

router.get('/get-exhibitions/:token', async function (req, res, next) {

  //on récupère le token pour filtrer par la suite les résultats selon la ville du user
  const user = await UserModel.findOne({ token: req.params.token })
  const userCity = user.city

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

router.post('/add-exhibitions', async function (req, res, next) {

  let result = await UserModel.updateOne({ token: req.body.token }, { $push: { expos: { title: req.body.title, place: req.body.place, address: req.body.address, date_start: req.body.date_start, date_end: req.body.date_end, city: req.body.city, img: req.body.img } } })

  if (result.modifiedCount != 0) {
    result = true
  } else {
    result = false
  }

  const user = await UserModel.findOne({ token: req.body.token })
  const addedExpo = user.expos[user.expos.length - 1]

  res.json({ result, addedExpo });
});

router.delete('/delete-exhibitions/:token/:title', async function (req, res, next) {

  let result = await UserModel.updateOne({ token: req.params.token }, { $pull: { expos: { title: req.params.title } } })

  if (result.modifiedCount != 0) {
    result = true
  } else {
    result = false
  }

  res.json({ result });
});

router.get('/get-my-exhibitions/:token', async function (req, res, next) {
  // Récuperer la clé étrangère artistList du UserModel en filtrant avec son token
  var user = await UserModel.findOne({ token: req.params.token })
  var userExpoList = user.expos
  res.json({ userExpoList });
});


/* DailyScreen */

router.get('/get-daily-selection/:token', async function (req, res, next) {

  // appel de l'algo de selection 
  var artworkSelections = await Recommend(req.params.token);

  //pour chaque oeuvre de notre tableau dailyArrau, on récupère l'artiste 
  const artist0 = await ArtistModel.findOne({ artistArtwork: { $in: artworkSelections.dailyArray[0]._id } }).populate('artistArtwork')
  const artist1 = await ArtistModel.findOne({ artistArtwork: { $in: artworkSelections.dailyArray[1]._id } }).populate('artistArtwork')
  const artist2 = await ArtistModel.findOne({ artistArtwork: { $in: artworkSelections.dailyArray[2]._id } }).populate('artistArtwork')
  const artist3 = await ArtistModel.findOne({ artistArtwork: { $in: artworkSelections.dailyArray[3]._id } }).populate('artistArtwork')


  //on créé le tableau qui sera renvoyé au front, où chaque élément est un objet qui contient l'oeuvre avec l'artiste qui lui correspond
  const artworksWithArtists = [
    { artwork: artworkSelections.dailyArray[0], artist: artist0 },
    { artwork: artworkSelections.dailyArray[1], artist: artist1 },
    { artwork: artworkSelections.dailyArray[2], artist: artist2 },
    { artwork: artworkSelections.dailyArray[3], artist: artist3 }
  ]

  res.json({ artworksWithArtists });
});

/* Profile screen */

router.get('/get-user-info-profile/:token', async function (req, res, next) {

  const user = await UserModel.findOne({ token: req.params.token })

  const firstName = user.firstName;
  const lastName = user.lastName;
  const img = user.img

  res.json({ firstName, lastName, img })
})


/* Settings screen */

router.get('/get-user-info-settings/:token', async function (req, res, next) {

  const user = await UserModel.findOne({ token: req.params.token })

  const city = user.city;
  const mediums = user.mediums;
  const categories = user.categories;

  res.json({ city, mediums, categories })
})

router.put('/update-city/:token', async function (req, res, next) {

  await UserModel.updateOne({ token: req.params.token }, { city: req.body.city })
  const user = await UserModel.findOne({ token: req.params.token });
  const city = user.city

  res.json({ city })
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

router.put('/update-avatar/:token', async function (req, res, next) {

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

/* StatisticsScreen */

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
