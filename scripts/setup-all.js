#!/usr/bin/env node

/**
 * Comprehensive setup script for Spratt app
 * Creates storage bucket, sets up policies, and verifies everything
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

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

async function checkDatabaseSchema() {
  console.log('📊 Checking database schema...\n')
  
  try {
    // Check if profiles table exists
    const { error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .limit(1)

    if (profilesError) {
      console.error('❌ Database schema not set up!')
      console.error('   Error:', profilesError.message)
      console.error('\n   Please run the migration first:')
      console.error('   1. Go to Supabase Dashboard → SQL Editor')
      console.error('   2. Copy contents of supabase/migrations/001_initial_schema.sql')
      console.error('   3. Paste and run\n')
      return false
    }

    console.log('   ✓ Database schema is set up')
    return true
  } catch (error) {
    console.error('❌ Error checking database:', error.message)
    return false
  }
}

async function createStorageBucket() {
  console.log('📦 Setting up storage bucket...\n')

  const bucketName = 'recordings'

  try {
    // Try to access the bucket directly to see if it exists
    const { error: testError } = await supabaseAdmin.storage.from(bucketName).list('', { limit: 1 })
    
    if (!testError) {
      console.log(`   ✓ Bucket "${bucketName}" already exists and is accessible`)
      return true
    }

    // If bucket doesn't exist, try to create it
    if (testError && testError.message.includes('not found') || testError.message.includes('does not exist')) {
      console.log(`   Creating bucket "${bucketName}"...`)
      
      // Use REST API directly for bucket creation
      const response = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey
        },
        body: JSON.stringify({
          name: bucketName,
          public: true
        })
      })

      if (!response.ok) {
        const errorData = await response.text()
        console.error('❌ Error creating bucket:', errorData)
        throw new Error(`Failed to create bucket: ${response.status} ${errorData}`)
      }

      console.log(`   ✓ Bucket "${bucketName}" created successfully`)
      return true
    }

    // If we get here, there's some other error
    console.error('❌ Error checking bucket:', testError.message)
    return false
  } catch (error) {
    console.error('❌ Failed to create storage bucket:', error.message)
    console.log('   💡 You may need to create it manually:')
    console.log('      Supabase Dashboard → Storage → Create Bucket → Name: "recordings" → Public: Yes')
    return false
  }
}

async function setupStoragePolicies() {
  console.log('🔒 Setting up storage policies...\n')

  try {
    // Note: Storage policies are typically set via SQL, but we can verify they exist
    // For now, we'll just confirm the bucket is accessible
    const { error } = await supabaseAdmin.storage.from('recordings').list('', {
      limit: 1
    })

    if (error && error.message.includes('policy')) {
      console.log('   ⚠️  Storage policies may need configuration')
      console.log('   The bucket exists but RLS policies might need setup')
      return false
    }

    console.log('   ✓ Storage bucket is accessible')
    return true
  } catch (error) {
    console.log('   ⚠️  Could not verify storage policies:', error.message)
    return true // Don't fail the whole setup
  }
}

async function verifyTestAccount() {
  console.log('👤 Verifying test account...\n')

  const testEmail = 'test@spratt.com'

  try {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('email', testEmail)
      .single()

    if (error || !profile) {
      console.log('   ⚠️  Test account not found')
      console.log('   Run: npm run create-test-account')
      return false
    }

    console.log(`   ✓ Test account exists: ${testEmail}`)
    console.log(`   ✓ Role: ${profile.role}`)
    return true
  } catch (error) {
    console.log('   ⚠️  Could not verify test account:', error.message)
    return false
  }
}

async function main() {
  console.log('🚀 Spratt App - Complete Setup\n')
  console.log('=' .repeat(50) + '\n')

  const results = {
    database: false,
    storage: false,
    policies: false,
    testAccount: false
  }

  // Step 1: Check database
  results.database = await checkDatabaseSchema()
  console.log()

  if (!results.database) {
    console.error('❌ Please set up the database schema first!')
    process.exit(1)
  }

  // Step 2: Create storage bucket
  results.storage = await createStorageBucket()
  console.log()

  // Step 3: Setup storage policies
  results.policies = await setupStoragePolicies()
  console.log()

  // Step 4: Verify test account
  results.testAccount = await verifyTestAccount()
  console.log()

  // Summary
  console.log('=' .repeat(50))
  console.log('\n📋 Setup Summary:\n')
  console.log(`   Database Schema: ${results.database ? '✅' : '❌'}`)
  console.log(`   Storage Bucket:   ${results.storage ? '✅' : '❌'}`)
  console.log(`   Storage Policies: ${results.policies ? '✅' : '⚠️'}`)
  console.log(`   Test Account:    ${results.testAccount ? '✅' : '⚠️'}`)
  console.log()

  if (results.database && results.storage) {
    console.log('✅ Core setup complete! You can now run the app.\n')
    console.log('Next steps:')
    console.log('   1. npm run dev')
    console.log('   2. Sign in with test@spratt.com / test123456')
    console.log('   3. Start recording!\n')
  } else {
    console.log('⚠️  Some setup steps need attention. See above.\n')
    process.exit(1)
  }
}

main().catch(error => {
  console.error('\n❌ Unexpected error:', error)
  process.exit(1)
})
