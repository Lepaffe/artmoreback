const mongoose = require('mongoose')

const artistSchema = mongoose.Schema({
    name: String,
    instagram: String,
    city: String,
    country: String,
    bio: String,
    img: String,
    artistArtwork: [{ type: mongoose.Schema.Types.ObjectId, ref:'artworks' }]
})

module.exports = mongoose.model('artists', artistSchema)