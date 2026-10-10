const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");

const {
  getInvestigations,
  getInvestigationById,
  askInvestigationCopilot,
  generateInvestigationReport,
  getInvestigationReport
} = require("../controllers/investigationController");

const {
  getIndicators,
  getIndicatorById
} = require("../controllers/indicatorController");

const {
  getThreatIntelligenceOverview
} = require("../controllers/threatIntelligenceController");

// Require authentication for all security routes
router.use(protect);

// Investigations
router.route("/investigations").get(getInvestigations);
router.route("/investigations/:id").get(getInvestigationById);
router.route("/investigations/:id/copilot").post(askInvestigationCopilot);
router.route("/investigations/:id/report")
  .post(generateInvestigationReport)
  .get(getInvestigationReport);

// Indicators
router.route("/indicators").get(getIndicators);
router.route("/indicators/:id").get(getIndicatorById);

// Threat Intelligence
router.route("/threat-intelligence/overview").get(getThreatIntelligenceOverview);

module.exports = router;
