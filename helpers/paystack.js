const https = require("https");

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || "";

/**
 * Initialize a Paystack transaction.
 * Docs: https://paystack.com/docs/api/transaction/#initialize
 */
function initializeTransaction(email, amountInCents, callbackUrl, metadata = {}) {
    return new Promise((resolve, reject) => {
        const params = JSON.stringify({
            email,
            amount: amountInCents, // Paystack expects amount in kobo/cents
            currency: "ZAR",
            callback_url: callbackUrl,
            metadata,
        });

        const options = {
            hostname: "api.paystack.co",
            port: 443,
            path: "/transaction/initialize",
            method: "POST",
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                "Content-Type": "application/json",
            },
        };

        const req = https.request(options, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.status) {
                        resolve(parsed.data);
                    } else {
                        reject(new Error(parsed.message || "Paystack initialization failed"));
                    }
                } catch (e) {
                    reject(new Error("Failed to parse Paystack response"));
                }
            });
        });

        req.on("error", reject);
        req.write(params);
        req.end();
    });
}

/**
 * Verify a Paystack transaction by reference.
 * Docs: https://paystack.com/docs/api/transaction/#verify
 */
function verifyTransaction(reference) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: "api.paystack.co",
            port: 443,
            path: `/transaction/verify/${encodeURIComponent(reference)}`,
            method: "GET",
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            },
        };

        const req = https.request(options, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.status) {
                        resolve(parsed.data);
                    } else {
                        reject(new Error(parsed.message || "Paystack verification failed"));
                    }
                } catch (e) {
                    reject(new Error("Failed to parse Paystack response"));
                }
            });
        });

        req.on("error", reject);
        req.end();
    });
}

module.exports = { initializeTransaction, verifyTransaction };
