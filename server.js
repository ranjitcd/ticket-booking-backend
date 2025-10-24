
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
// const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/yakshagana-tickets', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

// Booking Schema
const bookingSchema = new mongoose.Schema({
    bookingId: { type: String, required: true, unique: true },
    ticketId: { type: String, unique: true, sparse: true },
    customerName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    eventName: { type: String, required: true },
    eventDate: { type: Date, required: true },
    ticketType: { type: String, required: true },
    numberOfTickets: { type: Number, required: true, min: 1 },
    pricePerTicket: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
    status: {
        type: String,
        enum: ['pending_payment', 'confirmed', 'cancelled', 'rejected'],
        default: 'pending_payment'
    },
    createdAt: { type: Date, default: Date.now },
    approvedAt: { type: Date },
    bookingDate: { type: Date },
});

const Booking = mongoose.model('Booking', bookingSchema);

// Admin Schema
const adminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // hashed
});

const Admin = mongoose.model('Admin', adminSchema);

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

// Middleware to verify admin token
const verifyAdminToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, error: "No token provided" });

    const token = authHeader.split(" ")[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.admin = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ success: false, error: "Invalid or expired token" });
    }
};

// ------------------- Admin Routes ------------------- //

// Admin login
app.post("/api/admin/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        const admin = await Admin.findOne({ username });
        if (!admin) {
            console.log("❌ Admin not found");
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }

        const isMatch = await bcrypt.compare(password, admin.password);
        console.log("Admin found:", admin.username);
        console.log("Password matches:", isMatch);

        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }

        const token = jwt.sign({ id: admin._id, username: admin.username }, JWT_SECRET, { expiresIn: "1d" });
        res.json({ success: true, token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// Verify token
app.get("/api/admin/verify", verifyAdminToken, (req, res) => {
    res.json({ success: true, user: req.admin });
});

// Get pending bookings (Admin only)
app.get("/api/bookings/pending", verifyAdminToken, async (req, res) => {
    try {
        const bookings = await Booking.find({ status: 'pending_payment' }).sort({ createdAt: -1 });
        res.json({ success: true, bookings });
    } catch (error) {
        console.error("Error fetching pending bookings:", error);
        res.status(500).json({ success: false, error: "Failed to fetch bookings" });
    }
});

// Get all bookings (Admin only)
app.get("/api/bookings", verifyAdminToken, async (req, res) => {
    try {
        const bookings = await Booking.find().sort({ createdAt: -1 });
        res.json({ success: true, bookings });
    } catch (error) {
        console.error("Error fetching bookings:", error);
        res.status(500).json({ success: false, error: "Failed to fetch bookings" });
    }
});

// Configure nodemailer transporter (add this near the top of your file, after app setup)
// const transporter = nodemailer.createTransport({
//     // service: 'gmail', // or your email service

//     // auth: {
//     //     user: process.env.EMAIL_USER, // your email
//     //     pass: process.env.EMAIL_PASS // your app password
//     // }
//     host: "smtp.gmail.com",
//     port: 587, // SSL
//     secure: false,
//     auth: {
//         user: process.env.EMAIL_USER,
//         pass: process.env.EMAIL_PASS,
//     },
// });

const sgMail = require('@sendgrid/mail');

// Configure SendGrid (add this after your other requires)
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Updated Approve booking endpoint with email
// app.post("/api/bookings/approve/:bookingId", verifyAdminToken, async (req, res) => {
//     try {
//         const booking = await Booking.findOne({ bookingId: req.params.bookingId });
//         if (!booking) return res.status(404).json({ success: false, error: "Booking not found" });

//         if (booking.status === 'confirmed') {
//             return res.status(400).json({ success: false, error: "Booking already approved" });
//         }

//         booking.status = 'confirmed';
//         booking.approvedAt = new Date();
//         booking.ticketId = `TKT-${Math.floor(100000 + Math.random() * 900000)}`;
//         booking.bookingDate = new Date();

//         await booking.save();

//         // Send confirmation email
//         const mailOptions = {
//             from: process.env.EMAIL_USER,
//             to: booking.email,
//             subject: `Booking Confirmed - ${booking.eventName}`,
//             html: `
//                 <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//                     <h2 style="color: #4CAF50;">🎭 Booking Confirmed!</h2>
//                     <p>Dear ${booking.customerName},</p>
//                     <p>Your booking has been confirmed. Here are your ticket details:</p>
                    
//                     <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
//                         <p><strong>Ticket Type:</strong> ${booking.ticketType}</p>
//                         <p><strong>Ticket ID:</strong> ${booking.ticketId}</p>
//                         <p><strong>Booking ID:</strong> ${booking.bookingId}</p>
//                         <p><strong>Event:</strong> ${booking.eventName}</p>
//                         <p><strong>Event Date:</strong> ${new Date(booking.eventDate).toLocaleDateString()}</p>
//                         <p><strong>Number of Tickets:</strong> ${booking.numberOfTickets}</p>
//                         <p><strong>Total Amount:</strong> ₹${booking.totalPrice}</p>
//                     </div>
                    
//                     <p>Please save this email for your records. Show your Ticket ID at the venue.</p>
//                     <p>Thank you for booking with us!</p>
                    
//                     <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
//                     <p style="color: #666; font-size: 12px;">
//                         If you have any questions, please contact us.
//                     </p>
//                 </div>
//             `
//         };

//         // Send email (don't wait for it to complete)
//         transporter.sendMail(mailOptions, (error, info) => {
//             if (error) {
//                 console.error('Error sending email:', error);
//             } else {
//                 console.log('Email sent:', info.response);
//             }
//         });

//         res.json({ success: true, message: "Booking approved successfully", booking });
//     } catch (error) {
//         console.error("Error approving booking:", error);
//         res.status(500).json({ success: false, error: "Failed to approve booking" });
//     }
// });
app.post("/api/bookings/approve/:bookingId", verifyAdminToken, async (req, res) => {
    try {
        const booking = await Booking.findOne({ bookingId: req.params.bookingId });
        if (!booking) return res.status(404).json({ success: false, error: "Booking not found" });

        if (booking.status === 'confirmed') {
            return res.status(400).json({ success: false, error: "Booking already approved" });
        }

        booking.status = 'confirmed';
        booking.approvedAt = new Date();
        booking.ticketId = `TKT-${Math.floor(100000 + Math.random() * 900000)}`;
        booking.bookingDate = new Date();

        await booking.save();

        // Send confirmation email with SendGrid
        const msg = {
            to: booking.email,
            from: process.env.SENDGRID_FROM_EMAIL, // Must be your verified sender
            subject: `Booking Confirmed - ${booking.eventName}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #4CAF50;">🎭 Booking Confirmed!</h2>
                    <p>Dear ${booking.customerName},</p>
                    <p>Your booking has been confirmed. Here are your ticket details:</p>
                    
                    <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p><strong>Ticket Type:</strong> ${booking.ticketType}</p>
                        <p><strong>Ticket ID:</strong> ${booking.ticketId}</p>
                        <p><strong>Booking ID:</strong> ${booking.bookingId}</p>
                        <p><strong>Event:</strong> ${booking.eventName}</p>
                        <p><strong>Event Date:</strong> ${new Date(booking.eventDate).toLocaleDateString()}</p>
                        <p><strong>Number of Tickets:</strong> ${booking.numberOfTickets}</p>
                        <p><strong>Total Amount:</strong> ₹${booking.totalPrice}</p>
                    </div>
                    
                    <p>Please save this email for your records. Show your Ticket ID at the venue.</p>
                    <p>Thank you for booking with us!</p>
                    
                    <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
                    <p style="color: #666; font-size: 12px;">
                        If you have any questions, please contact us.
                    </p>
                </div>
            `
        };

        // Send email (async, don't block response)
        sgMail.send(msg)
            .then(() => console.log('✅ Confirmation email sent'))
            .catch(error => console.error('❌ Error sending email:', error.response?.body || error));

        res.json({ success: true, message: "Booking approved successfully", booking });
    } catch (error) {
        console.error("Error approving booking:", error);
        res.status(500).json({ success: false, error: "Failed to approve booking" });
    }
});

// Updated Reject booking endpoint with email
// app.post("/api/bookings/reject/:bookingId", verifyAdminToken, async (req, res) => {
//     try {
//         const booking = await Booking.findOne({ bookingId: req.params.bookingId });
//         if (!booking) return res.status(404).json({ success: false, error: "Booking not found" });

//         booking.status = 'rejected';
//         await booking.save();

//         // Send rejection email
//         const mailOptions = {
//             from: process.env.EMAIL_USER,
//             to: booking.email,
//             subject: `Booking Declined - ${booking.eventName}`,
//             html: `
//                 <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//                     <h2 style="color: #f44336;">Booking Not Approved</h2>
//                     <p>Dear ${booking.customerName},</p>
//                     <p>We regret to inform you that your booking request could not be approved.</p>
                    
//                     <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
//                         <p><strong>Booking ID:</strong> ${booking.bookingId}</p>
//                         <p><strong>Event:</strong> ${booking.eventName}</p>
//                         <p><strong>Event Date:</strong> ${new Date(booking.eventDate).toLocaleDateString()}</p>
//                     </div>
                    
//                     <p>This may be due to unavailability or other reasons. Please contact us for more information.</p>
//                     <p>We apologize for any inconvenience.</p>
//                 </div>
//             `
//         };

//         transporter.sendMail(mailOptions, (error, info) => {
//             if (error) {
//                 console.error('Error sending email:', error);
//             } else {
//                 console.log('Email sent:', info.response);
//             }
//         });

//         res.json({ success: true, message: "Booking rejected successfully", booking });
//     } catch (error) {
//         console.error("Error rejecting booking:", error);
//         res.status(500).json({ success: false, error: "Failed to reject booking" });
//     }
// });

app.post("/api/bookings/reject/:bookingId", verifyAdminToken, async (req, res) => {
    try {
        const booking = await Booking.findOne({ bookingId: req.params.bookingId });
        if (!booking) return res.status(404).json({ success: false, error: "Booking not found" });

        booking.status = 'rejected';
        await booking.save();

        // Send rejection email with SendGrid
        const msg = {
            to: booking.email,
            from: process.env.SENDGRID_FROM_EMAIL,
            subject: `Booking Declined - ${booking.eventName}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #f44336;">Booking Not Approved</h2>
                    <p>Dear ${booking.customerName},</p>
                    <p>We regret to inform you that your booking request could not be approved.</p>
                    
                    <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p><strong>Booking ID:</strong> ${booking.bookingId}</p>
                        <p><strong>Event:</strong> ${booking.eventName}</p>
                        <p><strong>Event Date:</strong> ${new Date(booking.eventDate).toLocaleDateString()}</p>
                    </div>
                    
                    <p>This may be due to unavailability or other reasons. Please contact us for more information.</p>
                    <p>We apologize for any inconvenience.</p>
                </div>
            `
        };

        sgMail.send(msg)
            .then(() => console.log('✅ Rejection email sent'))
            .catch(error => console.error('❌ Error sending email:', error.response?.body || error));

        res.json({ success: true, message: "Booking rejected successfully", booking });
    } catch (error) {
        console.error("Error rejecting booking:", error);
        res.status(500).json({ success: false, error: "Failed to reject booking" });
    }
});

// Cancel booking
app.post("/api/bookings/cancel/:bookingId", verifyAdminToken, async (req, res) => {
    try {
        const booking = await Booking.findOne({ bookingId: req.params.bookingId });
        if (!booking) return res.status(404).json({ success: false, error: "Booking not found" });

        booking.status = 'cancelled';
        await booking.save();

        res.json({ success: true, message: "Booking cancelled successfully", booking });
    } catch (error) {
        console.error("Error cancelling booking:", error);
        res.status(500).json({ success: false, error: "Failed to cancel booking" });
    }
});

// ------------------- Public Booking Routes ------------------- //

// Create booking with pending payment
app.post("/api/bookings/create", async (req, res) => {
    try {
        const {
            customerName,
            email,
            phone,
            eventName,
            eventDate,
            ticketType,
            numberOfTickets,
            pricePerTicket
        } = req.body;

        // Validation
        if (!customerName || !email || !phone || !eventName || !eventDate || !numberOfTickets || !pricePerTicket || !ticketType) {
            return res.status(400).json({
                success: false,
                error: "All fields are required"
            });
        }

        // Validate number of tickets
        if (numberOfTickets < 1) {
            return res.status(400).json({
                success: false,
                error: "Number of tickets must be at least 1"
            });
        }

        // Calculate total price
        const totalPrice = numberOfTickets * pricePerTicket;

        // Generate unique booking ID
        const bookingId = `BKG-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

        // Create new booking
        const booking = new Booking({
            bookingId,
            customerName,
            email,
            phone,
            eventName,
            eventDate: new Date(eventDate),
            ticketType,
            numberOfTickets,
            pricePerTicket,
            totalPrice,
            status: 'pending_payment'
        });

        await booking.save();

        res.status(201).json({
            success: true,
            message: "Booking created successfully",
            bookingId: booking.bookingId,
            booking: {
                bookingId: booking.bookingId,
                customerName: booking.customerName,
                email: booking.email,
                eventName: booking.eventName,
                numberOfTickets: booking.numberOfTickets,
                totalPrice: booking.totalPrice,
                status: booking.status
            }
        });

    } catch (error) {
        console.error("Booking creation error:", error);

        // Handle duplicate booking ID (very rare but possible)
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                error: "Booking ID conflict. Please try again."
            });
        }

        res.status(500).json({
            success: false,
            error: "Failed to create booking. Please try again."
        });
    }
});

// Get booking by ID (optional - for users to check their booking status)
app.get("/api/bookings/:bookingId", async (req, res) => {
    try {
        const booking = await Booking.findOne({ bookingId: req.params.bookingId });

        if (!booking) {
            return res.status(404).json({
                success: false,
                error: "Booking not found"
            });
        }

        res.json({
            success: true,
            booking: {
                bookingId: booking.bookingId,
                ticketId: booking.ticketId,
                customerName: booking.customerName,
                email: booking.email,
                phone: booking.phone,
                eventName: booking.eventName,
                eventDate: booking.eventDate,
                ticketType: booking.ticketType,
                numberOfTickets: booking.numberOfTickets,
                pricePerTicket: booking.pricePerTicket,
                totalPrice: booking.totalPrice,
                status: booking.status,
                createdAt: booking.createdAt,
                approvedAt: booking.approvedAt,
                bookingDate: booking.bookingDate
            }
        });
    } catch (error) {
        console.error("Error fetching booking:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch booking"
        });
    }
});

// List all admins (for debugging - remove in production)
app.get("/api/admin/list", async (req, res) => {
    const admins = await Admin.find().select('-password');
    res.json(admins);
});

// ------------------- Start Server ------------------- //
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
