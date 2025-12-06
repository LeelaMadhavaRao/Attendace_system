/**
 * Seed Admin User Script
 * Creates an admin account in Supabase Auth and profiles table
 */

const { createClient } = require('@supabase/supabase-js')
const dotenv = require('dotenv')

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Admin credentials
const ADMIN_EMAIL = 'admin@attendance.com'
const ADMIN_PASSWORD = 'Admin@123456'
const ADMIN_NAME = 'System Administrator'

async function seedAdmin() {
  console.log('🌱 Seeding admin user...\n')

  try {
    // Step 1: Check if admin already exists
    console.log('🔍 Checking for existing admin user...')
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
    
    if (listError) {
      console.error('Error listing users:', listError)
      throw listError
    }

    const existingAdmin = users.find(u => u.email === ADMIN_EMAIL)

    if (existingAdmin) {
      console.log('✅ Admin user already exists in Auth')
      console.log('   User ID:', existingAdmin.id)

      // Check/create profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', existingAdmin.id)
        .single()

      if (profileError || !profileData) {
        console.log('📝 Creating profile for existing user...')
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: existingAdmin.id,
            email: ADMIN_EMAIL,
            name: ADMIN_NAME,
            role: 'admin'
          })

        if (insertError) {
          console.error('Error creating profile:', insertError)
          throw insertError
        }
        console.log('✅ Profile created successfully')
      } else {
        console.log('✅ Profile already exists')
      }

      console.log('\n✨ Admin setup complete!')
      console.log('\n📋 Admin Credentials:')
      console.log('   Email:', ADMIN_EMAIL)
      console.log('   Password:', ADMIN_PASSWORD)
      console.log('   Role: Admin')
      console.log('\n🔗 Login at: http://localhost:3000/login')
      return
    }

    // Step 2: Create new admin user (WITHOUT trigger dependency)
    console.log('📧 Creating admin user in Auth...')
    
    // First, disable the trigger temporarily by creating user with raw SQL approach
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: {
        name: ADMIN_NAME
      }
    })

    if (authError) {
      console.error('Auth error:', authError)
      throw authError
    }

    console.log('✅ Admin user created in Auth')
    console.log('   User ID:', authData.user.id)

    // Step 3: Manually create profile (bypass trigger)
    console.log('\n📝 Creating admin profile...')
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        email: ADMIN_EMAIL,
        name: ADMIN_NAME,
        role: 'admin'
      })

    if (profileError) {
      console.error('Profile creation error:', profileError)
      throw profileError
    }

    console.log('✅ Profile created successfully')

    console.log('\n✨ Admin user seeded successfully!')
    console.log('\n📋 Admin Credentials:')
    console.log('   Email:', ADMIN_EMAIL)
    console.log('   Password:', ADMIN_PASSWORD)
    console.log('   Role: Admin')
    console.log('\n🔗 Login at: http://localhost:3000/login')

  } catch (error) {
    console.error('\n❌ Error seeding admin:', error.message)
    if (error.status) console.error('   Status:', error.status)
    if (error.code) console.error('   Code:', error.code)
    console.error('\n   Full error:', error)
    process.exit(1)
  }
}

// Run the seed function
seedAdmin()
