const { z } = require("zod");

const ratingSchema = z.object({
    score: z.number().int().min(1).max(5),
    comment: z.string().trim().max(2000).optional()
}).strict();

module.exports = { ratingSchema };
