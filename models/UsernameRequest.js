import mongoose from 'mongoose';

const usernameRequestSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        minlength: 3,
        maxlength: 32,
        match: /^[a-zA-Z0-9._-]+$/,
    },
    email: { type: String, required: true, trim: true, lowercase: true },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
    },
}, { timestamps: true, collection: 'zozac-username-requests' });

export default mongoose.models.UsernameRequest || mongoose.model('UsernameRequest', usernameRequestSchema);