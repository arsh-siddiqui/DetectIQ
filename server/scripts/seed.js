const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");

// Environment and DB
const env = require("../config/env");

// Models
const User = require("../models/User");
const Simulation = require("../models/Simulation");
const Lesson = require("../models/Lesson");
const QuickLearn = require("../models/QuickLearn");
const SafetyTip = require("../models/SafetyTip");
// Assuming Quiz is in models (or not needed if quizzes are in lessons? No, the instructions said Quiz)
const Quiz = require("../models/Quiz");

function loadDummyData() {
  const filePath = path.join(__dirname, "../../src/data/dummyData.js");
  let content = fs.readFileSync(filePath, "utf8");
  // Basic hack to convert ES exports to CommonJS
  content = content.replace(/export const ([a-zA-Z0-9_]+) =/g, "const $1 = exports.$1 =");
  
  const m = { exports: {} };
  const wrapper = new Function("exports", "require", "module", "__filename", "__dirname", content);
  wrapper(m.exports, require, m, filePath, path.dirname(filePath));
  return m.exports;
}

const dummyData = loadDummyData();

async function seedDB() {
  mongoose.set("strictQuery", true);
  try {
    await mongoose.connect(env.MONGO_URI);
    console.log("[Seed] Connected to MongoDB.");

    // Seed Demo Users
    const adminPassword = await bcrypt.hash("password123", 10);
    const userPassword = await bcrypt.hash("password123", 10);

    const admin = await User.findOneAndUpdate(
      { email: "admin@detect.com" },
      {
        name: "Admin User",
        password: adminPassword,
        role: "admin",
        accountRole: "Professional",
        xp: 5000,
        status: "Active",
      },
      { upsert: true, new: true }
    );
    
    const user = await User.findOneAndUpdate(
      { email: "user@detectiq.local" },
      {
        name: "Demo User",
        password: userPassword,
        role: "user",
        accountRole: "Student",
        xp: 120,
        status: "Active",
      },
      { upsert: true, new: true }
    );

    console.log("[Seed] Users seeded.");

    // Seed Simulations
    for (const sim of dummyData.simulationScenarios) {
      await Simulation.findOneAndUpdate(
        { slug: sim.id },
        {
          label: sim.label,
          difficulty: sim.difficulty,
          icon: sim.icon,
          color: sim.color,
          app: sim.app,
          from: sim.from,
          subject: sim.subject,
          body: sim.body,
          feedback: sim.feedback,
          lessonsLearned: sim.lessonsLearned,
        },
        { upsert: true }
      );
    }
    console.log("[Seed] Simulations seeded.");

    // Seed Lessons
    for (const pathObj of dummyData.learningPaths) {
      const topic = pathObj.title;
      let order = 0;
      for (const lessonId of pathObj.lessons) {
        const lesson = dummyData.lessons[lessonId];
        const steps = dummyData.lessonSteps[lessonId] || {}; // Some might not have steps in dummy data
        
        await Lesson.findOneAndUpdate(
          { slug: lessonId },
          {
            topic: topic,
            title: lesson.title,
            description: lesson.description,
            difficulty: lesson.difficulty,
            estimatedTime: lesson.time,
            order: order++,
            skill: pathObj.title, // or fallback
            steps: steps,
          },
          { upsert: true }
        );
      }
    }
    console.log("[Seed] Lessons seeded.");

    // Seed Quick Learns
    for (const ql of dummyData.quickLearns) {
       await QuickLearn.findOneAndUpdate(
         { title: ql.title },
         {
           explanation: ql.explanation,
           options: ql.options,
           feedback: ql.feedback,
         },
         { upsert: true, setDefaultsOnInsert: true }
       );
    }
    console.log("[Seed] Quick Learns seeded.");

    // Seed Safety Tips
    let tipOrder = 0;
    for (const tip of dummyData.safetyTips) {
      await SafetyTip.findOneAndUpdate(
        { title: tip.title },
        {
          detail: tip.detail,
          order: tipOrder++,
        },
        { upsert: true }
      );
    }
    console.log("[Seed] Safety Tips seeded.");

    console.log("[Seed] Completed successfully.");
    process.exit(0);
  } catch (err) {
    console.error("[Seed] Error:", err);
    process.exit(1);
  }
}

seedDB();
