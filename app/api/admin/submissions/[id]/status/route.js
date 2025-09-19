import { NextResponse } from "next/server";
import { createVercelSequelize } from "@/lib/vercel-db";
import { DataTypes } from "sequelize";
import { sendStatusUpdateNotification } from "@/lib/notify/sicuba";
import { sendStatusUpdateEmail } from "@/lib/notify/email";

// Initialize database on first request
let dbInitialized = false;
let sequelize = null;
let Submission = null;
let NotificationLog = null;

const initDB = async () => {
  if (!dbInitialized) {
    sequelize = createVercelSequelize(process.env.DATABASE_URL);
    
    // Define Submission model
    Submission = sequelize.define(
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
    NotificationLog = sequelize.define(
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

    await sequelize.authenticate();
    await sequelize.sync();
    dbInitialized = true;
  }
};

// Handle CORS preflight
export async function OPTIONS() {
  console.log("🔍 OPTIONS request received for status update");
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

// Handle PATCH - Update submission status
export async function PATCH(request, { params }) {
  console.log("🔍 PATCH request received for status update");
  console.log("🔍 Request method:", request.method);
  console.log("🔍 Request URL:", request.url);
  console.log("🔍 Params:", params);

  try {
    await initDB();

    const { id } = params;
    const body = await request.json();
    const { status } = body;

    console.log("Updating submission:", id, "to status:", status);

    // Validation
    if (
      !status ||
      !["PENGAJUAN_BARU", "DIPROSES", "SELESAI", "DITOLAK"].includes(status)
    ) {
      return NextResponse.json(
        { message: "Status tidak valid" },
        { status: 400 }
      );
    }

    // Find submission
    const submission = await Submission.findByPk(id);
    if (!submission) {
      return NextResponse.json(
        { message: "Pengajuan tidak ditemukan" },
        { status: 404 }
      );
    }

    // Check if status is actually changing
    if (submission.status === status) {
      return NextResponse.json(
        { message: "Status sudah sama" },
        { status: 400 }
      );
    }

    // Update status
    const oldStatus = submission.status;
    await submission.update({ status });

    console.log("Status updated successfully:", oldStatus, "->", status);

    // Send notifications
    const notificationPromises = [];

    // Send WhatsApp notification
    const waResult = await sendStatusUpdateNotification(submission, status);
    notificationPromises.push(
      NotificationLog.create({
        submission_id: submission.id,
        channel: "WHATSAPP",
        send_status: waResult.success ? "SUCCESS" : "FAILED",
        payload: {
          to: submission.no_wa,
          status: status,
          result: waResult,
        },
      })
    );

    // Send email notification if email exists
    console.log(
      "📧 Checking email notification for submission:",
      submission.id
    );
    console.log("📧 Submission email:", submission.email);

    if (submission.email) {
      console.log("📧 Sending email notification to:", submission.email);
      const emailResult = await sendStatusUpdateEmail(submission, status);
      console.log("📧 Email result:", emailResult);

      notificationPromises.push(
        NotificationLog.create({
          submission_id: submission.id,
          channel: "EMAIL",
          send_status: emailResult.success ? "SUCCESS" : "FAILED",
          payload: {
            to: submission.email,
            status: status,
            result: emailResult,
          },
        })
      );
    } else {
      console.log("📧 No email address found for submission:", submission.id);
    }

    // Wait for all notification logs to be created
    await Promise.all(notificationPromises);

    console.log("All notifications processed successfully");

    return NextResponse.json({
      message: "Status berhasil diupdate",
      old_status: oldStatus,
      new_status: status,
      submission_id: submission.id,
    });
  } catch (error) {
    console.error("Error updating submission status:", error);

    return NextResponse.json(
      {
        message: "Terjadi kesalahan internal server",
        error: error.message,
      },
      { status: 500 }
    );
  }
}

// Handle GET - Not allowed
export async function GET() {
  console.log("🔍 GET request received for status update");
  return NextResponse.json(
    {
      message: "Method GET not allowed. Use PATCH to update status.",
      allowed_methods: ["PATCH", "OPTIONS"],
    },
    { status: 405 }
  );
}

// Handle POST - Not allowed
export async function POST() {
  console.log("🔍 POST request received for status update");
  return NextResponse.json(
    {
      message: "Method POST not allowed. Use PATCH to update status.",
      allowed_methods: ["PATCH", "OPTIONS"],
    },
    { status: 405 }
  );
}

// Handle PUT - Not allowed
export async function PUT() {
  console.log("🔍 PUT request received for status update");
  return NextResponse.json(
    {
      message: "Method PUT not allowed. Use PATCH to update status.",
      allowed_methods: ["PATCH", "OPTIONS"],
    },
    { status: 405 }
  );
}

// Handle DELETE - Not allowed
export async function DELETE() {
  console.log("🔍 DELETE request received for status update");
  return NextResponse.json(
    {
      message: "Method DELETE not allowed. Use PATCH to update status.",
      allowed_methods: ["PATCH", "OPTIONS"],
    },
    { status: 405 }
  );
}
