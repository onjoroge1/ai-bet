import { NextRequest, NextResponse } from 'next/server'
import { EmailTemplateService } from '@/lib/email-template-service'
import { CreateTemplateData, UpdateTemplateData } from '@/types/email-templates'
import { logger } from '@/lib/logger'

// GET /api/admin/email-templates - List all templates
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') as any
    const isActive = searchParams.get('isActive')
    const search = searchParams.get('search')
    const createdBy = searchParams.get('createdBy')

    const filters = {
      category: category || undefined,
      isActive: isActive ? isActive === 'true' : undefined,
      search: search || undefined,
      createdBy: createdBy || undefined
    }

    const templates = await EmailTemplateService.listTemplates(filters)

    return NextResponse.json({
      success: true,
      data: templates
    })
  } catch (error) {
    logger.error('Failed to list email templates', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to list email templates' },
      { status: 500 }
    )
  }
}

// POST /api/admin/email-templates - Create new template
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const templateData: CreateTemplateData = {
      name: body.name,
      slug: body.slug,
      subject: body.subject,
      htmlContent: body.htmlContent,
      textContent: body.textContent,
      category: body.category,
      variables: body.variables,
      description: body.description,
      createdBy: body.createdBy || 'system'
    }

    // Validate required fields
    if (!templateData.name || !templateData.slug || !templateData.subject || !templateData.htmlContent) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const template = await EmailTemplateService.createTemplate(templateData)

    return NextResponse.json({
      success: true,
      data: template
    })
  } catch (error) {
    logger.error('Failed to create email template', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to create email template' },
      { status: 500 }
    )
  }
} 