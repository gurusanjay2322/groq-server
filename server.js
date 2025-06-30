import express from "express";
import Groq from "groq-sdk";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config(); 

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const systemPrompt = `
You are a smart and decisive Vendor Sales AI.
Given product and sales data, return exactly ONE most probable and impactful action the vendor should take.

Respond with:
1. Top Action (short title)
2. Reason (based on expiry, sales trends, stock, price etc.)
3. Risk Level (None, Low, Moderate, or High)

❗ Do NOT list multiple actions. Choose just one strategic action based on the product context.

Example:
1. **Top Action: Offer Discount to Clear Stock**
2. **Reason:** The product is close to expiry, and sales are slower than needed to clear inventory. A discount can accelerate sales.
3. **Risk Level: Moderate**
`;

function formatPrompt(product) {
  return `
Product Name: ${product["Product Name"]}
Vendor: ${product["Vendor"]}
Category: ${product["Category"]}
Stock Quantity: ${product["Stock Qty"]}
Units Sold per Day: ${product["Units/Day"].toFixed(2)}
Selling Price: ${product["Price"]} ${product["Currency"]}
Wholesale Price: ${product["Wholesale Price"]} ${product["Currency"]}
Manufacture Date: ${product["Manufacture Date"]}
Expiry Date: ${product["Expiry Date"]}
Product Expiry Days: ${product["Product Expiry Days"]}
Today: ${new Date().toISOString().split("T")[0]}
  `.trim();
}

// 🛠️ POST Endpoint
app.post("/api/groq", async (req, res) => {
  const products = req.body;

  if (!Array.isArray(products)) {
    return res.status(400).json({ error: "Expected an array of products" });
  }

  console.log(`📦 Received ${products.length} products for analysis`);

  const results = [];

  try {
    for (const product of products) {
      const prompt = formatPrompt(product);
      let responseText = "";

      const stream = await groq.chat.completions.create({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 512,
        top_p: 1,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        responseText += content;
      }

      results.push({
        productName: product["Product Name"],
        suggestion: responseText,
      });
    }

    res.json({ suggestions: results });
  } catch (err) {
    console.error("❌ Groq API error:", err.message);
    res.status(500).json({ error: "Something went wrong during processing." });
  }
});


// 🔍 Health Check
app.get("/", (_req, res) => {
  res.send("Vendor Sales AI API is running!");
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
