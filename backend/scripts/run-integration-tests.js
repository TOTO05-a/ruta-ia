const path = require("node:path");
const { spawnSync } = require("node:child_process");
const dotenv = require("dotenv");

const backendRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(backendRoot, "..");
dotenv.config({ path: path.join(workspaceRoot, ".env") });

if (!process.env.RUTAIA_TEST_DATABASE_URL) {
    console.error("Define RUTAIA_TEST_DATABASE_URL en .env apuntando únicamente a la base local rutaia_test.");
    process.exit(2);
}

const result = spawnSync(process.execPath, ["--test", "tests/postgres.integration.test.js"], {
    cwd: backendRoot,
    env: { ...process.env, RUTAIA_RUN_INTEGRATION_TESTS: "1" },
    stdio: "inherit"
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
