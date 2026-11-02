const repository = require("../repositories/statistics.repository");

async function get(req, res) {
    return res.json({ data: await repository.getGlobal() });
}

module.exports = { get };
