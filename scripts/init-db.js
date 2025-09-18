const { Sequelize, DataTypes } = require("sequelize");
const fs = require("fs");
const path = require("path");

// Check if .env file exists and load environment variables
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  require("dotenv").config({ path: envPath });
  console.log("📝 Loaded environment variables from .env file");
} else {
  console.log("⚠️  .env file not found, using default configuration");
  console.log("💡 For PostgreSQL, create a .env file from env.example");
}

// Function to create database if it doesn't exist
async function createDatabaseIfNotExists(databaseUrl) {
  try {
    // Parse the database URL to extract components
    const url = new URL(databaseUrl);
    const databaseName = url.pathname.substring(1); // Remove leading slash
    const host = url.hostname;
    const port = url.port || 5432;
    const username = url.username;
    const password = url.password;

    // Connect to default 'postgres' database to create our target database
    const defaultDbUrl = `postgresql://${username}:${password}@${host}:${port}/postgres`;
    
    console.log(`🔧 Attempting to create database '${databaseName}' if it doesn't exist...`);
    
    const defaultSequelize = new Sequelize(defaultDbUrl, {
      dialect: "postgres",
      logging: false, // Disable logging for this operation
    });

    // Test connection to default database
    await defaultSequelize.authenticate();
    console.log("✅ Connected to PostgreSQL server successfully");

    // Check if our target database exists
    const [results] = await defaultSequelize.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      {
        bind: [databaseName],
        type: Sequelize.QueryTypes.SELECT,
      }
    );

    if (results && results.length > 0) {
      console.log(`✅ Database '${databaseName}' already exists`);
    } else {
      // Create the database
      await defaultSequelize.query(`CREATE DATABASE "${databaseName}"`);
      console.log(`✅ Database '${databaseName}' created successfully`);
    }

    await defaultSequelize.close();
    return true;
  } catch (error) {
    console.log(`⚠️  Could not create database: ${error.message}`);
    return false;
  }
}

async function initDatabase() {
  try {
    console.log("🚀 Initializing database...");

    let sequelize;

    // Check if DATABASE_URL is provided
    if (process.env.DATABASE_URL) {
      console.log("📊 Attempting to use PostgreSQL from DATABASE_URL...");

      // Try to create database if it doesn't exist
      await createDatabaseIfNotExists(process.env.DATABASE_URL);

      // Determine if it's local or production
      const isLocal =
        process.env.DATABASE_URL.includes("localhost") ||
        process.env.DATABASE_URL.includes("127.0.0.1") ||
        process.env.DATABASE_URL.includes("postgres://");

      sequelize = new Sequelize(process.env.DATABASE_URL, {
        dialect: "postgres",
        dialectOptions: isLocal
          ? {}
          : {
              ssl: {
                require: true,
                rejectUnauthorized: false,
              },
            },
        logging: process.env.NODE_ENV === "development" ? console.log : false,
        pool: {
          max: 5,
          min: 0,
          acquire: 30000,
          idle: 10000,
        },
      });

      // Test PostgreSQL connection
      try {
        await sequelize.authenticate();
        console.log("✅ PostgreSQL connection successful!");
      } catch (pgError) {
        console.log("⚠️  PostgreSQL connection failed, falling back to SQLite...");
        console.log(`   Error: ${pgError.message}`);
        
        // Fallback to SQLite
        const dbPath = path.join(__dirname, "..", "database.sqlite");
        sequelize = new Sequelize({
          dialect: "sqlite",
          storage: dbPath,
          logging: process.env.NODE_ENV === "development" ? console.log : false,
        });
      }
    } else {
      console.log("📊 Using SQLite for local development...");

      // Create SQLite database in project root
      const dbPath = path.join(__dirname, "..", "database.sqlite");
      sequelize = new Sequelize({
        dialect: "sqlite",
        storage: dbPath,
        logging: process.env.NODE_ENV === "development" ? console.log : false,
      });
    }

    // Define models
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
      }
    );

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
        updatedAt: false, // Only track creation time
      }
    );

    // Define relationships
    Submission.hasMany(NotificationLog, { foreignKey: "submission_id" });
    NotificationLog.belongsTo(Submission, { foreignKey: "submission_id" });

    // Test connection (only if we haven't already tested PostgreSQL)
    if (!process.env.DATABASE_URL) {
      await sequelize.authenticate();
      console.log("✅ Database connection established successfully.");
    }

    // Sync models (create tables if they don't exist)
    await sequelize.sync({ alter: true });
    console.log("✅ Database models synchronized.");

    console.log("🎉 Database initialized successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to initialize database:", error.message);

    if (error.message.includes("ECONNREFUSED")) {
      console.log("\n💡 Troubleshooting tips:");
      console.log("1. Make sure PostgreSQL is running");
      console.log("2. Check your DATABASE_URL in .env file");
      console.log(
        "3. For local PostgreSQL, try: DATABASE_URL=postgresql://username:password@localhost:5432/database_name"
      );
    }

    process.exit(1);
  }
}

initDatabase();
