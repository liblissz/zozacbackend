import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3,
        maxlength: 32,
        match: /^[a-zA-Z0-9._-]+$/,
    },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    about: { type: String, required: true, trim: true },
    number: { type: String, required: true, trim: true },
    password: { type: String, required: true, select: false },
    profileImage: { type: String, required: true },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
    },
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    date: { type: Date, default: Date.now },
    projects: [{
        title: String,
        description: String,
        completed: Boolean,
        GithubLink: String,
        imageUrlwork: String,
        ratings: [{
            userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            value: { type: Number, min: 1, max: 5 },
        }],
        date: { type: Date, default: Date.now },
    }],
}, { timestamps: true, collection: 'zozac-admins' });

export default mongoose.models.User || mongoose.model('User', userSchema);