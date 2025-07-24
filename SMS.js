import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
import twilio from "twilio";

// Replace these with your Twilio credentials
const accountSid = "ACe33ff8b05b75623efd435c2d14106359";
const authToken = "ed8c2540e564fe9b5cb82d7b4a354785";
const twilioPhoneNumber = "+237654598457"; // Your Twilio number

const client = twilio(accountSid, authToken);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

// Serve frontend if you have it
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

app.post("/send-sms", async (req, res) => {
  const { phone, message } = req.body;

  try {
    const response = await client.messages.create({
      body: message,
      from: twilioPhoneNumber,
      to: phone,
    });

    res.status(200).json({ success: true, sid: response.sid });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});





































 const admins = await Patient.find();
     for (const admin of admins) {
        try {
          const sendSmtpEmail = {
            sender: { email: 'vildashnetwork@gmail.com', name: 'BTC' },
            to: [{ email: admin.Email }],
            subject: `🚀 New Order Made to  BTC PHARMACY: ${newOrder.customer.name}`,
            htmlContent: `
              <!DOCTYPE html>
              <html lang="en">
              <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Pefscom Posts Notification</title></head>
              <body>
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#000000">
                  <tr><td align="center" style="padding: 20px 10px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width:600px; background: linear-gradient(135deg, #000000 0%, #1c1c1c 100%); border-radius: 8px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,255,0.3);">
                      <tr><td align="center">
                       <div style="padding: 20px; text-align: center; color: green;">
                          <h1 style="font-size: 36px; font-weight: 700; font-family: 'Georgia', serif; text-shadow: 0 0 10px rgba(0, 81, 255, 0.9);">🚀 New Order Notification</h1>
                          <p style="font-size: 18px;">A new Order Has Been Made to BTC</p>
                        </div>
                         </td></tr>
                      <tr><td style="padding: 0 30px 30px;">
                        <h2 style="color: green; font-family: 'Georgia', serif; font-size: 24px; margin-bottom: 10px;"> Order Details</h2>
                  <h2 style="color: green; font-family: 'Georgia', serif; font-size: 24px; margin-bottom: 10px;"> 
                  Customer Details</h2>
                 
                        <p><strong>Customer Name:</strong> ${newOrder.customer.name}</p>
                        <p style="color: green;"><strong>Email:</strong> ${newOrder.customer.email}</p>
                        <p style="color: green;"><strong>Address:</strong> ${newOrder.customer.address}</p>
                        <p style="color: green;"><strong>Illness Details:</strong> ${newOrder.customer.illness}</p>
                        <hr style="border-color: blue;">
                          <p style="color: green;"><strong>Number:</strong> ${newOrder.customer.number}</p>

                     
                        ${
                      newOrder.items.map((p)=>{`

                     <img src=${p.Picture} src=""/>
                        <p><strong>Sale Price:</strong> ${p.SalePrice}</p>
                        <p style="color: green;"><strong>Category:</strong> ${p.Category}</p>
                      
                        <p style="color: green;"><strong>Batch Number:</strong> ${p.BarcodeNumber}</p>
                        <hr style="border-color: blue;">
                          <p style="color: green;"><strong>Quantity:</strong> ${p.quantity}</p>


                        ` })
                      }
                          <p style="color: green;"><strong>BrowserID:</strong> ${newOrder.browserId}</p>
                          <p style="color: green;"><strong>Total Amount:</strong> ${newOrder.totalAmount}</p>
                          <p style="color: green;"><strong>Status:</strong> ${newOrder.status}</p>
                          <p style="color: green;"><strong>Confirmation Pin:</strong> ${newOrder.confirmationPin}</p>
                          <p style="color: green;"><strong>Date Ordered:</strong> ${newOrder.createdAt}</p>
                         

                          <p style="font-size: 0.9em; color: green;">This is an automatic notification to BTC admins.</p>
                      </td></tr>
                      <tr><td align="center" style="padding: 20px; background: #111; color: green; font-size: 14px;">
                        <p style="margin: 0;">btc &copy; 2025 | All rights reserved</p>
                        <p style="margin: 0;">Contact us: <a href="mailto:infor@btc.org" style="color: #1e90ff; text-decoration: none;">infor@btcpharmacy.org</a></p>
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
      
