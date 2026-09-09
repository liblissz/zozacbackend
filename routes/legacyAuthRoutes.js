import { Router } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { JWT_SECRET } from '../middleware/auth.js';

const router = Router();

const publicUser = (user) => ({
    ...user.toObject(),
    id: user._id,
    _id: user._id,
    status: user.status || 'approved',
    role: user.role || 'admin',
});

const createToken = (user) => jwt.sign({
    id: user._id,
    username: user.username,
    role: user.role || 'admin',
}, JWT_SECRET, { expiresIn: '1d' });

// Backward-compatible endpoint used by older dashboard bundles.
router.get('/signup/admin', async (_req, res) => {
    try {
        const users = await User.find().select('-password').sort({ date: -1 });
        return res.json(users.map(publicUser));
    } catch (error) {
        console.error('Legacy member list error:', error);
        return res.status(500).json({ message: 'Could not retrieve users' });
    }
});

router.post('/login/admin', async (req, res) => {
    try {
        const identifier = (req.body.username || req.body.email)?.trim().toLowerCase();
        const user = await User.findOne({
            $or: [{ username: identifier }, { email: identifier }],
        });

        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        if (user.status === 'pending') return res.status(403).json({ success: false, message: 'User approval is pending' });
        if (user.status === 'rejected') return res.status(403).json({ success: false, message: 'User was not approved' });

        return res.json({ message: 'Login successful', success: true, token: createToken(user), user: publicUser(user) });
    } catch (error) {
        console.error('Legacy login error:', error);
        return res.status(500).json({ success: false, message: 'Unable to log in' });
    }
});

export default router;
