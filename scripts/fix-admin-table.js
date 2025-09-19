/**
 * Script to fix admin table schema issues
 * This script can be run to clean up the admin table if needed
 */

const { getVercelDatabase } = require('../lib/vercel-init-db');

async function fixAdminTable() {
  try {
    console.log('🔧 Starting admin table fix...');
    
    const { sequelize, Admin } = await getVercelDatabase(process.env.DATABASE_URL);
    
    // Check current admin table structure
    const [columns] = await sequelize.query(`
      SELECT column_name, is_nullable, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'admins' 
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 Current admin table structure:');
    columns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // Check for null email values
    const [nullEmailResults] = await sequelize.query(`
      SELECT COUNT(*) as count FROM admins WHERE email IS NULL;
    `);
    
    const nullEmailCount = parseInt(nullEmailResults[0].count);
    console.log(`📊 Found ${nullEmailCount} records with null email`);
    
    if (nullEmailCount > 0) {
      console.log('🔧 Fixing null email values...');
      
      // Update null email values
      await sequelize.query(`
        UPDATE admins 
        SET email = CONCAT('admin_', id, '@example.com')
        WHERE email IS NULL;
      `);
      
      console.log('✅ Fixed null email values');
    }
    
    // Check if we have any admin users
    const adminCount = await Admin.count();
    console.log(`👤 Total admin users: ${adminCount}`);
    
    if (adminCount === 0) {
      console.log('👤 No admin users found, creating default admin...');
      
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      await Admin.create({
        username: 'admin',
        email: 'admin@diskominfo-bogor.go.id',
        password: hashedPassword,
      });
      
      console.log('✅ Default admin created (username: admin, password: admin123)');
    }
    
    await sequelize.close();
    console.log('✅ Admin table fix completed successfully');
    
  } catch (error) {
    console.error('❌ Error fixing admin table:', error);
    process.exit(1);
  }
}

// Run the fix if this script is executed directly
if (require.main === module) {
  fixAdminTable();
}

module.exports = { fixAdminTable };
