const mongoose = require('mongoose')

const artworkSchema = mongoose.Schema({
    name: String,
    year: String,
    size: String,
    location: String,
    desc: String,
    medium: String,
    technic: String,
    movement: String,
    category: String,
    cloudinary: String,
})

module.exports = mongoose.model('artworks', artworkSchema)