const mongoose = require('mongoose')

const options = {
    connectTimeoutMS: 5000,
    useUnifiedTopology: true,
    useNewUrlParser: true,
}

mongoose.connect(`mongodb+srv://${process.env.MONGO_KEY}@artmore.dzgpf.mongodb.net/Art+More?retryWrites=true&w=majority`,
    options,
    function (err) {
        if (err) {
            console.log(err);
        } else {
            console.log('Connexion BDD réussie!');
        }
    }

)

module.exports = mongoose