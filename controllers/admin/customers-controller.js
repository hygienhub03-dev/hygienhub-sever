const { createUsersClient, createAppwriteClient, DATABASE_ID, COLLECTIONS, Query } = require("../../helpers/appwrite");

const fetchAllCustomers = async (req, res) => {
  try {
    const usersClient = createUsersClient();
    const appwriteUsers = await usersClient.list();

    const users = appwriteUsers.users.map((u) => ({
      _id: u.$id,
      userName: u.name || u.email.split("@")[0],
      email: u.email,
      role: u.prefs?.role || "user",
    }));

    const userIds = users.map((u) => String(u._id));

    // Fetch orders from Appwrite and compute per-user stats
    const db = createAppwriteClient();
    const ordersResult = await db.listDocuments(DATABASE_ID, COLLECTIONS.orders, [
      Query.limit(5000),
    ]);

    const byUserId = new Map();
    for (const o of ordersResult.documents) {
      if (!userIds.includes(String(o.userId))) continue;
      const uid = String(o.userId);
      const existing = byUserId.get(uid);
      const amount = Number(o.totalAmount) || 0;
      const date = o.orderDate || o.$createdAt;
      if (!existing) {
        byUserId.set(uid, { orderCount: 1, totalSpent: amount, lastOrderDate: date });
      } else {
        existing.orderCount += 1;
        existing.totalSpent += amount;
        if (date > existing.lastOrderDate) existing.lastOrderDate = date;
      }
    }

    const data = users.map((u) => {
      const id = String(u._id);
      const agg = byUserId.get(id);
      return {
        _id: id,
        userName: u.userName,
        email: u.email,
        role: u.role,
        orderCount: agg?.orderCount ?? 0,
        totalSpent: agg?.totalSpent ?? 0,
        lastOrderDate: agg?.lastOrderDate ?? null,
      };
    });

    res.status(200).json({ success: true, data });
  } catch (e) {
    console.error("Customers error:", e);
    res.status(500).json({ success: false, message: "Error occured" });
  }
};

const fetchCustomerOrders = async (req, res) => {
  try {
    const { userId } = req.params;

    const db = createAppwriteClient();
    const result = await db.listDocuments(DATABASE_ID, COLLECTIONS.orders, [
      Query.equal("userId", String(userId)),
      Query.orderDesc("orderDate"),
      Query.limit(100),
    ]);
    const orders = result.documents.map((o) => ({
      ...o,
      _id: o.$id,
      cartItems: JSON.parse(o.cartItems || "[]"),
      addressInfo: JSON.parse(o.addressInfo || "{}"),
    }));

    res.status(200).json({ success: true, data: orders });
  } catch (e) {
    console.log(e);
    res.status(500).json({ success: false, message: "Error occured" });
  }
};

module.exports = {
  fetchAllCustomers,
  fetchCustomerOrders,
};
