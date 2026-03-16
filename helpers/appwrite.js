const { Client, Users, ID, Query, Storage } = require("node-appwrite");

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
 * Lazily load InputFile so the module still boots even if the sub-path
 * fails for any reason. Falls back to constructing a Web File directly.
 */
function makeInputFile(buffer, filename) {
  try {
    const { InputFile } = require("node-appwrite/file");
    if (InputFile && typeof InputFile.fromBuffer === "function") {
      return InputFile.fromBuffer(buffer, filename);
    }
  } catch (_) {
    // sub-path failed — fall through to manual construction
  }

  // Fallback: build a Web File directly (same thing InputFile.fromBuffer does)
  const { File } = require("node-fetch-native-with-agent");
  return new File([buffer], filename);
}

/**
 * Upload a file buffer to Appwrite Storage and return its public view URL.
 */
async function uploadImageToAppwrite(buffer, mimeType, filename) {
  const storage = createStorageClient();
  const fileId = ID.unique();

  const inputFile = makeInputFile(buffer, filename || "upload");
  await storage.createFile(STORAGE_BUCKET_ID, fileId, inputFile);

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
