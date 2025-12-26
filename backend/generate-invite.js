#!/usr/bin/env node
import crypto from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import db from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Generate a secure random invite code
function generateInviteCode() {
  return crypto.randomBytes(16).toString('base64url');
}

// Add username to allowlist.json
function addToAllowlist(username) {
  const allowlistPath = join(__dirname, 'allowlist.json');

  try {
    const data = readFileSync(allowlistPath, 'utf8');
    const allowlist = JSON.parse(data);

    // Check if user is already in allowlist
    if (!allowlist.allowedUsers) {
      allowlist.allowedUsers = [];
    }

    if (allowlist.allowedUsers.includes(username)) {
      return false; // Already in allowlist
    }

    // Add user to allowlist
    allowlist.allowedUsers.push(username);

    // Write back to file
    writeFileSync(allowlistPath, JSON.stringify(allowlist, null, 2) + '\n', 'utf8');
    return true; // Added successfully
  } catch (error) {
    console.error('⚠️  Warning: Could not update allowlist.json:', error.message);
    console.error('You will need to manually add the username to allowlist.json');
    return false;
  }
}

const username = process.argv[2];

if (!username) {
  console.error('Usage: node generate-invite.js <username>');
  console.error('Example: node generate-invite.js regina');
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
    // Ensure user is in allowlist even for existing invite codes
    const addedToAllowlist = addToAllowlist(username);

    console.log(`\n⚠️  An unused invite code already exists for '${username}':`);
    console.log(`\nInvite Code: ${existingInvite.code}`);

    if (addedToAllowlist) {
      console.log(`\n✅ User automatically added to allowlist`);
    } else {
      console.log(`\nℹ️  User already in allowlist`);
    }

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

  // Automatically add user to allowlist
  const addedToAllowlist = addToAllowlist(username);

  console.log(`\n✅ Invite code generated successfully!\n`);
  console.log(`Username:    ${username}`);
  console.log(`Invite Code: ${inviteCode}`);

  if (addedToAllowlist) {
    console.log(`\n✅ User automatically added to allowlist`);
  } else {
    console.log(`\nℹ️  User was already in allowlist`);
  }

  console.log(`\nSend this code to ${username} to complete registration at:`);
  console.log(`https://track.chinmaypandhare.uk\n`);
  console.log(`⚠️  This code is single-use and can only be used by '${username}'.\n`);
} catch (error) {
  console.error('❌ Error generating invite code:', error.message);
  process.exit(1);
}
