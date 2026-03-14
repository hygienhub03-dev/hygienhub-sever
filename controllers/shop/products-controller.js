const { createAppwriteClient, DATABASE_ID, COLLECTIONS, Query } = require("../../helpers/appwrite");

const getFilteredProducts = async (req, res) => {
  try {
    const { category = "", brand = "", sortBy = "price-lowtohigh" } = req.query;
    const db = createAppwriteClient();

    const queries = [Query.limit(500)];
    if (category.length) queries.push(Query.equal("category", category.split(",")));
    if (brand.length)    queries.push(Query.equal("brand", brand.split(",")));

    switch (sortBy) {
      case "price-hightolow": queries.push(Query.orderDesc("price")); break;
      case "title-atoz":      queries.push(Query.orderAsc("title"));  break;
      case "title-ztoa":      queries.push(Query.orderDesc("title")); break;
      default:                queries.push(Query.orderAsc("price"));  break;
    }

    const result = await db.listDocuments(DATABASE_ID, COLLECTIONS.products, queries);
    const data = result.documents.map((p) => ({ ...p, _id: p.$id }));
    res.status(200).json({ success: true, data });
  } catch (e) {
    console.log(e);
    res.status(500).json({ success: false, message: "Some error occured" });
  }
};

const getProductDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const db = createAppwriteClient();
    const product = await db.getDocument(DATABASE_ID, COLLECTIONS.products, id);
    res.status(200).json({ success: true, data: { ...product, _id: product.$id } });
  } catch (e) {
    console.log(e);
    res.status(500).json({ success: false, message: "Some error occured" });
  }
};

module.exports = { getFilteredProducts, getProductDetails };
