// firebase.js
const admin = require('firebase-admin');
const serviceAccount = require('./sa/coba-capstone-426301-d8dce8edd6a6.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
module.exports = db;
