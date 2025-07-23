import { NextRequest, NextResponse } from 'next/server'
import { EmailTemplateService } from '@/lib/email-template-service'
import { logger } from '@/lib/logger'

// POST /api/admin/email-templates/seed - Seed default templates
export async function POST(request: NextRequest) {
  try {
    await EmailTemplateService.seedDefaultTemplates()

    return NextResponse.json({
      success: true,
      message: 'Default templates seeded successfully'
    })
  } catch (error) {
    logger.error('Failed to seed default templates', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to seed default templates' },
      { status: 500 }
    )
  }
} 