import { neon } from "@neondatabase/serverless"

// Create a SQL client with the connection string from environment variables
export const sql = neon(process.env.DATABASE_URL!)

// Helper function to safely execute SQL queries with error handling
export async function executeQuery(query: string, params: any[] = []) {
  try {
    return await sql(query, params)
  } catch (error) {
    console.error("Database query error:", error)
    throw new Error("Database operation failed")
  }
}

// User-related database functions
export const userDb = {
  // Find user by email
  async findByEmail(email: string) {
    const users = await sql`
      SELECT u.*, c.name as countryName, c.currencySymbol, c.currencyCode, c.flagEmoji
      FROM "User" u
      LEFT JOIN "Country" c ON u."countryId" = c.id
      WHERE u.email = ${email} AND u."isActive" = true
    `
    return users.length > 0 ? users[0] : null
  },

  // Update last login time
  async updateLastLogin(userId: string) {
    return await sql`
      UPDATE "User" 
      SET "lastLoginAt" = NOW() 
      WHERE id = ${userId}
    `
  },
}
