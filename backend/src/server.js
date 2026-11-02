
require("dotenv").config({ path: require("node:path").resolve(__dirname, "../../.env") });

const app = require("./app");

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
    console.log(`RutaIA API escuchando en el puerto ${PORT}`);
});

function shutdown(signal) {
    console.log(`Cerrando RutaIA API (${signal})`);
    server.close(async () => {
        try { await require("./db/pool").end(); }
        finally { process.exit(0); }
    });
    setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
