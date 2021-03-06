const express = require('express');
const router = express.Router();

/* Require Models*/
const ArtistModel = require('../models/artists')
const ArtworkModel = require('../models/artworks')
const UserModel = require('../models/users')

const Recommend = async (token) => {
    
    // fonction Shuffle pour avoir une selection random sur le tableau
    const shuffleArray = array => {
        for (let i = array.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          const temp = array[i];
          array[i] = array[j];
          array[j] = temp;
        }
        return array;
      }

    let artworks = await ArtworkModel.find(); // on recupere toutes les oeuvres
    let user = await UserModel.findOne({ token: token })
        .populate('artworkList')
        .populate('artworkLiked')
        .populate('artworkDisliked')
        .populate('artistList')
        .exec(); // on récupère le user avec toutes ses listes 
    
    if (user) {
        //on enlève les oeuvres dislikées, favorites ou likées
        let temp = user.artworkList.concat(user.artworkLiked).concat(user.artworkDisliked);
        for (let i = 0; i < temp.length; i++) {
            artworks = artworks.filter(e => e.name !== temp[i].name);
        }


        // on separe en 2 selon les mediums favoris du user  pour avoir 2 tableaux :
        //  - ArtworkFavMediums = tableaux des oeuvres correspondantes aux mediums préférés
        //  - ArtworlAltMediums = tableaux des autres oeuvres restantes

        let artworksFavMediums = [];
        let artworksAltMediums = artworks;
        for (let i = 0; i < user.mediums.length; i++) {
            //on filtre en gardant uniquement les oeuvres de chaque medium préféré du user
            let temp = artworks.filter(e => e.medium === user.mediums[i])
            //on concatene avec le resultat du medium precedent (filter renvoie un tableau)
            artworksFavMediums = artworksFavMediums.concat(temp);
            //on enleve les oeuvres sélectionnées ci dessus du tableau
            artworksAltMediums = artworksAltMediums.filter(e => e.medium !== user.mediums[i]);
        }

        // on separe selon les catégories préférées pour avoir 3 tableaux :
        //  - artworksFavMediumsFavCat = tableaux des oeuvres correspondantes aux mediums préférés & categories préférées
        //  - artworksFavMediumsAltCat = tableaux des autres correspondantes aux mediums préférés & categories alternatives
        //  - artworksAltMediumsFavCat = tableaux des oeuvres correspondantes aux mediums alternatifs & categories préférées

        let artworksFavMediumsFavCat = [];
        let artworksFavMediumsAltCat = artworksFavMediums;
        let artworksAltMediumsFavCat = [];

        for (let i = 0; i < user.categories.length; i++) {

            //on filtre en gardant uniquement les oeuvres de chaque movement préféré du user
            let temp = artworksFavMediums.filter(e => e.category === user.categories[i]);
            let temp2 = artworksAltMediums.filter(e => e.category === user.categories[i]);
            //on concatene avec le resultat pour le movement precedent (filter renvoie un tableau)
            artworksFavMediumsFavCat = artworksFavMediumsFavCat.concat(temp);
            artworksAltMediumsFavCat = artworksAltMediumsFavCat.concat(temp2);

            //on enleve les oeuvres sélectionnées ci dessus du tableau
            artworksFavMediumsAltCat = artworksFavMediumsAltCat.filter(e => e.category !== user.categories[i]);
        }

        //console.log('set1', artworksFavMediumsFavCat, artworksFavMediumsFavCat.length);
        //console.log('set2', artworksFavMediumsAltCat, artworksFavMediumsAltCat.length);
        //console.log('set3', artworksAltMediumsFavCat, artworksAltMediumsFavCat.length);

        // On mélange les oeuvres aléatoirement de chaque tableau 

        artworksFavMediumsFavCat=shuffleArray(artworksFavMediumsFavCat);
        artworksFavMediumsAltCat=shuffleArray(artworksFavMediumsAltCat);
        artworksAltMediumsFavCat=shuffleArray(artworksAltMediumsFavCat);
        //On prend 70% du set 1, 20% du set 2 et 10% du set 3
        let total100= artworksFavMediumsFavCat.length+artworksFavMediumsAltCat.length+artworksAltMediumsFavCat.length;
        let nbSet1= Math.round(total100*0.7);
        let nbSet2= Math.round(total100*0.2);
        let nbSet3= Math.round(total100*0.1);
        console.log('nbSet',total100, nbSet1, nbSet2, nbSet3);
    
        //creation de la dailySelection une fois par jour et de la swipe selection
        let swipeArray=[];
        let dailyArray=[];
        let today=new Date();
        today=today.getDay();
        //console.log('user today',user);
        if (user.daily.day != undefined && today===user.daily.day){
            //si même journée on garde la même selection
            dailyArray= user.daily.selection;
            //on retire la selection du nouveau tableau Swipable
            for (let i=0; i< dailyArray.length; i++){
                artworksFavMediumsFavCat=artworksFavMediumsFavCat.filter(e => e._id !== dailyArray[i]._id)
            } 
            swipeArray=artworksFavMediumsFavCat.slice(0,nbSet1)
                        .concat(artworksFavMediumsAltCat.slice(0,nbSet2))
                        .concat(artworksAltMediumsFavCat.slice(0,nbSet3));
        } else {
            dailyArray=artworksFavMediumsFavCat.slice(0,4);
            swipeArray=artworksFavMediumsFavCat.slice(4,4+nbSet1)
                        .concat(artworksFavMediumsAltCat.slice(0,nbSet2))
                        .concat(artworksAltMediumsFavCat.slice(0,nbSet3));
            // on sauveagarde la dailyselection et le jour dans la base (reconnexion d'un autre eqpt)
            await UserModel.updateOne(
                { token: token },
                { daily : { day: today,
                            selection: dailyArray}
                });
        }
        // on remelange le tableau de swipe
        swipeArray=shuffleArray(swipeArray);   
    
        //console.log('daily', dailyArray);
        return {swipeArray,dailyArray}
    }   
}
module.exports = Recommend