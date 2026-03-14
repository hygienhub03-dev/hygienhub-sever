const { imageUploadUtil } = require("../../helpers/cloudinary");
const Product = require("../../models/Product");
const Order = require("../../models/Order");

async function resolveProductImage(req) {
  if (req.file?.buffer && req.file?.mimetype) {
    const b64 = Buffer.from(req.file.buffer).toString("base64");
    const dataUrl = "data:" + req.file.mimetype + ";base64," + b64;
    const result = await imageUploadUtil(dataUrl);
    return result?.secure_url || result?.url || null;
  }

  const image = req.body?.image;
  if (typeof image === "string" && /^data:/i.test(image)) {
    const result = await imageUploadUtil(image);
    return result?.secure_url || result?.url || null;
  }

  if (typeof image === "string" && /^(https?:\/\/)/i.test(image)) {
    return image;
  }

  return null;
}

const handleImageUpload = async (req, res) => {
  try {
    const b64 = Buffer.from(req.file.buffer).toString("base64");
    const url = "data:" + req.file.mimetype + ";base64," + b64;
    const result = await imageUploadUtil(url);

    res.json({
      success: true,
      result,
    });
  } catch (error) {
    console.log(error);
    res.json({
      success: false,
      message: "Error occured",
    });
  }
};

const recomputeProductSales = async (req, res) => {
  try {
    await Product.updateMany(
      {},
      {
        $set: {
          unitsSold: 0,
          revenue: 0,
          sales: 0,
        },
      }
    );

    const stats = await Order.aggregate([
      { $match: { paymentStatus: "paid" } },
      { $unwind: "$cartItems" },
      {
        $group: {
          _id: "$cartItems.productId",
          unitsSold: { $sum: "$cartItems.quantity" },
          revenue: {
            $sum: {
              $multiply: [
                "$cartItems.quantity",
                {
                  $convert: {
                    input: "$cartItems.price",
                    to: "double",
                    onError: 0,
                    onNull: 0,
                  },
                },
              ],
            },
          },
        },
      },
    ]);

    const ops = stats
      .filter((s) => s?._id)
      .map((s) => ({
        updateOne: {
          filter: { _id: s._id },
          update: {
            $set: {
              unitsSold: s.unitsSold || 0,
              revenue: s.revenue || 0,
              sales: s.revenue || 0,
            },
          },
        },
      }));

    if (ops.length) {
      await Product.bulkWrite(ops, { ordered: false });
    }

    res.status(200).json({
      success: true,
      message: "Product sales counters recomputed successfully",
      updated: ops.length,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      message: "Error occured",
    });
  }
};

//add a new product
const addProduct = async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      brand,
      price,
      salePrice,
      totalStock,
      averageReview,
    } = req.body;

    console.log(averageReview, "averageReview");

    const imageUrl = await resolveProductImage(req);

    const newlyCreatedProduct = new Product({
      image: imageUrl || req.body?.image,
      title,
      description,
      category,
      brand,
      price,
      salePrice,
      totalStock,
      averageReview,
    });

    await newlyCreatedProduct.save();
    res.status(201).json({
      success: true,
      data: newlyCreatedProduct,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      message: "Error occured",
    });
  }
};

//fetch all products

const fetchAllProducts = async (req, res) => {
  try {
    const listOfProducts = await Product.find({});
    res.status(200).json({
      success: true,
      data: listOfProducts,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      message: "Error occured",
    });
  }
};

//edit a product
const editProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      category,
      brand,
      price,
      salePrice,
      totalStock,
      averageReview,
    } = req.body;

    let findProduct = await Product.findById(id);
    if (!findProduct)
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });

    findProduct.title = title || findProduct.title;
    findProduct.description = description || findProduct.description;
    findProduct.category = category || findProduct.category;
    findProduct.brand = brand || findProduct.brand;
    findProduct.price = price === "" ? 0 : price || findProduct.price;
    findProduct.salePrice =
      salePrice === "" ? 0 : salePrice || findProduct.salePrice;
    findProduct.totalStock = totalStock || findProduct.totalStock;
    const imageUrl = await resolveProductImage(req);
    if (imageUrl) {
      findProduct.image = imageUrl;
    } else if (typeof req.body?.image === "string" && req.body.image.trim()) {
      findProduct.image = req.body.image;
    }
    findProduct.averageReview = averageReview || findProduct.averageReview;

    await findProduct.save();
    res.status(200).json({
      success: true,
      data: findProduct,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      message: "Error occured",
    });
  }
};

//delete a product
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findByIdAndDelete(id);

    if (!product)
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });

    res.status(200).json({
      success: true,
      message: "Product delete successfully",
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      message: "Error occured",
    });
  }
};

module.exports = {
  handleImageUpload,
  addProduct,
  fetchAllProducts,
  editProduct,
  deleteProduct,
  recomputeProductSales,
};
