const express = require("express");
const router = express.Router();
const cloudinary = require("cloudinary").v2;
const fileUpload = require("express-fileupload");

const Offer = require("../models/Offer");
const User = require("../models/User");
const isAuthenticated = require("../middlewares/isAuthenticated");

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

const convertToBase64 = (file) => {
  return `data:${file.mimetype};base64,${file.data.toString("base64")}`;
};

router.post(
  "/offer/publish",
  isAuthenticated,
  fileUpload(),
  async (req, res) => {
    try {
      console.log(req.headers.authorization);
      const { title, description, price, condition, city, brand, size, color } =
        req.body;
      console.log(req.body);
      console.log(req.files);
      const newOffer = new Offer({
        product_name: title,
        product_description: description,
        product_price: price,
        product_details: [
          { MARQUE: brand },
          { TAILLE: size },
          { ETAT: condition },
          { COULEUR: color },
          { EMPLACEMENT: city },
        ],
        owner: req.user,
      });
      console.log(newOffer);

      // Vérifier le type de fichier
      // if (
      //   Array.isArray(req.files.picture) === true ||
      //   req.files.picture.mimetype.slice(0, 5) !== "image"
      // ) {
      //   res
      //     .status(400)
      //     .json({ message: "You must send a single image file !" });
      // } else {
      //J'envoie mon image sur cloudinary, juste après avoir crée en DB mon offre
      // Comme ça j'ai accès à mon ID
      const result = await cloudinary.uploader.upload(
        convertToBase64(req.files.picture),
        {
          folder: "Vinted/Offers",
          public_id: `${req.body.title} - ${newOffer._id}`,
        }
      );

      //je viens rajouter l'image à mon offre
      newOffer.product_image = result;
      //console.log(result);
      await newOffer.save();
      res.json(newOffer);
      // }
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

// Route qui nous permet de récupérer une liste d'annonces, en fonction de filtres
// Si aucun filtre n'est envoyé, cette route renverra l'ensemble des annonces
router.get("/offers", async (req, res) => {
  console.log(req.body);

  try {
    // création d'un objet dans lequel on va sotcker nos différents filtres
    let filters = {};

    if (req.query.title) {
      filters.product_name = new RegExp(req.query.title, "i");
    }

    if (req.query.priceMin) {
      filters.product_price = {
        $gte: req.query.priceMin,
      };
    }
    //Si j'ai une déjà une clé product_price dans min object objectFilter
    if (req.query.priceMax) {
      if (filters.product_price) {
        filters.product_price.$lte = req.query.priceMax;
      } else {
        filters.product_price = {
          $lte: req.query.priceMax,
        };
      }
    }
    //  console.log(filters);

    let sort = {};

    if (req.query.sort === "price-desc") {
      sort = { product_price: -1 };
    } else if (req.query.sort === "price-asc") {
      sort = { product_price: 1 };
    }
    // console.log(sort);

    // Pagination
    let page;
    if (Number(req.query.page) < 1) {
      page = 1;
    } else {
      page = Number(req.query.page);
    }

    let limit = Number(req.query.limit);

    const offers = await Offer.find(filters)
      .populate({
        path: "owner",
        select: "account",
      })
      .sort(sort)
      .skip((page - 1) * limit) // ignorer les x résultats
      .limit(limit); // renvoyer y résultats

    // cette ligne va nous retourner le nombre d'annonces trouvées en fonction des filtres
    const count = await Offer.countDocuments(filters);

    res.json({
      count: count,
      offers: offers,
    });
  } catch (error) {
    console.log(error.message);
    res.status(400).json({ message: error.message });
  }
});

router.put(
  "/offer/update/:id",
  isAuthenticated,
  fileUpload(),
  async (req, res) => {
    const offerToModify = await Offer.findById(req.params.id);
    try {
      if (req.body.title) {
        offerToModify.product_name = req.body.title;
      }
      if (req.body.description) {
        offerToModify.product_description = req.body.description;
      }
      if (req.body.price) {
        offerToModify.product_price = req.body.price;
      }

      const details = offerToModify.product_details;
      for (i = 0; i < details.length; i++) {
        if (details[i].MARQUE) {
          if (req.body.brand) {
            details[i].MARQUE = req.body.brand;
          }
        }
        if (details[i].TAILLE) {
          if (req.body.size) {
            details[i].TAILLE = req.body.size;
          }
        }
        if (details[i].ÉTAT) {
          if (req.body.condition) {
            details[i].ÉTAT = req.body.condition;
          }
        }
        if (details[i].COULEUR) {
          if (req.body.color) {
            details[i].COULEUR = req.body.color;
          }
        }
        if (details[i].EMPLACEMENT) {
          if (req.body.location) {
            details[i].EMPLACEMENT = req.body.location;
          }
        }
      }

      if (req.files?.picture) {
        const result = await cloudinary.uploader.upload(
          convertToBase64(req.files.picture, {
            public_id: `api/vinted/offers/${offerToModify._id}/preview`,
          })
        );
        offerToModify.product_image = result;
      }

      await offerToModify.save();

      res.status(200).json("Offer modified succesfully !");
    } catch (error) {
      console.log(error.message);
      res.status(400).json({ error: error.message });
    }
  }
);

router.delete("/offer/delete/:id", isAuthenticated, async (req, res) => {
  try {
    //Je supprime ce qui il y a dans le dossier
    await cloudinary.api.delete_resources_by_prefix(
      `api/vinted/offers/${req.params.id}`
    );
    //Une fois le dossier vide, je peux le supprimer !
    await cloudinary.api.delete_folder(`api/vinted/offers/${req.params.id}`);

    offerToDelete = await Offer.findById(req.params.id);

    await offerToDelete.delete();

    res.status(200).json("Offer deleted succesfully !");
  } catch (error) {
    console.log(error.message);
    res.status(400).json({ error: error.message });
  }
});

router.get("/offer/:id", async (req, res) => {
  console.log(req.params);
  try {
    const offer = await Offer.findById(req.params.id).populate({
      path: "owner",
      select: "account.username account.email",
    });
    res.json(offer);
  } catch (error) {
    console.log(error.message);
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
