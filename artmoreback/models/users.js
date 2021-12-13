const mongoose = require('mongoose');

const dailySchema = mongoose.Schema({
    day: Number, 
    selection:[]
})

const expoSchema = mongoose.Schema({
    title: String, 
    place: String,
    address: String,
    date_start: String,
    date_end: String
})

const userSchema = mongoose.Schema({
    firstName: String,
    lastName: String,
    birthday: Date,
    city: String,
    email: String,
    password: String,
    token: String,
    img: String,
    mediums: [],
    categories: [],
    expos: [expoSchema],
    daily: dailySchema,
    artistList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'artists' }],
    artworkList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'artworks' }],
    artworkLiked: [{ type: mongoose.Schema.Types.ObjectId, ref: 'artworks' }],
    artworkDisliked: [{ type: mongoose.Schema.Types.ObjectId, ref: 'artworks' }]
})

module.exports = mongoose.model('users', userSchema)