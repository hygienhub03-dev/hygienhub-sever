const express = require("express");
const { sendContactMessage } = require("../../helpers/resend");
const { validate } = require("../../validation/validate");
const { contactMessageSchema } = require("../../validation/schemas");

const router = express.Router();

router.post("/", validate(contactMessageSchema), async (req, res) => {
    const { name, email, subject, message } = req.body;

    const result = await sendContactMessage({ name, email, subject, message });

    if (result.success) {
        return res.status(200).json({ success: true, message: "Message sent successfully." });
    } else {
        return res.status(500).json({ success: false, message: "Failed to send message. Please try again or email us directly." });
    }
});

module.exports = router;
