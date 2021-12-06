var mongoose = require('mongoose')

var artworkSchema = mongoose.Schema({
    name: String,
    year: String,
    size: String,
    location: String,
    desc: String,
    medium: String,
    technic: String,
    movement: String,
    category: String,
    urlcloudinary: String,
    

})

module.exports = mongoose.model('artworks', artworkSchema)