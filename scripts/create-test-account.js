#!/usr/bin/env node

/**
 * Script to create test account in Supabase backend
 * Uses Supabase Admin API to create user and profile
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY

if (!supabaseUrl) {
  console.error('❌ VITE_SUPABASE_URL not found in .env')
  process.exit(1)
}

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in .env')
  console.error('   Get it from: Supabase Dashboard → Settings → API → Secret key')
  process.exit(1)
}

// Create admin client (has full access)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createTestAccount() {
  console.log('🚀 Creating test account...\n')

  const testEmail = 'test@spratt.com'
  const testPassword = 'test123456'
  const testName = 'Test User'

  try {
    // Step 1: Check if user already exists
    console.log('1. Checking if user exists...')
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (listError) {
      console.error('❌ Error listing users:', listError.message)
      throw listError
    }

    const existingUser = existingUsers.users.find(u => u.email === testEmail)

    let userId

    if (existingUser) {
      console.log('   ✓ User already exists')
      userId = existingUser.id
    } else {
      // Step 2: Create user
      console.log('2. Creating user...')
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: testEmail,
        password: testPassword,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          full_name: testName
        }
      })

      if (createError) {
        console.error('❌ Error creating user:', createError.message)
        throw createError
      }

      console.log('   ✓ User created')
      userId = newUser.user.id
    }

    // Step 3: Create/Update profile
    console.log('3. Creating/updating profile...')
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        email: testEmail,
        full_name: testName,
        role: 'admin'
      }, {
        onConflict: 'id'
      })

    if (profileError) {
      console.error('❌ Error creating profile:', profileError.message)
      throw profileError
    }

    console.log('   ✓ Profile created/updated')

    // Step 4: Verify
    console.log('4. Verifying account...')
    const { data: profile, error: verifyError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('email', testEmail)
      .single()

    if (verifyError) {
      console.error('❌ Error verifying:', verifyError.message)
      throw verifyError
    }

    console.log('\n✅ Test account created successfully!\n')
    console.log('Credentials:')
    console.log(`   Email: ${testEmail}`)
    console.log(`   Password: ${testPassword}`)
    console.log(`   Role: ${profile.role}\n`)
    console.log('You can now sign in with these credentials.')

  } catch (error) {
    console.error('\n❌ Failed to create test account:', error.message)
    console.error('\nTroubleshooting:')
    console.error('1. Make sure you\'ve run the initial migration (001_initial_schema.sql)')
    console.error('2. Check that SUPABASE_SERVICE_ROLE_KEY is correct in .env')
    console.error('3. Verify Supabase project is active')
    process.exit(1)
  }
}

createTestAccount()
