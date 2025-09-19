import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createVercelSequelize } from "../../../../lib/vercel-db";
import { DataTypes } from "sequelize";

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

    // Create Vercel-optimized Sequelize instance
    const sequelize = createVercelSequelize(process.env.DATABASE_URL);
    
    // Define Admin model
    const Admin = sequelize.define(
      "Admin",
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        username: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
        },
        email: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
          validate: {
            isEmail: true,
          },
        },
        password: {
          type: DataTypes.STRING,
          allowNull: false,
        },
      },
      {
        tableName: "admins",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
      }
    );

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
