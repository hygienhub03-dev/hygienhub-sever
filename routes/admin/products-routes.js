const express = require("express");
const { authMiddleware, adminOnly } = require("../../controllers/auth/auth-controller");

const {
  handleImageUpload,
  addProduct,
  editProduct,
  fetchAllProducts,
  deleteProduct,
  recomputeProductSales,
} = require("../../controllers/admin/products-controller");

const { upload } = require("../../helpers/cloudinary");

const router = express.Router();
router.use(authMiddleware, adminOnly);

router.post("/upload-image", upload.single("my_file"), handleImageUpload);
router.post("/add", upload.single("imageFile"), addProduct);
router.put("/edit/:id", upload.single("imageFile"), editProduct);
router.delete("/delete/:id", deleteProduct);
router.get("/get", fetchAllProducts);
router.post("/recompute-sales", recomputeProductSales);

module.exports = router;
