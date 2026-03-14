const express = require("express");
const cloudinary = require("cloudinary").v2;

const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "",
  api_key: process.env.CLOUDINARY_API_KEY || "",
  api_secret: process.env.CLOUDINARY_API_SECRET || "",
});

router.post("/sign", async (req, res) => {
  try {
    const paramsToSign = req.body?.paramsToSign || req.body;
    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET || ""
    );

    res.json({ signature });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Signature generation failed" });
  }
});

module.exports = router;
