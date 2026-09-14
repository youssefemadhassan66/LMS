import "dotenv/config";
import crypto from "crypto";
import mongoose from "mongoose";
import Db_Connection from "../Configs/DbConfig.js";
import User from "../Models/user.js";

// Provision the first admin of a database.
//
// A fresh database has no users, so nobody can log in and nobody can reach the
// admin-only route that creates users — the chicken-and-egg this script exists
// to break. It writes through the User model, so the password goes through the
// schema's pre("save") hook and is stored as a bcrypt hash, exactly like one
// set through the dashboard.
//
//   npm run admin:create -- --email=you@example.com --name="Youssef Emad" --username=youssefadmin
//
// Values may come from flags or from ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME
// / ADMIN_USERNAME. Omit the password and a strong one is generated and printed
// once — it is never stored anywhere else and cannot be recovered afterwards.

const flags = new Map(
  process.argv
    .slice(2)
    .filter((argument) => argument.startsWith("--"))
    .map((argument) => {
      const separator = argument.indexOf("=");
      return separator === -1 ? [argument.slice(2), "true"] : [argument.slice(2, separator), argument.slice(separator + 1)];
    }),
);

const read = (flag, envVar) => {
  const value = flags.get(flag) ?? process.env[envVar];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "";
};

// Readable, unambiguous, and comfortably past the model's 8-character floor.
// Mixed case plus a digit and a symbol so it also satisfies the signup and
// password-reset rules, should the account ever go through them.
const generatePassword = () => {
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const body = Array.from(crypto.randomBytes(20))
    .map((byte) => alphabet[byte % alphabet.length])
    .join("");
  return `${body}9aA!`;
};

async function createAdmin() {
  const email = read("email", "ADMIN_EMAIL");
  const fullName = read("name", "ADMIN_NAME");
  const userName = read("username", "ADMIN_USERNAME");
  const promote = flags.get("promote") === "true";

  if (!email) {
    throw new Error("An email is required: --email=you@example.com (or ADMIN_EMAIL).");
  }

  // Only echoed when this script generated it, so the operator can save it.
  const suppliedPassword = read("password", "ADMIN_PASSWORD");
  const password = suppliedPassword || generatePassword();
  const generated = !suppliedPassword;

  if (password.length < 8) {
    throw new Error("The password must be at least 8 characters.");
  }

  await Db_Connection();

  try {
    console.log(`Database: ${mongoose.connection.host}/${mongoose.connection.name}`);
    console.log(`Environment: ${process.env.NODE_ENV || "not set"}`);

    // withInactive so a soft-deleted account is found rather than duplicated —
    // Email is unique, so inserting over one fails with E11000 either way.
    const existing = await User.findOne({ Email: email.toLowerCase() }).setOptions({ withInactive: true });

    if (existing && !promote) {
      throw new Error(`${email} already exists (role: ${existing.role}). Re-run with --promote to make it an admin and set this password.`);
    }

    if (existing) {
      existing.role = "admin";
      existing.isActive = true;
      existing.approvalStatus = "approved";
      existing.password = password;
      // validateModifiedOnly so an account whose older fields no longer satisfy
      // the current schema can still be promoted and given a working password.
      await existing.save({ validateModifiedOnly: true });

      console.log(`Promoted ${email} to admin and set a new password.`);
      if (generated) console.log(`Password: ${password}`);
      console.log("Existing sessions for this account are still valid; log out elsewhere if that matters.");
      return;
    }

    if (!fullName || !userName) {
      throw new Error('A new account needs --name="Full Name" and --username=someadmin (or ADMIN_NAME / ADMIN_USERNAME).');
    }

    const admin = await User.create({
      FullName: fullName,
      UserName: userName,
      Email: email,
      password,
      role: "admin",
      isActive: true,
      // An admin provisioned here is trusted by definition: there is no one
      // else to approve it, and no verification email to answer.
      approvalStatus: "approved",
      emailVerified: true,
    });

    console.log(`Created admin ${admin.Email} (${admin.UserName}).`);
    if (generated) {
      console.log(`Password: ${password}`);
      console.log("This is the only time it is shown. Store it in your password manager now.");
    }
  } finally {
    await mongoose.connection.close();
  }
}

createAdmin().catch((error) => {
  // The message only: a stack here would put the connection string's host into
  // a terminal scrollback or a CI log.
  console.error("Admin creation failed:", error.message);
  process.exitCode = 1;
});
