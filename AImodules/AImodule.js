

import express from "express";
import axios from "axios";
import Drug from "../models/Drugs.js";
import Message from "./aimessages.js";
import Conversation from "./Conversation.js";
import Orders from "../models/Orders.js";
const router = express.Router();
const MAX_HISTORY_MESSAGES = 10;

async function getAIResponse({ userMessage, conversationId }) {
  const lowerMsg = userMessage.toLowerCase();

  let drugContext = "";
  const needsDrugData =
    lowerMsg.includes("drug") ||
    ["inventory", "cost", "expiry", "price", "barcode"].some((word) =>
      lowerMsg.includes(word)
    );

  if (needsDrugData) {
    try {
      const drugs = await Drug.find(
        {},
        {
          Name: 1,
          Category: 1,
          BarcodeNumber: 1,
          CostPrice: 1,
          SalePrice: 1,
          DateAdded: 1,
          ExpiryDate: 1,
        }
      ).lean();

     const detailedDrugInfo = drugs.map(
  (d) => `
- Name: ${d.Name}
- Category: ${d.Category}
- Barcode: ${d.BarcodeNumber}
- Cost: ${d.CostPrice}
- Sale: ${d.SalePrice}
- Added: ${d.DateAdded}
- Expiry: ${d.ExpiryDate}
-----------------------------`
).join("\n");




      let totalCost = 0,
        highest = 0,
        highestDrug = null,
        categoryCount = {};

      drugs.forEach((d) => {
        const cost = parseFloat(d.CostPrice) || 0;
        totalCost += cost;
        if (cost > highest) {
          highest = cost;
          highestDrug = d;
        }
        const cat = d.Category || "Uncategorized";
        categoryCount[cat] = (categoryCount[cat] || 0) + 1;
      });

      const avgCost = (totalCost / (drugs.length || 1)).toFixed(2);
      const mostCommon = Object.entries(categoryCount).reduce(
        (a, b) => (b[1] > a[1] ? b : a),
        ["None", 0]
      );

      const drugAnalysis = `
📊 Drug Summary:
- Total: ${drugs.length}
- Avg Cost: ${avgCost} XAF
- Highest: ${highestDrug?.Name || "N/A"} (${highest} XAF)
- Top Category: ${mostCommon[0]} (${mostCommon[1]} items)
`;

      drugContext = `
🧪 Drug Inventory:
${drugAnalysis}
${detailedDrugInfo}
`;
    } catch (err) {
      console.error("Drug Fetch Error:", err.message);
      drugContext = "⚠️ Unable to fetch drug data right now.";
    }
  }
let orderdetails = "(No order data required)";
try {
  const orders = await Orders.find().lean(); // ✅ Fetch all orders

  let totalAmount = 0;

  const ordersana = orders.map((o) => {
    const item = o.items?.[0] || {}; // Assumes o.items is an array

    totalAmount += parseFloat(o.totalAmount) || 0;

    return `
Orders
- BrowserID: ${o.browserId}
- Total Amount: ${o.totalAmount}
- Status: ${o.status}
- Confirmation Pin: ${o.confirmationPin}
- Date Ordered: ${o.createdAt}

Customer Details:
- Name: ${o.customer?.name}
- Email: ${o.customer?.email}
- Phone: ${o.customer?.number}
- Address: ${o.customer?.address}
- Illness: ${o.customer?.illness}

Order Details:
- Medicine Name: ${item.Name}
- Medicine Price: ${item.SalePrice}
- Picture: <img src="${item.Picture}" style="height: 100px, width: 90px;" alt="${item.Name}" />
- Category: ${item.Category}
- Batch Number: ${item.BarcodeNumber}
- Quantity: ${item.quantity}
-----------------------------`;
  });

  orderdetails = `
📦 **Order Details and Analysis**:
- 💰 Total Revenue from Orders: **${totalAmount.toFixed(2)} XAF**

${ordersana.join("\n\n")}
`;
} catch (err) {
  console.error("Order Fetch Error:", err.message);
  orderdetails = "⚠️ Unable to fetch order data right now.";
}



  let history = [];
  if (conversationId) {
    history = await Message.find({ conversationId })
      .sort({ createdAt: -1 })
      .limit(MAX_HISTORY_MESSAGES)
      .lean();
    history = history.reverse();
  }

// const systemMessage = {
//   role: "system",
//   content: `You are "Fortune's AI," a multitasking assistant (personal assistant, drug expert, general expert).
// You were created by che fortune orsa and aspiring software engineer , he is so skilled in developing software applications
// When responding, please:

// - Provide clear, professional, well-organized responses suitable for users to read easily.
// - Format using Markdown with headers, numbered lists, bold text, and bullet points.
// - Include these sections in your response:

// ### Drug Inventory Summary

// 1. List each drug with bold name and key details (category, barcode, cost price, sale price, added date, expiry date, notes).

// ### Summary Statistics

// - Total drugs in inventory
// - Average cost of drugs
// - Highest cost drug
// - Most represented category

// ### Key Insights

// - Important observations or recommendations

// Here is the drug data for reference:

// ${drugContext || "(No drug data required)"}

// And again if users ask about Orders analysis make sure you give them a clear analysis of all the orders

// -give them statistics base on the available order you can even give them the drug details
// -and also on orders give them images of the ordered drugs

// Here is the order data for reference:

// ${orderdetails || "(No order data required)"}
// ### 🖼️ Image Generation Instruction

// If you are asked to generate an image, find a **real image from a source like Freepik, Unsplash, or Google Images**, and return it directly using an HTML tag.

// **Return it exactly in this format:**

// \`\`\`html
// <img src="https://img.freepik.com/free-photo/sick-man-with-cold-drinking-medicine-tablets_23-2148440306.jpg" alt="Man drinking medicine" style="max-width: 100%; height: auto;" />
// \`\`\`

// ✅ Do **not** return only the URL or wrap it in backticks.  
// ✅ Always return the **full `<img>` HTML tag** as the actual output.  
// ✅ Ensure the image URL is real and ends in `.jpg`, `.png`, etc. so it can render.

// This will allow the image to be displayed automatically on the client side.

// Keep language concise, formal, and informative. Avoid verbosity and repetition.`,
// };



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
You are "Fortune's AI," a multitasking assistant (personal assistant, drug expert, general expert).
You were created by Che Fortune Orsa, an aspiring software engineer skilled in developing software applications.

When responding, please:

- Provide clear, professional, and well-organized responses using Markdown formatting (headings, numbered lists, bold, bullet points).
- Always include these sections when relevant:

---

### Drug Inventory Summary

1. List each drug with **bold name** and key details:
   - Category
   - Barcode
   - Cost price
   - Sale price
   - Date added
   -Drug Picture
   - Expiry date

### Summary Statistics

- Total drugs in inventory
- Average cost of drugs
- Highest cost drug
- Most represented category

### Key Insights

- Important observations or recommendations

---

### 🧪 Drug Data

${drugContext || "(No drug data required)"}

---

### 📦 Order Data

Give clear analysis of all orders:
- Show statistics based on available orders
- Include images of ordered drugs

${orderdetails || "(No order data required)"}

---

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
router.post("/conversations", async (req, res) => {
  try {
    const conversation = new Conversation();
    await conversation.save();
    res.status(201).json(conversation);
  } catch (err) {
    res.status(500).json({ message: "Failed to create conversation" });
  }
});

// Get all conversations
router.get("/conversations", async (req, res) => {
  try {
    const conversations = await Conversation.find().sort({ updatedAt: -1 });
    res.json(conversations);
  } catch (err) {
    res.status(500).json({ message: "Failed to get conversations" });
  }
});

// Get messages for one conversation
router.get("/messages/:conversationId", async (req, res) => {
  try {
    const messages = await Message.find({ conversationId: req.params.conversationId }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: "Failed to get messages" });
  }
});

// Send a message and get AI reply
router.post("/", async (req, res) => {
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
router.delete("/conversations", async (req, res) => {
  try {
    await Message.deleteMany({});
    await Conversation.deleteMany({});
    res.json({ message: "All conversations deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete" });
  }
});

export default router;
