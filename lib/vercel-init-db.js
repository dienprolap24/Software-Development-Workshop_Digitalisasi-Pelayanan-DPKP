/**
 * Vercel-specific database initialization utility
 * This ensures tables are created when API routes are called
 */

const { createVercelSequelize } = require("./vercel-db");
const { DataTypes } = require("sequelize");

// Cache for initialized database instances
const dbCache = new Map();

/**
 * Initialize database with all required models
 * @param {string} databaseUrl - Database connection URL
 * @returns {Object} - Database instance with models
 */
async function initializeVercelDatabase(databaseUrl) {
  // Check cache first
  if (dbCache.has(databaseUrl)) {
    return dbCache.get(databaseUrl);
  }

  try {
    console.log("🔧 Initializing Vercel database...");
    
    // Create Vercel-optimized Sequelize instance
    const sequelize = createVercelSequelize(databaseUrl);
    
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

    // Define Submission model
    const Submission = sequelize.define(
      "Submission",
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        tracking_code: {
          type: DataTypes.STRING,
          unique: true,
          allowNull: false,
        },
        nama: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        nik: {
          type: DataTypes.STRING(16),
          allowNull: false,
        },
        email: {
          type: DataTypes.STRING,
          allowNull: true,
          validate: {
            isEmail: true,
          },
        },
        no_wa: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        jenis_layanan: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        status: {
          type: DataTypes.ENUM("PENGAJUAN_BARU", "DIPROSES", "SELESAI", "DITOLAK"),
          defaultValue: "PENGAJUAN_BARU",
          allowNull: false,
        },
      },
      {
        tableName: "submissions",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
      }
    );

    // Define NotificationLog model
    const NotificationLog = sequelize.define(
      "NotificationLog",
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        submission_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: "submissions",
            key: "id",
          },
        },
        channel: {
          type: DataTypes.ENUM("WHATSAPP", "EMAIL"),
          allowNull: false,
        },
        send_status: {
          type: DataTypes.ENUM("SUCCESS", "FAILED"),
          allowNull: false,
        },
        payload: {
          type: DataTypes.JSON,
          allowNull: false,
        },
      },
      {
        tableName: "notification_logs",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: false,
      }
    );

    // Define relationships
    Submission.hasMany(NotificationLog, { foreignKey: "submission_id" });
    NotificationLog.belongsTo(Submission, { foreignKey: "submission_id" });

    // Test connection
    await sequelize.authenticate();
    console.log("✅ Database connection established");

    // Sync models with proper handling of existing data
    try {
      // First, check if admins table exists and has data
      const [results] = await sequelize.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'admins'
        );
      `);
      
      const tableExists = results[0].exists;
      
      if (tableExists) {
        console.log("📋 Admins table exists, checking for schema issues...");
        
        // Check if email column exists
        const [columnResults] = await sequelize.query(`
          SELECT column_name, is_nullable, data_type 
          FROM information_schema.columns 
          WHERE table_name = 'admins' AND column_name = 'email';
        `);
        
        const emailColumnExists = columnResults.length > 0;
        
        if (emailColumnExists) {
          // Check if there are existing admin records with null email
          const [adminResults] = await sequelize.query(`
            SELECT COUNT(*) as count FROM admins WHERE email IS NULL;
          `);
          
          const nullEmailCount = parseInt(adminResults[0].count);
          
          if (nullEmailCount > 0) {
            console.log(`⚠️ Found ${nullEmailCount} admin records with null email. Updating...`);
            
            // Update null email values with a default pattern
            await sequelize.query(`
              UPDATE admins 
              SET email = CONCAT('admin_', id, '@example.com')
              WHERE email IS NULL;
            `);
            
            console.log("✅ Updated null email values");
          }
        } else {
          console.log("📧 Email column doesn't exist, will be created during sync");
        }
      }
      
      // Now sync with alter to add/modify columns
      await sequelize.sync({ alter: true });
      console.log("✅ Database tables synchronized");
      
    } catch (syncError) {
      console.error("❌ Error during sync:", syncError.message);
      
      // If alter fails, try a more conservative approach
      console.log("🔄 Attempting conservative sync...");
      try {
        // Try to sync without alter first
        await sequelize.sync({ force: false });
        console.log("✅ Database tables synchronized (conservative mode)");
      } catch (conservativeError) {
        console.error("❌ Conservative sync also failed:", conservativeError.message);
        
        // Last resort: force sync (drops and recreates tables)
        console.log("🔄 Attempting force sync (WARNING: This will drop all data)...");
        await sequelize.sync({ force: true });
        console.log("✅ Database tables force synchronized (WARNING: All data was dropped)");
      }
    }

    // Create default admin if none exists
    try {
      const adminCount = await Admin.count();
      if (adminCount === 0) {
        console.log("👤 No admin users found, creating default admin...");
        
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash('admin123', 10);
        
        await Admin.create({
          username: 'admin',
          email: 'admin@diskominfo-bogor.go.id',
          password: hashedPassword,
        });
        
        console.log("✅ Default admin created (username: admin, password: admin123)");
      } else {
        console.log(`👤 Found ${adminCount} existing admin user(s)`);
      }
    } catch (adminError) {
      console.error("❌ Error creating default admin:", adminError.message);
      // Don't fail the entire initialization for this
    }

    // Cache the database instance
    const dbInstance = {
      sequelize,
      Admin,
      Submission,
      NotificationLog,
    };

    dbCache.set(databaseUrl, dbInstance);
    console.log("✅ Vercel database initialized successfully");

    return dbInstance;
  } catch (error) {
    console.error("❌ Failed to initialize Vercel database:", error.message);
    throw error;
  }
}

/**
 * Get or create database instance
 * @param {string} databaseUrl - Database connection URL
 * @returns {Object} - Database instance with models
 */
async function getVercelDatabase(databaseUrl) {
  try {
    return await initializeVercelDatabase(databaseUrl);
  } catch (error) {
    console.error("❌ Database initialization failed:", error.message);
    throw error;
  }
}

/**
 * Clear database cache (useful for testing)
 */
function clearDatabaseCache() {
  dbCache.clear();
  console.log("🗑️ Database cache cleared");
}

module.exports = {
  initializeVercelDatabase,
  getVercelDatabase,
  clearDatabaseCache,
};
