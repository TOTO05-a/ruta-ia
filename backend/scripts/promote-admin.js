require("dotenv").config({ path: require("node:path").resolve(__dirname, "../../.env") });

const pool = require("../src/db/pool");

async function main() {
    const email = process.argv[2]?.trim().toLowerCase();
    if (!email) throw new Error("Uso: npm run admin:promote -- correo-del-administrador");
    const result = await pool.query(
        `UPDATE students SET role = 'admin', updated_at = now()
         WHERE lower(email) = $1 RETURNING id, email`,
        [email]
    );
    if (!result.rowCount) throw new Error("No existe una cuenta registrada con ese correo");
    console.log(`Rol administrador asignado a ${result.rows[0].email}`);
}

main().catch((error) => {
    console.error("No se pudo asignar el rol", error.code || error.message);
    process.exitCode = 1;
}).finally(() => pool.end());
