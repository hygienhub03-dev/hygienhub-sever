const { Client, Users, ID, Query, Storage, InputFile } = require("node-appwrite");

const APPWRITE_ENDPOINT = "https://nyc.cloud.appwrite.io/v1";
const APPWRITE_PROJECT_ID = "69a6c56c002ced051526";
const DATABASE_ID = "hygiene-hub-db";
const STORAGE_BUCKET_ID = process.env.APPWRITE_STORAGE_BUCKET_ID || "product-images";

const COLLECTIONS = {
  orders: "orders",
  products: "products",
};

function createBaseClient() {
  return new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);
}

function createAppwriteClient() {
  const { Databases } = require("node-appwrite");
  return new Databases(createBaseClient());
}

function createStorageClient() {
  return new Storage(createBaseClient());
}

function createUsersClient() {
  return new Users(createBaseClient());
}

/**
 * Upload a file buffer to Appwrite Storage and return its public view URL.
 * @param {Buffer} buffer  - Raw file bytes
 * @param {string} mimeType - e.g. "image/jpeg"
 * @param {string} filename - Original filename
 * @returns {Promise<string>} Public URL of the uploaded file
 */
async function uploadImageToAppwrite(buffer, mimeType, filename) {
  const storage = createStorageClient();
  const fileId = ID.unique();

  const inputFile = InputFile.fromBuffer(buffer, filename || "upload", {
    type: mimeType,
  });

  await storage.createFile(STORAGE_BUCKET_ID, fileId, inputFile);

  // Build the public view URL
  const url = `${APPWRITE_ENDPOINT}/storage/buckets/${STORAGE_BUCKET_ID}/files/${fileId}/view?project=${APPWRITE_PROJECT_ID}`;
  return url;
}

module.exports = {
  createAppwriteClient,
  createStorageClient,
  createUsersClient,
  uploadImageToAppwrite,
  DATABASE_ID,
  STORAGE_BUCKET_ID,
  COLLECTIONS,
  ID,
  Query,
};
