var app = require('../app')
var request = require('supertest')
var mongoose = require('mongoose')

test('test signin Classique', async () => {
    const response = await request(app)
        .post('/sign-in')
        .send({ email: 'Syl@gmail.com', password: 'test1234' })
        .expect(200)
        .expect('Content-Type', /json/)
        .then((response) => {
            expect(response.body.token).toBe('SAzX3kEMgNVx4R6JeEQQy4S3TnKcr4Y8')
        })
})

test("verification sign-up classique", async () => {
    const response = await request(app)
        .post('/sign-up')
        .send({
            firstName: "Jean",
            lastName: "Dupond",
            city: 'Paris',
            mediums: JSON.stringify(["Painting", "Sculpture"]),
            categories: JSON.stringify(["Abstract", "Landscape"]),
            birthday: "1980-12-04T11:08:46.000+00:00",
            email: "jean.dupond@gmail.com",
            password: "Azerty123"
        })
        .then((response) => {
            expect(response.body.result).toBeTruthy()
        })
})

test("verification sign-up classique - email alreadyin", async () => {
    const response = await request(app)
        .post('/sign-up')
        .send({
            firstName: "Jean",
            lastName: "Dupont",
            city: 'Paris',
            mediums: JSON.stringify(["Painting", "Sculpture"]),
            categories: JSON.stringify(["Abstract", "Landscape"]),
            birthday: "1980-12-04T11:08:46.000+00:00",
            email: "jean.dupont@gmail.com",
            password: "Azerty123"
        })
        .then((response) => {
            expect(response.body.error).toContain('This email is already taken.')
        })

})
afterAll(done => {
    mongoose.connection.close()
    done();
});
