import StudentProfile from "../Models/studentProfile.js";

// Every student-facing record in this system hangs off a StudentProfile, not off
// the User: sessions, exams, tasks, reviews and gamification all key on
// studentProfileId. A student User with no profile is therefore invisible to
// instructors and admins — it cannot be listed, assigned or scheduled — even
// though the account itself is approved and can log in.
//
// Signup, admin user creation and approval each used to leave the profile
// uncreated, so this runs at all three points. It must be idempotent: approval
// can be re-run, and a profile may already exist from an earlier assignment.
//
// The upsert is the race guard. Two concurrent callers (an admin approving while
// an instructor assignment lands) can both miss the read and both try to insert;
// `user` is unique, so the loser gets E11000. That is not an error condition
// here — the profile the caller wanted now exists, so re-read and return it.
const ensureStudentProfile = async (userId) => {
  if (!userId) return null;

  try {
    return await StudentProfile.findOneAndUpdate({ user: userId }, { $setOnInsert: { user: userId } }, { upsert: true, returnDocument: "after", setDefaultsOnInsert: true });
  } catch (error) {
    if (error?.code === 11000) {
      return StudentProfile.findOne({ user: userId });
    }
    throw error;
  }
};

export default ensureStudentProfile;
