const { createAppwriteClient, DATABASE_ID, COLLECTIONS, Query } = require("../../helpers/appwrite");

const getAllOrdersOfAllUsers = async (req, res) => {
  try {
    const db = createAppwriteClient();
    const result = await db.listDocuments(DATABASE_ID, COLLECTIONS.orders, [
      Query.orderDesc("$createdAt"),
      Query.limit(500),
    ]);

    const orders = result.documents.map((o) => ({
      ...o,
      _id: o.$id,
      cartItems: JSON.parse(o.cartItems || "[]"),
      addressInfo: JSON.parse(o.addressInfo || "{}"),
    }));

    res.status(200).json({ success: true, data: orders });
  } catch (e) {
    console.error("getAllOrdersOfAllUsers error:", e);
    res.status(500).json({ success: false, message: "Some error occurred!" });
  }
};

const getOrderDetailsForAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const db = createAppwriteClient();
    const o = await db.getDocument(DATABASE_ID, COLLECTIONS.orders, id);

    res.status(200).json({
      success: true,
      data: {
        ...o,
        _id: o.$id,
        cartItems: JSON.parse(o.cartItems || "[]"),
        addressInfo: JSON.parse(o.addressInfo || "{}"),
      },
    });
  } catch (e) {
    console.error("getOrderDetailsForAdmin error:", e);
    res.status(500).json({ success: false, message: "Order not found!" });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { orderStatus } = req.body;
    const db = createAppwriteClient();

    await db.updateDocument(DATABASE_ID, COLLECTIONS.orders, id, {
      orderStatus,
      orderUpdateDate: new Date().toISOString(),
    });

    res.status(200).json({ success: true, message: "Order status updated successfully!" });
  } catch (e) {
    console.error("updateOrderStatus error:", e);
    res.status(500).json({ success: false, message: "Some error occurred!" });
  }
};

module.exports = { getAllOrdersOfAllUsers, getOrderDetailsForAdmin, updateOrderStatus };
