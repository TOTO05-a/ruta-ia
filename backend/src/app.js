
const express = require("express");
const path = require("node:path");
const cors = require("cors");
const helmet = require("helmet");
const env = require("./config/env");
const requestId = require("./middleware/request-id");
const errorHandler = require("./middleware/error-handler");
const healthRoutes = require("./routes/health.routes");
const authRoutes = require("./routes/auth.routes");
const courseRoutes = require("./routes/course.routes");
const studentRoutes = require("./routes/student.routes");
const queryRoutes = require("./routes/query.routes");
const recommendationRoutes = require("./routes/recommendation.routes");

const app = express();

const allowedOrigins = env.FRONTEND_URL.split(",").map((origin) => origin.trim()).filter(Boolean);

app.disable("x-powered-by");
app.use(requestId);
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            "font-src": ["'self'", "https://fonts.gstatic.com", "data:"]
        }
    }
}));

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        const error = new Error("Origen no permitido por CORS");
        error.status = 403;
        error.code = "CORS_ORIGIN_DENIED";
        return callback(error);
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-CSRF-Token", "Authorization"]
}));

app.use(express.json({ limit: "1mb", strict: true }));

app.use("/health", healthRoutes);
app.use("/api/v1/health", healthRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1", courseRoutes);
app.use("/api/v1", studentRoutes);
app.use("/api/v1", queryRoutes);
app.use("/api/v1", recommendationRoutes);
app.use(express.static(path.resolve(__dirname, "../../frontend"), { extensions: ["html"] }));

app.use((req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Ruta no encontrada", requestId: req.requestId } });
});

app.use(errorHandler);

module.exports = app;
