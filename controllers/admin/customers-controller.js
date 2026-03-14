const Order = require("../../models/Order");
const { createUsersClient } = require("../../helpers/appwrite");

const fetchAllCustomers = async (req, res) => {
  try {
    const usersClient = createUsersClient();
    const appwriteUsers = await usersClient.list();

    // We filter out admin if we only want customers, or map them generally
    const users = appwriteUsers.users.map((u) => ({
      _id: u.$id,
      userName: u.name || u.email.split("@")[0],
      email: u.email,
      role: u.prefs?.role || "user",
    }));

    const userIds = users.map((u) => String(u._id));

    // Keep using Order model to get statistics from MongoDB
    const orderAgg = await Order.aggregate([
      { $match: { userId: { $in: userIds } } },
      {
        $group: {
          _id: "$userId",
          orderCount: { $sum: 1 },
          totalSpent: { $sum: "$totalAmount" },
          lastOrderDate: { $max: "$orderDate" },
        },
      },
    ]);

    const byUserId = new Map(orderAgg.map((r) => [String(r._id), r]));

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

    const orders = await Order.find({ userId: String(userId) }).sort({ orderDate: -1 });

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
