import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Lazy loader for Gemini client to prevent crashes if key is omitted
let aiInstance: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiInstance) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn("GEMINI_API_KEY is not configured. Falling back to local smart analyzer.");
      return null;
    }
    aiInstance = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

const app = express();
const PORT = 3000;

app.use(express.json());

// Firebase Integration
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, getDocs, collection, query, where, getDocFromServer } from 'firebase/firestore';

let firebaseConfig: any;
try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } else if (process.env.FIREBASE_CONFIG) {
    firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG);
  } else {
    firebaseConfig = {
      projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0547979888",
      appId: process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || "1:728923987407:web:d96919661687d3b81e46ba",
      apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || "AIzaSyBD4rj0m2JiCJ2s0Czu0j-Quw2Nq8fnMOE",
      authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN || "gen-lang-client-0547979888.firebaseapp.com",
      firestoreDatabaseId: process.env.VITE_FIREBASE_DATABASE_ID || process.env.FIREBASE_DATABASE_ID || "ai-studio-068cc302-3bfe-4c72-b209-6280d5b332d2",
      storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || "gen-lang-client-0547979888.firebasestorage.app",
      messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID || "728923987407",
    };
  }
} catch (err) {
  console.error("Failed to parse Firebase configuration:", err);
  firebaseConfig = {
    projectId: "gen-lang-client-0547979888",
    appId: "1:728923987407:web:d96919661687d3b81e46ba",
    apiKey: "AIzaSyBD4rj0m2JiCJ2s0Czu0j-Quw2Nq8fnMOE",
    authDomain: "gen-lang-client-0547979888.firebaseapp.com",
    firestoreDatabaseId: "ai-studio-068cc302-3bfe-4c72-b209-6280d5b332d2",
    storageBucket: "gen-lang-client-0547979888.firebasestorage.app",
    messagingSenderId: "728923987407",
  };
}

// Guarantee valid properties even if some parts in the try-block resolved to empty fields
if (!firebaseConfig) {
  firebaseConfig = {};
}
firebaseConfig.projectId = firebaseConfig.projectId || "gen-lang-client-0547979888";
firebaseConfig.appId = firebaseConfig.appId || "1:728923987407:web:d96919661687d3b81e46ba";
firebaseConfig.apiKey = firebaseConfig.apiKey || "AIzaSyBD4rj0m2JiCJ2s0Czu0j-Quw2Nq8fnMOE";
firebaseConfig.authDomain = firebaseConfig.authDomain || "gen-lang-client-0547979888.firebaseapp.com";
firebaseConfig.firestoreDatabaseId = firebaseConfig.firestoreDatabaseId || "ai-studio-068cc302-3bfe-4c72-b209-6280d5b332d2";
firebaseConfig.storageBucket = firebaseConfig.storageBucket || "gen-lang-client-0547979888.firebasestorage.app";
firebaseConfig.messagingSenderId = firebaseConfig.messagingSenderId || "728923987407";

const firebaseApp = initializeApp(firebaseConfig);
const firestoreDb = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {},
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Mandatory connection audit validation
async function testConnection() {
  try {
    await getDocFromServer(doc(firestoreDb, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

const DEFAULT_PRODUCTS = [
  {
    id: "prod-1",
    name: "Kaos Oversize Pria Cotton Combed 24s Heavyweight Premium",
    originalPrice: 89000,
    discountedPrice: 42000,
    discountPercent: 53,
    imageUrl: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=500&auto=format&fit=crop&q=60",
    shopeeLink: "https://shopee.co.id/Kaos-Oversize-Pria-Cotton-Combed-24s",
    rating: 4.8,
    salesCount: 12500,
    category: "Fashion Pria",
    description: "Kaos oversize premium dengan bahan Cotton Combed 24s tebal, menyerap keringat dan sangat adem. Melalui optimasi Jastip Hemat Shopee, kami menggabungkan Voucher Toko, Voucher Shopee Live 40%, dan Koin Shopee Anda untuk memotong harga dari Rp89.000 menjadi hanya Rp42.000 saja!"
  },
  {
    id: "prod-2",
    name: "TWS Earphone Wireless Bluetooth 5.3 Noise Cancelling Waterproof",
    originalPrice: 199000,
    discountedPrice: 85000,
    discountPercent: 57,
    imageUrl: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500&auto=format&fit=crop&q=60",
    shopeeLink: "https://shopee.co.id/TWS-Earphone-Wireless-Bluetooth-5.3",
    rating: 4.9,
    salesCount: 4300,
    category: "Elektronik",
    description: "Nikmati musik tanpa batas dengan TWS Bluetooth 5.3 terkini. Menggunakan jalur checkout optimasi akun VIP Shopee Video kami, Anda bisa menghemat lebih dari setengah harga ritel normal. Sudah termasuk garansi 12 bulan."
  },
  {
    id: "prod-3",
    name: "Aesthetic Hydration Flask Gelas Termos Stainless Steel 1 Liter",
    originalPrice: 145000,
    discountedPrice: 65000,
    discountPercent: 55,
    imageUrl: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500&auto=format&fit=crop&q=60",
    shopeeLink: "https://shopee.co.id/Termos-Stainless-Steel-1-Liter",
    rating: 4.7,
    salesCount: 8900,
    category: "Perlengkapan Rumah",
    description: "Termos minum trendy masa kini dengan insulator double wall super tebal. Menjaga suhu air dingin sampai 24 jam dan air panas sampai 12 jam. Jastip Hemat kami menggunakan klaim voucher kilat Flash Sale Shopee untuk membelikan barang ini dengan harga miring."
  },
  {
    id: "prod-4",
    name: "Korean Style Oversized Cardigan Rajut Wanita Tebal Premium",
    originalPrice: 120000,
    discountedPrice: 58000,
    discountPercent: 52,
    imageUrl: "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=500&auto=format&fit=crop&q=60",
    shopeeLink: "https://shopee.co.id/Korean-Style-Oversized-Cardigan",
    rating: 4.8,
    salesCount: 6100,
    category: "Fashion Wanita",
    description: "Kardigan rajut rajutan rapat bergaya kasual Korea yang sangat viral. Nyaman dipakai harian maupun hangout formal. Di-checkout menggunakan Voucher Shopee Video XTRA up to 40% dan voucher Toko terpilih."
  },
  {
    id: "prod-5",
    name: "Ergonomic Office Chair Kursi Kerja Jaring Nyaman dengan Adjustable Armrest",
    originalPrice: 750000,
    discountedPrice: 389000,
    discountPercent: 48,
    imageUrl: "https://images.unsplash.com/photo-1505797149-43b0069ec26b?w=500&auto=format&fit=crop&q=60",
    shopeeLink: "https://shopee.co.id/Ergonomic-Office-Chair-Kursi-Kerja",
    rating: 4.6,
    salesCount: 1800,
    category: "Mebel & Furniture",
    description: "Kursi kantor ergonomis dengan sandaran jaring breathable yang menopang tulang lumbar belakang. Dilengkapi setelan tinggi hidrolik dan armrest. Checkout menggunakan paket Gratis Ongkir XTRA Kargo + Voucher Elektronik untuk memangkas biaya ongkir dan harga jual."
  }
];

// Seed products to Firestore helper
async function seedProductsIfNeeded() {
  try {
    const pRef = collection(firestoreDb, "products");
    const snap = await getDocs(pRef);
    if (snap.empty) {
      console.log("Seeding initial products into Firestore datastore...");
      for (const p of DEFAULT_PRODUCTS) {
        await setDoc(doc(firestoreDb, "products", p.id), p);
      }
    }
  } catch (error) {
    console.error("Error seeding products:", error);
  }
}
seedProductsIfNeeded();

// Global in-memory state for the currently logged in owner/admin
let activeAdmin = {
  name: "Owner NusaKirim",
  lastLogin: new Date().toISOString()
};

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// Get currently active admin
app.get("/api/active-admin", (req, res) => {
  res.json(activeAdmin);
});

// Update/Login active admin
app.post("/api/active-admin", (req, res) => {
  const { name, password } = req.body;
  if (!password) {
    return res.status(400).json({ error: "Password wajib diisi." });
  }
  
  const correctPassword = password === "Useradmin12";
  if (!correctPassword) {
    return res.status(401).json({ error: "Password Admin salah!" });
  }

  if (name && name.trim()) {
    activeAdmin.name = name.trim();
  } else {
    activeAdmin.name = "Owner NusaKirim";
  }
  activeAdmin.lastLogin = new Date().toISOString();
  res.json({ success: true, admin: activeAdmin });
});

// Get Products
app.get("/api/products", async (req, res, next) => {
  try {
    const pRef = collection(firestoreDb, "products");
    const snap = await getDocs(pRef);
    let productsList: any[] = [];
    snap.forEach((doc) => {
      productsList.push(doc.data());
    });
    if (productsList.length === 0) {
      await seedProductsIfNeeded();
      return res.json({ products: DEFAULT_PRODUCTS });
    }
    res.json({ products: productsList });
  } catch (e) {
    try {
      handleFirestoreError(e, OperationType.GET, "products");
    } catch (err) {
      next(err);
    }
  }
});

// Create/Request Product Addition to catalog
app.post("/api/products", async (req, res, next) => {
  const { name, originalPrice, discountedPrice, imageUrl, shopeeLink, category, description } = req.body;
  
  if (!name || !originalPrice || !shopeeLink) {
    return res.status(400).json({ error: "Name, Original Price, and Shopee Link are required." });
  }

  const discountVal = originalPrice > discountedPrice ? Math.round(((originalPrice - discountedPrice) / originalPrice) * 100) : 0;
  const newId = `prod-${Date.now()}`;

  const newProduct = {
    id: newId,
    name,
    originalPrice: Number(originalPrice),
    discountedPrice: discountedPrice ? Number(discountedPrice) : Math.round(originalPrice * 0.5),
    discountPercent: discountVal || 50,
    imageUrl: imageUrl || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60",
    shopeeLink,
    rating: 5.0,
    salesCount: 1,
    category: category || "Umum",
    description: description || "Ditambahkan oleh pengguna. Siap dioptimisasi checkout voucher murah!"
  };

  try {
    await setDoc(doc(firestoreDb, "products", newId), newProduct);
    res.status(201).json(newProduct);
  } catch (e) {
    try {
      handleFirestoreError(e, OperationType.WRITE, `products/${newId}`);
    } catch (err) {
      next(err);
    }
  }
});

// Get orders for a user
app.get("/api/orders", async (req, res, next) => {
  try {
    const userId = req.query.userId as string;
    const ordersCol = collection(firestoreDb, "orders");
    let snap;
    if (userId) {
      const q = query(ordersCol, where("userId", "==", userId));
      snap = await getDocs(q);
    } else {
      snap = await getDocs(ordersCol);
    }
    let list: any[] = [];
    snap.forEach((doc) => {
      list.push(doc.data());
    });
    // Sort descending by createdAt
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json({ orders: list });
  } catch (e) {
    try {
      handleFirestoreError(e, OperationType.GET, "orders");
    } catch (err) {
      next(err);
    }
  }
});

// Get single order
app.get("/api/orders/:id", async (req, res, next) => {
  try {
    const orderSnap = await getDoc(doc(firestoreDb, "orders", req.params.id));
    if (!orderSnap.exists()) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.json(orderSnap.data());
  } catch (e) {
    try {
      handleFirestoreError(e, OperationType.GET, `orders/${req.params.id}`);
    } catch (err) {
      next(err);
    }
  }
});

// Create Order (Checkout Jastip)
app.post("/api/orders", async (req, res, next) => {
  const {
    userId,
    customerName,
    customerPhone,
    customerAddress,
    productUrl,
    productName,
    productVariant,
    originalPrice,
    checkoutPrice,
    jastipFee,
    totalPayment,
    notes,
    recipientName,
    voucherScenarios
  } = req.body;

  if (!userId || !customerName || !customerPhone || !customerAddress || !productUrl || !productName) {
    return res.status(400).json({ error: "Mohon isi semua data pembeli dan detail produk." });
  }

  const orderId = `order-${Math.floor(100000 + Math.random() * 900000)}`;

  const newOrder = {
    id: orderId,
    userId,
    customerName,
    customerPhone,
    customerAddress,
    productUrl,
    productName,
    productVariant: productVariant || "Standar (Default)",
    originalPrice: Number(originalPrice),
    checkoutPrice: Number(checkoutPrice),
    jastipFee: Number(jastipFee || 5000),
    totalPayment: Number(totalPayment),
    status: "PENDING",
    notes: notes || "",
    recipientName: recipientName || customerName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    chats: [
      {
        id: "chat-init",
        sender: "ai",
        message: `Halo kak ${customerName}! Pengajuan Jastip Shopee Hemat kakak untuk "${productName}" berhasil diterima. AI kami sedang mengoptimalkan voucher Shopee Live / Video untuk orderan kakak. Silakan pantau status pengerjaan atau chat langsung di sini bila ada pertanyaan ya!`,
        timestamp: new Date().toISOString()
      }
    ],
    voucherScenarios: voucherScenarios || []
  };

  try {
    await setDoc(doc(firestoreDb, "orders", orderId), newOrder);
    res.status(201).json(newOrder);
  } catch (e) {
    try {
      handleFirestoreError(e, OperationType.WRITE, `orders/${orderId}`);
    } catch (err) {
      next(err);
    }
  }
});

// Admin update status order
app.patch("/api/orders/:id/status", async (req, res, next) => {
  const { status, trackingNumber } = req.body;
  const orderRef = doc(firestoreDb, "orders", req.params.id);

  try {
    const orderSnap = await getDoc(orderRef);
    if (!orderSnap.exists()) {
      return res.status(404).json({ error: "Order tidak ditemukan" });
    }

    const order = orderSnap.data();
    order.status = status || order.status;
    if (trackingNumber) {
      order.trackingNumber = trackingNumber;
    }
    order.updatedAt = new Date().toISOString();

    // Add a helper system announcement message
    let statusIndo = "Menunggu pemeriksaan";
    if (status === "APPROVED") statusIndo = "DISETUJUI (Siap Bayar)";
    if (status === "WAITING_PAYMENT") statusIndo = "MENUNGGU PEMBAYARAN KONSUMEN";
    if (status === "PAID") statusIndo = "SUDAH DIBAYAR (Sedang diproses belikan di Shopee oleh tim)";
    if (status === "ORDERED") statusIndo = "PRODUK TELAH DIPESAN DI SHOPEE";
    if (status === "SHIPPED") statusIndo = `SEDANG DIKIRIM (No. Resi: ${trackingNumber || 'Segera update'})`;
    if (status === "COMPLETED") statusIndo = "TRANSAKSI SELESAI (Masukan diterima)";
    if (status === "CANCELLED") statusIndo = "TRANSAKSI DIBATALKAN";

    order.chats.push({
      id: `chat-status-${Date.now()}`,
      sender: "admin",
      message: `[Sistem Jastip] Status pesanan Anda diperbarui ke: ${statusIndo}`,
      timestamp: new Date().toISOString()
    });

    await setDoc(orderRef, order);
    res.json(order);
  } catch (e) {
    try {
      handleFirestoreError(e, OperationType.WRITE, `orders/${req.params.id}/status`);
    } catch (err) {
      next(err);
    }
  }
});

// Client/Admin send chat message in order
app.post("/api/orders/:id/chats", async (req, res, next) => {
  const { sender, message, senderName } = req.body;
  if (!sender || !message) {
    return res.status(400).json({ error: "Sender and message fields are required" });
  }

  const orderRef = doc(firestoreDb, "orders", req.params.id);

  try {
    const orderSnap = await getDoc(orderRef);
    if (!orderSnap.exists()) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = orderSnap.data();
    const newChat = {
      id: `chat-${Date.now()}`,
      sender,
      senderName: sender === 'admin' ? (senderName || activeAdmin.name) : undefined,
      message,
      timestamp: new Date().toISOString()
    };

    order.chats.push(newChat);

    // If user sends a chat, let the Gemini AI act as a smart Support Agent answering their queries immediately!
    if (sender === "user") {
      try {
        const historyCtx = order.chats.slice(-10).map((c: any) => `${c.sender}: ${c.message}`).join("\n");
        const systemPrompt = `Anda adalah Customer Support AI dari "Jasa Pembelian Shopee Hemat" (Jastip Hemat).
Aplikasi kami membantu konsumen membeli barang Shopee dengan harga jauh lebih murah menggunakan teknik optimasi voucher ganda, flash sale VIP, Shopee Live 50%, Shopee Video 40%, koin Shopee, dan gratis ongkir kargo tersembunyi.
Informasi Order Saat Ini:
- ID Pesanan: ${order.id}
- Produk: ${order.productName} (Variant: ${order.productVariant})
- Harga Asli Shopee: Rp${order.originalPrice.toLocaleString('id-ID')}
- Harga Optimasi Jastip: Rp${order.checkoutPrice.toLocaleString('id-ID')}
- Fee Jastip: Rp${order.jastipFee.toLocaleString('id-ID')}
- Total Bayar: Rp${order.totalPayment.toLocaleString('id-ID')}
- Status Pesanan: ${order.status}
- Resi Pengiriman: ${order.trackingNumber || 'Belum keluar'}
- Alamat Kirim: ${order.customerAddress} atas nama ${order.recipientName}

Bantulah menjawab pertanyaan dari user dengan ramah, informatif, singkat, santun, dalam Bahasa Indonesia.
Terangkan langkah pembayaran atau rincian penghematan bila ditanya.
Jika status WAITING_PAYMENT atau APPROVED, anjurkan mereka untuk melakukan transfer pembayaran dan konfirmasi di tombol yang disediakan.
Jika status PENDING, jelaskan bahwa tim admin sedang memverifikasi link Shopee produk tersebut dan akan segera mengaktifkan diskon.`;

        const client = getGeminiClient();
        if (!client) {
          throw new Error("Gemini AI client is not available.");
        }
        const genResponse = await client.models.generateContent({
          model: "gemini-3.5-flash",
          contents: `Chat History:\n${historyCtx}\n\nJawablah pesan terakhir user di atas sebagai Customer Support AI:`,
          config: {
            systemInstruction: systemPrompt
          }
        });

        const aiText = genResponse.text || "Halo kak, mohon maaf server kami sibuk sebentar. Tim kami akan segera membantu melayani kakak ya!";
        order.chats.push({
          id: `chat-ai-${Date.now()}`,
          sender: "ai",
          message: aiText,
          timestamp: new Date().toISOString()
        });
      } catch (aiErr) {
        console.error("AI chat reply failed:", aiErr);
        order.chats.push({
          id: `chat-ai-fallback-${Date.now()}`,
          sender: "ai",
          message: "Halo kak, pesan kakak sudah kami terima. Admin kami akan segera mengecek dan merespon pesan kakak secara langsung ya! Terima kasih banyak kabarnya.",
          timestamp: new Date().toISOString()
        });
      }
    }

    order.updatedAt = new Date().toISOString();
    await setDoc(orderRef, order);
    res.json(order);
  } catch (e) {
    try {
      handleFirestoreError(e, OperationType.WRITE, `orders/${req.params.id}/chats`);
    } catch (err) {
      next(err);
    }
  }
});

// AI Optimization Link Endpoint (Uses Gemini API key)
app.post("/api/optimize-link", async (req, res) => {
  const { shopeeLink, notes } = req.body;
  if (!shopeeLink) {
    return res.status(400).json({ error: "Shopee product link is required." });
  }

  const promptText = `Analyze this Shopee product link: "${shopeeLink}".
Additional Info from User: "${notes || 'Tidak ada catatan tambahan'}"

Role: You are a professional Shopee Checkout Optimization Algorithm.
Task: Evaluate the item based on typical Shopee e-commerce prices, identify potential Shopee vouchers, and make a highly optimized bargain purchasing model.
Find a product name (or create/guess a realistic matching product name in Bahasa Indonesia based on words in the link).
Typical Shopee discount mechanics available:
1. Voucher Toko / Seller Shop (e.g. 5-10% off)
2. Shopee Video Diskon Up to 40% (Max 15k or 25k IDR)
3. Shopee Live Diskon Up to 50% (Max 20k or 30k IDR)
4. Coin Shopee deduction (Up to 10-25% depending on coins)
5. Gratis Ongkir Xtra (Savings of 10k - 30k IDR in shipping fees)

Please invent / extract a matching high-quality original retail price on Shopee (e.g., between Rp 50.000 to Rp 1.500.000) depending on what kind of item is implied in the link.
Calculate the optimized Jastip Price after applying these vouchers. Usually, Jastip is able to save between 30% to 60% off the original price!
Your output MUST be a JSON object conforming exactly to this schema:
{
  "productName": "string representing clean Indonesian name of the product",
  "originalPrice": number_of_rough_original_price_idr,
  "optimizedPrice": number_of_discounted_price_idr,
  "savings": number_of_savings_amount_idr,
  "savingsExplanation": "Detailed step-by-step description in Indonesian explaining exactly how our VIP Buyer account combined multiple vouchers and coupon stacks to cut the price down",
  "vouchersApplied": [
    {
      "name": "Voucher live / video / shop coupon name",
      "savingAmount": number_withdrawn,
      "description": "Short explanation how this specific voucher applies"
    }
  ],
  "jastipFee": number_flat_fee (suggested between 3000 to 15000 depending on item size),
  "totalPayment": number_optimizedPrice_plus_jastipFee,
  "variantOptions": ["Array of short variant strings, e.g. Black - M, White - L, standard"]
}

Output ONLY valid JSON code. Do not wrap in markdown boxes or text block backticks from the generator, start with { and end with }!`;

  try {
    const client = getGeminiClient();
    if (!client) {
      throw new Error("Gemini API is not configured. Falling back to local smart analyzer.");
    }

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptText,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["productName", "originalPrice", "optimizedPrice", "savings", "savingsExplanation", "vouchersApplied", "jastipFee", "totalPayment", "variantOptions"],
          properties: {
            productName: { type: Type.STRING },
            originalPrice: { type: Type.NUMBER },
            optimizedPrice: { type: Type.NUMBER },
            savings: { type: Type.NUMBER },
            savingsExplanation: { type: Type.STRING },
            vouchersApplied: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["name", "savingAmount", "description"],
                properties: {
                  name: { type: Type.STRING },
                  savingAmount: { type: Type.NUMBER },
                  description: { type: Type.STRING }
                }
              }
            },
            jastipFee: { type: Type.NUMBER },
            totalPayment: { type: Type.NUMBER },
            variantOptions: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        }
      }
    });

    const resultText = response.text?.trim() || "{}";
    const optimizationResult = JSON.parse(resultText);

    // Provide a nice default cover photo based on item name category
    let imageUrl = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60"; // generic gadget/backpack
    const lowerName = (optimizationResult.productName || "").toLowerCase();
    
    if (lowerName.includes("baju") || lowerName.includes("kaos") || lowerName.includes("sweater") || lowerName.includes("t-shirt") || lowerName.includes("celana") || lowerName.includes("kemeja") || lowerName.includes("cardigan") || lowerName.includes("hijab") || lowerName.includes("jaket")) {
      imageUrl = "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=500&auto=format&fit=crop&q=60";
    } else if (lowerName.includes("sepatu") || lowerName.includes("sandal") || lowerName.includes("sneakers") || lowerName.includes("boots")) {
      imageUrl = "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&auto=format&fit=crop&q=60";
    } else if (lowerName.includes("hp") || lowerName.includes("phone") || lowerName.includes("earphone") || lowerName.includes("tws") || lowerName.includes("mouse") || lowerName.includes("keyboard") || lowerName.includes("charger") || lowerName.includes("speaker") || lowerName.includes("bluetooth")) {
      imageUrl = "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=500&auto=format&fit=crop&q=60";
    } else if (lowerName.includes("kosmetik") || lowerName.includes("sunscreen") || lowerName.includes("lipstik") || lowerName.includes("skincare") || lowerName.includes("serum") || lowerName.includes("bedak")) {
      imageUrl = "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=500&auto=format&fit=crop&q=60";
    } else if (lowerName.includes("botol") || lowerName.includes("termos") || lowerName.includes("piring") || lowerName.includes("mug") || lowerName.includes("tumbler")) {
      imageUrl = "https://images.unsplash.com/photo-1517256064527-09c53b2d0bc6?w=500&auto=format&fit=crop&q=60";
    }

    res.json({
      ...optimizationResult,
      imageUrl
    });

  } catch (error) {
    console.warn("Link optimization via Gemini failed, loading high-fidelity smart Indonesian parser local fallback:", error);
    
    // 1. Clean query params first
    const urlWithoutQuery = shopeeLink.split('?')[0];
    const linkSlug = urlWithoutQuery.split('/').pop() || "Produk Shopee Pilihan";
    
    // 2. Clean hyphens and system identifiers
    let cleanedName = linkSlug
      .replace(/-/g, ' ')
      .replace(/i\.\d+\.\d+/g, '')
      .trim();

    const productName = cleanedName 
      ? (cleanedName.charAt(0).toUpperCase() + cleanedName.slice(1)).substring(0, 65) 
      : "Produk Jastip Shopee Hemat";

    // 3. Category & Heuristics setup
    let originalPrice = 175000;
    let category = "Umum";
    let imageUrl = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60";
    let variantOptions = ["Ukuran Standar", "Warna Hitam", "Warna Putih", "Custom (Tipe di Catatan)"];

    const lowerCleaned = (productName + " " + (notes || "")).toLowerCase();

    if (lowerCleaned.includes("baju") || lowerCleaned.includes("kaos") || lowerCleaned.includes("sweater") || lowerCleaned.includes("t-shirt") || lowerCleaned.includes("celana") || lowerCleaned.includes("kemeja") || lowerCleaned.includes("cardigan") || lowerCleaned.includes("hijab") || lowerCleaned.includes("jaket") || lowerCleaned.includes("gamis") || lowerCleaned.includes("dress")) {
      category = "Fashion & Pakaian";
      originalPrice = 85000 + Math.floor(Math.random() * 41) * 1000; // 85k - 125k
      imageUrl = "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=500&auto=format&fit=crop&q=60";
      variantOptions = ["M - Hitam", "L - Hitam", "XL - Hitam", "M - Putih", "L - Putih", "XL - Putih", "Varian Lain (Sesuai Catatan)"];
    } else if (lowerCleaned.includes("sepatu") || lowerCleaned.includes("sandal") || lowerCleaned.includes("sneakers") || lowerCleaned.includes("boots")) {
      category = "Alas Kaki";
      originalPrice = 249000 + Math.floor(Math.random() * 81) * 1000; // 249k - 329k
      imageUrl = "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&auto=format&fit=crop&q=60";
      variantOptions = ["Ukuran 39", "Ukuran 40", "Ukuran 41", "Ukuran 42", "Ukuran 43"];
    } else if (lowerCleaned.includes("hp") || lowerCleaned.includes("phone") || lowerCleaned.includes("earphone") || lowerCleaned.includes("tws") || lowerCleaned.includes("mouse") || lowerCleaned.includes("keyboard") || lowerCleaned.includes("charger") || lowerCleaned.includes("speaker") || lowerCleaned.includes("bluetooth")) {
      category = "Elektronik & Gadget";
      originalPrice = 119000 + Math.floor(Math.random() * 81) * 1000; // 119k - 199k
      if (lowerCleaned.includes("hp") || lowerCleaned.includes("phone") || lowerCleaned.includes("laptop")) {
        originalPrice = 1250000 + Math.floor(Math.random() * 1250) * 1000; // 1.25M - 2.5M
      }
      imageUrl = "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=500&auto=format&fit=crop&q=60";
      variantOptions = ["Warna Hitam Stellar", "Warna Putih Polar", "Warna Abu-abu Space", "Tipe Standar"];
    } else if (lowerCleaned.includes("kosmetik") || lowerCleaned.includes("sunscreen") || lowerCleaned.includes("lipstik") || lowerCleaned.includes("skincare") || lowerCleaned.includes("serum") || lowerCleaned.includes("bedak")) {
      category = "Kecantikan & Skincare";
      originalPrice = 65000 + Math.floor(Math.random() * 61) * 1000; // 65k - 125k
      imageUrl = "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=500&auto=format&fit=crop&q=60";
      variantOptions = ["Paket Starter", "Ukuran Full Size", "Shade Light", "Shade Natural"];
    } else if (lowerCleaned.includes("botol") || lowerCleaned.includes("termos") || lowerCleaned.includes("piring") || lowerCleaned.includes("mug") || lowerCleaned.includes("tumbler") || lowerCleaned.includes("panci")) {
      category = "Perkengkapan Rumah";
      originalPrice = 49000 + Math.floor(Math.random() * 61) * 1000; // 49k - 109k
      imageUrl = "https://images.unsplash.com/photo-1517256064527-09c53b2d0bc6?w=500&auto=format&fit=crop&q=60";
      variantOptions = ["Ukuran 500ml", "Ukuran 1 Liter", "Varian Original Stainless"];
    }

    // 4. Extract price specified in user notes to make it highly personalized!
    const notesStr = (notes || "").toLowerCase();
    let customPrice = 0;
    
    // Pattern A: matching "120rb", "120 rbu", "50k", etc.
    const rbPattern = /(\d+(?:[.,]\d+)?)\s*(?:rb|k|ribu)/i;
    const rbMatch = notesStr.match(rbPattern);
    if (rbMatch) {
      const val = parseFloat(rbMatch[1].replace(',', '.'));
      if (val > 0 && val < 50000) {
        customPrice = val * 1000;
      }
    }
    
    // Pattern B: matching "1.2jt", "2 juta", etc.
    if (customPrice === 0) {
      const jtPattern = /(\d+(?:[.,]\d+)?)\s*(?:jt|juta)/i;
      const jtMatch = notesStr.match(jtPattern);
      if (jtMatch) {
        const val = parseFloat(jtMatch[1].replace(',', '.'));
        if (val > 0 && val < 100) {
          customPrice = val * 1000000;
        }
      }
    }
    
    // Pattern C: matching full digits e.g. "120.000" or "Rp 150000"
    if (customPrice === 0) {
      const numPattern = /(?:rp\.?\s*)?(\d{1,3}(?:[.,]\d{3})+|\d{4,9})/i;
      const numMatch = notesStr.match(numPattern);
      if (numMatch) {
        const valStr = numMatch[1].replace(/[.,]/g, '');
        const val = parseInt(valStr, 10);
        if (val >= 10000 && val <= 35000000) {
          customPrice = val;
        }
      }
    }

    if (customPrice > 0) {
      originalPrice = customPrice;
    }

    // 5. Compute dynamic checkout logic (Usually 35% - 55% savings on Jastip VIP)
    const discountPercent = 35 + Math.floor(Math.random() * 21);
    const rawSavings = Math.round((originalPrice * discountPercent / 100) / 1000) * 1000;
    const safeSavings = Math.max(5000, rawSavings);
    
    const optimizedPrice = Math.max(10000, originalPrice - safeSavings);
    const finalSavings = originalPrice - optimizedPrice;

    // Distribute voucher amounts
    const videoAmount = Math.round((finalSavings * 0.55) / 1000) * 1000;
    const liveAmount = Math.round((finalSavings * 0.35) / 1000) * 1000;
    const coinAmount = Math.max(0, finalSavings - videoAmount - liveAmount);

    const vouchersApplied = [];
    if (videoAmount > 0) {
      vouchersApplied.push({
        name: "Voucher Akun Emas Shopee Video",
        savingAmount: videoAmount,
        description: "Potongan harga video instan tumpuk ganda khusus logistik NusaKirim."
      });
    }
    if (liveAmount > 0) {
      vouchersApplied.push({
        name: "Klaim Live-host Streamer 50%",
        savingAmount: liveAmount,
        description: "Kupon diskon Live kilat yang ditangkap otomatis oleh server jastip."
      });
    }
    if (coinAmount > 0) {
      vouchersApplied.push({
        name: "Subsidi Koin Shopee & Ongkir Cargo",
        savingAmount: coinAmount,
        description: "Pengurangan total menggunakan simpanan loyalitas koin VIP."
      });
    }

    const jastipFee = optimizedPrice > 500000 ? 12000 : (optimizedPrice > 150000 ? 7500 : 5000);
    const totalPayment = optimizedPrice + jastipFee;

    const savingsExplanation = `Mendeteksi produk "${productName}". Jaringan Jastip NusaKirim mengoptimalkan voucher Shopee Video ganda (hemat Rp${videoAmount.toLocaleString('id-ID')}) serta slot kupon diskon Live 50% streamer (hemat Rp${liveAmount.toLocaleString('id-ID')}). Bersama potongan saldo koin terklaim, total hemat kakak adalah Rp${finalSavings.toLocaleString('id-ID')} (${discountPercent}% OFF) dengan jaminan checkout lancar!`;

    res.json({
      productName,
      imageUrl,
      originalPrice,
      optimizedPrice,
      savings: finalSavings,
      savingsExplanation,
      vouchersApplied,
      jastipFee,
      totalPayment,
      variantOptions
    });
  }
});


// ----------------------------------------------------
// VITE CLIENT AND STATIC FILE SERVING
// ----------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();

export default app;
