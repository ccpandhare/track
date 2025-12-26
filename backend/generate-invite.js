#!/usr/bin/env node
import crypto from 'crypto';
import db from './db.js';

// Generate a secure random invite code
function generateInviteCode() {
  return crypto.randomBytes(16).toString('base64url');
}

const username = process.argv[2];

if (!username) {
  console.error('Usage: node generate-invite.js <username>');
  console.error('Example: node generate-invite.js ch64pn');
  process.exit(1);
}

// Check if user already exists
const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
if (existingUser) {
  console.error(`❌ Error: User '${username}' already exists!`);
  console.error('They are already registered and do not need an invite code.');
  process.exit(1);
}

// Check if invite code already exists for this username
const existingInvite = db.prepare('SELECT code, used_at FROM invite_codes WHERE username = ?').get(username);
if (existingInvite) {
  if (existingInvite.used_at) {
    console.error(`❌ Error: An invite code for '${username}' was already used.`);
    console.error('The user is registered. Cannot create a new invite code.');
    process.exit(1);
  } else {
    console.log(`\n⚠️  An unused invite code already exists for '${username}':`);
    console.log(`\nInvite Code: ${existingInvite.code}`);
    console.log(`\nSend this code to ${username} to complete registration at:`);
    console.log(`https://track.chinmaypandhare.uk\n`);
    process.exit(0);
  }
}

// Generate new invite code
const inviteCode = generateInviteCode();

try {
  db.prepare(`
    INSERT INTO invite_codes (code, username, created_at)
    VALUES (?, ?, ?)
  `).run(inviteCode, username, Date.now());

  console.log(`\n✅ Invite code generated successfully!\n`);
  console.log(`Username:    ${username}`);
  console.log(`Invite Code: ${inviteCode}`);
  console.log(`\nSend this code to ${username} to complete registration at:`);
  console.log(`https://track.chinmaypandhare.uk\n`);
  console.log(`⚠️  This code is single-use and can only be used by '${username}'.\n`);
} catch (error) {
  console.error('❌ Error generating invite code:', error.message);
  process.exit(1);
}
