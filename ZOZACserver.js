import express from "express";
import dotenv from 'dotenv';
import cors from 'cors';
import { connectDatabase, mongoose } from './config/database.js';
import { createSocketServer } from './config/socket.js';
import { createEmailApi } from './config/email.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from './models/User.js';
import authRoutes from './routes/authRoutes.js';
import legacyAuthRoutes from './routes/legacyAuthRoutes.js';
import Message from './AImodules/aimessages.js'
import Conversation from "./AImodules/Conversation.js";
import axios from 'axios'


import bodyParser from 'body-parser';

import crypto from 'crypto';

dotenv.config({ path: "./config.env" });

const app = express();
const { server } = createSocketServer(app);
const emailApi = createEmailApi();


app.use(cors());
app.use(express.json());
app.use(bodyParser.json());
app.use('/api/auth', authRoutes);
app.use('/api', legacyAuthRoutes);

const SORT_ROUNDS = 6;

const normaluserschema = mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  number: { type: Number, required: true },
  about: { type: String, required: true },
  password: { type: String, required: true },
  image: { type: String, required: true },
  date: {
    type: String,
    default: () =>
      new Date().toLocaleString('en-US', {
        timeZone: 'Africa/Douala',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
  }
});

const normalusermodel = mongoose.model('normalzozacusers', normaluserschema);
// Register a new user
app.post('/normal/users', async (req, res) => {
  try {
    const { name, about, password, email, number, image } = req.body;

    // Check if email already exists
    const checkemail = await normalusermodel.findOne({ email });
    if (checkemail) {
      return res.status(400).json({ message: 'Email already taken' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, SORT_ROUNDS);

    // Save new user
    const saveusers = new normalusermodel({
      name,
      about,
      email,
      number,
      password: hashedPassword,
      image,
    });

    await saveusers.save();

    // Generate JWT
    const token = jwt.sign({ email }, 'user-token', { expiresIn: '1d' });

    // Send response
    res.status(200).json({ message: 'User registered successfully', token });

    // Notify all admins
    const admins = await User.find();
    const date = new Date();

    for (const admin of admins) {
      try {
        const sendSmtpEmail = {
          sender: { email: 'vildashnetwork@gmail.com', name: 'zozac' },
          to: [{ email: admin.email }],
          subject: `🚀 A New User Just Signed Up: ${name}`,
          htmlContent: `
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1" />
              <title>New User Notification</title>
            </head>
            <body>
              <table width="100%" bgcolor="#000000" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px;">
                    <table width="600" bgcolor="#1c1c1c" style="border-radius: 8px; box-shadow: 0 0 20px rgba(0,0,255,0.3);">
                      <tr>
                        <td align="center">
                          <img src="${image}" alt="User Image" width="600" style="width:100%; object-fit:cover; filter:brightness(0.7);" />
                          <div style="padding: 20px; color: green;">
                            <h1 style="font-family: Georgia, serif; font-size: 32px;">🚀 Hello ${admin.username}</h1>
                            <p style="font-size: 18px;">A new user has just registered on Pefscom</p>
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 0 30px 30px;">
                          <h2 style="color: green;">User Details</h2>
                          <p style="color: green;"><strong>Name:</strong> ${name}</p>
                          <p style="color: green;"><strong>Email:</strong> ${email}</p>
                          <p style="color: green;"><strong>About:</strong> ${about}</p>
                          <p style="color: green;"><strong>Phone:</strong> ${number}</p>
                          <p style="color: green;"><strong>Signup Date:</strong> ${date.toLocaleString()}</p>
                          <hr style="border-color: blue;" />
                          <p style="font-size: 0.9em; color: green;">This is an automatic notification to zozac admins.</p>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding: 20px; background: #111; color: green;">
                          <p>Pefscom &copy; 2025 | All rights reserved</p>
                          <p>Contact: <a href="mailto:info@zozac.com" style="color:rgb(4, 114, 0);">info@zozac.com</a></p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
          `,
        };

        const result = await emailApi.sendTransacEmail(sendSmtpEmail);
        console.log(`📧 Email sent to: ${admin.email} | MessageId: ${result.messageId}`);
      } catch (emailErr) {
        console.error(`❌ Failed to email ${admin.email}:`, emailErr.message);
      }
    }

  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


//get all normal users
app.get('/normal/users', async (req, res) => {
  try {
    const users = await normalusermodel.find().sort({ date: -1 });
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});



// Get single user by ID
app.get('/normal/users/:id', async (req, res) => {
  try {
    const userdata = await normalusermodel.findById(req.params.id);
    if (!userdata) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json(userdata);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error getting user' });
  }
});


// Middleware to verify token
const verifynormaluserstoken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access denied, token missing' });
  }

  try {
    const verified = jwt.verify(token, 'user-token');
    req.user = verified;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Get logged-in user's profile
app.get('/api/normaluser/profile', verifynormaluserstoken, async (req, res) => {
  try {
    const email = req.user.email;
    const user = await normalusermodel.findOne({ email }).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});


// Get logged-in user's profile
app.get('/api/normaluser/profile', verifynormaluserstoken, async (req, res) => {
  try {
    const email = req.user.email;
    const user = await normalusermodel.findOne({ email }).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login route
app.post('/api/login/users', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: 'Email and password are required' });
    }

    const user = await normalusermodel.findOne({ email });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: 'Your password is incorrect' });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email },
      'user-token',
      { expiresIn: '1d' }
    );

    return res.status(200).json({
      message: 'Login successful',
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});




const otpSchema = new mongoose.Schema({
  email: { type: String, required: true },
  otp: { type: String, required: true },
  expiresAt: { type: Date, required: true }
});
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index
const OTPmodel = mongoose.model("OTP", otpSchema);


app.post('/api/auth/request-reset-password', async (req, res) => {
  let { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }
  email = email.trim().toLowerCase();

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await OTPmodel.findOneAndUpdate(
      { email },
      { otp, expiresAt },
      { upsert: true, new: true }
    );

    const sendSmtpEmail = {
      sender: { email: 'vildashnetwork@gmail.com', name: 'zozac' },
      to: [{ email }],
      subject: "Your Password Reset OTP Code",
      htmlContent: `
        <p>Hello,</p>
        <p>Your OTP code to reset your password is: <strong style="font-size:24px;color:#0000FF;">${otp}</strong></p>
        <p>This code will expire in 5 minutes.</p>
        <p>If you did not request a password reset, please ignore this email.</p>
        <br/>
        <p>Pefscom Team</p>
      `
    };

    try {
      const result = await emailApi.sendTransacEmail(sendSmtpEmail);
      console.log(`OTP email sent to ${email} with messageId: ${result.messageId}`);
    } catch (emailError) {
      console.error('Error sending OTP email:', emailError);
      return res.status(500).json({ message: "Error sending OTP email" });
    }

    res.status(200).json({ message: "OTP sent to your email", success: true });
  } catch (error) {
    console.error("Error in request-reset-password:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});




app.post('/api/auth/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword)
    return res.status(400).json({ message: "Email, OTP and new password are required" });

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const otpEntry = await OTPmodel.findOne({ email: normalizedEmail });

    if (!otpEntry)
      return res.status(400).json({ message: "OTP not found or expired" });

    if (otpEntry.otp.toString() !== otp.toString())
      return res.status(400).json({ message: "Invalid OTP" });

    if (otpEntry.expiresAt < new Date())
      return res.status(400).json({ message: "OTP expired" });

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    const updatedUser = await User.findOneAndUpdate(
      { email: normalizedEmail },
      { password: hashedPassword },
      { new: true }
    );

    if (!updatedUser)
      return res.status(404).json({ message: "User not found" });

    await OTPmodel.deleteOne({ email: normalizedEmail });

    res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    console.error("Error in reset-password:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});




const verifyToken = (req, res, next) => {
  // The token is usually sent as: "Authorization: Bearer <token>"
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // get token after "Bearer"

  if (!token) {
    return res.status(401).json({ message: 'Access denied, token missing' });
  }

  try {
    const verified = jwt.verify(token, 'auth-token'); // your secret key here
    req.user = verified; // attach user data (e.g. email) to request object
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};


app.get('/api/profile', verifyToken, async (req, res) => {
  try {
    const email = req.user.email;
    const user = await User.findOne({ username: req.user.username }).select('-password'); // exclude password

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});
app.get("/api/user/add-project/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('projects');
    res.status(200).json(user.projects); // ✅ returns just the array
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});
//adding users project

// POST: Add a new project to a user
app.post('/api/user/add-project/:id', async (req, res) => {
  try {
    const { title, description, completed, GithubLink, imageUrlwork } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const newProject = {
      title,
      description,
      completed,
      GithubLink,
      imageUrlwork,
      date: new Date(), // optional: override date
    };

    user.projects.push(newProject);
    await user.save();

    res.status(200).json({
      message: 'Project added successfully',
      project: newProject,
    });
  } catch (error) {
    console.error('❌ Error adding project:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});





// ✅ Get all projects for a specific user
app.get("/api/user/projects/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('projects');

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user.projects);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});




const sucbscribeSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true
    },
    date: {
      type: String,
      default: new Date()
    }
  }
)

const subscribemodel = mongoose.model("subscribers", sucbscribeSchema)



app.post("/subscribe", async (req, res) => {
  try {
    const { email } = req.body
    const saveuser = subscribemodel({ email })
    await saveuser.save();
    res.status(200).json({ message: "subscriber saved " })
  } catch (error) {
    res.status(500).json({ message: "internal server error" })
    console.log('====================================');
    console.log(error);
    console.log('====================================');
  }

})



//reating project


app.put('/api/user/rate-project/:userId/:projectId', async (req, res) => {
  const { userId, projectId } = req.params;
  const { rating } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const project = user.projects.id(projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });

    // Check if user already rated
    const existingRating = project.ratings.find(r => r.userId.toString() === userId);
    if (existingRating) {
      existingRating.value = rating; // update
    } else {
      project.ratings.push({ userId, value: rating }); // new
    }

    await user.save();

    // Calculate average
    const total = project.ratings.reduce((sum, r) => sum + r.value, 0);
    const avg = total / project.ratings.length;

    // Return updated data
    res.status(200).json({
      ...project.toObject(),
      averageRating: avg,
      ratingsCount: project.ratings.length,
    });

  } catch (error) {
    console.error("Rating error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get('/api/user/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
    if (!user) {
      return res.status(404).json({ message: 'Note not found' })
    }
    res.status(200).json(user)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Server error' })
  }
})


//edit user


app.put('/user/edit/:id', async (req, res) => {
  try {
    const { username, email, password, about, number, profileImage } = req.body;

    // Hash the new password if provided
    let updatedFields = { username, email, about, number, profileImage };
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 6);
      updatedFields.password = hashedPassword;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      updatedFields,
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User ID not found" });
    }

    res.status(200).json({ message: "User edited successfully", user: updatedUser });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});



//picture post 


const PictureSchema = mongoose.Schema(
  {
    title: {
      type: String,
      required: true
    },
    content: {
      type: String,
      required: true
    },
    price: {
      type: String,
      required: true
    },
    ImageUrl: {
      type: String,
      required: true
    },
    date: {
      type: String,
      default: () => new Date().toLocaleString('en-US', {
        timeZone: 'Africa/Douala',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    }

  });

//Picture model

const pictureModel = mongoose.model("PicturePosts", PictureSchema)



const NotificationSchema = new mongoose.Schema({
  type: { type: String, required: true }, // e.g. 'post', 'video', 'user'
  title: { type: String, required: true },
  content: { type: String, required: true },
  message: { type: String, required: true },
  icon: { type: String, default: '' },
  date: {
    type: String,
    default: () => new Date().toLocaleString('en-US', {
      timeZone: 'Africa/Douala',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }
});

const NotificationModel = mongoose.model('Notification', NotificationSchema);


//post pictures
app.post("/admin/picture/post", async (req, res) => {
  try {
    const { title, content, price, ImageUrl, date } = req.body;

    // Save post
    const savePost = new pictureModel({ title, content, price, ImageUrl, date });
    await savePost.save();

    // Notify admins
    const admins = await User.find();

    for (const admin of admins) {
      try {
        const sendSmtpEmail = {
          sender: { email: 'vildashnetwork@gmail.com', name: 'ZOZAC' },
          to: [{ email: admin.email }],
          subject: `🚀 New Project Posted On ZOZAC: ${title}`,
          htmlContent: `
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1" />
              <title>Pefscom Posts Notification</title>
            </head>
            <body>
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#000000">
                <tr>
                  <td align="center" style="padding: 20px 10px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width:600px; background: linear-gradient(135deg, #000000 0%, #1c1c1c 100%); border-radius: 8px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,255,0.3);">
                      <tr>
                        <td align="center">
                          <img src="${ImageUrl}" alt="Project Image" width="600" style="display:block; width:100%; height:auto; object-fit: cover; filter: brightness(0.7);" />
                          <div style="padding: 20px; text-align: center; color: green;">
                            <h1 style="font-size: 36px; font-weight: 700; font-family: 'Georgia', serif; text-shadow: 0 0 10px rgba(0, 81, 255, 0.9);">
                              🚀Hello ${admin.username} <br><br> A New Post Notification
                            </h1>
                            <p style="font-size: 18px;">A new Picture Post has been added to ZOZAC</p>
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 0 30px 30px;">
                          <h2 style="color: green; font-family: 'Georgia', serif; font-size: 24px; margin-bottom: 10px;">Post Details</h2>
                          <p><strong>Title:</strong> ${title}</p>
                          <p style="color: green;"><strong>Description:</strong> ${content}</p>
                          <p style="color: green;"><strong>Price:</strong> ${price}</p>
                          <p style="color: green;"><strong>Date:</strong> ${new Date(date).toLocaleString()}</p>
                          <hr style="border-color: blue;">
                          <p style="font-size: 0.9em; color: green;">This is an automatic notification to ZOZAC admins.</p>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding: 20px; background: #111; color: green; font-size: 14px;">
                          <p style="margin: 0;">Pefscom &copy; 2025 | All rights reserved</p>
                          <p style="margin: 0;">Contact us: <a href="mailto:infor@zozac.org" style="color: #1e90ff; text-decoration: none;">infor@zozac.org</a></p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
          `
        };

        const result = await emailApi.sendTransacEmail(sendSmtpEmail);
        console.log(`📧 Email sent to: ${admin.email} | MessageId: ${result.messageId}`);
      } catch (emailErr) {
        console.error(`❌ Failed to email ${admin.email}:`, emailErr.message);
      }
    }

    //subscribers

    const subscribers = await subscribemodel.find();

    for (const subscriber of subscribers) {
      try {
        const sendSmtpEmail = {
          sender: { email: 'vildashnetwork@gmail.com', name: 'ZOZAC' },
          to: [{ email: subscriber.email }],
          subject: `🚀 New Project Posted On ZOZAC: ${title}`,
          htmlContent: `
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1" />
              <title>Pefscom Posts Notification</title>
            </head>
            <body>
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#000000">
                <tr>
                  <td align="center" style="padding: 20px 10px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width:600px; background: linear-gradient(135deg, #000000 0%, #1c1c1c 100%); border-radius: 8px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,255,0.3);">
                      <tr>
                        <td align="center">
                          <img src="${ImageUrl}" alt="Project Image" width="600" style="display:block; width:100%; height:auto; object-fit: cover; filter: brightness(0.7);" />
                          <div style="padding: 20px; text-align: center; color: green;">
                            <h1 style="font-size: 36px; font-weight: 700; font-family: 'Georgia', serif; text-shadow: 0 0 10px rgba(0, 81, 255, 0.9);">
                              🚀Hello A New Post Notification
                            </h1>
                            <p style="font-size: 18px;">A new Picture Post has been added to ZOZAC</p>
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 0 30px 30px;">
                          <h2 style="color: green; font-family: 'Georgia', serif; font-size: 24px; margin-bottom: 10px;">Post Details</h2>
                          <p><strong>Title:</strong> ${title}</p>
                          <p style="color: green;"><strong>Description:</strong> ${content}</p>
                          <p style="color: green;"><strong>Price:</strong> ${price}</p>
                          <p style="color: green;"><strong>Date:</strong> ${new Date(date).toLocaleString()}</p>
                          <hr style="border-color: blue;">
                          <p style="font-size: 0.9em; color: green;">This is an automatic notification to ZOZAC subscribers if you are 
                          recieving this meaning you subscribed to our news teller.</p>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding: 20px; background: #111; color: green; font-size: 14px;">
                          <p style="margin: 0;">Pefscom &copy; 2025 | All rights reserved</p>
                          <p style="margin: 0;">Contact us: <a href="mailto:infor@zozac.org" style="color: #1e90ff; text-decoration: none;">infor@zozac.org</a></p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
          `
        };

        const result = await emailApi.sendTransacEmail(sendSmtpEmail);
        console.log(`📧 Email sent to: ${subscriber.email} | MessageId: ${result.messageId}`);
      } catch (emailErr) {
        console.error(`❌ Failed to email ${subscriber.email}:`, emailErr.message);
      }
    }

    // Notify normal users
    const users = await normalusermodel.find();

    for (const user of users) {
      try {
        const sendSmtpEmail = {
          sender: { email: 'vildashnetwork@gmail.com', name: 'ZOZAC' },
          to: [{ email: user.email }], // fixed here
          subject: `🚀 New Project Posted On ZOZAC SYSTEM: ${user.name}`,
          htmlContent: `
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1" />
              <title>Pefscom Posts Notification</title>
            </head>
            <body>
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#000000">
                <tr>
                  <td align="center" style="padding: 20px 10px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width:600px; background: linear-gradient(135deg, #000000 0%, #1c1c1c 100%); border-radius: 8px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,255,0.3);">
                      <tr>
                        <td align="center">
                          <img src="${ImageUrl}" alt="Project Image" width="600" style="display:block; width:100%; height:auto; object-fit: cover; filter: brightness(0.7);" />
                          <div style="padding: 20px; text-align: center; color: green;">
                            <h1 style="font-size: 36px; font-weight: 700; font-family: 'Georgia', serif; text-shadow: 0 0 10px rgba(0, 81, 255, 0.9);">
                              🚀Hello ${user.name} <br><br> A New Posts Notification
                            </h1>
                            <p style="font-size: 18px;">A new Picture Post has been added to ZOZAC</p>
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 0 30px 30px;">
                          <h2 style="color: green; font-family: 'Georgia', serif; font-size: 24px; margin-bottom: 10px;">Post Details</h2>
                          <p><strong>Title:</strong> ${title}</p>
                          <p style="color: green;"><strong>Description:</strong> ${content}</p>
                          <p style="color: green;"><strong>Price:</strong> ${price}</p>
                          <p style="color: green;"><strong>Date:</strong> ${new Date(date).toLocaleString()}</p>
                          <hr style="border-color: blue;">
                          <p style="font-size: 0.9em; color: green;">This is an automatic notification to ZOZAC Users.</p>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding: 20px; background: #111; color: green; font-size: 14px;">
                          <p style="margin: 0;">Pefscom &copy; 2025 | All rights reserved</p>
                          <p style="margin: 0;">Contact us: <a href="mailto:infor@zozac.org" style="color: #1e90ff; text-decoration: none;">infor@zozac.org</a></p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
          `
        };

        const result = await emailApi.sendTransacEmail(sendSmtpEmail);
        console.log(`📧 Email sent to: ${user.email} | MessageId: ${result.messageId}`);
      } catch (emailErr) {
        console.error(`❌ Failed to email ${user.email}:`, emailErr.message);
      }
    }

    // Save notification to DB
    const notification = new NotificationModel({
      type: 'post',
      title,
      content,
      date,
      message: `${title}: ${content}`,
      icon: ImageUrl,
    });
    await notification.save();

    // Emit socket.io notification
    const io = req.app.get('io');
    io.emit('PushPostNotification', { savePost: savePost.toObject() });
    console.log('📢 Emitting new post notification:', savePost.title);

    res.status(200).json({ message: "Post made successfully" });
  } catch (error) {
    console.error('Error in /admin/picture/post:', error);
    res.status(500).json({ message: "Internal server error" });
  }
});



app.get('/admin/picture/post/:id', async (req, res) => {

  try {
    const videopost = await pictureModel.findById(req.params.id)
    res.status(200).json(videopost)
  } catch (error) {
    res.status(500).json({ message: "internal server error" })
    console.log('====================================');
    console.log(err);
    console.log('====================================');
  }
})


app.get("/api/notifications", async (req, res) => {
  try {
    const AllNotifications = await NotificationModel.find().sort({ createdAt: -1 })
    res.status(200).json(AllNotifications);
  } catch (error) {
    res.status(500).json({ message: "internal server error" })
  }
})


app.get('/admin/picture/post', async (req, res) => {
  try {
    const allpicturepost = await pictureModel
      .find()
      .sort({ date: -1 });

    res.status(201).json(allpicturepost)
  } catch (error) {
    res.status(500).json({ message: "internal server error" })
    console.log('====================================');
    console.log(error);
    console.log('====================================');
  }
})

app.patch('/admin/picture/post/:id', async (req, res) => {
  try {
    const { title, content, price, ImageUrl } = req.body;
    const post = await pictureModel.findByIdAndUpdate(
      req.params.id,
      { title, content, price, ...(ImageUrl ? { ImageUrl } : {}) },
      { new: true, runValidators: true }
    );
    if (!post) return res.status(404).json({ message: 'Picture post not found' });
    return res.json(post);
  } catch (error) {
    console.error('Error updating picture post:', error);
    return res.status(500).json({ message: 'Unable to update picture post' });
  }
});

app.delete('/admin/picture/post/:id', async (req, res) => {
  try {
    const post = await pictureModel.findByIdAndDelete(req.params.id);
    if (!post) return res.status(404).json({ message: 'Picture post not found' });
    return res.json({ message: 'Picture post deleted' });
  } catch (error) {
    console.error('Error deleting picture post:', error);
    return res.status(500).json({ message: 'Unable to delete picture post' });
  }
});


const VideoSchema = mongoose.Schema(
  {
    title: {
      type: String,
      required: true
    },
    content: {
      type: String,
      required: true
    },
    price: {
      type: String,
      required: true
    },
    VidUrl: {
      type: String,
      required: true
    },
    date: {
      type: String,
      default: () => new Date().toLocaleString('en-US', {
        timeZone: 'Africa/Douala',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    }

  });


//Picture model

const VideoModel = mongoose.model("VideoPosts", VideoSchema)
app.post("/admin/video/post", async (req, res) => {
  try {
    const { title, content, price, VidUrl, date } = req.body;

    const savePostvideo = new VideoModel({ title, content, price, VidUrl, date });
    await savePostvideo.save();

    // Notify admins
    const admins = await User.find();

    for (const admin of admins) {
      try {
        const sendSmtpEmail = {
          sender: { email: 'vildashnetwork@gmail.com', name: 'ZOZAC' },
          to: [{ email: admin.email }],
          subject: `🚀 New Project Posted On ZOZAC: ${title}`,
          htmlContent: `
              <!DOCTYPE html>
              <html lang="en">
              <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Pefscom Posts Notification</title></head>
              <body>
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#000000">
                  <tr><td align="center" style="padding: 20px 10px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width:600px; background: linear-gradient(135deg, #000000 0%, #1c1c1c 100%); border-radius: 8px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,255,0.3);">
                      <tr><td align="center">
                        <a href="${VidUrl}">CLICK HERE TO SEE THE VIDEO</a>
                        <div style="padding: 20px; text-align: center; color: green;">
                          <h1 style="font-size: 36px; font-weight: 700; font-family: 'Georgia', serif; text-shadow: 0 0 10px rgba(0, 81, 255, 0.9);">🚀 New Post Notification</h1>
                          <p style="font-size: 18px;">A new Video Post has been added to ZOZAC</p>
                        </div>
                      </td></tr>
                      <tr><td style="padding: 0 30px 30px;">
                        <h2 style="color: green; font-family: 'Georgia', serif; font-size: 24px; margin-bottom: 10px;">Post Details</h2>
                        <p><strong>Title:</strong> ${title}</p>
                        <p style="color: green;"><strong>Description:</strong> ${content}</p>
                        <p style="color: green;"><strong>Price:</strong> ${price}</p>
                        <p style="color: green;"><strong>Date:</strong> ${new Date(date).toLocaleString()}</p>
                        <hr style="border-color: blue;">
                        <p style="font-size: 0.9em; color: green;">This is an automatic notification to ZOZAC admins.</p>
                      </td></tr>
                      <tr><td align="center" style="padding: 20px; background: #111; color: green; font-size: 14px;">
                        <p style="margin: 0;">Pefscom &copy; 2025 | All rights reserved</p>
                        <p style="margin: 0;">Contact us: <a href="mailto:infor@zozac.org" style="color: #1e90ff; text-decoration: none;">infor@zozac.org</a></p>
                      </td></tr>
                    </table>
                  </td></tr>
                </table>
              </body>
              </html>
            `
        };
        const result = await emailApi.sendTransacEmail(sendSmtpEmail);
        console.log(`📧 Email sent to: ${admin.email} | MessageId: ${result.messageId}`);
      } catch (emailErr) {
        console.error(`❌ Failed to email ${admin.email}:`, emailErr.message);
      }
    }

    // Notify normal users
    const users = await normalusermodel.find();

    for (const user of users) {
      try {
        const sendSmtpEmail = {
          sender: { email: 'vildashnetwork@gmail.com', name: 'ZOZAC' },
          to: [{ email: user.email }],
          subject: `🚀 New Project Posted On ZOZAC: ${user.name}`,
          htmlContent: `
              <!DOCTYPE html>
              <html lang="en">
              <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Pefscom Posts Notification</title></head>
              <body>
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#000000">
                  <tr><td align="center" style="padding: 20px 10px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width:600px; background: linear-gradient(135deg, #000000 0%, #1c1c1c 100%); border-radius: 8px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,255,0.3);">
                      <tr><td align="center">
                        <a href="${VidUrl}">CLICK HERE TO SEE THE VIDEO</a>
                        <div style="padding: 20px; text-align: center; color: green;">
                          <h1 style="font-size: 36px; font-weight: 700; font-family: 'Georgia', serif; text-shadow: 0 0 10px rgba(0, 81, 255, 0.9);">
                            🚀Hello ${user.name}<br><br><br> New Posts Notification
                          </h1>
                          <p style="font-size: 18px;">A new Video Post has been added to ZOZAC</p>
                        </div>
                      </td></tr>
                      <tr><td style="padding: 0 30px 30px;">
                        <h2 style="color: green; font-family: 'Georgia', serif; font-size: 24px; margin-bottom: 10px;">Post Details</h2>
                        <p><strong>Title:</strong> ${title}</p>
                        <p style="color: green;"><strong>Description:</strong> ${content}</p>
                        <p style="color: green;"><strong>Price:</strong> ${price}</p>
                        <p style="color: green;"><strong>Date:</strong> ${new Date(date).toLocaleString()}</p>
                        <hr style="border-color: blue;">
                        <p style="font-size: 0.9em; color: green;">This is an automatic notification to ZOZAC Users.</p>
                      </td></tr>
                      <tr><td align="center" style="padding: 20px; background: #111; color: green; font-size: 14px;">
                        <p style="margin: 0;">Pefscom &copy; 2025 | All rights reserved</p>
                        <p style="margin: 0;">Contact us: <a href="mailto:infor@zozac.org" style="color: #1e90ff; text-decoration: none;">infor@zozac.org</a></p>
                      </td></tr>
                    </table>
                  </td></tr>
                </table>
              </body>
              </html>
            `
        };
        const result = await emailApi.sendTransacEmail(sendSmtpEmail);
        console.log(`📧 Email sent to: ${user.email} | MessageId: ${result.messageId}`);
      } catch (emailErr) {
        console.error(`❌ Failed to email ${user.email}:`, emailErr.message);
      }
    }

    // Emit socket.io notification
    const io = req.app.get('io');
    io.emit('PushPostvideoNotification', { savePostvideo: savePostvideo.toObject() });
    console.log('📢 Emitting new video post:', savePostvideo.title);

    res.status(200).json({ message: "post made successfully" });
  } catch (error) {
    console.error('Error in /admin/video/post:', error);
    res.status(500).json({ message: "internal server error" });
  }
});






app.get('/admin/video/post', async (req, res) => {
  try {
    const allvideopost = await VideoModel.find().sort({ date: -1 });
    res.status(201).json(allvideopost)
  } catch (error) {
    res.status(500).json({ message: "internal server error" })
    console.log('====================================');
    console.log(error);
    console.log('====================================');
  }
})


app.get('/admin/video/post/:id', async (req, res) => {

  try {
    const videopost = await VideoModel.findById(req.params.id)
    res.status(200).json(videopost)
  } catch (error) {
    res.status(500).json({ message: "internal server error" })
    console.log('====================================');
    console.log(err);
    console.log('====================================');
  }
})

app.patch('/admin/video/post/:id', async (req, res) => {
  try {
    const { title, content, price, VidUrl } = req.body;
    const post = await VideoModel.findByIdAndUpdate(
      req.params.id,
      { title, content, price, ...(VidUrl ? { VidUrl } : {}) },
      { new: true, runValidators: true }
    );
    if (!post) return res.status(404).json({ message: 'Video post not found' });
    return res.json(post);
  } catch (error) {
    console.error('Error updating video post:', error);
    return res.status(500).json({ message: 'Unable to update video post' });
  }
});

app.delete('/admin/video/post/:id', async (req, res) => {
  try {
    const post = await VideoModel.findByIdAndDelete(req.params.id);
    if (!post) return res.status(404).json({ message: 'Video post not found' });
    return res.json({ message: 'Video post deleted' });
  } catch (error) {
    console.error('Error deleting video post:', error);
    return res.status(500).json({ message: 'Unable to delete video post' });
  }
});




app.get('/api/notifications', async (req, res) => {
  try {
    // fetch recent 50 notifications sorted by newest first
    const notifications = await NotificationModel.find().sort({ createdAt: -1 }).limit(50);
    res.status(200).json(notifications);
  } catch (error) {
    console.error("Failed to fetch notifications", error);
    res.status(500).json({ message: "Internal server error" });
  }
});


const companyprojectSchema = new mongoose.Schema({
  title: String,
  description: String,
  startDate: Date,
  endDate: Date,
  expectedCompletionTime: Number,
  category: String,
  budget: Number,
  impact: String,
  projectImg: { type: String, default: null },
  isCompleted: { type: Boolean, default: false },
  createdBy: String,
  createdAt: { type: Date, default: Date.now }
});





const companyprojectModel = mongoose.model('Project', companyprojectSchema);

app.post("/api/company/project/post", async (req, res) => {
  try {
    const {
      title,
      description,
      startDate,
      endDate,
      expectedCompletionTime,
      category,
      budget,
      impact,
      projectImg,
      createdBy
    } = req.body;

    const savecomapnyproject = new companyprojectModel({
      title,
      description,
      startDate,
      endDate,
      expectedCompletionTime,
      category,
      budget,
      impact,
      projectImg,
      createdBy
    });

    await savecomapnyproject.save();

    const admins = await User.find();

    for (const admin of admins) {
      try {
        const sendSmtpEmail = {
          sender: { email: 'vildashnetwork@gmail.com', name: 'ZOZAC' },
          to: [{ email: admin.email }],
          subject: `🚀 New Project Posted On ZOZAC: ${title}`,

          htmlContent: `
          

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pefscom Project Notification</title>
  <style>
    body, table, td, a {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td {
      mso-table-rspace: 0pt;
      mso-table-lspace: 0pt;
    }
    img {
      -ms-interpolation-mode: bicubic;
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }
    body {
      margin: 0;
      padding: 0;
      width: 100% !important;
      height: 100% !important;
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      background: #000000;
      color: blue;
    }
    a[x-apple-data-detectors] {
      color: inherit !important;
      text-decoration: none !important;
      font-size: inherit !important;
      font-family: inherit !important;
      font-weight: inherit !important;
      line-height: inherit !important;
    }
    @media screen and (max-width: 600px) {
      .container { width: 100% !important; }
      .hero-title { font-size: 28px !important; }
      .hero-subtitle { font-size: 16px !important; }
    }
  </style>
</head>
<body>

  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#000000">
    <tr>
      <td align="center" style="padding: 20px 10px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" class="container" style="max-width:600px; background: linear-gradient(135deg, #000000 0%, #1c1c1c 100%); border-radius: 8px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,255,0.3);">

          <!-- Header Image and Title -->
          <tr>
            <td align="center">
              <img src="https://scribie.com/blog/wp-content/uploads/2023/10/1XLj5Rox_Qj5vRhWgTLzzbQ.jpg" alt="Project Image" width="600" style="display:block; width:100%; height:auto; object-fit: cover; filter: brightness(0.7);" />
              <div style="padding: 20px; text-align: center; color: green;;">
                <h1 class="hero-title" style="font-size: 36px; font-weight: 700; font-family: 'Georgia', serif; text-shadow: 0 0 10px rgba(0, 81, 255, 0.9);">🚀 New Project Notification</h1>
                <p class="hero-subtitle" style="font-size: 18px;">A new project has been added to ZOZAC</p>
              </div>
            </td>
          </tr>

          <!-- Project Details -->
          <tr>
            <td style="padding: 0 30px 30px;">
              <h2 style="color: green; font-family: 'Georgia', serif; font-size: 24px; margin-bottom: 10px;">Project Details</h2>
              <p><strong>Title:</strong> ${title.toString()}</p>
  <p style="color: green;"><strong>Description:</strong> ${description.toString()}</p>
  <p style="color: green;"><strong>Category:</strong> ${category.toString()}</p>
  <p style="color: green;"><strong>Budget:</strong> ${budget.toString()}frs</p>
  <p style="color: green;"><strong>Impact:</strong> ${impact.toString()}</p>
  <p style="color: green;"><strong>Start Date:</strong> ${startDate.toString()}</p>
  <p style="color: green;"><strong>End Date:</strong> ${endDate.toString()}</p>
              <hr style="border-color: blue;">
              <p style="font-size: 0.9em; color: green;">This is an automatic notification to ZOZAC admins.</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 20px; background: #111; color: green; font-size: 14px;">
              <p style="margin: 0;">Pefscom &copy; 2025 | All rights reserved</p>
              <p style="margin: 0;">Contact us: <a href="mailto:infor@zozac.org" style="color:green; text-decoration: none;">infor@zozac.org</a></p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>










          `
        };

        const result = await emailApi.sendTransacEmail(sendSmtpEmail);
        console.log(`📧 Email sent to: ${admin.email} | MessageId: ${result.messageId}`);
      } catch (emailErr) {
        console.error(`❌ Failed to email ${admin.email}:`, emailErr.message);
      }
    }

    res.status(200).json({ message: "✅ Project uploaded and emails sent successfully." });
  } catch (error) {
    console.error("🔥 Project upload error:", error);
    res.status(500).json({ message: "❌ Internal server error" });
  }
});


app.get("/api/company/project/post", async (req, res) => {
  try {
    const fetchall = await companyprojectModel.find().sort({ createdAt: -1 })
    res.status(200).json(fetchall)
  } catch (error) {
    console.error(error);

    res.status(500).json({ message: "internal server error" })
  }
})


app.put("/api/company/project/post/:id", async (req, res) => {
  try {

    const { projectImg, isCompleted } = req.body
    const updatestatus = await companyprojectModel.findByIdAndUpdate(req.params.id, { projectImg, isCompleted })
    if (!updatestatus) {
      res.status(404).json({ message: "post not found" })
    }
    res.status(201).json({ message: "post updated sucessfull" })
  } catch (error) {
    res.status(500).json({ message: "internal server error" })
    console.log('====================================');
    console.log(error);
    console.log('====================================');
  }
})





app.get("/api/company/project/post/:id", async (req, res) => {
  try {
    const project = await companyprojectModel.findById(req.params.id)
    if (!project) {
      res.status(404).json({ message: "post not found" })
    }
    res.status(201).json(project)
  } catch (error) {
    res.status(500).json({ message: "internal server error" })
    console.log('====================================');
    console.log(error);
    console.log('====================================');
  }
})


//start order

const orderschema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    phonenumber: {
      type: Number,
      required: true
    },
    whatsappnumber: {
      type: Number,
      required: true
    },
    details: {
      type: String,
      required: true
    },

    want: {
      type: String,
      required: true
    },
    gettous: {
      type: String,
      required: true
    },
    date: {
      type: String,
      default: () => new Date().toLocaleString('en-US', {
        timeZone: 'Africa/Douala',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    }


  }
)

const Ordermodel = new mongoose.model("OrderModel", orderschema)
app.post("/api/post/orders", async (req, res) => {

  try {
    const { name, email, phonenumber, whatsappnumber, details, want, gettous } = req.body
    const saveorders = Ordermodel({ name, email, phonenumber, whatsappnumber, details, want, gettous })
    await saveorders.save()
    res.status(200).json({ message: "data saved sucessfull" })






    const admins = await User.find();

    for (const admin of admins) {
      try {
        const sendSmtpEmail = {
          sender: { email: 'vildashnetwork@gmail.com', name: 'ZOZAC' },
          to: [{ email: admin.email }],
          subject: `🚀 New request From A User On ZOZAC: from ${name}`,

          htmlContent: `
          

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pefscom Project Notification</title>
  <style>
    body, table, td, a {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td {
      mso-table-rspace: 0pt;
      mso-table-lspace: 0pt;
    }
    img {
      -ms-interpolation-mode: bicubic;
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }
    body {
      margin: 0;
      padding: 0;
      width: 100% !important;
      height: 100% !important;
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      background: #000000;
      color: blue;
    }
    a[x-apple-data-detectors] {
      color: inherit !important;
      text-decoration: none !important;
      font-size: inherit !important;
      font-family: inherit !important;
      font-weight: inherit !important;
      line-height: inherit !important;
    }
    @media screen and (max-width: 600px) {
      .container { width: 100% !important; }
      .hero-title { font-size: 28px !important; }
      .hero-subtitle { font-size: 16px !important; }
    }
  </style>
</head>
<body>

  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#000000">
    <tr>
      <td align="center" style="padding: 20px 10px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" class="container" style="max-width:600px; background: linear-gradient(135deg, #000000 0%, #1c1c1c 100%); border-radius: 8px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,255,0.3);">

          <!-- Header Image and Title -->
          <tr>
            <td align="center">
              <img src="https://scribie.com/blog/wp-content/uploads/2023/10/1XLj5Rox_Qj5vRhWgTLzzbQ.jpg" alt="Order Image" width="600" style="display:block; width:100%; height:auto; object-fit: cover; filter: brightness(0.7);" />
              <div style="padding: 20px; text-align: center; color: green;;">
                <h1 class="hero-title" style="font-size: 36px; font-weight: 700; font-family: 'Georgia', serif; text-shadow: 0 0 10px rgba(0, 81, 255, 0.9);">🚀 New Request Notification</h1>
                <p class="hero-subtitle" style="font-size: 18px;">A new Membership request has been Made to ZOZAC from ${name}</p>
              </div>
            </td>
          </tr>

          <!-- Project Details -->
          <tr>
            <td style="padding: 0 30px 30px;">
              <h2 style="color: green; font-family: 'Georgia', serif; font-size: 24px; margin-bottom: 10px;">Order Details</h2>
              <p><strong>Email:</strong> ${email.toString()}</p>
  <p style="color: green;"><strong>Description:</strong> ${details.toString()}</p>
  <p style="color: green;"><strong>Category:</strong> ${want.toString()}</p>
  <p style="color: green;"><strong>get to me through:</strong> ${gettous.toString()}</p>
  <p style="color: green;"><strong>WhatApp Number:</strong> ${whatsappnumber.toString()}</p>
  <p style="color: green;"><strong>Phone Number:</strong> ${phonenumber.toString()}</p>
  <p style="color: green;"><strong>Date:</strong> ${new Date()}</p>
              <hr style="border-color: blue;">
              <p style="font-size: 0.9em; color: green;">This is an automatic notification to ZOZAC admins.</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 20px; background: #111; color: green; font-size: 14px;">
              <p style="margin: 0;">Pefscom &copy; 2025 | All rights reserved</p>
              <p style="margin: 0;">Contact us: <a href="mailto:infor@zozac.org" style="color: green; text-decoration: none;">infor@zozac.org</a></p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>










          `
        };

        const result = await emailApi.sendTransacEmail(sendSmtpEmail);
        console.log(`📧 Email sent to: ${admin.email} | MessageId: ${result.messageId}`);
      } catch (emailErr) {
        console.error(`❌ Failed to email ${admin.email}:`, emailErr.message);
      }
    }




  } catch (error) {
    res.status(500).json({ message: "internal server error" })
    console.log('====================================');
    console.log(error);
    console.log('====================================');
  }
})



app.get('/get/orders', async (req, res) => {
  try {
    const allorders = await Ordermodel.find().sort({ date: -1 })
    res.status(201).json(allorders)
  } catch (error) {
    res.status(500).json({ message: "internal server error" })
    console.log('====================================');
    console.log(error);
    console.log('====================================');
  }

})

const pageViewSchema = new mongoose.Schema({
  count: { type: Number, default: 0 },
  date: { type: Date, default: Date.now }
});

const PageView = mongoose.model('PageView', pageViewSchema);

// POST endpoint to increment page views
app.post('/api/pageview', async (req, res) => {
  try {
    let record = await PageView.findOne();
    if (!record) {
      record = new PageView({ count: 1 });
    } else {
      record.count++;
    }
    await record.save();
    res.json({ totalViews: record.count });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update views' });
  }
});

app.get('/api/pageview', async (req, res) => {
  try {
    const record = await PageView.findOne();
    res.json({ totalViews: record ? record.count : 0 });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get views' });
  }
});
















const MAX_HISTORY_MESSAGES = 10;

async function getAIResponse({ userMessage, conversationId }) {





  const lowerMsg = userMessage.toLowerCase();

  // 1️⃣ Build projectContext
  let projectContext = "";
  try {
    const projects = await companyprojectModel.find().lean();
    const detailedProjects = projects.map(p => `
- **Title:** ${p.title}
- **Category:** ${p.category}
- **Dates:** ${p.startDate?.toISOString().slice(0, 10) || 'N/A'} → ${p.endDate?.toISOString().slice(0, 10) || 'N/A'}
- **Expected Duration:** ${p.expectedCompletionTime || 'N/A'} days
- **Budget:** ${p.budget?.toLocaleString() || 'N/A'} XAF
- **Impact:** ${p.impact}
- **Completed:** ${p.isCompleted ? '✅' : '❌'}
- **Image URL:** ${p.projectImg || 'None'}
-----------------------------`).join("\n");

    // summary stats
    const totalProjects = projects.length;
    const avgBudget = (projects.reduce((sum, p) => sum + (p.budget || 0), 0) / (totalProjects || 1)).toFixed(2);
    const completedCount = projects.filter(p => p.isCompleted).length;
    const inProgressCount = totalProjects - completedCount;

    projectContext = `
🗂️ Company Projects:
- Total: ${totalProjects}
- Avg Budget: ${avgBudget} XAF
- Completed: ${completedCount}
- In Progress: ${inProgressCount}

${detailedProjects}
`;
  } catch (err) {
    console.error("Project Fetch Error:", err);
    projectContext = "⚠️ Unable to fetch project data right now.";
  }

  // 2️⃣ Build pictureContext
  let pictureContext = "";
  try {
    const pics = await pictureModel.find().lean();
    const detailedPics = pics.map(pic => `
- **Title:** ${pic.title}
- **Content:** ${pic.content}
- **Price:** ${pic.price} XAF
- **Date:** ${pic.date}
- **Image:** <img src="${pic.ImageUrl}" alt="${pic.title}" style="max-width:100%;height:auto;" />
-----------------------------`).join("\n");

    const totalRevenue = pics.reduce((sum, p) => sum + parseFloat(p.price || 0), 0).toFixed(2);

    pictureContext = `
🖼️ Picture Posts:
- Total Revenue Potential: ${totalRevenue} XAF

${detailedPics}
`;
  } catch (err) {
    console.error("Picture Fetch Error:", err);
    pictureContext = "⚠️ Unable to fetch picture-post data right now.";
  }

  let history = [];
  if (conversationId) {
    history = await Message.find({ conversationId })
      .sort({ createdAt: -1 })
      .limit(MAX_HISTORY_MESSAGES)
      .lean();
    history = history.reverse();
  }








  let ordersContext = "";
  try {
    const orders = await Ordermodel.find().lean();
    const detailedOrders = orders.map(o => `
- **Name:** ${o.name}
- **Email:** ${o.email}
- **Phone:** ${o.phonenumber}
- **WhatsApp:** ${o.whatsappnumber}
- **Details:** ${o.details}
- **Want:** ${o.want}
- **Contact Via:** ${o.gettous}
- **Date:** ${o.date}
-----------------------------`).join("\n");

    const totalOrders = orders.length;

    ordersContext = `
📦 Orders:
- Total Orders Received: ${totalOrders}

${detailedOrders}
`;
  } catch (err) {
    console.error("Order Fetch Error:", err);
    ordersContext = "⚠️ Unable to fetch order data right now.";
  }


  // 4️⃣ Build adminContext
  let adminContext = "";
  try {
    const admins = await User.find().populate('projects.userId', 'username').lean();
    const detailedAdmins = admins.map(a => {
      const projList = a.projects.map(pr => `
    • **${pr.title}** (${pr.completed ? 'Done' : 'Pending'})  
      • GitHub: ${pr.GithubLink || '–'}  
      • Image: ${pr.imageUrlwork || '–'}  
      • Ratings: ${pr.ratings.map(r => r.value).join(', ') || 'None'}  
      • Date: ${new Date(pr.date).toISOString().slice(0, 10)}
    `).join('\n');
      return `
- **Admin:** ${a.username} (${a.email})
- **About:** ${a.about}
- **Phone:** ${a.number}
- **Joined:** ${a.date}
- **Projects:**
${projList || '    (No projects)'}
-----------------------------`;
    }).join("\n");

    adminContext = `
👥 ZOZAC Community Admins & Personal Projects:

${detailedAdmins}
`;
  } catch (err) {
    console.error("Admin Fetch Error:", err);
    adminContext = "⚠️ Unable to fetch admin data right now.";
  }

  async function searchImageOnGoogle(query) {
    const API_KEY = process.env.GOOGLE_API_KEY;
    const CX = process.env.GOOGLE_CSE_ID;

    try {
      const response = await axios.get("https://www.googleapis.com/customsearch/v1", {
        params: {
          key: API_KEY,
          cx: CX,
          q: query,
          searchType: "image",
          num: 1,
          safe: "medium",
        },
      });

      const items = response.data.items;
      if (items && items.length > 0) {
        // Return first image URL
        return items[0].link;
      } else {
        return null;
      }
    } catch (error) {
      console.error("Google Image Search Error:", error.message);
      return null;
    }
  }

  // Detect if user wants an image
  const wantsImage =
    userMessage.toLowerCase().includes("generate an image") ||
    userMessage.toLowerCase().includes("show me an image") ||
    userMessage.toLowerCase().includes("image of") ||
    userMessage.toLowerCase().startsWith("image ");

  if (wantsImage) {
    let imageQuery = userMessage.replace(/(generate an image of|show me an image of|image of|image )/gi, "").trim();

    // Special case for BTC Pharmacy
    if (imageQuery.toLowerCase().includes("btc pharmacy")) {
      const imageUrl = await searchImageOnGoogle("BTC PHARMACY");
      if (imageUrl) {
        return `<img src="${imageUrl}" alt="BTC PHARMACY" style="max-width: 100%; height: auto;" />`;
      } else {
        return "⚠️ Sorry, no suitable image found for BTC PHARMACY.";
      }
    }

    if (!imageQuery) {
      imageQuery = userMessage; // fallback
    }

    const imageUrl = await searchImageOnUnsplash(imageQuery);

    if (imageUrl) {
      return `<img src="${imageUrl}" alt="${imageQuery}" style="max-width: 100%; height: auto;" />`;
    } else {
      return "⚠️ Sorry, no suitable image found.";
    }
  }

  if (
    userMessage.toLowerCase().includes("btc pharmacy") &&
    (userMessage.toLowerCase().includes("image") ||
      userMessage.toLowerCase().includes("show me") ||
      userMessage.toLowerCase().includes("generate"))
  ) {
    const imageUrl = await searchImageOnGoogle("BTC PHARMACY");
    if (imageUrl) {
      return `<img src="${imageUrl}" alt="BTC PHARMACY" style="max-width: 100%; height: auto;" />`;
    } else {
      return "⚠️ Sorry, no suitable image found for BTC PHARMACY.";
    }
  }

  async function searchImageOnUnsplash(query) {
    const ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || "PbFWBfo9nPto__QPiEJ84ALs8asqr-kmEVr3H3TkKss";

    try {
      console.log(`Searching Unsplash for: "${query}"`);
      const response = await axios.get('https://api.unsplash.com/search/photos', {
        params: {
          query,
          per_page: 1,
          orientation: 'landscape',
        },
        headers: {
          Authorization: `Client-ID ${ACCESS_KEY}`,
        },
      });

      console.log("Unsplash API response status:", response.status);
      const results = response.data.results;
      if (results.length > 0) {
        console.log("Unsplash found image:", results[0].urls.regular);
        return results[0].urls.regular;
      } else {
        console.log("No images found on Unsplash for query:", query);
        return null;
      }
    } catch (error) {
      console.error('Unsplash API error:', error.message);
      return null;
    }
  }




  const systemMessage = {
    role: "system",
    content: `
You are "Afuh Alfred's AI," a multitasking assistant (personal assistant, drug expert, general expert).
You were created by Che Fortune Orsa, an aspiring software engineer skilled in developing software applications.

When responding, please:

- Provide clear, professional, and well-organized responses using Markdown formatting (headings, numbered lists, bold, bullet points).
- Always include these sections when relevant:


When responding, follow these guidelines:

**1. Tailored Script Writing**
- Accurately interpret Fortune’s descriptions and translate them into ES6+ code.
- Produce clean, idiomatic scripts with async/await, robust error handling, and relevant comments.
- Include examples of advanced operations (transactions, bulk writes, aggregation pipelines).


---### 1. Project Overview
Use the ZOZAC COMMUNITY PROJECT OVERVIEW:
${projectContext || "not asked"}

### 2. Summary Statistics
- Total projects, average budget, completed vs. in-progress
- (Time‑to‑completion analysis, etc.)

### 3. Key Insights & Recommendations
- Observations on budgets, timelines, resource allocation

---

### 4. Picture Posts Summary
Use the PicturePosts schema:
${pictureContext || "not asked"}


---

### 5. ES Script Generation
Provide ES6+ async/await code snippets to:
- Query (find, aggregate)
- Create (insertOne / save)
- Update (findByIdAndUpdate)
- Delete (findByIdAndDelete)
for these models, with error handling.



### 5. Join Request Summary
This is the details on request people made to join zozac:
${ordersContext || "not asked"}
Provide clear analysis of all this request if user ask
---


### 6. ZOZAC Admins & Personal Projects
Use the ZOZACAdminSchema (Usermodel):
${adminContext}

---

### 7. ES Script Generation
Provide ES6+ async/await code snippets to:
- Query (find, aggregate)
- Create (insertOne / save)
- Update (findByIdAndUpdate)
- Delete (findByIdAndDelete)
for these models, with error handling.

### 🖼️ Image Generation Instructions (Critical)

If the user **asks you to generate or provide an image**, do the following:

1. **Search for a real image** matching the user's description on free, reputable image sources like Freepik, Unsplash, or Pexels.
2. **Do NOT generate AI-synthesized images or placeholders.**
3. Return the image as a full HTML \<img\> tag **with valid image URL ending in .jpg, .png, or .jpeg, etc.**
4. The HTML tag **must be exactly like this, with no code block or backticks**:

<img src="ACTUAL_IMAGE_URL" alt="Concise descriptive alt text" style="max-width: 100%; height: auto;" />

5. **Replace ACTUAL_IMAGE_URL and alt text appropriately for the image.**

6. **Do NOT return only the URL or markdown image syntax!**

7. Ensure the image is relevant and visually clear for the description.

---

### Example:

User prompt: "Generate an image of a man drinking medicine."

You respond with:

<img src="https://img.freepik.com/free-photo/sick-man-with-cold-drinking-medicine-tablets_23-2148440306.jpg" alt="Man drinking medicine" style="max-width: 100%; height: auto;" />

---

Keep your language concise, formal, and informative. Avoid verbosity and repetition.

`
  };
  // AIzaSyAJy2Mx85_uZ8EkRbhbwsMpZvvmHMpus2M
  // {/* <script async src="https://cse.google.com/cse.js?cx=e1ebd0e638f1b4e49">
  // </script>
  // <div class="gcse-search"></div> */}



  const messages = [systemMessage];
  history.forEach((m) => messages.push({ role: m.role, content: m.content }));
  messages.push({ role: "user", content: userMessage });

  try {
    const aiRes = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: process.env.MODEL_ID,
        messages,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    if (!aiRes.data?.choices?.length) return "⚠️ AI returned no response.";

    const aiResponse = aiRes.data.choices[0].message.content;

    if (conversationId) {
      await Message.create([
        { conversationId, role: "user", content: userMessage },
        { conversationId, role: "assistant", content: aiResponse },
      ]);
      await Conversation.findByIdAndUpdate(conversationId, { updatedAt: new Date() });
    }

    return aiResponse;
  } catch (err) {
    console.error("AI Error:", err.response?.data || err.message);
    return "🚫 Failed to get AI response. Try again later.";
  }
}

// Create new conversation
app.post("/conversations", async (req, res) => {
  try {
    const conversation = new Conversation();
    await conversation.save();
    res.status(201).json(conversation);
  } catch (err) {
    res.status(500).json({ message: "Failed to create conversation" });
  }
});

// Get all conversations
app.get("/conversations", async (req, res) => {
  try {
    const conversations = await Conversation.find().sort({ updatedAt: -1 });
    res.json(conversations);
  } catch (err) {
    res.status(500).json({ message: "Failed to get conversations" });
  }
});

// Get messages for one conversation
app.get("/messages/:conversationId", async (req, res) => {
  try {
    const messages = await Message.find({ conversationId: req.params.conversationId }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: "Failed to get messages" });
  }
});

// Send a message and get AI reply
app.post("/", async (req, res) => {
  try {
    const { userMessage, conversationId } = req.body;
    if (!userMessage || !conversationId) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const aiReply = await getAIResponse({ userMessage, conversationId });
    res.status(200).json({ message: aiReply });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// Delete all conversations
app.delete("/conversations", async (req, res) => {
  try {
    await Message.deleteMany({});
    await Conversation.deleteMany({});
    res.json({ message: "All conversations deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete" });
  }
});


















connectDatabase().then(() => {
  server.listen(8000, () => {
    console.log("🚀 Server + Socket.IO listening at http://localhost:8000");
  });
})


