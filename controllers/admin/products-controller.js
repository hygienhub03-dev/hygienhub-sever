const multer = require("multer");
const {
  createAppwriteClient,
  uploadImageToAppwrite,
  DATABASE_ID,
  COLLECTIONS,
  ID,
  Query,
} = require("../../helpers/appwrite");

// ── Multer (memory only — no Cloudinary) ────────────────────────────────────
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_MIME.has(file.mimetype)) {
      cb(new Error("Invalid file type — only JPEG, PNG, WEBP, GIF are allowed"));
      return;
    }
    cb(null, true);
  },
});

// ── Internal helper ──────────────────────────────────────────────────────────
/**
 * Resolves the final image URL for a product request.
 * Priority:
 *  1. Multipart file upload  → uploaded to Appwrite Storage
 *  2. Base64 data URL in body → uploaded to Appwrite Storage
 *  3. Plain https:// URL      → used as-is (already stored in Appwrite)
 */
async function resolveProductImage(req) {
  // 1. Multipart file
  if (req.file?.buffer && req.file?.mimetype) {
    return await uploadImageToAppwrite(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname || "product-image"
    );
  }

  const image = req.body?.image;

  // 2. Base64 data URL
  if (typeof image === "string" && /^data:/i.test(image)) {
    const matches = image.match(/^data:([^;]+);base64,(.+)$/);
    if (matches) {
      const mimeType = matches[1];
      const buffer = Buffer.from(matches[2], "base64");
      return await uploadImageToAppwrite(buffer, mimeType, "product-image");
    }
  }

  // 3. Already an https URL (Appwrite or otherwise)
  if (typeof image === "string" && /^https?:\/\//i.test(image)) {
    return image;
  }

  return null;
}

// ── Route handlers ───────────────────────────────────────────────────────────

const handleImageUpload = async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ success: false, message: "No file provided" });
    }
    const url = await uploadImageToAppwrite(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname || "product-image"
    );
    res.json({ success: true, result: { secure_url: url, url } });
  } catch (error) {
    console.error("[handleImageUpload]", error);
    res.status(500).json({ success: false, message: "Image upload failed" });
  }
};

const recomputeProductSales = async (req, res) => {
  try {
    const db = createAppwriteClient();

    const ordersResult = await db.listDocuments(DATABASE_ID, COLLECTIONS.orders, [
      Query.equal("paymentStatus", "paid"),
      Query.limit(5000),
    ]);

    // Aggregate revenue per product
    const statsMap = new Map();
    for (const order of ordersResult.documents) {
      const cartItems = JSON.parse(order.cartItems || "[]");
      for (const item of cartItems) {
        const pid = String(item.productId);
        const qty = Number(item.quantity) || 0;
        const price = Number(item.price) || 0;
        const revenue = qty * price;
        const existing = statsMap.get(pid);
        if (!existing) {
          statsMap.set(pid, { revenue });
        } else {
          existing.revenue += revenue;
        }
      }
    }

    // Only write "sales" — it's the only sales-related attribute in the Appwrite schema
    let updated = 0;
    for (const [productId, stats] of statsMap.entries()) {
      try {
        await db.updateDocument(DATABASE_ID, COLLECTIONS.products, productId, {
          sales: stats.revenue,
        });
        updated++;
      } catch (err) {
        console.warn(`Could not update product ${productId}:`, err.message);
      }
    }

    res.status(200).json({
      success: true,
      message: "Product sales counters recomputed successfully",
      updated,
    });
  } catch (e) {
    console.error("[recomputeProductSales]", e);
    res.status(500).json({ success: false, message: "Error occured" });
  }
};

const addProduct = async (req, res) => {
  try {
    const { title, description, category, brand, price, salePrice, totalStock, averageReview } = req.body;
    const db = createAppwriteClient();
    const imageUrl = await resolveProductImage(req);

    const product = await db.createDocument(DATABASE_ID, COLLECTIONS.products, ID.unique(), {
      image: imageUrl || "",
      title: title || "",
      description: description || "",
      category: category || "",
      brand: brand || "",
      price: Number(price) || 0,
      salePrice: Number(salePrice) || 0,
      totalStock: Number(totalStock) || 0,
      averageReview: Number(averageReview) || 0,
    });

    res.status(201).json({ success: true, data: { ...product, _id: product.$id } });
  } catch (e) {
    console.error("[addProduct]", e);
    res.status(500).json({ success: false, message: "Error occured" });
  }
};

const fetchAllProducts = async (req, res) => {
  try {
    const db = createAppwriteClient();
    const result = await db.listDocuments(DATABASE_ID, COLLECTIONS.products, [
      Query.limit(500),
    ]);
    const data = result.documents.map((p) => ({ ...p, _id: p.$id }));
    res.status(200).json({ success: true, data });
  } catch (e) {
    console.error("[fetchAllProducts]", e);
    res.status(500).json({ success: false, message: "Error occured" });
  }
};

const editProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, category, brand, price, salePrice, totalStock, averageReview } = req.body;
    const db = createAppwriteClient();

    const existing = await db.getDocument(DATABASE_ID, COLLECTIONS.products, id);
    if (!existing) return res.status(404).json({ success: false, message: "Product not found" });

    const imageUrl = await resolveProductImage(req);
    const updates = {};
    if (title !== undefined)         updates.title = title;
    if (description !== undefined)   updates.description = description;
    if (category !== undefined)      updates.category = category;
    if (brand !== undefined)         updates.brand = brand;
    if (price !== undefined)         updates.price = Number(price) || 0;
    if (salePrice !== undefined)     updates.salePrice = Number(salePrice) || 0;
    if (totalStock !== undefined)    updates.totalStock = Number(totalStock) || 0;
    if (averageReview !== undefined) updates.averageReview = Number(averageReview) || 0;
    if (imageUrl)                    updates.image = imageUrl;
    else if (typeof req.body?.image === "string" && req.body.image.trim()) updates.image = req.body.image;

    const updated = await db.updateDocument(DATABASE_ID, COLLECTIONS.products, id, updates);
    res.status(200).json({ success: true, data: { ...updated, _id: updated.$id } });
  } catch (e) {
    console.error("[editProduct]", e);
    res.status(500).json({ success: false, message: "Error occured" });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const db = createAppwriteClient();
    await db.deleteDocument(DATABASE_ID, COLLECTIONS.products, id);
    res.status(200).json({ success: true, message: "Product deleted successfully" });
  } catch (e) {
    console.error("[deleteProduct]", e);
    res.status(500).json({ success: false, message: "Error occured" });
  }
};

module.exports = {
  upload,
  handleImageUpload,
  addProduct,
  fetchAllProducts,
  editProduct,
  deleteProduct,
  recomputeProductSales,
};
