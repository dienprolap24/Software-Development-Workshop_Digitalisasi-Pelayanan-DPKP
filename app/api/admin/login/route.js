import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Admin, sequelize } from "../../../../lib/sequelize";

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

    // Pastikan database terhubung dan model tersinkronisasi
    await sequelize.authenticate();
    await sequelize.sync();

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
    return NextResponse.json({
      success: true,
      message: "Login berhasil",
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email
      }
    });

  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}
