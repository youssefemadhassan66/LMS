import mongoose from "mongoose";

const SubmissionSchema = mongoose.Schema(
  {
    task: {
      type: mongoose.Schema.ObjectId,
      ref: "Task",
    },
    student: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
    },
    SubmissionDate: {
      type: Date,
    },
    Task_links: [
      {
        name: { type: String, required: true },
        url: { type: String, required: true },
      },
    ],
    note: {
      type: String,
    },
    status: {
      type: String,
      enum: ["Completed", "Pending", "Reviewed", "Resubmitted", "Late submission"],
      default: "Pending",
    },
    review: {
      score: {
        type: Number,
        min: 0,
        max: 10,
      },
      comment: { type: String },
      reviewAt: { type: Date },
      rating: {
        type: String,
        enum: ["Full mark", "Excellent", "Very Good", "Good", "Fair"],
      },
    },
  },
  { timestamps: true },
);

SubmissionSchema.index({ task: 1, student: 1 });
SubmissionSchema.index({ student: 1 });
SubmissionSchema.index({ status: 1 });

// ─── Pre-find ─────────────────────────────────────────────────────────────────
SubmissionSchema.pre(/^find/, async function () {
  this.populate([
    { path: "task", select: "title dueDate" },
    { path: "student", select: "userName FullName" },
  ]);
});

// ─── Pre-save ─────────────────────────────────────────────────────────────────
SubmissionSchema.pre("save", async function () {
  const task = await mongoose.model("Task").findById(this.task);

  if (!task) return;

  if (this.status === "Completed") {
    if (!this.Task_links || this.Task_links.length === 0) {
      throw new Error("At least one submission link is required when marking as Completed");
    }

    this.SubmissionDate = new Date();
    this.note = "Great job!";

    if (this.SubmissionDate > task.dueDate) {
      this.status = "Late submission";
      this.note = "Late submission";
    }
  } else if (this.status === "Pending") {
    this.SubmissionDate = undefined;
    this.note = "Waiting for Submission!";
  } else if (this.status === "Resubmitted") {
    this.note = "Please review the task and resubmit!";
  }

  if (this.review && this.review.score !== undefined && this.review.score !== null) {
    const score = this.review.score;

    if (score < 5) {
      this.review.rating = "Fair";
    } else if (score < 7) {
      this.review.rating = "Good";
    } else if (score < 9) {
      this.review.rating = "Very Good";
    } else if (score < 10) {
      this.review.rating = "Excellent";
    } else {
      // score === 10
      this.review.rating = "Full mark";
    }
  }
});

// ─── Methods ──────────────────────────────────────────────────────────────────
SubmissionSchema.methods.markComplete = async function () {
  this.status = "Completed";
  this.SubmissionDate = new Date();

  const task = await mongoose.model("Task").findById(this.task);
  if (task && this.SubmissionDate > task.dueDate) {
    this.status = "Late submission";
    this.note = "Late submission";
  }

  return this.save();
};

const Submission = mongoose.model("Submission", SubmissionSchema);

export default Submission;
