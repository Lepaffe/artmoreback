var express = require('express');
var router = express.Router();

/* Require Models*/
var ArtistModel = require('../models/artists')
var ArtworkModel = require('../models/artworks')
var UserModel = require('../models/users')

const Recommend = async (token) => {
    
    var artworks = await ArtworkModel.find(); // on recupere toutes les oeuvres
    var user= await UserModel.findOne({token: token})
          .populate('artworkList')
          .populate('artworkLiked')
          .populate('artworkDisliked')
          .populate('artistList')
          .exec(); // on récupère le user avec toutes ses listes 
  // console.log(user)
   if (user){
    //on enlève les oeuvres dislikées, favorite ou likées
    let temp=user.artworkList.concat(user.artworkLiked).concat(user.artworkDisliked);
    for (let i=0;i<temp.length;i++){                
        artworks = artworks.filter(e => e.name !== temp[i].name);
    }
   
   
    // on separe en 2 selon les mediums favoris du user  pour avoir 2 tableaux :
    //  - ArtworkFavMediums = tableaux des oeuvres correspondantes aux mediums préférés
    //  - ArtworlAltMediums = tableaux des autres oeuvres restantes

    var artworksFavMediums=[];
    var artworksAltMediums=artworks;
    for (let i=0;i<user.mediums.length;i++) {
        //on filtre en gardant uniquement les oeuvres de chaque medium préféré du user
        let temp = artworks.filter(e=>e.medium === user.mediums[i])
        //on concatene avec le resultat du medium precedent (filter renvoie un tableau)
        artworksFavMediums= artworksFavMediums.concat(temp);
        //on enleve les oeuvres sélectionnées ci dessus du tableau
        artworksAltMediums=artworksAltMediums.filter(e=>e.medium !== user.mediums[i]);
    }
    
    // on separe selon les catégories préférées pour avoir 3 tableaux :
    //  - artworksFavMediumsFavCat = tableaux des oeuvres correspondantes aux mediums préférés & categories préférées
    //  - artworksFavMediumsAltCat = tableaux des autres correspondantes aux mediums préférés & categories alternatives
    //  - artworksAltMediumsFavCat = tableaux des oeuvres correspondantes aux mediums alternatifs & categories préférées
   
    var artworksFavMediumsFavCat=[];
    var artworksFavMediumsAltCat=artworksFavMediums;
    var artworksAltMediumsFavCat=[];

    for (let i=0;i<user.categories.length;i++) {
        
        //on filtre en gardant uniquement les oeuvres de chaque movement préféré du user
        let temp = artworksFavMediums.filter(e =>e.category === user.categories[i]);
        let temp2=artworksAltMediums.filter(e =>e.category === user.categories[i]);
        //on concatene avec le resultat pour le movement precedent (filter renvoie un tableau)
        artworksFavMediumsFavCat= artworksFavMediumsFavCat.concat(temp);
        artworksAltMediumsFavCat=artworksAltMediumsFavCat.concat(temp2);
        
        //on enleve les oeuvres sélectionnées ci dessus du tableau
        artworksFavMediumsAltCat=artworksFavMediumsAltCat.filter(e=>e.category !== user.categories[i]);   
    }
   
    console.log('set1', artworksFavMediumsFavCat, artworksFavMediumsFavCat.length);
    console.log('set2',artworksFavMediumsAltCat, artworksFavMediumsAltCat.length );
    console.log('set3',artworksAltMediumsFavCat, artworksAltMediumsFavCat.length);
   
 }   
}
module.exports = Recommend