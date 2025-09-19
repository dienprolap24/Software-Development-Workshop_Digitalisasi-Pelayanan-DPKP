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

    // Sync models (create tables if they don't exist)
    await sequelize.sync({ alter: true });
    console.log("✅ Database tables synchronized");

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
