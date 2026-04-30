import "dotenv/config";
import mongoose from "mongoose";
import Session from "../Models/Session.js";
import User from "../Models/user.js";
import SessionReview from "../Models/SessionReview.js";

const CONNECTION_STRING = process.env.CONNECTION_STRING;

async function createSessionReviews() {
  try {
    // Connect to database
    await mongoose.connect(CONNECTION_STRING);
    console.log("Database Connected");

    // Get all sessions
    const sessions = await Session.find().limit(5);
    console.log(`Found ${sessions.length} sessions`);

    if (sessions.length === 0) {
      console.log("No sessions found. Please create sessions first.");
      process.exit(0);
    }

    // Get all users (students and instructors)
    const users = await User.find().limit(10);
    console.log(`Found ${users.length} users`);

    if (users.length < 2) {
      console.log("Not enough users found. Need at least 2 users (1 student, 1 instructor).");
      process.exit(0);
    }

    // Find a student and an instructor
    const student = users.find((u) => u.role === "student") || users[0];
    const instructor = users.find((u) => u.role === "instructor" || u.role === "admin") || users[1];

    console.log(`Using Student: ${student._id} (${student.userName || student.FullName})`);
    console.log(`Using Instructor: ${instructor._id} (${instructor.userName || instructor.FullName})`);

    // Create session reviews for each session
    const reviewsToCreate = [];

    for (const session of sessions) {
      // Check if review already exists
      const existingReview = await SessionReview.findOne({
        session: session._id,
        Student: student._id,
      });

      if (existingReview) {
        console.log(`Review already exists for session: ${session.title}`);
        continue;
      }

      // Create review data with random ratings (3-5)
      const reviewData = {
        session: session._id,
        Student: student._id,
        Instructor: instructor._id,
        notes: `Review for ${session.title} - Student showed good progress`,
        Behavior: Math.floor(Math.random() * 3) + 3, // 3-5
        underStanding: Math.floor(Math.random() * 3) + 3, // 3-5
        participation: Math.floor(Math.random() * 3) + 3, // 3-5
        coding: Math.floor(Math.random() * 3) + 3, // 3-5
      };

      reviewsToCreate.push(reviewData);
    }

    if (reviewsToCreate.length === 0) {
      console.log("No new reviews to create. All sessions already have reviews.");
      process.exit(0);
    }

    // Create reviews one by one to trigger pre-save hook
    const createdReviews = [];

    for (const reviewData of reviewsToCreate) {
      const review = new SessionReview(reviewData);
      const savedReview = await review.save();
      createdReviews.push(savedReview);
    }

    console.log(`\n✅ Successfully created ${createdReviews.length} session reviews!\n`);

    // Display created reviews
    createdReviews.forEach((review, index) => {
      console.log(`Review ${index + 1}:`);
      console.log(`  Session ID: ${review.session}`);
      console.log(`  Student ID: ${review.Student}`);
      console.log(`  Instructor ID: ${review.Instructor}`);
      console.log(`  Behavior: ${review.Behavior}`);
      console.log(`  Understanding: ${review.underStanding}`);
      console.log(`  Participation: ${review.participation}`);
      console.log(`  Coding: ${review.coding}`);
      console.log(`  Overall Rating: ${review.overAllRating}`);
      console.log(`  Notes: ${review.notes}`);
      console.log("");
    });

    process.exit(0);
  } catch (error) {
    console.error("Error creating session reviews:", error);
    process.exit(1);
  }
}

createSessionReviews();
