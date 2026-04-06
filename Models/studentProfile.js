import mongoose from "mongoose";

const studentProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    parents: [
      {
        type: mongoose.Schema.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    grade: {
      type: String,
    },
    notes: {
      type: String,
    },
  },
  { timestamps: true },
);

// studentProfileSchema.index({ user: 1 }, { unique: true });
studentProfileSchema.index({ parents: 1 });

const StudentProfile = new mongoose.model("StudentProfile", studentProfileSchema);

export default StudentProfile;
