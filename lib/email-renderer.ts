import { logger } from '@/lib/logger'
import { ValidationResult, EmailVariable } from '@/types/email-templates'

export class EmailRenderer {
  /**
   * Render a template with variable substitution
   */
  static renderTemplate(template: string, variables: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, variableName) => {
      return variables[variableName] !== undefined ? String(variables[variableName]) : match
    })
  }

  /**
   * Generate sample data for variables
   */
  static generateSampleData(variables: EmailVariable[]): Record<string, any> {
    const sampleData: Record<string, any> = {}
    
    variables.forEach(variable => {
      if (variable.defaultValue !== undefined) {
        sampleData[variable.name] = variable.defaultValue
      } else {
        sampleData[variable.name] = this.getSampleValue(variable.type)
      }
    })
    
    return sampleData
  }

  /**
   * Get sample value based on variable type
   */
  private static getSampleValue(type: string): any {
    switch (type.toLowerCase()) {
      case 'string':
        return 'Sample Text'
      case 'number':
        return 123
      case 'boolean':
        return true
      case 'date':
        return new Date().toLocaleDateString()
      case 'email':
        return 'user@example.com'
      case 'name':
        return 'John Doe'
      case 'amount':
        return '$99.99'
      case 'currency':
        return 'USD'
      case 'url':
        return 'https://example.com'
      case 'phone':
        return '+1 (555) 123-4567'
      case 'address':
        return '123 Main St, City, State 12345'
      case 'company':
        return 'Sample Company Inc.'
      case 'product':
        return 'Sample Product'
      case 'order_id':
        return 'ORD-12345'
      case 'transaction_id':
        return 'TXN-67890'
      case 'subscription_plan':
        return 'Premium'
      case 'expiry_date':
        return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()
      case 'login_url':
        return 'https://app.example.com/login'
      case 'support_email':
        return 'support@example.com'
      case 'website':
        return 'https://example.com'
      case 'logo_url':
        return 'https://example.com/logo.png'
      case 'unsubscribe_url':
        return 'https://example.com/unsubscribe'
      case 'preferences_url':
        return 'https://example.com/preferences'
      default:
        return 'Sample Value'
    }
  }

  /**
   * Validate template variables
   */
  static validateTemplate(template: string, variables: EmailVariable[]): {
    isValid: boolean
    errors: string[]
    warnings: string[]
  } {
    const errors: string[] = []
    const warnings: string[] = []
    
    // Extract all variables used in template
    const usedVariables = new Set<string>()
    const matches = template.match(/\{\{(\w+)\}\}/g)
    
    if (matches) {
      matches.forEach(match => {
        const variableName = match.slice(2, -2) // Remove {{ }}
        usedVariables.add(variableName)
      })
    }
    
    // Check for undefined variables
    const definedVariables = new Set(variables.map(v => v.name))
    usedVariables.forEach(variableName => {
      if (!definedVariables.has(variableName)) {
        errors.push(`Undefined variable: {{${variableName}}}`)
      }
    })
    
    // Check for required variables that are not used
    variables.forEach(variable => {
      if (variable.required && !usedVariables.has(variable.name)) {
        warnings.push(`Required variable '${variable.name}' is not used in template`)
      }
    })
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Sanitize HTML content for email
   */
  static sanitizeHtml(html: string): string {
    // Basic HTML sanitization - in production, use a proper HTML sanitizer
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
  }

  /**
   * Convert HTML to plain text
   */
  static htmlToText(html: string): string {
    // Basic HTML to text conversion
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim()
  }
} 