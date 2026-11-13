// ========================================
// Environment Configuration
// ========================================
const dotenv = require("dotenv");
dotenv.config();
// ========================================
// External Packages
// ========================================
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const swaggerUi = require("swagger-ui-express");
// ========================================
// Application Configuration
// ========================================
const pool = require("./config/database");
const swaggerSpec = require("./config/swagger");
// ========================================
// Routes
// ========================================
const healthRoutes = require("./routes/health.routes");
const authRoutes = require("./routes/auth.routes");
const adminRoutes = require("./routes/admin.routes");
const adminCourseRoutes = require("./routes/admin-course.routes");
const enrollmentAdminRoutes = require("./routes/enrollmentAdmin.routes");

const instructorRoutes = require('./routes/instructor.routes');
const rbacRoutes = require("./routes/rbac.routes");
const publicRoutes = require("./routes/Public.routes");
const studentRoutes = require("./routes/Student.routes");
const paymentRoutes = require("./routes/payment.routes");
const roleRoutes = require("./routes/role.routes");
const permissionRoutes = require("./routes/permission.routes");
const menuRoutes = require("./routes/menu.routes");
const rolePermissionRoutes =require("./routes/rolePermission.routes");
const institutionRoutes = require("./routes/institution.routes");
const courseCategoryRoutes = require("./routes/coursecategory.route");
const couponRoutes = require("./routes/coupon.route");
const couponCourseRoutes = require("./routes/couponCourse.route");
const couponStudentRoutes = require("./routes/couponStudent.route");
const couponRedemptionRoutes = require("./routes/couponRedemption.route");
const paymentAdminRoutes = require("./routes/paymentAdmin.routes");
const adminReportRoutes = require("./routes/adminReport.routes");
const adminDashboardRoutes = require("./routes/adminDashboard.routes");
const payrollRoutes = require("./routes/payroll.routes");
const studentAdminRoutes = require("./routes/studentadmin.routes");
const instructorAdminRoutes = require("./routes/instructoradminroute");
const instructorAssessmentRoutes =require("./routes/instructorAssessment.routes");
const communityRoutes = require("./routes/community.routes");
// const studentadminRoutes = require("./routes/studentadmin.routes");
// const instructorAdminRoutes = require("./routes/instructoradminroute");
const certificateRoutes =
    require("./routes/certificate.routes");


// ========================================
// Error Middleware
// ========================================
const errorHandler = require("./middleware/error.middleware");
const { cookieParser } = require("./utils/cookies");
const courseRoutes = require('./routes/course.routes');
const moduleRoutes = require('./routes/module.routes');
const lessonRoutes = require('./routes/lesson.routes');

// ========================================
// Express Application
// ========================================
const app = express();
// ========================================
// Server Configuration
// ========================================
const PORT = process.env.PORT || 5000;
const isProduction =
    String(process.env.NODE_ENV || "development").trim().toLowerCase() ===
    "production";

const frontendOrigins = (
    process.env.FRONTEND_URL ||
    (isProduction
        ? ""
        : "http://localhost:5173")
)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => {
        try {
            const parsedOrigin = new URL(origin);

            if (![
                "http:",
                "https:"
            ].includes(parsedOrigin.protocol)) {
                throw new Error("Origin must use HTTP or HTTPS");
            }

            if (isProduction && parsedOrigin.protocol !== "https:") {
                throw new Error("Production frontend origins must use HTTPS");
            }

            return parsedOrigin.origin;
        } catch {
            throw new Error(
                `Invalid FRONTEND_URL origin: ${origin}. Use an HTTPS origin in production.`
            );
        }
    });

if (
    isProduction &&
    frontendOrigins.length === 0
) {
    throw new Error(
        "FRONTEND_URL must contain the HTTPS frontend origin in production"
    );
}
// ========================================
// TRUST PROXY
// ========================================
app.set("trust proxy", 1);
app.use(helmet());
app.use(
    cors({
        origin(origin, callback) {
            if (!origin || frontendOrigins.includes(origin)) {
                return callback(null, true);
            }

            return callback(null, false);
        },
        credentials: true,
        methods: [
            "GET",
            "POST",
            "PUT",
            "PATCH",
            "DELETE",
            "OPTIONS",
        ],
        allowedHeaders: [
            "Content-Type",
            "Authorization",
        ],
    })
);
app.use(cookieParser);
app.use(express.json({ limit: "1mb" }));
app.use(
    express.urlencoded({
        extended: true,
        limit: "1mb",
    })
);

// app.use(morgan("dev"));
app.use(morgan(isProduction ? "combined" : "dev"));
app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
        explorer: true,
        customSiteTitle: "Online Learning Platform API",
        swaggerOptions: {
            persistAuthorization: true,
        },
    })
);
app.get("/", (req, res) => {
    return res.status(200).json({
        success: true,
        message: "Online Learning Platform Backend API",
        version: process.env.API_VERSION || "1.0.0",
        environment: process.env.NODE_ENV || "development",
        documentation: "/api-docs",
    });
});

app.use("/api", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin/dashboard", adminDashboardRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/courses", adminCourseRoutes);
app.use("/api/admin/enrollments", enrollmentAdminRoutes);
app.use("/api/rbac", rbacRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/student/payments", paymentRoutes);
app.use("/api/instructors", instructorRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/modules", moduleRoutes);
app.use("/api/lessons", lessonRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/permissions", permissionRoutes);
app.use("/api/menus", menuRoutes);
app.use("/api/role-permissions", rolePermissionRoutes);
app.use("/api/institutions", institutionRoutes);
app.use("/api/course-categories", courseCategoryRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/coupon-courses", couponCourseRoutes);
app.use("/api/coupon-students", couponStudentRoutes);
app.use("/api/coupon-redemptions", couponRedemptionRoutes);
app.use("/api/admin/payments", paymentAdminRoutes);
app.use("/api/admin/reports", adminReportRoutes);
app.use("/api/admin/instructors", instructorAdminRoutes);
app.use("/api/students", studentAdminRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/instructor",instructorAssessmentRoutes);
app.use("/api/community", communityRoutes);
// app.use("/api/students", studentadminRoutes);
// app.use("/api/instructors", instructorAdminRoutes);
// Register student certificate APIs.
app.use("/api/student/certificates", certificateRoutes);

// ========================================
// 404 HANDLER
// ========================================
app.use(
    (req, res) => {

        return res.status(404).json({

            success: false,

            message:
                "API endpoint not found",

            path:
                req.originalUrl,

            method:
                req.method
        });
    }
);
// ========================================
// GLOBAL ERROR HANDLER
// ========================================
app.use(
    errorHandler
);
// ========================================
// DATABASE CONNECTION + SERVER START
// ========================================
async function startServer() {
try {
   const result = await pool.query(
            "SELECT NOW() AS current_time"
        );
console.log(
            "========================================"
        );
console.log(
            "Database connection successful"
        );
console.log(
            "Database time:",
            result.rows[0].current_time
        );
const server = app.listen(
            PORT,
     '0.0.0.0',
            () => {
console.log(
                    "========================================"
                );
console.log(
                    `OLP Backend running on http://localhost:${PORT}`
                );
console.log(
                    `Swagger UI running on http://localhost:${PORT}/api-docs`
                );
console.log(
                    `Health check: http://localhost:${PORT}/api/health`
                );
console.log(
                    `Environment: ${process.env.NODE_ENV || "development"}`
                );
console.log(
                    "========================================"
                );
            }
        );
const shutdown = async (signal) => {
 console.log(
                `${signal} received. Shutting down server...`
            );
server.close(async () => {
try {
await pool.end();
console.log( "Database pool closed");
process.exit(0);
} 
catch (error) 
{
console.error("Error closing database pool:",error.message);
process.exit(1);
                }
            });
        };
        process.on(
            "SIGINT",
            () => shutdown("SIGINT")
        );
process.on(
            "SIGTERM",
            () => shutdown("SIGTERM"));

} 
catch (error)
 {
    console.error("========================================");
  console.error( "Database connection failed");
console.error( error.message);
console.error( "========================================" );
process.exit(1);
    }
}
// UNHANDLED PROMISE REJECTION
// ========================================
process.on(
    "unhandledRejection",
    (reason) => {
console.error("Unhandled Promise Rejection:",reason);
    }
);
// ========================================
// UNCAUGHT EXCEPTION
// ========================================
process.on(
    "uncaughtException",
    (error) => {

    console.error("Uncaught Exception:",error );
    process.exit(1);
    }
);
// ========================================
// START APPLICATION
// ========================================
startServer();
// ========================================
// EXPORT APP
// ========================================
module.exports = app;
