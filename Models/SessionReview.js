import mongoose from "mongoose";

const SessionReviewSchema = new mongoose.Schema(
  {
    session: {
      type: mongoose.Schema.ObjectId,
      ref: "Session",
      required: true,
    },
    Student: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: true,
    },
    Instructor: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: true,
    },

    notes: {
      type: String,
    },
    Behavior: {
      type: Number,
      min: 0,
      max: 5,
      required: true,
    },
    underStanding: {
      type: Number,
      min: 0,
      max: 5,
      required: true,
    },
    participation: {
      type: Number,
      min: 0,
      max: 5,
      required: true,
    },
    coding: {
      type: Number,
      min: 0,
      max: 5,
      required: true,
    },
    overAllRating: {
      type: Number,
    },
  },
  { timestamps: true },
);

SessionReviewSchema.index({ Student: 1 });
SessionReviewSchema.index({ createdAt: 1 });

SessionReviewSchema.index({ session: 1, Student: 1 }, { unique: true });

SessionReviewSchema.pre("save", function () {
  this.overAllRating = (this.Behavior + this.underStanding + this.participation + this.coding) / 4;
});

const SessionReview = mongoose.model("SessionReview", SessionReviewSchema);

export default SessionReview;
