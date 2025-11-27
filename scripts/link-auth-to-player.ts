import * as admin from "firebase-admin";
import * as path from "path";

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, "..", "service-account.json");
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const auth = admin.auth();

async function linkAuthToPlayer() {
  // Get command line args
  const args = process.argv.slice(2);
  const emailArg = args.find(a => a.startsWith("--email="));
  const playerIdArg = args.find(a => a.startsWith("--playerId="));
  
  if (!emailArg || !playerIdArg) {
    console.log("Usage: npx ts-node link-auth-to-player.ts --email=you@example.com --playerId=pYourPlayerId");
    console.log("\nThis links a Firebase Auth user (by email) to a player doc (by ID).");
    return;
  }
  
  const email = emailArg.split("=")[1];
  const playerId = playerIdArg.split("=")[1];
  
  try {
    // Get the auth user by email
    const authUser = await auth.getUserByEmail(email);
    console.log(`Found auth user: ${authUser.uid} (${authUser.email})`);
    
    // Check if player doc exists
    const playerRef = db.collection("players").doc(playerId);
    const playerDoc = await playerRef.get();
    
    if (!playerDoc.exists) {
      console.error(`Player doc not found: ${playerId}`);
      return;
    }
    
    // Update player doc with authUid and email
    await playerRef.update({
      authUid: authUser.uid,
      email: authUser.email
    });
    
    console.log(`✓ Linked ${playerId} to auth user ${authUser.uid}`);
    console.log(`  Email: ${authUser.email}`);
  } catch (e: any) {
    if (e.code === "auth/user-not-found") {
      console.error(`No auth user found with email: ${email}`);
    } else {
      console.error("Error:", e.message);
    }
  }
}

linkAuthToPlayer().catch(console.error);
