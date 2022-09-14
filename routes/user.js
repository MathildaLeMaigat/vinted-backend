const express = require("express");
const router = express.Router();
const uid2 = require("uid2");
const SHA256 = require("crypto-js/sha256");
const encBase64 = require("crypto-js/enc-base64");

const User = require("../models/User");

// Create an account
router.post("/user/signup", async (req, res) => {
  try {
    if (req.body.username) {
      const user = await User.findOne({ email: req.body.email });
      if (user === null) {
        //console.log(req.body);

        // Etape 1 : hasher le mot de passe
        const token = uid2(64);
        const salt = uid2(16);
        const hash = SHA256(req.body.password + salt).toString(encBase64);
        console.log(hash);
        //console.log(token, salt);

        // Etape 2 : créer le nouvel utilisateur
        const newUser = new User({
          email: req.body.email,
          account: {
            username: req.body.username,
          },
          newsletter: req.body.newsletter,
          token: token,
          salt: salt,
          hash: hash,
        });

        // Etape 3 : sauvegarder le nouvel utilisateur dans la BDD
        await newUser.save();
        res.json({
          _id: newUser._id,
          email: newUser.email,
          token: newUser.token,
          account: newUser.account,
        });
      } else {
        res.status(409).json("This email already has an account");
      }
    } else {
      res.status(404).json("Missing parameters");
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Connect to an Account
router.post("/user/login", async (req, res) => {
  try {
    // console.log(req.body);
    const user = await User.findOne({ email: req.body.email });

    if (user) {
      const newHash = SHA256(req.body.password + user.salt).toString(encBase64);
      console.log("newHash ==>", newHash);
      console.log("Hash présent en BDD ==>", user.hash);

      // Compare Hash to the one in DB
      if (newHash === user.hash) {
        res.json({
          _id: user._id,
          token: user.token,
          account: user.account,
        });
      } else {
        res.status(401).json({ error: "Unauthorized" });
      }
    } else {
      res.status(401).json({ error: "Unauthorized" });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
