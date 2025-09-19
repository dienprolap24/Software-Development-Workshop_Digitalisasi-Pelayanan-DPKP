import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getVercelDatabase } from "../../../../lib/vercel-init-db";

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    // Validasi input
    if (!username || !password) {
      return NextResponse.json(
        { error: "Username dan password wajib diisi" },
        { status: 400 }
      );
    }

    // Initialize database with all models
    const { sequelize, Admin } = await getVercelDatabase(process.env.DATABASE_URL);

    // Cari admin berdasarkan email (menggunakan field username sebagai email)
    const admin = await Admin.findOne({
      where: { email: username }
    });

    if (!admin) {
      return NextResponse.json(
        { error: "Username atau password salah" },
        { status: 401 }
      );
    }

    // Verifikasi password dengan bcrypt
    const isPasswordValid = await bcrypt.compare(password, admin.password);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Username atau password salah" },
        { status: 401 }
      );
    }

    // Login berhasil
    const response = NextResponse.json({
      success: true,
      message: "Login berhasil",
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email
      }
    });

    // Close database connection
    await sequelize.close();
    return response;

  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}
