import express from "express";
import { createServer as createHttpServer } from "http";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import admin from "firebase-admin";

dotenv.config();

// Initialize Firebase Admin
try {
  admin.initializeApp();
} catch (error) {
  console.error("Firebase Admin initialization error:", error);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '5000', 10);

  app.use(cors());
  app.use(express.json());

  // Mock OTP storage (in production use Redis or Firestore)
  const otps = new Map<string, { otp: string; expiresAt: number; attempts: number }>();

  // API routes
  app.post("/api/auth/forgot-password", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    otps.set(email, { otp: hashedOtp, expiresAt, attempts: 0 });

    // Send email (Mock or real)
    console.log(`[OTP for ${email}]: ${otp}`);
    
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      try {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });

        await transporter.sendMail({
          from: `"LearnAI Support" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: "Your Password Reset OTP",
          text: `Your One-Time Password (OTP) for password reset is: ${otp}. It expires in 10 minutes.`,
          html: `<b>Your One-Time Password (OTP) for password reset is: ${otp}</b><p>It expires in 10 minutes.</p>`,
        });
      } catch (error) {
        console.error("Email error:", error);
      }
    }

    res.json({ message: "OTP sent to your email" });
  });

  app.post("/api/auth/verify-otp", async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: "Email and OTP are required" });

    const storedData = otps.get(email);
    if (!storedData) return res.status(400).json({ error: "No OTP found for this email" });

    if (Date.now() > storedData.expiresAt) {
      otps.delete(email);
      return res.status(400).json({ error: "OTP has expired" });
    }

    if (storedData.attempts >= 5) {
      otps.delete(email);
      return res.status(400).json({ error: "Too many attempts. Please request a new OTP." });
    }

    const isValid = await bcrypt.compare(otp, storedData.otp);
    if (!isValid) {
      storedData.attempts += 1;
      return res.status(400).json({ error: "Invalid OTP" });
    }

    // OTP is valid, return a temporary token (in production use JWT)
    res.json({ message: "OTP verified", resetToken: Buffer.from(email).toString("base64") });
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    const { email, newPassword, resetToken } = req.body;
    if (!email || !newPassword || !resetToken) {
      return res.status(400).json({ error: "Email, new password, and reset token are required" });
    }

    const decodedEmail = Buffer.from(resetToken, "base64").toString("ascii");
    if (decodedEmail !== email) {
      return res.status(400).json({ error: "Invalid reset token" });
    }

    try {
      // Find user by email
      const userRecord = await admin.auth().getUserByEmail(email);
      
      // Update password
      await admin.auth().updateUser(userRecord.uid, {
        password: newPassword
      });

      console.log(`[PASSWORD RESET for ${email}]: Password updated successfully.`);
      otps.delete(email);

      res.json({ message: "Password updated successfully. Please login with your new password." });
    } catch (error: any) {
      console.error("Password reset error:", error);
      res.status(500).json({ error: error.message || "Failed to reset password." });
    }
  });

  const httpServer = createHttpServer(app);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: { server: httpServer },
        watch: {
          ignored: ['**/.local/**', '**/.cache/**', '**/.git/**', '**/node_modules/**'],
        },
      },
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

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
