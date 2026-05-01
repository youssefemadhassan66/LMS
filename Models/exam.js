import mongoose from "mongoose";

const examSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    totalMark: {
      type: Number,
      default: 100,
    },
    passingMark: {
      type: Number,
      default: 50,
    },
    score: {
      type: Number,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    createdBy: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
    },
    studentProfileId: {
      type: mongoose.Schema.ObjectId,
      ref: "StudentProfile",
      required: true,
    },
  },
  { timestamps: true }
);

examSchema.index({ studentProfileId: 1 });
examSchema.index({ createdBy: 1 });

const Exam = mongoose.model("Exam", examSchema);

export default Exam;
