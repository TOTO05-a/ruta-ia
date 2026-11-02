const repository = require("../repositories/course.repository");

async function activeCourses(req, res) {
    const items = await repository.listAllActive();
    return res.json({ data: { items, total: items.length } });
}

module.exports = { activeCourses };
