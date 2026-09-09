import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import UsernameRequest from '../models/UsernameRequest.js';
import { JWT_SECRET, requireAdmin, requireAuth } from '../middleware/auth.js';

const router = Router();
const SALT_ROUNDS = 10;

const publicUser = (user) => ({
    id: user._id,
    _id: user._id,
    username: user.username,
    email: user.email,
    about: user.about,
    number: user.number,
    profileImage: user.profileImage,
    status: user.status || 'approved',
    role: user.role || 'admin',
});

router.post('/register', async (req, res) => {
    try {
        const { username, email, about, number, password, profileImage } = req.body;

        if (!username || !email || !about || !number || !password || !profileImage) {
            return res.status(400).json({ message: 'All registration fields are required' });
        }

        const normalizedUsername = username.trim().toLowerCase();
        const normalizedEmail = email.trim().toLowerCase();
        const existing = await User.findOne({
            $or: [{ username: normalizedUsername }, { email: normalizedEmail }],
        });

        if (existing) {
            return res.status(409).json({ message: 'Username or email is already registered' });
        }

        const user = await User.create({
            username: normalizedUsername,
            email: normalizedEmail,
            about: about.trim(),
            number: String(number).trim(),
            password: await bcrypt.hash(password, SALT_ROUNDS),
            profileImage,
            status: 'pending',
            role: 'member',
        });

        return res.status(201).json({
            message: 'Registration submitted. An administrator must approve your account before you can sign in.',
            user: publicUser(user),
        });
    } catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({ message: 'Unable to submit registration' });
    }
});

router.post('/username-request', async (req, res) => {
    try {
        const username = req.body.username?.trim().toLowerCase();
        const email = req.body.email?.trim().toLowerCase();

        if (!username || !email) {
            return res.status(400).json({ message: 'Username and email are required' });
        }
        if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username)) {
            return res.status(400).json({ message: 'Username must be 3-32 letters, numbers, dots, underscores, or hyphens' });
        }

        const [existingUser, existingRequest] = await Promise.all([
            User.findOne({ username }),
            UsernameRequest.findOne({ username, status: 'pending' }),
        ]);

        if (existingUser) {
            return res.status(409).json({ message: 'That username is already in use' });
        }
        if (existingRequest) {
            if (existingRequest.email === email) {
                return res.status(200).json({ message: 'Your username request is already pending approval' });
            }
            return res.status(409).json({ message: 'A request for that username is already pending' });
        }

        await UsernameRequest.create({ username, email, status: 'pending' });
        return res.status(201).json({ message: 'Username request sent for administrator approval' });
    } catch (error) {
        console.error('Username request error:', error);
        return res.status(500).json({ message: 'Unable to submit username request' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const username = req.body.username?.trim();
        const user = username
            ? await User.findOne({ username: { $regex: `^${username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } })
            : null;

        if (!username || !user) {
            return res.status(401).json({ message: 'Username not found' });
        }

        const normalizedUsername = user.username.trim().toLowerCase();

        if (user.status === 'pending') {
            const approvedRequest = await UsernameRequest.findOne({
                username: normalizedUsername,
                email: user.email,
                status: 'approved',
            });

            if (approvedRequest) {
                user.status = 'approved';
                await user.save();
            } else {
                return res.status(403).json({ message: 'Your registration is waiting for administrator approval' });
            }
        }
        if (user.status === 'rejected') {
            return res.status(403).json({ message: 'Your registration was not approved' });
        }

        const token = jwt.sign({ id: user._id, username: user.username, role: user.role || 'admin' }, JWT_SECRET, { expiresIn: '1d' });
        return res.json({ message: 'Login successful', token, user: publicUser(user) });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ message: 'Unable to log in' });
    }
});

router.get('/members', requireAuth, requireAdmin, async (_req, res) => {
    const users = await User.find().select('-password').sort({ createdAt: -1, date: -1 });
    return res.json(users.map(publicUser));
});

router.get('/username-requests', requireAuth, requireAdmin, async (_req, res) => {
    const requests = await UsernameRequest.find().sort({ createdAt: -1 });
    return res.json(requests);
});

router.patch('/username-requests/:id/status', requireAuth, requireAdmin, async (req, res) => {
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: 'Status must be approved or rejected' });
    }

    const request = await UsernameRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Username request not found' });

    if (status === 'approved') {
        const usernameInUse = await User.findOne({ username: request.username });
        if (usernameInUse) return res.status(409).json({ message: 'That username is already in use' });

        const member = await User.findOneAndUpdate(
            { email: request.email },
            { username: request.username, status: 'approved' },
            { new: true }
        ).select('-password');

        if (!member) return res.status(404).json({ message: 'No member account matches this email' });
    }

    request.status = status;
    await request.save();
    return res.json({ message: `Username request ${status}`, request });
});

router.patch('/members/:id/status', requireAuth, requireAdmin, async (req, res) => {
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: 'Status must be approved or rejected' });
    }

    const user = await User.findByIdAndUpdate(req.params.id, { status }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'Member not found' });
    return res.json({ message: `Member ${status}`, user: publicUser(user) });
});

export default router;