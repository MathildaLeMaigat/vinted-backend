const express = require("express");
const mongoose = require("mongoose");
const cloudinary = require("cloudinary").v2;
require("dotenv").config();
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// mongoose.connect("mongodb://localhost/vinted-orion22");
mongoose.connect(process.env.MONGODB);

// Import Routes user/offer
const userRoutes = require("./routes/user");
app.use(userRoutes);
const offerRoutes = require("./routes/offer");
app.use(offerRoutes);

app.all("*", (req, res) => {
  res.status(400).json({ error: "Cette route n'existe pas" });
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Server has started 🔥");
});
