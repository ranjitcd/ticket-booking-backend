// createAdmin.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

// Admin Schema
const adminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
});

const Admin = mongoose.model('Admin', adminSchema);

async function createAdmin() {
    const password = "Ranjit@3017"; // choose your password
    const hashedPassword = await bcrypt.hash(password, 10);

    const adminExists = await Admin.findOne({ username: "ranjAdmin" });
    if (adminExists) {
        console.log("⚠️ Admin already exists");
        return process.exit();
    }

    await Admin.create({ username: "ranjAdmin", password: hashedPassword });
    console.log("✅ Admin created successfully");
    process.exit();
}

createAdmin();
