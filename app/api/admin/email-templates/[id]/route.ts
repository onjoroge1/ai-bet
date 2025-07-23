import { NextRequest, NextResponse } from 'next/server'
import { EmailTemplateService } from '@/lib/email-template-service'
import { UpdateTemplateData } from '@/types/email-templates'
import { logger } from '@/lib/logger'

// GET /api/admin/email-templates/[id] - Get single template
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const template = await EmailTemplateService.getTemplate(id)

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: template
    })
  } catch (error) {
    const { id } = await params
    logger.error('Failed to get email template', { error, templateId: id })
    return NextResponse.json(
      { success: false, error: 'Failed to get email template' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/email-templates/[id] - Update template
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const updateData: UpdateTemplateData = {
      name: body.name,
      slug: body.slug,
      subject: body.subject,
      htmlContent: body.htmlContent,
      textContent: body.textContent,
      category: body.category,
      variables: body.variables,
      description: body.description,
      isActive: body.isActive
    }

    const template = await EmailTemplateService.updateTemplate(id, updateData)

    return NextResponse.json({
      success: true,
      data: template
    })
  } catch (error) {
    const { id } = await params
    logger.error('Failed to update email template', { error, templateId: id })
    return NextResponse.json(
      { success: false, error: 'Failed to update email template' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/email-templates/[id] - Delete template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await EmailTemplateService.deleteTemplate(id)

    return NextResponse.json({
      success: true,
      message: 'Template deleted successfully'
    })
  } catch (error) {
    const { id } = await params
    logger.error('Failed to delete email template', { error, templateId: id })
    return NextResponse.json(
      { success: false, error: 'Failed to delete email template' },
      { status: 500 }
    )
  }
} 