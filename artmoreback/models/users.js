const mongoose = require('mongoose')

const userSchema = mongoose.Schema({
    firstName: String,
    lastName: String,
    birthday:String,
    city: String,
    email: String,
    password: String,
    token: String,
    mediums: [],
    movements: [],
    expos:[{type: mongoose.Schema.Types.ObjectId, ref: 'expos'}],
    artistList: [{type: mongoose.Schema.Types.ObjectId, ref: 'artists'}],
    artworkList: [{type: mongoose.Schema.Types.ObjectId, ref: 'artworks'}],
})

module.exports = mongoose.model('users', userSchema)