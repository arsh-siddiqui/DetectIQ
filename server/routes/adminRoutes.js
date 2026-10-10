const express = require("express");
const { 
  getStats, 
  getAnalytics, 
  getThreatFeedHealth,
  getUsers, 
  updateUser, 
  deleteUser,
  getAdminVulnerabilities,
  createAdminVulnerability,
  updateAdminVulnerability,
  toggleAdminVulnerability,
  deleteAdminVulnerability,
} = require("../controllers/adminController");
const { protect, authorize } = require("../middleware/auth");
const requireDb = require("../middleware/requireDb");
const validate = require("../middleware/validate");
const { param } = require("express-validator");

const idParamValidator = [
  param("id").isMongoId().withMessage("Invalid ID format"),
];

const router = express.Router();

router.use(requireDb, protect, authorize("admin"));

router.get("/stats", getStats);
router.get("/analytics", getAnalytics);
router.get("/threat-feeds", getThreatFeedHealth);
router.get("/users", getUsers);
router.put("/users/:id", idParamValidator, validate, updateUser);
router.delete("/users/:id", idParamValidator, validate, deleteUser);

router.get("/vulnerabilities", getAdminVulnerabilities);
router.post("/vulnerabilities", createAdminVulnerability);
router.put("/vulnerabilities/:id", idParamValidator, validate, updateAdminVulnerability);
router.patch("/vulnerabilities/:id/toggle", idParamValidator, validate, toggleAdminVulnerability);
router.delete("/vulnerabilities/:id", idParamValidator, validate, deleteAdminVulnerability);

module.exports = router;
