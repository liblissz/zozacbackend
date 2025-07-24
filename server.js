import express from "express";
import dotenv from 'dotenv';
import cors from 'cors';
import mongoose from "mongoose";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';


//notification
import http from 'http';
import { Server } from 'socket.io';
import { error, log } from "console";
import { type } from "os";


import SibApiV3Sdk from 'sib-api-v3-sdk';
import bodyParser from 'body-parser';

dotenv.config({ path: "./config.env" });


const client = SibApiV3Sdk.ApiClient.instance;
const apiKey = client.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;  // Store your API key in .env securely

const emailApi = new SibApiV3Sdk.TransactionalEmailsApi();

const app = express();

//middlewares for notification
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

app.set('io', io);
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

const url = process.env.ALTLASURI;

const connectdb = async () => {
  try {
    await mongoose.connect(url);
    console.log("✅ Database connected successfully!");
  } catch (error) {
    console.error("❌ Error connecting to the database:", error);
  }
};


const projectSchema = new mongoose.Schema({
  title: String,
  description: String,
  completed: Boolean,
  GithubLink: String,
  imageUrlwork: String,
  ratings: [
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      value: {
        type: Number,
        min: 1,
        max: 5,
      },
    }
  ],

  date: {
    type: Date,
    default: Date.now,
  },
}, { _id: true });

const ZOZACAdminSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  about: { type: String, required: true },
  number: { type: Number, required: true },
  password: { type: String, required: true },
  profileImage: { type: String, required: true },
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
  },
  projects: [projectSchema]
});

const Usermodel = mongoose.model("ZOZAC-ADMINS", ZOZACAdminSchema);

const SORT_ROUNDS = 6;

app.post('/api/signup/admin', async (req, res) => {
  try {
    const { username, email, about, number, password, profileImage, date } = req.body;

    const checkemail = await Usermodel.findOne({ email });
    if (checkemail) {
      return res.status(400).json({ message: "Email already taken" });
    }

    const hashedPassword = await bcrypt.hash(password, SORT_ROUNDS);
    const newUser = new Usermodel({
      username,
      email,
      about,
      number,
      password: hashedPassword,
      profileImage,
      date
    });

    await newUser.save();




    const token = jwt.sign({ email }, 'auth-token', { expiresIn: '1d' });

    res.status(200).json({
      message: "User saved successfully",
      token,
    });

  } catch (error) {
    console.error("❌ Signup error:", error);
    res.status(500).json({ message: "Internal server error" });
    console.log('====================================');
    console.log(error);
    console.log('====================================');
  }
});

app.get('/api/signup/admin', async (req, res) => {
  try {
    const users = await Usermodel.find();

    res.status(200).json(users);

  } catch (error) {
    console.error("❌ Fetch error:", error);
    res.status(500).json({ message: "Could not retrieve users" });
  }
});








//normal user


// Mongoose Schema
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

const normalusermodel = mongoose.model('normalpefscomusers', normaluserschema);

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
    const admins = await Usermodel.find();
    const date = new Date();

    for (const admin of admins) {
      try {
        const sendSmtpEmail = {
          sender: { email: 'liblissz3@gmail.com', name: 'Pefscom' },
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
                          <div style="padding: 20px; color: #87cefa;">
                            <h1 style="font-family: Georgia, serif; font-size: 32px;">🚀 Hello ${admin.username}</h1>
                            <p style="font-size: 18px;">A new user has just registered on Pefscom</p>
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 0 30px 30px;">
                          <h2 style="color: #87cefa;">User Details</h2>
                          <p style="color: #87cefa;"><strong>Name:</strong> ${name}</p>
                          <p style="color: #87cefa;"><strong>Email:</strong> ${email}</p>
                          <p style="color: #87cefa;"><strong>About:</strong> ${about}</p>
                          <p style="color: #87cefa;"><strong>Phone:</strong> ${number}</p>
                          <p style="color: #87cefa;"><strong>Signup Date:</strong> ${date.toLocaleString()}</p>
                          <hr style="border-color: blue;" />
                          <p style="font-size: 0.9em; color: #87cefa;">This is an automatic notification to Pefscom admins.</p>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding: 20px; background: #111; color: #87cefa;">
                          <p>Pefscom &copy; 2025 | All rights reserved</p>
                          <p>Contact: <a href="mailto:support@pefscom.com" style="color: #1e90ff;">support@pefscom.com</a></p>
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

// Get all users
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

//normal user end









const otpSchema = new mongoose.Schema({
  email: { type: String, required: true },
  otp: { type: String, required: true },
  expiresAt: { type: Date, required: true }
});
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index
const OTPmodel = mongoose.model("OTP", otpSchema);



app.post('/api/auth/request-reset-password', async (req, res) => {
  const { email } = req.body;
  console.log("Request reset password for email:", email);

  if (!email) {
    console.log("Email missing in request");
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    const user = await Usermodel.findOne({ email });
    if (!user) {
      console.log("User not found for email:", email);
      return res.status(404).json({ message: "User not found" });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await OTPmodel.findOneAndUpdate(
      { email },
      { otp, expiresAt },
      { upsert: true, new: true }
    );

    console.log("OTP generated and saved:", otp);

    const sendSmtpEmail = {
      sender: { email: 'liblissz3@gmail.com', name: 'Pefscom' },
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

    const updatedUser = await Usermodel.findOneAndUpdate(
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












app.post("/api/login/admin", async (req, res) => {
  try {
    const { email, password } = req.body

    const user = await Usermodel.findOne({ email })

    if (!user) {
      res.status(404).json({ sucess: false, message: "user not found" })
    } else {
      const confirmpass = await bcrypt.compare(password, user.password)
      if (confirmpass) {
        const token = jwt.sign({ email }, 'auth-token', { expiresIn: '1d' });
        res.status(200).json({
          message: "Login successful",
          sucess: true,
          token
        });

      } else {
        res.status(401).json({ sucess: false, message: "Your Password Is Incorrect" })
      }
    }
  } catch (error) {
    console.log(error);

  }
})






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
    const user = await Usermodel.findOne({ email }).select('-password'); // exclude password

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});



app.get('/api/user/:id', async (req, res) => {
  try {
    const user = await Usermodel.findById(req.params.id)
    if (!user) {
      return res.status(404).json({ message: 'Note not found' })
    }
    res.status(200).json(user)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Server error' })
  }
})



app.post('/api/user/add-project/:id', async (req, res) => {
  const { title, description, completed, GithubLink, imageUrlwork } = req.body;

  try {
    const user = await Usermodel.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.projects.push({ title, description, completed, GithubLink, imageUrlwork });
    await user.save();

    res.status(200).json(user.projects);
  } catch (error) {
    console.error("🔥 Error saving project:", error);
    res.status(500).json({ message: "Error saving project", error: error.message });
  }
});


app.get("/api/user/add-project/:id", async (req, res) => {
  try {
    const user = await Usermodel.findById(req.params.id).select('projects');
    res.status(200).json(user.projects); // ✅ returns just the array
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});












//start






app.put('/api/user/rate-project/:userId/:projectId', async (req, res) => {
  const { userId, projectId } = req.params;
  const { rating } = req.body;

  try {
    const user = await Usermodel.findById(userId);
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



//end














app.put('/user/edit/:id', async (req, res) => {
  try {
    const { username, email, password, about, number, profileImage } = req.body;

    // Hash the new password if provided
    let updatedFields = { username, email, about, number, profileImage };
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 6);
      updatedFields.password = hashedPassword;
    }

    const updatedUser = await Usermodel.findByIdAndUpdate(
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






//SCHEMA FOR POSTS

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


// app.post("/admin/picture/post", async (req, res) => {

//   try {
//     const { title, content, price, ImageUrl, date } = req.body

//     const savePost = new pictureModel({ title, content, price, ImageUrl, date })

//     savePost.save()
//     //start


//     const admins = await Usermodel.find();

//     for (const admin of admins) {
//       try {
//         const sendSmtpEmail = {
//           sender: { email: 'liblissz3@gmail.com', name: 'Pefscom' },
//           to: [{ email: admin.email }],
//           subject: `🚀 New Project Posted On PEFSCOM: ${title}`,
//           htmlContent: `
//         <!DOCTYPE html>
//         <html lang="en">
//         <head>
//           <meta charset="UTF-8" />
//           <meta name="viewport" content="width=device-width, initial-scale=1" />
//           <title>Pefscom Posts Notification</title>
//           <style>
//             /* your styles here */
//           </style>
//         </head>
//         <body>
//           <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#000000">
//             <tr>
//               <td align="center" style="padding: 20px 10px;">
//                 <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" class="container" style="max-width:600px; background: linear-gradient(135deg, #000000 0%, #1c1c1c 100%); border-radius: 8px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,255,0.3);">
//                   <tr>
//                     <td align="center">
//                       <img src="${ImageUrl}" alt="Project Image" width="600" style="display:block; width:100%; height:auto; object-fit: cover; filter: brightness(0.7);" />
//                       <div style="padding: 20px; text-align: center; color: #87cefa;">
//                         <h1 class="hero-title" style="font-size: 36px; font-weight: 700; font-family: 'Georgia', serif; text-shadow: 0 0 10px rgba(0, 81, 255, 0.9);">🚀Hello ${admin.username} <br> <br> A New Project Notification</h1>
//                         <p class="hero-subtitle" style="font-size: 18px;">A new Picture Post has been added to Pefscom</p>
//                       </div>
//                     </td>
//                   </tr>
//                   <tr>
//                     <td style="padding: 0 30px 30px;">
//                       <h2 style="color: #87cefa; font-family: 'Georgia', serif; font-size: 24px; margin-bottom: 10px;">Post Details</h2>
//                       <p><strong>Title:</strong> ${title}</p>
//                       <p style="color: #87cefa;"><strong>Description:</strong> ${content}</p>
//                       <p style="color: #87cefa;"><strong>Price:</strong> ${price}</p>
//                       <p style="color: #87cefa;"><strong>Date:</strong> ${new Date()}</p>
//                       <hr style="border-color: blue;">
//                       <p style="font-size: 0.9em; color: #87cefa;">This is an automatic notification to Pefscom admins.</p>
//                     </td>
//                   </tr>
//                   <tr>
//                     <td align="center" style="padding: 20px; background: #111; color: #87cefa; font-size: 14px;">
//                       <p style="margin: 0;">Pefscom &copy; 2025 | All rights reserved</p>
//                       <p style="margin: 0;">Contact us: <a href="mailto:support@pefscom.com" style="color: #1e90ff; text-decoration: none;">support@pefscom.com</a></p>
//                     </td>
//                   </tr>
//                 </table>
//               </td>
//             </tr>
//           </table>
//         </body>
//         </html>
//       `
//         };

//         const result = await emailApi.sendTransacEmail(sendSmtpEmail);
//         console.log(`📧 Email sent to: ${admin.email} | MessageId: ${result.messageId}`);
//       } catch (emailErr) {
//         console.error(`❌ Failed to email ${admin.email}:`, emailErr.message);
//       }







//     }


    
//       //user email
//  const users = await normalusermodel.find();

//     for (const user of users) {
//       try {
//         const sendSmtpEmail = {
//           sender: { email: 'liblissz3@gmail.com', name: 'Pefscom' },
//           to: [{ user: user.email }],
//           subject: `🚀 New Project Posted On PEFSCOM SYTEM: ${user.email}`,
//           htmlContent: `
//         <!DOCTYPE html>
//         <html lang="en">
//         <head>
//           <meta charset="UTF-8" />
//           <meta name="viewport" content="width=device-width, initial-scale=1" />
//           <title>Pefscom Posts Notification</title>
//           <style>
//             /* your styles here */
//           </style>
//         </head>
//         <body>
//           <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#000000">
//             <tr>
//               <td align="center" style="padding: 20px 10px;">
//                 <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" class="container" style="max-width:600px; background: linear-gradient(135deg, #000000 0%, #1c1c1c 100%); border-radius: 8px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,255,0.3);">
//                   <tr>
//                     <td align="center">
//                       <img src="${ImageUrl}" alt="Project Image" width="600" style="display:block; width:100%; height:auto; object-fit: cover; filter: brightness(0.7);" />
//                       <div style="padding: 20px; text-align: center; color: #87cefa;">
//                         <h1 class="hero-title" style="font-size: 36px; font-weight: 700; font-family: 'Georgia', serif; text-shadow: 0 0 10px rgba(0, 81, 255, 0.9);">🚀Hello ${user.username} <br> <br> A New Project Notification</h1>
//                         <p class="hero-subtitle" style="font-size: 18px;">A new Picture Post has been added to Pefscom</p>
//                       </div>
//                     </td>
//                   </tr>
//                   <tr>
//                     <td style="padding: 0 30px 30px;">
//                       <h2 style="color: #87cefa; font-family: 'Georgia', serif; font-size: 24px; margin-bottom: 10px;">Post Details</h2>
//                       <p><strong>Title:</strong> ${title}</p>
//                       <p style="color: #87cefa;"><strong>Description:</strong> ${content}</p>
//                       <p style="color: #87cefa;"><strong>Price:</strong> ${price}</p>
//                       <p style="color: #87cefa;"><strong>Date:</strong> ${new Date()}</p>
//                       <hr style="border-color: blue;">
//                       <p style="font-size: 0.9em; color: #87cefa;">This is an automatic notification to Pefscom Users.</p>
//                     </td>
//                   </tr>
//                   <tr>
//                     <td align="center" style="padding: 20px; background: #111; color: #87cefa; font-size: 14px;">
//                       <p style="margin: 0;">Pefscom &copy; 2025 | All rights reserved</p>
//                       <p style="margin: 0;">Contact us: <a href="mailto:support@pefscom.com" style="color: #1e90ff; text-decoration: none;">support@pefscom.com</a></p>
//                     </td>
//                   </tr>
//                 </table>
//               </td>
//             </tr>
//           </table>
//         </body>
//         </html>
//       `
//         };

//         const result = await emailApi.sendTransacEmail(sendSmtpEmail);
//         console.log(`📧 Email sent to: ${admin.email} | MessageId: ${result.messageId}`);
//       } catch (emailErr) {
//         console.error(`❌ Failed to email ${admin.email}:`, emailErr.message);
//       }







//     }




//       //useremaailend


//     //stop

//     const notification = new NotificationModel({
//       type: 'post',
//       title,
//       content,
//       date,
//       message: `${title}: ${content}`,
//       icon: ImageUrl,
//     });
//     await notification.save();

//     const io = req.app.get('io');
//     io.emit('PushPostNotification', { savePost: savePost.toObject() });
//     console.log('📢 Emitting new user:', savePost.title);


//     //start












//     //stop











//     res.status(200).json({ message: "post made sucessfully" })
//   } catch (error) {
//     res.status(500).json({ message: "internal server error" })

//   }
// })




app.post("/admin/picture/post", async (req, res) => {
  try {
    const { title, content, price, ImageUrl, date } = req.body;

    // Save post
    const savePost = new pictureModel({ title, content, price, ImageUrl, date });
    await savePost.save();

    // Notify admins
    const admins = await Usermodel.find();

    for (const admin of admins) {
      try {
        const sendSmtpEmail = {
          sender: { email: 'liblissz3@gmail.com', name: 'Pefscom' },
          to: [{ email: admin.email }],
          subject: `🚀 New Project Posted On PEFSCOM: ${title}`,
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
                          <div style="padding: 20px; text-align: center; color: #87cefa;">
                            <h1 style="font-size: 36px; font-weight: 700; font-family: 'Georgia', serif; text-shadow: 0 0 10px rgba(0, 81, 255, 0.9);">
                              🚀Hello ${admin.username} <br><br> A New Project Notification
                            </h1>
                            <p style="font-size: 18px;">A new Picture Post has been added to Pefscom</p>
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 0 30px 30px;">
                          <h2 style="color: #87cefa; font-family: 'Georgia', serif; font-size: 24px; margin-bottom: 10px;">Post Details</h2>
                          <p><strong>Title:</strong> ${title}</p>
                          <p style="color: #87cefa;"><strong>Description:</strong> ${content}</p>
                          <p style="color: #87cefa;"><strong>Price:</strong> ${price}</p>
                          <p style="color: #87cefa;"><strong>Date:</strong> ${new Date(date).toLocaleString()}</p>
                          <hr style="border-color: blue;">
                          <p style="font-size: 0.9em; color: #87cefa;">This is an automatic notification to Pefscom admins.</p>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding: 20px; background: #111; color: #87cefa; font-size: 14px;">
                          <p style="margin: 0;">Pefscom &copy; 2025 | All rights reserved</p>
                          <p style="margin: 0;">Contact us: <a href="mailto:support@pefscom.com" style="color: #1e90ff; text-decoration: none;">support@pefscom.com</a></p>
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

    // Notify normal users
    const users = await normalusermodel.find();

    for (const user of users) {
      try {
        const sendSmtpEmail = {
          sender: { email: 'liblissz3@gmail.com', name: 'Pefscom' },
          to: [{ email: user.email }], // fixed here
          subject: `🚀 New Project Posted On PEFSCOM SYSTEM: ${user.name}`,
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
                          <div style="padding: 20px; text-align: center; color: #87cefa;">
                            <h1 style="font-size: 36px; font-weight: 700; font-family: 'Georgia', serif; text-shadow: 0 0 10px rgba(0, 81, 255, 0.9);">
                              🚀Hello ${user.name} <br><br> A New Project Notification
                            </h1>
                            <p style="font-size: 18px;">A new Picture Post has been added to Pefscom</p>
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 0 30px 30px;">
                          <h2 style="color: #87cefa; font-family: 'Georgia', serif; font-size: 24px; margin-bottom: 10px;">Post Details</h2>
                          <p><strong>Title:</strong> ${title}</p>
                          <p style="color: #87cefa;"><strong>Description:</strong> ${content}</p>
                          <p style="color: #87cefa;"><strong>Price:</strong> ${price}</p>
                          <p style="color: #87cefa;"><strong>Date:</strong> ${new Date(date).toLocaleString()}</p>
                          <hr style="border-color: blue;">
                          <p style="font-size: 0.9em; color: #87cefa;">This is an automatic notification to Pefscom Users.</p>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding: 20px; background: #111; color: #87cefa; font-size: 14px;">
                          <p style="margin: 0;">Pefscom &copy; 2025 | All rights reserved</p>
                          <p style="margin: 0;">Contact us: <a href="mailto:support@pefscom.com" style="color: #1e90ff; text-decoration: none;">support@pefscom.com</a></p>
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


// app.get('/post-preview/:id', async (req, res) => {
//   try {
//     const post = await pictureModel.findById(req.params.id);

//     if (!post) return res.status(404).send('Post not found');

//     res.set('Content-Type', 'text/html');
//     res.send(`
//       <!DOCTYPE html>
//       <html lang="en">
//         <head>
//           <meta charset="UTF-8" />
//           <meta name="viewport" content="width=device-width, initial-scale=1.0" />
//           <title>${post.title}</title>
//           <meta property="og:title" content="${post.title}" />
//           <meta property="og:description" content="${post.summary}" />
//           <meta property="og:image" content="${post.imageUrl}" />
//           <meta property="og:url" content="https://yourdomain.com/post/${post._id}" />
//           <meta property="og:type" content="article" />
//         </head>
//         <body>
//           <p>Redirecting...</p>
//           <script>
//             window.location.href = "/post/${post._id}";
//           </script>
//         </body>
//       </html>
//     `);
//   } catch (error) {
//     console.error(error);
//     res.status(500).send('Server error');
//   }
// });












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
    const allpicturepost = await pictureModel.find()
    res.status(201).json(allpicturepost)
  } catch (error) {
    res.status(500).json({ message: "internal server error" })
    console.log('====================================');
    console.log(error);
    console.log('====================================');
  }
})














//SCHEMA FOR VIDEO POSTS

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
    const admins = await Usermodel.find();

    for (const admin of admins) {
      try {
        const sendSmtpEmail = {
          sender: { email: 'liblissz3@gmail.com', name: 'Pefscom' },
          to: [{ email: admin.email }],
          subject: `🚀 New Project Posted On PEFSCOM: ${title}`,
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
                      <div style="padding: 20px; text-align: center; color: #87cefa;">
                        <h1 style="font-size: 36px; font-weight: 700; font-family: 'Georgia', serif; text-shadow: 0 0 10px rgba(0, 81, 255, 0.9);">🚀 New Project Notification</h1>
                        <p style="font-size: 18px;">A new Video Post has been added to Pefscom</p>
                      </div>
                    </td></tr>
                    <tr><td style="padding: 0 30px 30px;">
                      <h2 style="color: #87cefa; font-family: 'Georgia', serif; font-size: 24px; margin-bottom: 10px;">Post Details</h2>
                      <p><strong>Title:</strong> ${title}</p>
                      <p style="color: #87cefa;"><strong>Description:</strong> ${content}</p>
                      <p style="color: #87cefa;"><strong>Price:</strong> ${price}</p>
                      <p style="color: #87cefa;"><strong>Date:</strong> ${new Date(date).toLocaleString()}</p>
                      <hr style="border-color: blue;">
                      <p style="font-size: 0.9em; color: #87cefa;">This is an automatic notification to Pefscom admins.</p>
                    </td></tr>
                    <tr><td align="center" style="padding: 20px; background: #111; color: #87cefa; font-size: 14px;">
                      <p style="margin: 0;">Pefscom &copy; 2025 | All rights reserved</p>
                      <p style="margin: 0;">Contact us: <a href="mailto:support@pefscom.com" style="color: #1e90ff; text-decoration: none;">support@pefscom.com</a></p>
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
          sender: { email: 'liblissz3@gmail.com', name: 'Pefscom' },
          to: [{ email: user.email }],
          subject: `🚀 New Project Posted On PEFSCOM: ${user.name}`,
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
                      <div style="padding: 20px; text-align: center; color: #87cefa;">
                        <h1 style="font-size: 36px; font-weight: 700; font-family: 'Georgia', serif; text-shadow: 0 0 10px rgba(0, 81, 255, 0.9);">
                          🚀Hello ${user.name}<br><br><br> New Project Notification
                        </h1>
                        <p style="font-size: 18px;">A new Video Post has been added to Pefscom</p>
                      </div>
                    </td></tr>
                    <tr><td style="padding: 0 30px 30px;">
                      <h2 style="color: #87cefa; font-family: 'Georgia', serif; font-size: 24px; margin-bottom: 10px;">Post Details</h2>
                      <p><strong>Title:</strong> ${title}</p>
                      <p style="color: #87cefa;"><strong>Description:</strong> ${content}</p>
                      <p style="color: #87cefa;"><strong>Price:</strong> ${price}</p>
                      <p style="color: #87cefa;"><strong>Date:</strong> ${new Date(date).toLocaleString()}</p>
                      <hr style="border-color: blue;">
                      <p style="font-size: 0.9em; color: #87cefa;">This is an automatic notification to Pefscom Users.</p>
                    </td></tr>
                    <tr><td align="center" style="padding: 20px; background: #111; color: #87cefa; font-size: 14px;">
                      <p style="margin: 0;">Pefscom &copy; 2025 | All rights reserved</p>
                      <p style="margin: 0;">Contact us: <a href="mailto:support@pefscom.com" style="color: #1e90ff; text-decoration: none;">support@pefscom.com</a></p>
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



//startemail

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

    const admins = await Usermodel.find();

    for (const admin of admins) {
      try {
        const sendSmtpEmail = {
          sender: { email: 'liblissz3@gmail.com', name: 'Pefscom' },
          to: [{ email: admin.email }],
          subject: `🚀 New Project Posted On PEFSCOM: ${title}`,

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
              <div style="padding: 20px; text-align: center; color: #87cefa;;">
                <h1 class="hero-title" style="font-size: 36px; font-weight: 700; font-family: 'Georgia', serif; text-shadow: 0 0 10px rgba(0, 81, 255, 0.9);">🚀 New Project Notification</h1>
                <p class="hero-subtitle" style="font-size: 18px;">A new project has been added to Pefscom</p>
              </div>
            </td>
          </tr>

          <!-- Project Details -->
          <tr>
            <td style="padding: 0 30px 30px;">
              <h2 style="color: #87cefa; font-family: 'Georgia', serif; font-size: 24px; margin-bottom: 10px;">Project Details</h2>
              <p><strong>Title:</strong> ${title.toString()}</p>
  <p style="color: #87cefa;"><strong>Description:</strong> ${description.toString()}</p>
  <p style="color: #87cefa;"><strong>Category:</strong> ${category.toString()}</p>
  <p style="color: #87cefa;"><strong>Budget:</strong> ${budget.toString()}frs</p>
  <p style="color: #87cefa;"><strong>Impact:</strong> ${impact.toString()}</p>
  <p style="color: #87cefa;"><strong>Start Date:</strong> ${startDate.toString()}</p>
  <p style="color: #87cefa;"><strong>End Date:</strong> ${endDate.toString()}</p>
              <hr style="border-color: blue;">
              <p style="font-size: 0.9em; color: #87cefa;">This is an automatic notification to Pefscom admins.</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 20px; background: #111; color: #87cefa; font-size: 14px;">
              <p style="margin: 0;">Pefscom &copy; 2025 | All rights reserved</p>
              <p style="margin: 0;">Contact us: <a href="mailto:support@pefscom.com" style="color: #1e90ff; text-decoration: none;">support@pefscom.com</a></p>
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










//endemail
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
    const {name, email,phonenumber, whatsappnumber, details, want , gettous} = req.body
    const saveorders = Ordermodel({name, email,phonenumber, whatsappnumber, details, want , gettous})
    await saveorders.save()
    res.status(200).json({message: "data saved sucessfull"})






const admins = await Usermodel.find();

    for (const admin of admins) {
      try {
        const sendSmtpEmail = {
          sender: { email: 'liblissz3@gmail.com', name: 'Pefscom' },
          to: [{ email: admin.email }],
          subject: `🚀 New Order From A User On PEFSCOM: from ${name}`,

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
              <div style="padding: 20px; text-align: center; color: #87cefa;;">
                <h1 class="hero-title" style="font-size: 36px; font-weight: 700; font-family: 'Georgia', serif; text-shadow: 0 0 10px rgba(0, 81, 255, 0.9);">🚀 New Order Notification</h1>
                <p class="hero-subtitle" style="font-size: 18px;">A new Order has been Made to Pefscom from ${name}</p>
              </div>
            </td>
          </tr>

          <!-- Project Details -->
          <tr>
            <td style="padding: 0 30px 30px;">
              <h2 style="color: #87cefa; font-family: 'Georgia', serif; font-size: 24px; margin-bottom: 10px;">Order Details</h2>
              <p><strong>Email:</strong> ${email.toString()}</p>
  <p style="color: #87cefa;"><strong>Description:</strong> ${details.toString()}</p>
  <p style="color: #87cefa;"><strong>Category:</strong> ${want.toString()}</p>
  <p style="color: #87cefa;"><strong>get to me through:</strong> ${gettous.toString()}</p>
  <p style="color: #87cefa;"><strong>WhatApp Number:</strong> ${whatsappnumber.toString()}</p>
  <p style="color: #87cefa;"><strong>Phone Number:</strong> ${phonenumber.toString()}</p>
  <p style="color: #87cefa;"><strong>Date:</strong> ${new Date()}</p>
              <hr style="border-color: blue;">
              <p style="font-size: 0.9em; color: #87cefa;">This is an automatic notification to Pefscom admins.</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 20px; background: #111; color: #87cefa; font-size: 14px;">
              <p style="margin: 0;">Pefscom &copy; 2025 | All rights reserved</p>
              <p style="margin: 0;">Contact us: <a href="mailto:support@pefscom.com" style="color: #1e90ff; text-decoration: none;">support@pefscom.com</a></p>
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
   res.status(500).json({message: "internal server error"})
   console.log('====================================');
   console.log(error);
   console.log('====================================');
  }
})

//end order




app.get('/get/orders', async (req,res)=>{
 try {
  const allorders = await Ordermodel.find().sort({date: -1})
  res.status(201).json(allorders)
 } catch (error) {
  res.status(500).json({message: "internal server error"})
  console.log('====================================');
  console.log(error);
  console.log('====================================');
 }

})


















const pageViewSchema = new mongoose.Schema({
  count: { type: Number, default: 0 },
  date: {type: Date, default: Date.now}
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

// GET endpoint to get total views
app.get('/api/pageview', async (req, res) => {
  try {
    const record = await PageView.findOne();
    res.json({ totalViews: record ? record.count : 0 });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get views' });
  }
});


connectdb().then(() => {
  server.listen(5000, () => {
    console.log("🚀 Server + Socket.IO listening at http://localhost:8000");
  });
});

