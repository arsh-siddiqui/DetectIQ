const { body } = require("express-validator");

const registerValidator = [
  body("name").trim().notEmpty().withMessage("Name is required.").isLength({ max: 80 }),
  body("email").trim().isEmail().withMessage("Enter a valid email address.").normalizeEmail(),
  body("password").isLength({ min: 8, max: 128 }).withMessage("Password must be between 8 and 128 characters."),
  body("accountRole")
    .optional()
    .isIn(["Student", "Professional", "Business"])
    .withMessage("Role must be Student, Professional, or Business."),
];

const loginValidator = [
  body("email").trim().isEmail().withMessage("Enter a valid email address.").normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required."),
];

module.exports = { registerValidator, loginValidator };
