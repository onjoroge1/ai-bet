import prisma from '@/lib/db'
import { logger } from '@/lib/logger'
import {
  EmailTemplate,
  EmailTemplateVersion,
  EmailLog,
  CreateTemplateData,
  UpdateTemplateData,
  TemplateFilters,
  RenderedEmail,
  ValidationResult,
  DEFAULT_EMAIL_TEMPLATES
} from '@/types/email-templates'

export class EmailTemplateService {
  /**
   * Create a new email template
   */
  static async createTemplate(data: CreateTemplateData): Promise<EmailTemplate> {
    try {
      const template = await prisma.emailTemplate.create({
        data: {
          name: data.name,
          slug: data.slug,
          subject: data.subject,
          htmlContent: data.htmlContent,
          textContent: data.textContent || undefined,
          category: data.category,
          variables: data.variables ? JSON.parse(JSON.stringify(data.variables)) : null,
          description: data.description,
          createdBy: data.createdBy,
          version: 1
        }
      })

      // Create initial version
      await prisma.emailTemplateVersion.create({
        data: {
          templateId: template.id,
          version: 1,
          htmlContent: (data.htmlContent ?? '') as string,
          textContent: data.textContent || null,
          subject: (data.subject ?? '') as string,
          variables: data.variables ? JSON.parse(JSON.stringify(data.variables)) : null,
          createdBy: data.createdBy
        }
      })

      logger.info('Email template created', { templateId: template.id, name: template.name })
      return template as unknown as EmailTemplate
    } catch (error) {
      logger.error('Failed to create email template', { error, data })
      throw error
    }
  }

  /**
   * Update an existing email template
   */
  static async updateTemplate(id: string, data: UpdateTemplateData): Promise<EmailTemplate> {
    try {
      const template = await prisma.emailTemplate.update({
        where: { id },
        data: {
          name: data.name,
          slug: data.slug,
          subject: data.subject,
          htmlContent: data.htmlContent,
          textContent: data.textContent || undefined,
          category: data.category,
          variables: data.variables ? JSON.parse(JSON.stringify(data.variables)) : undefined,
          description: data.description,
          isActive: data.isActive,
          version: { increment: 1 }
        }
      })

      // Create new version
      const existingTemplate = await prisma.emailTemplate.findUnique({ where: { id } })
      if (existingTemplate) {
        await prisma.emailTemplateVersion.create({
          data: {
            templateId: id,
            version: template.version,
            htmlContent: (data.htmlContent ?? '') as string,
            textContent: data.textContent || null,
            subject: (data.subject ?? '') as string,
            variables: data.variables ? JSON.parse(JSON.stringify(data.variables)) : existingTemplate.variables,
            createdBy: existingTemplate.createdBy
          }
        })
      }

      logger.info('Email template updated', { templateId: id, name: template.name })
      return template as unknown as EmailTemplate
    } catch (error) {
      logger.error('Failed to update email template', { error, templateId: id, data })
      throw error
    }
  }

  /**
   * Delete an email template
   */
  static async deleteTemplate(id: string): Promise<void> {
    try {
      // Check if template exists
      const template = await prisma.emailTemplate.findUnique({
        where: { id }
      })

      if (!template) {
        throw new Error('Template not found')
      }

      // Delete related records first
      await prisma.emailLog.deleteMany({
        where: { templateId: id }
      })

      await prisma.emailTemplateVersion.deleteMany({
        where: { templateId: id }
      })

      // Delete the template
      await prisma.emailTemplate.delete({
        where: { id }
      })

      logger.info('Email template deleted', { templateId: id, name: template.name })
    } catch (error) {
      logger.error('Failed to delete email template', { error, templateId: id })
      throw error
    }
  }

  /**
   * Get a single template by ID
   */
  static async getTemplate(id: string): Promise<EmailTemplate | null> {
    try {
      const template = await prisma.emailTemplate.findUnique({
        where: { id }
      })

      return template as unknown as EmailTemplate | null
    } catch (error) {
      logger.error('Failed to get email template', { error, templateId: id })
      throw error
    }
  }

  /**
   * Get a template by slug
   */
  static async getTemplateBySlug(slug: string): Promise<EmailTemplate | null> {
    try {
      const template = await prisma.emailTemplate.findUnique({
        where: { slug }
      })

      return template as unknown as EmailTemplate | null
    } catch (error) {
      logger.error('Failed to get email template by slug', { error, slug })
      throw error
    }
  }

  /**
   * List all templates with optional filtering
   */
  static async listTemplates(filters?: TemplateFilters): Promise<EmailTemplate[]> {
    try {
      const where: any = {}

      if (filters?.category) {
        where.category = filters.category
      }

      if (filters?.isActive !== undefined) {
        where.isActive = filters.isActive
      }

      if (filters?.search) {
        where.OR = [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { slug: { contains: filters.search, mode: 'insensitive' } },
          { subject: { contains: filters.search, mode: 'insensitive' } }
        ]
      }

      const templates = await prisma.emailTemplate.findMany({
        where,
        orderBy: { updatedAt: 'desc' }
      })

      return templates as unknown as EmailTemplate[]
    } catch (error) {
      logger.error('Failed to list email templates', { error, filters })
      throw error
    }
  }

  /**
   * Get templates grouped by category
   */
  static async getTemplatesByCategory(): Promise<Record<string, EmailTemplate[]>> {
    try {
      const templates = await this.listTemplates()
      
      const grouped = templates.reduce((acc, template) => {
        if (!acc[template.category]) {
          acc[template.category] = []
        }
        acc[template.category].push(template)
        return acc
      }, {} as Record<string, EmailTemplate[]>)

      return grouped
    } catch (error) {
      logger.error('Failed to get templates by category', { error })
      throw error
    }
  }

  /**
   * Create a new version of a template
   */
  static async createVersion(templateId: string, data: {
    htmlContent: string
    textContent?: string
    subject: string
    variables?: any[]
    createdBy: string
  }): Promise<EmailTemplateVersion> {
    try {
      const existingTemplate = await prisma.emailTemplate.findUnique({
        where: { id: templateId }
      })

      if (!existingTemplate) {
        throw new Error('Template not found')
      }

      const newVersion = existingTemplate.version + 1

      const version = await prisma.emailTemplateVersion.create({
        data: {
          templateId,
          version: newVersion,
          htmlContent: data.htmlContent,
          textContent: data.textContent,
          subject: data.subject,
          variables: data.variables,
          createdBy: data.createdBy
        }
      })

      // Update template version
      await prisma.emailTemplate.update({
        where: { id: templateId },
        data: {
          version: newVersion,
          htmlContent: data.htmlContent,
          textContent: data.textContent,
          subject: data.subject,
          variables: data.variables
        }
      })

      logger.info('Email template version created', { templateId, version: newVersion })
      return version as unknown as EmailTemplateVersion
    } catch (error) {
      logger.error('Failed to create template version', { error, templateId })
      throw error
    }
  }

  /**
   * Get version history for a template
   */
  static async getVersionHistory(templateId: string): Promise<EmailTemplateVersion[]> {
    try {
      const versions = await prisma.emailTemplateVersion.findMany({
        where: { templateId },
        orderBy: { version: 'desc' }
      })

      return versions as unknown as EmailTemplateVersion[]
    } catch (error) {
      logger.error('Failed to get version history', { error, templateId })
      throw error
    }
  }

  /**
   * Render a template with variables
   */
  static async renderTemplate(slug: string, variables: Record<string, any>): Promise<RenderedEmail> {
    try {
      const template = await this.getTemplateBySlug(slug)
      
      if (!template) {
        throw new Error(`Template not found: ${slug}`)
      }

      if (!template.isActive) {
        throw new Error(`Template is inactive: ${slug}`)
      }

      // Render HTML content
      let html = template.htmlContent
      let text = template.textContent || ''
      let subject = template.subject

      // Replace variables in content
      Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`{{${key}}}`, 'g')
        html = html.replace(regex, String(value))
        text = text.replace(regex, String(value))
        subject = subject.replace(regex, String(value))
      })

      return {
        subject,
        html,
        text,
        variables
      }
    } catch (error) {
      logger.error('Failed to render template', { error, slug, variables })
      throw error
    }
  }

  /**
   * Validate template HTML
   */
  static async validateTemplate(html: string): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []

    // Basic validation
    if (!html || html.trim().length === 0) {
      errors.push('HTML content is required')
    }

    if (html.length > 100000) {
      warnings.push('HTML content is very large (>100KB)')
    }

    // Check for common issues
    if (!html.includes('<html') && !html.includes('<body')) {
      warnings.push('Consider wrapping content in proper HTML structure')
    }

    if (html.includes('<script')) {
      errors.push('Script tags are not allowed for security reasons')
    }

    if (html.includes('javascript:')) {
      errors.push('JavaScript protocol is not allowed for security reasons')
    }

    // Check for unclosed tags (basic check)
    const openTags = (html.match(/<[^/][^>]*>/g) || []).length
    const closeTags = (html.match(/<\/[^>]*>/g) || []).length
    if (Math.abs(openTags - closeTags) > 5) {
      warnings.push('Possible unclosed HTML tags detected')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Log email sending
   */
  static async logEmail(data: {
    templateId: string
    recipient: string
    subject: string
    status: 'sent' | 'failed' | 'pending'
    errorMessage?: string
    metadata?: Record<string, any>
  }): Promise<EmailLog> {
    try {
      const log = await prisma.emailLog.create({
        data: {
          templateId: data.templateId,
          recipient: data.recipient,
          subject: data.subject,
          status: data.status as any,
          errorMessage: data.errorMessage,
          metadata: data.metadata
        }
      })

      logger.info('Email logged', { logId: log.id, status: data.status })
      return log as unknown as EmailLog
    } catch (error) {
      logger.error('Failed to log email', { error, data })
      throw error
    }
  }

  /**
   * Get email logs
   */
  static async getEmailLogs(filters?: {
    templateId?: string
    status?: string
    page?: number
    limit?: number
  }): Promise<{ logs: EmailLog[], total: number }> {
    try {
      const where: any = {}
      const page = filters?.page || 1
      const limit = filters?.limit || 50
      const skip = (page - 1) * limit

      if (filters?.templateId) {
        where.templateId = filters.templateId
      }

      if (filters?.status) {
        where.status = filters.status
      }

      const [logs, total] = await Promise.all([
        prisma.emailLog.findMany({
          where,
          orderBy: { sentAt: 'desc' },
          skip,
          take: limit,
          include: {
            template: {
              select: {
                name: true,
                slug: true
              }
            }
          }
        }),
        prisma.emailLog.count({ where })
      ])

      return { logs: logs as unknown as EmailLog[], total }
    } catch (error) {
      logger.error('Failed to get email logs', { error, filters })
      throw error
    }
  }

  /**
   * Seed default templates
   */
  static async seedDefaultTemplates(): Promise<void> {
    try {
      const existingTemplates = await this.listTemplates()
      const existingSlugs = new Set(existingTemplates.map(t => t.slug))

      for (const templateData of DEFAULT_EMAIL_TEMPLATES) {
        if (!existingSlugs.has(templateData.slug)) {
          await this.createTemplate(templateData)
          logger.info('Default template seeded', { slug: templateData.slug })
        }
      }

      logger.info('Default templates seeding completed')
    } catch (error) {
      logger.error('Failed to seed default templates', { error })
      throw error
    }
  }

  /**
   * Get template statistics
   */
  static async getTemplateStats(): Promise<{
    total: number
    active: number
    byCategory: Record<string, number>
    recentActivity: number
  }> {
    try {
      const [total, active, byCategory, recentActivity] = await Promise.all([
        prisma.emailTemplate.count(),
        prisma.emailTemplate.count({ where: { isActive: true } }),
        prisma.emailTemplate.groupBy({
          by: ['category'],
          _count: { category: true }
        }),
        prisma.emailLog.count({
          where: {
            sentAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
            }
          }
        })
      ])

      const categoryStats = byCategory.reduce((acc, item) => {
        acc[item.category] = item._count.category
        return acc
      }, {} as Record<string, number>)

      return {
        total,
        active,
        byCategory: categoryStats,
        recentActivity
      }
    } catch (error) {
      logger.error('Failed to get template stats', { error })
      throw error
    }
  }
} 