require("dotenv").config();
const { Client, Users, Query } = require("node-appwrite");

// Setup Appwrite connection using the same config as your backend
const client = new Client()
    .setEndpoint("https://nyc.cloud.appwrite.io/v1")
    .setProject("69a6c56c002ced051526")
    .setKey(process.env.APPWRITE_API_KEY);

const users = new Users(client);

// CHANGE THIS TO YOUR EMAIL 
const targetEmail = "thatomaphakula14@gmail.com";

async function grantAdmin() {
    try {
        console.log(`Looking up user: ${targetEmail}...`);
        const result = await users.list([Query.equal("email", targetEmail)]);

        if (result.total === 0) {
            console.log(`\n❌ Error: No user found with email "${targetEmail}"`);
            console.log("Please register the account first on the frontend.");
            process.exit(1);
        }

        const user = result.users[0];
        console.log(`Found user: ${user.name} (ID: ${user.$id})`);

        // The codebase expects role: "admin" in preferences
        const currentPrefs = user.prefs || {};
        const newPrefs = { ...currentPrefs, role: "admin" };

        await users.updatePrefs(user.$id, newPrefs);
        console.log(`\n✅ Success! "${targetEmail}" has been granted 'admin' role.`);
        console.log("You can now login to the Admin Dashboard.");
    } catch (err) {
        console.error("\n❌ Error updating user:", err.message);
    }
}

grantAdmin();
