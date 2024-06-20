const express = require("express");
const app = express();

const admin = require("firebase-admin");
const credentials = require("./serviceAccountKey.json");

admin.initializeApp({
    credential: admin.credential.cert(credentials)
});

const db = admin.firestore();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/signup', async (req, res) => {
    console.log(req.body);
    const user = {
        email: req.body.email,
        password: req.body.password,
        username: req.body.username
    };
    try {
        const userResponse = await admin.auth().createUser({
            email: user.email,
            password: user.password,
            displayName: user.username,
            emailVerified: false,
            disabled: false
        });
        // Add user UID and username to Firestore
        await db.collection('user').add({
            uid: userResponse.uid,
            username: user.username
        });
        res.json({
            error: false,
            message: "User Created"
        });
    } catch (error) {
        res.status(500).json({
            error: true,
            message: error.message
        });
    }
});


// set post and listen for our requests
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server is running on PORT ${PORT}.`);
});
