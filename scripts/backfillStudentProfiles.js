import "dotenv/config";
import mongoose from "mongoose";
import User from "../Models/user.js";
import StudentProfile from "../Models/studentProfile.js";
import ensureStudentProfile from "../Utilities/StudentProfileHelper.js";

// Signup, admin user creation and approval all used to create a student User
// without its StudentProfile. Those accounts are invisible to instructors and
// admins — they cannot be listed, assigned or scheduled — because every
// student-facing record keys on studentProfileId. This provisions the missing
// profiles for accounts that already exist.
//
// Safe to re-run: ensureStudentProfile upserts, so students that already have a
// profile are left untouched.
//
// Pass --dry-run to list what would be created without writing.

if (!process.env.CONNECTION_STRING) {
  throw new Error("CONNECTION_STRING is required");
}

const isDryRun = process.argv.slice(2).includes("--dry-run");

await mongoose.connect(process.env.CONNECTION_STRING);

let created = 0;
let alreadyPresent = 0;

try {
  console.log(`Target: ${mongoose.connection.host}/${mongoose.connection.name}`);
  console.log(isDryRun ? "Mode: DRY RUN (no writes)\n" : "Mode: WRITE\n");

  // withInactive so soft-deleted students still get a profile; re-activating an
  // account should not leave it half-provisioned.
  const students = await User.find({ role: "student" }).setOptions({ withInactive: true }).select("_id FullName UserName Email approvalStatus isActive").lean();

  // distinct() rather than find(): the schema's pre(/^find/) hook populates four
  // paths on every find, which this only needs the raw user ids from.
  const profiledUserIds = new Set((await StudentProfile.distinct("user")).map(String));

  for (const student of students) {
    if (profiledUserIds.has(String(student._id))) {
      alreadyPresent += 1;
      continue;
    }

    console.log(`  missing profile: ${student.UserName} <${student.Email}> approval=${student.approvalStatus ?? "n/a"} active=${student.isActive !== false}`);

    if (!isDryRun) {
      await ensureStudentProfile(student._id);
    }
    created += 1;
  }

  console.log(`\n${students.length} student accounts scanned.`);
  console.log(`${alreadyPresent} already had a profile.`);
  console.log(isDryRun ? `${created} would be created. Re-run without --dry-run to apply.` : `${created} profiles created.`);
} finally {
  await mongoose.disconnect();
}
