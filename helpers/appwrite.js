const { Client, Users, ID, Query } = require("node-appwrite");

const APPWRITE_ENDPOINT = "https://nyc.cloud.appwrite.io/v1";
const APPWRITE_PROJECT_ID = "69a6c56c002ced051526";
const DATABASE_ID = "hygiene-hub-db";

const COLLECTIONS = {
  orders: "orders",
  products: "products",
};

function createAppwriteClient() {
  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const { Databases } = require("node-appwrite");
  return new Databases(client);
}

function createUsersClient() {
  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  return new Users(client);
}

module.exports = {
  createAppwriteClient,
  createUsersClient,
  DATABASE_ID,
  COLLECTIONS,
  ID,
  Query,
};
