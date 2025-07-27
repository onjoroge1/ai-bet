import { ContentValidator } from '../lib/ai/content-validator'

async function testContentValidation() {
  console.log('🧪 Testing Content Validation Fix...\n')

  const validator = new ContentValidator()

  // Test content that would have failed with 85 threshold but should pass with 75
  const testContent = {
    title: "Test Blog Post Title",
    content: "This is a test blog post content with good readability and structure. It includes relevant keywords and maintains a balanced perspective. The content is well-structured with proper introduction and conclusion.",
    excerpt: "This is a test excerpt for the blog post that summarizes the main content.",
    seoTitle: "Test SEO Title",
    seoDescription: "This is a test SEO description that meets the length requirements and includes relevant keywords for better search engine optimization.",
    seoKeywords: ["test", "blog", "content", "validation"],
    keywords: ["test", "blog", "content", "validation"],
    category: "general",
    tags: ["test", "validation"],
    readTime: 3
  }

  try {
    console.log('📝 Testing content validation with lowered threshold...')
    const result = await validator.validateContent(testContent)
    
    console.log(`✅ Validation completed!`)
    console.log(`   Score: ${result.score}`)
    console.log(`   Is Valid: ${result.isValid}`)
    console.log(`   Issues: ${result.issues.length}`)
    console.log(`   Suggestions: ${result.suggestions.length}`)
    
    if (result.isValid) {
      console.log('\n🎉 Content validation is working with the new threshold!')
    } else {
      console.log('\n⚠️ Content still failing validation. Check the issues:')
      result.issues.forEach(issue => console.log(`   - ${issue}`))
    }

  } catch (error) {
    console.error('❌ Content validation test failed:', error)
  }
}

// Run the test
testContentValidation().catch(console.error) 