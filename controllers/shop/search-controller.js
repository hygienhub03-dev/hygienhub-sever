const { createAppwriteClient, DATABASE_ID, COLLECTIONS, Query } = require("../../helpers/appwrite");

const searchProducts = async (req, res) => {
  try {
    const { keyword } = req.params;
    if (!keyword || typeof keyword !== "string") {
      return res.status(400).json({
        success: false,
        message: "Keyword is required and must be in string format",
      });
    }

    const db = createAppwriteClient();
    // Appwrite full-text search across multiple fields using OR
    const result = await db.listDocuments(DATABASE_ID, COLLECTIONS.products, [
      Query.or([
        Query.search("title", keyword),
        Query.search("description", keyword),
        Query.search("category", keyword),
        Query.search("brand", keyword),
      ]),
      Query.limit(100),
    ]);

    const data = result.documents.map((p) => ({ ...p, _id: p.$id }));
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Error" });
  }
};

module.exports = { searchProducts };
