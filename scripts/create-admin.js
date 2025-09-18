// Load environment variables
require("dotenv").config({ path: ".env.local" });

const bcrypt = require("bcryptjs");
const { Admin, sequelize } = require("../lib/sequelize");

async function createDefaultAdmin() {
  let retries = 3;
  
  while (retries > 0) {
    try {
      console.log(`🔧 Connecting to database... (${4 - retries}/3 attempts)`);
      await sequelize.authenticate();
      console.log("✅ Database connected successfully");
      
      // Sync models
      console.log("🔧 Synchronizing database models...");
      await sequelize.sync({ alter: true });
      console.log("✅ Database models synchronized");
      break; // Success, exit retry loop
      
    } catch (error) {
      retries--;
      console.error(`❌ Connection failed: ${error.message}`);
      
      if (retries === 0) {
        throw error; // Re-throw if no more retries
      }
      
      console.log(`⏳ Retrying in 3 seconds... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  try {
    
    console.log("🔍 Checking for existing admin...");
    
    // Cek apakah admin sudah ada
    const existingAdmin = await Admin.findOne({
      where: { username: "admin" }
    });
    
    if (existingAdmin) {
      console.log("✅ Admin sudah ada dengan username: admin");
      console.log("📧 Email:", existingAdmin.email);
      return;
    }
    
    console.log("🔐 Creating default admin...");
    
    // Hash password dengan bcrypt
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash("admin123", saltRounds);
    
    // Buat admin default
    const admin = await Admin.create({
      username: "admin",
      email: "admin@diskominfo-bogor.go.id",
      password: hashedPassword
    });
    
    console.log("✅ Admin berhasil dibuat!");
    console.log("👤 Username: admin");
    console.log("📧 Email: admin@diskominfo-bogor.go.id");
    console.log("🔑 Password: admin123");
    console.log("⚠️  Jangan lupa ganti password di production!");
    
  } catch (error) {
    console.error("❌ Error creating admin:", error);
    process.exit(1);
  }
}

// Jalankan script
createDefaultAdmin().then(() => {
  console.log("🎉 Script selesai!");
  process.exit(0);
});
