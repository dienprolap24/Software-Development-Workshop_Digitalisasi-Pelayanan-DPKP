const { Sequelize, DataTypes } = require("sequelize");

// Create Sequelize instance for local development
const sequelize = new Sequelize(process.env.DATABASE_URL || "sqlite:database.sqlite", {
  dialect: process.env.DATABASE_URL ? "postgres" : "sqlite",
  logging: process.env.NODE_ENV === "development" ? console.log : false,
  underscored: true,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

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

module.exports = {
  sequelize,
  Admin,
  Submission,
  NotificationLog,
};
