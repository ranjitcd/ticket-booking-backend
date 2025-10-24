const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    const Admin = mongoose.model('Admin', new mongoose.Schema({
        username: String,
        password: String,
    }));

    const admin = await Admin.findOne({ username: 'admin' });
    console.log(admin);
    process.exit();
});
