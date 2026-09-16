const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required."],
      trim: true,
      maxlength: [80, "Name must be under 80 characters."],
    },
    email: {
      type: String,
      required: [true, "Email is required."],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address."],
    },
    password: {
      type: String,
      required: [
        function () {
          return this.authProvider === 'local';
        },
        "Password is required.",
      ],
      minlength: [8, "Password must be at least 8 characters."],
      select: false, // never returned by default
    },
    authProvider: {
      type: String,
      enum: ["local", "google", "linked"],
      default: "local",
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    accountRole: {
      // the user-facing "I am a..." selection — distinct from auth role
      type: String,
      enum: ["Student", "Professional", "Business"],
      default: "Student",
    },
    avatarInitials: { type: String, maxlength: 3 },
    xp: { type: Number, default: 0, min: 0 },
    streakDays: { type: Number, default: 0, min: 0 },
    lastActiveDate: { type: Date },
    lastPasswordChange: { type: Date },
    status: {
      type: String,
      enum: ["Active", "Suspended"],
      default: "Active",
    },
    preferences: {
      theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
      notifications: { type: Boolean, default: true },
      emailAlerts: { type: Boolean, default: true },
      weeklySummary: { type: Boolean, default: false },
    },
    securityProfile: {
      riskScore: { type: Number, default: 0 },
      phishingSusceptibility: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
    },
    learningProfile: {
      strengths: [{ type: String }],
      weaknesses: [{ type: String }],
      recommendedFocus: { type: String },
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.pre("save", function setAvatarInitials(next) {
  if (this.isModified("name") || !this.avatarInitials) {
    this.avatarInitials = this.name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join("");
  }
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

/** Derived, not stored — keeps leveling logic in one place. */
userSchema.methods.getLevel = function getLevel() {
  return Math.max(1, Math.floor(this.xp / 300) + 1);
};

module.exports = mongoose.model("User", userSchema);
